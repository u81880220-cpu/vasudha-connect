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
const demos = data.users.filter(u => demoEmails.includes((u.email || "").toLowerCase()));
const ids = demos.map(u => u.id);
const customerIds = demos.filter(u => u.email?.startsWith("demo.customer")).map(u => u.id);
const professionalIds = demos.filter(u => u.email?.startsWith("demo.pro")).map(u => u.id);

async function remove(table, column, values) {
  if (!values.length) return;
  const { error: e } = await admin.from(table).delete().in(column, values);
  if (e) throw new Error(table + "." + column + ": " + e.message);
}

const { data: demoJobs1, error: j1 } = customerIds.length
  ? await admin.from("jobs").select("id").in("customer_id", customerIds)
  : { data: [], error: null };
const { data: demoJobs2, error: j2 } = professionalIds.length
  ? await admin.from("jobs").select("id").in("professional_id", professionalIds)
  : { data: [], error: null };
if (j1 || j2) throw j1 || j2;
const jobIds = [...new Set([...(demoJobs1 || []).map(x => x.id), ...(demoJobs2 || []).map(x => x.id)])];

const { data: demoConvos1, error: c1 } = customerIds.length
  ? await admin.from("conversations").select("id").in("customer_id", customerIds)
  : { data: [], error: null };
const { data: demoConvos2, error: c2 } = professionalIds.length
  ? await admin.from("conversations").select("id").in("professional_id", professionalIds)
  : { data: [], error: null };
if (c1 || c2) throw c1 || c2;
const conversationIds = [...new Set([...(demoConvos1 || []).map(x => x.id), ...(demoConvos2 || []).map(x => x.id)])];

await remove("job_live_locations", "job_id", jobIds);
await remove("customer_job_reviews", "job_id", jobIds);
await remove("job_reviews", "job_id", jobIds);
await remove("complaints", "job_id", jobIds);
await remove("messages", "conversation_id", conversationIds);
await remove("conversations", "id", conversationIds);
await remove("jobs", "id", jobIds);
await remove("service_requests", "customer_id", customerIds);
await remove("service_requests", "professional_id", professionalIds);
await remove("professional_connections", "customer_id", customerIds);
await remove("professional_connections", "professional_id", professionalIds);
await remove("connection_purchases", "user_id", customerIds);
await remove("connection_payment_orders", "customer_id", customerIds);
await remove("professional_subscription_payment_orders", "professional_id", professionalIds);
await remove("professional_subscriptions", "professional_id", professionalIds);
await remove("notifications", "user_id", ids);

for (const id of customerIds) {
  const { error: e } = await admin.from("connection_wallets").upsert({ user_id: id, balance: 10 }, { onConflict: "user_id" });
  if (e) throw e;
}

console.log(JSON.stringify({ ok: true, demoUsers: demos.map(x => x.email), clearedJobs: jobIds.length, clearedConversations: conversationIds.length }));
