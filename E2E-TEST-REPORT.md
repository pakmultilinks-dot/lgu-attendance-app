# LGU Attendance App v1, End-to-End Test Report

Date: 5 November 2026, 15:00 to 15:30 PKT (test day: Thursday, 5 November 2026).
Tester: E2E run on this VM, headless Chromium, real app code, no phone.
Harness: `tests/e2e-screenshots.py` (Playwright). Re-run it with:
`python3 tests/e2e-screenshots.py` while the admin preview runs on
`http://127.0.0.1:4173` and the mobile web export is served on
`http://127.0.0.1:8080`.

## How this test was done, honestly

There is no live Supabase project yet, so Supabase Auth and PostgREST calls
to `https://demo.supabase.co` were intercepted in the browser and answered
from an in-memory copy of the demo seed data (`supabase/seed.sql`, 15
attendance rows, 2 to 6 Nov 2026, 3 demo staff plus the demo HOD). The app
code, the screens, the buttons, the GPS math, the leave validation and the
Excel builder are all the real production code. The database behind them is
a mock that follows `supabase/schema.sql` (same RPC rules for approve,
reject, mark absent, check in and check out). Nothing in this report claims
a live database, a real phone, a fingerprint sensor, or a real GPS fix was
used. What was mocked is listed under each result below.

The mobile app was tested through the real Expo web build. The web export
needed `react-dom`, `react-native-web`, `@expo/metro-runtime` and
`expo-asset`, which are NOT in the project: they were installed into a
scratch copy only (`~/workspace/.e2e-mobile-web`, deleted after the run),
so the project itself is unchanged by the web test. The mobile screenshots
are 390 by 844, phone size. Geolocation was set by the browser: office pin
31.4640, 74.4427 for inside the radius, 31.5000, 74.5000 for outside it.

## Results: 26 checks, 0 failed

Unit and logic tests re-run in the same session, after the fixes below:
logic tests `node tests/logic-tests.mjs`: 43 passed, 0 failed. Admin Excel
tests `npx vitest run src/lib/excel.test.ts`: 6 passed, 0 failed (was 5,
one regression test added). Mobile typecheck `npx tsc --noEmit`: pass,
0 errors. Admin production build `npm run build`: pass.

| # | Flow tested | Result | What the screenshot shows |
|---|---|---|---|
| 1 | Admin login, wrong password | PASS | Error "Wrong email or password", stayed on login |
| 2 | Admin login, correct password | PASS | HOD session, dashboard loads |
| 3 | Admin dashboard today lists | PASS | Staff 3, Present 3, Late 0, On leave 0, Absent 0, Checked out 3 (values read from the page, not assumed) |
| 4 | Mark absent button, nobody unmarked | PASS | Button disabled when absent count is 0 |
| 5 | Mark absent, simulated day | PASS | Bilal missing (simulated, see below), button enabled, "Marked 1 employee(s) Absent", Absent list updated |
| 6 | Leave Requests list | PASS | Pending Bilal Annual 9-10 Nov first, approved Sara Sick 3-4 Nov below |
| 7 | Reject leave without a reason | PASS | Error "Write a reason before rejecting", stayed Pending |
| 8 | Approve leave | PASS | "Approved Bilal Ahmed leave. 2 Leave day(s) written." |
| 9 | Employee detail, Ahmed EX-001 | PASS | Nov 2026 rows, leave balance 20 left of 20 |
| 10 | Monthly report + Excel download | PASS | Summary + 63 day rows on screen; downloaded file verified: Attendance sheet 63 rows, Summary sheet 3 staff, balances correct after fix 3 |
| 11 | Employees list + add employee | CHECK | Form works, new employee added, success shown. Known behaviour: after sign up the browser is signed in as the new employee, so the HOD-only banner appears. Session was restored and the dashboard loaded again. |
| 12 | Settings save | PASS | Radius 100 to 120 saved, success shown, then changed back to 100 |
| 13 | Admin console errors | PASS | No console errors or page errors (the HTTP 400 from the wrong-password login is expected and was cleared from the log) |
| 14 | Mobile login, wrong password | PASS | Error "Wrong email or password", stayed on login |
| 15 | Mobile home, fresh user | PASS | EX-004 test employee, "You have not checked in yet today", Check In enabled |
| 16 | Mobile check in, inside radius | PASS | GPS passed, then "This phone has no fingerprint or face sensor." No check-in row was written |
| 17 | Mobile check in, outside radius | PASS | "You are 6749 metres from the office. Check in works only within 100 metres." Biometric never reached |
| 18 | Mobile check out, checked in user | PASS | Bilal checked in 09:03, Check Out enabled, biometric refused on this VM, no check-out written |
| 19 | Mobile home, Ahmed | PASS | Checked in 09:04, out 17:01, 7.95 h, both buttons disabled |
| 20 | Mobile history, 90 days | PASS | Present, Late (4 Nov) and Absent rows with badges |
| 21 | Leave apply, invalid date | PASS | 2026-02-30 refused: "That date does not exist." Nothing submitted |
| 22 | Leave apply, valid request | PASS | Casual 9-10 Nov 2026, 2 working days, "Leave request sent to the HOD" |
| 23 | Leave apply, overlapping request | PASS | Second request over 10-11 Nov refused: "You already have a pending or approved leave covering those dates." |
| 24 | My Leaves and balance | PASS | Casual 9-10 Nov Pending, "20 days left of 20 allowed (0 taken)" |
| 25 | Mobile console errors | PASS | No console errors or page errors |
| 26 | Logic + unit tests re-run | PASS | 43 logic, 6 Excel, mobile typecheck clean |

