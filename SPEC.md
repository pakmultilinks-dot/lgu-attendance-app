# LGU Exam Department Attendance App, v1 Scaffold

Lahore Garrison University, Examination Department.
Employee attendance with phone fingerprint, 100 metre office radius, and automatic monthly Excel reports. HOD admin panel included.

## What this is

A staff attendance system, not a student system. Each employee installs the mobile app on their own phone, signs in with their own account, and taps Check In when they arrive and Check Out when they leave. The phone fingerprint confirms the person holding the phone is the device owner. The phone GPS confirms they are inside the office radius. The server records the time. The HOD sees everything in a web admin panel and downloads the monthly Excel report.

## Tech choices

| Part | Choice | Why | Cost |
|---|---|---|---|
| Mobile app | Expo React Native, TypeScript | One codebase for Android and iOS, fingerprint via Expo LocalAuthentication, GPS via expo-location | Free |
| Database and Auth | Supabase (Postgres + Auth + Row Level Security) | Free tier fits this data size, real Postgres, RLS keeps employees from seeing each other | Free tier |
| Admin panel | Vite React, TypeScript | Fast, small, deploys free | Free |
| Admin hosting | GitHub Pages (live since 2026-11-05) | Free static hosting, no new account | Free |
| Excel export | SheetJS (xlsx) in the admin panel | Monthly file generated in the browser from live data, no server needed | Free |

Vercel is NOT used for this project. The user banned Vercel for everything except KezTech. The admin panel is live at https://pakmultilinks-dot.github.io/lgu-attendance-app/ (gh-pages branch, built from admin/, verified HTTP 200, Sign in page renders). Netlify and Cloudflare Pages were tried first and both needed a browser login this machine does not have, so GitHub Pages was used instead. The build is configured for the /lgu-attendance-app/ subpath (base in admin/vite.config.ts, basename in admin/src/App.tsx, 404.html SPA fallback); a root-domain host needs base '/' again. The live panel uses the demo Supabase values, so sign-in does NOT work live until a real Supabase project replaces them.

## Free tier limits (honest numbers)

Supabase free tier, at time of writing: 500 MB database, 1 GB file storage, 50,000 monthly active users, 500,000 Edge Function invocations per month. This app uses only Auth and Postgres, no storage and no Edge Functions, so the practical limit is the 500 MB database. Attendance rows are tiny. Rough estimate: 50 employees x 22 working days x 12 months = 13,200 rows per year, well under 1 MB of data. The free tier is enough for years at department scale. If LGU ever wants the whole university on it, that is a paid-tier conversation, not a v1 problem.

Expo and EAS: building an APK with EAS is free on the free plan within its build limits. Publishing to Google Play costs a one time $25 developer account fee, paid by the account owner, not by this project. The free route for v1 is a direct APK download link shared with staff. See the Play Store note below.

## How a check in works

1. Employee opens the app. They are already signed in on their own phone.
2. They tap Check In.
3. The app reads the phone GPS. It computes the distance to the office pin with the haversine formula. If the distance is over the configured radius (default 100 metres), the button is refused with the distance shown.
4. The app asks for the phone fingerprint (or face, if the phone uses face unlock). This is `expo-local-authentication`. It only answers yes or no: this is the device owner. It never gives the app a fingerprint image or template.
5. On success, the app inserts one attendance row with the server timestamp. One check in per employee per day is enforced by a database unique constraint, so double taps and retries cannot create duplicates.
6. Check Out works the same way: GPS plus fingerprint, one per day, and the server computes total hours.

## Honest fingerprint limitation

Read this before promising anything to the HOD. Android and iOS do not let any app see or store a fingerprint. The biometric prompt only confirms that the person holding the phone right now unlocked it with the fingerprint or face enrolled on that phone. That is still useful, because it stops a colleague from tapping Check In on someone else's unlocked phone, but it is not a fingerprint database and it cannot prove identity by itself.

Proxy prevention in this app comes from four layers together, not from fingerprint alone:

