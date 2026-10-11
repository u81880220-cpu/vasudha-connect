import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function normalizeIndianPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
}
function verifiedPhoneFrom(payload: unknown): string | null {
  const phoneKeys = new Set(["mobile", "phone", "phone_number", "phonenumber", "identifier", "mobile_number", "mobilenumber"]);
  const seen = new Set<object>();
  function visit(value: unknown, depth: number): string | null {
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value as object)) return null;
    seen.add(value as object);
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    const obj = value as Record<string, unknown>;
    for (const [key, field] of Object.entries(obj)) {
      if (phoneKeys.has(key.toLowerCase().replace(/[-\s]/g, ""))) {
        const phone = normalizeIndianPhone(field);
        if (phone) return phone;
      }
    }
    for (const field of Object.values(obj)) {
      if (field && typeof field === "object") {
        const found = visit(field, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return visit(payload, 0);
}

// MSG91 may return a success status without repeating the identifier in the
// verification response. After MSG91 validates the access token server-side,
// inspect its JWT claims for the verified identifier; never trust claims before
// the provider confirms that the token is valid.
function verifiedPhoneFromAccessToken(accessToken: string): string | null {
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const claims: unknown = JSON.parse(atob(padded));
    return verifiedPhoneFrom(claims);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authKey = Deno.env.get("MSG91_AUTH_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authKey || !supabaseUrl || !serviceRoleKey) {
    console.error("msg91-register missing required server configuration");
    return json({ error: "Registration service is not configured" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request body" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const phone = normalizeIndianPhone(body.phone);
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const mode = body.mode === "customer" || body.mode === "professional" ? body.mode : null;

  if (accessToken.length < 20 || accessToken.length > 8192) return json({ error: "Valid MSG91 accessToken is required" }, 400);
  if (!phone) return json({ error: "Enter a valid Indian mobile number" }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: "Password must be 8–128 characters" }, 400);
  if (fullName.length < 2 || fullName.length > 120) return json({ error: "Enter your full name" }, 400);
  if (!mode) return json({ error: "Choose customer or professional account type" }, 400);

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authkey: authKey, "access-token": accessToken }),
    });
  } catch {
    return json({ error: "MSG91 verification service is unavailable" }, 502);
  }

  let providerResult: unknown;
  try { providerResult = await providerResponse.json(); } catch { return json({ error: "Invalid response from MSG91" }, 502); }
  if (!providerResponse.ok || !providerResult || typeof providerResult !== "object" ||
      !("type" in providerResult) || typeof (providerResult as { type?: unknown }).type !== "string" ||
      (providerResult as { type: string }).type.toLowerCase() !== "success") {
    return json({ error: "MSG91 could not verify this OTP session" }, 401);
  }

  // Fail closed: never create an account unless MSG91 returns the verified number.
  const verifiedPhone = verifiedPhoneFrom(providerResult) ?? verifiedPhoneFromAccessToken(accessToken);
  if (!verifiedPhone) {
    const responseKeys = providerResult && typeof providerResult === "object" ? Object.keys(providerResult as Record<string, unknown>) : [];
    console.error("MSG91 token verified but no phone identifier was present in the verified response or token claims; refusing account creation", { responseKeys });
    return json({ error: "MSG91 accepted the OTP, but its verified response did not include a phone number KAMPRO can safely match. No account was created. Please contact support." }, 422);
  }
  if (verifiedPhone !== phone) return json({ error: "Verified mobile number does not match the registration number" }, 403);

  let accountResponse: Response;
  try {
    accountResponse = await fetch(new URL("/auth/v1/admin/users", supabaseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey },
      body: JSON.stringify({
        phone: "+" + phone, password, phone_confirm: true,
        user_metadata: { full_name: fullName, initial_mode: mode, phone_verified_by: "msg91" },
      }),
    });
  } catch {
    return json({ error: "KAMPRO account service is unavailable" }, 502);
  }
  let account: Record<string, unknown> = {};
  try { account = await accountResponse.json(); } catch { /* handled below */ }
  if (!accountResponse.ok) {
    const detail = typeof account.msg === "string" ? account.msg : typeof account.message === "string" ? account.message : "";
    if (/already|exists|registered/i.test(detail)) return json({ error: "An account already exists for this mobile number. Please sign in." }, 409);
    console.error("Supabase account creation failed", accountResponse.status, detail.slice(0, 160));
    return json({ error: "KAMPRO could not create the account. Please try again." }, accountResponse.status >= 500 ? 502 : 400);
  }

  return json({
    success: true,
    user: { id: typeof account.id === "string" ? account.id : null, phone: "+" + phone, fullName, mode },
    message: "Mobile verified and account created. Sign in using your mobile number and password.",
  }, 201);
});
