import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const match = (req.headers.get("Authorization") || "").match(/^Bearer\\s+(.+)$/i);
  if (!match) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const pepper = Deno.env.get("ADMIN_OTP_PEPPER");
  const from = Deno.env.get("ADMIN_OTP_FROM");
  if (!url || !serviceKey || !pepper) return json({ error: "Admin verification service is not configured" }, 503);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await db.auth.getUser(match[1]);
  const user = authData.user;
  if (authError || !user?.email) return json({ error: "Unauthorized" }, 401);
  const { data: allowed, error: allowError } = await db.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (allowError || !allowed) return json({ error: "Admin access required" }, 403);

  let body: { action?: string; code?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid request" }, 400); }

  if (body.action === "send") {
    if (!resendKey || !from) return json({ error: "Email delivery is not configured. Add RESEND_API_KEY and ADMIN_OTP_FROM." }, 503);
    const { data: old } = await db.from("admin_email_otp_challenges").select("last_sent_at").eq("user_id", user.id).maybeSingle();
    if (old?.last_sent_at && Date.now() - new Date(old.last_sent_at).getTime() < 60_000) return json({ error: "Please wait before requesting another code." }, 429);

    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const code = String(random[0] % 1_000_000).padStart(6, "0");
    const hash = await sha256(user.id + ":" + code + ":" + pepper);
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [user.email], subject: "Your KAMPRO admin verification code", text: "Your KAMPRO admin verification code is " + code + ". It expires in 5 minutes. If you did not request this, ignore this email." }),
    });
    if (!sent.ok) {
      console.error("Resend delivery failed", sent.status, (await sent.text()).slice(0, 400));
      return json({ error: "Unable to send verification email. Check the email provider configuration." }, 502);
    }
    const now = new Date();
    const { error } = await db.from("admin_email_otp_challenges").upsert({
      user_id: user.id, code_hash: hash, expires_at: new Date(now.getTime() + 300_000).toISOString(),
      attempts: 0, last_sent_at: now.toISOString(), verified_until: null, updated_at: now.toISOString(),
    });
    if (error) return json({ error: "Could not create verification challenge." }, 500);
    return json({ success: true, message: "Verification code sent to your registered admin email." });
  }

  if (body.action === "verify") {
    const code = (body.code || "").trim();
    if (!/^\\d{6}$/.test(code)) return json({ error: "Enter the 6-digit verification code." }, 400);
    const { data: challenge } = await db.from("admin_email_otp_challenges").select("code_hash,expires_at,attempts").eq("user_id", user.id).maybeSingle();
    if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now()) return json({ error: "Code expired. Request a new one." }, 400);
    if (challenge.attempts >= 5) return json({ error: "Too many incorrect attempts. Request a new code later." }, 429);
    if (await sha256(user.id + ":" + code + ":" + pepper) !== challenge.code_hash) {
      await db.from("admin_email_otp_challenges").update({ attempts: challenge.attempts + 1, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      return json({ error: "Incorrect verification code." }, 400);
    }
    const until = new Date(Date.now() + 900_000).toISOString();
    const { error } = await db.from("admin_email_otp_challenges").update({
      verified_until: until, code_hash: "used", expires_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
    if (error) return json({ error: "Verification could not be completed." }, 500);
    return json({ success: true, verified_until: until });
  }
  return json({ error: "Unknown action" }, 400);
});
