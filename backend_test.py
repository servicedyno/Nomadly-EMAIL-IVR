#!/usr/bin/env python3
"""
Backend Test for Shipping Label Feature
Tests the Nomadly Telegram Bot backend (Node.js on port 5000)
"""

import requests
import json
import sys

# Backend URL
BACKEND_URL = "http://localhost:5000"

def test_nodejs_health():
    """Test Node.js health endpoint"""
    print("=== Testing Node.js Health ===")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print("✅ Node.js health check PASSED")
                return True
            else:
                print(f"❌ Node.js health check FAILED: Status is {data.get('status', 'unknown')}")
                return False
        else:
            print(f"❌ Node.js health check FAILED: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Node.js health check FAILED: {str(e)}")
        return False

def read_file_content(filepath):
    """Read file content safely"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"❌ Error reading file {filepath}: {str(e)}")
        return None

def test_language_files():
    """Test all language files for shippingLabel constants"""
    print("\n=== Testing Language Files ===")
    
    expected_constants = {
        'en.js': '📦 Shipping Label',
        'fr.js': '📦 Étiquette d\\\'expédition', 
        'zh.js': '📦 运输标签',
        'hi.js': '📦 शिपिंग लेबल'
    }
    
    all_passed = True
    
    for lang_file, expected_text in expected_constants.items():
        filepath = f"/app/js/lang/{lang_file}"
        content = read_file_content(filepath)
        
        if content is None:
            all_passed = False
            continue
            
        # Check if shippingLabel constant exists with correct text
        if f"shippingLabel: '{expected_text}'" in content:
            print(f"✅ {lang_file}: shippingLabel constant found with correct text")
        else:
            print(f"❌ {lang_file}: shippingLabel constant NOT found or incorrect text")
            all_passed = False
            continue
            
        # Check if userKeyboard contains the shippingLabel and virtualCard row
        if '[user.shippingLabel, user.virtualCard]' in content:
            print(f"✅ {lang_file}: userKeyboard contains [user.shippingLabel, user.virtualCard] row")
        else:
            print(f"❌ {lang_file}: userKeyboard does NOT contain [user.shippingLabel, user.virtualCard] row")
            all_passed = False
    
    return all_passed

def test_index_handler():
    """Test _index.js handler for shipping label"""
    print("\n=== Testing _index.js Handler ===")
    
    filepath = "/app/js/_index.js"
    content = read_file_content(filepath)
    
    if content is None:
        return False
    
    all_passed = True
    
    # Test 1: Check if handler exists and matches all 4 language strings
    expected_strings = [
        '📦 Shipping Label',
        '📦 Étiquette d\\\'expédition',
        '📦 运输标签', 
        '📦 शिपिंग लेबल'
    ]
    
    handler_found = False
    for expected_str in expected_strings:
        if expected_str in content:
            handler_found = True
        else:
            print(f"❌ Handler does NOT match string: {expected_str}")
            all_passed = False
    
    if handler_found and all_passed:
        print("✅ Handler exists and matches all 4 language strings")
    
    # Test 2: Check if handler sends inline_keyboard with URL to https://bozzmail.com
    if 'url: \'https://bozzmail.com\'' in content:
        print("✅ Handler sends inline_keyboard with URL 'https://bozzmail.com'")
    else:
        print("❌ Handler does NOT send correct URL to https://bozzmail.com")
        all_passed = False
    
    # Test 3: Check if button text is correct
    if "'📦 Open Shipping Label'" in content:
        print("✅ Button text is '📦 Open Shipping Label'")
    else:
        print("❌ Button text is NOT '📦 Open Shipping Label'")
        all_passed = False
    
    # Test 4: Check if handler condition includes all required strings
    handler_condition_line = None
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'message === user.shippingLabel' in line and all(s in line for s in expected_strings):
            handler_condition_line = line.strip()
            break
    
    if handler_condition_line:
        print("✅ Handler condition matches all 4 language variants correctly")
    else:
        print("❌ Handler condition does NOT match all 4 language variants")
        all_passed = False
    
    return all_passed

def test_error_logs():
    """Check Node.js error logs"""
    print("\n=== Checking Node.js Error Logs ===")
    
    try:
        with open('/var/log/supervisor/nodejs.err.log', 'r') as f:
            log_content = f.read().strip()
            
        if not log_content:
            print("✅ Node.js error log is empty")
            return True
        else:
            print(f"❌ Node.js error log contains errors:\n{log_content}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking Node.js logs: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing Shipping Label Implementation\n")
    
    test_results = []
    
    # Run all tests
    test_results.append(('Node.js Health', test_nodejs_health()))
    test_results.append(('Error Logs Check', test_error_logs()))
    test_results.append(('Language Files', test_language_files()))
    test_results.append(('Index Handler', test_index_handler()))
    
    # Print summary
    print("\n" + "="*50)
    print("🎯 TEST SUMMARY")
    print("="*50)
    
    passed_count = 0
    total_count = len(test_results)
    
    for test_name, passed in test_results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
        if passed:
            passed_count += 1
    
    print(f"\nOverall: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("🎉 All tests PASSED! Shipping Label feature is working correctly.")
        return 0
    else:
        print("⚠️ Some tests FAILED. Please check the implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main())