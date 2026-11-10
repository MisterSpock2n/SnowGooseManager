-- Snow Goose App 1.5.0-a: Maintenance Action Forms (MAF)
-- Tables: staff_roles, maintenance_locations, maintenance_assignees,
--         maintenance_actions, maintenance_action_events

-- Managers who can close/verify MAFs. Keyed by login email so Jon's row
-- works as soon as his Supabase login is created.
create table if not exists public.staff_roles (
  email text primary key,
  display_name text not null,
  role text not null check (role in ('owner','general_manager','operations_manager','staff')),
  can_close_maf boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.staff_roles (email, display_name, role, can_close_maf) values
  ('info@snowgooseinn.com', 'Jon', 'owner', true),
  ('rs@snowgooseinn.com', 'Rhiannon', 'general_manager', true),
  ('nickrajotte@gmail.com', 'Nick', 'operations_manager', true)
on conflict (email) do nothing;

create or replace function public.is_maf_closer(uid uuid)
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce((
    select sr.can_close_maf
    from auth.users u join public.staff_roles sr on lower(sr.email) = lower(u.email)
    where u.id = uid
  ), false);
$$;

create or replace function public.can_close_maf()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_maf_closer(auth.uid());
$$;

create table if not exists public.maintenance_locations (
  id serial primary key,
  name text unique not null,
  kind text not null check (kind in ('guest_room','common','back_of_house','other')),
  sort_order int not null,
  active boolean not null default true
);

insert into public.maintenance_locations (name, kind, sort_order) values
  ('Room 1','guest_room',1),('Room 2','guest_room',2),('Room 3','guest_room',3),
  ('Room 4','guest_room',4),('Room 5','guest_room',5),('Room 6','guest_room',6),
  ('Room 7','guest_room',7),('Room 8','guest_room',8),('Room 9','guest_room',9),
  ('Room 10','guest_room',10),('Room 11','guest_room',11),('Room 12','guest_room',12),
  ('Room 14','guest_room',14),
  ('Office','back_of_house',20),('Laundry Room','back_of_house',21),('Kitchen','back_of_house',22),
  ('Breakfast Room','common',30),('Cocktail Room','common',31),
  ('Main Floor North Hallway','common',32),('Main Floor South Hallway','common',33),
  ('2nd Floor North Hallway','common',34),('2nd Floor South Hallway','common',35),
  ('Common Area Bathroom','common',36),('Other','other',99)
on conflict (name) do nothing;

create table if not exists public.maintenance_assignees (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('staff','plumber','electrician','handyman','other')),
  role_label text,
  company text,
  phone text,
  email text,
  sort_order int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.maintenance_assignees (name, kind, role_label, company, phone, sort_order) values
  ('Jon', 'staff', 'Owner', null, null, 1),
  ('Rhiannon', 'staff', 'General Manager', null, null, 2),
  ('Nick', 'staff', 'Operations / Technical Manager', null, null, 3),
  ('Al Jeffers & Sons', 'plumber', 'Plumbing', 'Al Jeffers & Sons', '802-365-4447', 10),
  ('Danda Electric', 'electrician', 'Electrical', 'Danda Electric', '802-681-5757', 11),
  ('Gered Andrews', 'handyman', 'Handyman', null, '857-228-8487', 12)
on conflict (name) do nothing;

create sequence if not exists public.maf_number_seq;

create table if not exists public.maintenance_actions (
  id uuid primary key default gen_random_uuid(),
  maf_number text unique not null
    default ('MAF-' || to_char(now() at time zone 'America/New_York', 'YYYY') || '-' || lpad(nextval('public.maf_number_seq')::text, 4, '0')),
  location_id int not null references public.maintenance_locations(id),
  location_detail text,
  description text not null check (length(trim(description)) > 0),
  priority smallint not null check (priority between 1 and 5),
  status text not null default 'open'
    check (status in ('open','in_progress','awaiting_parts','awaiting_vendor','awaiting_verification','completed','cancelled')),
  room_out_of_service boolean not null default false,
  assigned_to uuid not null references public.maintenance_assignees(id),
  initiated_by uuid not null default auth.uid() references auth.users(id),
  initiated_by_name text not null,
  discovered_at timestamptz not null default now(),
  completion_notes text,
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  cost numeric(10,2),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('english', coalesce(maf_number,'') || ' ' || coalesce(description,'') || ' ' || coalesce(completion_notes,'') || ' ' || coalesce(location_detail,''))
  ) stored
);

create index if not exists maintenance_actions_search_idx on public.maintenance_actions using gin (search);
create index if not exists maintenance_actions_status_idx on public.maintenance_actions (status, priority, discovered_at);

