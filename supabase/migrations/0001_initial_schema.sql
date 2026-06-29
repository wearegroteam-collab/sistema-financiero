create extension if not exists "pgcrypto";

create type public.user_role as enum ('super_admin', 'admin', 'accountant');
create type public.expense_category_key as enum ('payroll', 'inventory', 'extras', 'fixed');
create type public.payment_method_key as enum ('bold', 'bancolombia', 'nequi', 'cash');
create type public.audit_action as enum ('create', 'update', 'delete', 'close_month', 'reopen_month', 'download_pdf', 'export_excel', 'print');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  currency text not null default 'COP',
  timezone text not null default 'America/Bogota',
  active boolean not null default true,
  admin_name text,
  admin_email text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  key public.payment_method_key not null,
  label text not null,
  color text not null,
  active boolean not null default true,
  unique (business_id, key)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  key public.expense_category_key not null,
  label text not null,
  color text not null,
  active boolean not null default true,
  unique (business_id, key)
);

create table public.daily_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null,
  total numeric(14, 2) not null check (total >= 0),
  bold numeric(14, 2) not null default 0 check (bold >= 0),
  bancolombia numeric(14, 2) not null default 0 check (bancolombia >= 0),
  nequi numeric(14, 2) not null default 0 check (nequi >= 0),
  cash numeric(14, 2) not null default 0 check (cash >= 0),
  notes text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by uuid references public.users(id),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id),
  constraint sale_distribution_matches_total check ((bold + bancolombia + nequi + cash) = total),
  unique (business_id, date)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null,
  category public.expense_category_key not null,
  detail text not null,
  payment_method public.payment_method_key not null,
  value numeric(14, 2) not null check (value > 0),
  notes text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by uuid references public.users(id),
  deleted_at timestamptz,
  deleted_by uuid references public.users(id)
);

create table public.monthly_closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  month int not null check (month between 1 and 12),
  year int not null check (year >= 2020),
  sales_total numeric(14, 2) not null,
  expenses_total numeric(14, 2) not null,
  available_total numeric(14, 2) not null,
  utility numeric(14, 2) not null,
  bold_balance numeric(14, 2) not null,
  bancolombia_balance numeric(14, 2) not null,
  nequi_balance numeric(14, 2) not null,
  cash_balance numeric(14, 2) not null,
  payroll_total numeric(14, 2) not null default 0,
  inventory_total numeric(14, 2) not null default 0,
  extras_total numeric(14, 2) not null default 0,
  fixed_total numeric(14, 2) not null default 0,
  payroll_percentage numeric(8, 4) not null,
  inventory_percentage numeric(8, 4) not null,
  extras_percentage numeric(8, 4) not null,
  fixed_percentage numeric(8, 4) not null,
  available_percentage numeric(8, 4) not null,
  notes text,
  closed_at timestamptz not null default now(),
  closed_by uuid not null references public.users(id),
  reopened_at timestamptz,
  reopened_by uuid references public.users(id)
);

create table public.settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  action public.audit_action not null,
  actor_id uuid references public.users(id),
  old_data jsonb,
  new_data jsonb,
  summary text not null,
  created_at timestamptz not null default now()
);

create index daily_sales_business_date_idx on public.daily_sales (business_id, date);
create index expenses_business_date_idx on public.expenses (business_id, date);
create index audit_logs_business_created_idx on public.audit_logs (business_id, created_at desc);
create unique index monthly_closures_one_open_month_idx
on public.monthly_closures (business_id, month, year)
where reopened_at is null;

create or replace function public.current_business_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select business_id from public.users where id = auth.uid()
$$;

create or replace function public.current_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.month_is_closed(target_business_id uuid, target_date date)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.monthly_closures
    where business_id = target_business_id
      and year = extract(year from target_date)::int
      and month = extract(month from target_date)::int
      and reopened_at is null
  )
$$;

create or replace function public.prevent_closed_month_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if public.month_is_closed(old.business_id, old.date) then
      raise exception 'This month is closed';
    end if;
    return old;
  end if;

  if public.month_is_closed(new.business_id, new.date) then
    raise exception 'This month is closed';
  end if;

  return new;
