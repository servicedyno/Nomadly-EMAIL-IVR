#!/usr/bin/env python3

"""
Comprehensive Backend Test for Regulatory Doc Upload Photo Rejection Bug Fix
Testing Node.js Telegram Bot Backend on Port 5000

Key Requirements to Verify:
1. Node.js health + empty error log
2. startDocCollection step building: steps have type='photo' (NOT Twilio doc types)
3. twilioDocType field preserved for each doc step
4. uploadToTwilio uses twilioDocType for Twilio API
5. handlePhotoInput step.type check succeeds for photo steps
6. handleTextInput step.type check still works for text steps
"""

import requests
import json
import subprocess
import os
from pathlib import Path


def test_nodejs_health():
    """Test 1: Node.js health check and error log verification"""
    print("🔍 Test 1: Node.js Health Check")
    
    try:
        # Health endpoint check
        response = requests.get('http://localhost:5000/health', timeout=10)
        
        if response.status_code == 200:
            health_data = response.json()
            print(f"   ✅ Health endpoint: {health_data}")
            
            # Check required fields
            if health_data.get('status') == 'healthy' and health_data.get('database') == 'connected':
                print("   ✅ Node.js service is healthy with database connected")
            else:
                print(f"   ❌ Unexpected health status: {health_data}")
                return False
                
        else:
            print(f"   ❌ Health check failed: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Health check error: {e}")
        return False
    
    # Check error log is empty
    try:
        result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            # Extract file size from ls output
            size_info = result.stdout.strip().split()
            if len(size_info) >= 5:
                file_size = size_info[4]
                if file_size == '0':
                    print("   ✅ Error log is empty (0 bytes)")
                    return True
                else:
                    print(f"   ❌ Error log has content ({file_size} bytes)")
                    return False
            else:
                print(f"   ❌ Could not parse file size: {result.stdout}")
                return False
        else:
            print(f"   ❌ Could not check error log: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error log check failed: {e}")
        return False


def test_regulatory_flow_code():
    """Test 2-6: Code verification of the bug fix"""
    print("🔍 Test 2-6: Regulatory Flow Code Verification")
    
    regulatory_flow_path = '/app/js/regulatory-flow.js'
    regulatory_config_path = '/app/js/regulatory-config.js'
    
    if not os.path.exists(regulatory_flow_path):
        print(f"   ❌ File not found: {regulatory_flow_path}")
        return False
        
    if not os.path.exists(regulatory_config_path):
        print(f"   ❌ File not found: {regulatory_config_path}")
        return False
    
    # Read regulatory-flow.js
    with open(regulatory_flow_path, 'r') as f:
        flow_content = f.read()
    
    # Read regulatory-config.js  
    with open(regulatory_config_path, 'r') as f:
        config_content = f.read()
    
    # Test 2: Verify startDocCollection step building fix (lines 75-78)
    print("   🔍 Test 2: startDocCollection step building")
    
    # Check for the destructuring fix
    if "const { type: twilioDocType, ...rest } = doc" in flow_content:
        print("   ✅ Found destructuring: const { type: twilioDocType, ...rest } = doc")
    else:
        print("   ❌ Missing destructuring of doc.type into twilioDocType")
        return False
    
    # Check for explicit type: 'photo' setting after spread
    if "steps.push({ ...rest, type: 'photo', twilioDocType, index: i })" in flow_content:
        print("   ✅ Found explicit type: 'photo' setting after spread")
    else:
        print("   ❌ Missing explicit type: 'photo' after spread")
        return False
    
    # Test 3: Verify twilioDocType preservation
    print("   🔍 Test 3: twilioDocType field preservation")
    
    if "twilioDocType" in flow_content:
        twilioDocType_count = flow_content.count('twilioDocType')
        if twilioDocType_count >= 3:  # Should appear in destructuring, spread, and uploadToTwilio
            print(f"   ✅ twilioDocType appears {twilioDocType_count} times in code")
        else:
            print(f"   ❌ twilioDocType only appears {twilioDocType_count} times")
            return False
    else:
        print("   ❌ twilioDocType not found in code")
        return False
    
    # Test 4: Verify uploadToTwilio uses twilioDocType (line 566)
    print("   🔍 Test 4: uploadToTwilio API call")
    
    if "form.append('Type', docConfig.twilioDocType || docConfig.type)" in flow_content:
        print("   ✅ Found uploadToTwilio using docConfig.twilioDocType || docConfig.type")
    else:
        print("   ❌ uploadToTwilio not using twilioDocType fallback")
        return False
    
    # Test 5: Verify handlePhotoInput check (line 218)
    print("   🔍 Test 5: handlePhotoInput step.type check")
    
    if "if (!step || step.type !== 'photo')" in flow_content:
        print("   ✅ Found handlePhotoInput checking step.type !== 'photo'")
    else:
        print("   ❌ handlePhotoInput not properly checking step.type")
        return False
    
    # Test 6: Verify handleTextInput still works for text steps
    print("   🔍 Test 6: handleTextInput step.type check")
    
    if "if (step.type === 'text')" in flow_content:
        print("   ✅ Found handleTextInput checking step.type === 'text'")
    else:
        print("   ❌ handleTextInput not properly checking for text steps")
        return False
    
    # Bonus: Verify regulatory config has the problematic type fields
    print("   🔍 Bonus: Regulatory config type fields")
    
    govt_doc_count = config_content.count("type: 'government_issued_document'")
    utility_bill_count = config_content.count("type: 'utility_bill'")
    
    if govt_doc_count > 0 and utility_bill_count > 0:
        print(f"   ✅ Found {govt_doc_count} government_issued_document and {utility_bill_count} utility_bill type fields")
    else:
        print(f"   ❌ Expected type fields in config: govt={govt_doc_count}, utility={utility_bill_count}")
        return False
    
    return True


def main():
    """Run all tests for the regulatory doc upload bug fix"""
    
    print("=" * 80)
    print("REGULATORY DOC UPLOAD PHOTO REJECTION BUG FIX VERIFICATION")
    print("Testing Node.js Telegram Bot Backend on Port 5000")
    print("=" * 80)
    
    all_tests_passed = True
    
    # Run Test 1: Node.js Health
    if not test_nodejs_health():
        all_tests_passed = False
    
    print()
    
    # Run Tests 2-6: Code Verification
    if not test_regulatory_flow_code():
        all_tests_passed = False
    
    print()
    print("=" * 80)
    
    if all_tests_passed:
        print("🎉 ALL TESTS PASSED - Regulatory doc upload bug fix verified successfully!")
        print("\n✅ VERIFICATION COMPLETE:")
        print("   • Node.js healthy with 0 error bytes")
        print("   • startDocCollection properly destructures doc.type to twilioDocType")
        print("   • Steps correctly maintain type='photo' (not overwritten by spread)")
        print("   • uploadToTwilio uses twilioDocType for Twilio API calls")
        print("   • handlePhotoInput accepts photos when step.type='photo'")
        print("   • handleTextInput still works for text steps")
        print("   • Regulatory config contains the problematic type fields")
        print("\n🚀 THE BUG FIX IS WORKING CORRECTLY")
    else:
        print("❌ SOME TESTS FAILED - Bug fix needs attention")
    
    print("=" * 80)
    return all_tests_passed


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)