## Screenshots (real files)

All PNGs are in `screenshots/`, captured by headless Chromium from the
running apps, not from a browser session view.

Admin (1280 by 900):
- `01-admin-login.png`, login form with wrong-password error
- `02-admin-dashboard.png`, today dashboard after HOD login
- `03-admin-dashboard-mark-absent.png`, dashboard in the simulated Bilal-missing day, button enabled
- `03b-admin-dashboard-mark-absent-done.png`, after tapping Mark absent, "Marked 1 employee(s) Absent"
- `04-admin-leave-requests.png`, leave requests list
- `05-admin-leave-request-reject-error.png`, reject with no reason, error shown
- `06-admin-leave-request-approved.png`, Bilal leave approved, 2 days written
- `07-admin-employee-detail.png`, Ahmed EX-001 monthly view (full page)
- `08-admin-monthly-report.png`, November 2026 summary and day-by-day (full page)
- `09-admin-employees.png`, employees list and add form
- `10-admin-employees-added.png`, new employee added, HOD-only banner visible
- `11-admin-settings.png`, office settings form
- `12-admin-settings-saved.png`, settings saved message

Mobile (390 by 844):
- `20-mobile-login.png`, staff sign in
- `21-mobile-login-error.png`, wrong password error
- `22-mobile-home-ahmed.png`, Ahmed today, 7.95 h, both buttons disabled
- `23-mobile-history-ahmed.png`, 90-day history with Late badge
- `24-mobile-home-testuser.png`, EX-004 fresh user, not checked in
- `25-mobile-checkin-outside-radius.png`, 6749 m refusal
- `26-mobile-checkin-biometric.png`, inside radius, no fingerprint sensor
- `27-mobile-home-bilal.png`, Bilal checked in 09:03, not checked out (simulated)
- `27b-mobile-checkout-biometric.png`, check out, biometric refused
- `28-mobile-leave-apply-invalid.png`, 2026-02-30 refused
- `29-mobile-leave-apply-submitted.png`, Casual leave submitted
- `30-mobile-leave-apply-overlap.png`, overlapping request refused
- `31-mobile-leaves.png`, my leaves, Pending, balance 20 days left

Also in `screenshots/`: `LGU-Attendance-Full-2026-11-E2E.xlsx`, the Excel
file downloaded from the admin Monthly Report during the test (Attendance
63 rows, Summary 3 staff; Ahmed taken 0 balance 20, Bilal taken 2 balance
18, Sara taken 2 balance 18).

## Bugs found by this E2E run, and fixed

### Bug 1 (critical): the mobile app rendered a blank screen
`mobile/package.json` had `"main": "App.tsx"` and there was no entry file
calling `registerRootComponent`. The Expo web export and the Expo web dev
server both loaded the bundle and rendered nothing: empty `#root`, no
error. The same entry point is used for the Android build, so the APK
would have had the same fault. Fix: added `mobile/index.js` with
`registerRootComponent(App)` and set `"main"` to `index.js`. After the
fix the login screen renders. Verified by the mobile screenshots above.

### Bug 2: the HOD was counted as absent staff
The Dashboard and the Monthly Report listed every active employee,
including the HOD, and the HOD has no check-in record, so the dashboard
showed Staff 4, Absent 1 (the HOD), and "Mark absent for today" would
have marked the HOD Absent. Fix: Dashboard and Monthly Report exclude
`role === 'hod'` from staff lists, and `mark_absent_for_date` in
`supabase/schema.sql` now only loops over `role <> 'hod'`. After the fix
the dashboard shows Staff 3, Absent 0.

