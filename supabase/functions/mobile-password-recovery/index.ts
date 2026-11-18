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
      for (const item of value) { const found = visit(item, depth + 1); if (found) return found; }
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
      if (field && typeof field === "object") { const found = visit(field, depth + 1); if (found) return found; }
    }
    return null;
  }
  return visit(payload, 0);
}

function verifiedPhoneFromAccessToken(accessToken: string): string | null {
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    return verifiedPhoneFrom(JSON.parse(atob(padded)));
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authKey = Deno.env.get("MSG91_AUTH_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authKey || !supabaseUrl || !serviceRoleKey) {
    console.error("mobile-password-recovery missing required server configuration");
    return json({ error: "Password recovery is temporarily unavailable" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request body" }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return json({ error: "Invalid JSON body" }, 400); }

  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const requestedPhone = normalizeIndianPhone(body.phone);
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (accessToken.length < 20 || accessToken.length > 8192) return json({ error: "Complete mobile verification first" }, 400);
  if (!requestedPhone) return json({ error: "Enter a valid Indian mobile number" }, 400);
  if (newPassword.length < 6 || newPassword.length > 128) return json({ error: "Password must be 6–128 characters" }, 400);

  let verification: Response;
  try {
    verification = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authkey: authKey, "access-token": accessToken }),
    });
  } catch { return json({ error: "Mobile verification service is unavailable" }, 502); }

  let providerResult: unknown;
  try { providerResult = await verification.json(); }
  catch { return json({ error: "Invalid mobile verification response" }, 502); }

  if (!verification.ok || !providerResult || typeof providerResult !== "object" ||
      !("type" in providerResult) || typeof (providerResult as {type?:unknown}).type !== "string" ||
      (providerResult as {type:string}).type.toLowerCase() !== "success") {
    return json({ error: "Mobile verification expired or invalid. Please verify again." }, 401);
  }

  const providerMessage = (providerResult as Record<string, unknown>).message;
  const verifiedPhone = verifiedPhoneFrom(providerResult) ??
    normalizeIndianPhone(providerMessage) ??
    verifiedPhoneFromAccessToken(accessToken);
  if (!verifiedPhone || verifiedPhone !== requestedPhone) {
    return json({ error: "Verified mobile number does not match. Please restart recovery." }, 403);
  }

  // Locate the existing Auth user by the verified phone. Never create a new user here.
  let matchedUser: Record<string, unknown> | null = null;
  for (let page = 1; page <= 20; page++) {
    let response: Response;
    try {
      response = await fetch(new URL(`/auth/v1/admin/users?page=${page}&per_page=1000`, supabaseUrl), {
        headers: { apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey },
      });
    } catch { return json({ error: "Account service is temporarily unavailable" }, 502); }
    if (!response.ok) {
      console.error("mobile-password-recovery could not look up Auth users", response.status);
      return json({ error: "Account service is temporarily unavailable" }, 502);
    }
    const payload = await response.json();
    const users: unknown[] = Array.isArray(payload) ? payload : Array.isArray(payload?.users) ? payload.users : [];
    matchedUser = users.find((item) => {
      if (!item || typeof item !== "object") return false;
      return normalizeIndianPhone((item as Record<string, unknown>).phone) === requestedPhone;
    }) as Record<string, unknown> | undefined ?? null;
    if (matchedUser || users.length < 1000) break;
  }
  if (!matchedUser || typeof matchedUser.id !== "string") {
    return json({ error: "No KAMPRO account was found for this verified mobile number." }, 404);
  }

  let updateResponse: Response;
  try {
    updateResponse = await fetch(new URL(`/auth/v1/admin/users/${matchedUser.id}`, supabaseUrl), {
      method: "PUT",
      headers: { "Content-Type": "application/json", apikey: serviceRoleKey, Authorization: "Bearer " + serviceRoleKey },
      body: JSON.stringify({ password: newPassword }),
    });
  } catch { return json({ error: "Password service is temporarily unavailable" }, 502); }

  if (!updateResponse.ok) {
    const detail = await updateResponse.text();
    console.error("mobile-password-recovery password update failed", updateResponse.status, detail.slice(0, 180));
    return json({ error: "KAMPRO could not update the password. Please try again." }, 502);
  }

  return json({ success: true, message: "Password updated. Please sign in again." });
});
