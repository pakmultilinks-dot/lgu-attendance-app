# LGU Exam Department Attendance App

Lahore Garrison University, Examination Department. Staff attendance with phone fingerprint, 100 metre office radius, and automatic monthly Excel reports. HOD admin panel included.

Read `SPEC.md` first for the full design, the honest fingerprint limitation, and the GPS spoofing note.

## What is in this scaffold

- `mobile/` Expo React Native TypeScript app: login, profile, check in and check out with fingerprint plus GPS radius check, history, one check in per day.
- `admin/` Vite React TypeScript HOD panel: today dashboard, employee detail, monthly report with Excel export, employee management, office settings.
- `supabase/schema.sql`: employees, attendance records, office settings, admin audit, with RLS policies and the one check in per day constraint.

## Defaults used for v1 (agreed 5 November 2026)

The user said "ok start", so v1 was finished with these defaults. Every one
of them is editable in the admin panel Settings page, and the real values
must replace them before go live.

| Setting | Default |
|---|---|
| Office | Examination Department, Lahore Garrison University, Main Campus area, Sector C, DHA Phase 6, Lahore |
| Office pin (PLACEHOLDER) | 31.4640, 74.4427 |
| Radius | 100 metres |
| Office hours | 09:00 to 17:00 PKT |
| Late after | 09:15 |
| Working days | Monday to Friday |
| Leave allowance | 20 days per year, same for all staff |

## Demo data

`supabase/seed.sql` loads 1 demo HOD and 3 demo employees (Ahmed Khan EX-001,
Sara Malik EX-002, Bilal Ahmed EX-003), one approved Sick leave (Sara Malik,
3 to 4 Nov 2026), and 15 sample attendance rows for 2 to 6 Nov 2026. All demo
rows are labelled DEMO. Demo rows have no login: create the Auth users in the
Supabase dashboard and link them, or create staff from the admin panel. The
seed is idempotent (running it twice changes nothing). A commented cleanup
block at the end of seed.sql removes the demo rows, only when the HOD orders it.

## Tests (run before any build)

```bash
node tests/logic-tests.mjs
cd admin && VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_ANON_KEY=demo-key npx vitest run src/lib/excel.test.ts
```

Result on 5 November 2026: 43 logic tests passed, 0 failed; 6 Excel builder
tests passed, 0 failed; mobile typecheck 0 errors; admin production build
passed. See `TEST_LOG.md` and the v1 report for the full list.

## UI rebuild v2, 5 November 2026

The v1 screenshots were rejected as plain and AI-looking. The visual layer
was rebuilt from scratch (same tokens on mobile and admin, LGU monogram
header, profile cards, fingerprint button, sidebar admin, polished
tables). Logic is unchanged. Full detail in `SPEC.md` and in the v2
section at the end of `E2E-TEST-REPORT.md`. New screenshots are in
`screenshots-v2/` (26 PNGs), v1 screenshots in `screenshots/` untouched.
E2E rerun after the rebuild: 26 checks, 0 failed. One fix found by
checking the v2 screenshots: mobile avatars showed "A(" because the
initials function took the "(DEMO)" tag as the last name; fixed, avatar
now shows "AK". One open item before any APK build: mobile has no `.env`
file and throws at import without `EXPO_PUBLIC_SUPABASE_URL` /
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, so the build environment must supply
them (admin already ships a demo `.env`).

## 1. Create the free Supabase project

1. Go to https://supabase.com and create a free project.
2. In the Supabase SQL Editor, open `supabase/schema.sql` from this repo, paste it, and run it. It creates the tables, the RLS policies, the indexes, and a default office settings row.
3. For testing only, run `supabase/seed.sql` the same way to load the demo HOD, 3 demo employees, and sample November 2026 rows. Do not run the seed on the live database once real staff are in.
3. In Supabase Auth, turn off "Confirm email" for now (Settings, Authentication), or staff will be blocked waiting for a confirmation email. Turn it back on later if LGU wants email confirmation.
4. Copy the Project URL and the anon public key from Settings, API.

## 2. Add the first HOD and the first employees

Do this in the Supabase dashboard, not in code:

1. Auth, Users, Add user. Create the HOD account with the HOD email and a strong password. Copy the user UUID.
2. In the SQL Editor run:
   ```sql
   insert into public.employees (auth_user_id, employee_id, full_name, designation, email, role)
   values ('<HOD-UUID-HERE>', 'LGU-HOD-001', '<HOD full name>', 'Head of Department', '<HOD email>', 'hod');
   ```
3. Repeat for each employee, with role `'employee'`. Or add them later from the admin panel Employees page once the HOD can sign in. The admin panel creates the Auth user and the employee row together.
4. The first time the HOD signs in to the admin panel, open Settings and set the exact office pin. The schema ships with a placeholder pin for the LGU Main Campus area (31.4640, 74.4427). Do not treat the placeholder as final.

## 3. Run the mobile app locally

```bash
cd mobile
npm install
cp .env.example .env
```

Edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Then:

```bash
npx expo start
```

Scan the QR code with Expo Go on a real phone. GPS and fingerprint do not work properly in a simulator, test on a real device. Fingerprint needs a fingerprint enrolled in the phone settings first.

## 4. Run the admin panel locally

```bash
cd admin
npm install
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Then:

```bash
npm run dev
```

Open http://localhost:5173 and sign in with the HOD account.

## 5. Set the office location

In the admin panel, Settings page:

1. Stand at the office door with a phone, open Google Maps, long press the pin, copy the latitude and longitude.
2. Paste them into Office latitude and Office longitude.
3. Keep the radius at 100 metres unless the HOD orders otherwise.
4. Set office start time, end time, and the late cutoff (default 09:15).
5. Save. The next check in uses the new pin immediately.

## 6. Deploy the admin panel free (Netlify)

1. Push the `admin/` folder to a GitHub repo.
2. In Netlify, New site from Git, pick the repo, set base directory to `admin`, build command `npm run build`, publish directory `dist`.
3. In Netlify Site settings, Environment variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Cloudflare Pages works the same way (build command `npm run build`, output `dist`).

Do not deploy to Vercel for this project. The user banned Vercel except for KezTech.

## 7. Get the APK later (no build in this scaffold)

When the user approves a build, and only then:

```bash
cd mobile
npx eas-cli build --platform android --profile preview
```

That produces an APK download link to share with staff. No EAS build was run as part of this scaffold. Publishing to Google Play needs a one time $25 developer account and a signed AAB, see SPEC.md.

## Daily use

- Employee: open app, tap Check In on arrival, tap Check Out on leaving. Fingerprint each time. To take leave, use Apply for Leave in the app, then check My Leaves for the HOD decision.
- HOD: open the admin panel Dashboard for today, check the Present, Late, On Leave and Absent lists separately, tap "Mark absent for today" after office hours, decide pending leave requests on the Leave Requests page, and download the Excel file from Monthly report at month end. Set the annual leave allowance in Settings.

## Files

- `SPEC.md`: full spec and limits.
- `OPEN_QUESTIONS.md`: what the user still needs to provide before go live.
- `supabase/schema.sql`: database.
- `mobile/`: employee app.
- `admin/`: HOD panel.

## UI rebuild v3, 5 November 2026

The user said v2 still had dev text and AI feel. Both are fixed in v3:
no "(DEMO)" or demo email on any screen, no "HOD Admin Panel" label,
the top bar shows the Head of Department by name, every icon is a real
SVG (including a proper fingerprint vector in the check-in button),
leave dates use a real picker instead of typed YYYY-MM-DD, history is
grouped by month, and a bottom tab bar (Today, History, Apply Leave,
My Leaves) replaces the stacked buttons on mobile. Logic is unchanged.
New screenshots are in `screenshots-v3/` (26 PNGs). E2E rerun after
the rebuild: 26 checks, 0 failed. One real bug found by the test run:
the leave form was not scrollable and the tab bar covered the picker
days, so day 10 could not be tapped; fixed, the form scrolls and
content clears the tab bar. Full detail in `SPEC.md` and in the v3
section at the end of `E2E-TEST-REPORT.md`. `react-native-svg@15.8.0`
was added to the mobile project for the SVG icons.
