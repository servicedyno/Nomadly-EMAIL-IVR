#!/usr/bin/env python3
"""
BulkSMS Flow — Focused Back Button + Campaign Flow Test
Sends webhooks and verifies correct behavior by checking log replies.
"""

import requests, time, json, subprocess, sys

WEBHOOK_URL = "http://localhost:5000/telegram/webhook"
CHAT_ID = 5168006768
USERNAME = "hostbay_support"
FIRST_NAME = "Hostbay"
update_counter = 960000

results = []

def send_msg(text, sleep_time=2):
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
        r = requests.post(WEBHOOK_URL, json=payload, timeout=15)
        time.sleep(sleep_time)
        return r.status_code
    except Exception as e:
        print(f"  [HTTP ERROR] {e}")
        return -1

def get_last_reply():
    """Get the most recent reply to our CHAT_ID"""
    result = subprocess.run(["tail", "-n", "30", "/var/log/supervisor/nodejs.out.log"], capture_output=True, text=True)
    lines = result.stdout.strip().split('\n')
    # Find last line containing 'to: CHAT_ID'
    reply_lines = []
    for line in lines:
        if f'to: {CHAT_ID}' in line:
            reply_lines.append(line)
    return reply_lines[-1] if reply_lines else ''

def clear_logs():
    subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.err.log"])

def check_errors():
    result = subprocess.run(["cat", "/var/log/supervisor/nodejs.err.log"], capture_output=True, text=True)
    return result.stdout.strip()

def test(name, msg, expect_keywords, sleep_time=2):
    """Send message, check reply contains expected keywords"""
    clear_logs()
    send_msg(msg, sleep_time=sleep_time)
    reply = get_last_reply()
    errors = check_errors()
    
    passed = True
    notes = []
    
    if errors:
        passed = False
        notes.append(f"NODE ERROR: {errors[:150]}")
    
    for kw in expect_keywords:
        if kw.lower() not in reply.lower():
            passed = False
            notes.append(f"Missing '{kw}'")
    
    icon = "✅" if passed else "❌"
    note_str = " | ".join(notes) if notes else ""
    print(f"  {icon} {name}: {note_str}" if note_str else f"  {icon} {name}")
    results.append({"name": name, "passed": passed, "notes": note_str, "reply": reply[:200]})
    return passed

def go_home():
    send_msg("Cancel", sleep_time=1)
    send_msg("/start", sleep_time=2)

# ============================================================