1. Login: one Supabase Auth account per employee, created by the HOD. Passwords are never shared.
2. Device binding: the first phone an employee signs in on is recorded. A sign in from a different device is flagged in the admin panel and can be blocked by the HOD until approved.
3. GPS: check in only works inside the office radius, and the GPS coordinates are stored with every record.
4. Server time: timestamps come from the database server (`now()`), never from the phone clock, so changing the phone time does nothing.

What this cannot stop: an employee handing their own unlocked phone to a colleague who is standing inside the office with them. No phone app can stop that. A future v2 could add a selfie check or a QR code at the office door, but v1 does not claim to solve it.

## GPS spoofing note

Android phones can install fake GPS apps, and rooted phones can spoof location. This app checks the mock location flag where the OS reports it (`expo-location` returns `mocked` on Android when the system reports a mock provider). A mocked reading is refused and logged. This catches casual spoofing. It does not catch a rooted phone with a system level spoofer that hides the flag. If the HOD suspects spoofing, the honest answer is that a phone app alone cannot fully prevent it, and a door QR code or a supervisor spot check is the practical control.

## Attendance rules (v1)

- One check in and one check out per employee per day. Enforced in Postgres with a unique constraint on (employee_id, work_date) plus a check that check_out is after check_in.
- Late cutoff: configurable in office settings (default 09:15). Check in after the cutoff is marked Late. Check in on or before it is Present.
- Absent: no record for a working day. The monthly report lists working days with no record as Absent. Working days are Monday to Friday by default, configurable in settings.
- Leave: the HOD marks leave in the admin panel. Leave days show as Leave, not Absent.
- Leave requests (v2): an employee applies in the app with a type (Casual, Sick, Annual, Emergency, Other), dates, a reason, and an optional note. The HOD approves or rejects in the admin panel, with a reason. Approval writes one Leave row per working day in the range. A rejected request writes nothing.
- Absent (v2): a working day with no check in and no approved leave is Absent. It is written by the HOD tapping "Mark absent for today" in the admin panel after office hours, or by the `mark_absent_for_date` RPC. There is no automatic background job on the Supabase free tier, so v1 does not pretend marking runs itself. Until the HOD marks it, the dashboard shows that employee in the Absent list as "not marked yet", and the monthly report shows the day as Absent.
- Leave balance: one yearly allowance setting in office settings (default 20 days per year). Balance is allowance minus approved Leave days taken in the calendar year, counted in working days only. It is shown in the app, on the employee detail page, in the monthly summary, and in the Excel Summary sheet.
- Total hours: check_out minus check_in, computed in the database and shown in the app and the report.
- Office timings: configurable start and end time in office settings. They drive the Late cutoff and the report, they do not block check in outside hours in v1. An employee who arrives early can still check in.

## Excel reports

Two files, both generated from live Supabase data in the admin panel with SheetJS:

1. Individual monthly report: one employee, one month. Columns: name, employee ID, designation, date, check in, check out, total hours, status (Present / Late / Absent / Leave), leave type (Casual, Sick, Annual, Emergency, Other, or dash when not on leave), location verified (Yes / No).
2. Full monthly report: every employee, whole month, same columns, one sheet, plus a summary sheet with totals per employee (days present, late, absent, leave, leave taken in the year, leave balance in the year, total hours).

File names: `LGU-Attendance-<EmployeeID>-<YYYY-MM>.xlsx` and `LGU-Attendance-Full-<YYYY-MM>.xlsx`. Times are in Asia/Karachi.

## Admin panel (HOD)

Web app, HOD login only (role check in Supabase). Pages:

- Dashboard: today, split into four separate lists with counts: Present, Late, On Leave, Absent, plus checked out count and a "Mark absent for today" button. Every employee also appears in one full table for today.
- Leave Requests: pending requests first, each with type, dates, reason, and note. Approve writes the Leave days. Reject requires a reason, which the employee sees in the app.
- Employee detail: search any employee, see their full history, their leave requests, their leave balance for the year, pick a month, download their Excel file.
- Monthly report: pick a month, see the whole department with Present, Late, Absent, Leave, leave taken, leave balance, and total hours per employee, download the full Excel file.
- Employees: add or remove employees, set designation, deactivate (never hard delete attendance history).
- Settings: office latitude and longitude, radius in metres, office start and end time, late cutoff, working days, annual leave allowance in days per year. Changing the pin takes effect immediately for the next check in.

