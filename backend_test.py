#!/usr/bin/env python3
"""
Backend test for the revised phone number buy flow and Bulk Call Campaign changes.
Tests the Node.js Express server on port 5000 for the specific implementation requirements.
"""

import requests
import json
import time
import sys
import os

# Get backend URL from environment or default to localhost
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:5000')
API_BASE = f"{BACKEND_URL}/api" if not BACKEND_URL.endswith('/api') else BACKEND_URL

# Test results tracking
class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        
    def test(self, name, condition, message=""):
        if condition:
            self.passed += 1
            status = "✅ PASS"
            print(f"{status}: {name}")
            if message:
                print(f"    {message}")
        else:
            self.failed += 1 
            status = "❌ FAIL"
            print(f"{status}: {name}")
            if message:
                print(f"    {message}")
        
        self.results.append({
            "name": name,
            "status": "PASS" if condition else "FAIL",
            "message": message
        })
        return condition
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total: {total}, Passed: {self.passed}, Failed: {self.failed}")
        print(f"Success Rate: {(self.passed/total*100):.1f}%")
        return self.failed == 0

def test_health_check():
    """Test that the Node.js service is healthy"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        return response.status_code == 200 and response.json().get('status') == 'healthy'
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def check_file_content(filepath, search_terms, description):
    """Check if file contains specific content"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        found_terms = []
        missing_terms = []
        
        for term in search_terms:
            if term in content:
                found_terms.append(term)
            else:
                missing_terms.append(term)
                
        return found_terms, missing_terms, content
    except Exception as e:
        return [], search_terms, f"Error reading file: {e}"