### Bug 3: leave balance always showed 0
`buildSummary` in `admin/src/lib/excel.ts` looks the balance up by
employee code (EX-001), but MonthlyReport and EmployeeDetail built the
balances map keyed by database UUID. Every lookup missed, so Leave Taken
and Leave Balance were 0 for everyone on screen and in the downloaded
Excel. The unit test passed because it keyed the map by code, while the
screens keyed it by UUID. Fix: both screens now key the map by employee
code, a comment in `excel.ts` states the key rule, and a regression test
was added (`excel.test.ts`, 6 tests now) that builds the map the way the
screens do. After the fix the Excel shows Ahmed 0 taken / 20 left, Sara
2 taken / 18 left, Bilal 2 taken / 18 left (his Annual leave was approved
during this E2E run).

## What was mocked, exactly

- Auth: login and sign up answered by the mock; passwords accepted for
  demo accounts are `demo-pass-123` only, anything else is refused.
- Data: the 15 seed attendance rows, the 3 demo staff, the demo HOD, the
  office settings (pin 31.4640, 74.4427, radius 100 m, 09:00 to 17:00,
  Late after 09:15, Mon to Fri, 20 leave days a year).
- Mock-only additions, not in `seed.sql`: Bilal's pending Annual leave
  9-10 Nov 2026 (so approve/reject could be tested); EX-004 "E2E Test
  (DEMO)" employee (so a fresh check-in with no record today could be
  tested); the simulated Bilal-missing day for mark absent (his 5 Nov
  record removed in the mock only); the simulated Bilal-not-checked-out
  state for check out (his 5 Nov check-out removed in the mock only, the
  seed has him out at 17:02).
- The mock RPCs re-implement the SQL in `schema.sql`, including the
  one-check-in-per-day unique rule, the leave-day conversion of Absent
  rows on approval, and the working-days-only leave count.

## What was NOT tested, and still needs a real phone and a live project

- Fingerprint: this VM has no fingerprint or face sensor. The app reached
  the biometric step and was refused with "This phone has no fingerprint
  or face sensor." A real fingerprint accept or reject has never been
  seen. That test must happen on a real Android phone.
- Real GPS: the GPS distances came from browser geolocation set by the
  test (office pin and a far point). A real phone fix at the office door
  has never been taken, and the exact office door pin is still a
  placeholder (campus area, 31.4640, 74.4427).
- Live Supabase: no project exists yet, so real Auth accounts, real RLS
  policies, and the real SQL RPCs have never run. The SQL was reviewed
  and the mock follows it, but the first live run is still needed.
- No EAS build, no APK, no GitHub push, no Play Store publish was done
  in this run. Those need the user's approval.
- The sample Excel in `sample/` is from the earlier verification, not
  from this run. The Excel from this run is in `screenshots/` (see above).

---

## UI rebuild v2, 5 November 2026 (this section)

The user rejected the v1 screenshots as totally shit, AI-looking, plain
template. He was right: flat green bar, bare grey cards, no hierarchy.
The visual layer was rebuilt from scratch. Logic, database, Excel,
leave, absent, GPS and biometric flows are unchanged. Full design detail
is in SPEC.md under "UI rebuild v2".

### How the v2 test was done

Harness: `tests/e2e-screenshots-v2.py`, a copy of the v1 harness with
only the output folder changed to `screenshots-v2/`. Admin preview on
`http://127.0.0.1:4173`, mobile web export on `http://127.0.0.1:8080`,
Supabase mocked from seed data exactly as in v1. No harness selector
fixes were needed: every visible string was kept verbatim through the
rebuild. The mobile web export needed pinned web deps in the scratch
copy only (`react-dom@18.3.1`, `react-native-web@^0.19.13`,
`@expo/metro-runtime@~4.0.0`, `expo-asset@~11.0.0`; `react-dom@latest`
now needs React 19, the project is React 18.3.1). Scratch copy deleted
after the run, test servers stopped, v1 `screenshots/` untouched.

### Results: 26 checks, 0 failed (25 PASS, 1 CHECK)

Same 26 checks as v1, same outcome. The one CHECK is the known
add-employee session switch (after sign up the browser is signed in as
the new employee, HOD-only banner appears, session restored after).
Unit counts re-run in the same session: logic tests 43 passed, 0 failed;
Excel tests 6 passed, 0 failed; mobile typecheck 0 errors; admin
production build pass. Excel verified with openpyxl: Attendance sheet
63 data rows, Summary 3 staff, balances Ahmed 0 taken / 20 left, Bilal
2 / 18, Sara 2 / 18.

