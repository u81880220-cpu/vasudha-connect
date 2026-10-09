import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cashfreeSecret = Deno.env.get("CASHFREE_SECRET_KEY") || "";

async function verifyCashfreeSignature(timestamp: string, rawBody: string, signature: string) {
  if (!cashfreeSecret || !timestamp || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(cashfreeSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + rawBody));
  const bytes = new Uint8Array(signed);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary) === signature;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get("x-webhook-timestamp") || "";
    const signature = req.headers.get("x-webhook-signature") || "";
    if (!(await verifyCashfreeSignature(timestamp, rawBody, signature))) {
      return Response.json({ error: "Invalid Cashfree webhook signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = String(event?.type || "");
    if (eventType !== "PAYMENT_SUCCESS_WEBHOOK" && eventType !== "PAYMENT_SUCCESS" && eventType !== "payment.captured") {
      return Response.json({ ok: true, ignored: true, event_type: eventType });
    }
    const orderId = event?.data?.order?.order_id || event?.data?.order_id;
    const paymentStatus = String(event?.data?.payment?.payment_status || event?.data?.payment_status || "");
    const paymentId = String(event?.data?.payment?.cf_payment_id || event?.data?.payment_id || "");
    if (paymentStatus && paymentStatus !== "SUCCESS") return Response.json({ ok: true, ignored: true, payment_status: paymentStatus });
    if (!orderId || !paymentId) return Response.json({ error: "Missing payment identifiers" }, { status: 400 });

    const admin = createClient(supabaseUrl, serviceRole);
    const { data: subscriptionOrder, error: subLookupError } = await admin
      .from("professional_subscription_payment_orders")
      .select("id,status,amount_inr")
      .eq("provider_order_id", orderId)
      .maybeSingle();
    if (subLookupError) throw subLookupError;
    if (subscriptionOrder) {
      if (subscriptionOrder.status === "paid") return Response.json({ ok: true, already_processed: true, type: "professional_subscription" });
      const { error } = await admin.rpc("finalize_professional_subscription_payment", {
        p_order_id: subscriptionOrder.id, p_provider: "cashfree",
        p_provider_order_id: orderId, p_provider_payment_id: paymentId
      });
      if (error) throw error;
      return Response.json({ ok: true, order_id: subscriptionOrder.id, type: "professional_subscription" });
    }

    const { data: order, error: lookupError } = await admin
      .from("connection_payment_orders")
      .select("id,status,amount_inr")
      .eq("provider_order_id", orderId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!order) return Response.json({ error: "Unknown Cashfree payment order" }, { status: 404 });
    if (order.status === "paid") return Response.json({ ok: true, already_processed: true, type: "connection_package" });

    const { data: settled, error: settleError } = await admin.rpc("finalize_connection_payment", {
      p_order_id: order.id, p_provider: "cashfree",
      p_provider_order_id: orderId, p_provider_payment_id: paymentId
    });
    if (settleError) throw settleError;
    const { error: creditError } = await admin.rpc("credit_connection_wallet_from_payment", { p_order_id: order.id });
    if (creditError) throw creditError;
    return Response.json({ ok: true, order_id: settled?.id || order.id, type: "connection_package" });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 500 });
  }
});
