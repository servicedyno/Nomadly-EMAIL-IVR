#!/usr/bin/env python3
"""
Railway Log Bug Fixes Testing - NGN deposit parsing, wallet null USD display, goto.mainmenu crash
Testing the 3 bug fixes described in test_result.md
"""

import os
import requests
import time
import json
import re
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://nomadly-api-preview-1.preview.emergentagent.com"

class RailwayBugFixTester:
    def __init__(self):
        self.results = {
            "node_health": False,
            "error_log_empty": False,
            "ngn_deposit_sanitization": False,
            "usd_deposit_sanitization": False,
            "wallet_price_fallback": False,
            "goto_mainmenu_eliminated": False
        }
        self.errors = []

    def test_node_health(self):
        """Test 1: Node.js Health Check"""
        print("🔍 Testing Node.js Health...")
        try:
            # Test localhost health
            response = requests.get("http://localhost:5000/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and data.get("database") == "connected":
                    print(f"✅ Node.js Health: {response.status_code} with {data}")
                    self.results["node_health"] = True
                else:
                    self.errors.append(f"❌ Health check failed: {data}")
            else:
                self.errors.append(f"❌ Health check failed with status {response.status_code}")
        except Exception as e:
            self.errors.append(f"❌ Health check error: {str(e)}")

    def test_error_log_empty(self):
        """Test 2: Verify error log is empty"""
        print("🔍 Testing Error Log Status...")
        try:
            import subprocess
            result = subprocess.run(
                ["ls", "-la", "/var/log/supervisor/nodejs.err.log"],
                capture_output=True, text=True
            )
            if result.returncode == 0 and " 0 " in result.stdout:
                print("✅ /var/log/supervisor/nodejs.err.log is EMPTY (0 bytes)")
                self.results["error_log_empty"] = True
            else:
                self.errors.append(f"❌ Error log not empty or missing: {result.stdout}")
        except Exception as e:
            self.errors.append(f"❌ Error checking log: {str(e)}")

    def test_ngn_deposit_sanitization(self):
        """Test 3: Verify NGN deposit amount sanitization in code"""
        print("🔍 Testing NGN Deposit Amount Sanitization...")
        try:
            with open("/app/js/_index.js", "r", encoding="utf-8") as f:
                content = f.read()
            
            # Look for the specific line pattern around line 10979
            found_sanitization = False
            found_validation = False
            
            # Check for the specific sanitization line
            if "message.replace(/[#₦,\\s]/g, '').replace(/^NGN\\s*/i, '').replace(/NGN\\s*Amount:?\\s*/i, '')" in content:
                found_sanitization = True
                print("✅ NGN deposit sanitization verified: strips #, ₦, commas, spaces, 'NGN Amount:' prefix")
            
            # Check for parseFloat(sanitized) and validation
            if "parseFloat(sanitized)" in content and "isNaN(amount) || amount <= 0" in content:
                found_validation = True
                print("✅ NGN deposit validation: isNaN(amount) || amount <= 0 on parsed amount")
            
            if found_sanitization and found_validation:
                self.results["ngn_deposit_sanitization"] = True
            else:
                self.errors.append("❌ NGN deposit sanitization not fully implemented")
                
        except Exception as e:
            self.errors.append(f"❌ Error reading NGN deposit code: {str(e)}")

    def test_usd_deposit_sanitization(self):
        """Test 4: Verify USD deposit amount sanitization in code"""
        print("🔍 Testing USD Deposit Amount Sanitization...")
        try:
            with open("/app/js/_index.js", "r", encoding="utf-8") as f:
                content = f.read()
            
            # Look for depositUSD handler around line 10998
            usd_handler_pattern = r"if\s*\(\s*action\s*===\s*a\.depositUSD\s*\)\s*{.*?}"
            match = re.search(usd_handler_pattern, content, re.DOTALL)
            
            if match:
                usd_code = match.group(0)
                
                # Check for USD sanitization
                sanitization_checks = [
                    r"\.replace\(\s*/\[\$,\\s\]/g\s*,\s*['\"][\s]*['\"]\s*\)",
                    r"\.replace\(\s*/\^USD\\s\*/i\s*,\s*['\"][\s]*['\"]\s*\)"
                ]
                
                found_sanitization = all(re.search(pattern, usd_code) for pattern in sanitization_checks)
                
                # Check for Number(sanitized) instead of Number(message)
                number_sanitized = "Number(sanitized)" in usd_code
                
                if found_sanitization and number_sanitized:
                    print("✅ USD deposit sanitization verified: strips $, commas, spaces, 'USD' prefix")
                    print("✅ USD deposit uses Number(sanitized) instead of Number(message)")
                    self.results["usd_deposit_sanitization"] = True
                else:
                    self.errors.append("❌ USD deposit sanitization not fully implemented")
            else:
                self.errors.append("❌ USD deposit handler not found")
                
        except Exception as e:
            self.errors.append(f"❌ Error reading USD deposit code: {str(e)}")

    def test_wallet_price_fallback(self):
        """Test 5: Verify walletSelectCurrencyConfirm price fallback"""
        print("🔍 Testing Wallet Price Fallback Fix...")
        try:
            with open("/app/js/_index.js", "r", encoding="utf-8") as f:
                content = f.read()
            
            # Look for the specific patterns around line 3513-3515
            found_destructure = False
            found_fallback = False
            
            # Check for totalPrice in destructuring
            if "{ price, totalPrice, couponApplied, newPrice, coin } = info" in content:
                found_destructure = True
                print("✅ Wallet destructuring verified: includes totalPrice")
            
            # Check for the specific fallback pattern  
            if "price || totalPrice || 0" in content:
                found_fallback = True
                print("✅ Wallet price fallback verified: uses price || totalPrice || 0")
            
            if found_destructure and found_fallback:
                self.results["wallet_price_fallback"] = True
            else:
                self.errors.append("❌ Wallet price fallback not fully implemented")
                
        except Exception as e:
            self.errors.append(f"❌ Error reading wallet code: {str(e)}")

    def test_goto_mainmenu_eliminated(self):
        """Test 6: Verify goto.mainmenu() has been replaced with goto.displayMainMenuButtons()"""
        print("🔍 Testing goto.mainmenu() Elimination...")
        try:
            with open("/app/js/_index.js", "r", encoding="utf-8") as f:
                content = f.read()
            
            # Check for any remaining goto.mainmenu() calls
            mainmenu_pattern = r"goto\.mainmenu\s*\(\s*\)"
            mainmenu_matches = re.findall(mainmenu_pattern, content)
            
            # Check for goto.displayMainMenuButtons() at expected locations
            display_pattern = r"goto\.displayMainMenuButtons\s*\(\s*\)"
            display_matches = re.findall(display_pattern, content)
            
            # Look for specific lines mentioned in the review
            lines_to_check = [6415, 16585, 16599]  # Updated line numbers
            found_replacements = 0
            
            content_lines = content.split('\n')
            for line_num in lines_to_check:
                if line_num < len(content_lines):
                    line = content_lines[line_num - 1]  # 0-based indexing
                    if "goto.displayMainMenuButtons()" in line:
                        found_replacements += 1
                        print(f"✅ Line {line_num}: goto.displayMainMenuButtons() found")
            
            if len(mainmenu_matches) == 0 and found_replacements >= 2:
                print("✅ goto.mainmenu() elimination verified: ZERO occurrences found")
                print(f"✅ Found {len(display_matches)} goto.displayMainMenuButtons() calls")
                self.results["goto_mainmenu_eliminated"] = True
            else:
                self.errors.append(f"❌ goto.mainmenu() still found: {len(mainmenu_matches)} occurrences")
                
        except Exception as e:
            self.errors.append(f"❌ Error checking goto functions: {str(e)}")

    def run_all_tests(self):
        """Run all tests and provide summary"""
        print("🚀 Starting Railway Log Bug Fixes Testing...\n")
        
        # Run all tests
        self.test_node_health()
        self.test_error_log_empty()
        self.test_ngn_deposit_sanitization()
        self.test_usd_deposit_sanitization()
        self.test_wallet_price_fallback()
        self.test_goto_mainmenu_eliminated()
        
        # Calculate success rate
        total_tests = len(self.results)
        passed_tests = sum(self.results.values())
        success_rate = (passed_tests / total_tests) * 100
        
        print(f"\n📊 RAILWAY LOG BUG FIXES TEST RESULTS:")
        print(f"Success Rate: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
        print("\n✅ PASSED TESTS:")
        for test, passed in self.results.items():
            if passed:
                print(f"  • {test}")
        
        if self.errors:
            print("\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"  • {error}")
        
        return passed_tests, total_tests, self.errors

if __name__ == "__main__":
    tester = RailwayBugFixTester()
    passed, total, errors = tester.run_all_tests()
    
    if passed == total:
        print(f"\n🎉 ALL {total} RAILWAY LOG BUG FIXES VERIFIED SUCCESSFULLY!")
    else:
        print(f"\n⚠️  {total - passed} out of {total} tests failed.")