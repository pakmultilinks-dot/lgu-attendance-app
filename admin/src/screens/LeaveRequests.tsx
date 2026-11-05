import React, { useEffect, useState } from 'react';
import { supabase, formatDatePK, type LeaveRequest } from '../lib/supabase';
import { Avatar, StatusPill, EmptyState, displayName } from '../components/ui';

// Leave Requests: pending first, then decided. Approve writes Leave
// attendance rows for every working day in the range (see approve_leave in
// schema.sql). Reject needs a reason, which the employee sees in the app.
export default function LeaveRequests() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data, error: err } = await supabase
      .from('leaves')
      .select('*, employees(full_name, employee_id, designation)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) setError('Could not load leave requests.');
    else setRequests((data as LeaveRequest[]) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function approve(req: LeaveRequest) {
    setBusyId(req.id); setMessage(''); setError('');
    const { data, error: err } = await supabase.rpc('approve_leave', {
      p_leave_id: req.id,
      p_decision_reason: reasons[req.id] ?? '',
    });
    setBusyId(null);
    if (err) { setError(err.message); return; }
    const result = data as { days_created?: number; skipped_days?: string[] } | null;
    setMessage(`Approved ${displayName(req.employees?.full_name ?? '')} leave. ${result?.days_created ?? 0} leave day(s) written. ${result?.skipped_days?.length ? `Skipped (already checked in): ${result.skipped_days.join(', ')}.` : ''}`);
    load();
  }

  async function reject(req: LeaveRequest) {
    const reason = (reasons[req.id] ?? '').trim();
    if (!reason) { setError('Write a reason before rejecting. The employee will see it.'); return; }
    setBusyId(req.id); setMessage(''); setError('');
    const { error: err } = await supabase.rpc('reject_leave', { p_leave_id: req.id, p_decision_reason: reason });
    setBusyId(null);
    if (err) { setError(err.message); return; }
    setMessage(`Rejected ${displayName(req.employees?.full_name ?? '')} leave.`);
    load();
  }

  const pending = requests.filter((r) => r.status === 'Pending');
  const decided = requests.filter((r) => r.status !== 'Pending');

  function PendingCard({ req }: { req: LeaveRequest }) {
    return (
      <div className="card leave-card">
        <div className="leave-card-head">
          <Avatar name={req.employees?.full_name ?? req.employee_id} />
          <div className="person-main">
            <div className="cell-main">{displayName(req.employees?.full_name ?? req.employee_id)}</div>
            <div className="cell-sub">{req.employees?.designation} | {req.employees?.employee_id}</div>
          </div>
          <span className="pill pill-type">{req.leave_type}</span>
        </div>
        <p className="leave-dates">{formatDatePK(req.start_date)} to {formatDatePK(req.end_date)} <span>({req.leave_type})</span></p>
        <p className="leave-reason">{req.reason}</p>
        {req.note ? <p className="leave-note"><strong>Note:</strong> {req.note}</p> : null}
        <div className="leave-actions">
          <label>
            Note for the employee
            <input
              placeholder="Note or reason (required to reject)"
              value={reasons[req.id] ?? ''}
              onChange={(e) => setReasons({ ...reasons, [req.id]: e.target.value })}
            />
            <span className="field-help">A note is optional for approval, and required before rejecting.</span>
          </label>
          <div className="leave-btn-row">
            <button className="btn-primary" disabled={busyId === req.id} onClick={() => approve(req)}>Approve</button>
            <button className="btn-danger" disabled={busyId === req.id} onClick={() => reject(req)}>Reject</button>
          </div>
        </div>
      </div>
    );
  }

  function Row({ req }: { req: LeaveRequest }) {
    return (
      <tr>
        <td>
          <div className="cell-person">
            <Avatar name={req.employees?.full_name ?? req.employee_id} size="sm" />
            <div>
              <div className="cell-main">{displayName(req.employees?.full_name ?? req.employee_id)}</div>
              <div className="cell-sub">{req.employees?.designation} | {req.employees?.employee_id}</div>
            </div>
          </div>
        </td>
        <td><span className="pill pill-type">{req.leave_type}</span></td>
        <td>{formatDatePK(req.start_date)} to {formatDatePK(req.end_date)}</td>
        <td>{req.reason}{req.note ? <><br /><span className="muted small">Note: {req.note}</span></> : null}</td>
        <td><StatusPill status={req.status} />{req.decision_reason ? <><br /><span className="muted small">{req.decision_reason}</span></> : null}</td>
        <td>
          {req.status === 'Pending' ? (
            <>
              <input
                placeholder="Note or reason (required to reject)"
                value={reasons[req.id] ?? ''}
                onChange={(e) => setReasons({ ...reasons, [req.id]: e.target.value })}
              />
              <div className="leave-btn-row">
                <button className="btn-primary" disabled={busyId === req.id} onClick={() => approve(req)}>Approve</button>
                <button className="btn-danger" disabled={busyId === req.id} onClick={() => reject(req)}>Reject</button>
              </div>
            </>
          ) : '-'}
        </td>
      </tr>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Leave Requests ({pending.length} pending)</h2>
          <p className="page-sub">Approve or reject each request, with a note the employee will see.</p>
        </div>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {message && <div className="banner banner-success" role="status">{message}</div>}
      <div className="section-head">
        <h3>Pending</h3>
        <span className="count-chip">{pending.length} pending</span>
      </div>
      {pending.length === 0 ? <div className="card"><EmptyState text="No pending leave requests." icon="check" /></div> : (
        <div className="leave-grid">
          {pending.map((r) => <PendingCard key={r.id} req={r} />)}
        </div>
      )}
      <div className="section-head">
        <h3>Decided</h3>
        <span className="count-chip">{decided.length} decided</span>
      </div>
      {decided.length === 0 ? <div className="card"><EmptyState text="No decided requests yet." icon="clock" /></div> : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th><th>Decision</th></tr></thead>
              <tbody>{decided.map((r) => <Row key={r.id} req={r} />)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
