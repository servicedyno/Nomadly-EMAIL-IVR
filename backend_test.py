#!/usr/bin/env python3
"""
Backend test for AI Support comprehensive navigation knowledge verification
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
        
        print(f"✅ Health check passed: {data}")
        
        # Check error log is empty
        error_log_path = Path("/var/log/supervisor/nodejs.err.log")
        if error_log_path.exists():
            size = error_log_path.stat().st_size
            if size > 0:
                return False, f"Error log is not empty ({size} bytes)"
            print(f"✅ Error log is empty")
        
        return True, "Node.js service healthy"
        
    except Exception as e:
        return False, f"Health check failed: {str(e)}"

def read_ai_support_file():
    """Read the ai-support.js file content"""
    try:
        with open(AI_SUPPORT_FILE, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return None

def test_system_prompt_navigation_knowledge(content):
    """Test 2: SYSTEM_PROMPT contains complete navigation knowledge"""
    print("🔍 Testing SYSTEM_PROMPT navigation knowledge...")
    
    # Extract SYSTEM_PROMPT content
    prompt_match = re.search(r'const SYSTEM_PROMPT = `(.+?)`', content, re.DOTALL)
    if not prompt_match:
        return False, "SYSTEM_PROMPT not found in file"
    
    system_prompt = prompt_match.group(1)
    
    # Test Main Menu Layout
    required_main_menu_buttons = [
        '📞 Cloud IVR + SIP', '🧪 Test SIP Free', '🛒 Digital Products', 
        '💳 Virtual Card', '🌐 Register Domain', '🔗 URL Shortener',
        '🎯 Buy Phone Leads', '✅ Validate Numbers', '🛡️🔥 Anti-Red Hosting',
        '👛 My Wallet', '📋 My Subscriptions', '🌍 Settings', 
        '💬 Get Support', '💼 Become A Reseller'
    ]
    
    missing_buttons = []
    for button in required_main_menu_buttons:
        if button not in system_prompt:
            missing_buttons.append(button)
    
    if missing_buttons:
        return False, f"Missing main menu buttons: {missing_buttons}"
    
    # Test Cloud IVR hub buttons
    required_cloud_ivr_buttons = [
        '📢 Quick IVR Call', '📞 Bulk IVR Campaign', '🎵 Audio Library',
        '🛒 Choose a Cloud IVR Plan', '📱 My Numbers', '📖 SIP Setup Guide',
        '📊 Usage & Billing'
    ]
    
    missing_ivr_buttons = []
    for button in required_cloud_ivr_buttons:
        if button not in system_prompt:
            missing_ivr_buttons.append(button)
    
    if missing_ivr_buttons:
        return False, f"Missing Cloud IVR hub buttons: {missing_ivr_buttons}"
    
    # Test number management menu
    required_number_mgmt_buttons = [
        '📞 Call Forwarding', '📩 SMS Settings', '📨 SMS Inbox',
        '🎙️ Voicemail', '🔑 SIP Credentials', '🔴 Call Recording',
        '🤖 IVR / Auto-attendant', '📊 Call & SMS Logs',
        '🔄 Renew / Change Plan', '🗑️ Delete Number'
    ]
    
    missing_mgmt_buttons = []
    for button in required_number_mgmt_buttons:
        if button not in system_prompt:
            missing_mgmt_buttons.append(button)
    
    if missing_mgmt_buttons:
        return False, f"Missing number management buttons: {missing_mgmt_buttons}"
    
    # Test SIP Credentials sub-options
    sip_sub_options = ['👁️ Reveal Password', '🔄 Reset Password', '📖 SIP Setup Guide']
    missing_sip_options = []
    for option in sip_sub_options:
        if option not in system_prompt:
            missing_sip_options.append(option)
    
    if missing_sip_options:
        return False, f"Missing SIP credentials sub-options: {missing_sip_options}"
    
    print(f"✅ All required navigation buttons found in SYSTEM_PROMPT")
    return True, "SYSTEM_PROMPT contains complete navigation knowledge"

def test_sip_credentials_navigation_path(content):
    """Test 3: SIP Credentials navigation path exists"""
    print("🔍 Testing SIP Credentials navigation path...")
    
    prompt_match = re.search(r'const SYSTEM_PROMPT = `(.+?)`', content, re.DOTALL)
    if not prompt_match:
        return False, "SYSTEM_PROMPT not found"
    
    system_prompt = prompt_match.group(1)
    
    # Check navigation path
    path_components = [
        "📞 Cloud IVR + SIP → 📱 My Numbers → Select your number → 🔑 SIP Credentials",
        "👁️ Reveal Password", "🔄 Reset Password"
    ]
    
    missing_components = []
    for component in path_components:
        if component not in system_prompt:
            missing_components.append(component)
    
    if missing_components:
        return False, f"Missing SIP navigation components: {missing_components}"
    
    # Check SIP domain info
    sip_info_items = ['sip.speechcue.com', '5060', '5061', 'Pro', 'Business']
    missing_info = []
    for item in sip_info_items:
        if item not in system_prompt:
            missing_info.append(item)
    
    if missing_info:
        return False, f"Missing SIP domain info: {missing_info}"
    
    # Check browser calling URL reference
    if 'CALL_PAGE_URL' not in content or 'speechcue.com/call' not in system_prompt:
        return False, "Browser calling URL reference not found"
    
    print(f"✅ SIP Credentials navigation path complete")
    return True, "SIP Credentials navigation path exists with all required info"

def test_feature_by_plan_table(content):
    """Test 4: Feature-by-plan table exists"""
    print("🔍 Testing feature-by-plan table...")
    
    prompt_match = re.search(r'const SYSTEM_PROMPT = `(.+?)`', content, re.DOTALL)
    if not prompt_match:
        return False, "SYSTEM_PROMPT not found"
    
    system_prompt = prompt_match.group(1)
    
    # Check for feature availability table
    required_features = [
        'SIP Credentials', 'Call Recording', 'IVR Auto-attendant', 'Voicemail'
    ]
    
    required_plans = ['Starter', 'Pro', 'Business']
    
    missing_features = []
    for feature in required_features:
        if feature not in system_prompt:
            missing_features.append(feature)
    
    if missing_features:
        return False, f"Missing features in table: {missing_features}"
    
    missing_plans = []
    for plan in required_plans:
        if plan not in system_prompt:
            missing_plans.append(plan)
    
    if missing_plans:
        return False, f"Missing plans in table: {missing_plans}"
    
    # Check specific feature-plan combinations
    specific_checks = [
        ('SIP Credentials', '❌ Starter', '✅ Pro', '✅ Business'),
        ('Call Recording', '❌ Starter', '❌ Pro', '✅ Business'),
        ('IVR Auto-attendant', '❌ Starter', '❌ Pro', '✅ Business'),
        ('Voicemail', '❌ Starter', '✅ Pro', '✅ Business')
    ]
    
    for feature, starter, pro, business in specific_checks:
        # Look for the feature line in the table
        feature_line = None
        for line in system_prompt.split('\n'):
            if feature in line and '|' in line:
                feature_line = line
                break
        
        if not feature_line:
            return False, f"Feature table line not found for {feature}"
        
        # Check the checkmarks/crosses for this feature
        if starter.split(' ')[0] not in feature_line or pro.split(' ')[0] not in feature_line or business.split(' ')[0] not in feature_line:
            return False, f"Incorrect feature availability for {feature}: {feature_line}"
    
    print(f"✅ Feature-by-plan table complete with correct entries")
    return True, "Feature-by-plan table exists with all required entries"

def test_faq_scenarios_navigation(content):
    """Test 5: FAQ scenarios contain step-by-step navigation"""
    print("🔍 Testing FAQ scenarios with navigation...")
    
    prompt_match = re.search(r'const SYSTEM_PROMPT = `(.+?)`', content, re.DOTALL)
    if not prompt_match:
        return False, "SYSTEM_PROMPT not found"
    
    system_prompt = prompt_match.group(1)
    
    # Required FAQ scenarios with navigation paths
    required_faqs = [
        ("Where can I generate/find my SIP credentials?", "📞 Cloud IVR + SIP"),
        ("How do I deposit money?", "👛 My Wallet"),
        ("How do I set up call forwarding?", "📞 Call Forwarding"),
        ("How do I set up voicemail?", "🎙️ Voicemail"),
        ("How do I manage DNS records?", "🌐 Register Domain"),
        ("How do I change language?", "🌍 Settings"),
        ("How do I shorten a link?", "🔗 URL Shortener")
    ]
    
    missing_faqs = []
    for question, expected_path in required_faqs:
        # Check if the question exists
        if question not in system_prompt:
            missing_faqs.append(f"Question: {question}")
            continue
        
        # Find the answer section for this question
        question_idx = system_prompt.find(question)
        next_question_idx = system_prompt.find("### \"", question_idx + 1)
        if next_question_idx == -1:
            next_question_idx = len(system_prompt)
        
        answer_section = system_prompt[question_idx:next_question_idx]
        
        # Check if the expected path is in the answer
        if expected_path not in answer_section:
            missing_faqs.append(f"Path for {question}: missing {expected_path}")
    
    if missing_faqs:
        return False, f"Missing FAQ scenarios or paths: {missing_faqs}"
    
    print(f"✅ All required FAQ scenarios with navigation paths found")
    return True, "FAQ scenarios contain step-by-step navigation"

def test_environment_variables(content):
    """Test 6: Environment variables used in prompt"""
    print("🔍 Testing environment variables usage...")
    
    required_env_vars = [
        'SIP_DOMAIN', 'CALL_PAGE_URL', 'PHONE_STARTER_PRICE', 
        'PHONE_PRO_PRICE', 'PHONE_BUSINESS_PRICE'
    ]
    
    missing_vars = []
    for var in required_env_vars:
        if var not in content:
            missing_vars.append(var)
    
    if missing_vars:
        return False, f"Missing environment variables: {missing_vars}"
    
    # Check specific usage patterns
    sip_domain_usage = "process.env.SIP_DOMAIN || 'sip.speechcue.com'"
    call_page_usage = "process.env.CALL_PAGE_URL || 'https://speechcue.com/call'"
    
    if sip_domain_usage not in content:
        return False, "SIP_DOMAIN environment variable not properly used with default"
    
    if call_page_usage not in content:
        return False, "CALL_PAGE_URL environment variable not properly used with default"
    
    # Check pricing variables are used in the prompt
    prompt_match = re.search(r'const SYSTEM_PROMPT = `(.+?)`', content, re.DOTALL)
    if prompt_match:
        system_prompt = prompt_match.group(1)
        if '${process.env.PHONE_STARTER_PRICE' not in system_prompt:
            return False, "PHONE_STARTER_PRICE not used in SYSTEM_PROMPT"
        if '${process.env.PHONE_PRO_PRICE' not in system_prompt:
            return False, "PHONE_PRO_PRICE not used in SYSTEM_PROMPT"
        if '${process.env.PHONE_BUSINESS_PRICE' not in system_prompt:
            return False, "PHONE_BUSINESS_PRICE not used in SYSTEM_PROMPT"
    
    print(f"✅ All required environment variables found and properly used")
    return True, "Environment variables used correctly in prompt"

def test_getai_response_function(content):
    """Test 7: getAiResponse function works correctly"""
    print("🔍 Testing getAiResponse function...")
    
    # Check function signature
    function_match = re.search(r'async function getAiResponse\(([^)]+)\)', content)
    if not function_match:
        return False, "getAiResponse function not found"
    
    params = function_match.group(1)
    expected_params = ['chatId', 'userMessage', 'lang']
    
    for param in expected_params[:2]:  # chatId and userMessage are required
        if param not in params:
            return False, f"Missing required parameter: {param}"
    
    # Check for default lang parameter
    if 'lang = \'en\'' not in params:
        return False, "lang parameter missing default value of 'en'"
    
    # Check function builds messages array
    if 'messages = [' not in content:
        return False, "Function doesn't build messages array"
    
    # Check for SYSTEM_PROMPT usage
    if 'SYSTEM_PROMPT + langInstruction + userContext' not in content:
        return False, "Function doesn't use SYSTEM_PROMPT + langInstruction + userContext"
    
    # Check for language instruction logic
    if 'langInstruction' not in content or 'LANG_NAMES' not in content:
        return False, "Language instruction logic missing"
    
    # Check module exports
    export_match = re.search(r'module\.exports = \{([^}]+)\}', content)
    if not export_match:
        return False, "module.exports not found"
    
    exports = export_match.group(1)
    required_exports = ['getAiResponse', 'initAiSupport', 'clearHistory', 'needsEscalation', 'isAiEnabled']
    
    missing_exports = []
    for export in required_exports:
        if export not in exports:
            missing_exports.append(export)
    
    if missing_exports:
        return False, f"Missing exports: {missing_exports}"
    
    print(f"✅ getAiResponse function correctly implemented with proper signature and exports")
    return True, "getAiResponse function works correctly"

def run_all_tests():
    """Run all tests and return results"""
    print("🚀 Starting AI Support Navigation Knowledge Backend Testing...")
    print("=" * 80)
    
    tests = []
    
    # Test 1: Node.js Health
    success, message = test_nodejs_health()
    tests.append(("Node.js health check", success, message))
    
    # Read ai-support.js file for remaining tests
    content = read_ai_support_file()
    if not content:
        tests.append(("File read", False, "Could not read ai-support.js file"))
        return tests
    
    # Test 2: SYSTEM_PROMPT Navigation Knowledge
    success, message = test_system_prompt_navigation_knowledge(content)
    tests.append(("SYSTEM_PROMPT navigation knowledge", success, message))
    
    # Test 3: SIP Credentials Navigation Path
    success, message = test_sip_credentials_navigation_path(content)
    tests.append(("SIP Credentials navigation path", success, message))
    
    # Test 4: Feature-by-plan Table
    success, message = test_feature_by_plan_table(content)
    tests.append(("Feature-by-plan table", success, message))
    
    # Test 5: FAQ Scenarios Navigation
    success, message = test_faq_scenarios_navigation(content)
    tests.append(("FAQ scenarios navigation", success, message))
    
    # Test 6: Environment Variables
    success, message = test_environment_variables(content)
    tests.append(("Environment variables usage", success, message))
    
    # Test 7: getAiResponse Function
    success, message = test_getai_response_function(content)
    tests.append(("getAiResponse function", success, message))
    
    return tests

def main():
    """Main test execution"""
    tests = run_all_tests()
    
    print("\n" + "=" * 80)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for test_name, success, message in tests:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status:8} | {test_name:40} | {message}")
        if success:
            passed += 1
        else:
            failed += 1
    
    print("=" * 80)
    success_rate = (passed / len(tests)) * 100 if tests else 0
    print(f"📈 SUCCESS RATE: {success_rate:.1f}% ({passed}/{len(tests)} tests passed)")
    
    if failed > 0:
        print(f"❌ {failed} test(s) failed")
        sys.exit(1)
    else:
        print("🎉 All tests passed!")
        sys.exit(0)

if __name__ == "__main__":
    main()