## Security

- Supabase Auth for all logins. Passwords are hashed by Supabase, never stored in our tables.
- Row Level Security: employees can read only their own profile and their own attendance rows, and insert only their own rows. Only the HOD role can read all rows, manage employees, and change settings. Policies are in `supabase/schema.sql`.
- No secrets in code. The mobile app and admin panel read `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` from environment variables. The service role key is never shipped in an app.
- Audit log: every HOD action (add employee, change settings, mark leave, deactivate) is written to `admin_audit`.
- Data stays in Supabase Postgres. No data is sent to any third party.

## Play Store note

Google Play needs a one time $25 developer account fee and a signed release build (AAB). That fee cannot be avoided, so "free on Play Store" is not possible. The free v1 route is: build the APK with EAS (free tier), share the direct download link with staff, and let them install it directly. If LGU later pays the $25 and wants a Play listing, the same codebase builds the AAB with no code change.

## What is NOT in v1

- No salary or payroll calculation. Total hours are reported, pay is not computed.
- Check in is refused on a day with an approved Leave row, so an employee on leave cannot also record a Present day.
- Leave overlap: the app refuses a new request that overlaps a pending or approved leave. The HOD approving a leave never overwrites a day the employee already checked in on; that day is reported back as skipped.
- No push notifications (no "you forgot to check out" reminder yet, and no "leave request waiting" notification yet).
- No selfie or face photo capture.
- No offline mode. Check in needs internet at the moment of tapping, because the server timestamp is the record.
- No student attendance. Staff only.
- No iOS App Store build in v1 (needs an Apple Developer account, $99 per year).

## Project layout

```
lgu-attendance-app/
  SPEC.md                 this file
  README.md               setup and run guide
  OPEN_QUESTIONS.md       what the user still needs to provide
  supabase/schema.sql     tables, RLS, indexes, constraints, leave approve/reject and mark absent functions
  mobile/                 Expo React Native TypeScript app
    app.json
    package.json
    App.tsx
    src/lib/              supabase, location, biometric, attendance, leaves
    src/screens/          Login, Home, CheckIn, History, LeaveApply, Leaves
    src/components/       shared UI
  admin/                  Vite React TypeScript HOD panel
    package.json
    vite.config.ts
    index.html
    src/lib/              supabase, excel export
    src/screens/          Login, Dashboard, EmployeeDetail, LeaveRequests, MonthlyReport, Settings, Employees
```


## v1 verification, 5 November 2026

Verified to a testable state on 5 November 2026, using the defaults in this
document. No EAS build, no Play Store publish, no GitHub push, no paid
account was used.

| Check | Result |
|---|---|
| Mobile TypeScript typecheck (`npx tsc --noEmit`) | Pass, 0 errors |
| Admin production build (`npm run build`) | Pass, dist built, preview serves HTTP 200 |
| Core logic tests (`node tests/logic-tests.mjs`) | 43 passed, 0 failed |
| Excel builder tests (`npx vitest run src/lib/excel.test.ts`) | 5 passed, 0 failed |
| Em-dash scan over all md, ts, tsx, sql, json, css files | 0 matches |

Fixes made during verification (12 fixes):
1. `mobile/App.tsx`: the type alias `View` clashed with the imported React
   Native `View` component and failed typecheck. Renamed to `ScreenView`.
2. `admin/src/vite-env.d.ts`: added (was missing), so `import.meta.env`
   typechecks and the admin build passes.
3. `supabase/schema.sql`: the ALTER adding `leave_id` referencing
   `public.leaves` ran before the leaves table was created, so a fresh
   install failed. The leaves table is now created first.
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
    placeholder branding). The app.json referenced files that did not exist.
    Replace them with the official LGU logo when it is provided.
