import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const digits = (value: unknown) => typeof value === "string" ? value.replace(/\D/g, "") : "";

// Accept only an Indian 10-digit mobile number, optionally prefixed by country code 91.
function normalizedIndianPhone(value: unknown): string {
  const d = digits(value);
  if (d.length === 10) return d;
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  return "";
}

async function phoneRateLimitHash(phone: string): Promise<string> {
  // Hash in the Edge Function so raw phone numbers are not stored in the limiter table.
  const bytes = new TextEncoder().encode(phone);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function getVerifiedPhone(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const root = result as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : {};
  // MSG91 documents this endpoint as returning verified user information. Some integrations
  // expose the verified mobile as "message"; accept it only if it parses as an Indian number.
  const candidates = [
    data.mobile, data.phone, data.identifier, data.message,
    root.mobile, root.phone, root.identifier, root.message,
  ];
  for (const candidate of candidates) {
    const phone = normalizedIndianPhone(candidate);
    if (phone) return phone;
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const phone = normalizedIndianPhone(body.phone);
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const mode = body.mode === "professional" ? "professional" : "customer";
  if (accessToken.length < 20 || accessToken.length > 8192 || !phone ||
      password.length < 8 || password.length > 128 || fullName.length < 2 || fullName.length > 120) {
    return json({ error: "Required registration details are missing or invalid" }, 400);
  }

  // Both secrets are read exclusively from Supabase Edge Function environment variables.
  // Never accept either secret from the client or return them in responses.
  const authKey = Deno.env.get("MSG91_AUTH_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authKey || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Registration service is not configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Atomic DB-backed limit: maximum 10 registration attempts per phone in a 15-minute window.
  // The limiter stores only a SHA-256 hash, not the raw mobile number.
  let rateLimitHash: string;
  try {
    rateLimitHash = await phoneRateLimitHash(phone);
    const { data: allowed, error } = await admin.rpc("msg91_registration_rate_limit", {
      p_phone_hash: rateLimitHash,
    });
    if (error || allowed !== true) {
      return json({ error: error ? "Registration temporarily unavailable. Please try later." :
        "Too many registration attempts. Please wait 15 minutes and try again." }, error ? 503 : 429);
    }
  } catch {
    // Fail closed if the rate limiter cannot be reached.
    return json({ error: "Registration temporarily unavailable. Please try later." }, 503);
  }

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authkey: authKey, "access-token": accessToken }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return json({ error: "OTP provider unavailable" }, 502);
  }

  let providerResult: unknown;
  try {
    providerResult = await verifyResponse.json();
  } catch {
    return json({ error: "Invalid OTP provider response" }, 502);
  }

  // MSG91 can return HTTP 200 with an error payload; inspect the body as well as HTTP status.
  if (!verifyResponse.ok || !providerResult || typeof providerResult !== "object" ||
      !("type" in providerResult) || typeof providerResult.type !== "string" ||
      providerResult.type.toLowerCase() !== "success") {
    return json({ error: "Mobile verification failed. Please request a new OTP." }, 401);
  }

  const verifiedPhone = getVerifiedPhone(providerResult);
  // Fail closed: no verified phone field, or any mismatch, means no account creation.
  if (!verifiedPhone || verifiedPhone !== phone) {
    return json({ error: "Verified mobile number did not match the number entered. Please retry." }, 401);
  }

  const e164 = `+91${phone}`;
  try {
    const { data, error } = await admin.auth.admin.createUser({
      phone: e164,
      phone_confirm: true,
      password,
      user_metadata: { initial_mode: mode, full_name: fullName, display_name: fullName },
    });
    if (error || !data.user) {
      // Avoid exposing whether a phone is already registered.
      return json({ error: "Could not create this account. Try signing in or use PIN recovery if you already registered." }, 409);
    }
    return json({ created: true, phone: e164 });
  } catch {
    return json({ error: "Could not create account. Please try again." }, 500);
  }
});