create table if not exists public.maintenance_action_events (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.maintenance_actions(id) on delete cascade,
  event text not null check (event in ('created','status_changed','reassigned','priority_changed','completed','reopened','verified')),
  from_value text,
  to_value text,
  by_user uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

-- Enforce closing / verification rules and keep timestamps current
create or replace function public.maintenance_actions_before_write()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  assignee_kind text;
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    -- Stamp the creator's name from their login (not editable by the client)
    new.initiated_by := coalesce(auth.uid(), new.initiated_by);
    select coalesce(sr.display_name, u.email) into new.initiated_by_name
    from auth.users u left join public.staff_roles sr on lower(sr.email) = lower(u.email)
    where u.id = new.initiated_by;
    new.status := 'open';
    new.completed_by := null; new.completed_at := null;
    new.verified_by := null; new.verified_at := null;
  end if;

  if tg_op = 'UPDATE' then
    new.maf_number := old.maf_number;
    new.initiated_by := old.initiated_by;
    new.initiated_by_name := old.initiated_by_name;
    if new.status in ('completed','cancelled') and old.status not in ('completed','cancelled') then
      if not public.can_close_maf() then
        raise exception 'Only Nick, Rhiannon, or Jon can close a MAF';
      end if;
      if new.status = 'completed' then
        select kind into assignee_kind from public.maintenance_assignees where id = new.assigned_to;
        if assignee_kind <> 'staff' then
          if new.verified_by is null or not public.is_maf_closer(new.verified_by) then
            raise exception 'Outside-vendor work must be verified by Nick, Rhiannon, or Jon before closing';
          end if;
          new.verified_at := coalesce(new.verified_at, now());
        end if;
        new.completed_by := coalesce(new.completed_by, auth.uid());
        new.completed_at := coalesce(new.completed_at, now());
      end if;
    elsif old.status in ('completed','cancelled') and new.status not in ('completed','cancelled') then
      -- reopened
      if not public.can_close_maf() then
        raise exception 'Only Nick, Rhiannon, or Jon can reopen a MAF';
      end if;
      new.completed_by := null;
      new.completed_at := null;
      new.verified_by := null;
      new.verified_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists maintenance_actions_before_write on public.maintenance_actions;
create trigger maintenance_actions_before_write
  before insert or update on public.maintenance_actions
  for each row execute function public.maintenance_actions_before_write();

-- Audit trail (like a MAF's signature blocks)
create or replace function public.maintenance_actions_log_events()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.maintenance_action_events (action_id, event, to_value, by_user)
    values (new.id, 'created', new.status, new.initiated_by);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.maintenance_action_events (action_id, event, from_value, to_value)
    values (
      new.id,
      case
        when new.status = 'completed' then 'completed'
        when old.status in ('completed','cancelled') then 'reopened'
        else 'status_changed'
      end,
      old.status, new.status
    );
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.maintenance_action_events (action_id, event, from_value, to_value)
    values (new.id, 'reassigned', old.assigned_to::text, new.assigned_to::text);
  end if;
  if new.priority is distinct from old.priority then
    insert into public.maintenance_action_events (action_id, event, from_value, to_value)
    values (new.id, 'priority_changed', old.priority::text, new.priority::text);
  end if;
  if new.verified_by is distinct from old.verified_by and new.verified_by is not null then
    insert into public.maintenance_action_events (action_id, event, to_value)
    values (new.id, 'verified', new.verified_by::text);
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_actions_log_events on public.maintenance_actions;
create trigger maintenance_actions_log_events
  after insert or update on public.maintenance_actions
  for each row execute function public.maintenance_actions_log_events();

-- Row level security (signed-in users only; no anonymous access)
alter table public.staff_roles enable row level security;
alter table public.maintenance_locations enable row level security;
alter table public.maintenance_assignees enable row level security;
alter table public.maintenance_actions enable row level security;
alter table public.maintenance_action_events enable row level security;

create policy "staff_roles_select_authenticated" on public.staff_roles
  for select to authenticated using (true);

create policy "maintenance_locations_select_authenticated" on public.maintenance_locations
  for select to authenticated using (true);
create policy "maintenance_locations_write_closers" on public.maintenance_locations
  for all to authenticated using (public.can_close_maf()) with check (public.can_close_maf());

create policy "maintenance_assignees_select_authenticated" on public.maintenance_assignees
  for select to authenticated using (true);
create policy "maintenance_assignees_write_closers" on public.maintenance_assignees
  for all to authenticated using (public.can_close_maf()) with check (public.can_close_maf());

create policy "maintenance_actions_select_authenticated" on public.maintenance_actions
  for select to authenticated using (true);
create policy "maintenance_actions_insert_own" on public.maintenance_actions
  for insert to authenticated with check (initiated_by = auth.uid());
create policy "maintenance_actions_update_authenticated" on public.maintenance_actions
  for update to authenticated using (true) with check (true);

create policy "maintenance_action_events_select_authenticated" on public.maintenance_action_events
  for select to authenticated using (true);

revoke all on public.staff_roles, public.maintenance_locations, public.maintenance_assignees,
  public.maintenance_actions, public.maintenance_action_events from anon;
grant usage, select on sequence public.maf_number_seq to authenticated;
grant usage, select on sequence public.maintenance_locations_id_seq to authenticated;