if __name__ == '__main__':
    print("=" * 70)
    print("BULKSMS FLOW + BACK BUTTON TEST")
    print("=" * 70)
    
    go_home()
    
    # ── TEST A: BulkSMS Sub-Menu ──
    print("\n--- A: BulkSMS Sub-Menu Opens ---")
    test("A1. Click BulkSMS", "📧 BulkSMS", ["Create Campaign", "My Campaigns"])
    test("A2. My Campaigns", "📋 My Campaigns", ["Campaign"])
    
    # Back from My Campaigns should go to main menu (since it's not in the campaign flow)
    send_msg("📧 BulkSMS", sleep_time=2)
    test("A3. Download App", "📲 Download App", ["app", "code"])
    go_home()
    send_msg("📧 BulkSMS", sleep_time=2)
    test("A4. Reset Login", "🔓 Reset Login", ["login", "device"])
    go_home()
    
    # ── TEST B: Full Campaign Creation (Send Now) ──
    print("\n--- B: Full Campaign — Send Now ---")
    send_msg("📧 BulkSMS", sleep_time=2)
    test("B1. Create Campaign shows intro", "📱 Create Campaign", ["Step 1", "Step 2", "campaign name"])
    test("B2. Enter name → asks content", "My Test Campaign", ["Content", "message"])
    test("B3. Enter content → asks contacts", "Hello [name], offer for you!", ["contact", "Upload"])
    test("B4. Enter contacts → asks schedule", "+18189279992, John\n+14155551234, Jane", ["loaded", "Schedule", "Send Now"])
    test("B5. Send Now → campaign created", "▶️ Send Now", ["Campaign Created", "My Test Campaign"])
    go_home()
    
    # ── TEST C: Full Campaign Creation (Scheduled) ──
    print("\n--- C: Full Campaign — Scheduled ---")
    send_msg("📧 BulkSMS", sleep_time=2)
    send_msg("📱 Create Campaign", sleep_time=2)
    send_msg("Scheduled Campaign", sleep_time=2)
    send_msg("Reminder: your appointment is tomorrow!", sleep_time=2)
    send_msg("+18189279992, Bob", sleep_time=2)
    test("C1. Schedule Later → asks time", "⏰ Schedule for Later", ["date", "YYYY"])
    test("C2. Future date → scheduled", "2027-01-15 10:00", ["Campaign Scheduled", "2027"])
    go_home()
    
    # ── TEST D: Back Buttons ──
    print("\n--- D: Back from Campaign Name → BulkSMS menu ---")
    send_msg("📧 BulkSMS", sleep_time=2)
    send_msg("📱 Create Campaign", sleep_time=2)
    test("D1. Back from name step", "⬅️ Back", ["BulkSMS", "Create Campaign"])
    
    print("\n--- D: Back from Content → Name step ---")
    send_msg("📱 Create Campaign", sleep_time=2)
    send_msg("BackTest Name", sleep_time=2)
    test("D2. Back from content step", "⬅️ Back", ["campaign name"])
    
    # Clean up and go back to sub-menu
    send_msg("⬅️ Back", sleep_time=1)
    
    print("\n--- D: Back from Contacts → Content step ---")
    send_msg("📱 Create Campaign", sleep_time=2)
    send_msg("BackTest2", sleep_time=2)
    send_msg("Test msg content", sleep_time=2)
    test("D3. Back from contacts step", "⬅️ Back", ["Content", "message"])
    
    send_msg("⬅️ Back", sleep_time=1)
    send_msg("⬅️ Back", sleep_time=1)
    
    print("\n--- D: Back from Schedule → Contacts step ---")
    send_msg("📱 Create Campaign", sleep_time=2)
    send_msg("BackTest3", sleep_time=2)
    send_msg("Test msg", sleep_time=2)
    send_msg("+18189279992, Test", sleep_time=2)
    test("D4. Back from schedule step", "⬅️ Back", ["contact"])
    
    send_msg("⬅️ Back", sleep_time=1)
    send_msg("⬅️ Back", sleep_time=1)
    send_msg("⬅️ Back", sleep_time=1)
    
    print("\n--- D: Back from Schedule Time → Schedule step ---")
    send_msg("📱 Create Campaign", sleep_time=2)
    send_msg("BackTest4", sleep_time=2)
    send_msg("Test msg", sleep_time=2)
    send_msg("+18189279992, Test", sleep_time=2)
    send_msg("⏰ Schedule for Later", sleep_time=2)
    test("D5. Back from schedule time", "⬅️ Back", ["Schedule", "Send Now"])
    
    go_home()
    
    # ── TEST E: Invalid Schedule Date ──
    print("\n--- E: Invalid Schedule Date ---")
    send_msg("📧 BulkSMS", sleep_time=2)
    send_msg("📱 Create Campaign", sleep_time=2)
    send_msg("DateTest", sleep_time=2)
    send_msg("Hi there", sleep_time=2)
    send_msg("+18189279992, Test", sleep_time=2)
    send_msg("⏰ Schedule for Later", sleep_time=2)
    test("E1. Past date rejected", "2020-01-01 10:00", ["Invalid", "past"])
    test("E2. Garbage date rejected", "not-a-date", ["Invalid"])
    test("E3. Valid future date accepted", "2027-06-01 14:00", ["Campaign Scheduled"])
    go_home()
    
    # ── TEST F: Backward Compatibility ──
    print("\n--- F: Backward Compatibility ---")
    test("F1. Old trial label", "📧🆓 BulkSMS -Trial", ["BulkSMS", "Create Campaign"])
    go_home()
    test("F2. Dynamic trial label", "📧🆓 BulkSMS — 99 Free SMS", ["BulkSMS", "Create Campaign"])
    go_home()
    test("F3. /smscampaign command", "/smscampaign", ["campaign"])
    go_home()
    
    # ============================================================
    # RESULTS
    # ============================================================
    
    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)
    
    passed = sum(1 for r in results if r['passed'])
    failed = sum(1 for r in results if not r['passed'])
    
    for r in results:
        icon = "✅" if r['passed'] else "❌"
        print(f"  {icon} {r['name']}" + (f" — {r['notes']}" if r['notes'] else ""))
    
    print(f"\nTotal: {len(results)} | ✅ Passed: {passed} | ❌ Failed: {failed}")
    
    if failed:
        print("\n⚠️ FAILED TESTS:")
        for r in results:
            if not r['passed']:
                print(f"  ❌ {r['name']}: {r['notes']}")
                print(f"     Reply: {r['reply'][:150]}")
    
    with open('/app/bulksms_test_v2.json', 'w') as f:
        json.dump({'results': results, 'passed': passed, 'failed': failed}, f, indent=2, ensure_ascii=False)
    
    sys.exit(0 if failed == 0 else 1)
