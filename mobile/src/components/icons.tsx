import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

// Real vector icons, drawn with SVG paths. No character glyphs, no emoji.
// Stroke style, 24 by 24 viewBox, current colour passed in as `color`.

export type IconName =
  | 'check'
  | 'cross'
  | 'clock'
  | 'calendar'
  | 'pin'
  | 'chevron'
  | 'user'
  | 'users'
  | 'settings'
  | 'leave'
  | 'report'
  | 'home'
  | 'search'
  | 'logout'
  | 'shield'
  | 'alert'
  | 'fingerprint';

const PATHS: Partial<Record<IconName, React.ReactNode>> = {
  check: <Path d="M20 6L9 17l-5-5" />,
  cross: <Path d="M18 6L6 18" />,
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3.5 2" />
    </>
  ),
  calendar: (
    <>
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  pin: (
    <>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <Circle cx="12" cy="10" r="3" />
    </>
  ),
  chevron: <Path d="M9 18l6-6-6-6" />,
  user: (
    <>
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </>
  ),
  users: (
    <>
      <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 00-3-3.87" />
      <Path d="M16 3.13a4 4 0 010 7.75" />
    </>
  ),
  settings: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>
  ),
  leave: (
    <>
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <Path d="M14 2v6h6" />
      <Line x1="16" y1="13" x2="8" y2="13" />
      <Line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  report: (
    <>
      <Line x1="12" y1="20" x2="12" y2="10" />
      <Line x1="18" y1="20" x2="18" y2="4" />
      <Line x1="6" y1="20" x2="6" y2="16" />
    </>
  ),
  home: (
    <>
      <Rect x="3" y="3" width="7" height="7" rx="1" />
      <Rect x="14" y="3" width="7" height="7" rx="1" />
      <Rect x="14" y="14" width="7" height="7" rx="1" />
      <Rect x="3" y="14" width="7" height="7" rx="1" />
    </>
  ),
  search: (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Line x1="21" y1="21" x2="16.5" y2="16.5" />
    </>
  ),
  logout: (
    <>
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <Path d="M16 17l5-5-5-5" />
      <Line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  shield: (
    <>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="M9 12l2 2 4-4" />
    </>
  ),
  alert: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Line x1="12" y1="8" x2="12" y2="13" />
      <Line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
};

export function Icon({ name, size = 20, color = '#0F1F16' }: { name: IconName; size?: number; color?: string }) {
  if (name === 'fingerprint') return <FingerprintMark size={size} color={color} />;
  if (name === 'cross') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M18 6L6 18" />
        <Path d="M6 6l12 12" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </Svg>
  );
}

// Fingerprint whorl: five concentric arches, drawn as SVG paths.
// Used in the large check-in button and on the sign-in screen.
export function FingerprintMark({ size = 48, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round">
      <Path d="M10 52 C12.5 36 13.5 26 13.5 20 A18.5 18.5 0 0 1 50.5 20 C50.5 29 49.5 40 47 50" />
      <Path d="M17 53 C19 39 20 29 20 22 A12 12 0 0 1 44 22 C44 30 43.5 39 41.5 47" />
      <Path d="M24 53 C25.5 41 26 31 26 24 A6 6 0 0 1 38 24 C38 31 37.5 39 36 46" />
      <Path d="M29.5 51 C30.5 42 31 33 31 27" />
      <Path d="M33 51 C33.8 43 34.2 35 34.2 29" />
      <Path d="M5 46 C7 30 8 22 8 16 A24 24 0 0 1 56 16 C56 24 55 34 53 44" />
    </Svg>
  );
}
