# LGU Attendance App, v1 Test Log

Date: 5 November 2026. Scope: verification to a testable state. No EAS build,
no Play Store publish, no GitHub push, no paid account was used.

## 1. Typecheck and build

| Check | Command | Result |
|---|---|---|
| Mobile TypeScript typecheck | `cd mobile && npx tsc --noEmit` | Pass, 0 errors. First run found 1 error (see fix 1), rerun clean. |
| Admin production build | `cd admin && npm run build` | Pass. First run failed on `import.meta.env` types (see fix 2), rerun clean. Output `dist/index.html` plus assets, 705 kB JS (215 kB gzip). One non-blocking Vite warning: chunk larger than 500 kB, code splitting not done in v1. |
| Admin preview serve | `npx vite preview --port 4173`, curl `/` | HTTP 200, index.html served with the built bundle. |
| Dependency install | `npm install` in `mobile/` and `admin/` | Pass. Mobile 890 packages, admin 88 packages plus vitest 2.1.9 (31 packages). Warnings only: deprecated transitive packages (rimraf, glob, tar, uuid, xmldom) from Expo 52 tooling. |

## 2. Logic tests, 43 passed, 0 failed

Run: `node tests/logic-tests.mjs`. The haversine and working-days functions
are extracted from the real source files and executed, not copied. SQL rules
are simulated with the exact predicates used in `supabase/schema.sql` and
`mobile/src/lib/leaves.ts`.

| Group | Cases | Result |
|---|---|---|
| Haversine (real function, office 31.4640, 74.4427) | Same point 0 m; 50 m north 49.9 m; 150 m north 149.8 m; 100 m boundary 99.9 m; 100 m east 99.9 m; 50 m inside radius; 150 m outside radius | 7 passed |
| Working days (real function) | Mon 2 to Fri 6 Nov 2026 is 5; Fri 6 to Mon 9 Nov is 2; Sat 7 to Sun 8 Nov is 0; Tue 3 to Wed 4 Nov is 2; single Monday 1; single Saturday 0 | 6 passed |
| Late rule (Late when time is after 09:15) | 09:05 Present; 09:15 exactly Present; 09:16 Late; 09:22 Late | 4 passed |
| One check in per day (unique employee plus date) | First accepted; second same day rejected; next day accepted; different employee same day accepted | 4 passed |
| Check in blocked on approved leave | EX-002 blocked 3 Nov; allowed 5 Nov; EX-001 allowed 3 Nov | 3 passed |
| Leave overlap | Overlapping refused; day after ends allowed; inside existing refused; ending day before starts allowed | 4 passed |
| Leave date validation | 2026-11-10 valid; 2026-02-30 invalid; 2026-13-01 invalid; 10-11-2026 invalid format | 4 passed |
| Absent marking | Skips checked in and on leave; marks the two missing staff; second run changes nothing; Saturday marks nobody | 4 passed |
| Total hours | 09:05 to 17:02 is 7.95 h; 09:22 to 17:05 is 7.72 h; 09:01 to 16:58 is 7.95 h | 3 passed |
| Seed week summary (2 to 6 Nov 2026) | EX-001 Present 4 Late 1; EX-002 Present 2 Leave 2 Absent 1; EX-003 Present 4 Absent 1; 15 rows total | 4 passed |

## 3. Excel builder tests, 5 passed, 0 failed

Run from `admin/`:
`VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_ANON_KEY=demo-key npx vitest run src/lib/excel.test.ts`
(Dummy env values only stop `supabase.ts` throwing at import time. No
network call is made.) The tests run the real `buildReportRows` and
`buildSummary` from `admin/src/lib/excel.ts` on the demo seed data.

| Test | Result |
|---|---|
| One row per employee per working day, weekends excluded (3 x 21 = 63 rows for Nov 2026) | Pass |
| Seed week statuses kept exactly (Late, Leave with Sick type, Absent, check in time, total hours, missing check out as dash) | Pass (first run failed only on my test expecting "09:05 AM" while the `en-PK` locale returns "09:05 am"; the app code was correct, the expectation was fixed) |
| Approved leave shows as Leave even with no attendance row | Pass |
| Local PKT date keys, leave day never shifts to the previous day | Pass |
| Monthly summary counts (Ahmed Present 4 Late 1 Absent 16; Sara Present 2 Leave 2 Absent 17, taken 2, balance 18; Bilal Present 4 Absent 17, total 23.76 h) | Pass |

## 4. Screen walkthrough (code review, no phone yet)

Every screen was read as a real user would use it. No live phone test was
possible in this environment (no device, no Supabase project, no EAS build
without approval). Live testing is the next step after the user approves.