Admin (14 checks): login error, HOD login, dashboard stats read from
the page (Staff 3, Present 3, Late 0, On leave 0, Absent 0, Checked out
3), mark-absent disabled then enabled on the simulated Bilal-missing
day ("Marked 1 employee(s) Absent"), reject-without-reason blocked,
approve writes 2 Leave days, employee detail, monthly report plus Excel
download, add employee (CHECK, see above), settings save 100 to 120
and back, no console errors.

Mobile (12 checks): login error, EX-004 fresh user home, check-in
inside radius reaches biometric step and is refused ("This phone has no
fingerprint or face sensor"), leave invalid date refused, valid leave
submitted, overlap refused, my leaves plus balance, outside-radius
refusal ("You are 6749 metres from the office"), Bilal check-out reaches
biometric step, Ahmed home 7.95 h, 90-day history with Late badge, no
console errors.

### Screenshots (real files, `screenshots-v2/`)

Admin (1280 by 900): `01-admin-login.png` through
`12-admin-settings-saved.png`, including `02-admin-dashboard.png`
(sidebar, stat cards, Present list with avatars),
`04-admin-leave-requests.png` (pending as cards),
`08-admin-monthly-report.png` (full page). Mobile (390 by 844):
`20-mobile-login.png` through `31-mobile-leaves.png`, including
`22-mobile-home-ahmed.png` (profile card, Today timeline, day progress,
circular fingerprint button), `25-mobile-checkin-outside-radius.png`,
`26-mobile-checkin-biometric.png`. Also
`LGU-Attendance-Full-2026-11-E2E.xlsx` (43,020 bytes). All 26 PNGs
verified as real PNG image data via `file`, sizes 45 KB to 593 KB.
Key screenshots were read and confirmed not blank: 01, 02, 04, 20, 22,
25, 26.

### Bug found by checking the v2 screenshots, and fixed

Mobile avatars showed "A(" for Ahmed Khan and "E(" for the E2E test
user. Cause: `initialsOf` in `mobile/src/screens/Home.tsx` took the
first letter of the first word and the first letter of the last word,
and the last word was the "(DEMO)" tag. Fix: parenthetical tags are
dropped before taking initials, first two real words are used. The E2E
harness was rerun after the fix and the screenshots regenerated; the
avatar now shows "AK" (verified in
`screenshots-v2/22-mobile-home-ahmed.png`).

### Finding from the v2 test run, needs a decision before any APK build

The first mobile web export rendered a blank screen with the page error
"Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY."
Cause: `mobile/src/lib/supabase.ts` throws at import when those vars
are missing, and the mobile project has no `.env` file (only
`.env.example`), while `admin/` ships a `.env` with the demo values.
It was fixed test-side only (demo vars in the scratch copy, `--clear`
on export). The same throw would blank the APK if the EAS build
environment has no env vars set. Either ship a demo `.env` in mobile
mirroring admin, or set the vars in EAS. Do not build until this is
decided.

### Still plain, honestly

The large fingerprint button is a solid green disc with a small ring
glyph, not a recognisable fingerprint drawing; a proper fingerprint mark
needs a real vector asset. Leave Apply dates are still typed as
YYYY-MM-DD text (no date picker dependency). History is still one long
list with no month grouping. The admin login brand side uses a text
"LGU" monogram, not the real LGU crest, because no logo file exists in
the repo. Dense admin tables still scroll horizontally on narrow phones.
Top bar does not show the signed-in HOD name (would need an extra fetch).

### Honest limits (unchanged from v1)

No fingerprint or face sensor on this VM, GPS was browser-set (office
pin 31.4640, 74.4427; far point 31.5000, 74.5000), Supabase was mocked
from seed data (no live project, no real Auth/RLS/RPCs), no real phone
test, no EAS build, no APK, no GitHub push, no Play Store publish.

## UI rebuild v3, 5 November 2026

The user said v2 was looking good but still had dev text and AI feel.
Both were fixed in the presentation layer only. Harness:
`tests/e2e-screenshots-v3.py`, a copy of the v2 harness with the
output folder changed to `screenshots-v3/`, mock names and emails
cleaned (no demo tags anywhere on screen), and the leave flow updated
for the new date picker. Admin preview on `http://127.0.0.1:4173`,
mobile web export on `http://127.0.0.1:8080`, Supabase mocked from
seed data exactly as in v1 and v2. The mobile export needed the same
pinned web deps in the scratch copy only
(`~/workspace/.e2e-mobile-web`, deleted after the run), plus
`react-native-svg`, which is now a real project dependency. Scratch
copy deleted after the run, test servers stopped, v1 and v2
`screenshots/` folders untouched.

### Dev text removed (checked by grep after the rebuild)

No "(DEMO)", demo email, "HOD Admin Panel", "at a glance", "Active
employees" or "Finished for the day" remains in any file the user can
see. Remaining "(DEMO)" occurrences are only in `supabase/seed.sql`,
the Excel test fixture and code comments. Verified: the downloaded
Excel from the v3 run has 63 data rows and names Ahmed Khan, Bilal
Ahmed, Sara Malik, with balances Ahmed 0 taken / 20 left, Bilal 2 /
18, Sara 2 / 18. The top bar shows the signed-in Head of Department
by name; its avatar reads "HO" in the test screenshots because the
test HOD record has no personal name, only the title, and with a real
HOD name the initials will be correct.

### AI feel removed

All text-glyph icons are real inline SVG icons in both apps,
including a fingerprint vector in the check-in button and on the
sign-in card. Leave dates are picked from a month/year/day picker:
February shows 28 days only, so 30 February cannot be picked. The
valid leave request (Casual, 9 to 10 Nov 2026) and the overlapping
request refusal were both tested through the picker. History is
grouped under a "November 2026" heading. Mobile has a bottom tab bar
(Today, History, Apply Leave, My Leaves) with SVG icons.

### Results: 26 checks, 0 failed (25 PASS, 1 CHECK)

Same 26 checks as v1 and v2, same outcome. The one CHECK is the known
add-employee session switch (after sign up the browser is signed in
as the new employee, the Head of Department-only banner appears,
session restored after). Unit counts re-run in the same session:
logic tests 43 passed, 0 failed; Excel tests 6 passed, 0 failed;
mobile typecheck 0 errors; admin production build pass.

Admin (14 checks): login error, sign in, dashboard stats read from
the page (Staff 3, Present 3, Late 0, On leave 0, Absent 0, Checked
out 3), mark-absent disabled then enabled on the simulated
Bilal-missing day ("Marked 1 absent for today"), reject-without-reason
blocked, approve writes 2 Leave days, employee detail, monthly report
plus Excel download, add employee (CHECK, see above), settings save
100 to 120 and back, no console errors.

Mobile (12 checks): login error, Usman Tariq home, check-in inside
radius reaches biometric step and is refused ("This phone has no
fingerprint or face sensor", text verified in the page; the message
sits below the fold in screenshot 26), leave picker has no 30th day
in February, valid leave submitted through the picker, overlap
refused, my leaves plus balance, outside-radius refusal ("You are
6749 metres from the office"), Bilal check-out reaches biometric
step, Ahmed home 7.95 h, month-grouped history with Late badge, no
console errors.

### Screenshots (real files, `screenshots-v3/`)

Admin (1280 by 900): `01-admin-login.png` through
`12-admin-settings-saved.png`, including `02-admin-dashboard.png`
(sidebar, SVG stat icons, top bar with the Head of Department name).
Mobile (390 by 844): `20-mobile-login.png` through `31-mobile-leaves.png`,
including `22-mobile-home-ahmed.png` (clean name, no email line,
fingerprint vector, bottom tab bar), `28-mobile-leave-apply-invalid.png`
(February picker, 28 days), `23-mobile-history-ahmed.png`
("November 2026" grouping). Also
`LGU-Attendance-Full-2026-11-E2E.xlsx` (42,558 bytes). All 26 PNGs
verified as real PNG image data via `file`. Key screenshots were read
and confirmed not blank: 01, 02, 22, 23, 24, 26, 28.

### Bugs found by the v3 test run, and fixed

1. The leave form was not scrollable and the bottom tab bar covered
   the date picker days, so day 10 could not be tapped in the test.
   Fixed in the app: the form is now a ScrollView and screen content
   has 96 px bottom padding so it clears the tab bar. Harness rerun
   after the fix: 26 checks, 0 failed.
2. The harness expected the old mark-absent message ("Marked 1
   employee(s) Absent for today"). Updated to the new wording
   ("Marked 1 absent for today"). No app code changed for this one.

### Still plain, honestly

The admin login brand side still uses a text "LGU" monogram, not the
real LGU crest, because no logo file exists in the repo. Leave Apply
reason and note are still plain text fields, which is correct for
free text. The fingerprint vector is a drawn whorl, not a scanned
print, which is all a vector asset can be.

### Honest limits (unchanged from v1 and v2)

No fingerprint or face sensor on this VM, GPS was browser-set (office
pin 31.4640, 74.4427; far point 31.5000, 74.5000), Supabase was mocked
from seed data (no live project, no real Auth/RLS/RPCs), no real phone
test, no EAS build, no APK, no GitHub push, no Play Store publish.
