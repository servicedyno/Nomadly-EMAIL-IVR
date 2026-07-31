#!/usr/bin/env python3
"""
Backend test for AI support 'no answer' fix
Tests the routing heuristic and AI response endpoints
"""

import requests
import json
import sys
import time

# Backend URL from frontend/.env
BACKEND_URL = "https://7b4407e6-eb4c-4661-af92-5701e1e9dc92.preview.emergentagent.com"

def print_section(title):
    """Print a section header"""
    print("\n" + "="*80)
    print(f"  {title}")
    print("="*80)

def print_result(test_name, passed, details=""):
    """Print test result"""
    status = "✅ PASSED" if passed else "❌ FAILED"
    print(f"\n{status}: {test_name}")
    if details:
        print(f"  {details}")

def test_support_routing():
    """
    TEST 1: Routing heuristic
    POST /api/dev/support-routing-test with body {}
    Expect HTTP 200 and JSON "pass": true with checks.allQuestionsRouted:true AND checks.noFalsePositives:true
    """
    print_section("TEST 1: Support Routing Heuristic")
    
    url = f"{BACKEND_URL}/api/dev/support-routing-test"
    headers = {"Content-Type": "application/json"}
    body = {}
    
    print(f"\nEndpoint: POST {url}")
    print(f"Body: {json.dumps(body)}")
    
    try:
        response = requests.post(url, json=body, headers=headers, timeout=60)
        
        print(f"\nHTTP Status: {response.status_code}")
        print(f"\nRaw Response:")
        print(json.dumps(response.json(), indent=2))
        
        if response.status_code != 200:
            print_result("TEST 1", False, f"Expected HTTP 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check top-level pass
        if not data.get("pass"):
            print_result("TEST 1", False, f"Top-level 'pass' is {data.get('pass')}, expected true")
            return False
        
        # Check nested checks
        checks = data.get("checks", {})
        all_questions_routed = checks.get("allQuestionsRouted")
        no_false_positives = checks.get("noFalsePositives")
        
        if all_questions_routed is not True:
            print_result("TEST 1", False, f"checks.allQuestionsRouted is {all_questions_routed}, expected true")
            return False
        
        if no_false_positives is not True:
            print_result("TEST 1", False, f"checks.noFalsePositives is {no_false_positives}, expected true")
            return False
        
        print_result("TEST 1", True, "All routing checks passed: allQuestionsRouted=true, noFalsePositives=true")
        return True
        
    except requests.exceptions.Timeout:
        print_result("TEST 1", False, "Request timed out after 60 seconds")
        return False
    except Exception as e:
        print_result("TEST 1", False, f"Exception: {str(e)}")
        return False

def test_ai_support_ask(question, test_name):
    """
    TEST 2: AI actually answers (real OpenAI call)
    POST /api/dev/ai-support-ask with body {"question": "..."}
    Expect HTTP 200 and "pass": true with checks gotAnswer:true, citesOverageRate:true, 
    mentionsInboundOrOverage:true, and escalate:false, error:null
    """
    print_section(f"{test_name}: AI Support Ask - '{question[:50]}...'")
    
    url = f"{BACKEND_URL}/api/dev/ai-support-ask"
    headers = {"Content-Type": "application/json"}
    body = {"question": question}
    
    print(f"\nEndpoint: POST {url}")
    print(f"Body: {json.dumps(body)}")
    print(f"\n⏳ Calling real OpenAI API... (may take up to ~45 seconds)")
    
    try:
        start_time = time.time()
        response = requests.post(url, json=body, headers=headers, timeout=60)
        elapsed = time.time() - start_time
        
        print(f"\n⏱️  Response time: {elapsed:.2f} seconds")
        print(f"HTTP Status: {response.status_code}")
        print(f"\nRaw Response:")
        print(json.dumps(response.json(), indent=2))
        
        if response.status_code != 200:
            print_result(test_name, False, f"Expected HTTP 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check top-level pass
        if not data.get("pass"):
            print_result(test_name, False, f"Top-level 'pass' is {data.get('pass')}, expected true")
            return False
        
        # Check nested checks
        checks = data.get("checks", {})
        got_answer = checks.get("gotAnswer")
        cites_overage_rate = checks.get("citesOverageRate")
        mentions_inbound_or_overage = checks.get("mentionsInboundOrOverage")
        escalate = data.get("escalate")
        error = data.get("error")
        
        failures = []
        
        if got_answer is not True:
            failures.append(f"checks.gotAnswer is {got_answer}, expected true")
        
        if cites_overage_rate is not True:
            failures.append(f"checks.citesOverageRate is {cites_overage_rate}, expected true")
        
        if mentions_inbound_or_overage is not True:
            failures.append(f"checks.mentionsInboundOrOverage is {mentions_inbound_or_overage}, expected true")
        
        if escalate is not False:
            failures.append(f"escalate is {escalate}, expected false")
        
        if error is not None:
            failures.append(f"error is {error}, expected null")
        
        if failures:
            print_result(test_name, False, "; ".join(failures))
            return False
        
        # Check response text mentions $0.15/min
        response_text = data.get("response", "")
        print(f"\n📝 AI Response excerpt: {response_text[:200]}...")
        
        print_result(test_name, True, "All checks passed: gotAnswer=true, citesOverageRate=true, mentionsInboundOrOverage=true, escalate=false, error=null")
        return True
        
    except requests.exceptions.Timeout:
        print_result(test_name, False, "Request timed out after 60 seconds")
        return False
    except Exception as e:
        print_result(test_name, False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("  AI SUPPORT 'NO ANSWER' FIX - BACKEND VERIFICATION")
    print("  Testing Node/Express backend proxied through FastAPI")
    print("="*80)
    print(f"\nBackend URL: {BACKEND_URL}")
    print(f"Environment: BOT_ENVIRONMENT=development (dev endpoints enabled)")
    
    results = []
    
    # TEST 1: Routing heuristic
    results.append(("TEST 1: Routing Heuristic", test_support_routing()))
    
    # TEST 2a: AI support ask - first question
    question1 = "What does a call cost after my free inbound minutes are used up?"
    results.append(("TEST 2a: AI Support Ask (Question 1)", test_ai_support_ask(question1, "TEST 2a")))
    
    # TEST 2b: AI support ask - second question
    question2 = "how much per minute after my plan minutes finish?"
    results.append(("TEST 2b: AI Support Ask (Question 2)", test_ai_support_ask(question2, "TEST 2b")))
    
    # Summary
    print_section("TEST SUMMARY")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed_count}/{total_count} tests passed")
    print(f"{'='*80}\n")
    
    if passed_count == total_count:
        print("🎉 ALL TESTS PASSED - AI support 'no answer' fix is working correctly!")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED - See details above")
        return 1

if __name__ == "__main__":
    sys.exit(main())
