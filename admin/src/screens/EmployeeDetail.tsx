import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase, formatDatePK, formatTimePK, type AttendanceRow, type Employee, type LeaveRequest } from '../lib/supabase';
import { buildReportRows, buildSummary, downloadMonthlyExcel } from '../lib/excel';
import { Avatar, StatusPill, displayName } from '../components/ui';

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<{ allowance: number; taken: number; remaining: number } | null>(null);
  const [month, setMonth] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }).slice(0, 7));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    supabase.from('employees').select('*').eq('id', id).single().then(({ data }) => setEmployee(data as Employee));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const [year, m] = month.split('-').map(Number);
    const from = `${month}-01`;
    const to = `${month}-${new Date(year, m, 0).getDate()}`;
    supabase.from('attendance_records').select('*').eq('employee_id', id).gte('work_date', from).lte('work_date', to).order('work_date', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError('Could not load attendance.');
        else setRecords((data as AttendanceRow[]) ?? []);
      });
    supabase.from('leaves').select('*').eq('employee_id', id).order('start_date', { ascending: false }).limit(20)
      .then(({ data }) => setLeaves((data as LeaveRequest[]) ?? []));
    Promise.all([
      supabase.from('office_settings').select('annual_leave_allowance_days').eq('id', 1).single(),
      supabase.rpc('leave_days_taken', { p_employee_id: id, p_year: year }),
    ]).then(([settingsRes, takenRes]) => {
      const allowance = (settingsRes.data as { annual_leave_allowance_days?: number } | null)?.annual_leave_allowance_days ?? 20;
      const taken = typeof takenRes.data === 'number' ? takenRes.data : 0;
      setBalance({ allowance, taken, remaining: Math.max(0, allowance - taken) });
    });
  }, [id, month]);

  function downloadExcel() {
    if (!employee) return;
    const [year, m] = month.split('-').map(Number);
    const rows = buildReportRows([employee], records, year, m, leaves);
    // Keyed by employee code (EX-001), not the database UUID: buildSummary
    // looks balances up by ReportRow.employeeId, which is the code.
    const balances = new Map(balance ? [[employee.employee_id, { taken: balance.taken, balance: balance.remaining }]] : []);
    downloadMonthlyExcel(rows, `LGU-Attendance-${employee.employee_id}-${month}.xlsx`, buildSummary(rows, balances));
  }

  if (!employee) return <p>Loading employee...</p>;

  const balanceUsedPct = balance && balance.allowance > 0 ? Math.min(100, Math.round((balance.taken / balance.allowance) * 100)) : 0;
  const presentCount = records.filter((r) => r.status === 'Present').length;
  const lateCount = records.filter((r) => r.status === 'Late').length;
  const absentCount = records.filter((r) => r.status === 'Absent').length;

  return (
    <div>
      <div className="profile-head">
        <Avatar name={employee.full_name} size="lg" />
        <div>
          <h2>{displayName(employee.full_name)}</h2>
          <p className="muted profile-meta">{employee.designation} | {employee.employee_id}</p>
        </div>
      </div>

      <div className="summary-stats">
        <div className="summary-stat"><span>Present</span><strong>{presentCount}</strong></div>
        <div className="summary-stat"><span>Late</span><strong>{lateCount}</strong></div>
        <div className="summary-stat"><span>Absent</span><strong>{absentCount}</strong></div>
        <div className="summary-stat"><span>Leave requests</span><strong>{leaves.length}</strong></div>
        <div className="summary-stat"><span>Leave balance</span><strong>{balance ? `${balance.remaining} days` : '-'}</strong></div>
      </div>

      {balance && (
        <div className="card balance-card">
          <p>Leave balance, {new Date().getFullYear()}: <strong>{balance.remaining} days left</strong> of {balance.allowance} allowed ({balance.taken} taken).</p>
          <div className="progress" aria-hidden="true">
            <div className="progress-track"><div className="progress-fill" style={{ width: `${balanceUsedPct}%` }} /></div>
            <div className="progress-label"><span>{balance.taken} days taken</span><span>{balance.remaining} days left</span></div>
          </div>
        </div>
      )}
      <h3>Leave requests</h3>
      {leaves.length === 0 ? <p className="muted">No leave requests.</p> : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th><th>Note</th></tr></thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}><td><span className="pill pill-type">{l.leave_type}</span></td><td>{formatDatePK(l.start_date)} to {formatDatePK(l.end_date)}</td><td>{l.reason}</td><td><StatusPill status={l.status} /></td><td>{l.decision_reason ?? '-'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <h3>Attendance</h3>
      <div className="toolbar">
        <label>Month <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <button className="btn-primary" onClick={downloadExcel}>Download Excel for this month</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <div className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Total Hours</th><th>Status</th><th className="col-hide-sm">Leave Type</th><th>Location Verified</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{formatDatePK(r.work_date)}</td>
                  <td>{formatTimePK(r.check_in_at)}</td>
                  <td>{formatTimePK(r.check_out_at)}</td>
                  <td>{r.total_hours !== null ? `${r.total_hours} h` : '-'}</td>
                  <td><StatusPill status={r.status} /></td>
                  <td className="col-hide-sm">{r.status === 'Leave' ? (r.leave_type ?? '-') : '-'}</td>
                  <td>{r.location_verified ? <StatusPill status="Yes" /> : <StatusPill status="No" />}</td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={7}>No records this month.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
