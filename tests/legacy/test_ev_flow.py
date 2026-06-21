#!/usr/bin/env python3
"""
Email Validation Flow — Webhook Simulator Test
Tests the complete email validation journey: menu → paste → pricing → payment → cancel flows.
"""

import requests
import time
import subprocess
import json

WEBHOOK_URL = "http://localhost:5000/telegram/webhook"
CHAT_ID = 5168006768
USERNAME = "hostbay_support"
FIRST_NAME = "Hostbay"

update_counter = 950000

def send_message(text, sleep_time=2.5):
    global update_counter
    update_counter += 1
    payload = {
        "update_id": update_counter,
        "message": {
            "message_id": update_counter,
            "from": {"id": CHAT_ID, "is_bot": False, "first_name": FIRST_NAME, "username": USERNAME},
            "chat": {"id": CHAT_ID, "first_name": FIRST_NAME, "username": USERNAME, "type": "private"},
            "date": int(time.time()),
            "text": text
        }
    }
    try:
        r = requests.post(WEBHOOK_URL, json=payload, timeout=10)
        time.sleep(sleep_time)
        return r.status_code
    except Exception as e:
        print(f"  [HTTP ERROR] {e}")
        return -1

def get_last_replies(n=8):
    result = subprocess.run(
        ["tail", "-n", "80", "/var/log/supervisor/nodejs.out.log"],
        capture_output=True, text=True
    )
    lines = result.stdout.strip().split('\n')
    replies = [l for l in lines if l.startswith('reply:') or 'Error' in l or 'error' in l]
    return replies[-n:]

def check_errors():
    result = subprocess.run(
        ["cat", "/var/log/supervisor/nodejs.err.log"],
        capture_output=True, text=True
    )
    return result.stdout.strip()

def assert_reply_contains(keywords, step_name):
    replies = get_last_replies(5)
    combined = ' '.join(replies).lower()
    for kw in keywords:
        if kw.lower() in combined:
            print(f"  ✅ {step_name}: Found '{kw}'")
            return True
    print(f"  ❌ {step_name}: Expected one of {keywords}")
    for r in replies[-3:]:
        print(f"     Reply: {r[:200]}")
    return False

results = []
def test(name, passed):
    results.append((name, passed))
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{'='*60}\n{status}: {name}\n{'='*60}")
    return passed

# Clear error log
subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.err.log"])

print("\n" + "="*60)
print("📧 EMAIL VALIDATION FLOW — WEBHOOK SIMULATOR TEST")
print("="*60)

# ── Test 1: Reset to main menu ──
print("\n── Step 0: Reset to main menu ──")
send_message("/start", 3)

# ── Test 1: Open Email Validation menu ──
print("\n── Test 1: Open Email Validation menu ──")
send_message("📧 Email Validation", 3)
passed = assert_reply_contains(["email validation", "97%", "pricing", "accuracy"], "EV Menu")
# Check buttons
replies = get_last_replies(3)
combined = ' '.join(replies)
has_upload_btn = "Upload List" in combined
has_paste_btn = "Paste Emails" in combined
has_history_btn = "My Validations" in combined or "Past Jobs" in combined
print(f"  Buttons: Upload={has_upload_btn}, Paste={has_paste_btn}, History={has_history_btn}")
test("1. Email Validation menu opens with buttons", passed and has_paste_btn)

# ── Test 2: Paste Emails flow ──
print("\n── Test 2: Click 'Paste Emails' button ──")
send_message("📋 Paste Emails", 2)
passed = assert_reply_contains(["paste", "email", "per line", "comma"], "Paste prompt")
test("2. Paste Emails prompt appears", passed)

# ── Test 3: Submit valid email list (10+ emails) ──
print("\n── Test 3: Paste 15 valid emails ──")
email_list = "\n".join([
    "test1@gmail.com", "user2@yahoo.com", "admin@company.org",
    "sales@business.net", "info@startup.io", "hello@world.com",
    "john@example.com", "jane@test.org", "support@service.co",
    "manager@corp.biz", "dev@tech.dev", "ops@cloud.io",
    "hr@firm.com", "ceo@startup.com", "cto@engineering.org"
])
send_message(email_list, 3)
passed = assert_reply_contains(["validation summary", "summary", "emails", "rate", "total", "payment"], "Pricing summary")
# Check payment buttons
replies = get_last_replies(5)
combined = ' '.join(replies)
has_pay_usd = "Pay USD" in combined
has_pay_ngn = "Pay NGN" in combined
has_cancel = "Cancel" in combined
print(f"  Payment buttons: USD={has_pay_usd}, NGN={has_pay_ngn}, Cancel={has_cancel}")
test("3. Validation summary with pricing + payment buttons", passed and has_pay_usd)

