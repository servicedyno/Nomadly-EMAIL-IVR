#!/usr/bin/env python3
"""
Backend API Test Suite for IVR Audio-Library Integrity Fix
Tests the P0 IVR audio-library integrity fix for @Padrino_voodoo (chatId 7706898844)
"""

import requests
import json
import sys
from typing import Dict, Any, List, Tuple

# Backend URL from frontend/.env
BACKEND_URL = "https://setup-guide-134.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test_header(test_name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {test_name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")

def print_pass(message: str):
    print(f"{Colors.GREEN}✅ PASS: {message}{Colors.RESET}")

def print_fail(message: str):
    print(f"{Colors.RED}❌ FAIL: {message}{Colors.RESET}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ️  INFO: {message}{Colors.RESET}")

def test_health_check() -> Tuple[bool, str]:
    """Test 1: Health check endpoint"""
    print_test_header("Health Check")
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print_info(f"Response: {json.dumps(data, indent=2)}")
        
        if data.get("status") != "healthy":
            return False, f"Expected status='healthy', got '{data.get('status')}'"
        
        if data.get("database") != "connected":
            return False, f"Expected database='connected', got '{data.get('database')}'"
        
        print_pass("Health check passed: healthy + database connected")
        return True, "Health check OK"
        
    except Exception as e:
        return False, f"Health check failed: {str(e)}"

def test_ivr_audio_library_integrity() -> Tuple[bool, str]:
    """Test 2: Main IVR audio-library integrity fix"""
    print_test_header("IVR Audio-Library Integrity Fix")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/dev/ivr-audio-library-integrity",
            json={},
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}. Response: {response.text[:500]}"
        
        data = response.json()
        print_info(f"Response: {json.dumps(data, indent=2)}")
        
        # Check top-level pass
        if not data.get("pass"):
            return False, f"Top-level pass is not true: {data.get('pass')}"
        
        checks = data.get("checks", {})
        
        # Step 1: Save audio to library
        step1 = checks.get("step1_save", {})
        if not step1.get("ok"):
            return False, f"step1_save.ok is not true: {step1}"
        print_pass("Step 1: Audio can be saved to library")
        
        # Step 2: Reselect (appears in listAudios)
        step2 = checks.get("step2_reselect", {})
        if not step2.get("ok"):
            return False, f"step2_reselect.ok is not true: {step2}"
        print_pass("Step 2: Audio appears in listAudios")
        
        # Step 3: Setup (phone with features.ivr → greetingFromLibrary + backups seeded)
        step3 = checks.get("step3_setup", {})
        if not step3.get("ok"):
            return False, f"step3_setup.ok is not true: {step3}"
        print_pass("Step 3: Phone with features.ivr → greetingFromLibrary + backups seeded")
        
        # Step 4: Delete cascade (CRITICAL - this is the main fix)
        step4 = checks.get("step4_delete_cascade", {})
        if not step4.get("fileRemovedFromDisk"):
            return False, f"step4_delete_cascade.fileRemovedFromDisk is not true: {step4}"
        print_pass("Step 4a: File removed from disk")
        
        if not step4.get("removedFromLibrary"):
            return False, f"step4_delete_cascade.removedFromLibrary is not true: {step4}"
        print_pass("Step 4b: Removed from library")
        
        if not step4.get("backupRemoved"):
            return False, f"step4_delete_cascade.backupRemoved is not true: {step4}"
        print_pass("Step 4c: ivrAudioStore backup removed (zombie restore prevention)")
        
        if not step4.get("phoneGreetingReset"):
            return False, f"step4_delete_cascade.phoneGreetingReset is not true: {step4}"
        print_pass("Step 4d: Phone greeting reset")
        
        # Verify phone greeting state after delete
        current_ivr = step4.get("currentIvrState", {})
        if current_ivr.get("greetingType") != "default":
            return False, f"currentIvrState.greetingType should be 'default', got '{current_ivr.get('greetingType')}'"
        print_pass("Step 4e: greetingType reset to 'default'")
        
        if current_ivr.get("greetingFromLibrary"):
            return False, f"currentIvrState.greetingFromLibrary should be falsy, got '{current_ivr.get('greetingFromLibrary')}'"
        print_pass("Step 4f: greetingFromLibrary cleared")
        
        if current_ivr.get("greetingAudioUrl"):
            return False, f"currentIvrState.greetingAudioUrl should be falsy, got '{current_ivr.get('greetingAudioUrl')}'"
        print_pass("Step 4g: greetingAudioUrl cleared (no 404 Play URL)")
        
        # Step 5: Reupload and pick (round-trip)
        step5 = checks.get("step5_reupload_and_pick", {})
        if not step5.get("appearsInLibrary"):
            return False, f"step5_reupload_and_pick.appearsInLibrary is not true: {step5}"
        print_pass("Step 5: Re-upload and pick works (round-trip)")
        
        print_pass("ALL IVR audio-library integrity checks PASSED")
        return True, "IVR audio-library integrity fix verified"
        
    except Exception as e:
        return False, f"IVR audio-library integrity test failed: {str(e)}"

