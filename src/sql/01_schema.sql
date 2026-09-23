-- =====================================================
-- POINTIFY — SCHEMA + TRIGGERS (corrigé)
-- =====================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create type user_role as enum ('super_admin', 'company_owner', 'company_admin', 'supervisor', 'employee');
create type company_status as enum ('active', 'suspended', 'pending');
create type employee_status as enum ('active', 'inactive', 'suspended', 'terminated');
create type attendance_status as enum ('present', 'absent', 'late', 'early_leave', 'partial');
create type subscription_status as enum ('trial', 'active', 'past_due', 'cancelled', 'expired', 'suspended');
create type billing_cycle as enum ('monthly', 'yearly');
create type payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  phone text,
  role user_role not null default 'employee',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text, phone text, logo_url text, address text, country text, city text,
  status company_status not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.company_members (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role user_role not null default 'employee',
  status text not null default 'active',
  created_at timestamptz default now(),
  unique(company_id, user_id)
);

create table public.departments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table public.sites (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, address text,
  latitude double precision, longitude double precision,
  radius_meters int not null default 100,
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.employees (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  employee_number text, first_name text not null, last_name text not null,
  email text, phone text,
  department_id uuid references public.departments(id) on delete set null,
  position text,
  site_id uuid references public.sites(id) on delete set null,
  hire_date date,
  status employee_status not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.qr_codes (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table public.work_schedules (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null, end_time time not null,
  break_start time, break_end time,
  late_tolerance_minutes int not null default 10,
  created_at timestamptz default now()
);

create table public.attendance (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  work_date date not null,
  check_in timestamptz, check_out timestamptz,
  status attendance_status not null default 'absent',
  worked_minutes int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(employee_id, work_date)
);

create table public.attendance_events (
  id uuid primary key default uuid_generate_v4(),
  attendance_id uuid references public.attendance(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  event_type text not null check (event_type in ('check_in', 'check_out')),
  latitude double precision, longitude double precision,
  accuracy double precision, distance_meters double precision,
  qr_code_id uuid references public.qr_codes(id) on delete set null,
  created_at timestamptz default now()
);

create table public.invitations (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role user_role not null default 'employee',
  token text not null unique,
  expires_at timestamptz not null,
  status invitation_status not null default 'pending',
  created_at timestamptz default now()
);

create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, title text not null, message text,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table public.plans (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique, description text,
  monthly_price numeric(12,2) not null default 0,
  yearly_price numeric(12,2) not null default 0,
  currency text not null default 'XAF',
  max_employees int not null default 5,
  max_sites int not null default 1,
  max_admins int not null default 1,
  history_days int not null default 30,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.features (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique, name text not null, description text,
  created_at timestamptz default now()
);

create table public.plan_features (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  unique(plan_id, feature_id)
);

create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status subscription_status not null default 'trial',
  billing_cycle billing_cycle not null default 'monthly',
  price numeric(12,2) not null default 0,
  currency text not null default 'XAF',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  auto_renew boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'XAF',
  provider text, transaction_reference text,
  status payment_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table public.coupons (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12,2) not null,
  starts_at timestamptz, expires_at timestamptz,
  max_uses int,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table public.coupon_redemptions (
  id uuid primary key default uuid_generate_v4(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  redeemed_at timestamptz default now()
);

create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  action text not null, entity_type text, entity_id uuid,
  old_values jsonb, new_values jsonb, ip_address text,
  created_at timestamptz default now()
);

create table public.platform_settings (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique, value jsonb,
  updated_at timestamptz default now()
);

-- ============ TRIGGERS updated_at ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_companies_updated before update on public.companies for each row execute function public.set_updated_at();
create trigger trg_sites_updated before update on public.sites for each row execute function public.set_updated_at();
create trigger trg_employees_updated before update on public.employees for each row execute function public.set_updated_at();
create trigger trg_attendance_updated before update on public.attendance for each row execute function public.set_updated_at();
create trigger trg_plans_updated before update on public.plans for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated before update on public.subscriptions for each row execute function public.set_updated_at();

-- ============ FONCTION : création profil auto (CORRIGÉE) ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'employee'
  );
  return new;
end;
$$;

-- ============ TRIGGER : création profil auto ============
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();