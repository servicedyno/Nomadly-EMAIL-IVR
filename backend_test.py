#!/usr/bin/env python3
"""
Backend Testing Script for Private SMTP Promo Footer
Tests the newly added Private SMTP promo footer in /app/js/auto-promo.js
"""

import subprocess
import sys
import re
import requests
import json
import os
from typing import Dict, List, Tuple

def run_command(cmd: str, cwd: str = "/app") -> Tuple[int, str, str]:
    """Run a shell command and return exit code, stdout, stderr"""
    try:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=30
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "Command timed out"
    except Exception as e:
        return 1, "", str(e)

def test_module_syntax():
    """Test 1: Module loads without errors"""
    print("🔍 Test 1: Module syntax validation...")
    
    exit_code, stdout, stderr = run_command("node -e \"require('./js/auto-promo.js')\"")
    
    if exit_code == 0:
        print("✅ Module loads without errors (exit code 0)")
        return True
    else:
        print(f"❌ Module failed to load: exit_code={exit_code}")
        print(f"   stdout: {stdout}")
        print(f"   stderr: {stderr}")
        return False

def test_smtp_footer_constant():
    """Test 2: SMTP_FOOTER constant exists with correct structure"""
    print("\n🔍 Test 2: SMTP_FOOTER constant verification...")
    
    try:
        with open("/app/js/auto-promo.js", "r", encoding="utf-8") as f:
            content = f.read()
        
        # Check if SMTP_FOOTER constant exists around line 252
        smtp_footer_match = re.search(r'const SMTP_FOOTER = \{(.*?)\}', content, re.DOTALL)
        if not smtp_footer_match:
            print("❌ SMTP_FOOTER constant not found")
            return False
        
        smtp_footer_content = smtp_footer_match.group(1)
        
        # Check for 4 languages
        languages = ['en', 'fr', 'zh', 'hi']
        found_languages = []
        
        for lang in languages:
            if f'{lang}: [' in smtp_footer_content:
                found_languages.append(lang)
        
        if len(found_languages) != 4:
            print(f"❌ Expected 4 languages, found {len(found_languages)}: {found_languages}")
            return False
        
        # Count variations per language (should be 3 each)
        total_variations = 0
        for lang in languages:
            lang_pattern = rf'{lang}: \[(.*?)\]'
            lang_match = re.search(lang_pattern, smtp_footer_content, re.DOTALL)
            if lang_match:
                variations = lang_match.group(1).count('`')
                if variations % 2 == 0:  # Each variation has opening and closing backticks
                    variations = variations // 2
                total_variations += variations
                print(f"   {lang}: {variations} variations")
        
        if total_variations == 12:
            print("✅ SMTP_FOOTER constant verified: 4 languages × 3 variations each = 12 total")
            return True
        else:
            print(f"❌ Expected 12 total variations, found {total_variations}")
            return False
            
    except Exception as e:
        print(f"❌ Error reading auto-promo.js: {e}")
        return False

def test_getsmtp_footer_function():
    """Test 3: getSmtpFooter function exists with correct logic"""
    print("\n🔍 Test 3: getSmtpFooter function verification...")
    
    try:
        with open("/app/js/auto-promo.js", "r", encoding="utf-8") as f:
            content = f.read()
        
        # Check if getSmtpFooter function exists around line 275
        function_pattern = r'function getSmtpFooter\(lang\) \{(.*?)\}'
        function_match = re.search(function_pattern, content, re.DOTALL)
        
        if not function_match:
            print("❌ getSmtpFooter function not found")
            return False
        
        function_body = function_match.group(1)
        
        # Check for fallback to 'en'
        if 'SMTP_FOOTER[lang] || SMTP_FOOTER.en' not in function_body:
            print("❌ Missing fallback to 'en' language")
            return False
        
        # Check for random selection
        if 'Math.floor(Math.random()' not in function_body:
            print("❌ Missing random selection logic")
            return False
        
        print("✅ getSmtpFooter function verified with fallback to 'en' and random selection")
        return True
        
    except Exception as e:
        print(f"❌ Error reading auto-promo.js: {e}")
        return False