def test_regression_endpoint(endpoint: str, body: Dict[str, Any]) -> Tuple[bool, str]:
    """Test a regression endpoint"""
    try:
        response = requests.post(
            f"{BACKEND_URL}/dev/{endpoint}",
            json=body,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print_info(f"  {endpoint}: Status {response.status_code}")
        
        if response.status_code != 200:
            return False, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        if not data.get("pass"):
            return False, f"Expected pass:true, got pass:{data.get('pass')}"
        
        print_pass(f"  {endpoint}: pass=true")
        return True, f"{endpoint} OK"
        
    except Exception as e:
        return False, f"{endpoint} failed: {str(e)}"

def test_all_regressions() -> Tuple[bool, str]:
    """Test 3: All regression endpoints"""
    print_test_header("Regression Tests")
    
    regression_tests = [
        ("test-outbound-call-selfheal", {"dryRun": True, "targetChatId": "7706898844"}),
        ("stale-wallet-tap-test", {}),
        ("support-routing-test", {}),
        ("outbound-billing-leak-test", {}),
        ("concurrency-guard-test", {}),
        ("settle-receipt-test", {}),
    ]
    
    all_passed = True
    failed_tests = []
    
    for endpoint, body in regression_tests:
        passed, message = test_regression_endpoint(endpoint, body)
        if not passed:
            all_passed = False
            failed_tests.append(f"{endpoint}: {message}")
    
    if all_passed:
        print_pass(f"All {len(regression_tests)} regression tests PASSED")
        return True, "All regression tests OK"
    else:
        return False, f"Regression failures: {', '.join(failed_tests)}"

def main():
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}IVR Audio-Library Integrity Fix - Backend Test Suite{Colors.RESET}")
    print(f"{Colors.BLUE}Backend URL: {BACKEND_URL}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    results = []
    
    # Test 1: Health check
    passed, message = test_health_check()
    results.append(("Health Check", passed, message))
    
    # Test 2: Main IVR audio-library integrity fix
    passed, message = test_ivr_audio_library_integrity()
    results.append(("IVR Audio-Library Integrity", passed, message))
    
    # Test 3: Regression tests
    passed, message = test_all_regressions()
    results.append(("Regression Tests", passed, message))
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    all_passed = True
    for test_name, passed, message in results:
        if passed:
            print_pass(f"{test_name}: {message}")
        else:
            print_fail(f"{test_name}: {message}")
            all_passed = False
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    if all_passed:
        print(f"{Colors.GREEN}✅ ALL TESTS PASSED{Colors.RESET}")
        print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
        return 0
    else:
        print(f"{Colors.RED}❌ SOME TESTS FAILED{Colors.RESET}")
        print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
