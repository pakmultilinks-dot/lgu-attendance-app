import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { AppHeader, EmptyState, ErrorBanner, shared } from '../components/ui';
import { colors, radius, shadow, spacing, toneFor } from '../components/design';
import type { Employee, LeaveRequest } from '../lib/supabase';
import { formatDate } from '../lib/attendance';
import { loadLeaveBalance, loadMyLeaves } from '../lib/leaves';

function LeaveStatusPill({ status }: { status: string }) {
  const tone = toneFor(status);
  return (
    <View style={[local.pill, { backgroundColor: tone.bg }]}>
      <View style={[local.pillDot, { backgroundColor: tone.dot }]} />
      <Text style={[local.pillText, { color: tone.text }]}>{status}</Text>
    </View>
  );
}

export default function LeavesScreen({ employee, onBack }: { employee: Employee; onBack: () => void }) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [balance, setBalance] = useState<{ allowance: number; taken: number; remaining: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMyLeaves(employee.id).then(setLeaves).catch(() => setError('Could not load your leave requests.'));
    loadLeaveBalance(employee.id).then(setBalance).catch(() => undefined);
  }, [employee.id]);

  const leaveProgress = balance && balance.allowance > 0 ? balance.taken / balance.allowance : 0;

  return (
    <ScrollView style={shared.screen}>
      <AppHeader />
      <View style={shared.content}>
        {balance && (
          <View style={[shared.card, local.balanceCard]}>
            <Text style={local.balanceLabel}>Leave balance, {new Date().getFullYear()}</Text>
            <Text style={local.balanceBig}>
              {balance.remaining} days left of {balance.allowance} allowed
            </Text>
            <Text style={{ color: '#CDE6D5', marginTop: 4 }}>{balance.taken} approved leave days taken this year.</Text>
            <View style={local.balanceProgress}>
              <View style={local.progressHead}>
                <Text style={local.progressLabel}>Leave used</Text>
                <Text style={local.progressValue}>{balance.taken} of {balance.allowance} days</Text>
              </View>
              <View style={local.progressTrackDark}>
                <View style={[local.progressFillLight, { width: `${Math.round(Math.max(0, Math.min(1, leaveProgress)) * 100)}%` }]} />
              </View>
            </View>
          </View>
        )}
        <Text style={local.sectionHeading}>My leave requests</Text>
        {error ? <ErrorBanner text={error} /> : null}
        {leaves.length === 0 && !error ? (
          <View style={shared.card}>
            <EmptyState icon="calendar" title="No leave requests yet." help="Your leave requests will appear here once you apply for leave." />
          </View>
        ) : null}
        {leaves.map((leave) => (
          <View key={leave.id} style={local.leaveCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 16 }}>{leave.leave_type} leave</Text>
              <LeaveStatusPill status={leave.status} />
            </View>
            <Text style={{ color: colors.muted, marginTop: 6, fontSize: 14 }}>
              {formatDate(leave.start_date)} to {formatDate(leave.end_date)}
            </Text>
            <Text style={{ marginTop: 6, color: colors.ink, fontSize: 15, lineHeight: 21 }}>{leave.reason}</Text>
            {leave.decision_reason ? (
              <View style={local.hodNote}>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>Head of Department note: {leave.decision_reason}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const local = {
  balanceCard: { backgroundColor: colors.deepGreen },
  balanceLabel: { fontSize: 12, fontWeight: '800' as const, letterSpacing: 1, color: '#9DC3AB', marginBottom: spacing.sm },
  balanceBig: { fontSize: 22, fontWeight: '800' as const, color: colors.white, lineHeight: 28 },
  balanceProgress: { marginTop: spacing.md },
  progressHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: '700' as const, color: '#CDE6D5' },
  progressValue: { fontSize: 12, fontWeight: '700' as const, color: colors.white },
  progressTrackDark: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.22)', overflow: 'hidden' as const },
  progressFillLight: { height: 8, borderRadius: 4, backgroundColor: colors.gold },
  sectionHeading: {
    fontSize: 12, fontWeight: '800' as const, letterSpacing: 1, color: colors.emerald, marginBottom: spacing.sm,
  },
  leaveCard: {
    backgroundColor: colors.card, borderRadius: 20, padding: spacing.lg, marginBottom: spacing.sm, ...shadow.card,
  },
  hodNote: { backgroundColor: colors.mint, borderRadius: radius.input, padding: spacing.sm, marginTop: 10 },
  pill: {
    flexDirection: 'row' as const, alignItems: 'center' as const, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 5, alignSelf: 'flex-start' as const,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  pillText: { fontSize: 12, fontWeight: '700' as const },
  backRow: { alignItems: 'center' as const, paddingVertical: spacing.sm },
  backText: { color: colors.emerald, textAlign: 'center' as const, padding: 12, fontWeight: '700' as const, fontSize: 15 },
};
