import React from 'react';
import { Icon, type IconName } from './icons';
import { displayName } from '../lib/supabase';

/* Small presentational helpers only. No data fetching, no logic changes.
   Avatars use initials in coloured circles, pills are soft status chips.
   Names are always shown through displayName, so no seed or test tag
   ever reaches the screen. */

export { displayName };

export function initials(name: string): string {
  const parts = displayName(name).split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

const TONES = ['avatar-green', 'avatar-blue', 'avatar-amber', 'avatar-sage'];

export function Avatar({ name, tone, size }: { name: string; tone?: string; size?: 'sm' | 'md' | 'lg' }) {
  const auto = TONES[Math.abs([...displayName(name)].reduce((a, c) => a + c.charCodeAt(0), 0)) % TONES.length];
  const sizeClass = size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : '';
  return (
    <span aria-hidden="true" className={`avatar ${tone ?? auto} ${sizeClass}`.trim()}>
      {initials(name)}
    </span>
  );
}

function pillClassFor(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === 'present' || v === 'approved' || v === 'verified' || v === 'yes' || v === 'active') return 'pill-present';
  if (v === 'late' || v === 'pending') return 'pill-late';
  if (v === 'leave') return 'pill-leave';
  if (v === 'absent' || v === 'rejected' || v === 'not verified' || v === 'no' || v === 'inactive') return 'pill-absent';
  return 'pill-neutral';
}

export function StatusPill({ status, tone }: { status: string; tone?: string }) {
  return <span className={`pill ${pillClassFor(tone ?? status)}`}>{status}</span>;
}

export function EmptyState({ text, icon }: { text: string; icon?: IconName }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-glyph"><Icon name={icon ?? 'check'} size={20} /></span>
      <p className="muted">{text}</p>
    </div>
  );
}
