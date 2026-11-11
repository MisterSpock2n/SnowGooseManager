-- Snow Goose App 1.5.3: Invoices for Jon (owner invoices + private file storage)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'owner-invoices', 'owner-invoices', false, 20971520,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
on conflict (id) do nothing;

create table if not exists public.owner_invoices (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid references public.maintenance_assignees(id),
  vendor_name text not null check (length(btrim(vendor_name)) > 0),
  vendor_phone text not null check (length(btrim(vendor_phone)) > 0),
  invoice_number text,
  invoice_date date not null,
  due_date date,
  amount numeric(10,2) not null check (amount >= 0),
  related_action_id uuid references public.maintenance_actions(id) on delete set null,
  notes text,
  status text not null default 'new' check (status in ('new','seen','paid','disputed')),
  logged_by uuid not null default auth.uid() references auth.users(id),
  logged_by_name text,
  seen_at timestamptz,
  seen_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  paid_note text,
  status_changed_at timestamptz,
  status_changed_by_name text,
  notified_at timestamptz,
  notify_status text not null default 'pending' check (notify_status in ('pending','sent','failed')),
  notify_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists owner_invoices_status_idx on public.owner_invoices (status, invoice_date desc);
create index if not exists owner_invoices_action_idx on public.owner_invoices (related_action_id);

create table if not exists public.owner_invoice_files (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.owner_invoices(id) on delete cascade,
  storage_path text not null unique,
  content_type text,
  file_name text,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  uploaded_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists owner_invoice_files_invoice_idx on public.owner_invoice_files (invoice_id, created_at);

-- Stamp who logged the invoice; new invoices always start as New / alert pending
create or replace function public.owner_invoices_before_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.logged_by := auth.uid();
  new.logged_by_name := public.user_display_name(auth.uid());
  new.status := 'new';
  new.seen_at := null; new.seen_by_name := null;
  new.paid_at := null; new.paid_by_name := null;
  new.status_changed_at := null; new.status_changed_by_name := null;
  new.notified_at := null; new.notify_status := 'pending'; new.notify_error := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

-- Status changes are limited to Nick, Rhiannon and Jon and are stamped with who/when.
-- Alert-delivery fields can only be changed by the server (service role, no auth.uid()).
create or replace function public.owner_invoices_before_update()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text := public.user_display_name(auth.uid());
begin
  new.logged_by := old.logged_by;
  new.logged_by_name := old.logged_by_name;
  new.created_at := old.created_at;
  new.updated_at := now();

  if auth.uid() is not null then
    new.notified_at := old.notified_at;
    new.notify_status := old.notify_status;
    new.notify_error := old.notify_error;
    new.seen_at := old.seen_at; new.seen_by_name := old.seen_by_name;
    new.paid_at := old.paid_at; new.paid_by_name := old.paid_by_name;
    new.status_changed_at := old.status_changed_at; new.status_changed_by_name := old.status_changed_by_name;
  end if;

  if new.status is distinct from old.status then
    if auth.uid() is not null and not public.can_close_maf() then
      raise exception 'Only Nick, Rhiannon or Jon can change an invoice status';
    end if;
    new.status_changed_at := now();
    new.status_changed_by_name := who;
    if new.status in ('seen','paid','disputed') and new.seen_at is null then
      new.seen_at := now();
      new.seen_by_name := who;
    end if;
    if new.status = 'paid' then
      new.paid_at := now();
      new.paid_by_name := who;
    elsif old.status = 'paid' then
      new.paid_at := null;
      new.paid_by_name := null;
      new.paid_note := null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.owner_invoice_files_before_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.uploaded_by := auth.uid();
  new.uploaded_by_name := public.user_display_name(auth.uid());
  new.created_at := now();
  return new;
end;
$$;

revoke execute on function public.owner_invoices_before_insert() from public, anon, authenticated;
revoke execute on function public.owner_invoices_before_update() from public, anon, authenticated;
revoke execute on function public.owner_invoice_files_before_insert() from public, anon, authenticated;

drop trigger if exists owner_invoices_before_insert on public.owner_invoices;
create trigger owner_invoices_before_insert
  before insert on public.owner_invoices
  for each row execute function public.owner_invoices_before_insert();

drop trigger if exists owner_invoices_before_update on public.owner_invoices;
create trigger owner_invoices_before_update
  before update on public.owner_invoices
  for each row execute function public.owner_invoices_before_update();

drop trigger if exists owner_invoice_files_before_insert on public.owner_invoice_files;
create trigger owner_invoice_files_before_insert
  before insert on public.owner_invoice_files
  for each row execute function public.owner_invoice_files_before_insert();

alter table public.owner_invoices enable row level security;
alter table public.owner_invoice_files enable row level security;

create policy "owner_invoices_select_authenticated" on public.owner_invoices
  for select to authenticated using (true);
create policy "owner_invoices_insert_authenticated" on public.owner_invoices
  for insert to authenticated with check (true);
create policy "owner_invoices_update_logger_or_manager" on public.owner_invoices
  for update to authenticated
  using (logged_by = auth.uid() or public.can_close_maf())
  with check (logged_by = auth.uid() or public.can_close_maf());
create policy "owner_invoices_delete_manager" on public.owner_invoices
  for delete to authenticated using (public.can_close_maf());

create policy "owner_invoice_files_select_authenticated" on public.owner_invoice_files
  for select to authenticated using (true);
create policy "owner_invoice_files_insert_authenticated" on public.owner_invoice_files
  for insert to authenticated with check (true);
create policy "owner_invoice_files_delete_own_or_manager" on public.owner_invoice_files
  for delete to authenticated using (uploaded_by = auth.uid() or public.can_close_maf());

revoke all on public.owner_invoices from anon;
revoke all on public.owner_invoice_files from anon;

-- Storage: signed-in users can view and upload invoice files; uploader or a manager can delete
create policy "owner_invoices_storage_select" on storage.objects
  for select to authenticated using (bucket_id = 'owner-invoices');
create policy "owner_invoices_storage_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'owner-invoices');
create policy "owner_invoices_storage_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'owner-invoices' and (owner_id = auth.uid()::text or public.can_close_maf())
  );
