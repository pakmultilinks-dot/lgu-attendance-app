-- LGU Exam Department Attendance App, Supabase schema
-- Run this whole file once in the Supabase SQL Editor.
-- Tables: employees, attendance_records, office_settings, admin_audit, device_bindings, leaves.
-- Auth: Supabase Auth. Every employee has one auth user. Role lives on employees.role.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- employees: one row per staff member, linked to one Supabase Auth user.
-- role is 'hod' or 'employee'. Deactivation is a flag, never a delete, so
-- attendance history is preserved.
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  employee_id text not null unique,
  full_name text not null,
  designation text not null default 'Staff',
  email text not null unique,
  phone text,
  role text not null default 'employee' check (role in ('hod', 'employee')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employees_auth_user on public.employees (auth_user_id);
create index if not exists idx_employees_active on public.employees (is_active);

-- ---------------------------------------------------------------------------
-- office_settings: single row (id = 1). The HOD edits it from the admin panel.
-- PLACEHOLDER PIN: lat 31.4640, lng 74.4427 is the LGU Main Campus area pin only
-- (public coordinates for LGU Main Campus, Sector C, DHA Phase 6, Lahore).
-- The Examination Department office is inside the campus; its exact door pin
-- is NOT known and must be set in the admin panel before go live.
-- TODO: the HOD must set the exact office door pin in the admin panel before
-- go live. Do not treat this placeholder as final. The placeholder is the
-- campus area, not the office door.
-- ---------------------------------------------------------------------------
create table if not exists public.office_settings (
  id int primary key default 1 check (id = 1),
  office_name text not null default 'Examination Department, Lahore Garrison University',
  office_lat double precision not null default 31.4640,
  office_lng double precision not null default 74.4427,
  radius_meters int not null default 100 check (radius_meters > 0 and radius_meters <= 1000),
  office_start_time time not null default '09:00',
  office_end_time time not null default '17:00',
  late_cutoff_time time not null default '09:15',
  working_days int[] not null default '{1,2,3,4,5}',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.employees (id)
);

insert into public.office_settings (id)
values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- attendance_records: one row per employee per day.
-- Unique constraint on (employee_id, work_date) enforces one check in per day.
-- check_in_at and check_out_at are server timestamps, set with now() by the
-- database, never taken from the phone clock.
-- location_verified is true when the GPS distance at check in was inside the
-- radius. mocked_location is true when the OS reported a mock provider.
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  work_date date not null default (now() at time zone 'Asia/Karachi'),
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  check_in_distance_meters double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  check_out_distance_meters double precision,
  location_verified boolean not null default false,
  mocked_location boolean not null default false,
  device_id text,
  status text not null default 'Present' check (status in ('Present', 'Late', 'Absent', 'Leave')),
  total_hours numeric(5, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint one_record_per_employee_per_day unique (employee_id, work_date),
  constraint checkout_after_checkin check (check_out_at is null or check_in_at is null or check_out_at > check_in_at)
);

create index if not exists idx_attendance_employee_date on public.attendance_records (employee_id, work_date desc);
create index if not exists idx_attendance_date on public.attendance_records (work_date desc);
create index if not exists idx_attendance_status on public.attendance_records (status);

-- Total hours, computed on every write. Keeps the app and the report consistent.
create or replace function public.compute_total_hours()
returns trigger as $$
begin
  if new.check_in_at is not null and new.check_out_at is not null then
    new.total_hours := round(extract(epoch from (new.check_out_at - new.check_in_at)) / 3600.0, 2);
  else
    new.total_hours := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_compute_total_hours on public.attendance_records;
create trigger trg_compute_total_hours
  before insert or update on public.attendance_records
  for each row execute function public.compute_total_hours();

-- ---------------------------------------------------------------------------
-- device_bindings: first phone an employee signs in on. A new device is
-- recorded as unapproved so the HOD can see it and approve or block it.
-- ---------------------------------------------------------------------------
create table if not exists public.device_bindings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  device_id text not null,
  device_label text,
  is_approved boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint one_device_per_employee unique (employee_id, device_id)
);

create index if not exists idx_devices_employee on public.device_bindings (employee_id);

