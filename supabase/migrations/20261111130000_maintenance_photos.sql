-- Snow Goose App 1.5.2: MAF photos (private storage bucket)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-photos', 'maintenance-photos', false, 15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do nothing;

create table if not exists public.maintenance_photos (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.maintenance_actions(id) on delete cascade,
  storage_path text not null unique,
  kind text not null default 'before' check (kind in ('before','after')),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  uploaded_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists maintenance_photos_action_idx on public.maintenance_photos (action_id, created_at);

create or replace function public.maintenance_photos_before_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.uploaded_by := auth.uid();
  new.uploaded_by_name := public.user_display_name(auth.uid());
  return new;
end;
$$;
revoke execute on function public.maintenance_photos_before_insert() from public, anon, authenticated;

drop trigger if exists maintenance_photos_before_insert on public.maintenance_photos;
create trigger maintenance_photos_before_insert
  before insert on public.maintenance_photos
  for each row execute function public.maintenance_photos_before_insert();

alter table public.maintenance_photos enable row level security;

create policy "maintenance_photos_select_authenticated" on public.maintenance_photos
  for select to authenticated using (true);
create policy "maintenance_photos_insert_authenticated" on public.maintenance_photos
  for insert to authenticated with check (true);
create policy "maintenance_photos_delete_own_or_manager" on public.maintenance_photos
  for delete to authenticated using (uploaded_by = auth.uid() or public.can_close_maf());

revoke all on public.maintenance_photos from anon;

-- Storage: signed-in users can view and upload MAF photos; uploader or a manager can delete
create policy "maintenance_photos_storage_select" on storage.objects
  for select to authenticated using (bucket_id = 'maintenance-photos');
create policy "maintenance_photos_storage_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'maintenance-photos');
create policy "maintenance_photos_storage_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'maintenance-photos' and (owner_id = auth.uid()::text or public.can_close_maf())
  );
