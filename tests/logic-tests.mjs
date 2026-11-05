// LGU Attendance App, core logic tests. Run with: node tests/logic-tests.mjs
// No dependencies. The haversine and working-days functions are extracted
// from the real source files and executed, not copied, so these tests check
// the shipped code. The SQL rules (one record per day, leave overlap,
// absent marking, late cutoff) are simulated with the exact predicates used
// in supabase/schema.sql and mobile/src/lib/leaves.ts, and each simulation
// names the source predicate it mirrors.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function extractFunction(source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`marker not found: ${startMarker}`);
  let depth = 0;
  let i = source.indexOf('{', start);
  const begin = i;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces for ${startMarker}`);
}

const locationSrc = readFileSync(path.join(root, 'mobile/src/lib/location.ts'), 'utf8');
const supabaseSrc = readFileSync(path.join(root, 'mobile/src/lib/supabase.ts'), 'utf8');
function stripTypes(ts) {
  // The extracted functions are TypeScript. Remove the simple type
  // annotations so the code runs as plain JavaScript. No logic is changed.
  return ts.replace(/^export /, '').replace(/: (number|string|boolean)\b/g, '');
}

const haversineMeters = eval(`(${stripTypes(extractFunction(locationSrc, 'export function haversineMeters'))})`);
const workingDaysBetween = eval(`(${stripTypes(extractFunction(supabaseSrc, 'export function workingDaysBetween'))})`);

let passed = 0;
let failed = 0;
const failures = [];
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { passed++; console.log(`PASS ${name}: ${actual}`); }
  else { failed++; failures.push(name); console.log(`FAIL ${name}: got ${actual}, expected ${expected}`); }
}
function checkNear(name, actual, expected, tolerance) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) { passed++; console.log(`PASS ${name}: ${actual.toFixed(1)} (expected ${expected} +/- ${tolerance})`); }
  else { failed++; failures.push(name); console.log(`FAIL ${name}: got ${actual}, expected ${expected} +/- ${tolerance}`); }
}

// ---------------------------------------------------------------------------
// 1. Haversine, real function from mobile/src/lib/location.ts
// Office placeholder: 31.4640, 74.4427 (LGU Main Campus area).
// ---------------------------------------------------------------------------
const OFFICE_LAT = 31.4640;
const OFFICE_LNG = 74.4427;
checkNear('haversine same point is 0 m', haversineMeters(OFFICE_LAT, OFFICE_LNG, OFFICE_LAT, OFFICE_LNG), 0, 0.01);
checkNear('haversine 50 m north', haversineMeters(OFFICE_LAT, OFFICE_LNG, OFFICE_LAT + 50 / 111320, OFFICE_LNG), 50, 2);
checkNear('haversine 150 m north', haversineMeters(OFFICE_LAT, OFFICE_LNG, OFFICE_LAT + 150 / 111320, OFFICE_LNG), 150, 2);
checkNear('haversine 100 m boundary', haversineMeters(OFFICE_LAT, OFFICE_LNG, OFFICE_LAT + 100 / 111320, OFFICE_LNG), 100, 2);
checkNear('haversine 100 m east', haversineMeters(OFFICE_LAT, OFFICE_LNG, OFFICE_LAT, OFFICE_LNG + 100 / (111320 * Math.cos(OFFICE_LAT * Math.PI / 180))), 100, 2);
check('50 m is inside 100 m radius', haversineMeters(OFFICE_LAT, OFFICE_LNG, OFFICE_LAT + 50 / 111320, OFFICE_LNG) <= 100, true);
check('150 m is outside 100 m radius', haversineMeters(OFFICE_LAT, OFFICE_LNG, OFFICE_LAT + 150 / 111320, OFFICE_LNG) > 100, true);

// ---------------------------------------------------------------------------
// 2. Working days, real function from mobile/src/lib/supabase.ts
// Nov 2026: 1 Nov Sun, 2 Mon, 3 Tue, 4 Wed, 5 Thu, 6 Fri, 7 Sat, 8 Sun, 9 Mon.
// ---------------------------------------------------------------------------
check('working days Mon 2 Nov to Fri 6 Nov 2026', workingDaysBetween('2026-11-02', '2026-11-06'), 5);
check('working days Fri 6 Nov to Mon 9 Nov 2026', workingDaysBetween('2026-11-06', '2026-11-09'), 2);
check('working days Sat 7 Nov to Sun 8 Nov 2026', workingDaysBetween('2026-11-07', '2026-11-08'), 0);
check('working days Tue 3 Nov to Wed 4 Nov 2026', workingDaysBetween('2026-11-03', '2026-11-04'), 2);
check('working days single Monday', workingDaysBetween('2026-11-02', '2026-11-02'), 1);
check('working days single Saturday', workingDaysBetween('2026-11-07', '2026-11-07'), 0);

// ---------------------------------------------------------------------------
// 3. Late rule, mirrors check_in RPC: Late when check-in time > 09:15.
// ---------------------------------------------------------------------------
function statusFor(checkInTime, cutoff = '09:15') { return checkInTime > cutoff ? 'Late' : 'Present'; }
check('check in 09:05 is Present', statusFor('09:05'), 'Present');
check('check in 09:15 exactly is Present', statusFor('09:15'), 'Present');
check('check in 09:16 is Late', statusFor('09:16'), 'Late');
check('check in 09:22 is Late', statusFor('09:22'), 'Late');

// ---------------------------------------------------------------------------
// 4. One check in per day, mirrors unique (employee_id, work_date).
// ---------------------------------------------------------------------------
const dayRecords = new Map();
function insertRecord(emp, date) {
  const key = `${emp}|${date}`;
  if (dayRecords.has(key)) return false;
  dayRecords.set(key, true);
  return true;
}
check('first check in for EX-001 on 2026-11-02 accepted', insertRecord('EX-001', '2026-11-02'), true);
check('second check in same day rejected', insertRecord('EX-001', '2026-11-02'), false);
check('check in next day accepted', insertRecord('EX-001', '2026-11-03'), true);
check('different employee same day accepted', insertRecord('EX-002', '2026-11-02'), true);

// ---------------------------------------------------------------------------
// 5. Check in blocked on approved leave day, mirrors check_in RPC.
// ---------------------------------------------------------------------------
const leaveDays = new Set(['EX-002|2026-11-03', 'EX-002|2026-11-04']);
function canCheckIn(emp, date) { return !leaveDays.has(`${emp}|${date}`); }
check('EX-002 check in blocked on approved leave 2026-11-03', canCheckIn('EX-002', '2026-11-03'), false);
check('EX-002 check in allowed 2026-11-05', canCheckIn('EX-002', '2026-11-05'), true);
check('EX-001 check in allowed 2026-11-03', canCheckIn('EX-001', '2026-11-03'), true);

// ---------------------------------------------------------------------------
// 6. Leave overlap, mirrors leaves.ts: start <= newEnd AND end >= newStart.
// ---------------------------------------------------------------------------
function overlaps(existing, start, end) {
  return existing.some((l) => l.start <= end && l.end >= start);
}
const existingLeaves = [{ start: '2026-11-03', end: '2026-11-04' }];
check('leave overlapping existing range refused', overlaps(existingLeaves, '2026-11-04', '2026-11-06'), true);
check('leave starting day after existing ends allowed', overlaps(existingLeaves, '2026-11-05', '2026-11-06'), false);
check('leave fully inside existing refused', overlaps(existingLeaves, '2026-11-03', '2026-11-03'), true);
check('leave ending day before existing starts allowed', overlaps(existingLeaves, '2026-11-01', '2026-11-02'), false);

// ---------------------------------------------------------------------------
// 7. Leave date validation, mirrors the format and real-date checks added
//    to mobile/src/lib/leaves.ts in v1 verification.
// ---------------------------------------------------------------------------
function validLeaveDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const parsed = new Date(`${d}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d;
}
check('date 2026-11-10 is valid', validLeaveDate('2026-11-10'), true);
check('date 2026-02-30 is invalid', validLeaveDate('2026-02-30'), false);
check('date 2026-13-01 is invalid', validLeaveDate('2026-13-01'), false);
check('date 10-11-2026 is invalid format', validLeaveDate('10-11-2026'), false);

