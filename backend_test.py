#!/usr/bin/env python3
"""
Backend Test Suite for ZA Twilio Number Purchase Fix
Tests the specific fixes mentioned in the review request for South Africa Twilio number purchases.
"""

import requests
import json
import sys
from typing import Dict, List, Tuple

# Test configuration
BACKEND_URL = "http://localhost:5000"
HEALTH_ENDPOINT = f"{BACKEND_URL}/health"

def test_result(name: str, success: bool, details: str = "") -> Dict:
    """Format test result"""
    return {
        "test": name,
        "status": "✅ PASS" if success else "❌ FAIL", 
        "details": details
    }

class ZATwilioFixTester:
    def __init__(self):
        self.results = []
        
    def log(self, message: str):
        print(f"[TEST] {message}")
        
    def test_nodejs_health(self) -> bool:
        """Test 1: Node.js health check"""
        try:
            response = requests.get(HEALTH_ENDPOINT, timeout=10)
            if response.status_code == 200:
                data = response.json()
                healthy = data.get('status') == 'healthy'
                self.results.append(test_result(
                    "Node.js Health Check", 
                    healthy,
                    f"Status: {response.status_code}, Response: {data}"
                ))
                return healthy
            else:
                self.results.append(test_result(
                    "Node.js Health Check", 
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                ))
                return False
        except Exception as e:
            self.results.append(test_result(
                "Node.js Health Check", 
                False,
                f"Connection error: {str(e)}"
            ))
            return False
    
    def check_error_log_empty(self) -> bool:
        """Test 1b: Check error log is empty"""
        try:
            import os
            error_log_path = "/var/log/supervisor/nodejs.err.log"
            if os.path.exists(error_log_path):
                size = os.path.getsize(error_log_path)
                empty = size == 0
                self.results.append(test_result(
                    "Error Log Empty Check", 
                    empty,
                    f"Error log size: {size} bytes"
                ))
                return empty
            else:
                self.results.append(test_result(
                    "Error Log Empty Check", 
                    False,
                    "Error log file not found"
                ))
                return False
        except Exception as e:
            self.results.append(test_result(
                "Error Log Empty Check", 
                False,
                f"Error checking log: {str(e)}"
            ))
            return False

    def read_file_content(self, file_path: str, start_line: int = None, end_line: int = None) -> str:
        """Read file content with optional line range"""
        try:
            with open(file_path, 'r') as f:
                lines = f.readlines()
                if start_line is not None and end_line is not None:
                    return ''.join(lines[start_line-1:end_line])
                return ''.join(lines)
        except Exception as e:
            return f"Error reading file: {str(e)}"
    
    def test_wallet_handler_awaited_saveinfo(self) -> bool:
        """Test 2: Wallet handler address flow - awaited saveInfo calls"""
        try:
            index_js_path = "/app/js/_index.js"
            
            # Check lines 4496-4499 for awaited saveInfo calls
            content = self.read_file_content(index_js_path, 4495, 4505)
            
            required_awaited_calls = [
                "await saveInfo('cpPendingCoin'",
                "await saveInfo('cpPendingPriceUsd'", 
                "await saveInfo('cpPendingPriceNgn'",
                "await saveInfo('cpPaymentMethod'"
            ]
            
            missing_awaits = []
            for call in required_awaited_calls:
                if call not in content:
                    missing_awaits.append(call)
            
            # Check line 4504 for cached address saveInfo
            cached_addr_await = "await saveInfo('cpAddressSid', cachedAddr)" in content
            if not cached_addr_await:
                missing_awaits.append("await saveInfo('cpAddressSid', cachedAddr)")
                
            success = len(missing_awaits) == 0
            details = f"Found all awaited saveInfo calls" if success else f"Missing awaited calls: {missing_awaits}"
            
            self.results.append(test_result(
                "Wallet Handler Awaited SaveInfo Calls",
                success,
                details
            ))
            return success
            
        except Exception as e:
            self.results.append(test_result(
                "Wallet Handler Awaited SaveInfo Calls",
                False,
                f"Error checking file: {str(e)}"
            ))
            return False
    
    def test_bundle_required_bypass(self) -> bool:
        """Test 3: Bundle-required bypass for ZA with cached address"""
        try:
            index_js_path = "/app/js/_index.js"
            
            # Check lines around 4507-4515 for bundle logic
            content = self.read_file_content(index_js_path, 4505, 4520)
            
            required_checks = [
                "twilioService.needsBundle(countryCode)",
                "pendingBundles.findOne({ chatId, countryCode, status: 'twilio-approved' })",
                "await saveInfo('cpBundleSid', approvedBundle.bundleSid)"
            ]
            
            missing_checks = []
            for check in required_checks:
                if check not in content:
                    missing_checks.append(check)
            
            success = len(missing_checks) == 0
            details = f"All bundle checks found" if success else f"Missing checks: {missing_checks}"
            
            self.results.append(test_result(
                "Bundle Required Bypass Logic",
                success,
                details
            ))
            return success
            
        except Exception as e:
            self.results.append(test_result(
                "Bundle Required Bypass Logic", 
                False,
                f"Error checking file: {str(e)}"
            ))
            return False
    
    def test_bank_payment_path_fix(self) -> bool:
        """Test 4: Bank payment path bundle check"""
        try:
            index_js_path = "/app/js/_index.js"
            
            # Check bank payment path around lines 16000-16030
            content = self.read_file_content(index_js_path, 16000, 16030)
            
            required_elements = [
                "twilioService.needsBundle(countryCode)",
                "pendingBundles.findOne({ chatId, countryCode, status: 'twilio-approved' })",
                "approvedBundle.bundleSid"
            ]
            
            missing_elements = []
            for element in required_elements:
                if element not in content:
                    missing_elements.append(element)
            
            success = len(missing_elements) == 0
            details = f"Bank path bundle logic found" if success else f"Missing elements: {missing_elements}"
            
            self.results.append(test_result(
                "Bank Payment Path Bundle Fix",
                success,
                details
            ))
            return success
            
        except Exception as e:
            self.results.append(test_result(
                "Bank Payment Path Bundle Fix",
                False,
                f"Error checking file: {str(e)}"
            ))
            return False
    
    def test_executetwilio_purchase_signature(self) -> bool:
        """Test 5: executeTwilioPurchase function signature and bundleSid parameter"""
        try:
            index_js_path = "/app/js/_index.js"
            
            # Check function signature around line 538
            content = self.read_file_content(index_js_path, 535, 545)
            
            # Check for bundleSid parameter in function signature
            function_signature_ok = "bundleSid" in content and "async function executeTwilioPurchase" in content
            
            # Check line 563 for bundleSid parameter passing
            content2 = self.read_file_content(index_js_path, 560, 570)
            bundlesid_passed = "bundleSid || null" in content2
            
            success = function_signature_ok and bundlesid_passed
            details = f"Function signature: {'✓' if function_signature_ok else '✗'}, Parameter passing: {'✓' if bundlesid_passed else '✗'}"
            
            self.results.append(test_result(
                "executeTwilioPurchase BundleSid Parameter",
                success,
                details
            ))
            return success
            
        except Exception as e:
            self.results.append(test_result(
                "executeTwilioPurchase BundleSid Parameter",
                False,
                f"Error checking file: {str(e)}"
            ))
            return False
    
    def test_wallet_executetwilio_call(self) -> bool:
        """Test 5b: Wallet handler executeTwilioPurchase call with bundleSid"""
        try:
            index_js_path = "/app/js/_index.js"
            
            # Check line 4600 for bundleSid parameter in call
            content = self.read_file_content(index_js_path, 4595, 4605)
            
            # Look for the executeTwilioPurchase call with bundleSid as 11th parameter
            bundlesid_in_call = "info?.cpBundleSid || null" in content
            
            success = bundlesid_in_call
            details = f"bundleSid parameter found in wallet executeTwilioPurchase call" if success else "bundleSid parameter missing in call"
            
            self.results.append(test_result(
                "Wallet executeTwilioPurchase BundleSid Call",
                success,
                details
            ))
            return success
            
        except Exception as e:
            self.results.append(test_result(
                "Wallet executeTwilioPurchase BundleSid Call",
                False,
                f"Error checking file: {str(e)}"
            ))
            return False
    
    def test_unprotected_cached_address_paths(self) -> bool:
        """Test 6: Check for remaining unprotected cached-address paths"""
        try:
            index_js_path = "/app/js/_index.js"
            
            # Read the entire file to search for problematic patterns
            content = self.read_file_content(index_js_path)
            
            # Look for executeTwilioPurchase calls with cachedAddr that don't handle bundleSid
            issues_found = []
            
            # Check crypto payment paths (known issues from analysis)
            if "const result = await executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', 'crypto_' + coin, cachedAddr)" in content:
                issues_found.append("Unprotected crypto payment path at line ~16572")
            
            if "const result = await executeTwilioPurchase(chatId, selectedNumber, planKey, price, countryCode, countryName, info?.cpNumberType || 'local', 'crypto_dynopay_' + coin, cachedAddr)" in content:
                issues_found.append("Unprotected dynopay crypto payment path at line ~17106")
            
            # The bank payment path should be protected now
            bank_protected = "approvedBundle.bundleSid" in content and "/bank-pay-phone" in content
            
            success = len(issues_found) == 0
            details = f"Bank path protected: {'✓' if bank_protected else '✗'}"
            if issues_found:
                details += f", Issues found: {issues_found}"
            else:
                details += ", No unprotected paths found"
            
            self.results.append(test_result(
                "Unprotected Cached-Address Paths Check", 
                success,
                details
            ))
            return success
            
        except Exception as e:
            self.results.append(test_result(
                "Unprotected Cached-Address Paths Check",
                False,
                f"Error checking file: {str(e)}"
            ))
            return False
    
    def run_all_tests(self) -> Tuple[int, int]:
        """Run all tests and return (passed, total)"""
        self.log("Starting ZA Twilio Number Purchase Fix Testing")
        
        # Test 1: Node.js health
        self.test_nodejs_health()
        self.check_error_log_empty()
        
        # Test 2: Wallet handler awaited saveInfo calls
        self.test_wallet_handler_awaited_saveinfo()
        
        # Test 3: Bundle-required bypass logic
        self.test_bundle_required_bypass()
        
        # Test 4: Bank payment path fix  
        self.test_bank_payment_path_fix()
        
        # Test 5: executeTwilioPurchase signature and calls
        self.test_executetwilio_purchase_signature()
        self.test_wallet_executetwilio_call()
        
        # Test 6: No unprotected cached-address paths
        self.test_unprotected_cached_address_paths()
        
        # Calculate results
        passed = len([r for r in self.results if "✅" in r['status']])
        total = len(self.results)
        
        return passed, total
    
    def print_results(self):
        """Print test results summary"""
        print("\n" + "="*80)
        print("ZA TWILIO NUMBER PURCHASE FIX - TEST RESULTS")
        print("="*80)
        
        for result in self.results:
            print(f"{result['status']} {result['test']}")
            if result['details']:
                print(f"    Details: {result['details']}")
            print()
        
        passed = len([r for r in self.results if "✅" in r['status']])
        total = len(self.results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"SUMMARY: {passed}/{total} tests passed ({success_rate:.1f}% success rate)")
        print("="*80)

def main():
    """Main test execution"""
    tester = ZATwilioFixTester()
    passed, total = tester.run_all_tests()
    tester.print_results()
    
    # Return appropriate exit code
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()