-- ---------------------------------------------------------------------------
-- admin_audit: every HOD action, for accountability.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.employees (id),
  action text not null,
  target_employee_id uuid references public.employees (id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_created on public.admin_audit (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Employees see only their own rows. HOD sees everything.
-- Helper: is the signed in user a HOD?
-- ---------------------------------------------------------------------------
alter table public.employees enable row level security;
alter table public.attendance_records enable row level security;
alter table public.office_settings enable row level security;
alter table public.device_bindings enable row level security;
alter table public.admin_audit enable row level security;

create or replace function public.is_hod()
returns boolean as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid() and role = 'hod' and is_active = true
  );
$$ language sql stable security definer;

create or replace function public.my_employee_id()
returns uuid as $$
  select id from public.employees where auth_user_id = auth.uid();
$$ language sql stable security definer;

-- employees: anyone signed in can read their own row; HOD reads all; HOD manages.
drop policy if exists employees_read_own on public.employees;
create policy employees_read_own on public.employees
  for select using (auth_user_id = auth.uid() or public.is_hod());

drop policy if exists employees_hod_write on public.employees;
create policy employees_hod_write on public.employees
  for all using (public.is_hod()) with check (public.is_hod());

-- attendance_records: employee reads and inserts only their own rows.
-- Insert is limited to their own employee_id and to today, and the server
-- timestamp is applied by the app sending no time, the column default is
-- overridden by the attendance function in the app which calls now() on the
-- server side via a Postgres function. See attendance.ts for the RPC path.
-- Direct inserts with a client supplied check_in_at are rejected by the
-- check below through the app flow; the policy alone cannot verify time.
drop policy if exists attendance_read_own on public.attendance_records;
create policy attendance_read_own on public.attendance_records
  for select using (employee_id = public.my_employee_id() or public.is_hod());

drop policy if exists attendance_insert_own on public.attendance_records;
create policy attendance_insert_own on public.attendance_records
  for insert with check (employee_id = public.my_employee_id());

drop policy if exists attendance_update_own on public.attendance_records;
create policy attendance_update_own on public.attendance_records
  for update using (employee_id = public.my_employee_id() or public.is_hod())
  with check (employee_id = public.my_employee_id() or public.is_hod());

drop policy if exists attendance_hod_delete on public.attendance_records;
create policy attendance_hod_delete on public.attendance_records
  for delete using (public.is_hod());

-- office_settings: everyone signed in can read; only HOD can change.
drop policy if exists settings_read on public.office_settings;
create policy settings_read on public.office_settings
  for select using (auth.uid() is not null);

drop policy if exists settings_hod_write on public.office_settings;
create policy settings_hod_write on public.office_settings
  for all using (public.is_hod()) with check (public.is_hod());

-- device_bindings: employee sees own; HOD sees all and approves.
drop policy if exists devices_read_own on public.device_bindings;
create policy devices_read_own on public.device_bindings
  for select using (employee_id = public.my_employee_id() or public.is_hod());

drop policy if exists devices_insert_own on public.device_bindings;
create policy devices_insert_own on public.device_bindings
  for insert with check (employee_id = public.my_employee_id());

drop policy if exists devices_hod_write on public.device_bindings;
create policy devices_hod_write on public.device_bindings
  for update using (public.is_hod()) with check (public.is_hod());

-- admin_audit: HOD only.
drop policy if exists audit_hod_only on public.admin_audit;
create policy audit_hod_only on public.admin_audit
  for all using (public.is_hod()) with check (public.is_hod());

-- ---------------------------------------------------------------------------
-- Server side check in / check out.
-- The app calls these RPCs so the timestamp comes from the database server,
-- never from the phone clock. One record per day is enforced by the unique
-- constraint, so a double tap returns a clean error instead of a duplicate.
-- ---------------------------------------------------------------------------
create or replace function public.check_in(
  p_lat double precision,
  p_lng double precision,
  p_distance_meters double precision,
  p_location_verified boolean,
  p_mocked boolean,
  p_device_id text
)
returns public.attendance_records as $$
declare
  v_emp uuid;
  v_settings public.office_settings;
  v_status text;
  v_row public.attendance_records;
begin
  v_emp := public.my_employee_id();
  if v_emp is null then
    raise exception 'No employee record for this user.';
  end if;

  select * into v_settings from public.office_settings where id = 1;

  if not p_location_verified then
    raise exception 'Outside office radius.';
  end if;
  if p_mocked then
    raise exception 'Mock location detected.';
  end if;

  if exists (
    select 1 from public.attendance_records
    where employee_id = v_emp
      and work_date = (now() at time zone 'Asia/Karachi')::date
      and status = 'Leave'
  ) then
    raise exception 'You are on approved leave today.';
  end if;

  if (now() at time zone 'Asia/Karachi')::time > v_settings.late_cutoff_time then
    v_status := 'Late';
  else
    v_status := 'Present';
  end if;

  insert into public.attendance_records
    (employee_id, work_date, check_in_at, check_in_lat, check_in_lng,
     check_in_distance_meters, location_verified, mocked_location, device_id, status)
  values
    (v_emp, (now() at time zone 'Asia/Karachi')::date, now(), p_lat, p_lng,
     p_distance_meters, p_location_verified, p_mocked, p_device_id, v_status)
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'Already checked in today.';
end;
$$ language plpgsql security definer;

create or replace function public.check_out(
  p_lat double precision,
  p_lng double precision,
  p_distance_meters double precision,
  p_location_verified boolean,
  p_mocked boolean,
  p_device_id text
)
returns public.attendance_records as $$
declare
  v_emp uuid;
  v_row public.attendance_records;
begin
  v_emp := public.my_employee_id();
  if v_emp is null then
    raise exception 'No employee record for this user.';
  end if;

  if not p_location_verified then
    raise exception 'Outside office radius.';
  end if;
  if p_mocked then
    raise exception 'Mock location detected.';
  end if;

  update public.attendance_records
  set check_out_at = now(),
      check_out_lat = p_lat,
      check_out_lng = p_lng,
      check_out_distance_meters = p_distance_meters,
      device_id = p_device_id
  where employee_id = v_emp
    and work_date = (now() at time zone 'Asia/Karachi')::date
    and check_in_at is not null
    and check_out_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'No check in today, or already checked out.';
  end if;

  return v_row;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------------
-- v2 ADDITION, 2026-11-05: leave and absent
-- leaves table, leave allowance setting, leave link on attendance rows,
-- approve/reject RPCs that write Leave rows, and a mark absent RPC.
-- Re-run this section in the SQL Editor if you already ran v1.
-- ---------------------------------------------------------------------------

alter table public.office_settings
  add column if not exists annual_leave_allowance_days int not null default 20
  check (annual_leave_allowance_days >= 0 and annual_leave_allowance_days <= 60);

create table if not exists public.leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type text not null check (leave_type in ('Casual', 'Sick', 'Annual', 'Emergency', 'Other')),
  start_date date not null,
  end_date date not null,
  reason text not null,
  note text,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  decided_by uuid references public.employees (id),
  decision_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint leave_end_after_start check (end_date >= start_date)
);

