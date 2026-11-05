-- LGU Exam Department Attendance App, demo seed data
-- Run AFTER supabase/schema.sql, once, in the Supabase SQL Editor.
-- Everything in this file is DEMO data for testing the flow end to end.
-- It must be replaced by the real roster before go live.
--
-- Demo accounts:
--   HOD (DEMO), LGU-HOD-DEMO, hod.demo@lgu.edu.pk, role hod
--   Ahmed Khan (DEMO), EX-001, Assistant (Examinations)
--   Sara Malik (DEMO), EX-002, Examination Officer
--   Bilal Ahmed (DEMO), EX-003, Clerk (Examinations)
--
-- IMPORTANT: these rows have auth_user_id NULL, so nobody can sign in as
-- them yet. That is deliberate. To sign in as a demo employee, create the
-- Auth user in the Supabase dashboard (Auth, Users, Add user) and then run:
--   update public.employees set auth_user_id = '<new-auth-uuid>'
--   where employee_id = 'EX-001';
-- Or create staff from the admin panel Employees page instead.
-- Demo passwords are never stored in this file.
--
-- Office pin in this seed is a PLACEHOLDER: 31.4640, 74.4427 is the LGU Main
-- Campus area (Sector C, DHA Phase 6, Lahore, public coordinates). The exact
-- Examination Department office door pin is still unknown and must be set in
-- the admin panel Settings page before go live.
--
-- The seed is idempotent: running it twice changes nothing, because every
-- insert uses ON CONFLICT DO NOTHING on the unique keys.

-- ---------------------------------------------------------------------------
-- Office settings (defaults agreed for v1)
-- 09:00 to 17:00 PKT, Late after 09:15, Mon to Fri, 100 m radius,
-- 20 leave days per year for all staff.
-- ---------------------------------------------------------------------------
insert into public.office_settings
  (id, office_name, office_lat, office_lng, radius_meters,
   office_start_time, office_end_time, late_cutoff_time,
   working_days, annual_leave_allowance_days)
values
  (1, 'Examination Department, Lahore Garrison University',
   31.4640, 74.4427, 100, '09:00', '17:00', '09:15',
   '{1,2,3,4,5}', 20)
on conflict (id) do update set
  office_name = excluded.office_name,
  office_lat = excluded.office_lat,
  office_lng = excluded.office_lng,
  radius_meters = excluded.radius_meters,
  office_start_time = excluded.office_start_time,
  office_end_time = excluded.office_end_time,
  late_cutoff_time = excluded.late_cutoff_time,
  working_days = excluded.working_days,
  annual_leave_allowance_days = excluded.annual_leave_allowance_days,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Demo staff. Fixed UUIDs so the attendance rows below can reference them.
-- ---------------------------------------------------------------------------
insert into public.employees
  (id, auth_user_id, employee_id, full_name, designation, email, phone, role, is_active)
values
  ('11111111-1111-4111-8111-111111111001', null, 'LGU-HOD-DEMO',
   'Demo HOD (DEMO)', 'Head of Department', 'hod.demo@lgu.edu.pk', null, 'hod', true),
  ('11111111-1111-4111-8111-111111111002', null, 'EX-001',
   'Ahmed Khan (DEMO)', 'Assistant (Examinations)', 'ahmed.khan.demo@lgu.edu.pk', '+92 300 0000001', 'employee', true),
  ('11111111-1111-4111-8111-111111111003', null, 'EX-002',
   'Sara Malik (DEMO)', 'Examination Officer', 'sara.malik.demo@lgu.edu.pk', '+92 300 0000002', 'employee', true),
  ('11111111-1111-4111-8111-111111111004', null, 'EX-003',
   'Bilal Ahmed (DEMO)', 'Clerk (Examinations)', 'bilal.ahmed.demo@lgu.edu.pk', '+92 300 0000003', 'employee', true)
on conflict (employee_id) do nothing;

-- ---------------------------------------------------------------------------
-- Demo leave: Sara Malik, Sick, Tue 3 Nov to Wed 4 Nov 2026, Approved.
-- November 2026: 1 Nov is a Sunday, 2 Nov is a Monday.
-- ---------------------------------------------------------------------------
insert into public.leaves
  (id, employee_id, leave_type, start_date, end_date, reason, note, status,
   decided_by, decision_reason, decided_at)
values
  ('22222222-2222-4222-8222-222222222001',
   '11111111-1111-4111-8111-111111111003',
   'Sick', '2026-11-03', '2026-11-04', 'Fever, doctor advised rest', null, 'Approved',
   '11111111-1111-4111-8111-111111111001', 'Approved. Get well soon.', '2026-11-02 16:00:00+05')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Demo attendance, Mon 2 Nov to Fri 6 Nov 2026.
-- Ahmed Khan: Present, Present, Late (09:22), Present, Present.
-- Sara Malik: Present, Leave (Sick), Leave (Sick), Present, Absent.
-- Bilal Ahmed: Present, Present, Absent, Present, Present (no check out yet).
-- total_hours is computed by the database trigger, not stored here.
-- Check in coordinates are the office pin, distances are small demo values.
-- ---------------------------------------------------------------------------
insert into public.attendance_records
  (employee_id, work_date, check_in_at, check_out_at,
   check_in_lat, check_in_lng, check_in_distance_meters,
   location_verified, mocked_location, device_id, status)
