#!/usr/bin/env python3
"""
BulkSMS Flow — Webhook Simulator Test
Tests the entire BulkSMS sub-menu, campaign creation, scheduling, back buttons.
"""

import requests
import time
import json
import subprocess
import sys
import re

WEBHOOK_URL = "http://localhost:5000/telegram/webhook"
CHAT_ID = 5168006768
USERNAME = "hostbay_support"
FIRST_NAME = "Hostbay"

update_counter = 950000
results = []
errors_found = []

def send_message(text, sleep_time=2):
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

def check_errors():
    result = subprocess.run(["cat", "/var/log/supervisor/nodejs.err.log"], capture_output=True, text=True)
    return result.stdout.strip()

def get_last_log(n=30):
    result = subprocess.run(["tail", f"-n", str(n), "/var/log/supervisor/nodejs.out.log"], capture_output=True, text=True)
    return result.stdout.strip()

def clear_error_log():
    subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.err.log"])

def find_reply_content(log_text, chat_id):
    """Extract reply text from log lines like 'reply: <chatId> ...' """
    lines = log_text.split('\n')
    reply_lines = []
    for line in lines:
        if f'reply:' in line and str(chat_id) in line:
            reply_lines.append(line)
        if f'to: {chat_id}' in line:
            reply_lines.append(line)
    return reply_lines

def test_step(step_name, message_text, expect_in_reply=None, expect_no_error=True, sleep_time=2):
    """Send a message and check the reply"""
    clear_error_log()
    status = send_message(message_text, sleep_time=sleep_time)
    
    errors = check_errors()
    log = get_last_log(40)
    replies = find_reply_content(log, CHAT_ID)
    
    has_error = bool(errors.strip())
    has_reply = len(replies) > 0
    reply_text = '\n'.join(replies[-5:]) if replies else ''
    
    # Check expected content in reply
    content_match = True
    if expect_in_reply:
        for expected in expect_in_reply:
            if expected.lower() not in reply_text.lower() and expected.lower() not in log.lower():
                content_match = False
                break
    
    passed = True
    status_icon = "✅"
    notes = ""
    
    if has_error and expect_no_error:
        passed = False
        status_icon = "❌"
        notes = f"ERROR: {errors[:200]}"
        errors_found.append({'step': step_name, 'error': errors[:500]})
    elif not has_reply:
        # Give extra time
        time.sleep(2)
        log2 = get_last_log(40)
        replies2 = find_reply_content(log2, CHAT_ID)
        if not replies2:
            passed = False
            status_icon = "⚠️"
            notes = "NO REPLY"
        else:
            reply_text = '\n'.join(replies2[-5:])
    
    if expect_in_reply and not content_match and passed:
        # Recheck with full log
        full_log = get_last_log(60)
        all_match = all(e.lower() in full_log.lower() for e in expect_in_reply)
        if not all_match:
            status_icon = "⚠️"
            notes = f"Expected content not found: {expect_in_reply}"
            passed = False
    
    result = {
        'step': step_name,
        'sent': message_text[:60],
        'status': status_icon,
        'passed': passed,
        'notes': notes,
        'reply_snippet': reply_text[:200] if reply_text else ''
    }
    results.append(result)
    print(f"  {status_icon} {step_name}: sent='{message_text[:50]}' {notes}")
    return passed, reply_text

def go_home():
    send_message('Cancel', sleep_time=1)
    send_message('/start', sleep_time=2)

# ============================================================
# TEST EXECUTION
# ============================================================