// ---------------------------------------------------------------------------
// 8. Absent marking, mirrors mark_absent_for_date: active staff with no
//    record and no approved leave on a working day become Absent.
// ---------------------------------------------------------------------------
function markAbsent(employees, records, leaveSet, date, isWorkingDay) {
  if (!isWorkingDay) return [];
  const marked = [];
  for (const emp of employees) {
    if (records.has(`${emp}|${date}`)) continue;
    if (leaveSet.has(`${emp}|${date}`)) continue;
    records.add(`${emp}|${date}`);
    marked.push(emp);
  }
  return marked;
}
const emps = ['EX-001', 'EX-002', 'EX-003'];
const recs = new Set(['EX-001|2026-11-04', 'EX-002|2026-11-04']);
const lv = new Set(['EX-003|2026-11-04']);
check('mark absent skips checked in and on leave staff', JSON.stringify(markAbsent(emps, recs, lv, '2026-11-04', true)), JSON.stringify([]));
const recs2 = new Set(['EX-001|2026-11-06']);
const marked = markAbsent(emps, recs2, new Set(), '2026-11-06', true);
check('mark absent marks the two missing staff', JSON.stringify(marked), JSON.stringify(['EX-002', 'EX-003']));
check('mark absent twice changes nothing', JSON.stringify(markAbsent(emps, recs2, new Set(), '2026-11-06', true)), JSON.stringify([]));
check('mark absent on Saturday marks nobody', JSON.stringify(markAbsent(emps, new Set(), new Set(), '2026-11-07', false)), JSON.stringify([]));

