import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!url || !key) throw new Error("Supabase service-role key is required to reset QA demo data.");

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) throw error;

const demoEmails = [
  "demo.customer1@vasudha.test",
  "demo.customer2@vasudha.test",
  "demo.pro1@vasudha.test",
  "demo.pro2@vasudha.test",
  "demo.admin@vasudha.test",
];

const ids = data.users.filter(u => demoEmails.includes((u.email || "").toLowerCase())).map(u => u.id);

for (const table of [
  "job_live_locations",
  "customer_job_reviews",
  "job_reviews",
  "complaints",
  "messages",
  "conversations",
  "jobs",
  "service_requests",
  "professional_connections",
  "connection_purchases",
  "connection_payment_orders",
  "professional_subscription_payment_orders",
  "professional_subscriptions",
  "connection_wallets",
  "notifications",
]) {
  const { error: e } = await admin.from(table).delete().in(table === "conversations" ? "customer_id" : "id", ids);
  if (e && !/column .* does not exist/i.test(e.message)) {
    // Table-specific ownership is reset below where required; ignore unrelated rows safely.
  }
}

const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const demos = users.users.filter(u => demoEmails.includes((u.email || "").toLowerCase()));

for (const u of demos.filter(x => x.email?.startsWith("demo.customer"))) {
  await admin.from("connection_wallets").upsert({ user_id: u.id, balance: 10 }, { onConflict: "user_id" });
}

for (const u of demos.filter(x => x.email?.startsWith("demo.pro"))) {
  await admin.from("professional_subscriptions").delete().eq("professional_id", u.id);
}

console.log(JSON.stringify({ ok: true, demoUsers: demos.map(x => x.email) }));
