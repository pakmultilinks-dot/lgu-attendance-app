// Excel report builder tests. Run with:
//   VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_ANON_KEY=demo-key \
//     npx vitest run src/lib/excel.test.ts
// The dummy env values only stop supabase.ts throwing at import time. No
// network call is made: these tests exercise buildReportRows and
// buildSummary on the demo seed data for November 2026.
import { describe, expect, it } from 'vitest';
import { buildReportRows, buildSummary } from './excel';
import type { AttendanceRow, Employee, LeaveRequest } from './supabase';

const employees: Employee[] = [
  { id: 'emp-ahmed', employee_id: 'EX-001', full_name: 'Ahmed Khan (DEMO)', designation: 'Assistant (Examinations)', email: 'ahmed.khan.demo@lgu.edu.pk', phone: null, role: 'employee', is_active: true },
  { id: 'emp-sara', employee_id: 'EX-002', full_name: 'Sara Malik (DEMO)', designation: 'Examination Officer', email: 'sara.malik.demo@lgu.edu.pk', phone: null, role: 'employee', is_active: true },
  { id: 'emp-bilal', employee_id: 'EX-003', full_name: 'Bilal Ahmed (DEMO)', designation: 'Clerk (Examinations)', email: 'bilal.ahmed.demo@lgu.edu.pk', phone: null, role: 'employee', is_active: true },
];

function row(employeeId: string, workDate: string, checkIn: string | null, checkOut: string | null, status: string, totalHours: number | null, leaveType: LeaveRequest['leave_type'] | null = null): AttendanceRow {
  return {
    id: `${employeeId}-${workDate}`, employee_id: employeeId, work_date: workDate,
    check_in_at: checkIn, check_out_at: checkOut, status, total_hours: totalHours,
    location_verified: status !== 'Absent' && status !== 'Leave',
    mocked_location: false, check_in_distance_meters: 15, leave_type: leaveType,
  };
}

// Seed week, 2 to 6 Nov 2026, exactly as in supabase/seed.sql.
const records: AttendanceRow[] = [
  row('emp-ahmed', '2026-11-02', '2026-11-02T09:05:00+05:00', '2026-11-02T17:02:00+05:00', 'Present', 7.95),
  row('emp-ahmed', '2026-11-03', '2026-11-03T09:02:00+05:00', '2026-11-03T17:00:00+05:00', 'Present', 7.97),
  row('emp-ahmed', '2026-11-04', '2026-11-04T09:22:00+05:00', '2026-11-04T17:05:00+05:00', 'Late', 7.72),
  row('emp-ahmed', '2026-11-05', '2026-11-05T09:04:00+05:00', '2026-11-05T17:01:00+05:00', 'Present', 7.95),
  row('emp-ahmed', '2026-11-06', '2026-11-06T09:06:00+05:00', '2026-11-06T17:03:00+05:00', 'Present', 7.95),
  row('emp-sara', '2026-11-02', '2026-11-02T09:08:00+05:00', '2026-11-02T17:00:00+05:00', 'Present', 7.87),
  row('emp-sara', '2026-11-03', null, null, 'Leave', null, 'Sick'),
  row('emp-sara', '2026-11-04', null, null, 'Leave', null, 'Sick'),
  row('emp-sara', '2026-11-05', '2026-11-05T09:01:00+05:00', '2026-11-05T16:58:00+05:00', 'Present', 7.95),
  row('emp-sara', '2026-11-06', null, null, 'Absent', null),
  row('emp-bilal', '2026-11-02', '2026-11-02T09:10:00+05:00', '2026-11-02T17:04:00+05:00', 'Present', 7.9),
  row('emp-bilal', '2026-11-03', '2026-11-03T09:07:00+05:00', '2026-11-03T17:00:00+05:00', 'Present', 7.88),
  row('emp-bilal', '2026-11-04', null, null, 'Absent', null),
  row('emp-bilal', '2026-11-05', '2026-11-05T09:03:00+05:00', '2026-11-05T17:02:00+05:00', 'Present', 7.98),
  row('emp-bilal', '2026-11-06', '2026-11-06T09:05:00+05:00', null, 'Present', null),
];

const leaves: LeaveRequest[] = [
  {
    id: 'leave-sara-1', employee_id: 'emp-sara', leave_type: 'Sick',
    start_date: '2026-11-03', end_date: '2026-11-04', reason: 'Fever, doctor advised rest',
    note: null, status: 'Approved', decision_reason: 'Approved. Get well soon.',
    created_at: '2026-11-02T10:00:00+05:00', decided_at: '2026-11-02T16:00:00+05:00',
  },
];

