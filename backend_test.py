#!/usr/bin/env python3
"""
Backend Test Suite for OTP Collection Feature and AI Support Knowledge Base
Tests the plan-gating of OTP Collection feature and AI Support knowledge base update.
Node.js Express backend on port 5000.
"""

import subprocess
import json
import requests
import sys
import os
import re
from pathlib import Path

# Test configuration
BACKEND_URL = "http://localhost:5000"
TEST_FILES = [
    "/app/js/_index.js",
    "/app/js/phone-config.js", 
    "/app/js/ai-support.js"
]

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, passed, details=""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed} passed, {self.failed} failed")
        print(f"{'='*60}")
        for result in self.results:
            status = "✅ PASS" if result["passed"] else "❌ FAIL"
            print(f"{status}: {result['test']}")
            if result["details"]:
                print(f"    {result['details']}")

def run_syntax_check(file_path):
    """Run Node.js syntax check on a file"""
    try:
        result = subprocess.run(
            ["node", "-c", file_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0, result.stderr
    except Exception as e:
        return False, str(e)

def check_health_endpoint():
    """Check if health endpoint returns healthy status"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get("status") == "healthy", data
        return False, f"HTTP {response.status_code}"
    except Exception as e:
        return False, str(e)

def check_error_log():
    """Check if error log is 0 bytes"""
    try:
        result = subprocess.run(
            ["stat", "-c", "%s", "/var/log/supervisor/nodejs.err.log"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            size = int(result.stdout.strip())
            return size == 0, f"Error log size: {size} bytes"
        return False, "Could not check error log"
    except Exception as e:
        return False, str(e)

def read_file_content(file_path):
    """Read file content safely"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return None

def test_plan_feature_access(content):
    """Test planFeatureAccess object in phone-config.js"""
    results = []
    
    # Check if planFeatureAccess exists
    if "planFeatureAccess" in content:
        results.append((True, "planFeatureAccess object found"))
        
        # Check otpCollection in all three plans
        starter_match = re.search(r'starter:\s*{[^}]*otpCollection:\s*(true|false)', content, re.DOTALL)
        pro_match = re.search(r'pro:\s*{[^}]*otpCollection:\s*(true|false)', content, re.DOTALL)
        business_match = re.search(r'business:\s*{[^}]*otpCollection:\s*(true|false)', content, re.DOTALL)
        
        if starter_match and starter_match.group(1) == "false":
            results.append((True, "starter.otpCollection = false"))
        else:
            results.append((False, "starter.otpCollection should be false"))
            
        if pro_match and pro_match.group(1) == "true":
            results.append((True, "pro.otpCollection = true"))
        else:
            results.append((False, "pro.otpCollection should be true"))
            
        if business_match and business_match.group(1) == "true":
            results.append((True, "business.otpCollection = true"))
        else:
            results.append((False, "business.otpCollection should be true"))
    else:
        results.append((False, "planFeatureAccess object not found"))
    
    return results

def test_can_access_feature_function(content):
    """Test canAccessFeature function"""
    results = []
    
    # Check if canAccessFeature function exists
    if "canAccessFeature" in content:
        results.append((True, "canAccessFeature function found"))
        
        # Test function logic (simulated)
        # The function should return planFeatureAccess[planKey]?.[feature] === true
        func_pattern = r'const canAccessFeature = \(planKey, feature\) => {[^}]*planFeatureAccess\[planKey\]\?\.\[feature\] === true'
        if re.search(func_pattern, content, re.DOTALL):
            results.append((True, "canAccessFeature function logic correct"))
        else:
            results.append((False, "canAccessFeature function logic may be incorrect"))
    else:
        results.append((False, "canAccessFeature function not found"))
    
    return results

def test_upgrade_message_function(content):
    """Test upgradeMessage function recognizes otpCollection"""
    results = []
    
    if "upgradeMessage" in content:
        results.append((True, "upgradeMessage function found"))
        
        # Check if otpCollection maps to 'Pro'
        otp_pattern = r'otpCollection[\'"]?\)\s*\?\s*[\'"]Pro[\'"]'
        if re.search(otp_pattern, content):
            results.append((True, "otpCollection maps to 'Pro' plan"))
        else:
            results.append((False, "otpCollection should map to 'Pro' plan"))
    else:
        results.append((False, "upgradeMessage function not found"))
    
    return results

def test_feature_names_i18n(content):
    """Test featureNamesI18n contains otpCollection in all 4 languages"""
    results = []
    
    if "featureNamesI18n" in content:
        results.append((True, "featureNamesI18n object found"))
        
        # Check for otpCollection in all 4 languages
        languages = ['en', 'fr', 'zh', 'hi']
        for lang in languages:
            pattern = rf'{lang}:\s*{{[^}}]*otpCollection:\s*[\'"][^\'\"]*[\'"]'
            if re.search(pattern, content, re.DOTALL):
                results.append((True, f"otpCollection found in {lang} language"))
            else:
                results.append((False, f"otpCollection missing in {lang} language"))
    else:
        results.append((False, "featureNamesI18n object not found"))
    
    return results

def test_ivr_ob_select_mode_handler(content):
    """Test ivrObSelectMode handler has plan check"""
    results = []
    
    # Look for ivrObSelectMode handler
    if "ivrObSelectMode" in content:
        results.append((True, "ivrObSelectMode handler found"))
        
        # Check for plan check with canAccessFeature
        plan_check_pattern = r'canAccessFeature\([^,]*,\s*[\'"]otpCollection[\'"]'
        if re.search(plan_check_pattern, content):
            results.append((True, "Plan check for otpCollection found"))
        else:
            results.append((False, "Plan check for otpCollection not found"))
            
        # Check for trial check
        trial_pattern = r'ivrObData\.isTrial'
        if re.search(trial_pattern, content):
            results.append((True, "Trial check found"))
        else:
            results.append((False, "Trial check not found"))
    else:
        results.append((False, "ivrObSelectMode handler not found"))
    
    return results

def test_caller_plan_storage(content):
    """Test callerPlan is stored when caller ID is selected"""
    results = []
    
    # Look for callerPlan storage near callerProvider
    caller_plan_pattern = r'callerPlan[\'"]?\s*[:=]'
    caller_provider_pattern = r'callerProvider[\'"]?\s*[:=]'
    
    if re.search(caller_plan_pattern, content) and re.search(caller_provider_pattern, content):
        results.append((True, "callerPlan storage found near callerProvider"))
    else:
        results.append((False, "callerPlan storage not found"))
    
    return results

def test_ai_support_feature_table(content):
    """Test AI Support knowledge base has OTP Collection feature table"""
    results = []
    
    # Look for feature table with OTP Collection
    otp_table_pattern = r'OTP Collection.*IVR.*❌.*✅.*✅'
    if re.search(otp_table_pattern, content, re.DOTALL):
        results.append((True, "OTP Collection feature table found with ❌ | ✅ | ✅"))
    else:
        results.append((False, "OTP Collection feature table not found or incorrect"))
    
    return results

def test_quick_ivr_setup_section(content):
    """Test Quick IVR setup section mentions both modes"""
    results = []
    
    # Look for Transfer Mode and OTP Collection Mode
    transfer_pattern = r'🔗\s*Transfer Mode'
    otp_pattern = r'🔑\s*OTP Collection Mode'
    
    if re.search(transfer_pattern, content):
        results.append((True, "🔗 Transfer Mode mentioned"))
    else:
        results.append((False, "🔗 Transfer Mode not mentioned"))
        
    if re.search(otp_pattern, content):
        results.append((True, "🔑 OTP Collection Mode mentioned"))
    else:
        results.append((False, "🔑 OTP Collection Mode not mentioned"))
    
    return results

def test_otp_collection_flow_documentation(content):
    """Test detailed OTP Collection flow documentation exists"""
    results = []
    
    # Check for key elements of OTP flow
    elements = [
        ('active key', r'active key'),
        ('verification code', r'verification code'),
        ('hold music', r'hold music'),
        ('Confirm/Reject buttons', r'Confirm.*Reject|✅.*❌'),
        ('3 attempts', r'3 attempts'),
        ('90 seconds timeout', r'90.*second.*timeout|timeout.*90.*second')
    ]
    
    for element_name, pattern in elements:
        if re.search(pattern, content, re.IGNORECASE):
            results.append((True, f"{element_name} mentioned in documentation"))
        else:
            results.append((False, f"{element_name} missing from documentation"))
    
    return results

def test_ai_support_faqs(content):
    """Test AI Support FAQs exist"""
    results = []
    
    faqs = [
        "How do I use OTP Collection?",
        "What is OTP Collection mode?", 
        "Can I collect a verification code during an IVR call?",
        "OTP Collection is locked",
        "What happens if I don't confirm/reject the OTP in time?"
    ]
    
    for faq in faqs:
        # Look for FAQ question (case insensitive, flexible matching)
        pattern = re.escape(faq).replace(r'\ ', r'\s*')
        if re.search(pattern, content, re.IGNORECASE):
            results.append((True, f"FAQ found: {faq}"))
        else:
            results.append((False, f"FAQ missing: {faq}"))
    
    return results

def main():
    """Main test execution"""
    print("🧪 Starting Backend Test Suite for OTP Collection & AI Support")
    print("=" * 60)
    
    test_results = TestResults()
    
    # 1. Syntax checks
    print("\n1. SYNTAX VALIDATION")
    for file_path in TEST_FILES:
        passed, details = run_syntax_check(file_path)
        test_results.add_result(f"Syntax check: {os.path.basename(file_path)}", passed, details)
        print(f"   {'✅' if passed else '❌'} {os.path.basename(file_path)}: {details if not passed else 'OK'}")
    
    # 2. Health endpoint check
    print("\n2. HEALTH ENDPOINT")
    passed, details = check_health_endpoint()
    test_results.add_result("Health endpoint", passed, str(details))
    print(f"   {'✅' if passed else '❌'} Health check: {details}")
    
    # 3. Error log check
    print("\n3. ERROR LOG CHECK")
    passed, details = check_error_log()
    test_results.add_result("Error log check", passed, details)
    print(f"   {'✅' if passed else '❌'} Error log: {details}")
    
    # 4. Plan gating verification (phone-config.js)
    print("\n4. PLAN GATING VERIFICATION (phone-config.js)")
    phone_config_content = read_file_content("/app/js/phone-config.js")
    if phone_config_content:
        # Test planFeatureAccess
        results = test_plan_feature_access(phone_config_content)
        for passed, details in results:
            test_results.add_result(f"planFeatureAccess: {details}", passed)
            print(f"   {'✅' if passed else '❌'} {details}")
        
        # Test canAccessFeature function
        results = test_can_access_feature_function(phone_config_content)
        for passed, details in results:
            test_results.add_result(f"canAccessFeature: {details}", passed)
            print(f"   {'✅' if passed else '❌'} {details}")
        
        # Test upgradeMessage function
        results = test_upgrade_message_function(phone_config_content)
        for passed, details in results:
            test_results.add_result(f"upgradeMessage: {details}", passed)
            print(f"   {'✅' if passed else '❌'} {details}")
        
        # Test featureNamesI18n
        results = test_feature_names_i18n(phone_config_content)
        for passed, details in results:
            test_results.add_result(f"featureNamesI18n: {details}", passed)
            print(f"   {'✅' if passed else '❌'} {details}")
    else:
        test_results.add_result("phone-config.js file read", False, "Could not read file")
        print("   ❌ Could not read phone-config.js")
    
    # 5. Bot flow gating verification (_index.js)
    print("\n5. BOT FLOW GATING VERIFICATION (_index.js)")
    index_content = read_file_content("/app/js/_index.js")
    if index_content:
        # Test ivrObSelectMode handler
        results = test_ivr_ob_select_mode_handler(index_content)
        for passed, details in results:
            test_results.add_result(f"ivrObSelectMode: {details}", passed)
            print(f"   {'✅' if passed else '❌'} {details}")
        
        # Test callerPlan storage
        results = test_caller_plan_storage(index_content)
        for passed, details in results:
            test_results.add_result(f"callerPlan storage: {details}", passed)
            print(f"   {'✅' if passed else '❌'} {details}")
    else:
        test_results.add_result("_index.js file read", False, "Could not read file")
        print("   ❌ Could not read _index.js")
    
    # 6. AI Support knowledge base verification (ai-support.js)
    print("\n6. AI SUPPORT KNOWLEDGE BASE VERIFICATION (ai-support.js)")
    ai_support_content = read_file_content("/app/js/ai-support.js")
    if ai_support_content:
        # Test feature table
        results = test_ai_support_feature_table(ai_support_content)
        for passed, details in results:
            test_results.add_result(f"Feature table: {details}", passed)
            print(f"   {'✅' if passed else '❌'} {details}")
        
        # Test Quick IVR setup section
        results = test_quick_ivr_setup_section(ai_support_content)
        for passed, details in results:
            test_results.add_result(f"Quick IVR setup: {details}", passed)
            print(f"   {'✅' if passed else '❌'} {details}")
        
        # Test OTP Collection flow documentation
        results = test_otp_collection_flow_documentation(ai_support_content)
        for passed, details in results:
            test_results.add_result(f"OTP flow docs: {details}", passed)
            print(f"   {'✅' if passed else '❌'} {details}")
        
        # Test FAQs
        results = test_ai_support_faqs(ai_support_content)
        for passed, details in results:
            test_results.add_result(f"FAQ: {details}", passed)
            print(f"   {'✅' if passed else '❌'} {details}")
    else:
        test_results.add_result("ai-support.js file read", False, "Could not read file")
        print("   ❌ Could not read ai-support.js")
    
    # Print final summary
    test_results.print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if test_results.failed == 0 else 1)

if __name__ == "__main__":
    main()