import React, { useEffect, useState } from 'react';
import { supabase, type OfficeSettings } from '../lib/supabase';

export default function Settings() {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayValues = [1, 2, 3, 4, 5, 6, 7];

  function toggleWorkingDay(day: number) {
    if (!settings) return;
    const current = settings.working_days ?? [1, 2, 3, 4, 5];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    setSettings({ ...settings, working_days: next });
  }

  useEffect(() => {
    supabase.from('office_settings').select('*').eq('id', 1).single()
      .then(({ data }) => setSettings(data as OfficeSettings));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setMessage(''); setError('');
    const { error: err } = await supabase.from('office_settings').update({
      office_name: settings.office_name,
      office_lat: settings.office_lat,
      office_lng: settings.office_lng,
      radius_meters: settings.radius_meters,
      office_start_time: settings.office_start_time,
      office_end_time: settings.office_end_time,
      late_cutoff_time: settings.late_cutoff_time,
      working_days: settings.working_days ?? [1, 2, 3, 4, 5],
      annual_leave_allowance_days: settings.annual_leave_allowance_days,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    if (err) { setError(err.message); return; }
    await supabase.from('admin_audit').insert({ action: 'update_settings', details: { office_lat: settings.office_lat, office_lng: settings.office_lng, radius_meters: settings.radius_meters } });
    setMessage('Settings saved. The next check in uses the new office pin immediately.');
  }

  if (!settings) return <p>Loading settings...</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Office Settings</h2>
          <p className="page-sub">Office pin, hours, working days, and leave allowance.</p>
        </div>
      </div>
      <p className="muted">Set the office pin by standing at the office door, opening Google Maps, long pressing the pin, and copying the latitude and longitude.</p>
      <form onSubmit={save} className="card">
        <div className="form-section">
          <h3>Office location</h3>
          <p className="muted">Where check-ins count, and how far from the pin they count.</p>
          <div className="form-grid">
            <label className="full-row">Office name<input value={settings.office_name} onChange={(e) => setSettings({ ...settings, office_name: e.target.value })} /></label>
            <label>Office latitude<input type="number" step="0.000001" value={settings.office_lat} onChange={(e) => setSettings({ ...settings, office_lat: Number(e.target.value) })} required /><span className="field-help">Copy the latitude from Google Maps at the office door.</span></label>
            <label>Office longitude<input type="number" step="0.000001" value={settings.office_lng} onChange={(e) => setSettings({ ...settings, office_lng: Number(e.target.value) })} required /><span className="field-help">Copy the longitude from Google Maps at the office door.</span></label>
            <label>Radius in metres<input type="number" min={10} max={1000} value={settings.radius_meters} onChange={(e) => setSettings({ ...settings, radius_meters: Number(e.target.value) })} required /><span className="field-help">Check-ins count only inside this circle around the office pin.</span></label>
          </div>
        </div>
        <div className="form-section">
          <h3>Hours</h3>
          <p className="muted">Office hours and the time after which a check-in counts as late.</p>
          <div className="form-grid">
            <label>Office start time<input type="time" value={settings.office_start_time} onChange={(e) => setSettings({ ...settings, office_start_time: e.target.value })} required /></label>
            <label>Office end time<input type="time" value={settings.office_end_time} onChange={(e) => setSettings({ ...settings, office_end_time: e.target.value })} required /></label>
            <label>Late cutoff time<input type="time" value={settings.late_cutoff_time} onChange={(e) => setSettings({ ...settings, late_cutoff_time: e.target.value })} required /><span className="field-help">Check-ins after this time are marked Late.</span></label>
            <div>
              <span className="field-label">Working days</span>
              <div className="day-chips">
                {dayNames.map((dayLabel, i) => (
                  <label key={dayValues[i]} className="day-chip">
                    <input
                      type="checkbox"
                      checked={(settings.working_days ?? [1, 2, 3, 4, 5]).includes(dayValues[i])}
                      onChange={() => toggleWorkingDay(dayValues[i])}
                    />
                    <span>{dayLabel}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="form-section">
          <h3>Leave</h3>
          <p className="muted">Yearly leave allowance for every employee.</p>
          <div className="form-grid">
            <label>Annual leave allowance, days per year<input type="number" min={0} max={60} value={settings.annual_leave_allowance_days} onChange={(e) => setSettings({ ...settings, annual_leave_allowance_days: Number(e.target.value) })} required /><span className="field-help">Used for the leave balance shown on every report.</span></label>
          </div>
        </div>
        <button className="btn-primary" type="submit">Save Settings</button>
      </form>
      {message && <div className="banner banner-success" role="status">{message}</div>}
      {error && <div className="banner banner-error" role="alert">{error}</div>}
    </div>
  );
}