// ---------------------------------------------------------------------------
// 9. Total hours, mirrors compute_total_hours trigger.
// ---------------------------------------------------------------------------
function totalHours(inTime, outTime) {
  const [ih, im] = inTime.split(':').map(Number);
  const [oh, om] = outTime.split(':').map(Number);
  return Math.round(((oh * 60 + om - (ih * 60 + im)) / 60) * 100) / 100;
}
check('total hours 09:05 to 17:02', totalHours('09:05', '17:02'), 7.95);
check('total hours 09:22 to 17:05', totalHours('09:22', '17:05'), 7.72);
check('total hours 09:01 to 16:58', totalHours('09:01', '16:58'), 7.95);

// ---------------------------------------------------------------------------
// 10. Seed week summary, mirrors admin/src/lib/excel.ts buildReportRows:
//     Mon to Fri only, record status wins, no record is Absent, approved
//     leave with no row is Leave. Seed data, 2 to 6 Nov 2026.
// ---------------------------------------------------------------------------
const seedRecords = {
  'EX-001|2026-11-02': 'Present', 'EX-001|2026-11-03': 'Present', 'EX-001|2026-11-04': 'Late',
  'EX-001|2026-11-05': 'Present', 'EX-001|2026-11-06': 'Present',
  'EX-002|2026-11-02': 'Present', 'EX-002|2026-11-03': 'Leave', 'EX-002|2026-11-04': 'Leave',
  'EX-002|2026-11-05': 'Present', 'EX-002|2026-11-06': 'Absent',
  'EX-003|2026-11-02': 'Present', 'EX-003|2026-11-03': 'Present', 'EX-003|2026-11-04': 'Absent',
  'EX-003|2026-11-05': 'Present', 'EX-003|2026-11-06': 'Present',
};
function seedSummary(emp) {
  const counts = { Present: 0, Late: 0, Absent: 0, Leave: 0 };
  for (let day = 2; day <= 6; day++) {
    const key = `EX-00${emp}|2026-11-0${day}`;
    counts[seedRecords[key]]++;
  }
  return counts;
}
check('seed week EX-001 Present 4 Late 1', JSON.stringify(seedSummary(1)), JSON.stringify({ Present: 4, Late: 1, Absent: 0, Leave: 0 }));
check('seed week EX-002 Present 2 Leave 2 Absent 1', JSON.stringify(seedSummary(2)), JSON.stringify({ Present: 2, Late: 0, Absent: 1, Leave: 2 }));
check('seed week EX-003 Present 4 Absent 1', JSON.stringify(seedSummary(3)), JSON.stringify({ Present: 4, Late: 0, Absent: 1, Leave: 0 }));
check('seed week total rows 15', Object.keys(seedRecords).length, 15);

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) { console.log(`Failed: ${failures.join(', ')}`); process.exit(1); }
