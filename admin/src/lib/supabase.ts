import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.');
}

export const supabase = createClient(url, anonKey);

// Names shown in the panel never carry test or seed tags. The seed data
// stores names with a (DEMO) tag, but the UI strips it, and a HOD record
// shows as Head of Department instead of its stored test name.
export function displayName(fullName: string): string {
  const clean = fullName.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
  if (/^demo\b/i.test(clean) || clean.toLowerCase() === 'demo hod') return 'Head of Department';
  return clean || 'Staff';
}

export type Employee = {
  id: string;
  employee_id: string;
  full_name: string;
  designation: string;
  email: string;
  phone: string | null;
  role: 'hod' | 'employee';
  is_active: boolean;
};

export type OfficeSettings = {
  id: number;
  office_name: string;
  office_lat: number;
  office_lng: number;
  radius_meters: number;
  office_start_time: string;
  office_end_time: string;
  late_cutoff_time: string;
  working_days: number[];
  annual_leave_allowance_days: number;
};

export type LeaveType = 'Casual' | 'Sick' | 'Annual' | 'Emergency' | 'Other';

export type LeaveRequest = {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  note: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
  employees?: { full_name: string; employee_id: string; designation: string };
};

export type AttendanceRow = {
  id: string;
  employee_id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  total_hours: number | null;
  location_verified: boolean;
  mocked_location: boolean;
  check_in_distance_meters: number | null;
  leave_type: LeaveType | null;
  employees?: { full_name: string; employee_id: string; designation: string };
};

export function todayPK(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

export function formatTimePK(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('en-PK', {
    timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatDatePK(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PK', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