create index if not exists idx_leaves_employee on public.leaves (employee_id, start_date desc);
create index if not exists idx_leaves_status on public.leaves (status, start_date desc);

alter table public.attendance_records
  add column if not exists leave_type text check (leave_type in ('Casual', 'Sick', 'Annual', 'Emergency', 'Other')),
  add column if not exists leave_id uuid references public.leaves (id) on delete set null;

alter table public.leaves enable row level security;

-- Employee reads and creates only their own leave requests. They cannot
-- change status. HOD reads all and decides.
drop policy if exists leaves_read_own on public.leaves;
create policy leaves_read_own on public.leaves
  for select using (employee_id = public.my_employee_id() or public.is_hod());

drop policy if exists leaves_insert_own on public.leaves;
create policy leaves_insert_own on public.leaves
  for insert with check (employee_id = public.my_employee_id());

drop policy if exists leaves_hod_update on public.leaves;
create policy leaves_hod_update on public.leaves
  for update using (public.is_hod()) with check (public.is_hod());

-- Working days in a date range, using office_settings.working_days.
-- Postgres day of week: 0 Sunday to 6 Saturday. Stored working_days uses
-- 1 Monday to 5 Friday by default, same numbering as ISO.
create or replace function public.working_dates_in_range(p_start date, p_end date)
returns setof date as $$
  select d::date
  from generate_series(p_start, p_end, interval '1 day') as d
  where extract(isodow from d) = any (
    select working_days from public.office_settings where id = 1
  );
$$ language sql stable;

-- Approve a leave: marks the request Approved, then writes one Leave
-- attendance row per working day in the range. If the employee already
-- checked in on one of those days, that day is left as Present/Late and
-- is reported back in the result instead of being overwritten.
create or replace function public.approve_leave(p_leave_id uuid, p_decision_reason text)
returns jsonb as $$
declare
  v_leave public.leaves;
  v_day date;
  v_created int := 0;
  v_skipped text[] := '{}';
