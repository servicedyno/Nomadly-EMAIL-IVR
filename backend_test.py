#!/usr/bin/env python3
"""
Backend test for deposit-flow friction reduction + deposit funnel instrumentation
Test sequence 18 - Independent verification
"""
import os
import sys
import json
import time
import http.client
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment
load_dotenv('/app/backend/.env')

MONGO_URL = os.getenv('MONGO_URL')
DB_NAME = os.getenv('DB_NAME', 'test')
WEBHOOK_HOST = '127.0.0.1'
WEBHOOK_PORT = 5000
WEBHOOK_PATH = '/telegram/webhook'

# Test chat IDs (fake, safe to use)
TEST_CHAT_1 = 888800101
TEST_CHAT_2 = 888800102
TEST_CHAT_3 = 888800103

def post_message(chat_id, text):
    """Send a message to the bot webhook"""
    update = {
        "update_id": int(time.time() * 1000) + chat_id,
        "message": {
            "message_id": int(time.time() * 1000),
            "from": {
                "id": chat_id,
                "is_bot": False,
                "first_name": "TestUser",
                "username": f"test_{chat_id}"
            },
            "chat": {
                "id": chat_id,
                "type": "private"
            },
            "date": int(time.time()),
            "text": text
        }
    }
    
    body = json.dumps(update)
    conn = http.client.HTTPConnection(WEBHOOK_HOST, WEBHOOK_PORT, timeout=10)
    try:
        conn.request('POST', WEBHOOK_PATH, body, {'Content-Type': 'application/json'})
        response = conn.getresponse()
        return response.status
    finally:
        conn.close()

