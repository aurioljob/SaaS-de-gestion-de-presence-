-- POINTIFY - RPC pour invitations et pointage QR

alter table public.invitations
  add column if not exists employee_id uuid references public.employees(id) on delete cascade;

drop function if exists public.create_company_for_user(text, text, text);
create or replace function public.create_company_for_user(
  p_company_name text,
  p_country text,
  p_city text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  company_row public.companies%rowtype;
  free_plan_id uuid;
begin
  if current_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Session absente');
  end if;

  select email into current_email from auth.users where id = current_user_id;

  insert into public.companies (name, email, country, city)
  values (p_company_name, current_email, p_country, p_city)
  returning * into company_row;

  update public.profiles
  set role = 'company_owner'
  where id = current_user_id;

  insert into public.company_members (company_id, user_id, role, status)
  values (company_row.id, current_user_id, 'company_owner', 'active');

  select id into free_plan_id from public.plans where name = 'FREE' limit 1;
  if free_plan_id is not null then
    insert into public.subscriptions (company_id, plan_id, status, billing_cycle, price, currency, expires_at)
    values (company_row.id, free_plan_id, 'trial', 'monthly', 0, 'XAF', now() + interval '14 days');
  end if;

  return jsonb_build_object('success', true, 'company_id', company_row.id);
exception when others then
  return jsonb_build_object('success', false, 'error', SQLERRM);
end;
$$;

grant execute on function public.create_company_for_user(text, text, text) to authenticated;

drop function if exists public.my_features();
create or replace function public.my_features()
returns text[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(f.key), array[]::text[])
  from public.features f
  join public.plan_features pf on pf.feature_id = f.id and pf.enabled = true
  join public.subscriptions s on s.plan_id = pf.plan_id
  join public.company_members cm on cm.company_id = s.company_id
  where cm.user_id = auth.uid()
    and cm.status = 'active'
    and s.status in ('trial', 'active');
$$;

grant execute on function public.my_features() to authenticated;

drop function if exists public.validate_coupon(text, uuid);
create or replace function public.validate_coupon(p_code text, p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  coupon_row public.coupons%rowtype;
begin
  select * into coupon_row
  from public.coupons
  where upper(code) = upper(trim(p_code))
    and is_active = true
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at >= now())
    and (max_uses is null or (select count(*) from public.coupon_redemptions where coupon_id = coupons.id) < max_uses)
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'error', 'Code promo invalide ou expire');
  end if;

  return jsonb_build_object(
    'valid', true,
    'coupon_id', coupon_row.id,
    'discount_type', coupon_row.discount_type,
    'discount_value', coupon_row.discount_value
  );
end;
$$;

grant execute on function public.validate_coupon(text, uuid) to authenticated;

drop function if exists public.regenerate_invitation(uuid);
create or replace function public.regenerate_invitation(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  employee_row public.employees%rowtype;
  current_user_id uuid := auth.uid();
  token_value text;
begin
  select e.* into employee_row
  from public.employees e
  join public.company_members cm on cm.company_id = e.company_id
  where e.id = p_employee_id
    and cm.user_id = current_user_id
    and cm.status = 'active'
    and cm.role in ('company_owner', 'company_admin', 'supervisor')
  limit 1;

  if not found or employee_row.email is null then
    return jsonb_build_object('success', false, 'error', 'Employe introuvable ou sans email');
  end if;

  update public.invitations
  set status = 'revoked'
  where employee_id = employee_row.id and status = 'pending';

  token_value := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.invitations (company_id, employee_id, email, role, token, expires_at, status)
  values (employee_row.company_id, employee_row.id, employee_row.email, 'employee', token_value, now() + interval '7 days', 'pending');

  return jsonb_build_object('success', true, 'token', token_value);
end;
$$;

grant execute on function public.regenerate_invitation(uuid) to authenticated;

drop function if exists public.get_invitation(text);
create or replace function public.get_invitation(p_token text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'id', i.id,
        'company_id', i.company_id,
        'employee_id', i.employee_id,
        'email', i.email,
        'role', i.role,
        'token', i.token,
        'expires_at', i.expires_at,
        'status', i.status,
        'company_name', c.name
      )
      from public.invitations i
      join public.companies c on c.id = i.company_id
      where i.token = p_token
    ),
    '{}'::jsonb
  );
$$;

grant execute on function public.get_invitation(text) to anon, authenticated;