if __name__ == '__main__':
    print("=" * 70)
    print("BULKSMS FLOW — WEBHOOK SIMULATION TEST")
    print("=" * 70)
    
    clear_error_log()
    
    # Reset to home
    print("\n[INIT] Resetting to home screen...")
    go_home()
    
    # ── TEST 1: Click BulkSMS button on main menu ──
    print("\n--- TEST 1: BulkSMS Main Menu Button ---")
    # The button is dynamic, but it starts with 📧 and contains BulkSMS
    # For this test user (expired, no trial), it should be "📧 BulkSMS"
    test_step("1a. Click BulkSMS (static label)", "📧 BulkSMS",
              expect_in_reply=["BulkSMS", "Create Campaign"])
    
    # ── TEST 2: BulkSMS Sub-Menu Buttons ──
    print("\n--- TEST 2: BulkSMS Sub-Menu Navigation ---")
    
    # Test My Campaigns
    test_step("2a. My Campaigns", "📋 My Campaigns",
              expect_in_reply=["Campaign"])
    
    # Go back to BulkSMS menu
    test_step("2b. Back from My Campaigns", "⬅️ Back",
              expect_in_reply=[])
    
    # Click BulkSMS again to get back to sub-menu
    send_message("📧 BulkSMS", sleep_time=2)
    
    # Test Download App
    test_step("2c. Download App", "📲 Download App",
              expect_in_reply=["Download", "app"])
    
    # Go back
    go_home()
    send_message("📧 BulkSMS", sleep_time=2)
    
    # Test Reset Login
    test_step("2d. Reset Login", "🔓 Reset Login",
              expect_in_reply=["login", "device"])
    
    # Go back to main
    go_home()
    
    # ── TEST 3: Full Create Campaign Flow ──
    print("\n--- TEST 3: Full Create Campaign Flow ---")
    
    # Enter BulkSMS sub-menu
    send_message("📧 BulkSMS", sleep_time=2)
    
    # Click Create Campaign
    test_step("3a. Create Campaign", "📱 Create Campaign",
              expect_in_reply=["campaign"])
    
    # Check if subscription is required (this user is expired)
    log = get_last_log(30)
    if "Subscription Required" in log:
        print("  ℹ️  User needs subscription — testing subscription gate flow")
        test_step("3a-sub. Subscription gate shown", "📱 Create Campaign",
                  expect_in_reply=["Subscription", "Upgrade Plan"], sleep_time=1)
        
        # Test Back from subscription gate
        test_step("3a-back. Back from sub gate", "⬅️ Back",
                  expect_in_reply=[])
        go_home()
        
        print("\n  ℹ️  Skipping campaign creation steps (user has no subscription)")
        print("  ℹ️  Will test flow with /smscampaign command for coverage...")
    else:
        # User can create campaigns — test full flow
        # Step 1: Enter campaign name
        test_step("3b. Enter campaign name", "Test Campaign Bot",
                  expect_in_reply=["Content", "message"])
        
        # Step 2: Enter campaign content
        test_step("3c. Enter campaign content", "Hi [name], this is a test message from the bot!",
                  expect_in_reply=["contact", "Upload"])
        
        # Step 3: Enter contacts
        test_step("3d. Enter contacts", "+18189279992, John\n+14155551234, Jane",
                  expect_in_reply=["contact", "loaded", "Schedule"])
        
        # Step 4a: Test Schedule for Later
        test_step("3e. Schedule for Later", "⏰ Schedule for Later",
                  expect_in_reply=["date", "YYYY"])
        
        # Enter a schedule time
        test_step("3f. Enter schedule time", "2025-08-15 09:30",
                  expect_in_reply=["Campaign", "Scheduled"])
        
        go_home()
        
        # Now test Send Now flow
        print("\n--- TEST 4: Create Campaign — Send Now ---")
        send_message("📧 BulkSMS", sleep_time=2)
        send_message("📱 Create Campaign", sleep_time=2)
        
        test_step("4a. Campaign name", "Immediate Campaign",
                  expect_in_reply=["Content"])
        
        test_step("4b. Campaign content", "Hello [name], special offer!",
                  expect_in_reply=["contact"])
        
        test_step("4c. Contacts", "+18189279992, Alice",
                  expect_in_reply=["loaded", "Schedule"])
        
        test_step("4d. Send Now", "▶️ Send Now",
                  expect_in_reply=["Campaign Created"])
        
        go_home()
    
    # ── TEST 5: Back Button Tests ──
    print("\n--- TEST 5: Back Buttons in Campaign Flow ---")
    
    # Enter BulkSMS sub-menu
    send_message("📧 BulkSMS", sleep_time=2)
    
    # Start campaign creation
    send_message("📱 Create Campaign", sleep_time=2)
    
    log = get_last_log(20)
    if "Subscription Required" not in log:
        # Test back from campaign name step
        test_step("5a. Back from name step", "⬅️ Back",
                  expect_in_reply=[])
        
        # Verify we're back (try starting flow again)
        send_message("📧 BulkSMS", sleep_time=2)
        send_message("📱 Create Campaign", sleep_time=2)
        
        # Enter name, then back from content step
        send_message("BackTest Campaign", sleep_time=2)
        test_step("5b. Back from content step", "⬅️ Back",
                  expect_in_reply=[])
        
        # Enter through to contacts, then back
        send_message("📧 BulkSMS", sleep_time=2)
        send_message("📱 Create Campaign", sleep_time=2)
        send_message("BackTest2", sleep_time=2)
        send_message("Test message", sleep_time=2)
        test_step("5c. Back from contacts step", "⬅️ Back",
                  expect_in_reply=[])
        
        # Enter through to schedule, then back
        send_message("📧 BulkSMS", sleep_time=2)
        send_message("📱 Create Campaign", sleep_time=2)
        send_message("BackTest3", sleep_time=2)
        send_message("Test msg", sleep_time=2)
        send_message("+18189279992, Test", sleep_time=2)
        test_step("5d. Back from schedule step", "⬅️ Back",
                  expect_in_reply=[])
    else:
        test_step("5a. Back from subscription gate", "⬅️ Back",
                  expect_in_reply=[])
    
    go_home()
    
    # ── TEST 6: Try old button text (backward compat) ──
    print("\n--- TEST 6: Backward Compatibility ---")
    test_step("6a. Old trial button text", "📧🆓 BulkSMS -Trial",
              expect_in_reply=["BulkSMS"])
    go_home()
    
    # ── TEST 7: /smscampaign command ──
    print("\n--- TEST 7: /smscampaign Command ---")
    test_step("7a. /smscampaign command", "/smscampaign",
              expect_in_reply=["campaign"])
    go_home()
    
    # ── TEST 8: Dynamic label matching ──
    print("\n--- TEST 8: Dynamic Label Variants ---")
    test_step("8a. BulkSMS with trial label", "📧🆓 BulkSMS — 50 Free SMS",
              expect_in_reply=["BulkSMS"])
    go_home()
    
    test_step("8b. BulkSMS with active label", "📧 BulkSMS ✅",
              expect_in_reply=["BulkSMS"])
    go_home()
    
    # ============================================================
    # RESULTS SUMMARY
    # ============================================================
    
    print("\n" + "=" * 70)
    print("BULKSMS FLOW TEST RESULTS")
    print("=" * 70)
    
    passed = sum(1 for r in results if r['passed'])
    failed = sum(1 for r in results if not r['passed'])
    total = len(results)
    
    print(f"\nTotal: {total} | ✅ Passed: {passed} | ❌ Failed: {failed}")
    
    if failed > 0:
        print(f"\n{'─'*70}")
        print("FAILED TESTS:")
        print(f"{'─'*70}")
        for r in results:
            if not r['passed']:
                print(f"\n  {r['status']} {r['step']}")
                print(f"    Sent: {r['sent']}")
                print(f"    Notes: {r['notes']}")
                if r['reply_snippet']:
                    print(f"    Reply: {r['reply_snippet'][:150]}")
    
    if errors_found:
        print(f"\n{'─'*70}")
        print("ERRORS:")
        print(f"{'─'*70}")
        for e in errors_found:
            print(f"\n  Step: {e['step']}")
            print(f"  Error: {e['error'][:300]}")
    
    # All results
    print(f"\n{'─'*70}")
    print("ALL RESULTS:")
    print(f"{'─'*70}")
    for r in results:
        print(f"  {r['status']} {r['step']}")
    
    # Save results
    with open('/app/bulksms_test_results.json', 'w') as f:
        json.dump({'results': results, 'errors': errors_found, 'summary': {'total': total, 'passed': passed, 'failed': failed}}, f, indent=2, ensure_ascii=False)
    
    print(f"\nResults saved to /app/bulksms_test_results.json")
    sys.exit(0 if failed == 0 else 1)
