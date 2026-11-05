import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

// True only when a real Supabase project is configured. The demo values
// shipped with the APK (demo.supabase.co) and the .env.example placeholder
// do not count. The client is still created with safe fallback values so
// importing this file never crashes the app; screens check this flag
// before calling sign in and show a human message instead.
export const isSupabaseConfigured =
  Boolean(rawUrl) &&
  Boolean(rawKey) &&
  !rawUrl!.includes('demo.supabase.co') &&
  !rawUrl!.includes('your-project');

const supabaseUrl = isSupabaseConfigured ? rawUrl! : 'https://demo.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawKey! : 'demo-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Names shown in the app never carry test or seed tags. The seed data
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
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export type LeaveRequest = {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  note: string | null;
  status: LeaveStatus;
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
};

export const LEAVE_TYPES: LeaveType[] = ['Casual', 'Sick', 'Annual', 'Emergency', 'Other'];

// Working days between two dates, Monday to Friday. Used for the leave
// day count shown before submitting, so the employee sees real days, not
// calendar days including weekends.
export function workingDaysBetween(startDate: string, endDate: string): number {
  let count = 0;
  const day = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (day <= end) {
    const dow = day.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    day.setDate(day.getDate() + 1);
  }
  return count;
}

export type AttendanceRecord = {
  id: string;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: 'Present' | 'Late' | 'Absent' | 'Leave';
  total_hours: number | null;
  location_verified: boolean;
  check_in_distance_meters: number | null;
  leave_type: LeaveType | null;
};
