import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { AppHeader, EmptyState, ErrorBanner, ProgressBar, StatusPill, SuccessBanner, shared } from '../components/ui';
import { FingerprintMark, Icon, type IconName } from '../components/icons';
import { displayName } from '../lib/supabase';
import { colors, radius, shadow, spacing } from '../components/design';
import { supabase, type AttendanceRecord, type Employee, type OfficeSettings } from '../lib/supabase';
import { doCheckIn, doCheckOut, formatDate, formatTime, loadHistory, loadOfficeSettings, loadTodayRecord } from '../lib/attendance';
import { loadLeaveBalance } from '../lib/leaves';

function initialsOf(fullName: string): string {
  // displayName already strips any seed tag, so initials come from the
  // clean name: "Ahmed Khan" gives "AK".
  const parts = displayName(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'LG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function MenuRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={local.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={local.menuTile}>
        <Icon name={icon} size={19} color="#FFFFFF" />
      </View>
      <Text style={local.menuLabel}>{label}</Text>
      <Icon name="chevron" size={20} color={colors.emerald} />
    </TouchableOpacity>
  );
}

export default function HomeScreen({ employee, onSignOut, onApplyLeave, onViewLeaves, onViewHistory }: {
  employee: Employee;
  onSignOut: () => void;
  onApplyLeave: () => void;
  onViewLeaves: () => void;
  onViewHistory: () => void;
}) {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [balance, setBalance] = useState<{ allowance: number; taken: number; remaining: number } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    try {
      const s = await loadOfficeSettings();
      setSettings(s);
      setToday(await loadTodayRecord(employee.id));
      setHistory(await loadHistory(employee.id, 14));
      loadLeaveBalance(employee.id).then(setBalance).catch(() => undefined);
    } catch (e) {
      setError('Could not load attendance. Check your connection and pull to refresh.');
    }
  }

  useEffect(() => { refresh(); }, []);

  const checkedIn = today !== null && today.check_in_at !== null;
  const checkedOut = today !== null && today.check_out_at !== null;
  const onLeaveToday = today !== null && today.status === 'Leave';

  async function onCheckIn() {
    if (!settings) return;
    setBusy(true); setMessage(''); setError('');
    const result = await doCheckIn(settings);
    setBusy(false);
    if (result.ok) { setMessage(result.message); await refresh(); }
    else setError(result.message);
  }

  async function onCheckOut() {
    if (!settings) return;
    setBusy(true); setMessage(''); setError('');
    const result = await doCheckOut(settings);
    setBusy(false);
    if (result.ok) { setMessage(result.message); await refresh(); }
    else setError(result.message);
  }

  const checkInDisabled = busy || checkedIn || onLeaveToday || !settings;
  const checkOutDisabled = busy || !checkedIn || checkedOut;
  const hoursToday = today?.total_hours ?? 0;
  const dayProgress = Math.max(0, Math.min(1, hoursToday / 8));
  const leaveProgress = balance && balance.allowance > 0 ? balance.taken / balance.allowance : 0;

  return (
    <ScrollView
      style={shared.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} />}
    >
      <AppHeader />
      <View style={shared.content}>
        <View style={[shared.card, local.profileCard]}>
          <View style={local.profileRow}>
            <View style={local.avatar}>
              <Text style={local.avatarText}>{initialsOf(employee.full_name)}</Text>
            </View>
            <View style={local.profileText}>
              <Text style={local.greeting}>{greetingFor(new Date().getHours())},</Text>
              <Text style={local.profileName}>{displayName(employee.full_name)}</Text>
              <Text style={local.profileMeta}>{employee.designation}</Text>
              <Text style={local.profileMeta}>ID: {employee.employee_id}</Text>
            </View>
            <TouchableOpacity onPress={async () => { await supabase.auth.signOut(); onSignOut(); }} hitSlop={8}>
              <Text style={local.signOutLink}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={shared.card}>
          <Text style={shared.sectionLabel}>Today</Text>
          <Text style={local.todayDate}>{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          {today ? (
            <View>
              <View style={local.timelineRow}>
                <View style={local.timelineCell}>
                  <Text style={shared.label}>Check in</Text>
                  <Text style={shared.value}>{formatTime(today.check_in_at)}</Text>
                </View>
                <View style={[local.timelineCell, local.timelineDivider]}>
                  <Text style={shared.label}>Check out</Text>
                  <Text style={shared.value}>{formatTime(today.check_out_at)}</Text>
                </View>
                <View style={[local.timelineCell, local.timelineDivider]}>
                  <Text style={shared.label}>Total hours</Text>
                  <Text style={shared.value}>{today.total_hours !== null ? `${today.total_hours} h` : '-'}</Text>
                </View>
              </View>
              <View style={local.progressBlock}>
                <View style={local.progressHead}>
                  <Text style={local.progressLabel}>Hours today</Text>
                  <Text style={local.progressValue}>{hoursToday} h of 8 h</Text>
                </View>
                <ProgressBar value={dayProgress} />
              </View>
              <View style={local.pillRow}>
                <StatusPill status={today.status} />
                {today.status === 'Leave' ? null : (
                  <View style={[local.locationPill, today.location_verified ? local.locationOk : local.locationNotOk]}>
                    <Icon name="pin" size={13} color={colors.emerald} />
                    <Text style={local.locationText}>Location verified: {today.location_verified ? 'Yes' : 'No'}</Text>
                  </View>
                )}
              </View>
              {today.status === 'Leave' ? (
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
                  On approved {today.leave_type ?? ''} leave today
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={{ fontSize: 15, color: colors.ink }}>You have not checked in yet today.</Text>
          )}

          <TouchableOpacity
            style={[local.fingerprintButton, checkInDisabled && local.fingerprintButtonDisabled]}
            onPress={onCheckIn}
            disabled={checkInDisabled}
            activeOpacity={0.8}
          >
            <View style={[local.ringOuter, checkInDisabled && local.ringDisabled]}>
              <View style={[local.ringMiddle, checkInDisabled && local.ringDisabled]}>
                <View style={[local.ringInner, checkInDisabled && local.ringInnerDisabled]}>
                  {busy ? <ActivityIndicator color="#fff" size="large" /> : <FingerprintMark size={56} color="#FFFFFF" />}
                </View>
              </View>
            </View>
            <Text style={[local.fingerprintLabel, checkInDisabled && local.fingerprintLabelDisabled]}>
              {onLeaveToday ? 'On Leave Today' : checkedIn ? 'Checked In' : 'Check In with Fingerprint'}
            </Text>
            <Text style={local.fingerprintHint}>
              {checkedIn && !checkedOut ? 'You are checked in. Use Check Out below when you leave.' : 'Fingerprint is checked on this phone.'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[shared.secondaryButton, checkOutDisabled && shared.secondaryButtonDisabled]}
            onPress={onCheckOut}
            disabled={checkOutDisabled}
          >
            <Text style={[shared.secondaryButtonText, checkOutDisabled && shared.secondaryButtonDisabledText]}>
              {checkedOut ? 'Checked Out' : 'Check Out with Fingerprint'}
            </Text>
          </TouchableOpacity>

          {settings ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12, textAlign: 'center', lineHeight: 17 }}>
              Works only within {settings.radius_meters} m of the office. Office hours {settings.office_start_time} to {settings.office_end_time}. Late after {settings.late_cutoff_time}.
            </Text>
          ) : null}
          {message ? <SuccessBanner text={message} /> : null}
          {error ? <ErrorBanner text={error} /> : null}
        </View>

        <View style={shared.card}>
          <Text style={shared.sectionLabel}>Leave</Text>
          {balance ? (
            <View>
              <Text style={local.balanceBig}>
                {balance.remaining} days left of {balance.allowance} allowed this year ({balance.taken} taken).
              </Text>
              <View style={local.progressBlock}>
                <View style={local.progressHead}>
                  <Text style={local.progressLabel}>Leave used</Text>
                  <Text style={local.progressValue}>{balance.taken} of {balance.allowance} days</Text>
                </View>
                <ProgressBar value={leaveProgress} color={colors.leaveBlue} />
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 15, color: colors.ink }}>Leave balance loading...</Text>
          )}
          <View style={local.menuList}>
            <MenuRow icon="leave" label="Apply for Leave" onPress={onApplyLeave} />
            <MenuRow icon="calendar" label="My Leaves and Balance" onPress={onViewLeaves} />
            <MenuRow icon="clock" label="Full History (90 days)" onPress={onViewHistory} />
          </View>
        </View>

        <View style={shared.card}>
          <View style={local.sectionHead}>
            <Text style={[shared.sectionLabel, { marginBottom: 0 }]}>Recent days</Text>
            <Text style={local.sectionCount}>{history.length} days</Text>
          </View>
          {history.length === 0 ? (
            <EmptyState icon="clock" title="No attendance yet." help="Your recent attendance days will appear here once you check in." />
          ) : history.map((row, index) => (
            <View key={row.id} style={[local.historyRow, index === history.length - 1 && local.historyRowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 15 }}>{formatDate(row.work_date)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
                  {row.status === 'Leave'
                    ? `${row.leave_type ?? 'Leave'} leave`
                    : row.status === 'Absent'
                      ? 'No check in, no approved leave'
                      : `${formatTime(row.check_in_at)} to ${formatTime(row.check_out_at)}`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <StatusPill status={row.status} />
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 5 }}>{row.total_hours !== null ? `${row.total_hours} h` : '-'}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const local = {
  profileCard: { backgroundColor: colors.deepGreen, padding: spacing.lg },
  profileRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.emerald,
    borderWidth: 2, borderColor: colors.gold, alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '800' as const },
  profileText: { flex: 1, marginLeft: spacing.sm },
  greeting: { color: '#9DC3AB', fontSize: 13, fontWeight: '600' as const },
  profileName: { color: colors.white, fontSize: 20, fontWeight: '800' as const, marginTop: 2, lineHeight: 25 },
  profileMeta: { color: '#CDE6D5', fontSize: 13, marginTop: 2 },
  signOutLink: { color: '#CDE6D5', fontSize: 13, fontWeight: '700' as const, textDecorationLine: 'underline' as const },
  todayDate: { fontSize: 15, color: colors.muted, marginBottom: spacing.md },
  timelineRow: { flexDirection: 'row' as const, backgroundColor: colors.mint, borderRadius: radius.input, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  timelineCell: { flex: 1, alignItems: 'center' as const, paddingHorizontal: 4 },
  timelineDivider: { borderLeftWidth: 1, borderLeftColor: colors.sageBorder },
  progressBlock: { marginBottom: spacing.sm },
  progressHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 6 },
  progressLabel: { fontSize: 12, fontWeight: '700' as const, color: colors.muted },
  progressValue: { fontSize: 12, fontWeight: '700' as const, color: colors.ink },
  pillRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 4 },
  locationPill: {
    flexDirection: 'row' as const, alignItems: 'center' as const, borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 5,
  },
  locationOk: { backgroundColor: colors.presentSoft },
  locationNotOk: { backgroundColor: colors.amberSoft },
  locationText: { fontSize: 12, fontWeight: '700' as const, color: colors.presentText },
  fingerprintButton: { alignItems: 'center' as const, paddingVertical: spacing.lg, marginTop: spacing.sm },
  fingerprintButtonDisabled: { opacity: 0.75 },
  ringOuter: {
    width: 168, height: 168, borderRadius: 84, borderWidth: 1.5, borderColor: '#BFE0CB',
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.mint,
  },
  ringMiddle: {
    width: 136, height: 136, borderRadius: 68, borderWidth: 1.5, borderColor: colors.brightGreen,
    alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.white,
  },
  ringInner: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: colors.emerald,
    alignItems: 'center' as const, justifyContent: 'center' as const, ...shadow.button,
  },
  ringInnerDisabled: { backgroundColor: '#8FA89A', shadowOpacity: 0, elevation: 0 },
  ringDisabled: { borderColor: colors.sageBorder },
  fingerprintLabel: { color: colors.deepGreen, fontSize: 17, fontWeight: '800' as const, marginTop: spacing.md, textAlign: 'center' as const },
  fingerprintLabelDisabled: { color: colors.muted },
  fingerprintHint: { color: colors.muted, fontSize: 13, marginTop: 4, textAlign: 'center' as const, paddingHorizontal: spacing.lg },
  balanceBig: { fontSize: 17, fontWeight: '700' as const, color: colors.ink, lineHeight: 24 },
  menuList: { marginTop: spacing.sm },
  menuRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: colors.mint,
    borderRadius: radius.input, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, marginTop: spacing.xs,
  },
  menuTile: {
    width: 40, height: 40, borderRadius: radius.tile, backgroundColor: colors.deepGreen,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: spacing.sm,
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '700' as const, color: colors.ink },
  menuChevron: { color: colors.emerald, fontSize: 22, fontWeight: '700' as const },
  sectionHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: spacing.sm },
  sectionCount: { fontSize: 12, fontWeight: '700' as const, color: colors.muted, backgroundColor: colors.sage, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' as const },
  historyRow: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  historyRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
};