11. Office placeholder pin corrected to 31.4640, 74.4427 (public coordinates
    for LGU Main Campus, Sector C, DHA Phase 6). The old pin was about 3 km
    off. It is still a placeholder: the exact Examination Department office
    door pin is unknown and must be set in Settings before go live.

12. `admin/src/lib/excel.test.ts`: the test helper typed its leave type as
    `LeaveType` with a null default, which failed strict typecheck. The
    final build sweep caught it. Fixed to `LeaveType | null`, build and
    tests rerun clean.

Known limits that remain (see also the honest limits in this file):
- Absent marking is manual: the HOD taps "Mark absent for today" after
  office hours. There is no automatic background job on the Supabase free
  tier.
- End-to-end tested 5 November 2026 against a mocked Supabase backend
  (see `E2E-TEST-REPORT.md`, 26 checks, 0 failed, 27 real screenshots).
  The live login, check in, and leave approval flow still needs a phone
  and a real Supabase project, which is the next step after the user
  approves.
- E2E fixes, 5 November 2026: (1) mobile entry fixed, `mobile/index.js`
  calls `registerRootComponent`, main is `index.js` (before this the app
  rendered a blank screen on web); (2) the HOD is excluded from staff
  lists and from `mark_absent_for_date`; (3) leave balances are keyed by
  employee code in MonthlyReport and EmployeeDetail (before this they
  showed 0 for everyone).
- `mobile/src/screens/CheckIn.tsx` is not a screen. Check in and check out
  live on the Home screen by design, and the file documents that decision.
  Do not treat it as a missing screen.
- Adding an employee from the admin panel signs the browser in as that
  employee (Supabase sign up behaviour). The HOD signs back in after, or
  creates accounts in the Supabase dashboard instead.

## UI rebuild v2, 5 November 2026

The user rejected the v1 screenshots as plain and AI-looking, and he was
right: flat green bar, bare grey cards, no hierarchy. The visual layer was
rebuilt from scratch. Logic, database, Excel, leave, absent, GPS and
biometric flows are unchanged.

Research first: lgu.edu.pk (official colours blue, white and green, main
campus Sector C DHA Phase 6, motto "We Do Things Differently", office
hours Mon to Fri 08:00 to 16:00 on the site; the app keeps 09:00 to 17:00
from Settings).

Design system (both apps, same tokens): deep LGU green `#064E2B`,
emerald `#0B6E3A`, bright green `#0E7A45`, mint background `#EDF5EF`,
soft sage `#E2EEE5`, white cards, ink `#0F1F16`, muted `#52645A`, gold
accent `#C9A227` used sparingly (header rule, monogram ring, active nav
indicator), danger `#B3261E`, amber `#9A6B0F`, leave blue `#2F5D8A`.
Card radius 20 mobile / 16 admin, button radius 14 / 10, real shadows,
clear type scale. Icons are text glyphs and CSS shapes only (initials in
coloured circles, dots, check/clock/pin marks). No icon library was added.

Mobile (`mobile/src/components/design.ts` new, `ui.tsx` rewritten,
all screens rewritten in layout only): LGU monogram header with gold
rule and motto, profile card with avatar initials and time-of-day
greeting, Today hero with check in/out/total hours timeline and a day
progress bar against 8 hours, solid soft status chips with dots, location
verified pill, one large circular fingerprint button with concentric
rings, leave balance card with progress bar, menu rows with icon tiles
and chevrons, proper error banners and empty states. Login has a centred
brand block with labelled inputs and focus borders.

Admin (`admin/src/styles.css` rewritten as a design system, `App.tsx`
sidebar shell, `src/components/ui.tsx` new with Avatar, StatusPill,
EmptyState, all screens restyled): dark green sidebar with LGU monogram,
nav with gold active indicator, white top bar, mint content area,
tinted stat cards with icon tiles and sublines, Present/Late/Leave/
Absent lists with avatars and time chips, polished tables with sticky
sage headers, hover rows and status pills, leave requests as cards with
solid Approve and Reject buttons, summary stat cards, sectioned Settings
form with toggle chips, split brand login layout. Sidebar collapses to a
top bar under 960 px.

