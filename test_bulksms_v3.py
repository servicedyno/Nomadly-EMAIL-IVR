#!/usr/bin/env python3
"""BulkSMS Flow v3 — Device check, Device selection, Back buttons, Edge cases"""

import requests, time, json, subprocess, sys

WEBHOOK_URL = "http://localhost:5000/telegram/webhook"
CHAT_ID = 5168006768
c = 980000
results = []

def send(txt, sleep_time=2):
    global c; c += 1
    payload = {
        "update_id": c,
        "message": {
            "message_id": c,
            "from": {"id": CHAT_ID, "is_bot": False, "first_name": "Test", "username": "test_user"},
            "chat": {"id": CHAT_ID, "first_name": "Test", "username": "test_user", "type": "private"},
            "date": int(time.time()),
            "text": txt
        }
    }
    try:
        requests.post(WEBHOOK_URL, json=payload, timeout=15)
    except: pass
    time.sleep(sleep_time)

def reply():
    r = subprocess.run(["tail", "-n", "40", "/var/log/supervisor/nodejs.out.log"], capture_output=True, text=True)
    lines = r.stdout.strip().split('\n')
    # Find all reply lines for our CHAT_ID (combine consecutive non-message lines)
    reply_parts = []
    capture = False
    for line in lines:
        if f'to: {CHAT_ID}' in line:
            reply_parts.append(line)
            capture = False
        elif line.startswith('reply:') or (capture and not line.startswith('message:')):
            reply_parts.append(line)
            capture = True
        elif line.startswith('message:'):
            capture = False
    return '\n'.join(reply_parts[-10:]) if reply_parts else ''

def err():
    r = subprocess.run(["cat", "/var/log/supervisor/nodejs.err.log"], capture_output=True, text=True)
    return r.stdout.strip()

def clear():
    subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.err.log"])

def test(name, msg, expect, sleep_time=2):
    clear()
    send(msg, sleep_time)
    r = reply()
    e = err()
    
    ok = True
    notes = []
    if e:
        ok = False
        notes.append(f"ERR: {e[:100]}")
    for kw in expect:
        if kw.lower() not in r.lower():
            ok = False
            notes.append(f"Missing: '{kw}'")
    
    icon = "✅" if ok else "❌"
    n = f" | {'; '.join(notes)}" if notes else ""
    print(f"  {icon} {name}{n}")
    results.append({"name": name, "ok": ok, "notes": n, "reply": r[:250]})
    return ok, r

def home():
    send("Cancel", 1)
    send("/start", 2)

# =================================================
print("=" * 65)
print("BULKSMS v3 — DEVICE CHECK + BACK BUTTONS + EDGE CASES")
print("=" * 65)

# SETUP: Ensure clean state
home()

# ── A: DEVICE ACTIVATION CHECK ──
print("\n--- A: No-device gate on Create Campaign ---")
# First reset login to simulate no active devices
send("📧 BulkSMS", 2)
send("🔓 Reset Login", 2)
# Confirm reset
test("A0. Reset login confirm", "Yes", ["reset", "login"])
home()

send("📧 BulkSMS", 2)
test("A1. Create Campaign blocked (no device)", "📱 Create Campaign",
     ["No Active Device", "Download"])

test("A2. Back from no-device gate", "Back", ["BulkSMS", "Create Campaign"])

# ── B: SIMULATE DEVICE ACTIVATION ──
print("\n--- B: Activate device then create ---")
# Simulate device login via API
print("  [Activating device via API...]")
r = requests.get(f"http://localhost:5000/sms-app/auth/{CHAT_ID}?deviceId=phone1")
print(f"  Device auth: {r.status_code} {r.json().get('valid', False)}")

send("📧 BulkSMS", 2)
test("B1. Create Campaign allowed (1 device)", "📱 Create Campaign",
     ["Step 1", "campaign name"])

test("B2. Back from name", "Back", ["BulkSMS", "Create Campaign"])

# ── C: MULTI-DEVICE SELECTION ──
print("\n--- C: Multi-device selection ---")
# Add second device
print("  [Activating second device via API...]")
r = requests.get(f"http://localhost:5000/sms-app/auth/{CHAT_ID}?deviceId=tablet2")
print(f"  Device 2 auth: {r.status_code} {r.json().get('valid', False)}")

send("📧 BulkSMS", 2)
test("C1. Create Campaign shows device select", "📱 Create Campaign",
     ["Select Device"])

test("C2. Back from device select", "Back", ["BulkSMS", "Create Campaign"])

# Select a device
send("📱 Create Campaign", 2)
test("C3. Select device phone1", "📱 phone1", ["Step 1", "campaign name"])
test("C4. Back from name after device select", "Back", ["BulkSMS"])

