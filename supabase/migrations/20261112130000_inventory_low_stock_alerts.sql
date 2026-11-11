-- Snow Goose App 1.6.1: daily low-stock email to Nick and Rhiannon

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Who gets the low-stock email
alter table public.staff_roles add column if not exists low_stock_alerts boolean not null default false;
update public.staff_roles set low_stock_alerts = true where lower(email) in ('nickrajotte@gmail.com', 'rs@snowgooseinn.com');

-- One row per low-stock email that went out (used to avoid repeating an unchanged list every day)
create table if not exists public.inventory_alert_log (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  item_ids uuid[] not null,
  recipients text[] not null,
  email_id text,
  trigger text not null check (trigger in ('schedule','manual'))
);
alter table public.inventory_alert_log enable row level security;
create policy "inventory_alert_log_select_authenticated" on public.inventory_alert_log
  for select to authenticated using (true);
revoke all on public.inventory_alert_log from anon;
revoke insert, update, delete on public.inventory_alert_log from authenticated;

-- Shared secret the daily job sends so only the schedule (or a signed-in manager) can trigger the email
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'low_stock_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'low_stock_cron_secret', 'Auth for the daily notify-low-stock job');
  end if;
end $$;

create or replace function public.low_stock_cron_secret()
returns text
language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'low_stock_cron_secret' limit 1;
$$;
revoke execute on function public.low_stock_cron_secret() from public, anon, authenticated;
grant execute on function public.low_stock_cron_secret() to service_role;

-- Every day at 13:00 UTC (8 AM Eastern in winter, 9 AM in summer)
select cron.unschedule('inventory-low-stock-daily')
where exists (select 1 from cron.job where jobname = 'inventory-low-stock-daily');

select cron.schedule(
  'inventory-low-stock-daily',
  '0 13 * * *',
  $job$
  select net.http_post(
    url := 'https://anrjlcqemdquiexmteam.supabase.co/functions/v1/notify-low-stock',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'low_stock_cron_secret')
    ),
    body := '{"trigger":"schedule"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
