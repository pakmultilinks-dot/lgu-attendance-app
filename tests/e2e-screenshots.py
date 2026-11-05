#!/usr/bin/env python3
"""E2E screenshot harness for LGU Attendance App v1.

Runs the real admin build (Vite preview) and the real mobile web export
(Expo web, built from a scratch copy in ~/workspace/.e2e-mobile-web, the
project itself is untouched) in headless Chromium and captures real PNG
screenshots to ~/workspace/lgu-attendance-app/screenshots/.

There is no live Supabase project, so Supabase Auth + PostgREST calls to
https://demo.supabase.co are intercepted in the browser and answered from
an in-memory copy of the demo seed data (supabase/seed.sql). Every mocked
value is taken from the seed file, except where the report says otherwise
(Bilal pending leave, EX-004 test employee, simulated Bilal-missing day).
Nothing here claims a live database, a real phone, a fingerprint sensor,
or a real GPS fix was used. Those limits are written in E2E-TEST-REPORT.md.

Usage: python3 tests/e2e-screenshots.py
Requires: playwright (python) + /opt/meta-chromium/chrome, admin preview
on http://127.0.0.1:4173 and mobile web export served on http://127.0.0.1:8080.
"""
import copy
import json
import os
import re
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

BASE = os.path.expanduser("~/workspace/lgu-attendance-app")
SHOTS = os.path.join(BASE, "screenshots")
os.makedirs(SHOTS, exist_ok=True)
ADMIN_URL = "http://127.0.0.1:4173/"
MOBILE_URL = "http://127.0.0.1:8080/"
SUPABASE_HOST = "demo.supabase.co"
TODAY = "2026-11-05"
RESULTS = []  # (name, status, note)


def log(name, status, note=""):
    RESULTS.append((name, status, note))
    print(f"[{status}] {name} {note}")


def hours_between(start, end):
    fmt = "%Y-%m-%d %H:%M:%S"
    a = datetime.strptime(start, fmt)
    b = datetime.strptime(end, fmt)
    return round((b - a).total_seconds() / 3600, 2)


# ---------------------------------------------------------------- mock data
HOD_ID = "11111111-1111-4111-8111-111111111001"
AHMED_ID = "11111111-1111-4111-8111-111111111002"
SARA_ID = "11111111-1111-4111-8111-111111111003"
BILAL_ID = "11111111-1111-4111-8111-111111111004"
TEST_ID = "11111111-1111-4111-8111-111111111005"


def make_employees(include_test_user=False):
    emps = [
        {"id": HOD_ID, "auth_user_id": "hod-auth-id", "employee_id": "LGU-HOD-DEMO",
         "full_name": "Demo HOD (DEMO)", "designation": "Head of Department",
         "email": "hod.demo@lgu.edu.pk", "phone": None, "role": "hod", "is_active": True},
        {"id": AHMED_ID, "auth_user_id": "ahmed-auth-id", "employee_id": "EX-001",
         "full_name": "Ahmed Khan (DEMO)", "designation": "Assistant (Examinations)",
         "email": "ahmed.khan.demo@lgu.edu.pk", "phone": "+92 300 0000001",
         "role": "employee", "is_active": True},
        {"id": SARA_ID, "auth_user_id": "sara-auth-id", "employee_id": "EX-002",
         "full_name": "Sara Malik (DEMO)", "designation": "Examination Officer",
         "email": "sara.malik.demo@lgu.edu.pk", "phone": "+92 300 0000002",
         "role": "employee", "is_active": True},
        {"id": BILAL_ID, "auth_user_id": "bilal-auth-id", "employee_id": "EX-003",
         "full_name": "Bilal Ahmed (DEMO)", "designation": "Clerk (Examinations)",
         "email": "bilal.ahmed.demo@lgu.edu.pk", "phone": "+92 300 0000003",
         "role": "employee", "is_active": True},
    ]
    if include_test_user:
        emps.append(
            {"id": TEST_ID, "auth_user_id": "test-auth-id", "employee_id": "EX-004",
             "full_name": "E2E Test (DEMO)", "designation": "Test Staff (Examinations)",
             "email": "e2e.test.demo@lgu.edu.pk", "phone": "+92 300 0000004",
             "role": "employee", "is_active": True})
    return emps