end;
$$;

create trigger daily_sales_closed_month_guard
before insert or update or delete on public.daily_sales
for each row execute function public.prevent_closed_month_changes();

create trigger expenses_closed_month_guard
before insert or update or delete on public.expenses
for each row execute function public.prevent_closed_month_changes();

alter table public.businesses enable row level security;
alter table public.users enable row level security;
alter table public.payment_methods enable row level security;
alter table public.categories enable row level security;
alter table public.daily_sales enable row level security;
alter table public.expenses enable row level security;
alter table public.monthly_closures enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "Super admins can read all businesses" on public.businesses
for select using (public.current_role() = 'super_admin');

create policy "Users can read own business" on public.businesses
for select using (id = public.current_business_id());

create policy "Super admins manage businesses" on public.businesses
for all using (public.current_role() = 'super_admin')
with check (public.current_role() = 'super_admin');

create policy "Admins can update own business" on public.businesses
for update using (id = public.current_business_id() and public.current_role() = 'admin');

create policy "Super admins can read all users" on public.users
for select using (public.current_role() = 'super_admin');

create policy "Users can read team" on public.users
for select using (business_id = public.current_business_id());

create policy "Super admins manage users" on public.users
for all using (public.current_role() = 'super_admin')
with check (public.current_role() = 'super_admin');

create policy "Admins manage accounting users in own business" on public.users
for all using (
  business_id = public.current_business_id()
  and public.current_role() = 'admin'
  and role = 'accountant'
)
with check (
  business_id = public.current_business_id()
  and public.current_role() = 'admin'
  and role = 'accountant'
);

create policy "Read payment methods" on public.payment_methods
for select using (business_id = public.current_business_id());

create policy "Admins manage payment methods" on public.payment_methods
for all using (business_id = public.current_business_id() and public.current_role() in ('super_admin', 'admin'));

create policy "Read categories" on public.categories
for select using (business_id = public.current_business_id());

create policy "Admins manage categories" on public.categories
for all using (business_id = public.current_business_id() and public.current_role() in ('super_admin', 'admin'));

create policy "Read daily sales" on public.daily_sales
for select using (business_id = public.current_business_id());

create policy "Super admins manage all daily sales" on public.daily_sales
for all using (public.current_role() = 'super_admin')
with check (public.current_role() = 'super_admin');

create policy "Admins manage own daily sales" on public.daily_sales
for all using (business_id = public.current_business_id() and public.current_role() = 'admin')
with check (business_id = public.current_business_id() and public.current_role() = 'admin');

create policy "Read expenses" on public.expenses
for select using (business_id = public.current_business_id());

create policy "Super admins manage all expenses" on public.expenses
for all using (public.current_role() = 'super_admin')
with check (public.current_role() = 'super_admin');

create policy "Admins manage own expenses" on public.expenses
for all using (business_id = public.current_business_id() and public.current_role() = 'admin')
with check (business_id = public.current_business_id() and public.current_role() = 'admin');

create policy "Read closures" on public.monthly_closures
for select using (business_id = public.current_business_id());

create policy "Super admins read all closures" on public.monthly_closures
for select using (public.current_role() = 'super_admin');

create policy "Admins close months" on public.monthly_closures
for insert with check (business_id = public.current_business_id() and public.current_role() = 'admin');

create policy "Super admins close any month" on public.monthly_closures
for insert with check (public.current_role() = 'super_admin');

create policy "Super admins reopen months" on public.monthly_closures
for update using (business_id = public.current_business_id() and public.current_role() = 'super_admin');

create policy "Read settings" on public.settings
for select using (business_id = public.current_business_id());

create policy "Admins manage settings" on public.settings
for all using (business_id = public.current_business_id() and public.current_role() in ('super_admin', 'admin'));

create policy "Read audit logs" on public.audit_logs
for select using (business_id = public.current_business_id());

create policy "Super admins read all audit logs" on public.audit_logs
for select using (public.current_role() = 'super_admin');

create policy "System inserts audit logs" on public.audit_logs
for insert with check (business_id = public.current_business_id());
