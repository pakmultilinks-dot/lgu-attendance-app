// Demo mode for the LGU Attendance mobile app.
//
// The user installed the APK and was stuck on the Staff sign in screen
// because no live Supabase project exists yet, so no real login works.
// Demo mode lets him get inside the app on his phone with one tap, no
// account, no password, no network, no Supabase call at all.
//
// What demo mode is: Ahmed Khan, EX-001, Assistant (Examinations), with
// the seed attendance rows for 2 to 4 Nov 2026 already in the app. Today
// starts unchecked on purpose, so the user can actually try Check In.
// What demo mode is not: nothing here is sent to any server, nothing is
// synced to the office, and the HOD never sees demo data. Demo records
// and demo leave requests live only in AsyncStorage on this phone.
// Once the live Supabase project is connected, the user signs in with
// the real account and demo data is left behind, never merged.
//
// Demo test mode: a demo-only switch on the Today screen that skips the
// GPS distance check so the user can test fingerprint check in from
// home. It never touches real sign in: the live flow in
// mobile/src/lib/attendance.ts has no test mode parameter and always
// runs the 100 m check. Test mode records are marked honestly with
// location_verified false and no distance, and the success message says
// the GPS check was skipped. The fingerprint prompt still runs in test
// mode, and a failed or missing sensor still writes nothing.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AttendanceRecord, Employee, LeaveRequest, LeaveType, OfficeSettings } from './supabase';
import { workingDaysBetween } from './supabase';
import { checkOfficeLocation } from './location';
import { authenticateEmployee } from './biometric';
import type { AttendanceActionResult } from './attendance';

export const DEMO_STORAGE_KEY = 'lgu_demo_state_v1';
export const DEMO_SESSION_KEY = 'lgu_demo_active_v1';
export const DEMO_TEST_MODE_KEY = 'lgu_demo_test_mode_v1';

// Demo test mode is stored separately from demo attendance data, and it
// defaults to OFF. It is only ever read by the demo flow; the live flow
// never reads this key.
export async function isDemoTestModeEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DEMO_TEST_MODE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setDemoTestModeEnabled(enabled: boolean): Promise<void> {
  try {
    if (enabled) await AsyncStorage.setItem(DEMO_TEST_MODE_KEY, '1');
    else await AsyncStorage.removeItem(DEMO_TEST_MODE_KEY);
  } catch {
    // A failed write just leaves the switch where it was.
  }
}

export const DEMO_EMPLOYEE: Employee = {
  id: 'demo-employee-ahmed',
  employee_id: 'EX-001',
  full_name: 'Ahmed Khan',
  designation: 'Assistant (Examinations)',
  email: 'ahmed.khan@lgu.edu.pk',
  phone: '+92 300 0000001',
  role: 'employee',
  is_active: true,
};

export const DEMO_SETTINGS: OfficeSettings = {
  office_name: 'Examination Department, Lahore Garrison University',
  office_lat: 31.464,
  office_lng: 74.4427,
  radius_meters: 100,
  office_start_time: '09:00',
  office_end_time: '17:00',
  late_cutoff_time: '09:15',
  working_days: [1, 2, 3, 4, 5],
  annual_leave_allowance_days: 20,
};

export type DemoState = {
  records: AttendanceRecord[];
  leaves: LeaveRequest[];
};

function seedRecords(): AttendanceRecord[] {
  // Seed rows from supabase/seed.sql for Ahmed Khan, 2 to 4 Nov 2026.
  // The 5 Nov seed row is deliberately not included: today starts
  // unchecked so the demo user can try Check In. The 6 Nov row is a
  // future day in the seed week, also not included.
  return [
    {
      id: 'demo-record-2026-11-04',
      work_date: '2026-11-04',
      check_in_at: '2026-11-04T09:22:00+05:00',
      check_out_at: '2026-11-04T17:05:00+05:00',
      status: 'Late',
      total_hours: 7.72,
      location_verified: true,
      check_in_distance_meters: 25,
      leave_type: null,
    },
    {
      id: 'demo-record-2026-11-03',
      work_date: '2026-11-03',
      check_in_at: '2026-11-03T09:02:00+05:00',
      check_out_at: '2026-11-03T17:00:00+05:00',
      status: 'Present',
      total_hours: 7.97,
      location_verified: true,
      check_in_distance_meters: 18,
      leave_type: null,
    },
    {
      id: 'demo-record-2026-11-02',
      work_date: '2026-11-02',
      check_in_at: '2026-11-02T09:05:00+05:00',
      check_out_at: '2026-11-02T17:02:00+05:00',
      status: 'Present',
      total_hours: 7.95,
      location_verified: true,
      check_in_distance_meters: 12,
      leave_type: null,
    },
  ];
}

