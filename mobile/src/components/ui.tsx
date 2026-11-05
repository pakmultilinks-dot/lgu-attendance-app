import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, toneFor, typography } from './design';
import { Icon, type IconName } from './icons';

export { colors, radius, shadow, spacing, toneFor, typography };

// Backwards compatible palette. Existing screens only used these keys;
// the new tokens in design.ts are the source of truth going forward.
export const COLORS = {
  green: colors.emerald,
  darkGreen: colors.deepGreen,
  background: colors.mint,
  card: colors.card,
  text: colors.ink,
  muted: colors.muted,
  border: colors.sageBorder,
  danger: colors.danger,
  amber: colors.amber,
};

export function Monogram({ size = 52, fontSize = 17 }: { size?: number; fontSize?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.deepGreen,
        borderWidth: 2,
        borderColor: colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.white, fontSize, fontWeight: '800', letterSpacing: 1 }}>LGU</Text>
    </View>
  );
}

export function AppHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Monogram />
        <View style={styles.headerText}>
          <Text style={styles.title}>Lahore Garrison University</Text>
          <Text style={styles.subtitle}>Examination Department</Text>
          <Text style={styles.motto}>We Do Things Differently</Text>
        </View>
      </View>
      <View style={styles.goldRule} />
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone = toneFor(status);
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.pillText, { color: tone.text }]}>{status}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.emerald }: { value: number; color?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(clamped * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

export function ErrorBanner({ text }: { text: string }) {
  return (
    <View style={[styles.banner, styles.errorBanner]}>
      <View style={styles.bannerMark}>
        <Icon name="alert" size={14} color="#FFFFFF" />
      </View>
      <Text style={[styles.bannerText, { color: colors.dangerText }]}>{text}</Text>
    </View>
  );
}

export function SuccessBanner({ text }: { text: string }) {
  return (
    <View style={[styles.banner, styles.successBanner]}>
      <View style={[styles.bannerMark, { backgroundColor: colors.emerald }]}>
        <Icon name="check" size={14} color="#FFFFFF" />
      </View>
      <Text style={[styles.bannerText, { color: colors.presentText }]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, help }: { icon: IconName; title: string; help: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyMark}>
        <Icon name={icon} size={24} color={colors.emerald} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHelp}>{help}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.deepGreen,
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: 0,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.md },
  headerText: { flex: 1, marginLeft: spacing.sm },
  title: { color: colors.white, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  subtitle: { color: '#CDE6D5', fontSize: 13, fontWeight: '600', marginTop: 3 },
  motto: { color: '#9DC3AB', fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  goldRule: { height: 3, backgroundColor: colors.gold, marginHorizontal: -spacing.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  pillText: { fontSize: 12, fontWeight: '700' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.sage,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 4 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.input,
    borderWidth: 1,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  errorBanner: { backgroundColor: '#FDF0EF', borderColor: '#EFC5C1' },
  successBanner: { backgroundColor: '#EAF6EE', borderColor: '#BFE0CB' },
  bannerMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  bannerMarkText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.md },
  emptyMark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyMarkText: { color: colors.emerald, fontSize: 24, fontWeight: '700' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  emptyHelp: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 19 },
});

export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mint },
  content: { padding: spacing.md, paddingBottom: 96 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  sectionLabel: {
    fontSize: typography.label,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.emerald,
    marginBottom: spacing.sm,
  },
  label: { fontSize: typography.label, fontWeight: '700', letterSpacing: 0.6, color: colors.muted, marginBottom: 4 },
  value: { fontSize: 16, color: colors.ink, fontWeight: '700' },
  button: {
    backgroundColor: colors.emerald,
    borderRadius: radius.button,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow.button,
  },
  buttonText: { color: colors.white, fontSize: typography.button, fontWeight: '700' },
  buttonDisabled: { backgroundColor: colors.disabledBg, shadowOpacity: 0, elevation: 0 },
  buttonDisabledText: { color: colors.disabledText },
  secondaryButton: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.emerald,
    borderRadius: radius.button,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  secondaryButtonText: { color: colors.emerald, fontSize: typography.buttonSmall, fontWeight: '700' },
  secondaryButtonDisabled: { backgroundColor: colors.sage, borderColor: colors.sageBorder, shadowOpacity: 0, elevation: 0 },
  secondaryButtonDisabledText: { color: colors.disabledText },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  inputFocused: { borderColor: colors.brightGreen },
  message: { fontSize: 14, color: colors.ink, marginTop: 10, textAlign: 'center' },
  error: { fontSize: 14, color: colors.danger, marginTop: 10, textAlign: 'center' },
});