describe('buildReportRows, November 2026', () => {
  it('builds one row per employee per working day, weekends excluded', () => {
    const rows = buildReportRows(employees, records, 2026, 11, leaves);
    // November 2026 has 21 working days (Mon to Fri). 3 employees x 21 = 63.
    expect(rows).toHaveLength(63);
    expect(rows.some((r) => r.date === '2026-11-07')).toBe(false);
    expect(rows.some((r) => r.date === '2026-11-08')).toBe(false);
    expect(rows.some((r) => r.date === '2026-11-01')).toBe(false);
  });

  it('keeps the seed week statuses exactly', () => {
    const rows = buildReportRows(employees, records, 2026, 11, leaves);
    const find = (emp: string, date: string) => rows.find((r) => r.employeeId === emp && r.date === date)!;
    expect(find('EX-001', '2026-11-04').status).toBe('Late');
    expect(find('EX-002', '2026-11-03').status).toBe('Leave');
    expect(find('EX-002', '2026-11-03').leaveType).toBe('Sick');
    expect(find('EX-002', '2026-11-06').status).toBe('Absent');
    expect(find('EX-003', '2026-11-04').status).toBe('Absent');
    expect(find('EX-001', '2026-11-02').checkIn).toBe('09:05 am');
    expect(find('EX-001', '2026-11-02').totalHours).toBe(7.95);
    expect(find('EX-003', '2026-11-06').checkOut).toBe('-');
  });

  it('shows approved leave as Leave even when no attendance row exists', () => {
    const rows = buildReportRows(employees, [], 2026, 11, leaves);
    const sara3 = rows.find((r) => r.employeeId === 'EX-002' && r.date === '2026-11-03')!;
    expect(sara3.status).toBe('Leave');
    expect(sara3.leaveType).toBe('Sick');
    const sara5 = rows.find((r) => r.employeeId === 'EX-002' && r.date === '2026-11-05')!;
    expect(sara5.status).toBe('Absent');
  });

  it('uses local PKT date keys, not UTC, so a leave day never shifts', () => {
    const rows = buildReportRows(employees, [], 2026, 11, leaves);
    expect(rows.find((r) => r.employeeId === 'EX-002' && r.date === '2026-11-02')!.status).toBe('Absent');
    expect(rows.find((r) => r.employeeId === 'EX-002' && r.date === '2026-11-04')!.status).toBe('Leave');
  });
});

describe('buildSummary, November 2026', () => {
  it('counts Present, Late, Absent and Leave per employee over the full month', () => {
    const rows = buildReportRows(employees, records, 2026, 11, leaves);
    const balances = new Map([
      ['EX-001', { taken: 0, balance: 20 }],
      ['EX-002', { taken: 2, balance: 18 }],
      ['EX-003', { taken: 0, balance: 20 }],
    ]);
    const summary = buildSummary(rows, balances);
    const ahmed = summary.find((s) => s.employeeId === 'EX-001')!;
    expect(ahmed.present).toBe(4);
    expect(ahmed.late).toBe(1);
    expect(ahmed.absent).toBe(16);
    expect(ahmed.leave).toBe(0);
    const sara = summary.find((s) => s.employeeId === 'EX-002')!;
    expect(sara.present).toBe(2);
    expect(sara.leave).toBe(2);
    expect(sara.absent).toBe(17);
    expect(sara.leaveTaken).toBe(2);
    expect(sara.leaveBalance).toBe(18);
    const bilal = summary.find((s) => s.employeeId === 'EX-003')!;
    expect(bilal.present).toBe(4);
    expect(bilal.absent).toBe(17);
    expect(bilal.totalHours).toBeCloseTo(23.76, 2);
  });

  it('uses the employee code as the balance key, the way the screens build it', () => {
    // Regression test for the E2E bug of 5 Nov 2026: MonthlyReport and
    // EmployeeDetail built the balances map keyed by database UUID, but
    // buildSummary looks it up by employee code (EX-001). Every lookup
    // missed, so Leave Taken and Leave Balance showed 0 for everyone on
    // screen and in the downloaded Excel. The map must be keyed by code.
    const rows = buildReportRows(employees, records, 2026, 11, leaves);
    const allowance = 20;
    const balances = new Map<string, { taken: number; balance: number }>();
    for (const emp of employees) {
      const taken = records.filter((r) => r.employee_id === emp.id && r.status === 'Leave').length;
      balances.set(emp.employee_id, { taken, balance: Math.max(0, allowance - taken) });
    }
    const summary = buildSummary(rows, balances);
    expect(summary.find((s) => s.employeeId === 'EX-001')!.leaveBalance).toBe(20);
    expect(summary.find((s) => s.employeeId === 'EX-002')!.leaveTaken).toBe(2);
    expect(summary.find((s) => s.employeeId === 'EX-002')!.leaveBalance).toBe(18);
    expect(summary.find((s) => s.employeeId === 'EX-003')!.leaveBalance).toBe(20);
  });
});
