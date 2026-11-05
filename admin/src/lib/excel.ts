import * as XLSX from 'xlsx';
import { displayName, formatTimePK } from './supabase';
import type { AttendanceRow, Employee, LeaveRequest } from './supabase';

export type ReportRow = {
  name: string;
  employeeId: string;
  designation: string;
  date: string;
  checkIn: string;
  checkOut: string;
  totalHours: number | string;
  status: string;
  leaveType: string;
  locationVerified: string;
};

export type SummaryRow = {
  name: string;
  employeeId: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  leaveTaken: number;
  leaveBalance: number;
  totalHours: number;
};

export function buildReportRows(
  employees: Employee[],
  records: AttendanceRow[],
  year: number,
  month: number,
  leaves: LeaveRequest[] = [],
): ReportRow[] {
  // Working days are Monday to Friday. A working day with a Leave record
  // shows as Leave with its leave type. A working day with no record at
  // all shows as Absent, which is correct only after the HOD has run the
  // mark absent step for that day, see SPEC.md.
  const daysInMonth = new Date(year, month, 0).getDate();
  const byEmployee = new Map<string, Map<string, AttendanceRow>>();
  for (const r of records) {
    if (!byEmployee.has(r.employee_id)) byEmployee.set(r.employee_id, new Map());
    byEmployee.get(r.employee_id)!.set(r.work_date, r);
  }
  // Approved leave covering a day, used when no attendance row exists yet
  // (for example the leave was approved after the absent run, or the
  // report is generated before the Leave rows were written).
  const leaveByEmployee = new Map<string, Map<string, string>>();
  for (const l of leaves) {
    if (l.status !== 'Approved') continue;
    if (!leaveByEmployee.has(l.employee_id)) leaveByEmployee.set(l.employee_id, new Map());
    const day = new Date(`${l.start_date}T00:00:00`);
    const end = new Date(`${l.end_date}T00:00:00`);
    while (day <= end) {
      const dow = day.getDay();
      if (dow !== 0 && dow !== 6) {
        // Local date key, not toISOString: toISOString is UTC and would
        // shift a Pakistan midnight back to the previous day.
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        leaveByEmployee.get(l.employee_id)!.set(key, l.leave_type);
      }
      day.setDate(day.getDate() + 1);
    }
  }

  const rows: ReportRow[] = [];
  for (const emp of employees) {
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue;
      const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const rec = byEmployee.get(emp.id)?.get(key);
      const leaveType = rec?.leave_type ?? leaveByEmployee.get(emp.id)?.get(key) ?? '';
      const status = rec ? rec.status : (leaveType ? 'Leave' : 'Absent');
      rows.push({
        name: displayName(emp.full_name),
        employeeId: emp.employee_id,
        designation: emp.designation,
        date: key,
        checkIn: rec ? formatTimePK(rec.check_in_at) : '-',
        checkOut: rec ? formatTimePK(rec.check_out_at) : '-',
        totalHours: rec?.total_hours ?? '-',
        status,
        leaveType: status === 'Leave' ? leaveType : '-',
        locationVerified: rec ? (rec.location_verified ? 'Yes' : 'No') : '-',
      });
    }
  }
  return rows;
}

export function downloadMonthlyExcel(rows: ReportRow[], fileName: string, summary: SummaryRow[]) {
  const sheetRows = rows.map((r) => ({
    'Name': r.name,
    'Employee ID': r.employeeId,
    'Designation': r.designation,
    'Date': r.date,
    'Check In': r.checkIn,
    'Check Out': r.checkOut,
    'Total Hours': r.totalHours,
    'Status': r.status,
    'Leave Type': r.leaveType,
    'Location Verified': r.locationVerified,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  ws['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 12 },
    { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

  const summarySheet = XLSX.utils.json_to_sheet(summary.map((s) => ({
    'Name': s.name,
    'Employee ID': s.employeeId,
    'Present': s.present,
    'Late': s.late,
    'Absent': s.absent,
    'Leave': s.leave,
    'Leave Taken (year)': s.leaveTaken,
    'Leave Balance (year)': s.leaveBalance,
    'Total Hours': s.totalHours,
  })));
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  XLSX.writeFile(wb, fileName);
}

export function buildSummary(rows: ReportRow[], leaveBalances: Map<string, { taken: number; balance: number }> = new Map()): SummaryRow[] {
  // leaveBalances is keyed by employee CODE (EX-001), not the database
  // UUID, because ReportRow only carries the code. A UUID-keyed map
  // silently misses every lookup and every balance comes out as 0.
  const map = new Map<string, SummaryRow>();
  for (const r of rows) {
    if (!map.has(r.employeeId)) {
      const bal = leaveBalances.get(r.employeeId) ?? { taken: 0, balance: 0 };
      map.set(r.employeeId, { name: r.name, employeeId: r.employeeId, present: 0, late: 0, absent: 0, leave: 0, leaveTaken: bal.taken, leaveBalance: bal.balance, totalHours: 0 });
    }
    const s = map.get(r.employeeId)!;
    if (r.status === 'Present') s.present += 1;
    else if (r.status === 'Late') s.late += 1;
    else if (r.status === 'Absent') s.absent += 1;
    else if (r.status === 'Leave') s.leave += 1;
    if (typeof r.totalHours === 'number') s.totalHours = Math.round((s.totalHours + r.totalHours) * 100) / 100;
  }
  return [...map.values()];
}