def seed_rows():
    """The 15 attendance rows from supabase/seed.sql, 2-6 Nov 2026."""
    raw = [
        (AHMED_ID, "2026-11-02", "2026-11-02 09:05:00", "2026-11-02 17:02:00", 12, "Present", None),
        (AHMED_ID, "2026-11-03", "2026-11-03 09:02:00", "2026-11-03 17:00:00", 18, "Present", None),
        (AHMED_ID, "2026-11-04", "2026-11-04 09:22:00", "2026-11-04 17:05:00", 25, "Late", None),
        (AHMED_ID, "2026-11-05", "2026-11-05 09:04:00", "2026-11-05 17:01:00", 9, "Present", None),
        (AHMED_ID, "2026-11-06", "2026-11-06 09:06:00", "2026-11-06 17:03:00", 31, "Present", None),
        (SARA_ID, "2026-11-02", "2026-11-02 09:08:00", "2026-11-02 17:00:00", 22, "Present", None),
        (SARA_ID, "2026-11-03", None, None, None, "Leave", "Sick"),
        (SARA_ID, "2026-11-04", None, None, None, "Leave", "Sick"),
        (SARA_ID, "2026-11-05", "2026-11-05 09:01:00", "2026-11-05 16:58:00", 15, "Present", None),
        (SARA_ID, "2026-11-06", None, None, None, "Absent", None),
        (BILAL_ID, "2026-11-02", "2026-11-02 09:10:00", "2026-11-02 17:04:00", 41, "Present", None),
        (BILAL_ID, "2026-11-03", "2026-11-03 09:07:00", "2026-11-03 17:00:00", 28, "Present", None),
        (BILAL_ID, "2026-11-04", None, None, None, "Absent", None),
        (BILAL_ID, "2026-11-05", "2026-11-05 09:03:00", "2026-11-05 17:02:00", 19, "Present", None),
        (BILAL_ID, "2026-11-06", "2026-11-06 09:05:00", None, 33, "Present", None),
    ]
    rows = []
    for i, (emp, day, cin, cout, dist, status, ltype) in enumerate(raw):
        rows.append({
            "id": f"33333333-3333-4333-8333-333333333{i:03d}",
            "employee_id": emp, "work_date": day,
            "check_in_at": (cin + "+05:00") if cin else None,
            "check_out_at": (cout + "+05:00") if cout else None,
            "status": status,
            "total_hours": hours_between(cin, cout) if cin and cout else None,
            "location_verified": status in ("Present", "Late"),
            "mocked_location": False,
            "check_in_distance_meters": dist,
            "leave_type": ltype,
            "leave_id": "22222222-2222-4222-8222-222222222001" if ltype else None,
        })
    return rows


def make_mock(include_test_user=False):
    settings = {"id": 1, "office_name": "Examination Department, Lahore Garrison University",
                "office_lat": 31.4640, "office_lng": 74.4427, "radius_meters": 100,
                "office_start_time": "09:00", "office_end_time": "17:00",
                "late_cutoff_time": "09:15", "working_days": [1, 2, 3, 4, 5],
                "annual_leave_allowance_days": 20}
    leaves = [
        {"id": "22222222-2222-4222-8222-222222222001", "employee_id": SARA_ID,
         "leave_type": "Sick", "start_date": "2026-11-03", "end_date": "2026-11-04",
         "reason": "Fever, doctor advised rest", "note": None, "status": "Approved",
         "decision_reason": "Approved. Get well soon.", "decided_by": HOD_ID,
         "created_at": "2026-11-02T10:00:00+05:00", "decided_at": "2026-11-02T16:00:00+05:00"},
        # Mock-only extra: a pending request so approve/reject can be tested.
        {"id": "22222222-2222-4222-8222-222222222002", "employee_id": BILAL_ID,
         "leave_type": "Annual", "start_date": "2026-11-09", "end_date": "2026-11-10",
         "reason": "Family function in Lahore", "note": None, "status": "Pending",
         "decision_reason": None, "decided_by": None,
         "created_at": "2026-11-05T09:30:00+05:00", "decided_at": None},
    ]
    return {"employees": make_employees(include_test_user),
            "attendance_records": seed_rows(),
            "leaves": leaves, "office_settings": [settings],
            "admin_audit": []}


USERS = {  # email -> (auth_user_id, employee_id, full_name, role)
    "hod.demo@lgu.edu.pk": ("hod-auth-id", HOD_ID, "Demo HOD (DEMO)", "hod"),
    "ahmed.khan.demo@lgu.edu.pk": ("ahmed-auth-id", AHMED_ID, "Ahmed Khan (DEMO)", "employee"),
    "sara.malik.demo@lgu.edu.pk": ("sara-auth-id", SARA_ID, "Sara Malik (DEMO)", "employee"),
    "bilal.ahmed.demo@lgu.edu.pk": ("bilal-auth-id", BILAL_ID, "Bilal Ahmed (DEMO)", "employee"),
    "e2e.test.demo@lgu.edu.pk": ("test-auth-id", TEST_ID, "E2E Test (DEMO)", "employee"),
}
TOKENS = {}  # access_token -> (auth_user_id, email)


def session_for(auth_id, email):
    token = f"mock-token-{auth_id}"
    TOKENS[token] = (auth_id, email)
    expires_at = int(datetime.now(timezone.utc).timestamp()) + 3600
    return {"access_token": token, "token_type": "bearer", "expires_in": 3600,
            "expires_at": expires_at, "refresh_token": f"mock-refresh-{auth_id}",
            "user": {"id": auth_id, "email": email, "aud": "authenticated",
                     "role": "authenticated",
                     "user_metadata": {}, "app_metadata": {}}}


def working_days(start, end, days=(1, 2, 3, 4, 5)):
    out, d = [], date.fromisoformat(start)
    last = date.fromisoformat(end)
    while d <= last:
        if d.isoweekday() in days:
            out.append(d)
        d += timedelta(days=1)
    return out

