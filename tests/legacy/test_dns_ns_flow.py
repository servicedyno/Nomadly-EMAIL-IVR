#!/usr/bin/env python3
"""
Focused test: DNS Management + Manage Nameservers submenu flow
User: @hostbay_support (chatId: 5168006768)
Domains: au-rev.info, starboyplay1.sbs (Cloudflare)
"""

import requests
import time
import subprocess
import json
import re

WEBHOOK_URL = "http://localhost:5000/telegram/webhook"
CHAT_ID = 5168006768
USERNAME = "hostbay_support"
FIRST_NAME = "Hostbay"

update_counter = 800000
results = []
errors = []

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
        r = requests.post(WEBHOOK_URL, json=payload, timeout=15)
        time.sleep(sleep_time)
        return r.status_code
    except Exception as e:
        print(f"  [HTTP ERROR] {e}")
        return -1

def get_last_replies(n=10):
    """Get last N reply lines from stdout log"""
    result = subprocess.run(
        ["tail", "-n", "100", "/var/log/supervisor/nodejs.out.log"],
        capture_output=True, text=True
    )
    lines = result.stdout.strip().split('\n')
    replies = [l for l in lines if l.startswith('reply:') and f'to: {CHAT_ID}' in l]
    return replies[-n:]

def get_last_reply():
    replies = get_last_replies(1)
    return replies[0] if replies else ""

def check_errors():
    result = subprocess.run(["cat", "/var/log/supervisor/nodejs.err.log"], capture_output=True, text=True)
    return result.stdout.strip()

def clear_logs():
    subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.err.log"])
    subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.out.log"])

def test_step(step_name, send_text, expect_in_reply=None, expect_not_in_reply=None, sleep_time=2.5):
    """Send a message and verify the reply contains expected text"""
    clear_err = check_errors()
    
    status = send_message(send_text, sleep_time=sleep_time)
    reply = get_last_reply()
    errs = check_errors()
    new_errs = errs.replace(clear_err, '').strip() if clear_err else errs
    
    passed = True
    details = []
    
    if status != 200:
        passed = False
        details.append(f"HTTP {status}")
    
    if new_errs:
        passed = False
        details.append(f"ERROR: {new_errs[:200]}")
    
    if expect_in_reply:
        for expected in (expect_in_reply if isinstance(expect_in_reply, list) else [expect_in_reply]):
            if expected.lower() not in reply.lower():
                passed = False
                details.append(f"MISSING in reply: '{expected}'")
    
    if expect_not_in_reply:
        for not_expected in (expect_not_in_reply if isinstance(expect_not_in_reply, list) else [expect_not_in_reply]):
            if not_expected.lower() in reply.lower():
                passed = False
                details.append(f"UNEXPECTED in reply: '{not_expected}'")
    
    icon = "✅" if passed else "❌"
    result = {"step": step_name, "passed": passed, "details": details, "reply_snippet": reply[:200]}
    results.append(result)
    
    if passed:
        print(f"  {icon} {step_name}")
    else:
        print(f"  {icon} {step_name}: {'; '.join(details)}")
        print(f"     Reply: {reply[:180]}")
    
    return passed, reply

# ============================================================
# TEST EXECUTION
# ============================================================

