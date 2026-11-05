import { supabase, type LeaveRequest, type LeaveType } from './supabase';

export async function loadMyLeaves(employeeId: string): Promise<LeaveRequest[]> {
  const { data, error } = await supabase
    .from('leaves')
    .select('*')
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false })
    .limit(30);
  if (error) throw new Error('Could not load your leave requests.');
  return (data as LeaveRequest[]) ?? [];
}

export async function loadLeaveBalance(employeeId: string): Promise<{ allowance: number; taken: number; remaining: number }> {
  const year = new Date().getFullYear();
  const [settingsRes, takenRes] = await Promise.all([
    supabase.from('office_settings').select('annual_leave_allowance_days').eq('id', 1).single(),
    supabase.rpc('leave_days_taken', { p_employee_id: employeeId, p_year: year }),
  ]);
  const allowance = (settingsRes.data as { annual_leave_allowance_days?: number } | null)?.annual_leave_allowance_days ?? 20;
  const taken = typeof takenRes.data === 'number' ? takenRes.data : 0;
  return { allowance, taken, remaining: Math.max(0, allowance - taken) };
}

export type ApplyLeaveResult = { ok: boolean; message: string };

export async function applyLeave(
  employeeId: string,
  input: { leaveType: LeaveType; startDate: string; endDate: string; reason: string; note: string },
): Promise<ApplyLeaveResult> {
  if (!input.reason.trim()) return { ok: false, message: 'Please write a reason for the leave.' };
  // Dates must be real calendar dates in YYYY-MM-DD form. Without this check
  // a typo such as 2026-02-30 would be stored and break the report.
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(input.startDate) || !datePattern.test(input.endDate)) {
    return { ok: false, message: 'Dates must be in YYYY-MM-DD form, for example 2026-11-10.' };
  }
  const startValid = !Number.isNaN(Date.parse(`${input.startDate}T00:00:00`)) &&
    new Date(`${input.startDate}T00:00:00`).toISOString().slice(0, 10) === input.startDate;
  const endValid = !Number.isNaN(Date.parse(`${input.endDate}T00:00:00`)) &&
    new Date(`${input.endDate}T00:00:00`).toISOString().slice(0, 10) === input.endDate;
  if (!startValid || !endValid) {
    return { ok: false, message: 'That date does not exist. Check the day and month and try again.' };
  }
  if (input.endDate < input.startDate) return { ok: false, message: 'End date cannot be before the start date.' };
  if (input.startDate < new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })) {
    return { ok: false, message: 'Leave start date cannot be in the past. For a past absence, speak to the Head of Department.' };
  }

  // Refuse an overlapping request that is still pending or already approved.
  const { data: overlap } = await supabase
    .from('leaves')
    .select('id')
    .eq('employee_id', employeeId)
    .in('status', ['Pending', 'Approved'])
    .lte('start_date', input.endDate)
    .gte('end_date', input.startDate)
    .limit(1);
  if (overlap && overlap.length > 0) {
    return { ok: false, message: 'You already have a pending or approved leave covering those dates.' };
  }

  const { error } = await supabase.from('leaves').insert({
    employee_id: employeeId,
    leave_type: input.leaveType,
    start_date: input.startDate,
    end_date: input.endDate,
    reason: input.reason.trim(),
    note: input.note.trim() || null,
    status: 'Pending',
  });
  if (error) return { ok: false, message: 'Could not submit the leave request. Check your connection and try again.' };
  return { ok: true, message: 'Leave request sent to the Head of Department. You will see the decision here.' };
}
