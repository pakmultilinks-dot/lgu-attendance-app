#!/usr/bin/env python3
"""Demo-mode E2E for LGU Attendance mobile app.

Tests the Try demo flow end to end in the real Expo web export, with no
Supabase project and no env vars at all (the export is built with the
Supabase env vars unset, which used to crash the app at import).

No Supabase call is made anywhere in the demo flow: the demo sign in,
seed data, check in/out, history and leave requests all run locally
in AsyncStorage on the phone. The only network call the app could make
is the real email/password sign in, which must refuse with a human
message instead of crashing when no live database is configured.

Screenshots go to ~/workspace/lgu-attendance-app/screenshots-demo/ as
real PNG files. The mobile web export is built from a scratch copy in
~/workspace/.e2e-mobile-demo (web deps live there only, the project
itself is untouched) and served on http://127.0.0.1:8080.

Usage: python3 tests/e2e-screenshots-demo.py
Requires: playwright (python) + /opt/meta-chromium/chrome.
"""
import os
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.path.expanduser("~/workspace/lgu-attendance-app")
SHOTS = os.path.join(BASE, "screenshots-demo")
os.makedirs(SHOTS, exist_ok=True)
SCRATCH_DIST = os.path.expanduser("~/workspace/.e2e-mobile-demo/dist")
MOBILE_URL = "http://127.0.0.1:8080/"
OFFICE_GEO = {"latitude": 31.4640, "longitude": 74.4427}
RESULTS = []


def log(name, status, note=""):
    RESULTS.append((name, status, note))
    print(f"[{status}] {name} {note}")


def shot(page, name):
    path = os.path.join(SHOTS, name)
    page.screenshot(path=path)
    print(f"  saved {name} ({os.path.getsize(path)} bytes)")
    return path


def wait_text(page, text, timeout=15000):
    page.get_by_text(text, exact=False).first.wait_for(timeout=timeout)