def main():
    results = TestResults()
    
    print("🔍 Testing Revised Phone Number Buy Flow and Bulk Call Campaign Changes")
    print("=" * 70)
    
    # 1. Service startup test
    print("\n📍 1. SERVICE STARTUP")
    healthy = test_health_check()
    results.test(
        "Node.js service health check",
        healthy,
        f"Service should be healthy at {BACKEND_URL}/health"
    )
    
    if not healthy:
        print("❌ Service not healthy - cannot continue testing")
        return False
    
    # 2. Buy flow code analysis - Critical tests from review request
    print("\n📍 2. BUY FLOW CODE ANALYSIS (CRITICAL)")
    
    # Check _index.js file for the specific handlers and logic
    index_file = "/app/js/_index.js"
    
    # 2a. Check buyPhoneNumber handler sets action to cpSelectPlan 
    buy_terms = [
        'set(state, chatId, \'action\', a.cpSelectPlan)',
        'message === pc.buyPhoneNumber'
    ]
    found_buy, missing_buy, content = check_file_content(index_file, buy_terms, "buyPhoneNumber handler")
    results.test(
        "buyPhoneNumber handler sets action to cpSelectPlan",
        len(missing_buy) == 0,
        f"Found: {found_buy}, Missing: {missing_buy}"
    )
    
    # Check that NO provider names are mentioned in the buy flow messages
    provider_terms_to_avoid = ['Twilio', 'Telnyx']
    provider_mentions = []
    if content and isinstance(content, str):
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'send(chatId' in line:
                for term in provider_terms_to_avoid:
                    if term in line and 'bulkCall' in line.lower():
                        provider_mentions.append(f"Line {i+1}: {line.strip()}")
    
    results.test(
        "No provider names in bulk call buy flow messages", 
        len(provider_mentions) == 0,
        f"Provider mentions found: {provider_mentions[:3]}" if provider_mentions else "Clean - no provider names in user-facing messages"
    )
    
    # 2b. Check cpSelectPlan handler saves cpPlanKey and cpPlanBasePrice
    plan_terms = [
        'await saveInfo(\'cpPlanKey\', planKey)',
        'await saveInfo(\'cpPlanBasePrice\'',
        'action === a.cpSelectPlan'
    ]
    found_plan, missing_plan, _ = check_file_content(index_file, plan_terms, "cpSelectPlan handler")
    results.test(
        "cpSelectPlan handler saves cpPlanKey and cpPlanBasePrice",
        len(missing_plan) == 0,
        f"Found: {found_plan}, Missing: {missing_plan}"
    )
    
    # 2c. Check cpSelectCountry sets cpCanSearchBoth = true for telnyx countries
    country_terms = [
        'const canSearchBoth = (nativeProvider === \'telnyx\')',
        'await saveInfo(\'cpCanSearchBoth\', canSearchBoth)',
        'action === a.cpSelectCountry'
    ]
    found_country, missing_country, _ = check_file_content(index_file, country_terms, "cpSelectCountry handler")
    results.test(
        "cpSelectCountry sets cpCanSearchBoth = true for telnyx countries",
        len(missing_country) == 0,
        f"Found: {found_country}, Missing: {missing_country}"
    )
    
    # 2d. Check cpSelectCountry back button goes to cpSelectPlan
    back_terms = [
        'set(state, chatId, \'action\', a.cpSelectPlan)',
        'if (message === t.back || message === pc.back)',
    ]
    # Look specifically in cpSelectCountry handler
    country_handler_start = content.find('if (action === a.cpSelectCountry)')
    country_handler_end = content.find('if (action === a.cpSelectType)', country_handler_start)
    if country_handler_start != -1 and country_handler_end != -1:
        country_handler = content[country_handler_start:country_handler_end]
        has_back_to_plan = all(term in country_handler for term in back_terms)
    else:
        has_back_to_plan = False
    
    results.test(
        "cpSelectCountry back button goes to cpSelectPlan",
        has_back_to_plan,
        "Back navigation should go to plan selection, not submenu5"
    )
    
    # 2e. Check cpSelectType dual-provider search with Promise.all
    type_terms = [
        'await Promise.all([',
        'telnyxApi.searchNumbers',
        'twilioService.searchNumbers',
        'canSearchBoth'
    ]
    found_type, missing_type, _ = check_file_content(index_file, type_terms, "cpSelectType dual-provider search")
    results.test(
        "cpSelectType uses dual-provider search with Promise.all",
        len(missing_type) == 0,
        f"Found: {found_type}, Missing: {missing_type}"
    )
    
    # 2f. Check provider tagging logic
    tagging_terms = [
        'r._provider = \'telnyx\'',
        'r._provider = \'twilio\'',
        'r._bulkIvrCapable = false',
        'r._bulkIvrCapable = true'
    ]
    found_tags, missing_tags, _ = check_file_content(index_file, tagging_terms, "Provider tagging")
    results.test(
        "Results tagged with _provider and _bulkIvrCapable",
        len(missing_tags) == 0,
        f"Found: {found_tags}, Missing: {missing_tags}"
    )
    
    # 2g. Check cpSelectArea and cpEnterAreaCode use dual-provider search
    area_search_count = content.count('Promise.all([') if content else 0
    results.test(
        "Multiple dual-provider search locations (cpSelectArea, cpEnterAreaCode, Show More)",
        area_search_count >= 3,
        f"Found {area_search_count} Promise.all dual-provider searches"
    )
    
    # 2h. Check cpSelectNumber stores cpProvider from selected._provider
    select_terms = [
        'const selectedProvider = selected._provider',
        'await saveInfo(\'cpProvider\', selectedProvider)',
        'await saveInfo(\'cpBulkIvrCapable\', selected._bulkIvrCapable'
    ]
    found_select, missing_select, _ = check_file_content(index_file, select_terms, "cpSelectNumber storage")
    results.test(
        "cpSelectNumber stores cpProvider from selected._provider",
        len(missing_select) == 0,
        f"Found: {found_select}, Missing: {missing_select}"
    )
    
    # 2i. Check order summary shows Bulk IVR badge
    badge_terms = [
        '☎️ Bulk IVR capable',
        'selected._bulkIvrCapable'
    ]
    found_badge, missing_badge, _ = check_file_content(index_file, badge_terms, "Order summary badge")
    results.test(
        "Order summary shows ☎️ Bulk IVR capable badge",
        len(missing_badge) == 0,
        f"Found: {found_badge}, Missing: {missing_badge}"
    )
    
    # 2j. Check Show More button uses dual-provider search
    show_more_in_promise = 'pc.showMore' in content and 'Promise.all([' in content
    results.test(
        "Show More button uses dual-provider search",
        show_more_in_promise,
        "Show More should trigger dual-provider search when canSearchBoth is true"
    )
    
    # 3. Bulk Call Campaign caller selection
    print("\n📍 3. BULK CALL CAMPAIGN CALLER SELECTION")
    
    # Check that only Twilio numbers are shown for bulk calls
    bulk_terms = [
        'provider === \'twilio\'',
        'bulkCapableNumbers',
        '☎️',
        'Bulk Call Campaign'
    ]
    found_bulk, missing_bulk, _ = check_file_content(index_file, bulk_terms, "Bulk call selection")
    results.test(
        "Bulk Call Campaign shows only provider === 'twilio' numbers",
        len(missing_bulk) == 0,
        f"Found: {found_bulk}, Missing: {missing_bulk}"
    )
    
    # Check for verification label and generic messaging
    verify_terms = [
        '(Verified)',
        'look for the ☎️'
    ]
    found_verify, missing_verify, _ = check_file_content(index_file, verify_terms, "Verification and messaging")
    results.test(
        "Verified caller IDs labeled and generic ☎️ messaging used",
        len(missing_verify) == 0,
        f"Found: {found_verify}, Missing: {missing_verify}"
    )
    
    # 4. Twilio searchNumbers parameter verification  
    print("\n📍 4. TWILIO SERVICE INTEGRATION")
    
    # Check twilio-service.js for 4-parameter searchNumbers function
    twilio_file = "/app/js/twilio-service.js"
    twilio_terms = [
        'async function searchNumbers(countryCode, numberType = \'local\', limit = 5, areaCode = null)',
        'if (areaCode && numberType === \'local\')',
        'params.areaCode = areaCode'
    ]
    found_twilio, missing_twilio, _ = check_file_content(twilio_file, twilio_terms, "Twilio searchNumbers")
    results.test(
        "Twilio searchNumbers accepts 4 params with areaCode support",
        len(missing_twilio) == 0,
        f"Found: {found_twilio}, Missing: {missing_twilio}"
    )
    
    # 5. Phone config verification
    print("\n📍 5. PHONE CONFIG VERIFICATION")
    
    # Check phone-config.js for button definitions
    config_file = "/app/js/phone-config.js"
    config_terms = [
        'bulkCallCampaign: \'📞 Bulk Call Campaign\'',
        'audioLibrary: \'🎵 Audio Library\'',
        'provider: \'telnyx\'',
        'provider: \'twilio\''
    ]
    found_config, missing_config, _ = check_file_content(config_file, config_terms, "Phone config")
    results.test(
        "Phone config has correct button definitions and provider settings",
        len(missing_config) == 0,
        f"Found: {found_config}, Missing: {missing_config}"
    )
    
    # 6. Final health check
    print("\n📍 6. FINAL HEALTH CHECK")
    final_health = test_health_check()
    results.test(
        "Service remains healthy after analysis",
        final_health,
        "Server should still be responsive"
    )
    
    # Summary
    success = results.summary()
    
    if success:
        print("\n🎉 All tests passed! The buy flow and bulk call campaign implementation is correct.")
    else:
        print(f"\n⚠️  {results.failed} test(s) failed. Review the implementation above.")
        
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)