#!/usr/bin/env python3
"""
Backend API Testing Script for OTP Voice Match Bug Fix Verification
Tests the Nomadly Telegram-bot platform (Node.js Express on port 5000 behind FastAPI proxy on 8001)
"""

import requests
import json
import sys

# Backend URL from frontend/.env
BACKEND_URL = "https://390e6ff0-6afa-45a4-a8ca-64792be6b7f1.preview.emergentagent.com"

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def test_otp_voice_match():
    """
    TEST 1: PRIMARY FIX - OTP voice match test
    POST {REACT_APP_BACKEND_URL}/api/dev/otp-voice-match-test with body {}
    """
    print_section("TEST 1: PRIMARY FIX - OTP Voice Match Test")
    
    url = f"{BACKEND_URL}/api/dev/otp-voice-match-test"
    print(f"URL: {url}")
    print(f"Method: POST")
    print(f"Body: {{}}")
    
    try:
        response = requests.post(url, json={}, timeout=30)
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nResponse JSON:")
            print(json.dumps(data, indent=2))
            
            # Verify expected fields
            print("\n--- VERIFICATION ---")
            print(f"✓ HTTP 200: {'✅' if response.status_code == 200 else '❌'}")
            print(f"✓ top-level 'pass' === true: {'✅' if data.get('pass') == True else '❌'}")
            
            checks = data.get('checks', {})
            print("\n--- CHECKS ---")
            expected_checks = [
                'fallback_female_gender_matched',
                'fallback_male_gender_matched',
                'match_status_200',
                'match_uses_play',
                'match_no_polly_say_for_prompt',
                'match_retry_uses_play',
                'fallback_uses_say',
                'fallback_say_gender_matched'
            ]
            
            all_passed = True
            for check in expected_checks:
                value = checks.get(check)
                status = '✅' if value == True else '❌'
                print(f"  {check}: {value} {status}")
                if value != True:
                    all_passed = False
            
            print(f"\n{'✅ ALL CHECKS PASSED' if all_passed and data.get('pass') == True else '❌ SOME CHECKS FAILED'}")
            return response.status_code == 200 and all_passed and data.get('pass') == True
        else:
            print(f"\nResponse Text: {response.text}")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False

def test_twilio_ivr_transfer_billing():
    """
    TEST 2: REGRESSION - Twilio IVR transfer billing test
    POST {REACT_APP_BACKEND_URL}/api/dev/twilio-ivr-transfer-billing-test with body {}
    """
    print_section("TEST 2: REGRESSION - Twilio IVR Transfer Billing Test")
    
    url = f"{BACKEND_URL}/api/dev/twilio-ivr-transfer-billing-test"
    print(f"URL: {url}")
    print(f"Method: POST")
    print(f"Body: {{}}")
    
    try:
        response = requests.post(url, json={}, timeout=30)
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nResponse JSON:")
            print(json.dumps(data, indent=2))
            
            # Verify expected fields
            print("\n--- VERIFICATION ---")
            print(f"✓ HTTP 200: {'✅' if response.status_code == 200 else '❌'}")
            print(f"✓ top-level 'pass' === true: {'✅' if data.get('pass') == True else '❌'}")
            
            return response.status_code == 200 and data.get('pass') == True
        else:
            print(f"\nResponse Text: {response.text}")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False

def test_call_reconciler():
    """
    TEST 3: REGRESSION - Call reconciler test
    POST {REACT_APP_BACKEND_URL}/api/dev/call-reconciler-test with body {}
    """
    print_section("TEST 3: REGRESSION - Call Reconciler Test")
    
    url = f"{BACKEND_URL}/api/dev/call-reconciler-test"
    print(f"URL: {url}")
    print(f"Method: POST")
    print(f"Body: {{}}")
    
    try:
        response = requests.post(url, json={}, timeout=30)
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nResponse JSON:")
            print(json.dumps(data, indent=2))
            
            # Verify expected fields
            print("\n--- VERIFICATION ---")
            print(f"✓ HTTP 200: {'✅' if response.status_code == 200 else '❌'}")
            print(f"✓ top-level 'pass' === true: {'✅' if data.get('pass') == True else '❌'}")
            
            return response.status_code == 200 and data.get('pass') == True
        else:
            print(f"\nResponse Text: {response.text}")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False

def test_health():
    """
    TEST 4: REGRESSION - Health check
    GET {REACT_APP_BACKEND_URL}/api/health
    """
    print_section("TEST 4: REGRESSION - Health Check")
    
    url = f"{BACKEND_URL}/api/health"
    print(f"URL: {url}")
    print(f"Method: GET")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nResponse JSON:")
            print(json.dumps(data, indent=2))
            
            # Verify expected fields
            print("\n--- VERIFICATION ---")
            print(f"✓ HTTP 200: {'✅' if response.status_code == 200 else '❌'}")
            print(f"✓ status === 'healthy': {'✅' if data.get('status') == 'healthy' else '❌'}")
            print(f"✓ database === 'connected': {'✅' if data.get('database') == 'connected' else '❌'}")
            
            return (response.status_code == 200 and 
                   data.get('status') == 'healthy' and 
                   data.get('database') == 'connected')
        else:
            print(f"\nResponse Text: {response.text}")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False

def main():
    """Run all tests and report results"""
    print("\n" + "="*80)
    print("  OTP VOICE MATCH BUG FIX VERIFICATION")
    print("  Nomadly Telegram-bot Platform")
    print("  Node.js Express (5000) behind FastAPI proxy (8001)")
    print("="*80)
    
    results = {
        'test1_otp_voice_match': test_otp_voice_match(),
        'test2_twilio_ivr_transfer_billing': test_twilio_ivr_transfer_billing(),
        'test3_call_reconciler': test_call_reconciler(),
        'test4_health': test_health()
    }
    
    # Summary
    print_section("SUMMARY")
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    for test_name, result in results.items():
        status = '✅ PASSED' if result else '❌ FAILED'
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({int(passed/total*100)}%)")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED - Bug fix verified successfully!")
        sys.exit(0)
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED - Bug fix verification incomplete")
        sys.exit(1)

if __name__ == "__main__":
    main()
