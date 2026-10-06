import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Set EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY). Never put the secret key in app code.'
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = process.env.DEMO_PASSWORD || 'Demo@12345';

const demoUsers = [
  {
    email: 'demo.customer1@vasudha.test',
    full_name: 'Demo Customer One',
    phone: '+919000000001',
    mode: 'customer',
  },
  {
    email: 'demo.customer2@vasudha.test',
    full_name: 'Demo Customer Two',
    phone: '+919000000002',
    mode: 'customer',
  },
  {
    email: 'demo.pro1@vasudha.test',
    full_name: 'Demo AC Professional',
    phone: '+919000000003',
    mode: 'professional',
    headline: 'AC Repair & Service Professional',
    about: 'Demo AC professional for VASUDHA end-to-end testing.',
    years: 8,
  },
  {
    email: 'demo.pro2@vasudha.test',
    full_name: 'Demo Carpenter Professional',
    phone: '+919000000004',
    mode: 'professional',
    headline: 'Carpenter & Furniture Repair Professional',
    about: 'Demo carpenter for VASUDHA end-to-end testing.',
    years: 10,
  },
  {
    email: 'demo.admin@vasudha.test',
    full_name: 'Demo Vasudha Admin',
    phone: '+919000000005',
    mode: 'customer',
  },
];

async function getOrCreateUser(spec) {
  const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;

  const found = existing.users.find((u) => u.email?.toLowerCase() === spec.email.toLowerCase());
  if (found) {
    await admin.auth.admin.updateUserById(found.id, {
      email_confirm: true,
      password: PASSWORD,
      user_metadata: {
        full_name: spec.full_name,
        display_name: spec.full_name,
        initial_mode: spec.mode,
      },
    });
    return found.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: spec.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: spec.full_name,
      display_name: spec.full_name,
      initial_mode: spec.mode,
    },
  });

  if (error) throw error;
  return data.user.id;
}

async function main() {
  const ids = {};
  for (const spec of demoUsers) {
    ids[spec.email] = await getOrCreateUser(spec);
  }

  const customerIds = demoUsers.filter((x) => x.mode === 'customer').map((x) => ids[x.email]);
  const professionalSpecs = demoUsers.filter((x) => x.mode === 'professional');

  await admin.from('profiles').upsert(
    demoUsers.map((x) => ({
      id: ids[x.email],
      full_name: x.full_name,
      display_name: x.full_name,
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      country: 'India',
      current_mode: x.mode,
      account_status: 'active',
    })),
    { onConflict: 'id' }
  );

  await admin.from('user_contact_details').upsert(
    demoUsers.map((x) => ({ user_id: ids[x.email], phone: x.phone })),
    { onConflict: 'user_id' }
  );

  await admin.from('admin_users').upsert(
    [{ user_id: ids['demo.admin@vasudha.test'] }],
    { onConflict: 'user_id' }
  );

  for (const spec of professionalSpecs) {
    const id = ids[spec.email];

    const { error: profileError } = await admin.from('professional_profiles').upsert(
      {
        user_id: id,
        headline: spec.headline,
        about: spec.about,
        years_experience: spec.years,
        verification_status: 'verified',
        is_available: true,
        service_radius_km: 25,
        base_latitude: 25.3176,
        base_longitude: 82.9739,
      },
      { onConflict: 'user_id' }
    );
    if (profileError) throw profileError;

    const { error: areaError } = await admin.from('service_areas').upsert(
      {
        professional_id: id,
        label: 'Varanasi',
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        latitude: 25.3176,
        longitude: 82.9739,
        radius_km: 25,
        is_primary: true,
      },
      { onConflict: 'professional_id,label' }
    );
    if (areaError && !String(areaError.message).includes('duplicate')) throw areaError;
  }

  const { data: acSkill, error: acError } = await admin.from('skills').select('id,name').ilike('name', 'AC Technician').maybeSingle();
  if (acError || !acSkill) throw acError || new Error('AC Technician legacy skill not found');

  const { data: carpenterSkill, error: carpenterError } = await admin.from('skills').select('id,name').ilike('name', 'Carpenter').maybeSingle();
  if (carpenterError || !carpenterSkill) throw carpenterError || new Error('Carpenter legacy skill not found');

  await admin.from('professional_skills').upsert(
    [
      { professional_id: ids['demo.pro1@vasudha.test'], skill_id: acSkill.id, years_experience: 8, is_primary: true },
      { professional_id: ids['demo.pro2@vasudha.test'], skill_id: carpenterSkill.id, years_experience: 10, is_primary: true },
    ],
    { onConflict: 'professional_id,skill_id' }
  );

  const { data: acService } = await admin.from('service_catalogue_services').select('id,name').ilike('name', 'AC Technician').maybeSingle();
  const { data: carpenterService } = await admin.from('service_catalogue_services').select('id,name').ilike('name', 'Carpenter').maybeSingle();

  if (!acService || !carpenterService) throw new Error('Required catalogue services not found');

  const { data: acSub } = await admin
    .from('service_catalogue_sub_services')
    .select('id,name')
    .eq('service_id', acService.id)
    .eq('status', 'active')
    .ilike('name', 'General / Any')
    .maybeSingle();

  const { data: carpenterSub } = await admin
    .from('service_catalogue_sub_services')
    .select('id,name')
    .eq('service_id', carpenterService.id)
    .eq('status', 'active')
    .ilike('name', 'General / Any')
    .maybeSingle();

  if (!acSub || !carpenterSub) throw new Error('General / Any sub-service missing');

  await admin.from('professional_sub_services').upsert(
    [
      { professional_id: ids['demo.pro1@vasudha.test'], sub_service_id: acSub.id, years_experience: 8, is_primary: true },
      { professional_id: ids['demo.pro2@vasudha.test'], sub_service_id: carpenterSub.id, years_experience: 10, is_primary: true },
    ],
    { onConflict: 'professional_id,sub_service_id' }
  );

  await admin.from('connection_wallets').upsert(
    customerIds.map((user_id) => ({ user_id, balance: 10 })),
    { onConflict: 'user_id' }
  );

  console.log(JSON.stringify({
    ok: true,
    password: PASSWORD,
    accounts: demoUsers.map((x) => ({
      email: x.email,
      mode: x.mode,
      user_id: ids[x.email],
    })),
    location: { city: 'Varanasi', state: 'Uttar Pradesh', latitude: 25.3176, longitude: 82.9739 },
    note: 'Demo accounts are for QA only. Do not use the demo password or test identities in production.',
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
