import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Set EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).'
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EXPECTED = [
  { email: 'demo.customer1@vasudha.test', mode: 'customer' },
  { email: 'demo.customer2@vasudha.test', mode: 'customer' },
  { email: 'demo.pro1@vasudha.test', mode: 'professional' },
  { email: 'demo.pro2@vasudha.test', mode: 'professional' },
];

async function main() {
  const failures = [];

  const { data: authData, error: authError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) throw authError;

  const authUsers = new Map(
    authData.users
      .filter((u) => u.email)
      .map((u) => [u.email.toLowerCase(), u])
  );

  const ids = {};
  for (const expected of EXPECTED) {
    const user = authUsers.get(expected.email);
    if (!user) {
      failures.push(`Missing auth user: ${expected.email}`);
      continue;
    }
    ids[expected.email] = user.id;
  }

  const userIds = Object.values(ids);
  if (userIds.length) {
    const { data: profiles, error: profileError } = await admin
      .from('profiles')
      .select('id,full_name,current_mode,account_status')
      .in('id', userIds);
    if (profileError) throw profileError;

    for (const expected of EXPECTED) {
      const id = ids[expected.email];
      const p = profiles?.find((row) => row.id === id);
      if (!p) failures.push(`Missing profile: ${expected.email}`);
      else {
        if (p.current_mode !== expected.mode) failures.push(`Wrong mode for ${expected.email}: ${p.current_mode}`);
        if (p.account_status !== 'active') failures.push(`Inactive profile: ${expected.email}`);
      }
    }

    const professionalIds = EXPECTED.filter((x) => x.mode === 'professional')
      .map((x) => ids[x.email])
      .filter(Boolean);

    if (professionalIds.length) {
      const { data: pros, error: proError } = await admin
        .from('professional_profiles')
        .select('user_id,headline,verification_status,is_available')
        .in('user_id', professionalIds);
      if (proError) throw proError;

      for (const id of professionalIds) {
        const pro = pros?.find((row) => row.user_id === id);
        if (!pro) failures.push(`Missing professional profile: ${id}`);
        else {
          if (pro.verification_status !== 'verified') failures.push(`Professional is not verified: ${id}`);
          if (!pro.is_available) failures.push(`Professional is not available: ${id}`);
        }
      }

      const { data: areas, error: areaError } = await admin
        .from('service_areas')
        .select('professional_id,city,radius_km')
        .in('professional_id', professionalIds);
      if (areaError) throw areaError;

      for (const id of professionalIds) {
        const area = areas?.find((row) => row.professional_id === id);
        if (!area) failures.push(`Missing service area: ${id}`);
        else if (area.city !== 'Varanasi') failures.push(`Unexpected service city for ${id}: ${area.city}`);
      }

      const { data: services, error: serviceError } = await admin
        .from('professional_sub_services')
        .select('professional_id,sub_service_id')
        .in('professional_id', professionalIds);
      if (serviceError) throw serviceError;

      for (const id of professionalIds) {
        if (!services?.some((row) => row.professional_id === id)) {
          failures.push(`Missing catalogue service: ${id}`);
        }
      }
    }

    const customerIds = EXPECTED.filter((x) => x.mode === 'customer')
      .map((x) => ids[x.email])
      .filter(Boolean);

    if (customerIds.length) {
      const { data: wallets, error: walletError } = await admin
        .from('connection_wallets')
        .select('user_id,balance')
        .in('user_id', customerIds);
      if (walletError) throw walletError;

      for (const id of customerIds) {
        const wallet = wallets?.find((row) => row.user_id === id);
        if (!wallet) failures.push(`Missing connection wallet: ${id}`);
        else if (Number(wallet.balance) < 1) failures.push(`Customer has no QA connection credit: ${id}`);
      }
    }
  }

  const result = {
    ok: failures.length === 0,
    checked_accounts: EXPECTED.length,
    failures,
    note: 'This checks QA seed readiness only; it does not execute a customer/professional job flow.',
  };

  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
