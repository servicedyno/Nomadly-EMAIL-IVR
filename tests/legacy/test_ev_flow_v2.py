#!/usr/bin/env python3
"""
Email Validation Flow — Webhook Simulator Test (v2)
Tests: menu, paste, free trial, payment, cancel, history, upload, back, min-email error
"""
import requests, time, subprocess

WEBHOOK_URL = "http://localhost:5000/telegram/webhook"
CHAT_ID = 5168006768
USERNAME = "hostbay_support"
FIRST_NAME = "Hostbay"
counter = 960000

def send(text, wait=2.5):
    global counter; counter += 1
    r = requests.post(WEBHOOK_URL, json={
        "update_id": counter,
        "message": {
            "message_id": counter,
            "from": {"id": CHAT_ID, "is_bot": False, "first_name": FIRST_NAME, "username": USERNAME},
            "chat": {"id": CHAT_ID, "first_name": FIRST_NAME, "username": USERNAME, "type": "private"},
            "date": int(time.time()), "text": text
        }
    }, timeout=10)
    time.sleep(wait)
    return r.status_code

def replies(n=8):
    out = subprocess.run(["tail", "-n", "100", "/var/log/supervisor/nodejs.out.log"], capture_output=True, text=True).stdout
    lines = [l for l in out.strip().split('\n') if l.startswith('reply:') or 'Error' in l]
    return lines[-n:]

def has(keywords, n=5):
    combined = ' '.join(replies(n)).lower()
    return any(k.lower() in combined for k in keywords)

results = []
def test(name, ok):
    results.append((name, ok))
    print(f"{'✅' if ok else '❌'} {name}")

subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.err.log"])
print("="*50)
print("📧 EMAIL VALIDATION — WEBHOOK SIMULATOR TEST v2")
print("="*50 + "\n")

# Reset
send("/start", 3)

# 1. Menu opens with free trial mention
send("📧 Email Validation", 3)
test("1. EV menu opens with free trial mention", has(["email validation", "free trial", "🎁"]))

# 2. Paste Emails
send("📋 Paste Emails", 2)
test("2. Paste prompt appears", has(["paste", "email"]))

# 3. Paste 15 emails (under 50 limit) → should get free trial offer
emails_15 = "\n".join([f"user{i}@test.com" for i in range(1, 16)])
send(emails_15, 3)
r = replies(5)
combined = ' '.join(r)
has_free_trial = "free trial" in combined.lower() or "🎁" in combined
has_start_btn = "Start Free Trial" in combined
test("3. Free trial offer shown (15 emails ≤ 50 limit)", has_free_trial)
test("4. '🎁 Start Free Trial' button present", has_start_btn)

# 5. Click Start Free Trial
send("🎁 Start Free Trial", 3)
r = replies(5)
combined = ' '.join(r).lower()
trial_started = "free trial started" in combined or ("free" in combined and "validating" in combined) or "$0.00" in combined
test("5. Free trial starts processing", trial_started)

# 6. Check that free trial is now used — second time should show pricing
send("📧 Email Validation", 3)
r = replies(5)
combined = ' '.join(r).lower()
no_trial_text = "free trial" not in combined  # trial used, so no mention
test("6. After trial used, menu no longer shows free trial", no_trial_text)

# 7. Paste emails again → should show paid pricing (no free trial)
send("📋 Paste Emails", 2)
send(emails_15, 3)
r = replies(5)
combined = ' '.join(r)
has_pay_buttons = "Pay USD" in combined or "Pay NGN" in combined
no_trial_btn = "Start Free Trial" not in combined
test("7. After trial used, shows paid pricing (no trial button)", has_pay_buttons and no_trial_btn)

# 8. Cancel and test back
send("❌ Cancel", 2)
test("8. Cancel works", has(["cancel"]))

# 9. Back button from EV menu
send("📧 Email Validation", 3)
send("🔙 Back", 2)
test("9. Back returns to main menu", has(["bulletproof", "cloud phone", "wallet", "targeted", "main menu"]))

# 10. Too few emails
send("📧 Email Validation", 3)
send("📋 Paste Emails", 2)
send("one@test.com\ntwo@test.com", 3)
test("10. Too few emails error", has(["minimum", "required", "found only"]))

# 11. Upload button
send("❌ Cancel", 2)
send("📧 Email Validation", 3)
send("📤 Upload List (CSV/TXT)", 2)
test("11. Upload prompt appears", has(["upload", "csv", "txt"]))

# 12. My Validations
send("❌ Cancel", 2)
send("📧 Email Validation", 3)
send("📜 My Validations", 3)
test("12. My Validations responds", has(["validation", "no validation", "job", "validations"]))

# Check errors
send("/start", 2)
errs = subprocess.run(["cat", "/var/log/supervisor/nodejs.err.log"], capture_output=True, text=True).stdout.strip()
if errs:
    print(f"\n⚠️ ERRORS: {errs[:300]}")
else:
    print("\n✅ No errors in nodejs.err.log")

# Summary
print("\n" + "="*50)
p = sum(1 for _, ok in results if ok)
for name, ok in results:
    print(f"  {'✅' if ok else '❌'} {name}")
print(f"\n  Result: {p}/{len(results)} passed")
print("="*50)