# ── Test 4: Try Pay USD (may fail due to low balance — that's ok) ──
print("\n── Test 4: Click 'Pay USD' button ──")
send_message("💵 Pay USD", 3)
replies = get_last_replies(5)
combined = ' '.join(replies).lower()
payment_success = "payment successful" in combined
insufficient = "insufficient" in combined
processing = "processing" in combined or "validating" in combined
if payment_success:
    print(f"  ✅ Payment succeeded — charged and processing started")
elif insufficient:
    print(f"  ✅ Insufficient balance (expected for test account)")
else:
    print(f"  ⚠️ Unexpected response")
    for r in replies[-3:]:
        print(f"     {r[:200]}")
test("4. Pay USD responds correctly (success or insufficient balance)", payment_success or insufficient)

# ── Test 5: Reset and test cancel flow ──
print("\n── Test 5: Cancel flow ──")
send_message("📧 Email Validation", 3)
send_message("📋 Paste Emails", 2)
send_message("❌ Cancel", 2)
passed = assert_reply_contains(["cancel", "cancelled"], "Cancel")
test("5. Cancel flow works", passed)

# ── Test 6: Test 'My Validations' / history ──
print("\n── Test 6: My Validations history ──")
send_message("📧 Email Validation", 3)
send_message("📜 My Validations", 3)
replies = get_last_replies(5)
combined = ' '.join(replies).lower()
has_history = "validation" in combined or "no validation" in combined or "job" in combined
print(f"  History response present: {has_history}")
test("6. My Validations shows history or empty message", has_history)

# ── Test 7: Upload list button ──
print("\n── Test 7: Upload List button ──")
send_message("📧 Email Validation", 3)
send_message("📤 Upload List (CSV/TXT)", 2)
passed = assert_reply_contains(["upload", "csv", "txt", "file"], "Upload prompt")
test("7. Upload List prompt appears", passed)

# ── Test 8: Back button from EV menu ──
print("\n── Test 8: Back button from EV menu ──")
send_message("🔙 Back", 2)
send_message("📧 Email Validation", 3)
send_message("🔙 Back", 2)
replies = get_last_replies(5)
combined = ' '.join(replies)
# Should be back at main menu (has main menu buttons)
back_to_main = any(kw in combined for kw in ["Bulletproof", "Cloud Phone", "Wallet", "Targeted Leads", "main menu"])
print(f"  Back to main menu: {back_to_main}")
test("8. Back button returns to main menu", back_to_main)

# ── Test 9: Too few emails error ──
print("\n── Test 9: Too few emails error ──")
send_message("📧 Email Validation", 3)
send_message("📋 Paste Emails", 2)
send_message("test@gmail.com\nuser@yahoo.com", 3)  # Only 2 emails, min is 10
passed = assert_reply_contains(["minimum", "required", "found only"], "Min email error")
test("9. Too few emails shows error", passed)

# ── Test 10: Pay NGN flow ──
print("\n── Test 10: NGN payment flow ──")
send_message("❌ Cancel", 2)
send_message("📧 Email Validation", 3)
send_message("📋 Paste Emails", 2)
email_list2 = "\n".join([f"test{i}@example.com" for i in range(1, 16)])
send_message(email_list2, 3)
send_message("💵 Pay NGN", 3)
replies = get_last_replies(5)
combined = ' '.join(replies).lower()
ngn_success = "payment successful" in combined and "₦" in ' '.join(replies)
ngn_insufficient = "insufficient" in combined and "ngn" in combined
test("10. Pay NGN responds correctly (success or insufficient)", ngn_success or ngn_insufficient)

# ── Check for errors ──
errors = check_errors()
if errors:
    print(f"\n⚠️ ERRORS in nodejs.err.log:\n{errors[:500]}")
else:
    print(f"\n✅ No errors in nodejs.err.log")

# Reset to main menu
send_message("/start", 2)

# ── Summary ──
print("\n" + "="*60)
print("📊 EMAIL VALIDATION FLOW — TEST RESULTS")
print("="*60)
passed_count = sum(1 for _, p in results if p)
total = len(results)
for name, p in results:
    print(f"  {'✅' if p else '❌'} {name}")
print(f"\n  Result: {passed_count}/{total} tests passed")
print("="*60)