# ── D: FULL CAMPAIGN WITH DEVICE ──
print("\n--- D: Full campaign flow (multi-device) ---")
send("📱 Create Campaign", 2)
send("📱 phone1", 2)  # select device
test("D1. Enter name", "Multi Device Camp", ["Content", "message"])
test("D2. Enter content", "Hello [name]!", ["contact", "Upload"])
test("D3. Enter contacts", "+18189279992, John\n+14155551234, Jane", ["loaded", "Schedule"])
test("D4. Send Now", "▶️ Send Now", ["Campaign Created"])

home()

# ── E: BACK BUTTONS (every step) ──
print("\n--- E: Back buttons at every step ---")
# Reset to single device for simplicity
requests.post(f"http://localhost:5000/sms-app/logout/{CHAT_ID}", json={"deviceId": "tablet2"})

send("📧 BulkSMS", 2)
send("📱 Create Campaign", 2)
test("E1. Name → Back → BulkSMS menu", "Back", ["BulkSMS", "Create Campaign"])

send("📱 Create Campaign", 2)
send("TestName", 2)
test("E2. Content → Back → Name step", "Back", ["campaign name"])
test("E3. Name (again) → Back → menu", "Back", ["BulkSMS"])

send("📱 Create Campaign", 2)
send("BackTest", 2)
send("Hello msg", 2)
test("E4. Contacts → Back → Content", "Back", ["Content", "message"])
test("E5. Content → Back → Name", "Back", ["campaign name"])
test("E6. Name → Back → menu", "Back", ["BulkSMS"])

send("📱 Create Campaign", 2)
send("BackTest2", 2)
send("Hi there", 2)
send("+18189279992, John", 2)
test("E7. Schedule → Back → Contacts", "Back", ["contact"])
test("E8. Contacts → Back → Content", "Back", ["Content"])
test("E9. Content → Back → Name", "Back", ["campaign name"])
test("E10. Name → Back → menu", "Back", ["BulkSMS"])

send("📱 Create Campaign", 2)
send("BackTest3", 2)
send("Hi", 2)
send("+18189279992, A", 2)
send("⏰ Schedule for Later", 2)
test("E11. SchedTime → Back → Schedule", "Back", ["Schedule", "Send Now"])
test("E12. Schedule → Back → Contacts", "Back", ["contact"])

home()

# ── F: EDGE CASES ──
print("\n--- F: Edge cases ---")
send("📧 BulkSMS", 2)
send("📱 Create Campaign", 2)

# Empty name
test("F1. Empty name rejected", "", ["empty", "name"])

# Valid name → empty content
send("ValidName", 2)
test("F2. Empty content rejected", "", ["empty", "content"])

# Valid content → invalid contacts
send("Hello!", 2)
test("F3. Invalid contacts (no digits)", "hello, world", ["No valid phone"])

# Valid contacts → unrecognized schedule input
send("+18189279992, John", 2)
test("F4. Unrecognized schedule input", "maybe later?", ["choose", "option"])

# Valid schedule
test("F5. Send Now works", "▶️ Send Now", ["Campaign Created"])

home()

# ── G: SCHEDULED FLOW ──
print("\n--- G: Schedule flow ---")
send("📧 BulkSMS", 2)
send("📱 Create Campaign", 2)
send("SchedCamp", 2)
send("Reminder!", 2)
send("+18189279992, Bob", 2)
send("⏰ Schedule for Later", 2)
test("G1. Past date rejected", "2020-01-01 10:00", ["Invalid", "past"])
test("G2. Bad date rejected", "not-a-date", ["Invalid"])
test("G3. Future date accepted", "2027-06-15 14:00", ["Campaign Scheduled", "2027"])

home()

# ── H: MY CAMPAIGNS ──
print("\n--- H: My Campaigns ---")
send("📧 BulkSMS", 2)
test("H1. My Campaigns shows list", "📋 My Campaigns", ["Campaign"])
test("H2. Back from campaigns", "Back", [])  # any response is fine

home()

# =================================================
print("\n" + "=" * 65)
print("RESULTS SUMMARY")
print("=" * 65)

passed = sum(1 for r in results if r['ok'])
failed = sum(1 for r in results if not r['ok'])

for r in results:
    icon = "✅" if r['ok'] else "❌"
    print(f"  {icon} {r['name']}{r['notes']}")

print(f"\nTotal: {len(results)} | ✅ Passed: {passed} | ❌ Failed: {failed}")

if failed > 0:
    print("\n--- FAILED DETAILS ---")
    for r in results:
        if not r['ok']:
            print(f"\n  ❌ {r['name']}")
            print(f"     Reply: {r['reply'][:200]}")

with open('/app/bulksms_test_v3.json', 'w') as f:
    json.dump({'results': results, 'passed': passed, 'failed': failed}, f, indent=2)

sys.exit(0 if failed == 0 else 1)
