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
const normalizedIndianPhone = (value: unknown) => {
  const d = digits(value);
  return d.length >= 10 ? d.slice(-10) : "";
};
function getVerifiedPhone(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const root = result as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : {};
  // Fail closed unless MSG91 returns a phone/identifier in its verified response.
  const candidates = [data.mobile, data.phone, data.identifier, root.mobile, root.phone, root.identifier];
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
  if (accessToken.length < 20 || accessToken.length > 8192 || !phone || password.length < 8 || fullName.length < 2) {
    return json({ error: "Required registration details are missing or invalid" }, 400);
  }

  const authKey = Deno.env.get("MSG91_AUTH_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authKey || !supabaseUrl || !serviceRoleKey) return json({ error: "Registration service is not configured" }, 500);

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authkey: authKey, "access-token": accessToken }),
    });
  } catch {
    return json({ error: "OTP provider unavailable" }, 502);
  }
  let providerResult: unknown;
  try { providerResult = await verifyResponse.json(); } catch { return json({ error: "Invalid OTP provider response" }, 502); }
  if (!verifyResponse.ok || !providerResult || typeof providerResult !== "object" ||
      !("type" in providerResult) || typeof providerResult.type !== "string" ||
      providerResult.type.toLowerCase() !== "success") {
    return json({ error: "Mobile verification failed. Please request a new OTP." }, 401);
  }

  const verifiedPhone = getVerifiedPhone(providerResult);
  if (!verifiedPhone || verifiedPhone !== phone) {
    return json({ error: "Verified mobile number did not match the number entered. Please retry." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
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
