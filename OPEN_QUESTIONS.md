# Open Questions, LGU Attendance App

These are the things only Abdur Rehman or the HOD can provide. The scaffold is built with safe defaults, but it must not go live until these are answered.

## 1. Exact office GPS pin

- What is the exact latitude and longitude of the Examination Department office?
- Which point should be the centre: the office door, the building entrance, or the department reception?
- Is 100 metres the right radius, or should it be smaller (for example 50 metres) so staff in the next building cannot check in?
- Placeholder in the database: latitude 31.4640, longitude 74.4427, the LGU Main Campus area (Sector C, DHA Phase 6, public coordinates, corrected 5 November 2026; the old pin was about 3 km off). This is a campus area pin only, not the office door. It must be replaced with the real pin in the admin panel Settings page before anyone uses the app.

## 2. Employee roster

- Full list of employees: full name, employee ID, designation, official email, phone number.
- Who is the HOD, and what is the HOD email for the admin account?
- Is there more than one admin, or is the HOD the only admin?
- Should any staff be excluded (for example visiting faculty, or staff based at another campus)?

## 3. Office timings

- Office start time (v1 default: 09:00, confirmed by the user saying "ok start" on 5 November 2026; still confirm with the HOD).
- Office end time (v1 default: 17:00).
- Late cutoff time (v1 default: 09:15). Anyone checking in after this is marked Late.
- Working days (v1 default: Monday to Friday). Does the department work Saturdays?
- Official holidays: is there a holiday list to load, so holidays do not show as Absent?

## 4. HOD account and LGU logo

- HOD full name and email for the first admin account.
- LGU logo file: the scaffold uses a text header. If there is an official LGU logo file (PNG with transparent background), provide it so it can be placed in `mobile/assets/` and `admin/public/` and shown in the app header, the admin panel, and the Excel report header.
- The existing LGU Exam Manager desktop app has `lgu-logo.jpg` in `~/workspace/lgu-exam-app/`. Confirm whether that file is the official logo and may be reused, or provide a fresh file.

## 5. Attendance policy decisions

- What happens if someone forgets to check out? Should the HOD be able to add a missing check out manually, or should it stay blank?
- What happens if someone forgets to check in but was present? Same question: HOD manual correction, yes or no?
- Leave: who approves leave, and should leave be entered in advance in the admin panel?
- Leave allowance: v1 defaults to 20 leave days per year for every employee (confirmed as the starting point on 5 November 2026). Is that the right number, and is it the same for every designation, or do different roles get different allowances?
- Should check in be blocked outside office hours, or allowed (early arrival) as in the current v1 design?

## 6. Rollout

- How many staff will use it on day one?
- Android only, or do any staff use iPhones?
- Is the direct APK download link acceptable for v1, or does LGU want the $25 Google Play developer account paid and a Play Store listing?
- Who supports staff when the app refuses a check in (wrong location, fingerprint fail)? The HOD, or Abdur Rehman?
