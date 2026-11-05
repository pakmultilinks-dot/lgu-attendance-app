import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, EmptyState, ErrorBanner, StatusPill, shared } from '../components/ui';
import { colors, spacing } from '../components/design';
import type { AttendanceRecord, Employee } from '../lib/supabase';
import { formatDate, formatTime, loadHistory } from '../lib/attendance';
import { demoLoadHistory } from '../lib/demo';

// Full history view, grouped by month. Home shows the last 14 days;
// this screen loads 90. Rows include Leave and Absent days: Leave rows
// come from approved leave requests (with the leave type shown), Absent
// rows are written by the HOD marking absent at day end. A day with no
// row at all means absent has not been marked for that day yet.
export default function HistoryScreen({ employee, isDemo }: { employee: Employee; isDemo?: boolean }) {
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = isDemo ? demoLoadHistory(90) : loadHistory(employee.id, 90);
    load.then(setRows).catch(() => setError('Could not load history.'));
  }, [employee.id, isDemo]);

  const groups: { label: string; rows: AttendanceRecord[] }[] = [];
  for (const row of rows) {
    const label = new Date(`${row.work_date}T00:00:00`).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(row);
    else groups.push({ label, rows: [row] });
  }

  return (
    <ScrollView style={shared.screen}>
      <AppHeader />
      <View style={shared.content}>
        <View style={shared.card}>
          <View style={local.sectionHead}>
            <Text style={[shared.sectionLabel, { marginBottom: 0 }]}>My attendance</Text>
            <Text style={local.countChip}>{rows.length} days</Text>
          </View>
          <Text style={local.sub}>Last 90 days, grouped by month.</Text>
          {error ? <ErrorBanner text={error} /> : null}
          {rows.length === 0 && !error ? (
            <EmptyState icon="clock" title="No attendance yet." help="Attendance records for the last 90 days will appear here once you check in." />
          ) : null}
          {groups.map((group) => (
            <View key={group.label}>
              <Text style={local.monthHeading}>{group.label}</Text>
              {group.rows.map((row, index) => (
                <View key={row.id} style={[local.row, index === group.rows.length - 1 && local.rowLast]}>
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
          ))}
        </View>
        <View style={local.footnoteCard}>
          <Text style={local.footnoteText}>
            If a day looks wrong, speak to the Head of Department. Only the Head of Department can correct a record.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const local = {
  sectionHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 2 },
  sub: { fontSize: 13, color: colors.muted, marginBottom: spacing.sm },
  countChip: { fontSize: 12, fontWeight: '700' as const, color: colors.muted, backgroundColor: colors.sage, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' as const },
  monthHeading: { fontSize: 14, fontWeight: '800' as const, color: colors.emerald, marginTop: spacing.md, marginBottom: 2 },
  row: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  footnoteCard: { backgroundColor: colors.sage, borderRadius: 16, padding: spacing.md },
  footnoteText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' as const },
};