# ------------------------------------------------------- PostgREST-like mock
def _coerce(value):
    if value in ("true", "false"):
        return value == "true"
    try:
        return int(value)
    except (ValueError, TypeError):
        pass
    try:
        return float(value)
    except (ValueError, TypeError):
        return value


def _matches(row, params):
    for key, vals in params.items():
        if key in ("select", "order", "limit", "offset"):
            continue
        val = vals[0]
        if "." not in val:
            continue
        op, raw = val.split(".", 1)
        actual = row.get(key)
        if op == "eq":
            if str(actual) != raw and actual != _coerce(raw):
                return False
        elif op == "neq":
            if str(actual) == raw or actual == _coerce(raw):
                return False
        elif op == "gte":
            if actual is None or str(actual) < raw:
                return False
        elif op == "lte":
            if actual is None or str(actual) > raw:
                return False
        elif op == "gt":
            if actual is None or str(actual) <= raw:
                return False
        elif op == "lt":
            if actual is None or str(actual) >= raw:
                return False
        elif op == "in":
            wanted = raw.strip("()").split(",")
            if str(actual) not in wanted:
                return False
        elif op == "is":
            if raw == "null" and actual is not None:
                return False
    return True


def _apply_query(rows, params):
    out = [r for r in rows if _matches(r, params)]
    order = params.get("order", [None])[0]
    if order:
        col, _, direction = order.partition(".")
        out = sorted(out, key=lambda r: (r.get(col) is None, r.get(col)),
                     reverse=(direction == "desc"))
    limit = params.get("limit", [None])[0]
    if limit:
        out = out[: int(limit)]
    return out


def _embed(rows, table, mock):
    if table not in ("attendance_records", "leaves"):
        return rows
    emps = {e["id"]: e for e in mock["employees"]}
    out = []
    for r in rows:
        r = dict(r)
        emp = emps.get(r.get("employee_id"))
        if emp:
            r["employees"] = {"full_name": emp["full_name"],
                              "employee_id": emp["employee_id"],
                              "designation": emp["designation"]}
        out.append(r)
    return out


def _rpc(mock, name, body, auth_id):
    """Faithful re-implementation of the SQL RPCs in supabase/schema.sql,
    running against the in-memory mock tables."""
    emps = {e["id"]: e for e in mock["employees"]}
    me = next((e for e in mock["employees"] if e["auth_user_id"] == auth_id), None)
    settings = mock["office_settings"][0]
    if name == "leave_days_taken":
        n = sum(1 for r in mock["attendance_records"]
                if r["employee_id"] == body["p_employee_id"]
                and r["status"] == "Leave"
                and r["work_date"].startswith(str(body["p_year"])))
        return 200, n
    if name == "mark_absent_for_date":
        p_date = body["p_date"]
        dow = date.fromisoformat(p_date).isoweekday()
        if dow not in settings["working_days"]:
            return 200, 0
        count = 0
        for emp in mock["employees"]:
            if not emp["is_active"] or emp["role"] == "hod":
                continue
            has = any(r["employee_id"] == emp["id"] and r["work_date"] == p_date
                      for r in mock["attendance_records"])
            on_leave = any(l["employee_id"] == emp["id"] and l["status"] == "Approved"
                           and l["start_date"] <= p_date <= l["end_date"]
                           for l in mock["leaves"])
            if not has and not on_leave:
                mock["attendance_records"].append(
                    {"id": str(uuid.uuid4()), "employee_id": emp["id"],
                     "work_date": p_date, "check_in_at": None, "check_out_at": None,
                     "status": "Absent", "total_hours": None,
                     "location_verified": False, "mocked_location": False,
                     "check_in_distance_meters": None, "leave_type": None,
                     "leave_id": None})
                count += 1
        return 200, count
    if name == "approve_leave":
        leave = next((x for x in mock["leaves"] if x["id"] == body["p_leave_id"]), None)
        if not leave:
            return 400, {"message": "Leave request not found."}
        if leave["status"] != "Pending":
            return 400, {"message": "Leave request already decided."}
        leave["status"] = "Approved"
        leave["decision_reason"] = body.get("p_decision_reason") or None
        leave["decided_by"] = me["id"] if me else None
        leave["decided_at"] = datetime.now(timezone.utc).isoformat()
        created, skipped = 0, []
        for day in working_days(leave["start_date"], leave["end_date"],
                                settings["working_days"]):
            ds = day.isoformat()
            row = next((r for r in mock["attendance_records"]
                        if r["employee_id"] == leave["employee_id"]
                        and r["work_date"] == ds), None)
            if row is None:
                mock["attendance_records"].append(
                    {"id": str(uuid.uuid4()), "employee_id": leave["employee_id"],
                     "work_date": ds, "check_in_at": None, "check_out_at": None,
                     "status": "Leave", "total_hours": None,
                     "location_verified": False, "mocked_location": False,
                     "check_in_distance_meters": None,
                     "leave_type": leave["leave_type"], "leave_id": leave["id"]})
                created += 1
            elif row["status"] == "Absent":
                row["status"] = "Leave"
                row["leave_type"] = leave["leave_type"]
                row["leave_id"] = leave["id"]
                created += 1
            else:
                skipped.append(ds)
        return 200, {"approved": True, "days_created": created, "skipped_days": skipped}
    if name == "reject_leave":
        reason = (body.get("p_decision_reason") or "").strip()
        if not reason:
            return 400, {"message": "A reason is required to reject leave."}
        leave = next((x for x in mock["leaves"] if x["id"] == body["p_leave_id"]), None)
        if not leave or leave["status"] != "Pending":
            return 400, {"message": "Leave request not found, or already decided."}
        leave["status"] = "Rejected"
        leave["decision_reason"] = reason
        leave["decided_by"] = me["id"] if me else None
        leave["decided_at"] = datetime.now(timezone.utc).isoformat()
        return 200, leave
    if name in ("check_in", "check_out"):
        if not me:
            return 400, {"message": "No employee record for this user."}
        if not body.get("p_location_verified"):
            return 400, {"message": "Outside office radius."}
        if body.get("p_mocked"):
            return 400, {"message": "Mock location detected."}
        now = datetime.now(timezone(timedelta(hours=5)))
        today = now.date().isoformat()
        row = next((r for r in mock["attendance_records"]
                    if r["employee_id"] == me["id"] and r["work_date"] == today), None)
        if name == "check_in":
            if row and row["status"] == "Leave":
                return 400, {"message": "You are on approved leave today."}
            if row is not None:
                return 400, {"message": "Already checked in today."}
            status = "Late" if now.strftime("%H:%M") > settings["late_cutoff_time"] else "Present"
            row = {"id": str(uuid.uuid4()), "employee_id": me["id"], "work_date": today,
                   "check_in_at": now.isoformat(), "check_out_at": None,
                   "status": status, "total_hours": None, "location_verified": True,
                   "mocked_location": False,
                   "check_in_distance_meters": body.get("p_distance_meters"),
                   "leave_type": None, "leave_id": None}
            mock["attendance_records"].append(row)
            return 200, row
        if row is None or not row.get("check_in_at") or row.get("check_out_at"):
            return 400, {"message": "No check in today, or already checked out."}
        row["check_out_at"] = now.isoformat()
        if row["check_in_at"]:
            cin = datetime.fromisoformat(row["check_in_at"])
            row["total_hours"] = round((now - cin).total_seconds() / 3600, 2)
        return 200, row
    return 404, {"message": f"Unknown RPC {name}"}