Files changed in v2: mobile `design.ts` (new), `ui.tsx`, `Home.tsx`,
`Login.tsx`, `History.tsx`, `LeaveApply.tsx`, `Leaves.tsx`, `App.tsx`
(button styling only); admin `styles.css`, `App.tsx`, `components/ui.tsx`
(new), `Login.tsx`, `Dashboard.tsx`, `LeaveRequests.tsx`,
`MonthlyReport.tsx`, `EmployeeDetail.tsx`, `Employees.tsx`,
`Settings.tsx`; plus `tests/e2e-screenshots-v2.py` (harness copy, output
folder only).

Verification v2, 5 November 2026, E2E rerun after the rebuild:
mobile typecheck 0 errors, admin build pass, logic tests 43 passed
0 failed, Excel tests 6 passed 0 failed, E2E 26 checks 0 failed
(25 PASS, 1 CHECK for the known add-employee session switch, same as
v1). No harness selector fixes were needed: every visible string was
kept verbatim. New screenshots in `screenshots-v2/` (26 PNGs plus the
downloaded Excel), v1 screenshots untouched.

Fix found by my own check of the v2 screenshots: the mobile avatar
showed "A(" for Ahmed Khan, because the initials function took the last
word of the name, which was the "(DEMO)" tag. Fixed in
`mobile/src/screens/Home.tsx` (parenthetical tags are dropped before
taking initials, first two real words are used), screenshots regenerated
in the rerun, avatar now shows "AK". Verified in
`screenshots-v2/22-mobile-home-ahmed.png`.

Open item found during the v2 test run, needs a decision before any APK
build: `mobile/src/lib/supabase.ts` throws at import when
`EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is missing,
and the mobile project has no `.env` file (only `.env.example`), while
`admin/` ships a `.env` with the demo values. The first mobile web
export rendered blank for this reason until demo vars were supplied in
the test scratch copy. The same throw would blank the APK if the EAS
build environment has no env vars set. Either ship a demo `.env` in
mobile mirroring admin, or set the vars in EAS. Do not build until this
is decided.

Still plain, honestly: the large fingerprint button is a solid green
disc with a small ring glyph, not a recognisable fingerprint drawing;
a proper fingerprint mark needs a real vector asset. Leave Apply dates
are still typed as YYYY-MM-DD text (no date picker dependency). History
is still one long list with no month grouping. The admin login brand
side uses a text "LGU" monogram, not the real LGU crest, because no
logo file exists in the repo. Dense admin tables still scroll
horizontally on narrow phones.

## Branding

LGU green and white, professional, matching the existing LGU Exam Manager desktop app conventions (green header, white cards, clean tables). Primary green `#0B6E3A`, dark green `#084E29`, light background `#F4F7F5`, text `#1A1A1A`. No emoji in UI, no playful copy. Header on every screen: "Lahore Garrison University, Examination Department". V2 design tokens (source of truth in `mobile/src/components/design.ts` and `admin/src/styles.css`): deep green `#064E2B`, emerald `#0B6E3A`, mint `#EDF5EF`, soft sage `#E2EEE5`, gold accent `#C9A227` sparingly, motto "We Do Things Differently" in the header and sidebar.

## UI rebuild v3, 5 November 2026

The user said v2 was looking good but still needed more work: dev text
and AI feel remained. Both were fixed in the presentation layer only.
Logic, database, Excel, leave, absent, GPS and biometric flows are
unchanged.

Dev text removed from every screen the user can see:
- Names are shown through a shared displayName helper (mobile
  `src/lib/supabase.ts`, admin `src/lib/supabase.ts`, also used by
  `admin/src/lib/excel.ts`, so exported Excel files show clean names).
  It strips any parenthetical tag, so "Ahmed Khan (DEMO)" shows as
  "Ahmed Khan", and a HOD record shows as "Head of Department".
