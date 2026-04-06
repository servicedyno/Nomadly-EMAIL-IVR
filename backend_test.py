#!/usr/bin/env python3
"""
Backend Test Suite for BulkSMS Footer Implementation in Auto-Promo System
Tests the implementation as specified in the review request.
"""

import subprocess
import re
import json
import sys
import os

def run_command(cmd, cwd=None):
    """Run a shell command and return the result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def test_bulksms_footer_constant():
    """Test 1: Verify BULKSMS_FOOTER constant exists with correct structure"""
    print("🔍 Test 1: Checking BULKSMS_FOOTER constant...")
    
    try:
        with open('/app/js/auto-promo.js', 'r') as f:
            content = f.read()
        
        # Check if BULKSMS_FOOTER constant exists around line 223
        lines = content.split('\n')
        bulksms_footer_line = None
        for i, line in enumerate(lines):
            if 'const BULKSMS_FOOTER' in line:
                bulksms_footer_line = i + 1
                break
        
        if not bulksms_footer_line:
            return False, "BULKSMS_FOOTER constant not found"
        
        if abs(bulksms_footer_line - 223) > 5:
            return False, f"BULKSMS_FOOTER found at line {bulksms_footer_line}, expected around line 223"
        
        # Extract the BULKSMS_FOOTER object
        footer_start = content.find('const BULKSMS_FOOTER = {')
        if footer_start == -1:
            return False, "BULKSMS_FOOTER object structure not found"
        
        # Find the end of the object
        brace_count = 0
        footer_end = footer_start
        for i, char in enumerate(content[footer_start:]):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    footer_end = footer_start + i + 1
                    break
        
        footer_content = content[footer_start:footer_end]
        
        # Check for 4 languages
        languages = ['en:', 'fr:', 'zh:', 'hi:']
        for lang in languages:
            if lang not in footer_content:
                return False, f"Language {lang.rstrip(':')} not found in BULKSMS_FOOTER"
        
        # Count variations for each language (should be 3 each)
        for lang in ['en', 'fr', 'zh', 'hi']:
            lang_section_start = footer_content.find(f'{lang}: [')
            if lang_section_start == -1:
                return False, f"Language section for {lang} not found"
            
            # Count the number of string literals in this language section
            lang_section = footer_content[lang_section_start:]
            next_lang_start = len(lang_section)
            for other_lang in ['en', 'fr', 'zh', 'hi']:
                if other_lang != lang:
                    other_start = lang_section.find(f'{other_lang}: [')
                    if other_start != -1 and other_start < next_lang_start:
                        next_lang_start = other_start
            
            lang_section = lang_section[:next_lang_start]
            
            # Count backtick pairs (each variation is in backticks)
            variation_count = lang_section.count('`') // 2
            if variation_count != 3:
                return False, f"Language {lang} has {variation_count} variations, expected 3"
        
        return True, f"✅ BULKSMS_FOOTER constant found at line {bulksms_footer_line} with 4 languages × 3 variations each (12 total)"
        
    except Exception as e:
        return False, f"Error reading auto-promo.js: {str(e)}"

def test_get_bulksms_footer_function():
    """Test 2: Verify getBulkSmsFooter function exists and works correctly"""
    print("🔍 Test 2: Checking getBulkSmsFooter function...")
    
    try:
        with open('/app/js/auto-promo.js', 'r') as f:
            content = f.read()
        
        # Check if function exists around line 246
        lines = content.split('\n')
        function_line = None
        for i, line in enumerate(lines):
            if 'function getBulkSmsFooter' in line:
                function_line = i + 1
                break
        
        if not function_line:
            return False, "getBulkSmsFooter function not found"
        
        if abs(function_line - 246) > 5:
            return False, f"getBulkSmsFooter found at line {function_line}, expected around line 246"
        
        # Check function implementation
        func_start = content.find('function getBulkSmsFooter(lang) {')
        if func_start == -1:
            return False, "getBulkSmsFooter function signature not found"
        
        # Extract function body
        func_content = content[func_start:func_start + 200]  # Get reasonable chunk
        
        # Check for fallback to 'en'
        if 'BULKSMS_FOOTER[lang] || BULKSMS_FOOTER.en' not in func_content:
            return False, "Function doesn't have fallback to 'en' language"
        
        # Check for random selection
        if 'Math.floor(Math.random()' not in func_content:
            return False, "Function doesn't implement random selection"
        
        return True, f"✅ getBulkSmsFooter function found at line {function_line} with correct fallback and random selection"
        
    except Exception as e:
        return False, f"Error checking getBulkSmsFooter function: {str(e)}"

def test_sendpromo_footer_integration():
    """Test 3: Verify footer is appended in sendPromoToUser function"""
    print("🔍 Test 3: Checking footer integration in sendPromoToUser...")
    
    try:
        with open('/app/js/auto-promo.js', 'r') as f:
            content = f.read()
        
        # Find the sendPromoToUser function
        sendpromo_start = content.find('async function sendPromoToUser(')
        if sendpromo_start == -1:
            return False, "sendPromoToUser function not found"
        
        # Find the specific line that appends the footer
        footer_append_pattern = r"caption \+= '\\n\\n' \+ getBulkSmsFooter\(lang\)"
        if not re.search(footer_append_pattern, content):
            return False, "Footer append line not found in sendPromoToUser"
        
        # Check that it comes after coupon line
        coupon_line_pattern = r"if \(couponLine\) caption \+= '\\n\\n' \+ couponLine"
        footer_line_pattern = r"caption \+= '\\n\\n' \+ getBulkSmsFooter\(lang\)"
        
        coupon_match = re.search(coupon_line_pattern, content)
        footer_match = re.search(footer_line_pattern, content)
        
        if not coupon_match or not footer_match:
            return False, "Could not find both coupon and footer append lines"
        
        if footer_match.start() <= coupon_match.start():
            return False, "Footer append line should come AFTER coupon line"
        
        # Find line numbers
        lines_before_footer = content[:footer_match.start()].count('\n')
        footer_line_num = lines_before_footer + 1
        
        if abs(footer_line_num - 3310) > 10:
            return False, f"Footer append found at line {footer_line_num}, expected around line 3310"
        
        return True, f"✅ Footer append line found at line {footer_line_num}, correctly positioned after coupon line"
        
    except Exception as e:
        return False, f"Error checking sendPromoToUser integration: {str(e)}"

def test_module_loading():
    """Test 4: Verify module loads without errors"""
    print("🔍 Test 4: Testing module loading...")
    
    exit_code, stdout, stderr = run_command('node -e "require(\'./js/auto-promo.js\')"', cwd='/app')
    
    if exit_code != 0:
        return False, f"Module failed to load. Exit code: {exit_code}, Error: {stderr}"
    
    return True, "✅ Module loads without errors"

def test_nodejs_service_and_autopromo():
    """Test 5: Verify Node.js service is running and AutoPromo is initialized"""
    print("🔍 Test 5: Checking Node.js service and AutoPromo initialization...")
    
    # Check if Node.js service is running
    exit_code, stdout, stderr = run_command('sudo supervisorctl status nodejs')
    
    if exit_code != 0 or 'RUNNING' not in stdout:
        return False, f"Node.js service not running. Status: {stdout}"
    
    # Check AutoPromo logs
    exit_code, stdout, stderr = run_command('grep AutoPromo /var/log/supervisor/nodejs.out.log')
    
    if exit_code != 0:
        return False, "No AutoPromo logs found"
    
    # Count scheduled jobs
    scheduled_lines = [line for line in stdout.split('\n') if 'Scheduled' in line and ('morning' in line or 'evening' in line)]
    
    # Should have 8 jobs (4 languages × 2 times per day)
    if len(scheduled_lines) < 8:
        return False, f"Expected 8 scheduled jobs, found {len(scheduled_lines)}"
    
    # Check for initialization message
    if 'Initialized — 8 jobs' not in stdout:
        return False, "AutoPromo initialization message not found"
    
    return True, f"✅ Node.js service running, AutoPromo initialized with 8 scheduled jobs"

def test_footer_content_requirements():
    """Test 6: Verify each footer variation contains required elements"""
    print("🔍 Test 6: Checking footer content requirements...")
    
    try:
        with open('/app/js/auto-promo.js', 'r') as f:
            content = f.read()
        
        # Extract BULKSMS_FOOTER content
        footer_start = content.find('const BULKSMS_FOOTER = {')
        footer_end = content.find('}', footer_start)
        
        # Find the actual end of the object
        brace_count = 0
        for i, char in enumerate(content[footer_start:]):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    footer_end = footer_start + i + 1
                    break
        
        footer_content = content[footer_start:footer_end]
        
        # Required elements to check
        required_elements = [
            '━━━',  # separator line
            '<b>',  # HTML bold tags
            '📩',   # emoji
            '@onarrival1',  # mention
            '@Hostbay_support',  # mention
            '98%'   # percentage
        ]
        
        missing_elements = []
        for element in required_elements:
            if element not in footer_content:
                missing_elements.append(element)
        
        if missing_elements:
            return False, f"Missing required elements: {missing_elements}"
        
        # Check that each language has all required elements
        for lang in ['en', 'fr', 'zh', 'hi']:
            lang_start = footer_content.find(f'{lang}: [')
            if lang_start == -1:
                continue
            
            # Find the end of this language section
            next_lang_pos = len(footer_content)
            for other_lang in ['en', 'fr', 'zh', 'hi']:
                if other_lang != lang:
                    other_pos = footer_content.find(f'{other_lang}: [', lang_start + 1)
                    if other_pos != -1 and other_pos < next_lang_pos:
                        next_lang_pos = other_pos
            
            lang_section = footer_content[lang_start:next_lang_pos]
            
            # Check required elements in this language
            lang_missing = []
            for element in required_elements:
                if element not in lang_section:
                    lang_missing.append(element)
            
            # Special check for "2000" number (different formats in different languages)
            has_2000 = ('2,000' in lang_section or '2 000' in lang_section or '2000' in lang_section)
            if not has_2000:
                lang_missing.append('2000 (in any format)')
            
            if lang_missing:
                return False, f"Language {lang} missing elements: {lang_missing}"
        
        return True, "✅ All footer variations contain required elements: separator (━━━), HTML bold tags, 📩 emoji, @onarrival1, @Hostbay_support, '2000' (various formats), '98%'"
        
    except Exception as e:
        return False, f"Error checking footer content: {str(e)}"

def main():
    """Run all tests"""
    print("🚀 Starting BulkSMS Footer Implementation Tests\n")
    
    tests = [
        test_bulksms_footer_constant,
        test_get_bulksms_footer_function,
        test_sendpromo_footer_integration,
        test_module_loading,
        test_nodejs_service_and_autopromo,
        test_footer_content_requirements
    ]
    
    passed = 0
    failed = 0
    
    for i, test in enumerate(tests, 1):
        try:
            success, message = test()
            if success:
                print(f"✅ Test {i}: {message}")
                passed += 1
            else:
                print(f"❌ Test {i}: {message}")
                failed += 1
        except Exception as e:
            print(f"❌ Test {i}: Exception occurred - {str(e)}")
            failed += 1
        print()
    
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! BulkSMS footer implementation is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main())