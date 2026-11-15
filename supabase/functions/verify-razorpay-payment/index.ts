import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";

async function hmacHex(message: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  try {
    if (!keyId || !keySecret) return Response.json({ error: "Razorpay credentials are not configured." }, { status: 503 });
    const authorization = req.headers.get("Authorization");
    if (!authorization) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { kind, local_order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!["connection", "subscription"].includes(kind) || !local_order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return Response.json({ error: "Missing payment verification fields" }, { status: 400 });
    }
    const expected = await hmacHex(razorpay_order_id + "|" + razorpay_payment_id, keySecret);
    if (!safeEqual(expected, String(razorpay_signature))) return Response.json({ error: "Payment signature verification failed" }, { status: 400 });

    const admin = createClient(url, service);
    const table = kind === "connection" ? "connection_payment_orders" : "professional_subscription_payment_orders";
    const ownerCol = kind === "connection" ? "customer_id" : "professional_id";
    const { data: order, error: orderError } = await admin.from(table).select("*").eq("id", local_order_id).eq(ownerCol, user.id).maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.provider_order_id !== razorpay_order_id) return Response.json({ error: "Payment order does not match this account." }, { status: 403 });
    if (order.status === "paid") return Response.json({ success: true, already_processed: true });
    const response = await fetch("https://api.razorpay.com/v1/payments/" + encodeURIComponent(razorpay_payment_id), {
      headers: { Authorization: "Basic " + btoa(keyId + ":" + keySecret) }
    });
    const payment = await response.json();
    if (!response.ok) return Response.json({ error: "Unable to confirm payment with Razorpay", details: payment }, { status: 502 });
    if (payment.order_id !== razorpay_order_id || Number(payment.amount) !== Math.round(Number(order.amount_inr) * 100) || payment.currency !== "INR") {
      return Response.json({ error: "Payment amount or order details do not match." }, { status: 400 });
    }
    if (payment.status !== "captured") return Response.json({ error: "Payment is not captured yet. Current status: " + payment.status }, { status: 409 });

    if (kind === "connection") {
      const { error } = await admin.from(table).update({ status: "paid", provider: "razorpay", provider_payment_id: razorpay_payment_id, paid_at: new Date().toISOString(), metadata: { ...(order.metadata || {}), razorpay_signature_verified: true } }).eq("id", local_order_id);
      if (error) throw error;
      const { error: creditError } = await admin.rpc("credit_connection_wallet_from_payment", { p_order_id: local_order_id });
      if (creditError) throw creditError;
    } else {
      const { error } = await admin.rpc("finalize_professional_subscription_payment", {
        p_order_id: local_order_id, p_provider: "razorpay", p_provider_order_id: razorpay_order_id, p_provider_payment_id: razorpay_payment_id
      });
      if (error) throw error;
    }
    return Response.json({ success: true, kind, local_order_id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment verification failed" }, { status: 500 });
  }
});