| Screen | Walkthrough | Result |
|---|---|---|
| Mobile Login | Email and password, error on wrong login, note about one account per employee | OK |
| Mobile Home (profile, today, check in, check out) | Shows name, ID, designation, today times, status pill, leave balance, recent 14 days. Check In disabled after check in or on leave. Check Out disabled before check in or after check out. Radius, hours and late cutoff shown. | OK |
| Mobile Check In screen | No separate screen. Check in lives on Home by design. `CheckIn.tsx` documents that decision. | By design, not a bug |
| Mobile History | Last 90 days, Leave shows type, Absent shows "No check in, no approved leave" | OK |
| Mobile Apply for Leave | Type picker, YYYY-MM-DD dates, working day count, reason required, note optional | OK, date validation added (fix 5) |
| Mobile My Leaves | Balance card, request list with Approved, Pending, Rejected pills, HOD note shown | OK |
| Admin Login | HOD sign in | OK |
| Admin Dashboard (Today) | Present, Late, On Leave, Absent lists with counts, checked out count, full table, Mark absent button | OK, weekend note added (fix 7) |
| Admin Leave Requests | Pending first, approve writes Leave days and reports skipped days, reject needs a reason | OK |
| Admin Employee Detail | Profile, leave balance, leave requests, month picker, individual Excel download | OK |
| Admin Monthly Report | Month picker, summary table, day by day table, full Excel download | OK |
| Admin Employees | Add employee form, deactivate (never delete) | OK, session warning added (fix 8) |
| Admin Settings | Office name, pin, radius, start, end, late cutoff, leave allowance | OK, working days added (fix 6) |

## 5. Fixes made during verification

1. `mobile/App.tsx`: type alias `View` clashed with the imported React Native
   `View` component and failed typecheck. Renamed to `ScreenView`.
2. `admin/src/vite-env.d.ts`: added (was missing), so `import.meta.env`
   typechecks and the admin build passes.
3. `supabase/schema.sql`: the ALTER adding `leave_id` referencing
   `public.leaves` ran before the leaves table was created, so a fresh
   install failed with "relation public.leaves does not exist". The leaves
   table is now created first.
4. `supabase/schema.sql`, `approve_leave`: a day marked Absent first and
   then approved as leave stayed Absent. It is now converted to Leave.
5. `mobile/src/lib/leaves.ts`: leave dates are now validated as real
   calendar dates in YYYY-MM-DD form (2026-02-30 is refused).
6. `admin/src/screens/Settings.tsx`: working days are now editable in the
   form, as the spec already claimed. They were not editable before.
7. `admin/src/screens/Dashboard.tsx`: a weekend day is now labelled as a
   non-working day, so the Absent list is not misread on Saturday or Sunday.
8. `admin/src/screens/Employees.tsx`: warns that adding an employee signs
   the browser in as the new employee, so the HOD signs back in after.
9. `admin/src/App.tsx`: the HOD role is now rechecked on every auth state
   change, not only on first load.
10. `mobile/assets/icon.png` and `splash.png`: created (simple LGU green
    placeholder branding). `app.json` referenced files that did not exist.
    Replace them with the official LGU logo when it is provided.
11. Office placeholder pin corrected to 31.4640, 74.4427 (public coordinates
    for LGU Main Campus, Sector C, DHA Phase 6). The old pin was about 3 km
    off. It is still a placeholder: the exact Examination Department office
    door pin is unknown and must be set in Settings before go live.
12. `admin/src/lib/excel.test.ts`: the test helper typed its leave type as
    `LeaveType` with a null default, which failed strict typecheck. The
    final build sweep caught it because the test file is inside the build
    include path. Fixed to `LeaveType | null`, build and tests rerun clean.

## 6. What is NOT tested yet

- No live Supabase project exists for this app, so login, check in with a
  real phone, fingerprint prompt, GPS fix, leave approval, and the mark
  absent RPC have not run against a real database. The SQL was reviewed and
  the logic was tested, but a live run is still needed.
- No phone test: fingerprint and GPS do not work properly in a simulator.
  The first real test must be on a real Android phone at the office.
- No EAS build was run (needs the user approval). No APK exists yet.
- The sample Excel file `sample/LGU-Attendance-Full-2026-11-DEMO.xlsx` was
  generated from the seed data with the same columns as the admin export,
  for the report. It is a sample, not a file produced by the admin panel.

## 7. End-to-end test, 5 November 2026, 15:00 to 15:30 PKT

Full report: `E2E-TEST-REPORT.md`. Harness: `tests/e2e-screenshots.py`
(Playwright, headless Chromium). The real admin build and the real Expo
web export were driven in the browser; Supabase Auth and PostgREST were
intercepted and answered from the seed data, because no live Supabase
project exists. Screenshots: 26 real PNG files in `screenshots/`, plus
the Excel downloaded from the admin panel during the run
(`screenshots/LGU-Attendance-Full-2026-11-E2E.xlsx`, 63 rows).

