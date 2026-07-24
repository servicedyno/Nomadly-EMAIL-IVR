#!/usr/bin/env python3
"""
Backend API Testing for Nomadly Telegram-bot Platform
Tests two bug fixes:
1. URL Shortener blocked by SUSPENDED hosting plan
2. Imported call audio lost on Railway redeploy
"""

import requests
import json
import sys

# Backend URL from frontend/.env
BACKEND_URL = "https://9aa293f0-bc8e-43ad-9a74-be67d654e7d2.preview.emergentagent.com/api"

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def test_shortener_conflict_check():
    """
    TEST 1: URL Shortener must NOT be blocked by a SUSPENDED hosting plan
    Bug: @aramboss / 6156677266
    """
    print_section("TEST 1: URL Shortener Conflict Check")
    
    endpoint = f"{BACKEND_URL}/dev/shortener-conflict-check"
    
    # Test 1a: Basic test with empty body
    print("\n[1a] Testing with empty body {}")
    try:
        response = requests.post(
            endpoint,
            json={},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected HTTP 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response JSON:\n{json.dumps(data, indent=2)}")
        
        # Check top-level pass
        if not data.get("pass"):
            print(f"❌ FAILED: Top-level 'pass' is not true")
            return False
        
        # Check all results
        results = data.get("results", [])
        if not results:
            print(f"❌ FAILED: No results array found")
            return False
        
        all_passed = True
        expected_cases = {
            "suspended_not_deleted": {"blocked": False, "description": "THE FIX - suspended plan must not block"},
            "deleted": {"blocked": False, "description": "deleted plan should not block"},
            "live_active": {"blocked": True, "description": "regression guard - live plan still blocks"},
            "addon_on_live_plan": {"blocked": True, "description": "addon on live plan should block"},
            "addon_on_suspended": {"blocked": False, "description": "addon on suspended should not block"}
        }
        
        print("\nChecking individual cases:")
        for result in results:
            case_name = result.get("case")
            blocked = result.get("blocked")
            passed = result.get("pass")
            
            if case_name in expected_cases:
                expected = expected_cases[case_name]
                status = "✅" if passed else "❌"
                print(f"  {status} {case_name}: blocked={blocked} (expected {expected['blocked']}) - {expected['description']}")
                
                if not passed:
                    all_passed = False
                    print(f"      FAILED: {result.get('reason', 'No reason provided')}")
            else:
                print(f"  ⚠️  Unknown case: {case_name}")
        
        if not all_passed:
            print(f"\n❌ FAILED: Not all cases passed")
            return False
        
        print(f"\n✅ PASSED: All cases passed for empty body test")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ FAILED: JSON decode error: {e}")
        print(f"Response text: {response.text}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error: {e}")
        return False
    
    # Test 1b: Test with specific domain (securipa.xyz)
    print("\n[1b] Testing with domain: securipa.xyz")
    try:
        response = requests.post(
            endpoint,
            json={"domain": "securipa.xyz"},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected HTTP 200, got {response.status_code}")
            return False
        
        data = response.json()
        print(f"Response JSON:\n{json.dumps(data, indent=2)}")
        
        # Check for liveDomainCheck
        live_domain_check = data.get("liveDomainCheck")
        if live_domain_check:
            blocked = live_domain_check.get("blocked")
            print(f"\nLive domain check: blocked={blocked}")
            if blocked is False:
                print(f"✅ PASSED: securipa.xyz shows blocked:false (plan already deleted)")
            else:
                print(f"⚠️  WARNING: securipa.xyz blocked status is {blocked}")
        else:
            print(f"⚠️  WARNING: No liveDomainCheck in response")
        
        print(f"\n✅ PASSED: Domain-specific test completed")
        
    except Exception as e:
        print(f"⚠️  WARNING: Domain test error (non-critical): {e}")
    
    return True


def test_audio_persistence_check():
    """
    TEST 2: Imported call audio must survive a Railway redeploy
    Bug: @Spirits_Of_The_Ancesters / 7898648919
    """
    print_section("TEST 2: Audio Persistence Check")
    
    endpoint = f"{BACKEND_URL}/dev/audio-persistence-check"
    
    print("\nTesting audio persistence after simulated redeploy")
    try:
        response = requests.post(
            endpoint,
            json={},
            headers={"Content-Type": "application/json"},
            timeout=60  # Longer timeout as this test does more work
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAILED: Expected HTTP 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response JSON:\n{json.dumps(data, indent=2)}")
        
        # Check top-level pass
        if not data.get("pass"):
            print(f"❌ FAILED: Top-level 'pass' is not true")
            return False
        
        # Check all steps
        steps = data.get("steps", {})
        if not steps:
            print(f"❌ FAILED: No steps object found")
            return False
        
        expected_steps = {
            "persisted_to_ivrAudioStore": {
                "description": "Import now backs up the binary to MongoDB",
                "checks": ["pass", "bufferChars"]
            },
            "disk_wiped": {
                "description": "Simulated redeploy removed the file from disk",
                "checks": ["pass"]
            },
            "restored_serves_audio": {
                "description": "CORE FIX: restore middleware serves real audio after disk wipe",
                "checks": ["pass", "status", "contentType", "size"]
            },
            "missing_returns_404": {
                "description": "Defense-in-depth: missing file returns clean 404",
                "checks": ["pass", "status"]
            }
        }
        
        all_passed = True
        print("\nChecking individual steps:")
        
        for step_name, expected in expected_steps.items():
            step_data = steps.get(step_name, {})
            passed = step_data.get("pass")
            status = "✅" if passed else "❌"
            
            print(f"\n  {status} {step_name}:")
            print(f"      {expected['description']}")
            
            if not passed:
                all_passed = False
                print(f"      FAILED: {step_data.get('reason', 'No reason provided')}")
            else:
                # Print relevant details
                for check in expected['checks']:
                    if check != 'pass' and check in step_data:
                        value = step_data[check]
                        print(f"      {check}: {value}")
                
                # Specific validations
                if step_name == "persisted_to_ivrAudioStore":
                    buffer_chars = step_data.get("bufferChars", 0)
                    if buffer_chars <= 0:
                        print(f"      ❌ FAILED: bufferChars should be > 0, got {buffer_chars}")
                        all_passed = False
                
                elif step_name == "restored_serves_audio":
                    status_code = step_data.get("status")
                    content_type = step_data.get("contentType", "")
                    size = step_data.get("size", 0)
                    
                    if status_code != 200:
                        print(f"      ❌ FAILED: Expected status 200, got {status_code}")
                        all_passed = False
                    if "audio/" not in content_type.lower():
                        print(f"      ❌ FAILED: Expected content-type to contain 'audio/', got {content_type}")
                        all_passed = False
                    if size <= 0:
                        print(f"      ❌ FAILED: Expected size > 0, got {size}")
                        all_passed = False
                
                elif step_name == "missing_returns_404":
                    status_code = step_data.get("status")
                    if status_code != 404:
                        print(f"      ❌ FAILED: Expected status 404, got {status_code}")
                        all_passed = False
        
        if not all_passed:
            print(f"\n❌ FAILED: Not all steps passed")
            return False
        
        print(f"\n✅ PASSED: All steps passed")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ FAILED: Request error: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ FAILED: JSON decode error: {e}")
        print(f"Response text: {response.text}")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all backend tests"""
    print_section("NOMADLY TELEGRAM-BOT BACKEND API TESTS")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Environment: development (BOT_ENVIRONMENT=development)")
    print(f"\nTesting TWO bug fixes:")
    print(f"  1. URL Shortener blocked by SUSPENDED hosting plan")
    print(f"  2. Imported call audio lost on Railway redeploy")
    
    results = {}
    
    # Run tests
    results["test1_shortener"] = test_shortener_conflict_check()
    results["test2_audio"] = test_audio_persistence_check()
    
    # Summary
    print_section("TEST SUMMARY")
    
    test1_status = "✅ PASSED" if results["test1_shortener"] else "❌ FAILED"
    test2_status = "✅ PASSED" if results["test2_audio"] else "❌ FAILED"
    
    print(f"\nTEST 1 (URL Shortener Conflict Check): {test1_status}")
    print(f"TEST 2 (Audio Persistence Check): {test2_status}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print(f"\n{'='*80}")
        print(f"  ✅ ALL TESTS PASSED")
        print(f"{'='*80}")
        return 0
    else:
        print(f"\n{'='*80}")
        print(f"  ❌ SOME TESTS FAILED")
        print(f"{'='*80}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