drop function if exists public.accept_invitation(text);
create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_row public.invitations%rowtype;
  employee_row public.employees%rowtype;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non authentifie');
  end if;

  select * into invitation_row
  from public.invitations
  where token = p_token
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invitation introuvable');
  end if;

  if invitation_row.status <> 'pending' or invitation_row.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'Invitation expiree');
  end if;

  select * into employee_row
  from public.employees
  where id = invitation_row.employee_id
     or (company_id = invitation_row.company_id and lower(email) = lower(invitation_row.email))
  order by (id = invitation_row.employee_id) desc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Fiche employe introuvable');
  end if;

  update public.profiles
  set role = 'employee', email = invitation_row.email,
      full_name = employee_row.first_name || ' ' || employee_row.last_name
  where id = current_user_id;

  update public.employees
  set user_id = current_user_id, status = 'active'
  where id = employee_row.id;

  insert into public.company_members (company_id, user_id, role, status)
  values (invitation_row.company_id, current_user_id, 'employee', 'active')
  on conflict (company_id, user_id) do update
    set role = 'employee', status = 'active';

  update public.invitations
  set status = 'accepted'
  where id = invitation_row.id;

  return jsonb_build_object('success', true, 'employee_id', employee_row.id);
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;

drop function if exists public.validate_check_in(uuid, double precision, double precision, double precision, text);
create or replace function public.validate_check_in(
  p_site_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision,
  p_qr_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  employee_row public.employees%rowtype;
  site_row public.sites%rowtype;
  qr_row public.qr_codes%rowtype;
  attendance_row public.attendance%rowtype;
  distance_m double precision;
  event_kind text;
  attendance_status public.attendance_status;
  worked integer := 0;
begin
  if current_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Session absente');
  end if;

  select * into employee_row
  from public.employees
  where user_id = current_user_id and status = 'active'
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Aucune fiche employe active');
  end if;

  select * into site_row
  from public.sites
  where id = p_site_id and company_id = employee_row.company_id and status = 'active';

  if not found then
    return jsonb_build_object('success', false, 'error', 'Site invalide');
  end if;

  select * into qr_row
  from public.qr_codes
  where site_id = p_site_id and token_hash = p_qr_token and is_active = true
    and (expires_at is null or expires_at > now());

  if not found then
    return jsonb_build_object('success', false, 'error', 'QR code invalide ou expire');
  end if;

  if site_row.latitude is not null and site_row.longitude is not null then
    distance_m := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_latitude - site_row.latitude) / 2), 2) +
      cos(radians(site_row.latitude)) * cos(radians(p_latitude)) *
      power(sin(radians(p_longitude - site_row.longitude) / 2), 2)
    ));

    if distance_m > site_row.radius_meters then
      return jsonb_build_object('success', false, 'error', 'Vous etes trop loin du site', 'distance', round(distance_m)::integer);
    end if;
  else
    distance_m := 0;
  end if;

  select * into attendance_row
  from public.attendance
  where employee_id = employee_row.id and work_date = current_date
  for update;

  if not found then
    event_kind := 'check_in';
    attendance_status := case
      when localtime > coalesce((select start_time from public.work_schedules where company_id = employee_row.company_id and (site_id = p_site_id or site_id is null) and day_of_week = extract(dow from current_date)::integer order by site_id nulls last limit 1), localtime)
      then 'late'::public.attendance_status
      else 'present'::public.attendance_status
    end;

    insert into public.attendance (company_id, employee_id, site_id, work_date, check_in, status)
    values (employee_row.company_id, employee_row.id, p_site_id, current_date, now(), attendance_status)
    returning * into attendance_row;
  elsif attendance_row.check_out is null then
    event_kind := 'check_out';
    worked := greatest(0, floor(extract(epoch from (now() - attendance_row.check_in)) / 60)::integer);

    update public.attendance
    set check_out = now(), worked_minutes = worked
    where id = attendance_row.id
    returning * into attendance_row;
  else
    return jsonb_build_object('success', false, 'error', 'Journee deja terminee');
  end if;

  insert into public.attendance_events (attendance_id, employee_id, site_id, event_type, latitude, longitude, accuracy, distance_meters, qr_code_id)
  values (attendance_row.id, employee_row.id, p_site_id, event_kind, p_latitude, p_longitude, p_accuracy, distance_m, qr_row.id);

  return jsonb_build_object(
    'success', true,
    'event_type', event_kind,
    'status', attendance_row.status,
    'time', to_char(case when event_kind = 'check_in' then attendance_row.check_in else attendance_row.check_out end, 'HH24:MI'),
    'site_name', site_row.name,
    'distance', round(distance_m)::integer
  );
end;
$$;

grant execute on function public.validate_check_in(uuid, double precision, double precision, double precision, text) to authenticated;

-- Lecture necessaire au scan et aux historiques de l'employe.
drop policy if exists "qr_codes_employee_site_select" on public.qr_codes;
create policy "qr_codes_employee_site_select" on public.qr_codes for select
using (site_id in (
  select site_id from public.employees
  where user_id = auth.uid() and status = 'active' and site_id is not null
));

drop policy if exists "attendance_employee_own" on public.attendance;
create policy "attendance_employee_own" on public.attendance for select
using (employee_id in (select id from public.employees where user_id = auth.uid()));

drop policy if exists "attendance_events_employee_own" on public.attendance_events;
create policy "attendance_events_employee_own" on public.attendance_events for select
using (employee_id in (select id from public.employees where user_id = auth.uid()));
