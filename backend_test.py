#!/usr/bin/env python3
"""
Backend Test Suite for Auto-fill Email and Resume Doc Sessions
Tests the Nomadly Telegram Bot Node.js backend for regulatory compliance features.
"""

import requests
import json
import sys
import os

def test_nodejs_health():
    """Test 1: Node.js health and error logs"""
    print("🔍 Testing Node.js backend health...")
    
    try:
        # Test health endpoint
        response = requests.get('http://localhost:5000/health', timeout=10)
        print(f"   ✅ Health endpoint: {response.status_code}")
        
        if response.status_code == 200:
            health_data = response.json()
            print(f"   ✅ Status: {health_data.get('status')}")
            print(f"   ✅ Database: {health_data.get('database')}")
            print(f"   ✅ Uptime: {health_data.get('uptime')}")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Health check error: {e}")
        return False
    
    # Check error logs
    try:
        with open('/var/log/supervisor/nodejs.err.log', 'r') as f:
            error_content = f.read().strip()
            if error_content:
                print(f"   ❌ Error log not empty: {len(error_content)} bytes")
                return False
            else:
                print("   ✅ Error log is empty (0 bytes)")
    except Exception as e:
        print(f"   ❌ Error reading log file: {e}")
        return False
        
    return True

def test_regulatory_config():
    """Test 2: Verify IE:local and GB:mobile configurations"""
    print("🔍 Testing regulatory configurations...")
    
    config_file = '/app/js/regulatory-config.js'
    try:
        with open(config_file, 'r') as f:
            content = f.read()
            
        # Find IE:local config section
        ie_local_start = content.find("'IE:local': {")
        if ie_local_start == -1:
            print("   ❌ IE:local configuration not found")
            return False
            
        # Find the end of IE:local config (look for next country config)
        ie_local_end = content.find("'AU:mobile':", ie_local_start)  # Next config after IE:local
        ie_local_config = content[ie_local_start:ie_local_end]
        
        # Verify IE:local has email in endUserFields
        if "'email'" in ie_local_config and "endUserFields:" in ie_local_config:
            print("   ✅ IE:local has 'email' in endUserFields")
        else:
            print("   ❌ IE:local missing 'email' in endUserFields")
            return False
            
        # Check textInputs only has NAME_INPUTS (no email key prompt)
        if ("textInputs: [\n      ...NAME_INPUTS,\n    ]" in ie_local_config or 
            "textInputs: [\n      ...NAME_INPUTS\n    ]" in ie_local_config):
            print("   ✅ IE:local textInputs contains only NAME_INPUTS (no email prompt)")
        else:
            print("   ❌ IE:local textInputs format incorrect")
            print(f"   Debug: Found textInputs section: {repr(ie_local_config[ie_local_config.find('textInputs:'):ie_local_config.find('docs:')])}")
            return False
            
        # Find GB:mobile config
        gb_mobile_start = content.find("'GB:mobile': {")
        if gb_mobile_start == -1:
            print("   ❌ GB:mobile configuration not found")
            return False
            
        gb_mobile_end = content.find("},", gb_mobile_start)
        gb_mobile_config = content[gb_mobile_start:gb_mobile_end]
        
        # Verify GB:mobile has email in endUserFields
        if "'email'" in gb_mobile_config and "endUserFields:" in gb_mobile_config:
            print("   ✅ GB:mobile has 'email' in endUserFields")
        else:
            print("   ❌ GB:mobile missing 'email' in endUserFields")
            return False
            
        # Check textInputs has NAME_INPUTS + phone_number (no email prompt)
        if "...NAME_INPUTS" in gb_mobile_config and "phone_number" in gb_mobile_config:
            if "{ key: 'email'" not in gb_mobile_config:
                print("   ✅ GB:mobile textInputs contains NAME_INPUTS + phone_number (no email prompt)")
            else:
                print("   ❌ GB:mobile textInputs incorrectly contains email prompt")
                return False
        else:
            print("   ❌ GB:mobile textInputs format incorrect")
            return False
            
        return True
        
    except Exception as e:
        print(f"   ❌ Error reading regulatory config: {e}")
        return False

def test_auto_fill_email():
    """Test 3: Verify auto-fill email functionality in regulatory-flow.js"""
    print("🔍 Testing auto-fill email functionality...")
    
    flow_file = '/app/js/regulatory-flow.js'
    try:
        with open(flow_file, 'r') as f:
            content = f.read()
            
        # Check for auto-fill email logic in createAndSubmitBundle
        auto_fill_section = content.find("// Auto-fill email with service email")
        if auto_fill_section == -1:
            print("   ❌ Auto-fill email comment not found")
            return False
            
        # Verify the auto-fill logic implementation
        expected_logic = "if (config.endUserFields.includes('email') && (!endUserAttrs.email || endUserAttrs.email === 'N/A')) {"
        if expected_logic in content:
            print("   ✅ Auto-fill email condition check found")
        else:
            print("   ❌ Auto-fill email condition check missing")
            return False
            
        # Check NOMADLY_SERVICE_EMAIL usage
        nomadly_email_usage = "endUserAttrs.email = process.env.NOMADLY_SERVICE_EMAIL || 'support@nomadly.com'"
        if nomadly_email_usage in content:
            print("   ✅ NOMADLY_SERVICE_EMAIL auto-fill implementation found")
        else:
            print("   ❌ NOMADLY_SERVICE_EMAIL auto-fill implementation missing")
            return False
            
        # Verify it's in createAndSubmitBundle function (around line 401)
        create_bundle_start = content.find("async function createAndSubmitBundle(")
        if create_bundle_start != -1 and auto_fill_section > create_bundle_start:
            print("   ✅ Auto-fill email is in createAndSubmitBundle function")
        else:
            print("   ❌ Auto-fill email not in correct function")
            return False
            
        return True
        
    except Exception as e:
        print(f"   ❌ Error reading regulatory flow: {e}")
        return False

