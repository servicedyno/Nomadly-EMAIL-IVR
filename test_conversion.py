#!/usr/bin/env python3
"""
Test New User Conversion Engine — 5 Features
Uses webhook simulator for @hostbay_support (chatId: 5168006768)
Resets user state to simulate a brand new user, then tests all features.
"""

import requests
import time
import json
import subprocess
import sys
from pymongo import MongoClient
import os

WEBHOOK_URL = "http://localhost:5000/telegram/webhook"
CHAT_ID = 5168006768
USERNAME = "hostbay_support"
FIRST_NAME = "Hostbay"
MONGO_URL = os.environ.get('MONGO_URL') or open('/app/backend/.env').read().split('MONGO_URL="')[1].split('"')[0]
DB_NAME = "test"

update_counter = 990000
results = []

def send_message(text, sleep_time=3):
    global update_counter
    update_counter += 1
    payload = {
        "update_id": update_counter,
        "message": {
            "message_id": update_counter,
            "from": {
                "id": CHAT_ID,
                "is_bot": False,
                "first_name": FIRST_NAME,
                "username": USERNAME
            },
            "chat": {
                "id": CHAT_ID,
                "first_name": FIRST_NAME,
                "username": USERNAME,
                "type": "private"
            },
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
    result = subprocess.run(
        ["tail", "-n", "80", "/var/log/supervisor/nodejs.out.log"],
        capture_output=True, text=True
    )
    lines = result.stdout.strip().split('\n')
    # Check both "reply:" lines and "to: CHATID" lines
    replies = [l for l in lines if 
        l.startswith('reply:') or 
        f'to: {CHAT_ID}' in l or
        '[Conversion]' in l or 
        '[CartRecovery]' in l or
        'Unhandled' in l or 'Error' in l]
    return replies[-n:]

def get_last_logs(n=20, pattern=None):
    result = subprocess.run(
        ["tail", "-n", "100", "/var/log/supervisor/nodejs.out.log"],
        capture_output=True, text=True
    )
    lines = result.stdout.strip().split('\n')
    if pattern:
        lines = [l for l in lines if pattern in l]
    return lines[-n:]

def check_errors():
    result = subprocess.run(
        ["cat", "/var/log/supervisor/nodejs.err.log"],
        capture_output=True, text=True
    )
    return result.stdout.strip()

def record(test_name, passed, detail=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append({"test": test_name, "passed": passed, "detail": detail})
    print(f"  {status}: {test_name}")
    if detail:
        print(f"        {detail}")

def reset_user():
    """Remove user from all collections to simulate a completely new user"""
    print("\n🔄 Resetting @hostbay_support (chatId: 5168006768) to new user state...")
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]

        # Remove from state collection
        r1 = db['state'].delete_one({'_id': CHAT_ID})
        r1b = db['state'].delete_one({'_id': float(CHAT_ID)})
        print(f"  state: deleted {r1.deleted_count + r1b.deleted_count}")

        # Remove from conversion tracking
        r2 = db['userConversion'].delete_many({'chatId': {'$in': [CHAT_ID, float(CHAT_ID)]}})
        print(f"  userConversion: deleted {r2.deleted_count}")

        # Remove from browse tracking
        r3 = db['browseTracking'].delete_many({'chatId': {'$in': [CHAT_ID, float(CHAT_ID)]}})
        print(f"  browseTracking: deleted {r3.deleted_count}")

        # Remove from abandoned carts
        r4 = db['abandonedCarts'].delete_many({'chatId': {'$in': [CHAT_ID, float(CHAT_ID)]}})
        print(f"  abandonedCarts: deleted {r4.deleted_count}")

        # Remove welcome coupons
        r5 = db['welcomeCoupons'].delete_many({'chatId': {'$in': [CHAT_ID, float(CHAT_ID)]}})
        print(f"  welcomeCoupons: deleted {r5.deleted_count}")

        # Remove from nameOf
        db['nameOf'].delete_one({'_id': CHAT_ID})
        db['nameOf'].delete_one({'_id': float(CHAT_ID)})
        db['nameOf'].delete_one({'_id': str(CHAT_ID)})

        # Keep wallet but reset firstDepositBonus flag
        # (we don't want to mess with actual wallet balances)

        client.close()
        print("  ✅ User reset complete — will appear as brand new user\n")
        return True
    except Exception as e:
        print(f"  ❌ Reset error: {e}")
        return False

# ════════════════════════════════════════════════════════════
# TESTS
# ════════════════════════════════════════════════════════════

def test_feature1_guided_onboarding():
    """Feature 1: Guided Onboarding Sequence"""
    print("\n" + "="*60)
    print("TEST: Feature 1 — Guided Onboarding Sequence")
    print("="*60)

    # Step 1: Send /start — should trigger language selection
    print("\n  Sending /start...")
    send_message("/start", 3)
    replies = get_last_replies(5)
    has_language = any('language' in r.lower() or 'langue' in r.lower() or '语言' in r.lower() for r in replies)
    record("Language selection shown on /start", has_language, str(replies[-1][:100] if replies else "no reply"))

    # Step 2: Select English
    print("\n  Selecting English...")
    send_message("🇺🇸 English", 4)
    replies = get_last_replies(10)

    # Check for guided onboarding message (not the old Quick Start Guide)
    has_onboarding = any(
        ('try right now' in r.lower() or 'pick one' in r.lower() or
         "what you can do" in r.lower() or "here's what" in r.lower() or
         'free ivr' in r.lower() or 'see hosting' in r.lower() or
         'browse domain' in r.lower() or 'skip' in r.lower())
        for r in replies
    )
    has_old_guide = any('quick start guide' in r.lower() for r in replies)
    
    record("Guided onboarding shown (not old Quick Start)", has_onboarding and not has_old_guide,
           "Found onboarding" if has_onboarding else "Missing onboarding buttons")

    # Check for welcome bonus message
    has_welcome = any('wallet' in r.lower() or '$3' in r.lower() or 'welcome' in r.lower() for r in replies)
    record("Welcome bonus message present", has_welcome)

    # Check conversion log
    conv_logs = get_last_logs(10, '[Conversion]')
    has_conv_log = any('onboarding started' in l.lower() for l in conv_logs)
    record("Conversion engine logged onboarding start", has_conv_log,
           str(conv_logs[-1][:100]) if conv_logs else "no conversion log")

    # Step 3: Click an onboarding button — "See Hosting Plans"
    print("\n  Clicking '🛡️ See Hosting Plans'...")
    send_message("🛡️ See Hosting Plans", 3)
    replies = get_last_replies(5)

    has_hosting = any(
        ('hosting' in r.lower() or 'plan' in r.lower() or 'premium' in r.lower() or
         'golden' in r.lower() or 'weekly' in r.lower() or 'cpanel' in r.lower())
        for r in replies
    )
    record("Hosting plans shown after onboarding button", has_hosting,
           str(replies[-1][:100] if replies else "no reply"))

    return True

def test_feature1_skip():
    """Feature 1: Skip onboarding — should show full menu"""
    print("\n" + "="*60)
    print("TEST: Feature 1 — Skip Onboarding")
    print("="*60)

    # Reset and start again
    reset_user()
    send_message("/start", 3)
    send_message("🇺🇸 English", 4)

    # Click Skip
    print("\n  Clicking '⏭️ Skip — Show Full Menu'...")
    send_message("⏭️ Skip — Show Full Menu", 3)
    replies = get_last_replies(5)

    has_menu = any(
        ('wallet' in r.lower() or 'balance' in r.lower() or 'menu' in r.lower() or
         'select an option' in r.lower() or 'tier' in r.lower())
        for r in replies
    )
    record("Full menu shown after skip", has_menu,
           str(replies[-1][:80] if replies else "no reply"))

    return True

def test_feature4_browse_tracking():
    """Feature 4: Browse-Based Follow-Up — track product menu visits"""
    print("\n" + "="*60)
    print("TEST: Feature 4 — Browse Tracking")
    print("="*60)

    # Navigate to domains menu
    print("\n  Navigating to Domains menu...")
    send_message("/start", 3)
    send_message("🌐 Bulletproof Domains", 3)
    replies = get_last_replies(5)

    # Check if browse was tracked in MongoDB
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        tracking = db['browseTracking'].find_one({'chatId': float(CHAT_ID)})
        client.close()

        has_tracking = tracking is not None and tracking.get('browseCount', {}).get('domains', 0) > 0
        record("Browse tracking saved to MongoDB", has_tracking,
               f"browseCount: {tracking.get('browseCount', {})}" if tracking else "no tracking doc")
    except Exception as e:
        record("Browse tracking saved to MongoDB", False, str(e))

    # Navigate to hosting menu
    print("\n  Navigating to Hosting menu...")
    send_message("/start", 2)
    send_message("🛡️🔥 Anti-Red Hosting", 3)

    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        tracking = db['browseTracking'].find_one({'chatId': float(CHAT_ID)})
        client.close()

        has_hosting = tracking is not None and tracking.get('browseCount', {}).get('hosting', 0) > 0
        record("Hosting browse tracked", has_hosting,
               f"browseCount: {tracking.get('browseCount', {})}" if tracking else "no tracking")
    except Exception as e:
        record("Hosting browse tracked", False, str(e))

    return True

def test_feature5_social_proof():
    """Feature 5: Social Proof — check purchase counts in product menus"""
    print("\n" + "="*60)
    print("TEST: Feature 5 — Social Proof in Product Menus")
    print("="*60)

    # Navigate to hosting menu and check for social proof
    print("\n  Checking Hosting menu for social proof...")
    send_message("/start", 2)
    send_message("🛡️🔥 Anti-Red Hosting", 3)
    replies = get_last_replies(5)

    has_proof_hosting = any(
        ('users bought' in r.lower() or '🔥' in r and 'this week' in r.lower())
        for r in replies
    )
    record("Social proof in Hosting menu", has_proof_hosting,
           str([r for r in replies if '🔥' in r or 'users' in r.lower()][:1]))

    # Navigate to domains menu
    print("\n  Checking Domains menu for social proof...")
    send_message("/start", 2)
    send_message("🌐 Bulletproof Domains", 3)
    replies = get_last_replies(5)

    has_proof_domains = any(
        ('domains registered' in r.lower() or '🌐' in r and 'this week' in r.lower())
        for r in replies
    )
    record("Social proof in Domains menu", has_proof_domains,
           str([r for r in replies if '🌐' in r and 'week' in r.lower()][:1]))

    # Navigate to Cloud Phone menu
    print("\n  Checking Cloud Phone menu for social proof...")
    send_message("/start", 2)
    send_message("📞 Cloud Phone + SIP", 3)
    replies = get_last_replies(10)

    has_proof_phone = any(
        ('activated' in r.lower() or 'phone' in r.lower() and 'this week' in r.lower())
        for r in replies
    )
    record("Social proof in Cloud Phone menu", has_proof_phone,
           str([r for r in replies if 'week' in r.lower()][:1]))

    # Navigate to Digital Products menu
    print("\n  Checking Digital Products menu for social proof...")
    send_message("/start", 2)
    send_message("🛒 Digital Products", 3)
    replies = get_last_replies(10)

    has_proof_dp = any(
        ('sold' in r.lower() or 'digital' in r.lower() and 'this week' in r.lower())
        for r in replies
    )
    record("Social proof in Digital Products menu", has_proof_dp,
           str([r for r in replies if 'week' in r.lower()][:1]))

    return True

def test_feature3_welcome_offer_scheduled():
    """Feature 3: Check that welcome offer was scheduled"""
    print("\n" + "="*60)
    print("TEST: Feature 3 — Welcome Offer Scheduled")
    print("="*60)

    conv_logs = get_last_logs(30, '[Conversion]')
    has_scheduled = any('welcome offer scheduled' in l.lower() for l in conv_logs)
    record("Welcome offer scheduled (2h timer)", has_scheduled,
           str([l for l in conv_logs if 'welcome' in l.lower()][:1]))

    return True

def test_feature2_first_deposit_bonus_check():
    """Feature 2: Check first deposit bonus — verify DB state"""
    print("\n" + "="*60)
    print("TEST: Feature 2 — First Deposit Bonus (DB State Check)")
    print("="*60)

    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        record_doc = db['userConversion'].find_one({'chatId': float(CHAT_ID)})
        client.close()

        has_record = record_doc is not None
        record("Conversion record created for user", has_record,
               f"onboardingStarted={record_doc.get('onboardingStarted')}, firstDepositBonusAwarded={record_doc.get('firstDepositBonusAwarded')}" if record_doc else "no record")

        if record_doc:
            not_awarded = record_doc.get('firstDepositBonusAwarded') != True
            record("First deposit bonus NOT yet awarded (correct — no deposit yet)", not_awarded)
    except Exception as e:
        record("Conversion record check", False, str(e))

    return True

def test_no_errors():
    """Check for zero errors in error log"""
    print("\n" + "="*60)
    print("TEST: Error Log Check")
    print("="*60)

    errors = check_errors()
    record("Zero errors in nodejs.err.log", len(errors) == 0,
           f"Errors found: {errors[:200]}" if errors else "Clean")
    return True

# ════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("🧪 Testing New User Conversion Engine — 5 Features")
    print("=" * 60)

    # Reset user first
    reset_user()
    time.sleep(2)

    # Clear error log
    subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.err.log"])

    # Run tests
    test_feature1_guided_onboarding()
    test_feature1_skip()
    test_feature4_browse_tracking()
    test_feature5_social_proof()
    test_feature3_welcome_offer_scheduled()
    test_feature2_first_deposit_bonus_check()
    test_no_errors()

    # Summary
    print("\n" + "=" * 60)
    print("📊 RESULTS SUMMARY")
    print("=" * 60)
    passed = sum(1 for r in results if r['passed'])
    failed = sum(1 for r in results if not r['passed'])
    total = len(results)
    print(f"  ✅ Passed: {passed}/{total}")
    print(f"  ❌ Failed: {failed}/{total}")
    print()
    for r in results:
        status = "✅" if r['passed'] else "❌"
        print(f"  {status} {r['test']}")
    print()

    # Save results
    with open('/app/conversion_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    print(f"Results saved to /app/conversion_test_results.json")

    sys.exit(0 if failed == 0 else 1)
