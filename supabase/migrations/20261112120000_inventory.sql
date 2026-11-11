-- Snow Goose App 1.6.0: Inventory items, stock movements, low-stock flags

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  category text not null check (category in ('maintenance','guest_room','breakfast_food','cleaning')),
  unit text not null default 'each' check (length(btrim(unit)) > 0),
  quantity_on_hand numeric(10,2) not null default 0,
  reorder_level numeric(10,2) not null default 0 check (reorder_level >= 0),
  reorder_quantity numeric(10,2) check (reorder_quantity is null or reorder_quantity > 0),
  storage_location text,
  vendor text,
  reorder_url text,
  notes text,
  active boolean not null default true,
  last_counted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists inventory_items_name_category_key on public.inventory_items (category, lower(btrim(name)));
create index if not exists inventory_items_active_idx on public.inventory_items (active, category, name);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  kind text not null check (kind in ('received','used','count')),
  quantity numeric(10,2) not null check (quantity >= 0),  -- amount received/used, or the counted total
  quantity_delta numeric(10,2),
  quantity_after numeric(10,2),
  note text,
  related_action_id uuid references public.maintenance_actions(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id),
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists inventory_transactions_item_idx on public.inventory_transactions (item_id, created_at desc);

-- Stock is only changed through transactions. The trigger locks the item, computes the change,
-- and updates quantity_on_hand so two people logging at once can't clobber each other.
create or replace function public.inventory_transactions_before_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  current_qty numeric(10,2);
  is_active boolean;
  new_qty numeric(10,2);
begin
  select quantity_on_hand, active into current_qty, is_active
  from public.inventory_items where id = new.item_id for update;
  if not found then
    raise exception 'Inventory item not found';
  end if;
  if not is_active then
    raise exception 'This item is archived. Restore it before logging stock.';
  end if;

  if new.kind = 'received' then
    if new.quantity <= 0 then raise exception 'Received amount must be more than zero'; end if;
    new_qty := current_qty + new.quantity;
  elsif new.kind = 'used' then
    if new.quantity <= 0 then raise exception 'Used amount must be more than zero'; end if;
    new_qty := current_qty - new.quantity;
    if new_qty < 0 then
      raise exception 'Only % on hand. Use Count to correct the total first.', current_qty;
    end if;
  else
    new_qty := new.quantity;
  end if;

  new.quantity_delta := new_qty - current_qty;
  new.quantity_after := new_qty;
  new.created_by := auth.uid();
  new.created_by_name := public.user_display_name(auth.uid());
  new.created_at := now();

  perform set_config('app.inventory_txn', '1', true);
  update public.inventory_items
    set quantity_on_hand = new_qty,
        last_counted_at = case when new.kind = 'count' then now() else last_counted_at end
    where id = new.item_id;
  perform set_config('app.inventory_txn', '0', true);
  return new;
end;
$$;

create or replace function public.inventory_items_before_write()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Starting stock is recorded as a Count transaction, not set directly
    new.quantity_on_hand := 0;
    new.last_counted_at := null;
    new.created_by := auth.uid();
    new.created_at := now();
  else
    if coalesce(current_setting('app.inventory_txn', true), '0') <> '1' then
      new.quantity_on_hand := old.quantity_on_hand;
      new.last_counted_at := old.last_counted_at;
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.name := btrim(new.name);
  new.unit := btrim(new.unit);
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.inventory_transactions_before_insert() from public, anon, authenticated;
revoke execute on function public.inventory_items_before_write() from public, anon, authenticated;

drop trigger if exists inventory_items_before_write on public.inventory_items;
create trigger inventory_items_before_write
  before insert or update on public.inventory_items
  for each row execute function public.inventory_items_before_write();

drop trigger if exists inventory_transactions_before_insert on public.inventory_transactions;
create trigger inventory_transactions_before_insert
  before insert on public.inventory_transactions
  for each row execute function public.inventory_transactions_before_insert();

alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;

create policy "inventory_items_select_authenticated" on public.inventory_items
  for select to authenticated using (true);
create policy "inventory_items_insert_authenticated" on public.inventory_items
  for insert to authenticated with check (true);
create policy "inventory_items_update_authenticated" on public.inventory_items
  for update to authenticated using (true) with check (true);
create policy "inventory_items_delete_manager" on public.inventory_items
  for delete to authenticated using (public.can_close_maf());

-- Stock history is append-only; corrections are made with a new Count
create policy "inventory_transactions_select_authenticated" on public.inventory_transactions
  for select to authenticated using (true);
create policy "inventory_transactions_insert_authenticated" on public.inventory_transactions
  for insert to authenticated with check (true);

revoke all on public.inventory_items from anon;
revoke all on public.inventory_transactions from anon;
revoke update, delete on public.inventory_transactions from authenticated;