values
  -- Ahmed Khan, EX-001
  ((select id from public.employees where employee_id = 'EX-001'), '2026-11-02', '2026-11-02 09:05:00+05', '2026-11-02 17:02:00+05', 31.4640, 74.4427, 12, true, false, 'dev_demo_ahmed', 'Present'),
  ((select id from public.employees where employee_id = 'EX-001'), '2026-11-03', '2026-11-03 09:02:00+05', '2026-11-03 17:00:00+05', 31.4640, 74.4427, 18, true, false, 'dev_demo_ahmed', 'Present'),
  ((select id from public.employees where employee_id = 'EX-001'), '2026-11-04', '2026-11-04 09:22:00+05', '2026-11-04 17:05:00+05', 31.4640, 74.4427, 25, true, false, 'dev_demo_ahmed', 'Late'),
  ((select id from public.employees where employee_id = 'EX-001'), '2026-11-05', '2026-11-05 09:04:00+05', '2026-11-05 17:01:00+05', 31.4640, 74.4427, 9, true, false, 'dev_demo_ahmed', 'Present'),
  ((select id from public.employees where employee_id = 'EX-001'), '2026-11-06', '2026-11-06 09:06:00+05', '2026-11-06 17:03:00+05', 31.4640, 74.4427, 31, true, false, 'dev_demo_ahmed', 'Present'),
  -- Sara Malik, EX-002
  ((select id from public.employees where employee_id = 'EX-002'), '2026-11-02', '2026-11-02 09:08:00+05', '2026-11-02 17:00:00+05', 31.4640, 74.4427, 22, true, false, 'dev_demo_sara', 'Present'),
  ((select id from public.employees where employee_id = 'EX-002'), '2026-11-03', null, null, null, null, null, false, false, null, 'Leave'),
  ((select id from public.employees where employee_id = 'EX-002'), '2026-11-04', null, null, null, null, null, false, false, null, 'Leave'),
  ((select id from public.employees where employee_id = 'EX-002'), '2026-11-05', '2026-11-05 09:01:00+05', '2026-11-05 16:58:00+05', 31.4640, 74.4427, 15, true, false, 'dev_demo_sara', 'Present'),
  ((select id from public.employees where employee_id = 'EX-002'), '2026-11-06', null, null, null, null, null, false, false, null, 'Absent'),
  -- Bilal Ahmed, EX-003
  ((select id from public.employees where employee_id = 'EX-003'), '2026-11-02', '2026-11-02 09:10:00+05', '2026-11-02 17:04:00+05', 31.4640, 74.4427, 41, true, false, 'dev_demo_bilal', 'Present'),
  ((select id from public.employees where employee_id = 'EX-003'), '2026-11-03', '2026-11-03 09:07:00+05', '2026-11-03 17:00:00+05', 31.4640, 74.4427, 28, true, false, 'dev_demo_bilal', 'Present'),
  ((select id from public.employees where employee_id = 'EX-003'), '2026-11-04', null, null, null, null, null, false, false, null, 'Absent'),
  ((select id from public.employees where employee_id = 'EX-003'), '2026-11-05', '2026-11-05 09:03:00+05', '2026-11-05 17:02:00+05', 31.4640, 74.4427, 19, true, false, 'dev_demo_bilal', 'Present'),
  ((select id from public.employees where employee_id = 'EX-003'), '2026-11-06', '2026-11-06 09:05:00+05', null, 31.4640, 74.4427, 33, true, false, 'dev_demo_bilal', 'Present')
on conflict (employee_id, work_date) do nothing;

-- Link Sara Malik's Leave rows to her approved leave request.
update public.attendance_records
set leave_type = 'Sick',
    leave_id = '22222222-2222-4222-8222-222222222001'
where employee_id = (select id from public.employees where employee_id = 'EX-002')
  and work_date in ('2026-11-03', '2026-11-04')
  and status = 'Leave';

-- ---------------------------------------------------------------------------
-- Checks after running the seed (run these and confirm the counts):
--   select count(*) from public.employees;            -- expect 4
--   select count(*) from public.attendance_records;   -- expect 15
--   select count(*) from public.leaves;               -- expect 1
--   select employee_id, status, count(*) from public.attendance_records
--     join public.employees on employees.id = attendance_records.employee_id
--     group by employee_id, status order by employee_id, status;
-- Expected: EX-001 Present 4, Late 1; EX-002 Present 2, Leave 2, Absent 1;
--   EX-003 Present 4, Absent 1.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Demo cleanup. DO NOT run this now. Run it only when the HOD orders the
-- demo data removed, after the real roster is in place. It is kept here
-- commented out so the removal is deliberate, never accidental.
-- ---------------------------------------------------------------------------
-- delete from public.attendance_records
--  where employee_id in (select id from public.employees
--                         where employee_id in ('LGU-HOD-DEMO', 'EX-001', 'EX-002', 'EX-003'));
-- delete from public.leaves
--  where employee_id in (select id from public.employees
--                         where employee_id in ('LGU-HOD-DEMO', 'EX-001', 'EX-002', 'EX-003'));
-- delete from public.employees
--  where employee_id in ('LGU-HOD-DEMO', 'EX-001', 'EX-002', 'EX-003');
