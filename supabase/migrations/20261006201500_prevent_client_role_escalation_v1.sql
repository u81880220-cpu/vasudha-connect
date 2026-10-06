drop policy if exists "roles_insert_self" on public.user_roles;
-- Roles are provisioned by trusted server-side flows only. Clients must never self-assign roles.