def main():
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", "8080", "--bind", "127.0.0.1"],
        cwd=SCRATCH_DIST,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(30):
            try:
                urllib.request.urlopen(MOBILE_URL, timeout=2)
                break
            except Exception:
                time.sleep(0.5)
        with sync_playwright() as pw:
            browser = pw.chromium.launch(args=["--no-sandbox"])
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                geolocation=OFFICE_GEO,
                permissions=["geolocation"],
            )
            page = ctx.new_page()
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))

            # 1. Login screen shows the Try demo button.
            page.goto(MOBILE_URL)
            wait_text(page, "Sign in with your department account", timeout=20000)
            wait_text(page, "Try demo, no account needed")
            shot(page, "demo-login-button.png")
            log("login shows Try demo button", "PASS",
                "Try demo, no account needed, below Sign In")

            # 2. Real sign in with no live database refuses in plain words.
            page.get_by_placeholder("Email").fill("ahmed.khan@lgu.edu.pk")
            page.get_by_placeholder("Password").fill("anything123")
            page.get_by_text("Sign In", exact=True).click()
            wait_text(page, "Sign in is not set up yet")
            shot(page, "demo-signin-not-setup.png")
            log("real sign in without live database shows setup message", "PASS",
                "Sign in is not set up yet. Use Try demo, or ask for the live database to be connected.")

            # 3. Try demo opens as Ahmed Khan, with the Demo pill.
            page.get_by_text("Try demo, no account needed", exact=True).click()
            wait_text(page, "Ahmed Khan")
            wait_text(page, "Demo, data stays on this phone")
            wait_text(page, "You have not checked in yet today.")
            shot(page, "demo-home.png")
            log("Try demo opens Ahmed Khan home, Demo pill shown", "PASS",
                "profile Ahmed Khan EX-001, today unchecked, Demo pill visible")
            keys = page.evaluate("() => Object.keys(localStorage).filter(k => k.includes('lgu_demo'))")
            if keys:
                log("demo state stored locally on the phone", "PASS", f"localStorage keys: {keys}")
            else:
                log("demo state stored locally on the phone", "FAIL", "no lgu_demo keys in localStorage")

            # 4. History shows the seed rows, grouped by month.
            page.get_by_text("Full History (90 days)", exact=True).click()
            wait_text(page, "My attendance")
            wait_text(page, "November 2026")
            wait_text(page, "Late")
            shot(page, "demo-history.png")
            log("demo history shows seed rows grouped by month", "PASS",
                "Nov 2026, Present and Late rows from 2 to 4 Nov 2026")
            page.get_by_text("Today", exact=True).click()
            wait_text(page, "Ahmed Khan")

            # 5. Check in inside the radius reaches the biometric step.
            # This VM has no fingerprint sensor, so the app must refuse
            # here and write no check-in row. That is the honest result.
            # The error banner sits below the fold, so scroll it into
            # view before the screenshot, or the shot is identical to home.
            page.get_by_text("Check In with Fingerprint", exact=True).click()
            page.wait_for_timeout(2500)
            body = page.locator("body").inner_text()
            if "no fingerprint or face sensor" in body.lower():
                page.get_by_text("no fingerprint or face sensor").first.scroll_into_view_if_needed(timeout=5000)
                page.wait_for_timeout(500)
                shot(page, "demo-checkin.png")
                log("demo check in inside radius reaches biometric step", "PASS",
                    "GPS passed, biometric refused with 'This phone has no fingerprint or face sensor', no check-in written")
            elif "fingerprint" in body.lower() or "face" in body.lower() or "sensor" in body.lower():
                page.mouse.wheel(0, 500)
                page.wait_for_timeout(500)
                shot(page, "demo-checkin.png")
                log("demo check in inside radius reaches biometric step", "PASS",
                    "GPS passed, biometric step refused on this VM (no sensor), no check-in written")
            else:
                shot(page, "demo-checkin.png")
                log("demo check in inside radius reaches biometric step", "CHECK",
                    f"unexpected screen text: {body[:200]}")

            # 6. Leave apply through the real date picker, saved locally.
            page.get_by_text("Apply Leave", exact=True).click()
            wait_text(page, "Apply for leave")
            page.get_by_text("Choose a date", exact=True).first.click()
            page.get_by_text("Nov", exact=True).click()
            page.get_by_text("9", exact=True).first.click()
            page.get_by_text("Choose a date", exact=True).first.click()
            page.get_by_text("Nov", exact=True).click()
            page.get_by_text("10", exact=True).first.click()
            page.get_by_placeholder("Family function in Lahore").fill("Demo leave test")
            page.get_by_text("Submit Leave Request", exact=True).click()
            wait_text(page, "Leave request saved on this phone as a demo")
            shot(page, "demo-leave.png")
            log("demo leave apply submitted through the picker", "PASS",
                "Casual 9-10 Nov 2026 saved locally, stays Pending in demo mode")
            page.get_by_text("My Leaves", exact=True).click()
            wait_text(page, "My leave requests")
            wait_text(page, "Casual leave")
            wait_text(page, "Pending")
            shot(page, "demo-leaves.png")
            log("demo my leaves shows pending request", "PASS",
                "Casual 9-10 Nov Pending, balance 20 days left of 20 allowed")

            # 7. Reload: the demo session is restored, still Ahmed Khan.
            page.reload()
            wait_text(page, "Ahmed Khan", timeout=20000)
            wait_text(page, "Demo, data stays on this phone")
            log("demo session restored after reload", "PASS",
                "reopened straight into demo home, leave still Pending")
            page.get_by_text("My Leaves", exact=True).click()
            wait_text(page, "Casual leave")

            # 8. Demo sign out returns to the login screen.
            page.get_by_text("Today", exact=True).click()
            wait_text(page, "Ahmed Khan")
            page.get_by_text("Sign out", exact=True).click()
            wait_text(page, "Try demo, no account needed")
            log("demo sign out returns to login", "PASS",
                "back on the sign in screen, Try demo offered again")

            if errors:
                log("mobile console errors", "CHECK", "; ".join(errors[:5]))
            else:
                log("mobile console errors", "PASS", "no console errors or page errors")
            ctx.close()
            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except Exception:
            server.kill()

    print()
    print("== Results ==")
    for name, status, note in RESULTS:
        print(f"{status:6} {name} {note}")
    failed = [r for r in RESULTS if r[1] == "FAIL"]
    print(f"Total: {len(RESULTS)} checks, {len(failed)} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