-- Starting list of common inn items (quantities start at 0 and show "Needs first count")
insert into public.inventory_items (name, category, unit, reorder_level, storage_location) values
  -- Maintenance supplies
  ('Furnace / HVAC filters', 'maintenance', 'each', 4, null),
  ('LED bulbs (A19 standard)', 'maintenance', 'each', 12, null),
  ('LED bulbs (candelabra)', 'maintenance', 'each', 6, null),
  ('AA batteries', 'maintenance', 'each', 24, null),
  ('AAA batteries', 'maintenance', 'each', 12, null),
  ('9V batteries (smoke detectors)', 'maintenance', 'each', 6, null),
  ('Toilet flappers', 'maintenance', 'each', 2, null),
  ('White silicone caulk', 'maintenance', 'tube', 2, null),
  ('Touch-up paint (white)', 'maintenance', 'gallon', 1, null),
  ('Spackle', 'maintenance', 'tub', 1, null),
  ('WD-40', 'maintenance', 'can', 1, null),
  ('Duct tape', 'maintenance', 'roll', 1, null),
  ('Ice melt', 'maintenance', 'bag', 4, null),
  ('Outlet / switch cover plates', 'maintenance', 'each', 4, null),
  -- Guest room supplies
  ('Shampoo', 'guest_room', 'each', 48, null),
  ('Conditioner', 'guest_room', 'each', 48, null),
  ('Body wash', 'guest_room', 'each', 48, null),
  ('Bar soap', 'guest_room', 'each', 48, null),
  ('Lotion', 'guest_room', 'each', 24, null),
  ('Toilet paper', 'guest_room', 'roll', 48, null),
  ('Facial tissue', 'guest_room', 'box', 12, null),
  ('Coffee pods', 'guest_room', 'each', 100, null),
  ('Tea bags', 'guest_room', 'each', 50, null),
  ('Creamer cups', 'guest_room', 'each', 50, null),
  ('Sugar packets', 'guest_room', 'each', 100, null),
  ('Bottled water', 'guest_room', 'bottle', 24, null),
  ('Bath towels', 'guest_room', 'each', 20, 'Laundry Room'),
  ('Hand towels', 'guest_room', 'each', 20, 'Laundry Room'),
  ('Washcloths', 'guest_room', 'each', 20, 'Laundry Room'),
  ('Bath mats', 'guest_room', 'each', 10, 'Laundry Room'),
  ('Queen sheet sets', 'guest_room', 'set', 6, 'Laundry Room'),
  ('King sheet sets', 'guest_room', 'set', 4, 'Laundry Room'),
  ('Pillowcases', 'guest_room', 'each', 20, 'Laundry Room'),
  ('Notepads and pens', 'guest_room', 'each', 12, null),
  -- Breakfast / food
  ('Ground coffee', 'breakfast_food', 'lb', 5, 'Kitchen'),
  ('Eggs', 'breakfast_food', 'dozen', 6, 'Kitchen'),
  ('Milk', 'breakfast_food', 'gallon', 2, 'Kitchen'),
  ('Half and half', 'breakfast_food', 'quart', 2, 'Kitchen'),
  ('Butter', 'breakfast_food', 'lb', 3, 'Kitchen'),
  ('Orange juice', 'breakfast_food', 'gallon', 2, 'Kitchen'),
  ('Bread', 'breakfast_food', 'loaf', 3, 'Kitchen'),
  ('Pancake mix', 'breakfast_food', 'box', 2, 'Kitchen'),
  ('Maple syrup', 'breakfast_food', 'quart', 2, 'Kitchen'),
  ('Bacon', 'breakfast_food', 'lb', 4, 'Kitchen'),
  ('Sausage', 'breakfast_food', 'lb', 4, 'Kitchen'),
  ('Yogurt', 'breakfast_food', 'each', 12, 'Kitchen'),
  ('Granola', 'breakfast_food', 'bag', 2, 'Kitchen'),
  ('Flour', 'breakfast_food', 'lb', 10, 'Kitchen'),
  ('Sugar', 'breakfast_food', 'lb', 5, 'Kitchen'),
  ('Napkins', 'breakfast_food', 'pack', 4, 'Kitchen'),
  ('To-go cups and lids', 'breakfast_food', 'sleeve', 2, 'Kitchen'),
  -- Cleaning / housekeeping
  ('All-purpose cleaner', 'cleaning', 'bottle', 3, 'Laundry Room'),
  ('Glass cleaner', 'cleaning', 'bottle', 2, 'Laundry Room'),
  ('Bathroom disinfectant', 'cleaning', 'bottle', 3, 'Laundry Room'),
  ('Toilet bowl cleaner', 'cleaning', 'bottle', 3, 'Laundry Room'),
  ('Laundry detergent', 'cleaning', 'jug', 2, 'Laundry Room'),
  ('Bleach', 'cleaning', 'jug', 2, 'Laundry Room'),
  ('Dryer sheets', 'cleaning', 'box', 2, 'Laundry Room'),
  ('Paper towels', 'cleaning', 'roll', 24, 'Laundry Room'),
  ('Trash bags (large)', 'cleaning', 'box', 2, 'Laundry Room'),
  ('Trash can liners (small)', 'cleaning', 'box', 2, 'Laundry Room'),
  ('Dish soap', 'cleaning', 'bottle', 2, 'Kitchen'),
  ('Dishwasher detergent', 'cleaning', 'box', 1, 'Kitchen'),
  ('Sponges', 'cleaning', 'pack', 2, 'Laundry Room'),
  ('Microfiber cloths', 'cleaning', 'pack', 1, 'Laundry Room'),
  ('Vacuum bags', 'cleaning', 'each', 4, 'Laundry Room'),
  ('Rubber gloves', 'cleaning', 'box', 2, 'Laundry Room'),
  ('Mop pads', 'cleaning', 'each', 4, 'Laundry Room')
on conflict do nothing;
