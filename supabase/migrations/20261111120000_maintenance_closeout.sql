-- Snow Goose App 1.5.1: MAF close-out, verification sign-off, and named history

alter table public.maintenance_actions
  add column if not exists completed_by_name text,
  add column if not exists verified_by_name text;

alter table public.maintenance_action_events
  add column if not exists by_name text;

create or replace function public.user_display_name(uid uuid)
returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce(sr.display_name, u.email)
  from auth.users u left join public.staff_roles sr on lower(sr.email) = lower(u.email)
  where u.id = uid;
$$;
revoke execute on function public.user_display_name(uuid) from public, anon, authenticated;

create or replace function public.maintenance_actions_before_write()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  assignee_kind text;
  was_closed boolean;
  is_closed boolean;
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.initiated_by := coalesce(auth.uid(), new.initiated_by);
    new.initiated_by_name := public.user_display_name(new.initiated_by);
    new.status := 'open';
    new.completed_by := null; new.completed_at := null; new.completed_by_name := null;
    new.verified_by := null; new.verified_at := null; new.verified_by_name := null;
    return new;
  end if;

  -- UPDATE: identity fields can never change
  new.maf_number := old.maf_number;
  new.initiated_by := old.initiated_by;
  new.initiated_by_name := old.initiated_by_name;

  was_closed := old.status in ('completed','cancelled');
  is_closed := new.status in ('completed','cancelled');

  -- A verified-by sign-off can only be given by a manager, as themselves
  if new.verified_by is distinct from old.verified_by and new.verified_by is not null then
    if new.verified_by <> auth.uid() or not public.can_close_maf() then
      raise exception 'Only Nick, Rhiannon, or Jon can sign off verification, and only as themselves';
    end if;
    new.verified_at := now();
    new.verified_by_name := public.user_display_name(new.verified_by);
  elsif new.verified_by is null then
    new.verified_at := null;
    new.verified_by_name := null;
  end if;

  if is_closed and not was_closed then
    if not public.can_close_maf() then
      raise exception 'Only Nick, Rhiannon, or Jon can close a MAF';
    end if;
    if new.status = 'completed' then
      select kind into assignee_kind from public.maintenance_assignees where id = new.assigned_to;
      if assignee_kind <> 'staff' and new.verified_by is null then
        raise exception 'Outside-vendor work must be verified by Nick, Rhiannon, or Jon before closing';
      end if;
    end if;
    new.completed_by := auth.uid();
    new.completed_at := coalesce(new.completed_at, now());
    new.completed_by_name := public.user_display_name(auth.uid());
  elsif was_closed and not is_closed then
    if not public.can_close_maf() then
      raise exception 'Only Nick, Rhiannon, or Jon can reopen a MAF';
    end if;
    new.completed_by := null; new.completed_at := null; new.completed_by_name := null;
    new.verified_by := null; new.verified_at := null; new.verified_by_name := null;
  elsif was_closed and is_closed then
    -- Editing a closed MAF (e.g. adding notes later) is limited to managers
    if not public.can_close_maf() then
      raise exception 'Only Nick, Rhiannon, or Jon can edit a closed MAF';
    end if;
    new.completed_by := old.completed_by;
    new.completed_by_name := old.completed_by_name;
  else
    -- still open: completion stamps stay empty
    new.completed_by := null; new.completed_at := null; new.completed_by_name := null;
  end if;

  return new;
end;
$$;

create or replace function public.maintenance_actions_log_events()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(auth.uid(), new.initiated_by);
  actor_name text := public.user_display_name(coalesce(auth.uid(), new.initiated_by));
begin
  if tg_op = 'INSERT' then
    insert into public.maintenance_action_events (action_id, event, to_value, by_user, by_name)
    values (new.id, 'created', new.status, new.initiated_by, new.initiated_by_name);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.maintenance_action_events (action_id, event, from_value, to_value, by_user, by_name)
    values (
      new.id,
      case
        when new.status = 'completed' then 'completed'
        when old.status in ('completed','cancelled') then 'reopened'
        else 'status_changed'
      end,
      old.status, new.status, actor, actor_name
    );
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.maintenance_action_events (action_id, event, from_value, to_value, by_user, by_name)
    values (new.id, 'reassigned',
      (select name from public.maintenance_assignees where id = old.assigned_to),
      (select name from public.maintenance_assignees where id = new.assigned_to),
      actor, actor_name);
  end if;
  if new.priority is distinct from old.priority then
    insert into public.maintenance_action_events (action_id, event, from_value, to_value, by_user, by_name)
    values (new.id, 'priority_changed', 'P' || old.priority, 'P' || new.priority, actor, actor_name);
  end if;
  if new.verified_by is distinct from old.verified_by and new.verified_by is not null then
    insert into public.maintenance_action_events (action_id, event, to_value, by_user, by_name)
    values (new.id, 'verified', new.verified_by_name, actor, actor_name);
  end if;
  return new;
end;
$$;

revoke execute on function public.maintenance_actions_before_write() from public, anon, authenticated;
revoke execute on function public.maintenance_actions_log_events() from public, anon, authenticated;

-- Backfill names on existing history
update public.maintenance_action_events e
set by_name = public.user_display_name(e.by_user)
where e.by_name is null and e.by_user is not null;

update public.maintenance_action_events e
set from_value = (select name from public.maintenance_assignees where id::text = e.from_value),
    to_value = (select name from public.maintenance_assignees where id::text = e.to_value)
where e.event = 'reassigned' and e.to_value ~ '^[0-9a-f-]{36}$';

update public.maintenance_action_events
set from_value = 'P' || from_value, to_value = 'P' || to_value
where event = 'priority_changed' and to_value ~ '^[1-5]$';
