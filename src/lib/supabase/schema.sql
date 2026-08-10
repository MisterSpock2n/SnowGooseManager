create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text not null,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  user_id uuid not null references users(id),
  entry_date date not null,
  entry_type text not null check (entry_type in ('hourly','overnight')),
  work_type text null check (work_type in ('cleaning','maintenance','it','general')),
  hours_worked numeric(6,2),
  rate_applied numeric(8,2),
  overnight_base_pay numeric(8,2),
  room_revenue numeric(10,2),
  overnight_commission_rate numeric(5,4),
  calculated_pay numeric(10,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll_periods (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft','locked','emailed')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists payroll_exports (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references payroll_periods(id),
  user_id uuid not null references users(id),
  pdf_path text not null,
  recipient_email text not null,
  email_status text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('maintenance','guest_room','breakfast_food')),
  name text not null,
  unit text not null,
  quantity_on_hand numeric(10,2) not null default 0,
  reorder_threshold numeric(10,2) not null default 0,
  storage_location text,
  vendor text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory_items(id),
  transaction_type text not null check (transaction_type in ('add','use','adjust')),
  quantity_delta numeric(10,2) not null,
  transaction_date date not null,
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  task_name text not null,
  category text,
  frequency_type text not null check (frequency_type in ('monthly','quarterly','semiannual','annual','custom_days')),
  custom_days_interval integer,
  last_completed_date date,
  next_due_date date not null,
  assigned_user_id uuid references users(id),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references maintenance_tasks(id),
  completed_date date not null,
  completed_by uuid not null references users(id),
  notes text,
  created_at timestamptz not null default now()
);

insert into properties (name)
select 'Snow Goose Inn'
where not exists (select 1 from properties where name = 'Snow Goose Inn');

insert into users (email, display_name)
select 'nick@example.com', 'Nick'
where not exists (select 1 from users where email = 'nick@example.com');

insert into users (email, display_name)
select 'rhiannon@example.com', 'Rhiannon'
where not exists (select 1 from users where email = 'rhiannon@example.com');
