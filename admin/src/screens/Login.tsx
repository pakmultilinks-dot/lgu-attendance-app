import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
    });
    setBusy(false);
    if (authError) setError('Wrong email or password, or this account is not a Head of Department account.');
  }

  return (
    <div className="login-wrap">
      <aside className="login-brand">
        <span className="monogram" aria-hidden="true">LGU</span>
        <h1>Lahore Garrison University</h1>
        <p className="login-dept">Examination Department, Attendance</p>
        <p className="login-motto">We Do Things Differently</p>
        <p className="login-campus">Main Campus, Sector C, DHA Phase 6, Lahore</p>
      </aside>
      <main className="login-main">
        <div className="card login-card">
          <p className="login-eyebrow">Lahore Garrison University</p>
          <h1>Sign in</h1>
          <p className="muted">Examination Department, Attendance</p>
          <form onSubmit={signIn}>
            <label>Email<input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign In'}</button>
          </form>
          {error && <div className="banner banner-error" role="alert">{error}</div>}
          <p className="muted small">Head of Department accounts only. Staff use the mobile app, not this panel.</p>
        </div>
      </main>
    </div>
  );
}
