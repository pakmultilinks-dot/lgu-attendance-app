// LGU Attendance App design tokens.
// Official LGU colours are blue, white and green. This app leads with the
// deep LGU green family on white and mint, with gold used sparingly as an
// accent. Nothing in this file touches logic, only the visual layer.

export const colors = {
  deepGreen: '#064E2B',
  emerald: '#0B6E3A',
  brightGreen: '#0E7A45',
  mint: '#EDF5EF',
  sage: '#E2EEE5',
  sageBorder: '#CBDCCF',
  card: '#FFFFFF',
  ink: '#0F1F16',
  muted: '#52645A',
  faint: '#7A8B80',
  gold: '#C9A227',
  goldSoft: '#F5EED3',
  danger: '#B3261E',
  dangerSoft: '#F9DAD7',
  dangerText: '#7A1A14',
  amber: '#9A6B0F',
  amberSoft: '#F7EBC8',
  amberText: '#7A5200',
  leaveBlue: '#2F5D8A',
  leaveSoft: '#DCE8F5',
  leaveText: '#1F4A73',
  presentSoft: '#D9EDDF',
  presentText: '#064E2B',
  disabledBg: '#DCE6DF',
  disabledText: '#7A8B80',
  divider: '#E4EDE6',
  inputBorder: '#CBDCCF',
  white: '#FFFFFF',
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export const radius = {
  card: 20,
  button: 14,
  pill: 999,
  input: 12,
  tile: 12,
} as const;

export const typography = {
  hero: 26,
  title: 20,
  section: 18,
  body: 16,
  bodySmall: 15,
  label: 12,
  caption: 13,
  button: 16,
  buttonSmall: 15,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '600',
  bold: '700',
  extraBold: '800',
} as const;

export const shadow = {
  card: {
    shadowColor: '#064E2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  raised: {
    shadowColor: '#064E2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  button: {
    shadowColor: '#064E2B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
} as const;

// Solid soft status chips: coloured dot, soft tint background, dark text.
// No thin outline pills anywhere in the app.
export const statusTone: Record<string, { bg: string; dot: string; text: string }> = {
  Present: { bg: colors.presentSoft, dot: colors.emerald, text: colors.presentText },
  Late: { bg: colors.amberSoft, dot: colors.amber, text: colors.amberText },
  Leave: { bg: colors.leaveSoft, dot: colors.leaveBlue, text: colors.leaveText },
  Absent: { bg: colors.dangerSoft, dot: colors.danger, text: colors.dangerText },
  Approved: { bg: colors.presentSoft, dot: colors.emerald, text: colors.presentText },
  Rejected: { bg: colors.dangerSoft, dot: colors.danger, text: colors.dangerText },
  Pending: { bg: colors.amberSoft, dot: colors.amber, text: colors.amberText },
};

export function toneFor(status: string): { bg: string; dot: string; text: string } {
  return statusTone[status] ?? { bg: colors.sage, dot: colors.muted, text: colors.ink };
}
