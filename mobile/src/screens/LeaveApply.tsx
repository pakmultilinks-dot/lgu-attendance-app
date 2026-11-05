import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppHeader, ErrorBanner, SuccessBanner, shared } from '../components/ui';
import { Icon } from '../components/icons';
import { colors, radius, spacing } from '../components/design';
import { LEAVE_TYPES, workingDaysBetween, type Employee, type LeaveType } from '../lib/supabase';
import { applyLeave } from '../lib/leaves';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = [2026, 2027];

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function humanDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A real date picker: tap the field, pick month, then year, then a day.
// No typed dates, no YYYY-MM-DD format to remember. The stored value is
// still YYYY-MM-DD, so the leave table and approval flow are unchanged.
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const [month, setMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());
  const [year, setYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function pickDay(day: number) {
    const iso = isoOf(year, month, day);
    onChange(iso);
    setOpen(false);
  }

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={local.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[shared.input, local.dateField, open && shared.inputFocused]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Icon name="calendar" size={18} color={colors.emerald} />
        <Text style={[local.dateFieldText, !value && local.dateFieldEmpty]}>
          {value ? humanDate(value) : 'Choose a date'}
        </Text>
        <Icon name="chevron" size={18} color={colors.muted} />
      </TouchableOpacity>
      {open ? (
        <View style={local.pickerCard}>
          <Text style={local.pickerLabel}>Month</Text>
          <View style={local.chipRow}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity key={m} onPress={() => setMonth(i)} style={[local.chip, month === i && local.chipSelected]}>
                <Text style={[local.chipText, month === i && local.chipTextSelected]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={local.pickerLabel}>Year</Text>
          <View style={local.chipRow}>
            {YEARS.map((y) => (
              <TouchableOpacity key={y} onPress={() => setYear(y)} style={[local.chip, year === y && local.chipSelected]}>
                <Text style={[local.chipText, year === y && local.chipTextSelected]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={local.pickerLabel}>Day</Text>
          <View style={local.chipRow}>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              <TouchableOpacity key={d} onPress={() => pickDay(d)} style={[local.dayChip, value === isoOf(year, month, d) && local.chipSelected]}>
                <Text style={[local.chipText, value === isoOf(year, month, d) && local.chipTextSelected]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function LeaveApplyScreen({ employee, onDone }: { employee: Employee; onDone: () => void }) {
  const [leaveType, setLeaveType] = useState<LeaveType>('Casual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<'reason' | 'note' | null>(null);

  const dayCount =
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate >= startDate
      ? workingDaysBetween(startDate, endDate)
      : null;

  async function submit() {
    if (!startDate || !endDate) { setError('Choose a start date and an end date.'); return; }
    setBusy(true); setMessage(''); setError('');
    const result = await applyLeave(employee.id, { leaveType, startDate, endDate, reason, note });
    setBusy(false);
    if (result.ok) { setMessage(result.message); setReason(''); setNote(''); }
    else setError(result.message);
  }

  return (
    <ScrollView style={shared.screen}>
      <AppHeader />
      <View style={shared.content}>
        <View style={shared.card}>
          <Text style={shared.sectionLabel}>Apply for leave</Text>
          <Text style={local.subHeading}>Leave type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {LEAVE_TYPES.map((t) => {
              const selected = leaveType === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => setLeaveType(t)}
                  style={[local.typeChip, selected ? local.typeChipSelected : local.typeChipPlain]}
                >
                  <Text style={[local.typeChipText, selected ? local.typeChipTextSelected : local.typeChipTextPlain]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <DateField label="Start date" value={startDate} onChange={setStartDate} />
          <DateField label="End date" value={endDate} onChange={setEndDate} />
          {dayCount !== null && (
            <View style={local.dayCountChip}>
              <Text style={local.dayCountText}>{dayCount} working day{dayCount === 1 ? '' : 's'} (weekends not counted).</Text>
            </View>
          )}
          <Text style={local.fieldLabel}>Reason (required)</Text>
          <TextInput
            style={[shared.input, local.multiline, focused === 'reason' && shared.inputFocused]}
            placeholder="Family function in Lahore" value={reason} onChangeText={setReason} multiline
            onFocus={() => setFocused('reason')} onBlur={() => setFocused(null)}
          />
          <Text style={local.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={[shared.input, local.multiline, focused === 'note' && shared.inputFocused]}
            placeholder="Anything the Head of Department should know" value={note} onChangeText={setNote} multiline
            onFocus={() => setFocused('note')} onBlur={() => setFocused(null)}
          />
          <TouchableOpacity style={[shared.button, busy && shared.buttonDisabled]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={shared.buttonText}>Submit Leave Request</Text>}
          </TouchableOpacity>
          {message ? <SuccessBanner text={message} /> : null}
          {error ? <ErrorBanner text={error} /> : null}
        </View>
        <TouchableOpacity onPress={onDone} style={local.backRow}>
          <Text style={local.backText}>Back to Home</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
          Approved leave shows as Leave in your attendance and in the monthly report. Rejected leave does not.
        </Text>
      </View>
    </ScrollView>
  );
}

const local = {
  subHeading: { fontSize: 16, fontWeight: '700' as const, color: colors.ink, marginBottom: 10 },
  typeChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  typeChipSelected: { backgroundColor: colors.deepGreen, borderColor: colors.deepGreen },
  typeChipPlain: { backgroundColor: colors.white, borderColor: colors.sageBorder },
  typeChipText: { fontWeight: '700' as const, fontSize: 14 },
  typeChipTextSelected: { color: colors.white },
  typeChipTextPlain: { color: colors.ink },
  fieldLabel: { fontSize: 13, fontWeight: '700' as const, color: colors.ink, marginBottom: 6, marginTop: 2 },
  dayCountChip: {
    backgroundColor: colors.sage, borderRadius: radius.input, paddingHorizontal: spacing.sm,
    paddingVertical: 10, marginBottom: spacing.sm, alignSelf: 'flex-start' as const,
  },
  dayCountText: { color: colors.presentText, fontSize: 13, fontWeight: '700' as const },
  multiline: { minHeight: 64, textAlignVertical: 'top' as const },
  backRow: { alignItems: 'center' as const, paddingVertical: spacing.sm },
  backText: { color: colors.emerald, textAlign: 'center' as const, padding: 12, fontWeight: '700' as const, fontSize: 15 },
  dateField: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  dateFieldText: { flex: 1, fontSize: 16, color: colors.ink, fontWeight: '600' as const },
  dateFieldEmpty: { color: colors.faint, fontWeight: '400' as const },
  pickerCard: { backgroundColor: colors.mint, borderRadius: radius.input, padding: spacing.sm, marginTop: -4, marginBottom: spacing.sm },
  pickerLabel: { fontSize: 12, fontWeight: '800' as const, color: colors.muted, letterSpacing: 0.6, marginTop: 6, marginBottom: 6 },
  chipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  chip: { borderWidth: 1.5, borderColor: colors.sageBorder, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.deepGreen, borderColor: colors.deepGreen },
  chipText: { fontWeight: '700' as const, fontSize: 14, color: colors.ink },
  chipTextSelected: { color: colors.white },
  dayChip: { width: 38, height: 38, borderWidth: 1.5, borderColor: colors.sageBorder, borderRadius: 10, backgroundColor: colors.white, alignItems: 'center' as const, justifyContent: 'center' as const },
};