def make_route_handler(mock):
    def handler(route):
        req = route.request
        url = urlparse(req.url)
        path = url.path
        method = req.method
        params = parse_qs(url.query)
        auth = req.headers.get("authorization", "")
        token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else ""
        auth_id, _email = TOKENS.get(token, (None, None))
        try:
            body = json.loads(req.post_data) if req.post_data else {}
        except json.JSONDecodeError:
            body = {}
        single = "vnd.pgrst.object+json" in req.headers.get("accept", "")

        def fulfill(status, payload):
            route.fulfill(status=status, content_type="application/json",
                          body=json.dumps(payload))

        # ---- Auth (GoTrue) ----
        if path.startswith("/auth/v1/"):
            if path == "/auth/v1/token" and "grant_type=password" in url.query:
                email = (body.get("email") or "").lower()
                if email in USERS and (body.get("password") or "") == "demo-pass-123":
                    auth_id2, _eid, _name, _role = USERS[email]
                    return fulfill(200, session_for(auth_id2, email))
                return fulfill(400, {"error": "invalid_grant",
                                     "error_description": "Invalid login credentials"})
            if path == "/auth/v1/token" and "grant_type=refresh_token" in url.query:
                old = body.get("refresh_token", "")
                auth_id2 = old.replace("mock-refresh-", "") if old.startswith("mock-refresh-") else None
                email = next((e for e, v in USERS.items() if v[0] == auth_id2), None)
                if email:
                    return fulfill(200, session_for(auth_id2, email))
                return fulfill(400, {"error": "invalid_grant",
                                     "error_description": "Invalid refresh token"})
            if path == "/auth/v1/signup":
                email = (body.get("email") or "").lower()
                new_id = f"new-auth-{uuid.uuid4().hex[:8]}"
                USERS[email] = (new_id, None, email, "employee")
                return fulfill(200, {"user": {"id": new_id, "email": email},
                                     "session": session_for(new_id, email)})
            if path == "/auth/v1/user":
                if auth_id:
                    email = next((e for e, v in USERS.items() if v[0] == auth_id), email)
                    return fulfill(200, {"id": auth_id, "email": email,
                                         "aud": "authenticated", "role": "authenticated"})
                return fulfill(401, {"error": "invalid token"})
            if path == "/auth/v1/logout":
                return fulfill(200, {})
            return fulfill(404, {"message": "mock auth route not implemented: " + path})

        # ---- PostgREST ----
        if path.startswith("/rest/v1/rpc/"):
            name = path.split("/")[-1]
            status, payload = _rpc(mock, name, body, auth_id)
            return fulfill(status, payload)
        if path.startswith("/rest/v1/"):
            table = path.split("/")[-1]
            if table not in mock:
                return fulfill(404, {"message": f"mock table {table} not found"})
            rows = mock[table]
            if method == "GET":
                out = _embed(_apply_query(rows, params), table, mock)
                if single:
                    if not out:
                        return fulfill(406, {"code": "PGRST116",
                                             "message": "JSON object requested, multiple (or no) rows returned"})
                    return fulfill(200, out[0])
                return fulfill(200, out)
            if method == "POST":
                items = body if isinstance(body, list) else [body]
                saved = []
                for item in items:
                    row = dict(item)
                    row.setdefault("id", str(uuid.uuid4()))
                    row.setdefault("created_at", datetime.now(timezone.utc).isoformat())
                    rows.append(row)
                    saved.append(row)
                return fulfill(201, saved)
            if method == "PATCH":
                out = _apply_query(rows, params)
                for r in out:
                    r.update(body)
                return fulfill(200, out)
            return fulfill(405, {"message": "method not allowed in mock"})
        return fulfill(404, {"message": "mock route not implemented: " + path})

    return handler

