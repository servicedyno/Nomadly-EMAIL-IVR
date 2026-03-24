#!/usr/bin/env python3
"""Email Validation Free Trial Flow — Clean Sequential Test"""
import requests, time, subprocess

URL = "http://localhost:5000/telegram/webhook"
CID = 5168006768
CTR = 970000

def send(text, wait=3):
    global CTR; CTR += 1
    requests.post(URL, json={
        "update_id": CTR, "message": {
            "message_id": CTR,
            "from": {"id": CID, "is_bot": False, "first_name": "Hostbay", "username": "hostbay_support"},
            "chat": {"id": CID, "first_name": "Hostbay", "username": "hostbay_support", "type": "private"},
            "date": int(time.time()), "text": text
        }
    }, timeout=10)
    time.sleep(wait)

def last_reply():
    """Get the very last reply to our chatId"""
    out = subprocess.run(["tail", "-n", "40", "/var/log/supervisor/nodejs.out.log"], capture_output=True, text=True).stdout
    lines = out.strip().split('\n')
    # Find last line that contains reply to our chatId
    replies = [l for l in lines if f'to: {CID}' in l or (l.startswith('reply:') and str(CID) not in l)]
    return replies[-1] if replies else ""

def last_n_replies(n=3):
    out = subprocess.run(["tail", "-n", "60", "/var/log/supervisor/nodejs.out.log"], capture_output=True, text=True).stdout
    lines = out.strip().split('\n')
    replies = [l for l in lines if f'to: {CID}' in l]
    return ' '.join(replies[-n:])

subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.err.log"])
results = []

def test(name, condition):
    results.append((name, condition))
    print(f"  {'✅' if condition else '❌'} {name}")

print("\n📧 EMAIL VALIDATION — FREE TRIAL FLOW TEST")
print("=" * 55)

# Reset
send("/start", 3)

# ── 1. EV Menu shows free trial ──
print("\n── Menu ──")
send("📧 Email Validation")
r = last_n_replies(3)
test("Menu opens", "Email Validation" in r)
test("Free trial mentioned", "Free trial" in r or "free trial" in r.lower() or "🎁" in r)

# ── 2. Paste flow → Free trial offer ──
print("\n── Paste → Free Trial Offer ──")
send("📋 Paste Emails")
test("Paste prompt", "paste" in last_reply().lower() or "email" in last_reply().lower())

emails = "\n".join([f"user{i}@example.com" for i in range(1, 16)])
send(emails)
r = last_n_replies(3)
test("Free trial offer (15 emails)", "Free Trial" in r or "FREE" in r)
test("Start Free Trial button", "Start Free Trial" in r)
test("No payment buttons (trial eligible)", "Pay USD" not in r)

# ── 3. Start Free Trial ──
print("\n── Start Free Trial ──")
send("🎁 Start Free Trial")
r = last_n_replies(3)
test("Trial started", "trial started" in r.lower() or "free" in r.lower() and "validating" in r.lower())
test("$0.00 charged", "$0.00" in r or "FREE" in r)

# ── 4. Verify trial is used — no more free trial ──
print("\n── After Trial Used ──")
send("📧 Email Validation")
r = last_n_replies(3)
test("Menu still works", "Email Validation" in r)
test("Free trial NOT shown anymore", "🎁" not in r.split("Email Validation")[-1] if "Email Validation" in r else False)

# ── 5. Paste same emails → should get PAID pricing ──
print("\n── Paste → Paid Pricing (trial used) ──")
send("📋 Paste Emails")
send(emails)
r = last_n_replies(3)
test("Shows paid pricing", "Pay USD" in r or "Pay NGN" in r or "payment" in r.lower())
test("No free trial button", "Start Free Trial" not in r)

# ── 6. Cancel ──
print("\n── Cancel ──")
send("❌ Cancel")
test("Cancel works", "cancel" in last_reply().lower())

# ── Errors ──
errs = subprocess.run(["cat", "/var/log/supervisor/nodejs.err.log"], capture_output=True, text=True).stdout.strip()
print(f"\n{'⚠️ ERRORS: ' + errs[:200] if errs else '✅ No errors in nodejs.err.log'}")

# Reset
send("/start", 2)

# ── Summary ──
p = sum(1 for _, ok in results if ok)
print(f"\n{'=' * 55}")
print(f"📊 Result: {p}/{len(results)} passed")
for name, ok in results:
    print(f"  {'✅' if ok else '❌'} {name}")
print("=" * 55)
