import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("PAYMENT_WEBHOOK_SECRET")!;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const supplied = req.headers.get("x-vasudha-webhook-secret") || "";
  if (!webhookSecret || supplied !== webhookSecret) return new Response("Unauthorized", { status: 401 });

  try {
    const event = await req.json();
    if (event?.type !== "payment.captured") return Response.json({ ok: true, ignored: true });

    const orderId = event?.data?.order_id;
    const paymentId = event?.data?.payment_id;
    const provider = event?.provider || "razorpay";
    if (!orderId || !paymentId) return Response.json({ error: "Missing payment identifiers" }, { status: 400 });

    const admin = createClient(supabaseUrl, serviceRole);
    const { data: order, error: lookupError } = await admin
      .from("connection_payment_orders")
      .select("id,status,amount_inr,provider_order_id")
      .eq("provider_order_id", orderId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!order) return Response.json({ error: "Unknown payment order" }, { status: 404 });
    if (order.status === "paid") return Response.json({ ok: true, already_processed: true });

    const { data: settled, error: settleError } = await admin.rpc("finalize_connection_payment", {
      p_order_id: order.id,
      p_provider: provider,
      p_provider_order_id: orderId,
      p_provider_payment_id: paymentId
    });
    if (settleError) throw settleError;

    const { error: creditError } = await admin.rpc("credit_connection_wallet_from_payment", { p_order_id: order.id });
    if (creditError) throw creditError;

    return Response.json({ ok: true, order_id: settled?.id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Webhook processing failed" }, { status: 500 });
  }
});
