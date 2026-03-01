#!/usr/bin/env python3
"""
Simplified Backend test for AI Support comprehensive navigation knowledge verification
Tests the Nomadly Telegram Bot Node.js backend running on port 5000
"""

import requests
import json
import sys
import re
from pathlib import Path

# Test configuration
BACKEND_URL = "http://localhost:5000"
HEALTH_ENDPOINT = f"{BACKEND_URL}/health"
AI_SUPPORT_FILE = "/app/js/ai-support.js"

def test_nodejs_health():
    """Test 1: Node.js health endpoint"""
    print("🔍 Testing Node.js health endpoint...")
    
    try:
        response = requests.get(HEALTH_ENDPOINT, timeout=10)
        
        if response.status_code != 200:
            return False, f"Health endpoint returned {response.status_code}, expected 200"
        
        data = response.json()
        if data.get('status') != 'healthy':
            return False, f"Status is {data.get('status')}, expected 'healthy'"
        
        if data.get('database') != 'connected':
            return False, f"Database is {data.get('database')}, expected 'connected'"
        
        # Check error log is empty
        error_log_path = Path("/var/log/supervisor/nodejs.err.log")
        if error_log_path.exists():
            size = error_log_path.stat().st_size
            if size > 0:
                return False, f"Error log is not empty ({size} bytes)"
        
        return True, "Node.js service healthy with empty error log"
        
    except Exception as e:
        return False, f"Health check failed: {str(e)}"