def main():
    print("=" * 70)
    print("DEPOSIT FLOW FRICTION REDUCTION + FUNNEL INSTRUMENTATION TEST")
    print("Test sequence 18 - Independent verification")
    print("=" * 70)
    
    # Connect to MongoDB
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    state_col = db['state']
    funnel_col = db['depositFunnel']
    
    passed = 0
    failed = 0
    
    def check(label, condition, details=""):
        nonlocal passed, failed
        status = "✅" if condition else "❌"
        print(f"{status} {label}")
        if details:
            print(f"   {details}")
        if condition:
            passed += 1
        else:
            failed += 1
    
    try:
        # ================================================================
        # TEST 1: Preset "$50" parsing + bank-hidden skips method picker
        # ================================================================
        print("\n--- TEST 1: Preset amount parsing + bank-hidden flow ---")
        
        chat_id_1 = str(TEST_CHAT_1)
        
        # Seed state
        state_col.update_one(
            {'_id': chat_id_1},
            {'$set': {
                '_id': chat_id_1,
                'userLanguage': 'en',
                'isNewUser': False,
                'action': 'selectCurrencyToDeposit',
                'userName': 'test_user_1'
            }},
            upsert=True
        )
        
        # Send "$50" preset
        status = post_message(TEST_CHAT_1, '$50')
        check("POST $50 accepted", status == 200, f"HTTP {status}")
        
        time.sleep(1.5)
        
        # Check state
        s1 = state_col.find_one({'_id': chat_id_1})
        check("depositAmountUsd = 50", s1 and s1.get('depositAmountUsd') == 50, 
              f"Got: {s1.get('depositAmountUsd') if s1 else 'None'}")
        
        # Check HIDE_BANK_PAYMENT behavior
        bank_hidden = os.getenv('HIDE_BANK_PAYMENT') == 'true'
        expected_action = 'selectCryptoToDeposit' if bank_hidden else 'depositMethodSelect'
        check(f"Bank hidden={bank_hidden} → action={expected_action}", 
              s1 and s1.get('action') == expected_action,
              f"Got action: {s1.get('action') if s1 else 'None'}")
        
        # ================================================================
        # TEST 2: ETH selection → address generated + funnel doc created
        # ================================================================
        print("\n--- TEST 2: ETH selection → address + funnel instrumentation ---")
        
        chat_id_2 = str(TEST_CHAT_2)
        
        # Seed state
        state_col.update_one(
            {'_id': chat_id_2},
            {'$set': {
                '_id': chat_id_2,
                'userLanguage': 'en',
                'isNewUser': False,
                'action': 'selectCurrencyToDeposit',
                'userName': 'test_user_2'
            }},
            upsert=True
        )
        
        # Send amount
        post_message(TEST_CHAT_2, '$50')
        time.sleep(1.2)
        
        # Count funnel docs before
        funnel_before = funnel_col.count_documents({'chatId': chat_id_2})
        
        # Send ETH selection
        status = post_message(TEST_CHAT_2, 'Ξ Ethereum (ETH)')
        check("POST ETH selection accepted", status == 200, f"HTTP {status}")
        
        time.sleep(6)  # Wait for address generation
        
        # Check state
        s2 = state_col.find_one({'_id': chat_id_2})
        check("Action reset to 'none' after address generation", 
              s2 and s2.get('action') == 'none',
              f"Got action: {s2.get('action') if s2 else 'None'}")
        
        # Check funnel doc created
        funnel_after = funnel_col.count_documents({'chatId': chat_id_2})
        check("Deposit funnel doc created", funnel_after > funnel_before,
              f"Before: {funnel_before}, After: {funnel_after}")
        
        # Check funnel doc details
        funnel_doc = funnel_col.find_one({'chatId': chat_id_2}, sort=[('generatedAt', -1)])
        if funnel_doc:
            check("Funnel doc has amountUsd=50", funnel_doc.get('amountUsd') == 50,
                  f"Got: {funnel_doc.get('amountUsd')}")
            check("Funnel doc has status='address_generated'", 
                  funnel_doc.get('status') == 'address_generated',
                  f"Got: {funnel_doc.get('status')}")
            check("Funnel doc has coin='ETH'", funnel_doc.get('coin') == 'ETH',
                  f"Got: {funnel_doc.get('coin')}")
        else:
            check("Funnel doc exists", False, "No funnel doc found")
        
        # ================================================================
        # TEST 3: TRC20 minimum interstitial (3 buttons, not 5)
        # ================================================================
        print("\n--- TEST 3: TRC20 minimum interstitial verification ---")
        
        # This test requires checking the code implementation since we can't
        # easily trigger the interstitial without completing a real deposit
        # Let's verify the code has the correct button count
        
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
            
        # Find the TRC20 minimum interstitial section
        if 'trc20TopUpBtn' in content and 'trc20SwitchCryptoBtn' in content and 'trc20CancelBtn' in content:
            # Check that the buttons array has exactly 3 elements
            import re
            pattern = r'const buttons = \[\s*\[t\.trc20TopUpBtn.*?\],\s*\[t\.trc20SwitchCryptoBtn\],\s*\[t\.trc20CancelBtn\],?\s*\]'
            match = re.search(pattern, content, re.DOTALL)
            check("TRC20 interstitial has 3 buttons (Pay min / Switch / Cancel)", 
                  match is not None,
                  "Found correct button structure in code")
            
            # Verify the button array does NOT include Why/Edit buttons
            # (handlers may still exist for backward compat, but buttons are not shown)
            button_section = content[content.find('const buttons = ['):content.find('const buttons = [') + 500]
            has_why_in_buttons = 'trc20WhyBtn' in button_section or 'trc20WhyMinBtn' in button_section
            has_edit_in_buttons = 'trc20EditBtn' in button_section or 'trc20EditAmountBtn' in button_section
            check("Button array does NOT include Why/Edit (friction reduced to 3 buttons)", 
                  not (has_why_in_buttons or has_edit_in_buttons),
                  "Verified only 3 buttons shown in UI")
        else:
            check("TRC20 interstitial code found", False, "Could not find TRC20 button code")
        
        # ================================================================
        # TEST 4: Preset buttons exist
        # ================================================================
        print("\n--- TEST 4: Preset buttons verification ---")
        
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        check("Preset buttons $20/$50/$100/$200 exist", 
              "'$20', '$50'" in content and "'$100', '$200'" in content,
              "Found preset keyboard in code")
        
        # ================================================================
        # CLEANUP
        # ================================================================
        print("\n--- Cleanup ---")
        
        state_col.delete_many({'_id': {'$in': [str(TEST_CHAT_1), str(TEST_CHAT_2), str(TEST_CHAT_3)]}})
        funnel_col.delete_many({'chatId': {'$in': [str(TEST_CHAT_1), str(TEST_CHAT_2), str(TEST_CHAT_3)]}})
        print("✅ Test data cleaned up")
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        failed += 1
    finally:
        client.close()
    
    # ================================================================
    # SUMMARY
    # ================================================================
    print("\n" + "=" * 70)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 70)
    
    return 0 if failed == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
