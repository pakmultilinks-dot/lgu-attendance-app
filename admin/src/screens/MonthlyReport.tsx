import React, { useEffect, useState } from 'react';
import { supabase, type AttendanceRow, type Employee, type LeaveRequest } from '../lib/supabase';
import { buildReportRows, buildSummary, downloadMonthlyExcel } from '../lib/excel';
import { Avatar, StatusPill } from '../components/ui';

export default function MonthlyReport() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [month, setMonth] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }).slice(0, 7));
  const [rows, setRows] = useState<ReturnType<typeof buildReportRows>>([]);
  const [summary, setSummary] = useState<ReturnType<typeof buildSummary>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('employees').select('*').eq('is_active', true).order('full_name')
      // The HOD manages attendance and is not counted as staff for the month.
      .then(({ data }) => setEmployees(((data as Employee[]) ?? []).filter((e) => e.role !== 'hod')));
  }, []);

  async function generate() {
    setLoading(true); setError('');
    const [year, m] = month.split('-').map(Number);
    const from = `${month}-01`;
    const to = `${month}-${new Date(year, m, 0).getDate()}`;
    const [recRes, leaveRes, settingsRes] = await Promise.all([
      supabase.from('attendance_records').select('*').gte('work_date', from).lte('work_date', to),
      supabase.from('leaves').select('*').eq('status', 'Approved').lte('start_date', to).gte('end_date', from),
      supabase.from('office_settings').select('annual_leave_allowance_days').eq('id', 1).single(),
    ]);
    setLoading(false);
    if (recRes.error || leaveRes.error) { setError('Could not load the monthly report.'); return; }
    const allowance = (settingsRes.data as { annual_leave_allowance_days?: number } | null)?.annual_leave_allowance_days ?? 20;
    const records = (recRes.data as AttendanceRow[]) ?? [];
    const leaves = (leaveRes.data as LeaveRequest[]) ?? [];

    // Leave balance per employee for the calendar year: allowance minus
    // approved Leave days in the year, counted from attendance rows.
    const balances = new Map<string, { taken: number; balance: number }>();
    const yearFrom = `${year}-01-01`;
    const yearTo = `${year}-12-31`;
    const { data: yearRecords } = await supabase.from('attendance_records')
      .select('employee_id')
      .eq('status', 'Leave')
      .gte('work_date', yearFrom)
      .lte('work_date', yearTo);
    for (const emp of employees) {
      const taken = (yearRecords as { employee_id: string }[] | null ?? []).filter((r) => r.employee_id === emp.id).length;
      // Keyed by employee code (EX-001), not the database UUID: buildSummary
      // looks balances up by ReportRow.employeeId, which is the code.
      balances.set(emp.employee_id, { taken, balance: Math.max(0, allowance - taken) });
    }

    const built = buildReportRows(employees, records, year, m, leaves);
    setRows(built);
    setSummary(buildSummary(built, balances));
  }

  useEffect(() => { if (employees.length) generate(); }, [employees, month]);

  const totalPresent = summary.reduce((a, s) => a + s.present, 0);
  const totalLate = summary.reduce((a, s) => a + s.late, 0);
  const totalAbsent = summary.reduce((a, s) => a + s.absent, 0);
  const totalLeave = summary.reduce((a, s) => a + s.leave, 0);
  const totalHours = summary.reduce((a, s) => a + s.totalHours, 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Monthly Report</h2>
          <p className="page-sub">Month totals, leave balances, and the day by day record.</p>
        </div>
      </div>
      <div className="toolbar">
        <label>Month <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <button className="btn-secondary" onClick={generate} disabled={loading}>{loading ? 'Loading...' : 'Generate'}</button>
        <button className="btn-primary" disabled={!rows.length} onClick={() => downloadMonthlyExcel(rows, `LGU-Attendance-Full-${month}.xlsx`, summary)}>Download Full Excel</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}

      <div className="summary-stats">
        <div className="summary-stat"><span>Present</span><strong>{totalPresent}</strong></div>
        <div className="summary-stat"><span>Late</span><strong>{totalLate}</strong></div>
        <div className="summary-stat"><span>Absent</span><strong>{totalAbsent}</strong></div>
        <div className="summary-stat"><span>Leave</span><strong>{totalLeave}</strong></div>
        <div className="summary-stat"><span>Total Hours</span><strong>{totalHours} h</strong></div>
      </div>

      <h3>Summary</h3>
      <div className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Employee ID</th><th className="num">Present</th><th className="num">Late</th><th className="num">Absent</th><th className="num">Leave</th><th className="num">Leave Taken (year)</th><th className="num">Leave Balance (year)</th><th className="num">Total Hours</th></tr></thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.employeeId}>
                  <td>
                    <div className="cell-person">
                      <Avatar name={s.name} size="sm" />
                      <span className="cell-main">{s.name}</span>
                    </div>
                  </td>
                  <td>{s.employeeId}</td><td className="num">{s.present}</td><td className="num">{s.late}</td><td className="num">{s.absent}</td><td className="num">{s.leave}</td><td className="num">{s.leaveTaken}</td><td className="num">{s.leaveBalance}</td><td className="num">{s.totalHours} h</td>
                </tr>
              ))}
              {summary.length === 0 && <tr><td colSpan={9}>No data for this month yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <h3>Day by day</h3>
      <div className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Employee ID</th><th>Date</th><th>Check In</th><th>Check Out</th><th>Total Hours</th><th>Status</th><th className="col-hide-sm">Leave Type</th><th className="col-hide-sm">Location Verified</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.employeeId}-${r.date}-${i}`}>
                  <td>
                    <div className="cell-person">
                      <Avatar name={r.name} size="sm" />
                      <span className="cell-main">{r.name}</span>
                    </div>
                  </td>
                  <td>{r.employeeId}</td><td>{r.date}</td><td>{r.checkIn}</td><td>{r.checkOut}</td><td>{r.totalHours}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td className="col-hide-sm">{r.leaveType}</td>
                  <td>{r.locationVerified === 'Yes' ? <StatusPill status="Yes" /> : r.locationVerified === 'No' ? <StatusPill status="No" /> : r.locationVerified}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9}>No data for this month yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted small">Weekends are not counted. A weekday with no record shows as Absent once absent has been marked for that day. Approved leave shows as Leave. The Excel file has the same day by day sheet plus a summary sheet.</p>
    </div>
  );
}
