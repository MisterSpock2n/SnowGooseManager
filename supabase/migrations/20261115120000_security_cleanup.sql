-- 1.8.1 Security cleanup
-- Remove the anonymous (not signed-in) policies left over from early setup on the
-- legacy time_entries, users, and properties tables, plus duplicate signed-in
-- policies that grant the same access twice. Signed-in staff keep the same access.

-- Anonymous policies
drop policy if exists "time_entries_select_anon" on public.time_entries;
drop policy if exists "time_entries_insert_anon" on public.time_entries;
drop policy if exists "time_entries_update_anon" on public.time_entries;
drop policy if exists "properties_select_anon" on public.properties;
drop policy if exists "properties_select_anon" on public.users;

-- Duplicate signed-in policies (an identical policy with a descriptive name remains)
drop policy if exists "time_entries_select_authenticated" on public.time_entries;
drop policy if exists "time_entries_insert_authenticated" on public.time_entries;
drop policy if exists "time_entries_update_authenticated" on public.time_entries;
drop policy if exists "properties_select_authenticated" on public.properties;
drop policy if exists "users_select_authenticated" on public.users;