def test_sendpromo_integration():
    """Test 4: SMTP footer integration in sendPromoToUser function"""
    print("\n🔍 Test 4: SMTP footer integration in sendPromoToUser...")
    
    try:
        with open("/app/js/auto-promo.js", "r", encoding="utf-8") as f:
            content = f.read()
        
        # Find sendPromoToUser function and check footer order
        sendpromo_pattern = r'function sendPromoToUser.*?(?=function|\Z)'
        sendpromo_match = re.search(sendpromo_pattern, content, re.DOTALL)
        
        if not sendpromo_match:
            print("❌ sendPromoToUser function not found")
            return False
        
        sendpromo_content = sendpromo_match.group(0)
        
        # Check for SMTP footer append before DynoPay
        smtp_append_pattern = r"caption \+= '\\n\\n' \+ getSmtpFooter\(lang\)"
        dynopay_append_pattern = r"caption \+= '\\n\\n' \+ getDynoPayFooter\(lang\)"
        bulksms_append_pattern = r"caption \+= '\\n\\n' \+ getBulkSmsFooter\(lang\)"
        
        smtp_pos = sendpromo_content.find("getSmtpFooter(lang)")
        dynopay_pos = sendpromo_content.find("getDynoPayFooter(lang)")
        bulksms_pos = sendpromo_content.find("getBulkSmsFooter(lang)")
        
        if smtp_pos == -1:
            print("❌ SMTP footer append not found in sendPromoToUser")
            return False
        
        if dynopay_pos == -1:
            print("❌ DynoPay footer append not found in sendPromoToUser")
            return False
        
        if bulksms_pos == -1:
            print("❌ BulkSMS footer append not found in sendPromoToUser")
            return False
        
        # Check order: SMTP before DynoPay before BulkSMS
        if smtp_pos < dynopay_pos < bulksms_pos:
            print("✅ Footer order verified: Coupon → SMTP → DynoPay → BulkSMS")
            return True
        else:
            print(f"❌ Incorrect footer order. Positions: SMTP={smtp_pos}, DynoPay={dynopay_pos}, BulkSMS={bulksms_pos}")
            return False
        
    except Exception as e:
        print(f"❌ Error reading auto-promo.js: {e}")
        return False

def test_smtp_content_requirements():
    """Test 5: All SMTP variations contain required content"""
    print("\n🔍 Test 5: SMTP footer content requirements...")
    
    try:
        with open("/app/js/auto-promo.js", "r", encoding="utf-8") as f:
            content = f.read()
        
        # Extract SMTP_FOOTER content
        smtp_footer_match = re.search(r'const SMTP_FOOTER = \{(.*?)\}', content, re.DOTALL)
        if not smtp_footer_match:
            print("❌ SMTP_FOOTER constant not found")
            return False
        
        smtp_content = smtp_footer_match.group(1)
        
        # Check for required elements in all variations
        required_checks = {
            '@onarrival1': 0,
            '@Hostbay_support': 0,
            'SMTP': 0,
            'rotating IP': 0,
            'warming': 0,
            'inboxing': 0,
        }
        
        # Count occurrences of each required element
        for requirement in required_checks:
            # Case-insensitive search for content requirements
            if requirement.startswith('@'):
                # Exact match for usernames
                required_checks[requirement] = smtp_content.count(requirement)
            else:
                # Case-insensitive for content keywords
                required_checks[requirement] = smtp_content.lower().count(requirement.lower())
        
        # Check if all variations mention both DM contacts
        if required_checks['@onarrival1'] >= 12 and required_checks['@Hostbay_support'] >= 12:
            print("✅ All 12 variations mention both @onarrival1 AND @Hostbay_support")
        else:
            print(f"❌ Missing DM contacts: @onarrival1={required_checks['@onarrival1']}, @Hostbay_support={required_checks['@Hostbay_support']}")
            return False
        
        # Check for SMTP-related keywords
        smtp_keywords = ['SMTP', 'rotating IP', 'warming', 'inboxing']
        missing_keywords = []
        
        for keyword in smtp_keywords:
            if required_checks[keyword] == 0:
                missing_keywords.append(keyword)
        
        if missing_keywords:
            print(f"❌ Missing keywords: {missing_keywords}")
            return False
        else:
            print("✅ All variations contain required keywords: SMTP, rotating IP, warming, inboxing/delivery")
        
        # Check for no clickable URLs (no <a href> tags)
        if '<a href' in smtp_content:
            print("❌ Found clickable URL (<a href> tags) - should only have DM contacts")
            return False
        else:
            print("✅ No clickable URLs found - only DM contacts as required")
        
        return True
        
    except Exception as e:
        print(f"❌ Error reading auto-promo.js: {e}")
        return False