- Mobile profile no longer shows the employee email at all, only
  designation and employee ID. Admin employee detail shows designation
  and ID only, no email line.
- "HOD Admin Panel" is gone from the admin login heading, the sidebar
  and the top bar. The login heading is now "Sign in". The top bar
  shows the signed-in Head of Department by name, with an avatar.
- "Examination Department attendance at a glance" is gone. The
  dashboard subheading now states the real hours: "Office hours 09:00
  to 17:00. Late after 09:15." Stat captions are plain: "On the roster",
  "In today", "After 09:15", "Approved today", "No check-in yet",
  "Left for the day".
- All user-facing "HOD" abbreviations are written out as "Head of
  Department", including error messages and the leave decision note.
- The Employees page no longer mentions Supabase or the browser
  sign-in side effect in developer terms. It says plainly that adding
  a person signs the browser in as them, and to sign out and back in.
- The E2E test user is now a normal-looking staff member, Usman Tariq,
  EX-004, instead of a test-labelled record. Demo tags remain only in
  `supabase/seed.sql`, test fixtures and code comments, where the user
  never sees them.

AI feel removed:
- Every text-glyph icon is replaced with a real inline SVG icon:
  `mobile/src/components/icons.tsx` (react-native-svg, added as a
  project dependency, `react-native-svg@15.8.0`) and
  `admin/src/components/icons.tsx` (inline SVG). Icons cover check,
  cross, clock, calendar, location pin, chevron, user, users, settings,
  leave, report, home, search, sign out, shield and alert. No emoji
  and no character icons remain in the UI.
- A proper fingerprint vector now sits in the large check-in button:
  `FingerprintMark` in both icon files, plus the asset
  `mobile/assets/fingerprint.svg`. It is five concentric arches, not a
  green disc with a dot. It is also shown on the mobile sign-in card.
- Leave Apply no longer takes typed YYYY-MM-DD dates. It has a real
  date picker: tap the field, pick month, year and day. February shows
  28 days only, so an impossible date cannot be picked at all. The
  stored value is still YYYY-MM-DD, so the leave table and approval
  flow are unchanged. The form is now scrollable, and screen content
  clears the bottom tab bar (96 px bottom padding).
- History is grouped by month ("November 2026") instead of one long
  list.
- Section labels are sentence case ("Today", "Leave", "Recent days",
  "My attendance") instead of shouty capitals.
- Admin tables hide the least important columns on narrow phones
  (Designation and Location on the dashboard, Email on the staff list,
  Leave Type and Location on the monthly report) instead of scrolling
  sideways, and table cells wrap.

Bugs found by the v3 test run, fixed and retested:
1. The leave form was not scrollable and the bottom tab bar covered
   the date picker days on a phone screen, so day 10 could not be
   tapped. The form is now a ScrollView and content clears the tab
   bar. This was a real user-facing bug, not a test artefact.
2. The E2E harness expected the old mark-absent message. Updated to
   the new wording. No app code changed for this one.

Verification, 5 November 2026: mobile typecheck 0 errors, admin
production build pass, logic tests 43 passed 0 failed, Excel tests
6 passed 0 failed, E2E v3 run 26 checks 0 failed (25 PASS, 1 CHECK,
the known add-employee session switch). Screenshots in
`screenshots-v3/` (26 PNGs), v1 and v2 folders untouched.