Result: 26 checks, 0 failed. Logic tests 43 passed, Excel tests 6 passed
(was 5, one regression test added), mobile typecheck clean, admin build
clean, no console errors in either app.

Bugs found by the E2E run, all fixed and re-tested in the same session:
1. Mobile app rendered a blank screen: `package.json` main was `App.tsx`
   with no entry file calling `registerRootComponent`. The web export and
   the web dev server both rendered an empty page. Fixed with
   `mobile/index.js` (registerRootComponent) and main set to `index.js`.
   The same entry is used for the Android build, so the APK would have
   had the same fault.
2. The HOD was counted as absent staff (Staff 4, Absent 1, the HOD).
   Dashboard and Monthly Report now exclude role `hod`, and
   `mark_absent_for_date` in `schema.sql` only marks `role <> 'hod'`.
3. Leave balance always showed 0 on screen and in Excel: the balances
   map was keyed by database UUID while `buildSummary` looks it up by
   employee code. Both screens now key by employee code, a comment in
   `excel.ts` states the rule, and a regression test was added. After
   the fix: Ahmed 0 taken / 20 left, Sara 2 / 18, Bilal 2 / 18.

Still not tested: real fingerprint (no sensor on this VM, the app reached
the biometric step and was refused), real phone GPS at the office door,
live Supabase Auth/RLS/RPCs, and any EAS build or APK.

## 6. UI rebuild v3, 5 November 2026

Dev text and AI feel removed from the presentation layer only.

| Check | Result |
|---|---|
| Mobile TypeScript typecheck | Pass, 0 errors. |
| Admin production build | Pass. |
| Core logic tests (`node tests/logic-tests.mjs`) | 43 passed, 0 failed. |
| Excel builder tests (`npx vitest run src/lib/excel.test.ts`) | 6 passed, 0 failed. |
| E2E v3 (`python3 tests/e2e-screenshots-v3.py`) | 26 checks, 0 failed (25 PASS, 1 CHECK, the known add-employee session switch). |
| Dev-text grep over mobile/src, admin/src, App.tsx | No "(DEMO)", demo email, "HOD Admin Panel", "at a glance", "Active employees" or "Finished for the day" in any user-visible file. Remaining tags are in seed.sql, the Excel test fixture and code comments only. |
| Em-dash scan | 0 matches. |
| Excel from the v3 run | 63 data rows, names Ahmed Khan, Bilal Ahmed, Sara Malik. Balances Ahmed 0/20, Bilal 2/18, Sara 2/18. |

Fixes found by the v3 test run:
1. The leave form was not scrollable and the bottom tab bar covered
   the date picker days, so day 10 could not be tapped. Fixed: the
   form is now a ScrollView and screen content has 96 px bottom
   padding. Harness rerun clean.
2. The harness expected the old mark-absent message. Updated to the
   new wording. No app code changed.

Still not tested: real fingerprint (no sensor on this VM, the app
reached the biometric step and was refused), real phone GPS at the
office door, live Supabase Auth/RLS/RPCs, and any EAS build or APK.

## 7. Demo login mode, 5 November 2026

The user installed the v1 APK and was stuck on the Staff sign in screen,
because no live Supabase project exists and no real login works. Demo
mode was added so he can get inside the app with one tap.

| Check | Result |
|---|---|
| Mobile TypeScript typecheck | Pass, 0 errors. |
| Core logic tests (`node tests/logic-tests.mjs`) | 43 passed, 0 failed. |
| Excel builder tests (`npx vitest run src/lib/excel.test.ts`) | 6 passed, 0 failed. |
| Demo E2E (`python3 tests/e2e-screenshots-demo.py`) | 11 checks, 0 failed, no console errors. Real Expo web export built with no Supabase env vars at all, which proves the app no longer throws at import without them. |
| Em-dash scan over changed files and docs | 0 matches. |

Demo E2E checks: login shows the Try demo button; real sign in without
a live database shows the setup message; Try demo opens Ahmed Khan home
with the Demo pill; demo state stored locally (`lgu_demo_state_v1`,
`lgu_demo_active_v1`); history shows the seed rows grouped by month;
check in inside the radius reaches the biometric step and is refused
with "This phone has no fingerprint or face sensor" on this VM, no
check-in written; leave apply through the picker saved locally and
stays Pending; My Leaves shows the pending request and 20 days balance;
demo session restored after reload; demo sign out returns to login.
Screenshots in `screenshots-demo/` (7 PNGs). One fix found by checking
the screenshots: the first demo-checkin shot was identical to home
because the error banner sits below the fold; the harness now scrolls
it into view before the shot.

Still not tested: fingerprint accept and real GPS at the office door
need a real phone, which needs the next APK build. No EAS build, no
GitHub push, no publish was done in this task.