export function seedDemoState(): DemoState {
  return { records: seedRecords(), leaves: [] };
}

export async function loadDemoState(): Promise<DemoState> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) {
      const fresh = seedDemoState();
      await AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as DemoState;
    if (!Array.isArray(parsed.records) || !Array.isArray(parsed.leaves)) {
      const fresh = seedDemoState();
      await AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
    return parsed;
  } catch {
    return seedDemoState();
  }
}

export async function saveDemoState(state: DemoState): Promise<void> {
  await AsyncStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

export async function isDemoSessionActive(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DEMO_SESSION_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setDemoSessionActive(active: boolean): Promise<void> {
  if (active) await AsyncStorage.setItem(DEMO_SESSION_KEY, '1');
  else await AsyncStorage.removeItem(DEMO_SESSION_KEY);
}

export function todayPKT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

function nowTimePKT(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function nowIsoPKT(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+05:00`;
}

function totalHoursBetween(checkInIso: string, checkOutIso: string): number {
  const start = new Date(checkInIso).getTime();
  const end = new Date(checkOutIso).getTime();
  return Math.round(((end - start) / 3600000) * 100) / 100;
}

export async function demoLoadTodayRecord(): Promise<AttendanceRecord | null> {
  const state = await loadDemoState();
  const today = todayPKT();
  return state.records.find((r) => r.work_date === today) ?? null;
}

export async function demoLoadHistory(limit = 90): Promise<AttendanceRecord[]> {
  const state = await loadDemoState();
  const sorted = [...state.records].sort((a, b) => (a.work_date < b.work_date ? 1 : -1));
  return sorted.slice(0, limit);
}

export async function demoLoadMyLeaves(): Promise<LeaveRequest[]> {
  const state = await loadDemoState();
  return [...state.leaves].sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
}

export async function demoLoadLeaveBalance(): Promise<{ allowance: number; taken: number; remaining: number }> {
  const state = await loadDemoState();
  let taken = 0;
  for (const leave of state.leaves) {
    if (leave.status !== 'Approved') continue;
    taken += workingDaysBetween(leave.start_date, leave.end_date);
  }
  const allowance = DEMO_SETTINGS.annual_leave_allowance_days;
  return { allowance, taken, remaining: Math.max(0, allowance - taken) };
}

export type DemoLeaveResult = { ok: boolean; message: string };

export async function demoApplyLeave(input: {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  note: string;
}): Promise<DemoLeaveResult> {
  if (!input.reason.trim()) return { ok: false, message: 'Please write a reason for the leave.' };
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(input.startDate) || !datePattern.test(input.endDate)) {
    return { ok: false, message: 'Dates must be in YYYY-MM-DD form, for example 2026-11-10.' };
  }
  const startValid =
    !Number.isNaN(Date.parse(`${input.startDate}T00:00:00`)) &&
    new Date(`${input.startDate}T00:00:00`).toISOString().slice(0, 10) === input.startDate;
  const endValid =
    !Number.isNaN(Date.parse(`${input.endDate}T00:00:00`)) &&
    new Date(`${input.endDate}T00:00:00`).toISOString().slice(0, 10) === input.endDate;
  if (!startValid || !endValid) {
    return { ok: false, message: 'That date does not exist. Check the day and month and try again.' };
  }
  if (input.endDate < input.startDate) return { ok: false, message: 'End date cannot be before the start date.' };
  if (input.startDate < todayPKT()) {
    return { ok: false, message: 'Leave start date cannot be in the past. For a past absence, speak to the Head of Department.' };
  }
  const state = await loadDemoState();
  const overlap = state.leaves.some(
    (l) =>
      (l.status === 'Pending' || l.status === 'Approved') &&
      l.start_date <= input.endDate &&
      l.end_date >= input.startDate,
  );
  if (overlap) {
    return { ok: false, message: 'You already have a pending or approved leave covering those dates.' };
  }
  const now = new Date().toISOString();
  state.leaves.push({
    id: `demo-leave-${Date.now()}`,
    employee_id: DEMO_EMPLOYEE.id,
    leave_type: input.leaveType,
    start_date: input.startDate,
    end_date: input.endDate,
    reason: input.reason.trim(),
    note: input.note.trim() || null,
    status: 'Pending',
    decision_reason: null,
    created_at: now,
    decided_at: null,
  });
  await saveDemoState(state);
  return { ok: true, message: 'Leave request saved on this phone as a demo. In demo mode there is no Head of Department to approve it, it stays Pending.' };
}

// Demo check in, same order as the live flow: GPS radius first, then
// fingerprint, then write the record locally. Nothing is faked: if the
// phone has no fingerprint sensor, authenticateEmployee refuses and no
// record is written. If GPS is outside the radius, it refuses too.
// The only exception is demo test mode (opts.testMode true): the GPS
// step is skipped entirely, no location is read at all, but the
// fingerprint step still runs and the record is marked
// location_verified false with no distance, so a test check in can
// never pass as an office check in.
export async function demoCheckIn(
  settings: OfficeSettings,
  opts?: { testMode?: boolean },
): Promise<AttendanceActionResult> {
  const testMode = opts?.testMode === true;
  const location = testMode ? null : await checkOfficeLocation(settings);
  if (!testMode && location && !location.ok) return { ok: false, message: location.message };
  const bio = await authenticateEmployee();
  if (!bio.ok) return { ok: false, message: bio.message };
  const state = await loadDemoState();
  const today = todayPKT();
  const existing = state.records.find((r) => r.work_date === today);
  if (existing && existing.status === 'Leave') {
    return { ok: false, message: 'You are on approved leave today.' };
  }
  if (existing) return { ok: false, message: 'You already checked in today.' };
  const time = nowTimePKT();
  const status = time > settings.late_cutoff_time ? 'Late' : 'Present';
  const record: AttendanceRecord = {
    id: `demo-record-${today}`,
    work_date: today,
    check_in_at: nowIsoPKT(),
    check_out_at: null,
    status,
    total_hours: null,
    location_verified: testMode ? false : true,
    check_in_distance_meters: testMode ? null : (location?.distanceMeters ?? null),
    leave_type: null,
  };
  state.records.unshift(record);
  await saveDemoState(state);
  return {
    ok: true,
    message: testMode
      ? 'Checked in. Test mode, GPS check skipped, fingerprint verified on this phone. Demo only, nothing sent to the office.'
      : 'Checked in. Have a good day. Demo only, nothing sent to the office.',
    record,
  };
}

export async function demoCheckOut(
  settings: OfficeSettings,
  opts?: { testMode?: boolean },
): Promise<AttendanceActionResult> {
  const testMode = opts?.testMode === true;
  const location = testMode ? null : await checkOfficeLocation(settings);
  if (!testMode && location && !location.ok) return { ok: false, message: location.message };
  const bio = await authenticateEmployee();
  if (!bio.ok) return { ok: false, message: bio.message };
  const state = await loadDemoState();
  const today = todayPKT();
  const record = state.records.find((r) => r.work_date === today);
  if (!record || !record.check_in_at || record.check_out_at) {
    return { ok: false, message: 'Check in first, then check out.' };
  }
  record.check_out_at = nowIsoPKT();
  record.total_hours = totalHoursBetween(record.check_in_at, record.check_out_at);
  await saveDemoState(state);
  return {
    ok: true,
    message: testMode
      ? 'Checked out. Test mode, GPS check skipped, fingerprint verified on this phone. Demo only, nothing sent to the office.'
      : 'Checked out. See you tomorrow. Demo only, nothing sent to the office.',
    record,
  };
}
