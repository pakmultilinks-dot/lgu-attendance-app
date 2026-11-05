import React, { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { displayName, supabase } from './lib/supabase';
import { Icon, type IconName } from './components/icons';
import { Avatar } from './components/ui';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import EmployeeDetail from './screens/EmployeeDetail';
import LeaveRequests from './screens/LeaveRequests';
import MonthlyReport from './screens/MonthlyReport';
import Employees from './screens/Employees';
import Settings from './screens/Settings';
import './styles.css';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Today', icon: 'home' },
  { to: '/leaves', label: 'Leave Requests', icon: 'leave' },
  { to: '/report', label: 'Monthly Report', icon: 'report' },
  { to: '/employees', label: 'Employees', icon: 'users' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Today';
  if (pathname === '/leaves') return 'Leave Requests';
  if (pathname === '/report') return 'Monthly Report';
  if (pathname === '/employees') return 'Employees';
  if (pathname === '/settings') return 'Settings';
  if (pathname.startsWith('/employee/')) return 'Employee Detail';
  return 'Today';
}

function Shell({ isHod, hodName }: { isHod: boolean; hodName: string | null }) {
  const location = useLocation();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="monogram" aria-hidden="true">LGU</span>
          <div className="brand-text">
            <strong>Lahore Garrison University</strong>
            <span>Examination Department</span>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Admin sections">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <span className="nav-glyph" aria-hidden="true"><Icon name={item.icon} size={18} /></span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="sidebar-motto">We Do Things Differently</p>
          <button className="sidebar-signout" onClick={() => supabase.auth.signOut()}><Icon name="logout" size={16} /> Sign out</button>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <div>
            <h1 className="topbar-title">{pageTitle(location.pathname)}</h1>
            <span className="topbar-meta">Lahore Garrison University, Examination Department</span>
          </div>
          <span className="topbar-user">
            {hodName ? <Avatar name={hodName} size="sm" /> : null}
            <span className="topbar-user-text">
              <strong>{hodName ?? 'Head of Department'}</strong>
              <span>Head of Department</span>
            </span>
          </span>
        </header>
        <main className="main">
          {!isHod && <div className="banner banner-warn" role="alert">This panel is for the Head of Department only. Your account does not have that role. Ask the Head of Department to grant it.</div>}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/leaves" element={<LeaveRequests />} />
            <Route path="/report" element={<MonthlyReport />} />
            <Route path="/employee/:id" element={<EmployeeDetail />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<boolean | null>(null);
  const [isHod, setIsHod] = useState(false);
  const [hodName, setHodName] = useState<string | null>(null);

  useEffect(() => {
    async function loadRole(userId: string | null) {
      if (!userId) { setIsHod(false); setHodName(null); return; }
      const { data: emp } = await supabase.from('employees').select('full_name, role').eq('auth_user_id', userId).maybeSingle();
      const row = emp as { full_name?: string; role?: string } | null;
      setIsHod(row?.role === 'hod');
      setHodName(row?.full_name ? displayName(row.full_name) : null);
    }
    supabase.auth.getSession().then(async ({ data }) => {
      const loggedIn = !!data.session;
      setSession(loggedIn);
      if (loggedIn && data.session) await loadRole(data.session.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(!!s);
      loadRole(s?.user?.id ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === null) return <p className="loading">Loading...</p>;
  if (!session) return <Login />;

  return (
    <BrowserRouter>
      <Shell isHod={isHod} hodName={hodName} />
    </BrowserRouter>
  );
}