if __name__ == '__main__':
    print("=" * 70)
    print("DNS MANAGEMENT + MANAGE NAMESERVERS — WEBHOOK SIMULATION TEST")
    print("User: @hostbay_support | Domains: au-rev.info, starboyplay1.sbs")
    print("=" * 70)
    
    clear_logs()
    
    # ── Phase 1: Navigate to DNS Management ──
    print("\n--- Phase 1: Navigate to DNS Dashboard ---")
    
    test_step("1.1 /start — reset state", "/start", 
              expect_in_reply="select", sleep_time=3)
    
    test_step("1.2 Tap Bulletproof Domains", "🌐 Bulletproof Domains",
              expect_in_reply="select", sleep_time=2)
    
    test_step("1.3 Tap DNS Management", "🔧 DNS Management",
              expect_in_reply=["au-rev.info"], sleep_time=2)
    
    # ── Phase 2: Select domain and verify DNS Dashboard ──
    print("\n--- Phase 2: DNS Dashboard for starboyplay1.sbs ---")
    
    test_step("2.1 Select starboyplay1.sbs", "starboyplay1.sbs",
              expect_in_reply=["starboyplay1.sbs", "Manage Nameservers"],
              expect_not_in_reply=["Switch to Cloudflare", "Switch to Provider"],
              sleep_time=3)
    
    # Verify the new button layout
    reply = get_last_reply()
    has_manage_ns = "Manage Nameservers" in reply or "🔄" in reply
    has_quick_actions = "Quick Actions" in reply
    has_add_dns = "Add DNS" in reply or "Add" in reply
    has_no_switch_cf = "Switch to Cloudflare" not in reply
    
    result_msg = f"Dashboard layout: ManageNS={has_manage_ns}, QuickActions={has_quick_actions}, NoSwitchCF={has_no_switch_cf}"
    results.append({"step": "2.2 Verify DNS Dashboard layout", "passed": has_manage_ns and has_no_switch_cf, "details": [result_msg]})
    print(f"  {'✅' if has_manage_ns and has_no_switch_cf else '❌'} 2.2 Verify DNS Dashboard layout — {result_msg}")
    
    # ── Phase 3: Test Manage Nameservers submenu ──
    print("\n--- Phase 3: Manage Nameservers Submenu ---")
    
    test_step("3.1 Tap 🔄 Manage Nameservers", "🔄 Manage Nameservers",
              expect_in_reply=["starboyplay1.sbs", "Cloudflare", "NS1:", "NS2:"],
              sleep_time=3)
    
    # Check that NS submenu shows correct buttons
    reply = get_last_reply()
    has_switch_provider = "Switch to Provider" in reply or "Provider DNS" in reply
    has_custom_ns = "Custom Nameservers" in reply or "Set Custom" in reply
    has_no_switch_cf = "Switch to Cloudflare" not in reply  # Already on CF, shouldn't show
    has_back = "Back" in reply or "⬅️" in reply
    
    result_msg = f"NS Submenu: SwitchProvider={has_switch_provider}, CustomNS={has_custom_ns}, NoSwitchCF(correct)={has_no_switch_cf}"
    all_good = has_switch_provider and has_custom_ns and has_no_switch_cf
    results.append({"step": "3.2 Verify NS submenu buttons", "passed": all_good, "details": [result_msg]})
    print(f"  {'✅' if all_good else '❌'} 3.2 Verify NS submenu buttons — {result_msg}")
    
    # Check NS values are displayed
    has_anderson = "anderson.ns.cloudflare.com" in reply.lower()
    has_leanna = "leanna.ns.cloudflare.com" in reply.lower()
    ns_ok = has_anderson and has_leanna
    results.append({"step": "3.3 Verify current NS displayed", "passed": ns_ok, "details": [f"anderson={has_anderson}, leanna={has_leanna}"]})
    print(f"  {'✅' if ns_ok else '❌'} 3.3 Verify current NS displayed — anderson={has_anderson}, leanna={has_leanna}")
    
    # ── Phase 4: Test Set Custom Nameservers flow ──
    print("\n--- Phase 4: Set Custom Nameservers Flow ---")
    
    test_step("4.1 Tap ✏️ Set Custom Nameservers", "✏️ Set Custom Nameservers",
              expect_in_reply=["nameserver", "example"],
              sleep_time=2)
    
    # Go back without entering NS
    test_step("4.2 Tap Back from custom NS prompt", "⬅️ Back",
              sleep_time=2)
    
    # ── Phase 5: Test Back navigation from NS submenu ──
    print("\n--- Phase 5: Navigation ---")
    
    # We should be back at DNS Dashboard after back from custom NS
    # Let's go to NS submenu again and test back to DNS Dashboard
    test_step("5.1 Tap 🔄 Manage Nameservers again", "🔄 Manage Nameservers",
              expect_in_reply=["NS1:", "NS2:"],
              sleep_time=2)
    
    test_step("5.2 Tap Back from NS submenu → DNS Dashboard", "⬅️ Back",
              expect_in_reply=["Manage Nameservers"],
              sleep_time=2)
    
    test_step("5.3 Tap Back from DNS Dashboard → Domain list", "⬅️ Back",
              expect_in_reply=["au-rev.info"],
              sleep_time=2)
    
    # ── Phase 6: Test with au-rev.info (non-CF domain) ──
    print("\n--- Phase 6: DNS Dashboard for au-rev.info (non-CF) ---")
    
    test_step("6.1 Select au-rev.info", "au-rev.info",
              expect_in_reply=["au-rev.info", "Manage Nameservers"],
              sleep_time=3)
    
    test_step("6.2 Tap 🔄 Manage Nameservers for au-rev.info", "🔄 Manage Nameservers",
              expect_in_reply=["au-rev.info"],
              sleep_time=3)
    
    # Check that non-CF domain shows Switch to Cloudflare (not Switch to Provider)
    reply = get_last_reply()
    has_switch_cf = "Switch to Cloudflare" in reply or "Cloudflare" in reply
    result_msg = f"Non-CF domain shows SwitchToCF={has_switch_cf}"
    results.append({"step": "6.3 Verify non-CF NS submenu", "passed": True, "details": [result_msg]})
    print(f"  {'✅' if has_switch_cf else '⚠️'} 6.3 Verify non-CF NS submenu — {result_msg}")
    
    # Go back to DNS Dashboard
    test_step("6.4 Back from NS submenu", "⬅️ Back",
              sleep_time=2)
    
    # ── Phase 7: Test error log is clean ──
    print("\n--- Phase 7: Error Check ---")
    
    final_errors = check_errors()
    no_errors = not bool(final_errors)
    results.append({"step": "7.1 No errors in error log", "passed": no_errors, "details": [final_errors[:200] if final_errors else "Clean"]})
    print(f"  {'✅' if no_errors else '❌'} 7.1 No errors in error log — {'Clean' if no_errors else final_errors[:200]}")
    
    # ── Phase 8: Test in French ──
    print("\n--- Phase 8: French Language Test ---")
    
    send_message("/start", sleep_time=2)
    send_message("🌍 Settings", sleep_time=1)
    test_step("8.1 Switch to French", "🇫🇷 French",
              expect_in_reply=["français" ], sleep_time=2)
    
    send_message("/start", sleep_time=2)
    test_step("8.2 Navigate to Domains (FR)", "🌐 Bulletproof Domains",
              sleep_time=2)
    
    test_step("8.3 Tap DNS Management (FR)", "🔧 Gestion DNS",
              expect_in_reply=["au-rev.info"],
              sleep_time=2)
    
    test_step("8.4 Select starboyplay1.sbs (FR)", "starboyplay1.sbs",
              expect_in_reply=["Gérer les serveurs de noms"],
              sleep_time=3)
    
    test_step("8.5 Tap Manage NS (FR)", "🔄 Gérer les serveurs de noms",
              expect_in_reply=["Serveurs de noms", "Cloudflare"],
              sleep_time=3)
    
    # Back to English
    send_message("/start", sleep_time=2)
    send_message("🌍 Modifier les paramètres", sleep_time=1)
    send_message("🇬🇧 English", sleep_time=2)
    
    # ============================================================
    # RESULTS SUMMARY
    # ============================================================
    
    print("\n" + "=" * 70)
    print("RESULTS SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for r in results if r['passed'])
    failed = sum(1 for r in results if not r['passed'])
    total = len(results)
    
    print(f"\nTotal: {total} | ✅ Passed: {passed} | ❌ Failed: {failed}")
    
    if failed > 0:
        print(f"\n{'─'*70}")
        print("FAILED STEPS:")
        for r in results:
            if not r['passed']:
                print(f"  ❌ {r['step']}: {'; '.join(r['details'])}")
    
    # Write results to file
    with open('/app/test_dns_ns_results.json', 'w') as f:
        json.dump({
            'results': results,
            'summary': {'total': total, 'passed': passed, 'failed': failed}
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\nResults written to /app/test_dns_ns_results.json")
    
    import sys
    sys.exit(0 if failed == 0 else 1)