def test_resume_functions():
    """Test 4: Verify resume mechanism functions exist and are exported"""
    print("🔍 Testing resume mechanism functions...")
    
    flow_file = '/app/js/regulatory-flow.js'
    try:
        with open(flow_file, 'r') as f:
            content = f.read()
            
        # Check for getIncompleteSession function
        if "async function getIncompleteSession(chatId)" in content:
            print("   ✅ getIncompleteSession function exists")
        else:
            print("   ❌ getIncompleteSession function missing")
            return False
            
        # Check for resumeSession function
        if "async function resumeSession(chatId)" in content:
            print("   ✅ resumeSession function exists")
        else:
            print("   ❌ resumeSession function missing")
            return False
            
        # Check for cancelAndRefund function
        if "async function cancelAndRefund(chatId)" in content:
            print("   ✅ cancelAndRefund function exists")
        else:
            print("   ❌ cancelAndRefund function missing")
            return False
            
        # Check module.exports
        exports_section = content[content.rfind("module.exports"):]
        required_exports = ["getIncompleteSession", "resumeSession", "cancelAndRefund"]
        
        for export_func in required_exports:
            if export_func in exports_section:
                print(f"   ✅ {export_func} is exported")
            else:
                print(f"   ❌ {export_func} not exported")
                return False
                
        return True
        
    except Exception as e:
        print(f"   ❌ Error reading regulatory flow: {e}")
        return False

def test_index_integration():
    """Test 5: Verify _index.js integration with cpResumeDoc action and submenu5"""
    print("🔍 Testing _index.js integration...")
    
    index_file = '/app/js/_index.js'
    try:
        with open(index_file, 'r') as f:
            content = f.read()
            
        # Check for cpResumeDoc action constant
        if "cpResumeDoc: 'cpResumeDoc'" in content:
            print("   ✅ cpResumeDoc action constant exists")
        else:
            print("   ❌ cpResumeDoc action constant missing")
            return False
            
        # Check submenu5 function calls getIncompleteSession
        submenu5_start = content.find("submenu5: async () => {")
        if submenu5_start == -1:
            print("   ❌ submenu5 function not found")
            return False
            
        submenu5_section = content[submenu5_start:submenu5_start + 2000]
        if "await regulatoryFlow.getIncompleteSession(chatId)" in submenu5_section:
            print("   ✅ submenu5 calls regulatoryFlow.getIncompleteSession")
        else:
            print("   ❌ submenu5 does not call getIncompleteSession")
            return False
            
        # Check for Resume/Cancel buttons in submenu5
        if "▶️ Resume Verification" in submenu5_section and "❌ Cancel & Refund" in submenu5_section:
            print("   ✅ submenu5 shows Resume/Cancel buttons when incomplete session found")
        else:
            print("   ❌ submenu5 missing Resume/Cancel buttons")
            return False
            
        # Check cpResumeDoc handler
        cpresume_handler = content.find("if (action === a.cpResumeDoc) {")
        if cpresume_handler == -1:
            print("   ❌ cpResumeDoc handler not found")
            return False
            
        handler_section = content[cpresume_handler:cpresume_handler + 1000]
        
        # Check for Resume button processing
        if "await regulatoryFlow.resumeSession(chatId)" in handler_section:
            print("   ✅ cpResumeDoc handler calls resumeSession")
        else:
            print("   ❌ cpResumeDoc handler missing resumeSession call")
            return False
            
        # Check for Cancel button processing  
        if "await regulatoryFlow.cancelAndRefund(chatId)" in handler_section:
            print("   ✅ cpResumeDoc handler calls cancelAndRefund")
        else:
            print("   ❌ cpResumeDoc handler missing cancelAndRefund call")
            return False
            
        return True
        
    except Exception as e:
        print(f"   ❌ Error reading _index.js: {e}")
        return False

def main():
    """Run all backend tests"""
    print("🚀 Starting Auto-fill Email + Resume Doc Sessions Backend Tests\n")
    
    tests = [
        ("Node.js Health Check", test_nodejs_health),
        ("Regulatory Config Verification", test_regulatory_config), 
        ("Auto-fill Email Functionality", test_auto_fill_email),
        ("Resume Functions", test_resume_functions),
        ("Index.js Integration", test_index_integration),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n{'='*60}")
        print(f"TEST: {test_name}")
        print(f"{'='*60}")
        
        try:
            if test_func():
                print(f"✅ PASSED: {test_name}")
                passed += 1
            else:
                print(f"❌ FAILED: {test_name}")
        except Exception as e:
            print(f"❌ ERROR: {test_name} - {e}")
    
    print(f"\n{'='*60}")
    print(f"SUMMARY: {passed}/{total} tests passed")
    print(f"{'='*60}")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! The auto-fill email and resume doc sessions features are working correctly.")
        return 0
    else:
        print("💥 Some tests failed. Please review the implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main())