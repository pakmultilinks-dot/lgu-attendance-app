import { supabase, type AttendanceRecord, type OfficeSettings } from './supabase';
import { checkOfficeLocation } from './location';
import { authenticateEmployee } from './biometric';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_KEY = 'lgu_device_id';

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const fresh = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_KEY, fresh);
  return fresh;
}

export async function loadOfficeSettings(): Promise<OfficeSettings> {
  const { data, error } = await supabase
    .from('office_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error || !data) throw new Error('Could not load office settings. Check your connection.');
  return data as OfficeSettings;
}

export async function loadTodayRecord(employeeId: string): Promise<AttendanceRecord | null> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('work_date', today)
    .maybeSingle();
  if (error) throw new Error('Could not load today attendance.');
  return (data as AttendanceRecord | null) ?? null;
}

export async function loadHistory(employeeId: string, limit = 31): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', employeeId)
    .order('work_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error('Could not load attendance history.');
  return (data as AttendanceRecord[]) ?? [];
}

export type AttendanceActionResult = {
  ok: boolean;
  message: string;
  record?: AttendanceRecord;
};

// Full check in flow, in order: GPS radius, then fingerprint, then server
// timestamp via the check_in RPC. Any step failing stops the flow.
export async function doCheckIn(settings: OfficeSettings): Promise<AttendanceActionResult> {
  const location = await checkOfficeLocation(settings);
  if (!location.ok) return { ok: false, message: location.message };

  const bio = await authenticateEmployee();
  if (!bio.ok) return { ok: false, message: bio.message };

  const device = await getOrCreateDeviceId();
  const { data, error } = await supabase.rpc('check_in', {
    p_lat: location.lat,
    p_lng: location.lng,
    p_distance_meters: location.distanceMeters,
    p_location_verified: true,
    p_mocked: false,
    p_device_id: device,
  });

  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true, message: 'Checked in. Have a good day.', record: data as AttendanceRecord };
}

export async function doCheckOut(settings: OfficeSettings): Promise<AttendanceActionResult> {
  const location = await checkOfficeLocation(settings);
  if (!location.ok) return { ok: false, message: location.message };

  const bio = await authenticateEmployee();
  if (!bio.ok) return { ok: false, message: bio.message };

  const device = await getOrCreateDeviceId();
  const { data, error } = await supabase.rpc('check_out', {
    p_lat: location.lat,
    p_lng: location.lng,
    p_distance_meters: location.distanceMeters,
    p_location_verified: true,
    p_mocked: false,
    p_device_id: device,
  });

  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true, message: 'Checked out. See you tomorrow.', record: data as AttendanceRecord };
}

function friendlyError(message: string): string {
  if (message.includes('Already checked in')) return 'You already checked in today.';
  if (message.includes('No check in today')) return 'Check in first, then check out.';
  if (message.includes('already checked out')) return 'You already checked out today.';
  if (message.includes('Outside office radius')) return 'You are outside the office radius.';
  if (message.includes('Mock location')) return 'Mock location detected. Turn off any fake GPS app.';
  return message;
}

export function formatTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('en-PK', {
    timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PK', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
