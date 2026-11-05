import React, { useEffect, useState } from 'react';
import { supabase, type Employee } from '../lib/supabase';
import { Avatar, StatusPill, displayName } from '../components/ui';

// Employee management. Adding an employee creates their login via Supabase
// Auth sign up, then the employee row. In production the HOD should create
// accounts from this panel only, and hand each person their password in
// person. Removing means deactivation: the row stays, is_active becomes
// false, and all attendance history is kept.
export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await supabase.from('employees').select('*').order('full_name');
    setEmployees((data as Employee[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setMessage(''); setError('');
    const { data, error: authError } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password });
    if (authError || !data.user) { setError(authError?.message ?? 'Could not create the login.'); return; }
    const { error: rowError } = await supabase.from('employees').insert({
      auth_user_id: data.user.id, employee_id: employeeId.trim(), full_name: fullName.trim(),
      designation: designation.trim() || 'Staff', email: email.trim().toLowerCase(), role: 'employee',
    });
    if (rowError) { setError(rowError.message); return; }
    await supabase.from('admin_audit').insert({ action: 'add_employee', target_employee_id: null, details: { employee_id: employeeId.trim(), full_name: fullName.trim() } });
    setMessage(`Added ${displayName(fullName.trim())}. Give them the password in person and tell them to change it on first sign in.`);
    setFullName(''); setEmployeeId(''); setDesignation(''); setEmail(''); setPassword('');
    load();
  }

  async function setActive(emp: Employee, active: boolean) {
    const { error: err } = await supabase.from('employees').update({ is_active: active }).eq('id', emp.id);
    if (err) { setError(err.message); return; }
    await supabase.from('admin_audit').insert({ action: active ? 'reactivate_employee' : 'deactivate_employee', target_employee_id: emp.id, details: { employee_id: emp.employee_id } });
    setMessage(active ? `${displayName(emp.full_name)} reactivated.` : `${displayName(emp.full_name)} deactivated. Their history is kept.`);
    load();
  }

  const activeCount = employees.filter((e) => e.is_active).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Employees</h2>
          <p className="page-sub">{employees.length} people on record, {activeCount} active.</p>
        </div>
      </div>
      <div className="card">
        <h3>Add employee</h3>
        <p className="muted small">Creates the staff login and the employee record. Hand the temporary password to the person directly.</p>
        <form onSubmit={addEmployee} className="form-grid">
          <label>Full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
          <label>Employee ID<input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required /></label>
          <label>Designation<input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Assistant, Examination" /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Temporary password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /><span className="field-help">At least 8 characters. They change it on first sign in.</span></label>
          <button className="btn-primary" type="submit">Add Employee</button>
        </form>
        {message && <div className="banner banner-success" role="status">{message}</div>}
        {error && <div className="banner banner-error" role="alert">{error}</div>}
      </div>
      <div className="card table-card">
        <div className="table-card-head">
          <h3>Staff list</h3>
          <span className="count-chip">{employees.length} people</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Employee ID</th><th>Designation</th><th className="col-hide-sm">Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div className="cell-person">
                      <Avatar name={emp.full_name} size="sm" />
                      <span className="cell-main">{displayName(emp.full_name)}</span>
                    </div>
                  </td>
                  <td>{emp.employee_id}</td><td>{emp.designation}</td><td className="col-hide-sm">{emp.email}</td>
                  <td><span className="pill pill-role">{emp.role === 'hod' ? 'Head of Department' : 'Staff'}</span></td>
                  <td><StatusPill status={emp.is_active ? 'Active' : 'Inactive'} /></td>
                  <td>
                    {emp.role !== 'hod' && (
                      <button className="btn-secondary" onClick={() => setActive(emp, !emp.is_active)}>
                        {emp.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {employees.length === 0 && <tr><td colSpan={7}>No employees yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="muted small">Deactivating someone keeps all their attendance history.</p>
      <p className="muted small">Adding a person signs this browser in as them. Sign out, then sign back in with your own account.</p>
    </div>
  );
}
