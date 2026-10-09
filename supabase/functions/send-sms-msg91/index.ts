import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function internationalMobile(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits || digits.length < 10 || digits.length > 15) {
    throw new Error("Invalid phone number supplied by Supabase Auth");
  }
  return digits;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const hookSecretRaw = Deno.env.get("SEND_SMS_HOOK_SECRET");
  const authKey = Deno.env.get("MSG91_AUTH_KEY");
  const templateId = Deno.env.get("MSG91_OTP_TEMPLATE_ID");

  if (!hookSecretRaw || !authKey || !templateId) {
    console.error("MSG91 hook configuration is incomplete");
    return json({ error: "SMS provider is not configured" }, 500);
  }

  let payload: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    const rawBody = await req.text();
    const secret = hookSecretRaw.replace(/^v1,whsec_/, "");
    const webhook = new Webhook(secret);
    payload = webhook.verify(rawBody, Object.fromEntries(req.headers)) as typeof payload;
  } catch {
    return json({ error: "Invalid Supabase Auth hook signature" }, 401);
  }

  const phone = payload.user?.phone;
  const otp = payload.sms?.otp;
  if (!phone || !otp || !/^\d{4,10}$/.test(otp)) {
    return json({ error: "Supabase Auth hook payload is missing a valid phone or OTP" }, 400);
  }

  let mobile: string;
  try {
    mobile = internationalMobile(phone);
  } catch {
    return json({ error: "Invalid destination phone number" }, 400);
  }

  // The MSG91 DLT-approved template must contain this exact variable name: VAR1.
  let response: Response;
  try {
    response = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: {
        accept: "application/json",
        authkey: authKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        template_id: templateId,
        recipients: [{ mobiles: mobile, VAR1: otp }],
      }),
    });
  } catch (error) {
    console.error("MSG91 request failed", error instanceof Error ? error.message : "network error");
    return json({ error: "SMS provider request failed" }, 502);
  }

  const responseText = await response.text();
  if (!response.ok) {
    console.error("MSG91 rejected SMS request", response.status, responseText.slice(0, 500));
    return json({ error: "SMS provider rejected the request" }, 502);
  }

  // MSG91 may return HTTP 200 with a provider-level error payload.
  try {
    const result = JSON.parse(responseText);
    if (typeof result.type === "string" && result.type.toLowerCase() === "error") {
      console.error("MSG91 reported SMS error", String(result.message ?? "unknown").slice(0, 300));
      return json({ error: "SMS provider could not accept the message" }, 502);
    }
  } catch {
    // Some successful provider responses may not be JSON; HTTP 2xx is accepted.
  }

  return new Response(null, { status: 200 });
});
