-- =====================================================
-- POINTIFY — RLS (corrigé avec schéma public explicite)
-- =====================================================

create or replace function public.is_super_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.my_company_ids()
returns setof uuid
language sql security definer stable
set search_path = public
as $$
  select company_id from public.company_members
  where user_id = auth.uid() and status = 'active';
$$;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.departments enable row level security;
alter table public.sites enable row level security;
alter table public.employees enable row level security;
alter table public.qr_codes enable row level security;
alter table public.work_schedules enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_events enable row level security;
alter table public.invitations enable row level security;
alter table public.notifications enable row level security;
alter table public.plans enable row level security;
alter table public.features enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- PROFILES
create policy "profiles_select_own_or_admin" on public.profiles for select
using (id = auth.uid() or public.is_super_admin());
create policy "profiles_update_own" on public.profiles for update
using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_all" on public.profiles for all
using (public.is_super_admin()) with check (public.is_super_admin());

-- COMPANIES
create policy "companies_select_member" on public.companies for select
using (public.is_super_admin() or id in (select public.my_company_ids()));
create policy "companies_admin_all" on public.companies for all
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "companies_owner_update" on public.companies for update
using (id in (select company_id from public.company_members where user_id = auth.uid() and role in ('company_owner','company_admin')))
with check (id in (select company_id from public.company_members where user_id = auth.uid() and role in ('company_owner','company_admin')));

-- COMPANY MEMBERS
create policy "members_select_same_company" on public.company_members for select
using (public.is_super_admin() or company_id in (select public.my_company_ids()));
create policy "members_admin_all" on public.company_members for all
using (public.is_super_admin()) with check (public.is_super_admin());

-- DEPARTMENTS / SITES / EMPLOYEES / SCHEDULES / ATTENDANCE
create policy "departments_company" on public.departments for all
using (public.is_super_admin() or company_id in (select public.my_company_ids()))
with check (public.is_super_admin() or company_id in (select public.my_company_ids()));

create policy "sites_company" on public.sites for all
using (public.is_super_admin() or company_id in (select public.my_company_ids()))
with check (public.is_super_admin() or company_id in (select public.my_company_ids()));

create policy "employees_company" on public.employees for all
using (public.is_super_admin() or company_id in (select public.my_company_ids()))
with check (public.is_super_admin() or company_id in (select public.my_company_ids()));

create policy "schedules_company" on public.work_schedules for all
using (public.is_super_admin() or company_id in (select public.my_company_ids()))
with check (public.is_super_admin() or company_id in (select public.my_company_ids()));

create policy "attendance_company" on public.attendance for all
using (public.is_super_admin() or company_id in (select public.my_company_ids()))
with check (public.is_super_admin() or company_id in (select public.my_company_ids()));

create policy "attendance_events_company" on public.attendance_events for all
using (public.is_super_admin() or employee_id in (
  select id from public.employees where company_id in (select public.my_company_ids())
))
with check (public.is_super_admin() or employee_id in (
  select id from public.employees where company_id in (select public.my_company_ids())
));

-- QR CODES
create policy "qr_codes_company" on public.qr_codes for all
using (public.is_super_admin() or site_id in (
  select id from public.sites where company_id in (select public.my_company_ids())
))
with check (public.is_super_admin() or site_id in (
  select id from public.sites where company_id in (select public.my_company_ids())
));

-- INVITATIONS
create policy "invitations_company" on public.invitations for all
using (public.is_super_admin() or company_id in (select public.my_company_ids()))
with check (public.is_super_admin() or company_id in (select public.my_company_ids()));

-- NOTIFICATIONS
create policy "notifications_own" on public.notifications for all
using (user_id = auth.uid() or public.is_super_admin())
with check (user_id = auth.uid() or public.is_super_admin());

-- PLANS / FEATURES / PLAN_FEATURES
create policy "plans_read_all" on public.plans for select using (true);
create policy "plans_admin_write" on public.plans for all
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "features_read_all" on public.features for select using (true);
create policy "features_admin_write" on public.features for all
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "plan_features_read_all" on public.plan_features for select using (true);
create policy "plan_features_admin_write" on public.plan_features for all
using (public.is_super_admin()) with check (public.is_super_admin());

-- SUBSCRIPTIONS / PAYMENTS
create policy "subscriptions_read" on public.subscriptions for select
using (public.is_super_admin() or company_id in (select public.my_company_ids()));
create policy "subscriptions_admin_write" on public.subscriptions for all
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "payments_read" on public.payments for select
using (public.is_super_admin() or company_id in (select public.my_company_ids()));
create policy "payments_admin_write" on public.payments for all
using (public.is_super_admin()) with check (public.is_super_admin());

-- COUPONS
create policy "coupons_read_active" on public.coupons for select using (true);
create policy "coupons_admin_write" on public.coupons for all
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "coupon_redemptions_read" on public.coupon_redemptions for select
using (public.is_super_admin() or company_id in (select public.my_company_ids()));
create policy "coupon_redemptions_admin_write" on public.coupon_redemptions for all
using (public.is_super_admin()) with check (public.is_super_admin());

-- AUDIT LOGS
create policy "audit_logs_admin_read" on public.audit_logs for select
using (public.is_super_admin());
create policy "audit_logs_admin_insert" on public.audit_logs for insert
with check (true);

-- PLATFORM SETTINGS
create policy "settings_read_all" on public.platform_settings for select using (true);
create policy "settings_admin_write" on public.platform_settings for all
using (public.is_super_admin()) with check (public.is_super_admin());



-- Les admins d'entreprise peuvent créer des employés, sites, etc.
drop policy if exists "employees_company" on public.employees;
create policy "employees_company" on public.employees for all
using (public.is_super_admin() or company_id in (select public.my_company_ids()))
with check (public.is_super_admin() or company_id in (select public.my_company_ids()));

create policy "employees_select_own" on public.employees for select
using (user_id = auth.uid());

drop policy if exists "members_admin_all" on public.company_members;
create policy "members_admin_all" on public.company_members for all
using (public.is_super_admin() or company_id in (select public.my_company_ids()))
with check (public.is_super_admin() or company_id in (select public.my_company_ids()));

drop policy if exists "subscriptions_admin_write" on public.subscriptions;
create policy "subscriptions_admin_write" on public.subscriptions for all
using (public.is_super_admin() or company_id in (select public.my_company_ids()))
with check (public.is_super_admin() or company_id in (select public.my_company_ids()));