Still open before any APK build: mobile has no `.env` file and throws
at import without `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, so the build environment must supply
them. The top-bar avatar shows "HO" in test screenshots because the
test HOD record has no personal name, only the title "Head of
Department"; with a real HOD name the initials will be correct. The
admin login still uses the text "LGU" monogram, not the real LGU crest,
because no logo file exists in the repo.

## APK build v1 (2026-11-05) - open env item now closed

The open item from v2/v3 (mobile throws at import without EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY, no .env file) is closed for the build: the preview profile in `mobile/eas.json` supplies both values as build env, and the EAS build succeeded with them.

- Repo: https://github.com/pakmultilinks-dot/lgu-attendance-app (public, main, commits 9ab9ede, 4aeefff, dc4bcd9, 84f282c, 30a531a)
- EAS project: @kominman/lgu-attendance, ID f7a0ea5a-f432-4eb6-8b01-07d80f0854af
- Build 1 cc8dbe9b-7178-41eb-86f4-fe05a4ffa6b2 ERRORED, Bundle JavaScript: `expo-asset` missing. Fixed by adding expo-asset ~11.0.5, commit 84f282c.
- Build 2 4a835d85-063f-4696-976c-5f5ad647d741 ERRORED, Gradle: `:expo-modules-core:compileReleaseKotlin` failed, Compose Compiler 1.5.15 requires Kotlin 1.9.25, project used 1.9.24. Fixed by adding expo-build-properties ~0.13.3 with android.kotlinVersion 1.9.25, commit 30a531a.
- Build 3 1b811809-1c52-4f35-8722-e1df5388cd90 FINISHED 2026-11-05T11:29:07Z, app 1.0.0, SDK 52.0.0, APK 59 MB, verified live and downloaded, valid Android package, JS bundle contains the app strings.
- APK download: https://expo.dev/artifacts/eas/JOl4izNM33NRZSeka7C8EzYeLpTNUJlbmASlKAdv98A.apk
- Build page: https://expo.dev/accounts/kominman/projects/lgu-attendance/builds/1b811809-1c52-4f35-8722-e1df5388cd90

Live limits: the APK uses demo Supabase values (https://demo.supabase.co / demo-key). No live Supabase project exists, so sign-in does not work live. To make it live: create a free Supabase project, run supabase/schema.sql then supabase/seed.sql in it, set the real EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the EAS preview env, rebuild. Fingerprint and GPS still need a real-phone test. No Play Store publish.

## Demo login mode, 5 November 2026

The user installed the v1 APK and was stuck on the Staff sign in screen:
no live Supabase project exists, so no real login works. Demo mode was
added so he can get inside the app on his phone with one tap.

- Login screen, below Sign In: "Try demo, no account needed". Tapping it
  signs in locally as Ahmed Khan, EX-001, Assistant (Examinations). No
  password, no account, no network, no Supabase call.
- Demo data: the seed attendance rows for Ahmed Khan, 2 to 4 Nov 2026
  (Present, Present, Late), already in the app. Today starts unchecked
  on purpose, so Check In can be tried. Leave balance 20 days allowed,
  0 taken.
- Demo works fully offline: Home profile and today, Check In with
  fingerprint, Check Out and total hours, History grouped by month,
  Apply for Leave with the real date picker, My Leaves and balance.
  Demo check-ins and leave requests are stored only in AsyncStorage on
  the phone (`lgu_demo_state_v1`, session flag `lgu_demo_active_v1`)
  and survive an app reload. Demo sign-out returns to the login screen.
- The session is labelled in the UI with a gold "Demo, data stays on
  this phone" pill on Home, so demo data is never confused with live data.
- Fingerprint is NOT faked in demo mode: demo check in runs the same
  GPS radius check then the real phone biometric prompt. On a phone with
  no sensor it refuses honestly and writes no record.
- Real email/password sign in is unchanged for when live Supabase is
  connected. If no real Supabase project is configured, it now shows
  "Sign in is not set up yet. Use Try demo, or ask for the live database
  to be connected." instead of crashing or failing silently. Importing
  the Supabase client no longer throws when env vars are missing; it
  falls back to demo values and `isSupabaseConfigured` is false.
- What does NOT sync in demo mode: nothing. No check-in, leave request
  or balance change leaves the phone. The HOD never sees demo data.
  Demo data is left behind when the user signs in with a real account,
  never merged into live data.
- Implementation: new `mobile/src/lib/demo.ts` (demo employee, settings,
  seed state, AsyncStorage store, demo check in/out, demo leave apply);
  `mobile/src/lib/supabase.ts` no longer throws at import;
  `App.tsx` restores a demo session on launch and routes demo sign-out;
  Login, Home, History, LeaveApply and Leaves screens branch on an
  `isDemo` prop. Live Supabase paths are untouched.
- Tested 5 November 2026: mobile typecheck 0 errors, logic tests 43
  passed, Excel tests 6 passed. Demo E2E (`tests/e2e-screenshots-demo.py`,
  real Expo web export built with no Supabase env vars at all): 11
  checks, 0 failed, no console errors. Screenshots in `screenshots-demo/`
  (7 PNGs). Not tested on a real phone yet: fingerprint accept and real
  GPS at the office door still need the next APK build and a phone test.
- Still NOT done: no EAS build, no GitHub push, no publish. The next
  build ships this demo mode as-is.

## APK build v2 with demo login (2026-11-05)

The user approved a rebuild explicitly, so demo mode could reach his phone.

- Commit: ffd8748 "Add demo login mode: Try demo as Ahmed Khan EX-001, offline, no password" (20 files, pushed to main, verified live on GitHub).
- EAS project: @kominman/lgu-attendance, ID f7a0ea5a-f432-4eb6-8b01-07d80f0854af
- Build 4 fbb40b06-0f85-40fc-97d1-e0db55a361f9 FINISHED, app 1.0.0, SDK 52.0.0, APK 59 MB, no build errors, first attempt.
- APK download (Expo): https://expo.dev/artifacts/eas/XYZyk-nkK_UDbh8qrkrL8xSSCZMFGpS6bhsWq0kEoXc.apk
- Build page: https://expo.dev/accounts/kominman/projects/lgu-attendance/builds/fbb40b06-0f85-40fc-97d1-e0db55a361f9
- Direct download link: https://muse.ai/files/1496070203584880/1716689630466724/qpyls1w76377rv37yki6op8l/LGU-Attendance-App-v2-demo.apk (expires 2026-11-07T12:02:48Z, anyone with the link can open it)
- Verified: downloaded 59 MB, file confirms Android package, classes.dex present, JS bundle (1.5 MB) contains "Try demo" and "Ahmed Khan", demo storage keys present. SHA256: 60d718de31bfc409288c87f69e82bd92822473a893509e51b3dfcc790845a860
- Local file: LGU-Attendance-App-v2-demo.apk (gitignored, not committed).

Live limits, unchanged: real sign-in does NOT work live, no live Supabase project exists. Demo login works offline on the phone with no account. To make real sign-in live: create a free Supabase project, run supabase/schema.sql then supabase/seed.sql, set the real EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the EAS preview env, rebuild. Fingerprint accept and real GPS at the office door still need a real-phone test. No Play Store publish.

## Login screen fix, 5 November 2026 (Try demo was unreachable)

The user reported the real bug on his phone: the login screen did not
scroll, so Sign In and Try demo below the Password field could not be
reached at all. He was right, the web test had not caught it. Root
cause: the Login screen was a plain View with no ScrollView, and it
stacked the full AppHeader (56px top padding) plus a second 76px
brand block, so the buttons sat below the fold.

Fixed in `mobile/src/screens/Login.tsx` only: slim header (34px
monogram, one line title, no motto), duplicate brand block removed,
security card removed from the login screen, fingerprint mark 44 to
28px, heading 20 to 17px, compact inputs and buttons. The whole
login now fits in about 480px tall, so Try demo is in view on load
with no scrolling at 390x844 and at 390x700, and the screen is also
wrapped in a real ScrollView as a fallback. Home and Leave Apply
already used ScrollView and were not changed. Demo login logic and
real sign in logic are untouched.

Verified: mobile typecheck 0 errors, logic tests 43 passed, Excel
tests 6 passed, demo E2E 13 checks 0 failed including the two new
viewport checks (Try demo button bottom at 431px on load at 390x844
and at 390x700), plus a scroll fallback check at 390x500. New
screenshots `screenshots-demo/demo-login-button.png` (overwritten
with the fixed screen) and `screenshots-demo/demo-login-700.png`.
This fix is local only. No EAS build, no GitHub push, no publish was
done in this task. It ships with the next APK build.
