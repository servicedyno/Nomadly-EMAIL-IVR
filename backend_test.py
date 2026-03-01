#!/usr/bin/env python3
"""
Final comprehensive backend test for AI Support navigation knowledge
Tests all 7 requirements from the review request
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

def run_comprehensive_test():
    """Run all tests comprehensively"""
    print("🚀 AI Support Navigation Knowledge - COMPREHENSIVE TESTING")
    print("=" * 80)
    
    results = []
    
    # Test 1: Node.js Health
    print("🔍 Test 1: Node.js Health Check")
    try:
        response = requests.get(HEALTH_ENDPOINT, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                # Check error log
                error_log = Path("/var/log/supervisor/nodejs.err.log")
                if error_log.exists() and error_log.stat().st_size == 0:
                    results.append(("Node.js health + empty error log", True, "Service healthy, database connected, no errors"))
                else:
                    results.append(("Node.js health", False, "Error log not empty"))
            else:
                results.append(("Node.js health", False, f"Status: {data}"))
        else:
            results.append(("Node.js health", False, f"HTTP {response.status_code}"))
    except Exception as e:
        results.append(("Node.js health", False, f"Request failed: {str(e)}"))
    
    # Read ai-support.js file
    print("🔍 Test 2-7: AI Support Content Analysis")
    try:
        with open(AI_SUPPORT_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        results.append(("File reading", False, f"Cannot read ai-support.js: {str(e)}"))
        return results
    
    # Extract SYSTEM_PROMPT (from line with const SYSTEM_PROMPT to line with const ESCALATION_KEYWORDS)
    lines = content.split('\n')
    start_idx = next((i for i, line in enumerate(lines) if 'const SYSTEM_PROMPT =' in line), None)
    end_idx = next((i for i, line in enumerate(lines) if i > (start_idx or 0) and line.strip().startswith('const ') and 'SYSTEM_PROMPT' not in line), None)
    
    if start_idx is None or end_idx is None:
        results.append(("SYSTEM_PROMPT extraction", False, "Could not extract SYSTEM_PROMPT"))
        return results
    
    system_prompt_section = '\n'.join(lines[start_idx:end_idx])
    
    # Test 2: SYSTEM_PROMPT Navigation Knowledge
    main_menu_items = [
        '📞 Cloud IVR + SIP', '🧪 Test SIP Free', '🛒 Digital Products', 
        '💳 Virtual Card', 'Register Bulletproof Domain', '🔗 URL Shortener',
        '🎯 Buy Phone Leads', '✅ Validate Numbers', 'Anti-Red Hosting',
        '👛 My Wallet', '📋 My Subscriptions', '🌍 Settings', 
        '💬 Get Support', '💼 Become A Reseller'
    ]
    
    cloud_ivr_items = [
        '📢 Quick IVR Call', '📞 Bulk IVR Campaign', '🎵 Audio Library',
        '🛒 Choose a Cloud IVR Plan', '📱 My Numbers', '📖 SIP Setup Guide',
        '📊 Usage & Billing'
    ]
    
    number_mgmt_items = [
        'Call Forwarding', 'SMS Settings', 'SMS Inbox', 'Voicemail', 
        'SIP Credentials', 'Call Recording', 'Auto-attendant', 'Call & SMS Logs'
    ]
    
    missing_main = [item for item in main_menu_items if item not in system_prompt_section]
    missing_ivr = [item for item in cloud_ivr_items if item not in system_prompt_section]  
    missing_mgmt = [item for item in number_mgmt_items if item not in system_prompt_section]
    
    nav_success = len(missing_main) == 0 and len(missing_ivr) == 0 and len(missing_mgmt) == 0
    nav_msg = f"Main:{len(missing_main)} missing, IVR:{len(missing_ivr)} missing, Mgmt:{len(missing_mgmt)} missing" if not nav_success else "All navigation elements present"
    results.append(("SYSTEM_PROMPT navigation knowledge", nav_success, nav_msg))
    
    # Test 3: SIP Credentials Navigation Path
    sip_checks = [
        'My Numbers → Select your number → 🔑 SIP Credentials',
        'Reveal Password', 'Reset Password', '${SIP_DOMAIN}', '5060', '5061',
        'Pro', 'Business'
    ]
    missing_sip = [item for item in sip_checks if item not in system_prompt_section]
    sip_success = len(missing_sip) == 0
    results.append(("SIP Credentials navigation path", sip_success, f"Missing: {missing_sip}" if missing_sip else "Complete with domain/ports/plans"))
    
    # Test 4: Feature-by-plan Table
    table_checks = [
        '| SIP Credentials |', '| Call Recording |', '| Voicemail |', 
        '| IVR Auto-attendant |', 'Starter', 'Pro', 'Business'
    ]
    missing_table = [item for item in table_checks if item not in system_prompt_section]
    table_success = len(missing_table) == 0
    results.append(("Feature-by-plan table", table_success, f"Missing: {missing_table}" if missing_table else "Table with required features present"))
    
    # Test 5: FAQ Scenarios Navigation
    faq_checks = [
        'Where can I generate/find my SIP credentials?',
        'How do I deposit money?', 'How do I set up call forwarding?',
        'How do I set up voicemail?', 'How do I manage DNS records?',
        'How do I change language', 'How do I shorten a link?'
    ]
    missing_faq = [item for item in faq_checks if item not in system_prompt_section]
    faq_success = len(missing_faq) == 0
    results.append(("FAQ scenarios navigation", faq_success, f"Missing: {missing_faq}" if missing_faq else "All key FAQ scenarios present"))
    
    # Test 6: Environment Variables  
    env_vars = ['SIP_DOMAIN', 'CALL_PAGE_URL', 'PHONE_STARTER_PRICE', 'PHONE_PRO_PRICE', 'PHONE_BUSINESS_PRICE']
    env_usage = [
        'process.env.SIP_DOMAIN', 'process.env.CALL_PAGE_URL',
        'process.env.PHONE_STARTER_PRICE', 'process.env.PHONE_PRO_PRICE', 
        'process.env.PHONE_BUSINESS_PRICE'
    ]
    missing_env = [var for var in env_usage if var not in content]
    env_success = len(missing_env) == 0
    results.append(("Environment variables usage", env_success, f"Missing: {missing_env}" if missing_env else "All env vars used with defaults"))
    
    # Test 7: getAiResponse Function
    func_checks = [
        'async function getAiResponse(chatId, userMessage, lang = \'en\')',
        'SYSTEM_PROMPT + langInstruction + userContext',
        'messages = [', 'LANG_NAMES'
    ]
    export_checks = ['getAiResponse', 'initAiSupport', 'clearHistory', 'needsEscalation', 'isAiEnabled']
    
    missing_func = [item for item in func_checks if item not in content]
    exports_section = content[content.find('module.exports'):] if 'module.exports' in content else ''
    missing_exports = [item for item in export_checks if item not in exports_section]
    
    func_success = len(missing_func) == 0 and len(missing_exports) == 0
    func_msg = f"Missing func parts: {missing_func}, exports: {missing_exports}" if not func_success else "Function signature and exports correct"
    results.append(("getAiResponse function", func_success, func_msg))
    
    return results

def main():
    """Main execution"""
    results = run_comprehensive_test()
    
    print("\n" + "=" * 80)  
    print("📊 COMPREHENSIVE TEST RESULTS")
    print("=" * 80)
    
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
    print(f"📈 SUCCESS RATE: {success_rate:.1f}% ({passed}/{len(results)} tests passed)")
    
    # Summary for agent
    if success_rate >= 85:
        print("🎉 EXCELLENT: AI Support navigation knowledge is comprehensive and production-ready!")
    elif success_rate >= 70:
        print("✅ GOOD: Most navigation knowledge implemented, minor issues to address")
    else:
        print("⚠️  NEEDS WORK: Several navigation knowledge gaps identified")
    
    if failed > 0:
        print(f"❌ {failed} test(s) failed - see details above")
        return 1
    else:
        print("🎉 All AI Support navigation knowledge requirements verified!")
        return 0

if __name__ == "__main__":
    sys.exit(main())