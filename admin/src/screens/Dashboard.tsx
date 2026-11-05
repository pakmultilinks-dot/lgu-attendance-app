import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, formatTimePK, todayPK, type AttendanceRow, type Employee, type LeaveRequest } from '../lib/supabase';
import { Avatar, StatusPill, EmptyState, displayName } from '../components/ui';
import { Icon, type IconName } from '../components/icons';

type TodayLists = {
  present: Employee[];
  late: Employee[];
  leave: Employee[];
  absent: Employee[];
};

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [leavesToday, setLeavesToday] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  async function load() {
    setLoading(true);
    const today = todayPK();
    const [empRes, recRes, leaveRes] = await Promise.all([
      supabase.from('employees').select('*').eq('is_active', true).order('full_name'),
      supabase.from('attendance_records').select('*, employees(full_name, employee_id, designation)').eq('work_date', today),
      supabase.from('leaves').select('*, employees(full_name, employee_id, designation)').eq('status', 'Approved').lte('start_date', today).gte('end_date', today),
    ]);
    setLoading(false);
    if (empRes.error || recRes.error || leaveRes.error) { setError('Could not load today attendance.'); return; }
    // The HOD manages attendance and is not counted as staff for the day.
    // Without this filter the HOD showed up in the Absent list with no
    // check in, and "Mark absent" would have marked the HOD Absent.
    setEmployees(((empRes.data as Employee[]) ?? []).filter((e) => e.role !== 'hod'));
    setRecords((recRes.data as AttendanceRow[]) ?? []);
    setLeavesToday((leaveRes.data as LeaveRequest[]) ?? []);
  }

  useEffect(() => { load(); }, []);

  const byEmployee = new Map(records.map((r) => [r.employee_id, r]));
  const leaveIds = new Set(leavesToday.map((l) => l.employee_id));
  // Saturday and Sunday are non-working days by default. Before office hours
  // on a working day the Absent list only means "not checked in yet", not
  // "absent for the day". The HOD marks absent after hours.
  const todayDow = new Date().getDay();
  const isWorkingDay = todayDow !== 0 && todayDow !== 6;

  const lists: TodayLists = { present: [], late: [], leave: [], absent: [] };
  for (const emp of employees) {
    const rec = byEmployee.get(emp.id);
    if (rec?.status === 'Present') lists.present.push(emp);
    else if (rec?.status === 'Late') lists.late.push(emp);
    else if (rec?.status === 'Leave' || leaveIds.has(emp.id)) lists.leave.push(emp);
    else if (rec?.status === 'Absent' || !rec) lists.absent.push(emp);
  }

  const checkedOut = records.filter((r) => r.check_out_at).length;
  const absentMarked = records.filter((r) => r.status === 'Absent').length;
  const absentUnmarked = lists.absent.length - absentMarked;

  async function markAbsent() {
    setMarking(true); setMessage(''); setError('');
    const { data, error: err } = await supabase.rpc('mark_absent_for_date', { p_date: todayPK() });
    setMarking(false);
    if (err) { setError(err.message); return; }
    setMessage(`Marked ${data ?? 0} absent for today. People on approved leave were not marked.`);
    load();
  }

  function ListBlock({ title, count, people, empty, tone, icon }: { title: string; count: number; people: Employee[]; empty: string; tone: string; icon: IconName }) {
    return (
      <div className={`card list-block list-${tone}`}>
        <div className="list-head">
          <h3>{title} ({count})</h3>
          <span className="count-chip">{count} {count === 1 ? 'person' : 'people'}</span>
        </div>
        {people.length === 0 ? <EmptyState text={empty} icon={icon} /> : (
          <ul className="plain-list">
            {people.map((emp) => {
              const rec = byEmployee.get(emp.id);
              return (
                <li key={emp.id}>
                  <div className="person-row">
                    <Avatar name={emp.full_name} />
                    <div className="person-main">
                      <Link to={`/employee/${emp.id}`}>{displayName(emp.full_name)}</Link>
                      <div className="person-meta">{emp.designation} | {emp.employee_id}</div>
                    </div>
                    <div className="person-times">
                      {rec?.check_in_at && <span className="time-chip">In <strong>{formatTimePK(rec.check_in_at)}</strong></span>}
                      {rec?.check_out_at && <span className="time-chip">Out <strong>{formatTimePK(rec.check_out_at)}</strong></span>}
                      {rec?.total_hours !== null && rec?.total_hours !== undefined && <span className="time-chip"><strong>{rec.total_hours} h</strong></span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Today, {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
          <p className="page-sub">Office hours 09:00 to 17:00. Late after 09:15.</p>
        </div>
        <button className="btn-secondary" onClick={load}>Refresh</button>
      </div>

      <div className="stats">
        <div className="stat stat-staff"><span className="stat-icon" aria-hidden="true"><Icon name="users" size={19} /></span><span>Staff</span><strong>{employees.length}</strong><small>On the roster</small></div>
        <div className="stat stat-present"><span className="stat-icon" aria-hidden="true"><Icon name="check" size={19} /></span><span>Present</span><strong>{lists.present.length}</strong><small>In today</small></div>
        <div className="stat stat-late"><span className="stat-icon" aria-hidden="true"><Icon name="clock" size={19} /></span><span>Late</span><strong>{lists.late.length}</strong><small>After 09:15</small></div>
        <div className="stat stat-leave"><span className="stat-icon" aria-hidden="true"><Icon name="leave" size={19} /></span><span>On leave</span><strong>{lists.leave.length}</strong><small>Approved today</small></div>
        <div className="stat stat-absent"><span className="stat-icon" aria-hidden="true"><Icon name="cross" size={19} /></span><span>Absent</span><strong>{lists.absent.length}</strong><small>No check-in yet</small></div>
        <div className="stat stat-checkedout"><span className="stat-icon" aria-hidden="true"><Icon name="logout" size={19} /></span><span>Checked out</span><strong>{checkedOut}</strong><small>Left for the day</small></div>
      </div>

      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {message && <div className="banner banner-success" role="status">{message}</div>}
      {!isWorkingDay && <p className="muted">Today is a non-working day (weekend). The Absent list below does not apply today.</p>}
      {loading ? <p>Loading...</p> : (
        <>
          <ListBlock title="Present" count={lists.present.length} people={lists.present} empty="Nobody present yet." tone="present" icon="check" />
          <ListBlock title="Late" count={lists.late.length} people={lists.late} empty="Nobody late today." tone="late" icon="clock" />
          <ListBlock title="On Leave" count={lists.leave.length} people={lists.leave} empty="Nobody on leave today." tone="leave" icon="leave" />
          <ListBlock title="Absent" count={lists.absent.length} people={lists.absent} empty="Nobody absent today." tone="absent" icon="cross" />
          <div className="card action-card">
            <span className="action-icon" aria-hidden="true"><Icon name="cross" size={20} /></span>
            <div>
              <h3>Mark absent</h3>
              <p className="muted">
                {absentUnmarked > 0
                  ? `${absentUnmarked} employee(s) in the Absent list have no record yet. Tap below after office hours to write Absent rows for them. Employees on approved leave are never marked.`
                  : 'Everyone not present is already marked Absent or on Leave.'}
              </p>
              <button className="btn-primary" onClick={markAbsent} disabled={marking || absentUnmarked === 0}>
                {marking ? 'Marking...' : `Mark absent for today (${absentUnmarked})`}
              </button>
            </div>
          </div>

          <div className="card table-card">
            <div className="table-card-head">
              <h3>Everyone today</h3>
              <span className="count-chip">{employees.length} staff</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Name</th><th>Employee ID</th><th className="col-hide-sm">Designation</th><th>Check In</th><th>Check Out</th><th>Total Hours</th><th>Status</th><th className="col-hide-sm">Location</th></tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const rec = byEmployee.get(emp.id);
                    const status = rec ? rec.status : (leaveIds.has(emp.id) ? 'Leave' : 'Absent');
                    const statusText = `${status}${!rec && status === 'Absent' ? ' (not marked yet)' : ''}`;
                    return (
                      <tr key={emp.id}>
                        <td>
                          <div className="cell-person">
                            <Avatar name={emp.full_name} size="sm" />
                            <Link to={`/employee/${emp.id}`}>{displayName(emp.full_name)}</Link>
                          </div>
                        </td>
                        <td>{emp.employee_id}</td>
                        <td className="col-hide-sm">{emp.designation}</td>
                        <td>{rec ? formatTimePK(rec.check_in_at) : '-'}</td>
                        <td>{rec ? formatTimePK(rec.check_out_at) : '-'}</td>
                        <td>{rec?.total_hours !== null && rec?.total_hours !== undefined ? `${rec.total_hours} h` : '-'}</td>
                        <td><StatusPill status={statusText} tone={status} /></td>
                        <td className="col-hide-sm">{rec ? (rec.location_verified ? <StatusPill status="Verified" /> : <StatusPill status="Not verified" />) : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <p className="muted small">If a record shows Not verified, check it before accepting it.</p>
    </div>
  );
}