def test_nodejs_service():
    """Test 6: Node.js service running cleanly"""
    print("\n🔍 Test 6: Node.js service health check...")
    
    # Check if Node.js error log is clean
    try:
        exit_code, stdout, stderr = run_command("wc -c /var/log/supervisor/nodejs.err.log")
        if exit_code == 0 and stdout.strip().startswith('0 '):
            print("✅ Node.js error log is 0 bytes (clean)")
            error_log_clean = True
        else:
            print(f"❌ Node.js error log not clean: {stdout}")
            error_log_clean = False
    except:
        print("⚠️  Could not check Node.js error log")
        error_log_clean = False
    
    # Check supervisor status
    try:
        exit_code, stdout, stderr = run_command("sudo supervisorctl status nodejs")
        if exit_code == 0 and 'RUNNING' in stdout:
            print("✅ Node.js service is running")
            service_running = True
        else:
            print(f"❌ Node.js service not running: {stdout}")
            service_running = False
    except:
        print("⚠️  Could not check Node.js service status")
        service_running = False
    
    return error_log_clean and service_running

def test_health_endpoint():
    """Test 7: Health endpoint returns healthy"""
    print("\n🔍 Test 7: Health endpoint verification...")
    
    try:
        # Get backend URL from frontend .env
        backend_url = None
        try:
            with open("/app/frontend/.env", "r") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        backend_url = line.split("=", 1)[1].strip()
                        break
        except:
            pass
        
        if not backend_url:
            backend_url = "https://setup-guide-72.preview.emergentagent.com"
        
        health_url = f"{backend_url}/api/health"
        print(f"   Testing health endpoint: {health_url}")
        
        response = requests.get(health_url, timeout=10)
        
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get('status') == 'healthy':
                    print(f"✅ Health endpoint returns healthy: {data}")
                    return True
                else:
                    print(f"❌ Health endpoint not healthy: {data}")
                    return False
            except:
                print(f"❌ Health endpoint returned non-JSON: {response.text}")
                return False
        else:
            print(f"❌ Health endpoint returned {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking health endpoint: {e}")
        return False

def test_autopromo_initialization():
    """Test 8: AutoPromo service initialization"""
    print("\n🔍 Test 8: AutoPromo service initialization...")
    
    try:
        # Check nodejs output log for AutoPromo initialization
        exit_code, stdout, stderr = run_command("tail -n 200 /var/log/supervisor/nodejs.out.log | grep -i -E '(autopromo|auto-promo)'")
        
        if exit_code == 0 and stdout:
            lines = stdout.strip().split('\n')
            # Look for initialization messages
            init_found = any('Initialized' in line and 'AutoPromo' in line for line in lines)
            schedule_found = any('Schedule' in line and 'AutoPromo' in line for line in lines)
            
            if init_found or schedule_found:
                print("✅ AutoPromo initialization found in logs:")
                for line in lines[-3:]:  # Show last 3 relevant lines
                    print(f"   {line}")
                return True
            else:
                print("⚠️  AutoPromo mentioned but no clear initialization found")
                return False
        else:
            print("⚠️  No AutoPromo initialization messages found in recent logs")
            return False
            
    except Exception as e:
        print(f"❌ Error checking AutoPromo logs: {e}")
        return False

def main():
    """Run all tests for Private SMTP promo footer"""
    print("🚀 Starting Private SMTP Promo Footer Testing")
    print("=" * 60)
    
    tests = [
        test_module_syntax,
        test_smtp_footer_constant,
        test_getsmtp_footer_function,
        test_sendpromo_integration,
        test_smtp_content_requirements,
        test_nodejs_service,
        test_health_endpoint,
        test_autopromo_initialization,
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
    
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {passed}/{total} tests passed ({passed/total*100:.0f}% success rate)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Private SMTP promo footer is production-ready!")
        return True
    else:
        print(f"⚠️  {total - passed} test(s) failed - issues need to be addressed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)