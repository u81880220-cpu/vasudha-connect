import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const appId = Deno.env.get("CASHFREE_APP_ID") || "";
const secretKey = Deno.env.get("CASHFREE_SECRET_KEY") || "";
const apiVersion = Deno.env.get("CASHFREE_API_VERSION") || "2025-01-01";
const returnUrl = Deno.env.get("CASHFREE_RETURN_URL") || "";
const env = (Deno.env.get("CASHFREE_ENV") || "sandbox").toLowerCase();
const apiBase = env === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    if (!appId || !secretKey || !returnUrl) return Response.json({ error: "Cashfree credentials and CASHFREE_RETURN_URL must be configured on the server." }, { status: 503 });
    const authorization = req.headers.get("Authorization");
    if (!authorization) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    if (!body?.plan_id) return Response.json({ error: "plan_id is required" }, { status: 400 });
    const { data: order, error } = await userClient.rpc("create_professional_subscription_payment_order", { p_plan_id: body.plan_id });
    if (error) throw error;
    const orderId = "kampro_sub_" + String(order.id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 34);
    const phone = String(user.phone || "").replace(/^\+/, "");
    if (!phone) return Response.json({ error: "Add and verify a mobile number before paying." }, { status: 400 });
    const response = await fetch(apiBase + "/orders", {
      method: "POST",
      headers: { "x-client-id": appId, "x-client-secret": secretKey, "x-api-version": apiVersion, "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderId, order_amount: Number(order.amount_inr), order_currency: "INR",
        customer_details: { customer_id: user.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50), customer_phone: phone, ...(user.email ? { customer_email: user.email } : {}) },
        order_meta: { return_url: returnUrl },
        order_note: "KAMPRO professional subscription"
      })
    });
    const cf = await response.json();
    if (!response.ok) return Response.json({ error: "Cashfree order creation failed", details: cf }, { status: 502 });
    const admin = createClient(supabaseUrl, serviceKey);
    const { error: updateError } = await admin.from("professional_subscription_payment_orders").update({
      provider: "cashfree", provider_order_id: cf.order_id, status: "pending",
      metadata: { cashfree_cf_order_id: cf.cf_order_id, cashfree_order_status: cf.order_status }
    }).eq("id", order.id);
    if (updateError) throw updateError;
    return Response.json({ order_id: order.id, provider: "cashfree", cashfree_order_id: cf.order_id, payment_session_id: cf.payment_session_id, amount: Number(order.amount_inr), currency: "INR", environment: env, plan_name: order.plan_name, billing_interval: order.billing_interval });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create subscription order" }, { status: 500 });
  }
});
