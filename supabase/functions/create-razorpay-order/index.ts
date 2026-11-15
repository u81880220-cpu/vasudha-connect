import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  try {
    if (!keyId || !keySecret) return Response.json({ error: "Razorpay test API credentials are not configured." }, { status: 503 });
    const authorization = req.headers.get("Authorization");
    if (!authorization) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const kind = body?.kind;
    if (kind !== "connection" && kind !== "subscription") return Response.json({ error: "Invalid payment kind" }, { status: 400 });

    let localOrder: any;
    let planName = "";
    if (kind === "connection") {
      if (!body.package_code) return Response.json({ error: "package_code is required" }, { status: 400 });
      const { data, error } = await userClient.rpc("create_connection_payment_order", { p_package: body.package_code });
      if (error) throw error;
      localOrder = data;
    } else {
      if (!body.plan_id) return Response.json({ error: "plan_id is required" }, { status: 400 });
      const { data, error } = await userClient.rpc("create_professional_subscription_payment_order", { p_plan_id: body.plan_id });
      if (error) throw error;
      localOrder = Array.isArray(data) ? data[0] : data;
      planName = localOrder?.plan_name || "KAMPRO professional subscription";
    }
    if (!localOrder?.id || !(Number(localOrder.amount_inr) > 0)) throw new Error("Unable to create a valid local payment order.");

    const receipt = "km_" + String(localOrder.id).replace(/-/g, "").slice(0, 36);
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(keyId + ":" + keySecret),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: Math.round(Number(localOrder.amount_inr) * 100),
        currency: "INR",
        receipt,
        notes: { kampro_order_id: localOrder.id, kampro_kind: kind, kampro_user_id: user.id }
      })
    });
    const razor = await response.json();
    if (!response.ok) return Response.json({ error: "Razorpay order creation failed", details: razor }, { status: 502 });
    const admin = createClient(url, service);
    const table = kind === "connection" ? "connection_payment_orders" : "professional_subscription_payment_orders";
    const { error: updateError } = await admin.from(table).update({
      provider: "razorpay", provider_order_id: razor.id, status: "pending",
      metadata: { razorpay_receipt: receipt, razorpay_order_status: razor.status, payment_environment: "test" }
    }).eq("id", localOrder.id);
    if (updateError) throw updateError;
    return Response.json({
      local_order_id: localOrder.id, kind, razorpay_order_id: razor.id,
      key_id: keyId, amount: razor.amount, currency: razor.currency,
      name: "KAMPRO", description: kind === "connection" ? "Connection package" : planName,
      prefill: { contact: user.phone || "", email: user.email || "" },
      theme: { color: "#FF4B1F" }
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create Razorpay order" }, { status: 500 });
  }
});