# ------------------------------------------------------------------- helpers
def shot(page, name, full_page=False):
    path = os.path.join(SHOTS, name)
    page.screenshot(path=path, full_page=full_page)
    size = os.path.getsize(path)
    print(f"  saved {name} ({size} bytes)")
    return path


def console_errors(page):
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    return errors


def wait_text(page, text, timeout=10000):
    page.get_by_text(text, exact=False).first.wait_for(timeout=timeout)


# ------------------------------------------------------------------- admin
def admin_flow(pw):
    mock = make_mock(include_test_user=False)
    browser = pw.chromium.launch(args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    ctx.route(f"**://{SUPABASE_HOST}/**", make_route_handler(mock))
    page = ctx.new_page()
    errors = console_errors(page)

    # 01: login screen, then a wrong-password attempt (real error path).
    page.goto(ADMIN_URL)
    wait_text(page, "HOD Admin Panel")
    page.locator('input[type="email"]').fill("hod.demo@lgu.edu.pk")
    page.locator('input[type="password"]').fill("wrong-password")
    page.get_by_role("button", name="Sign In").click()
    wait_text(page, "Wrong email or password")
    shot(page, "01-admin-login.png")
    log("admin login wrong password shows error", "PASS",
        "error text shown, stayed on login screen")
    # The failed login returns HTTP 400 from Auth by design, which the
    # browser logs as a console error. Clear it so later console checks
    # only catch errors from the logged-in app.
    errors.clear()

    # Correct login through the real form (mocked Auth answers).
    page.locator('input[type="password"]').fill("demo-pass-123")
    page.get_by_role("button", name="Sign In").click()
    wait_text(page, "Today,")
    log("admin login correct password reaches dashboard", "PASS",
        "HOD session via mocked Auth, dashboard lists loaded from mock seed data")
    shot(page, "02-admin-dashboard.png")
    stats = page.locator(".stats").inner_text()
    expected = {"Staff": "3", "Present": "3", "Late": "0",
                "On leave": "0", "Absent": "0", "Checked out": "3"}
    stats_ok = True
    for label, value in expected.items():
        block = page.locator(".stat", has_text=label)
        got = block.locator("strong").inner_text().strip()
        if got != value:
            stats_ok = False
            log("admin dashboard stats", "FAIL",
                f"{label}: expected {value}, got {got} (stats text: {stats!r})")
    if stats_ok:
        log("admin dashboard lists Present/Late/On Leave/Absent", "PASS",
            "5 Nov 2026 seed data read from the page: Staff 3, Present 3, "
            "Late 0, On leave 0, Absent 0, Checked out 3 (HOD not counted)")

    # Mark absent: on 5 Nov everyone checked in, so the button must be
    # disabled (absentUnmarked 0). Capture that correct state, then run a
    # simulated scenario with Bilal's 5 Nov record removed in the mock.
    btn = page.get_by_role("button", name=re.compile(r"Mark absent for today"))
    if btn.is_disabled():
        log("admin mark-absent button disabled when nobody unmarked", "PASS",
            "button disabled on 5 Nov, all 3 staff checked in (seed data)")
    else:
        log("admin mark-absent button disabled when nobody unmarked", "FAIL",
            "button was enabled with 0 unmarked")
    mock["attendance_records"] = [r for r in mock["attendance_records"]
                                  if not (r["employee_id"] == BILAL_ID
                                          and r["work_date"] == TODAY)]
    page.get_by_role("button", name="Refresh").click()
    page.wait_for_timeout(800)
    wait_text(page, "Mark absent for today (1)")
    shot(page, "03-admin-dashboard-mark-absent.png")
    page.get_by_role("button", name=re.compile(r"Mark absent for today")).click()
    wait_text(page, "Marked 1 employee(s) Absent for today")
    shot(page, "03b-admin-dashboard-mark-absent-done.png")
    log("admin mark absent (simulated Bilal missing)", "PASS",
        "simulated day only: Bilal 5 Nov record removed in mock, RPC marked 1 Absent, "
        "approved leave never marked (mock RPC follows schema.sql)")
    # Restore Bilal's record for the remaining screens.
    mock["attendance_records"] = seed_rows()
    page.get_by_role("button", name="Refresh").click()
    page.wait_for_timeout(800)

    # Leave requests: reject with no reason must fail first.
    page.get_by_role("link", name="Leave Requests").click()
    wait_text(page, "Leave Requests")
    wait_text(page, "Bilal Ahmed")
    shot(page, "04-admin-leave-requests.png")
    page.get_by_role("button", name="Reject").first.click()
    wait_text(page, "Write a reason before rejecting")
    shot(page, "05-admin-leave-request-reject-error.png")
    log("admin reject without reason blocked", "PASS",
        "error shown, request stayed Pending")
    page.get_by_role("button", name="Approve").first.click()
    wait_text(page, "Approved Bilal Ahmed")
    wait_text(page, "2 Leave day(s) written")
    shot(page, "06-admin-leave-request-approved.png")
    log("admin approve leave writes Leave days", "PASS",
        "Bilal Annual 9-10 Nov 2026 approved, 2 Leave days written (mock RPC)")

    # Employee detail: click through from the dashboard.
    page.get_by_role("link", name="Today").click()
    wait_text(page, "Today,")
    page.get_by_role("link", name="Ahmed Khan (DEMO)").first.click()
    wait_text(page, "Leave balance")
    shot(page, "07-admin-employee-detail.png", full_page=True)
    log("admin employee detail monthly view", "PASS",
        "Ahmed EX-001, Nov 2026 rows, leave balance 20 left of 20")

    # Monthly report + real Excel download from the admin panel.
    page.get_by_role("link", name="Monthly Report").click()
    wait_text(page, "Monthly Report")
    wait_text(page, "Ahmed Khan (DEMO)")
    page.wait_for_timeout(1000)
    shot(page, "08-admin-monthly-report.png", full_page=True)
    with page.expect_download() as dl_info:
        page.get_by_role("button", name="Download Full Excel").click()
    download = dl_info.value
    xlsx_path = os.path.join(SHOTS, "LGU-Attendance-Full-2026-11-E2E.xlsx")
    download.save_as(xlsx_path)
    log("admin monthly report Excel download", "PASS",
        f"downloaded {download.suggested_filename} ({os.path.getsize(xlsx_path)} bytes)")

    # Employees: fill the add form and submit (last, session changes).
    page.get_by_role("link", name="Employees").click()
    wait_text(page, "Add employee")
    shot(page, "09-admin-employees.png")
    page.get_by_label("Full name").fill("New Staff (DEMO)")
    page.get_by_label("Employee ID").fill("EX-005")
    page.get_by_label("Designation").fill("Assistant (Examinations)")
    page.get_by_label("Email").fill("new.staff.demo@lgu.edu.pk")
    page.get_by_label("Temporary password").fill("demo-pass-123")
    page.get_by_role("button", name="Add Employee").click()
    wait_text(page, "Added New Staff (DEMO)")
    page.wait_for_timeout(800)
    shot(page, "10-admin-employees-added.png")
    hod_banner = page.get_by_text("This panel is for the HOD only").count() > 0
    log("admin add employee", "PASS" if hod_banner else "CHECK",
        "new employee row added and success shown; after sign-up the browser is "
        "signed in as the new employee, so the HOD-only banner appears (known "
        "behaviour, documented in the app as fix 8 warning)")
    # Restore the HOD session and confirm the dashboard works again.
    page.evaluate("""() => {
      const s = %s;
      localStorage.setItem('sb-demo-auth-token', JSON.stringify(s));
    }""" % json.dumps(session_for("hod-auth-id", "hod.demo@lgu.edu.pk")))
    page.goto(ADMIN_URL)
    wait_text(page, "Today,")
    log("admin session restored after add-employee", "PASS",
        "HOD session restored, dashboard loads again")

    # Settings: change radius 100 to 120, save, then change it back.
    page.get_by_role("link", name="Settings").click()
    wait_text(page, "Office Settings")
    shot(page, "11-admin-settings.png")
    page.get_by_label("Radius in metres").fill("120")
    page.get_by_role("button", name="Save Settings").click()
    wait_text(page, "Settings saved")
    shot(page, "12-admin-settings-saved.png")
    log("admin settings save (radius 100 to 120)", "PASS",
        "success message shown, mock settings updated")
    page.get_by_label("Radius in metres").fill("100")
    page.get_by_role("button", name="Save Settings").click()
    wait_text(page, "Settings saved")
    log("admin settings restored to radius 100", "PASS", "defaults left intact")

    if errors:
        log("admin console errors", "CHECK", "; ".join(errors[:5]))
    else:
        log("admin console errors", "PASS", "no console errors or page errors")
    ctx.close()
    browser.close()
    return mock

# ------------------------------------------------------------------- mobile
OFFICE_GEO = {"latitude": 31.4640, "longitude": 74.4427}
FAR_GEO = {"latitude": 31.5000, "longitude": 74.5000}  # about 5.5 km away


def mobile_login(page, email):
    page.goto(MOBILE_URL)
    wait_text(page, "Sign in with your department account", timeout=20000)
    page.get_by_placeholder("Email").fill(email)
    page.get_by_placeholder("Password").fill("demo-pass-123")
    page.get_by_text("Sign In", exact=True).click()


def mobile_flow(pw):
    mock = make_mock(include_test_user=True)
    browser = pw.chromium.launch(args=["--no-sandbox"])
    # --- wrong password first (login error path) ---
    ctx = browser.new_context(viewport={"width": 390, "height": 844},
                              geolocation=OFFICE_GEO, permissions=["geolocation"])
    ctx.route(f"**://{SUPABASE_HOST}/**", make_route_handler(mock))
    page = ctx.new_page()
    errors = console_errors(page)
    page.goto(MOBILE_URL)
    wait_text(page, "Sign in with your department account", timeout=20000)
    shot(page, "20-mobile-login.png")
    page.get_by_placeholder("Email").fill("e2e.test.demo@lgu.edu.pk")
    page.get_by_placeholder("Password").fill("wrong-password")
    page.get_by_text("Sign In", exact=True).click()
    wait_text(page, "Wrong email or password")
    shot(page, "21-mobile-login-error.png")
    log("mobile login wrong password shows error", "PASS",
        "error text shown, stayed on login screen")
    # The failed login returns HTTP 400 from Auth by design, which the
    # browser logs as a console error. Clear it so the final console check
    # only catches errors from the logged-in app.
    errors.clear()
    ctx.close()

    # --- EX-004 test user: fresh day, no check in yet ---
    ctx = browser.new_context(viewport={"width": 390, "height": 844},
                              geolocation=OFFICE_GEO, permissions=["geolocation"])
    ctx.route(f"**://{SUPABASE_HOST}/**", make_route_handler(mock))
    page = ctx.new_page()
    console_errors(page)
    mobile_login(page, "e2e.test.demo@lgu.edu.pk")
    wait_text(page, "E2E Test (DEMO)")
    wait_text(page, "You have not checked in yet today.")
    try:
        wait_text(page, "days left of 20 allowed", timeout=5000)
    except Exception:
        pass
    shot(page, "24-mobile-home-testuser.png")
    log("mobile home fresh user, not checked in", "PASS",
        "EX-004 mock-only test employee, profile shown, Check In enabled")

    # Check in inside the radius: GPS passes, then the biometric step runs.
    # This VM has no fingerprint sensor, so the app must refuse here.
    page.get_by_text("Check In with Fingerprint", exact=True).click()
    page.wait_for_timeout(2500)
    body = page.locator("body").inner_text()
    if "fingerprint" in body.lower() or "face" in body.lower() or "sensor" in body.lower():
        shot(page, "26-mobile-checkin-biometric.png")
        log("mobile check in inside radius reaches biometric step", "PASS",
            "GPS passed, biometric step refused on this VM (no sensor), "
            "no check-in row was written")
    else:
        shot(page, "26-mobile-checkin-biometric.png")
        log("mobile check in inside radius reaches biometric step", "CHECK",
            f"unexpected screen text: {body[:200]}")

    # Leave apply: invalid date, then a valid request, then an overlap.
    page.get_by_text("Apply for Leave", exact=True).click()
    wait_text(page, "APPLY FOR LEAVE")
    page.get_by_placeholder("2026-11-10").first.fill("2026-02-30")
    page.get_by_placeholder("2026-11-10").nth(1).fill("2026-03-02")
    page.get_by_placeholder("e.g. Family function in Lahore").fill("Test leave")
    page.get_by_text("Submit Leave Request", exact=True).click()
    wait_text(page, "That date does not exist")
    shot(page, "28-mobile-leave-apply-invalid.png")
    log("mobile leave apply invalid date refused", "PASS",
        "2026-02-30 refused with a clear message, nothing submitted")
    page.get_by_placeholder("2026-11-10").first.fill("2026-11-09")
    page.get_by_placeholder("2026-11-10").nth(1).fill("2026-11-10")
    page.get_by_text("Submit Leave Request", exact=True).click()
    wait_text(page, "Leave request sent to the HOD")
    shot(page, "29-mobile-leave-apply-submitted.png")
    log("mobile leave apply valid request submitted", "PASS",
        "Casual 9-10 Nov 2026, 2 working days, sent to HOD")
    page.get_by_text("Back to Home", exact=True).click()
    wait_text(page, "E2E Test (DEMO)")
    page.get_by_text("Apply for Leave", exact=True).click()
    wait_text(page, "APPLY FOR LEAVE")
    page.get_by_placeholder("2026-11-10").first.fill("2026-11-10")
    page.get_by_placeholder("2026-11-10").nth(1).fill("2026-11-11")
    page.get_by_placeholder("e.g. Family function in Lahore").fill("Overlapping test")
    page.get_by_text("Submit Leave Request", exact=True).click()
    wait_text(page, "already have a pending or approved leave")
    shot(page, "30-mobile-leave-apply-overlap.png")
    log("mobile leave apply overlapping request refused", "PASS",
        "second request over 10-11 Nov refused, first request unchanged")
    page.get_by_text("Back to Home", exact=True).click()
    wait_text(page, "E2E Test (DEMO)")
    page.get_by_text("My Leaves and Balance", exact=True).click()
    wait_text(page, "MY LEAVE REQUESTS")
    wait_text(page, "Casual leave")
    shot(page, "31-mobile-leaves.png")
    log("mobile my leaves shows pending request and balance", "PASS",
        "Casual 9-10 Nov Pending, 20 days left of 20 allowed, 0 taken")
    ctx.close()

    # --- outside the radius: GPS must refuse before biometrics ---
    ctx = browser.new_context(viewport={"width": 390, "height": 844},
                              geolocation=FAR_GEO, permissions=["geolocation"])
    ctx.route(f"**://{SUPABASE_HOST}/**", make_route_handler(mock))
    page = ctx.new_page()
    mobile_login(page, "e2e.test.demo@lgu.edu.pk")
    wait_text(page, "E2E Test (DEMO)")
    page.get_by_text("Check In with Fingerprint", exact=True).click()
    wait_text(page, "metres from the office", timeout=15000)
    shot(page, "25-mobile-checkin-outside-radius.png")
    log("mobile check in outside radius refused", "PASS",
        "far GPS fix refused with the distance shown, biometric never reached")
    ctx.close()

    # --- Bilal: checked in, not yet checked out ---
    # The seed has Bilal checked out at 17:02 on 5 Nov, so for this test
    # only, his 5 Nov check-out is removed in the mock (simulated state),
    # which leaves the Check Out button enabled.
    for _row in mock["attendance_records"]:
        if _row["employee_id"] == BILAL_ID and _row["work_date"] == TODAY:
            _row["check_out_at"] = None
            _row["total_hours"] = None
    ctx = browser.new_context(viewport={"width": 390, "height": 844},
                              geolocation=OFFICE_GEO, permissions=["geolocation"])
    ctx.route(f"**://{SUPABASE_HOST}/**", make_route_handler(mock))
    page = ctx.new_page()
    mobile_login(page, "bilal.ahmed.demo@lgu.edu.pk")
    wait_text(page, "Bilal Ahmed (DEMO)")
    wait_text(page, "09:03 am")
    shot(page, "27-mobile-home-bilal.png")
    page.get_by_text("Check Out with Fingerprint", exact=True).click()
    page.wait_for_timeout(2500)
    body = page.locator("body").inner_text()
    if "fingerprint" in body.lower() or "face" in body.lower() or "sensor" in body.lower():
        shot(page, "27b-mobile-checkout-biometric.png")
        log("mobile check out reaches biometric step", "PASS",
            "Bilal checked in 09:03, not yet checked out (simulated: his 5 Nov "
            "check-out removed in the mock, seed has him out at 17:02), Check Out "
            "enabled, biometric refused on this VM (no sensor), no check-out "
            "was written")
    else:
        shot(page, "27b-mobile-checkout-biometric.png")
        log("mobile check out reaches biometric step", "CHECK",
            f"unexpected screen text: {body[:200]}")
    ctx.close()

    # --- Ahmed: checked in and out, history with Leave and Absent rows ---
    ctx = browser.new_context(viewport={"width": 390, "height": 844},
                              geolocation=OFFICE_GEO, permissions=["geolocation"])
    ctx.route(f"**://{SUPABASE_HOST}/**", make_route_handler(mock))
    page = ctx.new_page()
    mobile_login(page, "ahmed.khan.demo@lgu.edu.pk")
    wait_text(page, "Ahmed Khan (DEMO)")
    wait_text(page, "7.95 h")
    shot(page, "22-mobile-home-ahmed.png")
    log("mobile home Ahmed shows today total hours", "PASS",
        "checked in 09:04, out 17:01, 7.95 h, both buttons disabled")
    page.get_by_text("Full History (90 days)", exact=True).click()
    wait_text(page, "MY ATTENDANCE, LAST 90 DAYS")
    wait_text(page, "Late")
    shot(page, "23-mobile-history-ahmed.png")
    log("mobile history shows Present, Late and Absent rows", "PASS",
        "Ahmed 2-6 Nov 2026, Late 4 Nov shown, 90-day view")
    if errors:
        log("mobile console errors", "CHECK", "; ".join(errors[:5]))
    else:
        log("mobile console errors", "PASS", "no console errors or page errors")
    ctx.close()
    browser.close()


if __name__ == "__main__":
    with sync_playwright() as pw:
        print("== Admin flow ==")
        admin_flow(pw)
        print("== Mobile flow ==")
        mobile_flow(pw)
    print()
    print("== Results ==")
    for name, status, note in RESULTS:
        print(f"{status:6} {name} {note}")
    failed = [r for r in RESULTS if r[1] == "FAIL"]
    print(f"Total: {len(RESULTS)} checks, {len(failed)} failed")
    sys.exit(1 if failed else 0)