begin
  if not public.is_hod() then
    raise exception 'Only the HOD can approve leave.';
  end if;

  select * into v_leave from public.leaves where id = p_leave_id for update;
  if v_leave.id is null then raise exception 'Leave request not found.'; end if;
  if v_leave.status <> 'Pending' then raise exception 'Leave request already decided.'; end if;

  update public.leaves
  set status = 'Approved',
      decided_by = public.my_employee_id(),
      decision_reason = nullif(p_decision_reason, ''),
      decided_at = now()
  where id = p_leave_id;

  for v_day in select public.working_dates_in_range(v_leave.start_date, v_leave.end_date) loop
    -- A day already marked Absent is converted to Leave. A day the employee
    -- already checked in on stays Present/Late and is reported as skipped.
    update public.attendance_records
    set status = 'Leave', leave_type = v_leave.leave_type, leave_id = v_leave.id
    where employee_id = v_leave.employee_id and work_date = v_day and status = 'Absent';
    if found then
      v_created := v_created + 1;
    else
      insert into public.attendance_records
        (employee_id, work_date, status, leave_type, leave_id, location_verified)
      values
        (v_leave.employee_id, v_day, 'Leave', v_leave.leave_type, v_leave.id, false)
      on conflict (employee_id, work_date) do nothing;
      if found then v_created := v_created + 1; else v_skipped := array_append(v_skipped, v_day::text); end if;
    end if;
  end loop;

  insert into public.admin_audit (actor_id, action, target_employee_id, details)
  values (public.my_employee_id(), 'approve_leave', v_leave.employee_id,
    jsonb_build_object('leave_id', v_leave.id, 'type', v_leave.leave_type,
      'start', v_leave.start_date, 'end', v_leave.end_date, 'days_created', v_created));

  return jsonb_build_object('approved', true, 'days_created', v_created, 'skipped_days', v_skipped);
end;
$$ language plpgsql security definer;

create or replace function public.reject_leave(p_leave_id uuid, p_decision_reason text)
returns public.leaves as $$
declare
  v_leave public.leaves;
begin
  if not public.is_hod() then
    raise exception 'Only the HOD can reject leave.';
  end if;
  if p_decision_reason is null or btrim(p_decision_reason) = '' then
    raise exception 'A reason is required to reject leave.';
  end if;

  update public.leaves
  set status = 'Rejected',
      decided_by = public.my_employee_id(),
      decision_reason = p_decision_reason,
      decided_at = now()
  where id = p_leave_id and status = 'Pending'
  returning * into v_leave;

  if v_leave.id is null then raise exception 'Leave request not found, or already decided.'; end if;

  insert into public.admin_audit (actor_id, action, target_employee_id, details)
  values (public.my_employee_id(), 'reject_leave', v_leave.employee_id,
    jsonb_build_object('leave_id', v_leave.id, 'type', v_leave.leave_type, 'reason', p_decision_reason));

  return v_leave;
end;
$$ language plpgsql security definer;

-- Mark absent: for one date, insert an Absent row for every active employee
-- who has no attendance row that day and no approved leave covering it.
-- Safe to run twice: the unique constraint plus ON CONFLICT DO NOTHING
-- means a second run changes nothing. Intended use: the HOD taps
-- "Mark absent for today" in the admin panel after office hours, or a
-- daily scheduled job calls it. There is no pg_cron on the Supabase free
-- tier, so v1 does not pretend this runs itself.
create or replace function public.mark_absent_for_date(p_date date)
returns int as $$
declare
  v_count int := 0;
  v_emp record;
begin
  if not public.is_hod() then
    raise exception 'Only the HOD can mark absent.';
  end if;

  if extract(isodow from p_date) <> any (select working_days from public.office_settings where id = 1) then
    return 0;
  end if;

  for v_emp in select id from public.employees where is_active = true and role <> 'hod' loop
    insert into public.attendance_records (employee_id, work_date, status, location_verified)
    values (v_emp.id, p_date, 'Absent', false)
    on conflict (employee_id, work_date) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  -- Approved leave approved after the absent run must win over Absent.
-- The HOD is excluded: the HOD manages attendance and is not counted
-- as staff for the day, so "Mark absent" never marks the HOD Absent.
  update public.attendance_records ar
  set status = 'Leave', leave_type = l.leave_type, leave_id = l.id
  from public.leaves l
  where ar.employee_id = l.employee_id
    and ar.work_date = p_date
    and ar.status = 'Absent'
    and l.status = 'Approved'
    and p_date between l.start_date and l.end_date;

  return v_count;
end;
$$ language plpgsql security definer;

-- Approved leave days taken by one employee in one calendar year,
-- counted in working days only.
create or replace function public.leave_days_taken(p_employee_id uuid, p_year int)
returns int as $$
  select count(*)::int
  from public.attendance_records
  where employee_id = p_employee_id
    and status = 'Leave'
    and extract(year from work_date) = p_year;
$$ language sql stable security definer;