def test_system_prompt_comprehensive_content():
    """Test 2-7: Comprehensive SYSTEM_PROMPT content verification"""
    print("🔍 Testing SYSTEM_PROMPT comprehensive content...")
    
    try:
        with open(AI_SUPPORT_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return False, f"Could not read ai-support.js file: {str(e)}"
    
    # Extract SYSTEM_PROMPT content
    prompt_match = re.search(r'const SYSTEM_PROMPT = `(.+?)`', content, re.DOTALL)
    if not prompt_match:
        return False, "SYSTEM_PROMPT not found in file"
    
    system_prompt = prompt_match.group(1)
    
    # Test results storage
    test_results = []
    
    # Test 2: Main Menu Layout with all required buttons
    main_menu_items = [
        '📞 Cloud IVR + SIP', '🧪 Test SIP Free', '🛒 Digital Products', 
        '💳 Virtual Card', '🌐 Register Bulletproof Domain', '🔗 URL Shortener',
        '🎯 Buy Phone Leads', '✅ Validate Numbers', '🛡️🔥 Anti-Red Hosting',
        '👛 My Wallet', '📋 My Subscriptions', '🌍 Settings', 
        '💬 Get Support', '💼 Become A Reseller'
    ]
    
    missing_main = [item for item in main_menu_items if item not in system_prompt]
    test_results.append(("Main menu buttons", len(missing_main) == 0, f"Missing: {missing_main}" if missing_main else "All present"))
    
    # Test 2b: Cloud IVR hub buttons
    cloud_ivr_items = [
        '📢 Quick IVR Call', '📞 Bulk IVR Campaign', '🎵 Audio Library',
        '🛒 Choose a Cloud IVR Plan', '📱 My Numbers', '📖 SIP Setup Guide',
        '📊 Usage & Billing'
    ]
    
    missing_ivr = [item for item in cloud_ivr_items if item not in system_prompt]
    test_results.append(("Cloud IVR hub buttons", len(missing_ivr) == 0, f"Missing: {missing_ivr}" if missing_ivr else "All present"))
    
    # Test 2c: Number management buttons (just check key ones exist)
    mgmt_items = ['Call Forwarding', 'SMS Settings', 'SMS Inbox', 'Voicemail', 'SIP Credentials', 'Call Recording']
    missing_mgmt = [item for item in mgmt_items if item not in system_prompt]
    test_results.append(("Number management features", len(missing_mgmt) == 0, f"Missing: {missing_mgmt}" if missing_mgmt else "All present"))
    
    # Test 3: SIP Credentials navigation path
    sip_path_checks = [
        'My Numbers → Select your number → 🔑 SIP Credentials',
        'Reveal Password',
        'Reset Password',
        'sip.speechcue.com',
        '5060',
        '5061'
    ]
    missing_sip = [item for item in sip_path_checks if item not in system_prompt]
    test_results.append(("SIP Credentials navigation", len(missing_sip) == 0, f"Missing: {missing_sip}" if missing_sip else "Complete path with domain info"))
    
    # Test 4: Feature-by-plan table with specific entries
    plan_table_checks = [
        '| SIP Credentials | ❌ | ✅ | ✅ |',
        '| Call Recording | ❌ | ❌ | ✅ |',
        '| Voicemail | ❌ | ✅ | ✅ |'
    ]
    missing_table = [item for item in plan_table_checks if item not in system_prompt]
    test_results.append(("Feature-by-plan table", len(missing_table) == 0, f"Missing: {missing_table}" if missing_table else "All required entries present"))
    
    # Test 5: FAQ scenarios with navigation
    faq_checks = [
        'Where can I generate/find my SIP credentials?',
        'How do I deposit money?',
        'How do I set up call forwarding?', 
        'How do I set up voicemail?',
        'How do I manage DNS records?',
        'How do I change language',
        'How do I shorten a link?'
    ]
    missing_faq = [item for item in faq_checks if item not in system_prompt]
    test_results.append(("FAQ scenarios navigation", len(missing_faq) == 0, f"Missing: {missing_faq}" if missing_faq else "All key FAQ scenarios present"))
    
    # Test 6: Environment variables usage
    env_checks = ['SIP_DOMAIN', 'CALL_PAGE_URL', 'PHONE_STARTER_PRICE', 'PHONE_PRO_PRICE', 'PHONE_BUSINESS_PRICE']
    missing_env = [var for var in env_checks if var not in content]
    test_results.append(("Environment variables", len(missing_env) == 0, f"Missing: {missing_env}" if missing_env else "All required env vars present"))
    
    # Test 7: getAiResponse function
    function_checks = [
        'async function getAiResponse(chatId, userMessage, lang = \'en\')',
        'SYSTEM_PROMPT + langInstruction + userContext',
        'messages = [',
        'LANG_NAMES'
    ]
    missing_func = [item for item in function_checks if item not in content]
    
    # Check exports
    export_items = ['getAiResponse', 'initAiSupport', 'clearHistory', 'needsEscalation', 'isAiEnabled']
    exports_section = content[content.find('module.exports'):] if 'module.exports' in content else ''
    missing_exports = [item for item in export_items if item not in exports_section]
    
    function_ok = len(missing_func) == 0 and len(missing_exports) == 0
    func_msg = f"Missing function parts: {missing_func}, Missing exports: {missing_exports}" if not function_ok else "Function and exports correct"
    test_results.append(("getAiResponse function", function_ok, func_msg))
    
    # Calculate overall results
    passed = sum(1 for _, success, _ in test_results if success)
    total = len(test_results)
    
    # Print detailed results
    print(f"📊 Detailed Test Results:")
    for test_name, success, message in test_results:
        status = "✅" if success else "❌"
        print(f"  {status} {test_name}: {message}")
    
    if passed == total:
        return True, f"All {total} comprehensive tests passed - AI Support navigation knowledge complete"
    else:
        return False, f"Failed {total - passed}/{total} tests - see details above"

def main():
    """Main test execution"""
    print("🚀 Starting AI Support Navigation Knowledge Comprehensive Testing...")
    print("=" * 80)
    
    # Test 1: Node.js Health
    health_success, health_message = test_nodejs_health()
    
    # Test 2-7: Comprehensive SYSTEM_PROMPT verification  
    content_success, content_message = test_system_prompt_comprehensive_content()
    
    print("\n" + "=" * 80)
    print("📊 FINAL TEST RESULTS SUMMARY")
    print("=" * 80)
    
    results = [
        ("Node.js health check", health_success, health_message),
        ("AI Support navigation knowledge", content_success, content_message)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, success, message in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status:8} | {test_name:35} | {message}")
        if success:
            passed += 1
        else:
            failed += 1
    
    print("=" * 80)
    success_rate = (passed / len(results)) * 100 if results else 0
    print(f"📈 SUCCESS RATE: {success_rate:.1f}% ({passed}/{len(results)} major tests passed)")
    
    if failed > 0:
        print(f"❌ {failed} test(s) failed")
        sys.exit(1)
    else:
        print("🎉 All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()