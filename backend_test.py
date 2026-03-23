#!/usr/bin/env python3
"""
Comprehensive Regression Test for NGN Wallet Changes
Tests all existing functionality to ensure nothing was broken by the NGN wallet implementation.
"""

import requests
import json
import time
import subprocess
import os
import sys
from typing import Dict, List, Any

# Test configuration
HEALTH_URL = "http://localhost:5000/health"
BASE_URL = "http://localhost:5000"

class RegressionTester:
    def __init__(self):
        self.results = []
        self.critical_failures = []
        self.minor_issues = []
        
    def log_result(self, test_name: str, passed: bool, message: str, critical: bool = True):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        self.results.append(f"{status}: {test_name} - {message}")
        
        if not passed:
            if critical:
                self.critical_failures.append(f"{test_name}: {message}")
            else:
                self.minor_issues.append(f"{test_name}: {message}")
        
        print(f"{status}: {test_name} - {message}")
    
    def test_health_endpoint(self):
        """Test A: Health & Startup Verification"""
        print("\n=== A. Health & Startup Verification ===")
        
        try:
            response = requests.get(HEALTH_URL, timeout=10)
            if response.status_code == 200:
                data = response.json()
                expected_keys = {"status", "database"}
                if all(key in data for key in expected_keys):
                    if data["status"] == "healthy" and data["database"] == "connected":
                        self.log_result("Health Endpoint", True, "Returns correct healthy status with database connected")
                    else:
                        self.log_result("Health Endpoint", False, f"Incorrect status: {data}")
                else:
                    self.log_result("Health Endpoint", False, f"Missing required keys. Got: {data}")
            else:
                self.log_result("Health Endpoint", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Health Endpoint", False, f"Request failed: {str(e)}")
    
    def test_service_logs(self):
        """Check service logs for errors and initialization"""
        print("\n=== Service Log Verification ===")
        
        # Check error log is empty
        try:
            result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                # Check file size
                output = result.stdout.strip()
                if " 0 " in output:  # File size is 0 bytes
                    self.log_result("Error Log Empty", True, "nodejs.err.log is 0 bytes (no runtime errors)")
                else:
                    self.log_result("Error Log Empty", False, f"nodejs.err.log is not empty: {output}")
            else:
                self.log_result("Error Log Empty", False, "Could not check nodejs.err.log")
        except Exception as e:
            self.log_result("Error Log Empty", False, f"Error checking log: {str(e)}")
        
        # Check for service initializations
        expected_services = [
            "HostingScheduler", "PhoneScheduler", "VoiceService", "SmsService", 
            "BulkCall", "EmailBlast", "Marketplace", "Monetization", "AudioLibrary", 
            "BundleChecker", "ProtectionEnforcer"
        ]
        
        try:
            result = subprocess.run(['head', '-100', '/var/log/supervisor/nodejs.out.log'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                log_content = result.stdout
                found_services = []
                for service in expected_services:
                    if service in log_content:
                        found_services.append(service)
                
                if len(found_services) >= 5:  # At least 5 services should be mentioned
                    self.log_result("Service Initialization", True, 
                                  f"Found {len(found_services)} services initialized: {', '.join(found_services)}")
                else:
                    self.log_result("Service Initialization", False, 
                                  f"Only found {len(found_services)} services: {', '.join(found_services)}")
            else:
                self.log_result("Service Initialization", False, "Could not read nodejs.out.log")
        except Exception as e:
            self.log_result("Service Initialization", False, f"Error checking services: {str(e)}")
    
    def test_syntax_verification(self):
        """Test B: Syntax Verification"""
        print("\n=== B. Syntax Verification ===")
        
        try:
            # Run syntax check on all JS files
            result = subprocess.run([
                'bash', '-c', 
                'for f in /app/js/*.js; do node -c "$f" 2>&1 || echo "FAIL: $f"; done'
            ], capture_output=True, text=True)
            
            if result.returncode == 0 and "FAIL:" not in result.stdout:
                self.log_result("JS Syntax Check", True, "All JS files pass syntax validation")
            else:
                failures = [line for line in result.stdout.split('\n') if 'FAIL:' in line]
                self.log_result("JS Syntax Check", False, f"Syntax errors found: {failures}")
        except Exception as e:
            self.log_result("JS Syntax Check", False, f"Syntax check failed: {str(e)}")
    
    def test_import_export_verification(self):
        """Test C: Import/Export Verification"""
        print("\n=== C. Import/Export Verification ===")
        
        # Test utils.js exports
        try:
            result = subprocess.run([
                'node', '-e', 
                'const u = require("/app/js/utils.js"); console.log(typeof u.smartWalletDeduct, typeof u.smartWalletCheck, typeof u.usdToNgn, typeof u.ngnToUsd, typeof u.getBalance)'
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                output = result.stdout.strip()
                expected = "function function function function function"
                if output == expected:
                    self.log_result("Utils.js Exports", True, "All required functions exported correctly")
                else:
                    self.log_result("Utils.js Exports", False, f"Expected '{expected}', got '{output}'")
            else:
                self.log_result("Utils.js Exports", False, f"Export check failed: {result.stderr}")
        except Exception as e:
            self.log_result("Utils.js Exports", False, f"Export verification failed: {str(e)}")
        
        # Check imports in consumer files
        consumer_files = [
            ("/app/js/hosting-scheduler.js", "smartWalletDeduct"),
            ("/app/js/phone-scheduler.js", "smartWalletDeduct"),
            ("/app/js/voice-service.js", "smartWalletDeduct, smartWalletCheck"),
            ("/app/js/sms-service.js", "smartWalletDeduct"),
            ("/app/js/bulk-call-service.js", "smartWalletDeduct, smartWalletCheck")
        ]
        
        for file_path, expected_imports in consumer_files:
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                
                # Check if the imports are present
                imports_found = all(imp.strip() in content for imp in expected_imports.split(','))
                if imports_found:
                    self.log_result(f"Imports in {os.path.basename(file_path)}", True, 
                                  f"Required imports found: {expected_imports}")
                else:
                    self.log_result(f"Imports in {os.path.basename(file_path)}", False, 
                                  f"Missing imports: {expected_imports}")
            except Exception as e:
                self.log_result(f"Imports in {os.path.basename(file_path)}", False, 
                              f"Could not verify imports: {str(e)}")
    
    def test_existing_functionality(self):
        """Test D: Existing Functionality Regression Checks"""
        print("\n=== D. Existing Functionality Regression Checks ===")
        
        # 1. DynoPay webhook fix
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            if 'dynopayPaymentIdToRef' in content and 'new Map()' in content:
                self.log_result("DynoPay Fix", True, "dynopayPaymentIdToRef Map exists")
            else:
                self.log_result("DynoPay Fix", False, "dynopayPaymentIdToRef Map not found")
        except Exception as e:
            self.log_result("DynoPay Fix", False, f"Could not verify: {str(e)}")
        
        # 2. Trial IVR fix
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            if "callerProvider: 'twilio'" in content:
                self.log_result("Trial IVR Fix", True, "callerProvider: 'twilio' exists")
            else:
                self.log_result("Trial IVR Fix", False, "callerProvider: 'twilio' not found")
        except Exception as e:
            self.log_result("Trial IVR Fix", False, f"Could not verify: {str(e)}")
        
        # 3. SIP rate limiter
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            if 'sipRateLimit' in content and 'SIP_RATE_LIMIT_MAX' in content:
                self.log_result("SIP Rate Limiter", True, "sipRateLimit and SIP_RATE_LIMIT_MAX exist")
            else:
                self.log_result("SIP Rate Limiter", False, "SIP rate limiter components not found")
        except Exception as e:
            self.log_result("SIP Rate Limiter", False, f"Could not verify: {str(e)}")
        
        # 4. Orphaned number alerting
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            if 'ORPHANED NUMBER' in content:
                self.log_result("Orphaned Number Alert", True, "ORPHANED NUMBER admin alert exists")
            else:
                self.log_result("Orphaned Number Alert", False, "ORPHANED NUMBER alert not found")
        except Exception as e:
            self.log_result("Orphaned Number Alert", False, f"Could not verify: {str(e)}")
        
        # 5. Tiered hosting addon limits
        try:
            whm_exists = os.path.exists('/app/js/whm-service.js')
            cpanel_exists = os.path.exists('/app/js/cpanel-routes.js')
            
            if whm_exists or cpanel_exists:
                found_limits = False
                for file_path in ['/app/js/whm-service.js', '/app/js/cpanel-routes.js']:
                    if os.path.exists(file_path):
                        with open(file_path, 'r') as f:
                            content = f.read()
                        if 'addon' in content and 'limit' in content:
                            found_limits = True
                            break
                
                if found_limits:
                    self.log_result("Tiered Hosting Limits", True, "Addon domain limits logic exists")
                else:
                    self.log_result("Tiered Hosting Limits", False, "Addon domain limits logic not found")
            else:
                self.log_result("Tiered Hosting Limits", False, "WHM/cPanel service files not found", critical=False)
        except Exception as e:
            self.log_result("Tiered Hosting Limits", False, f"Could not verify: {str(e)}")
    
    def test_exchange_rate_caching(self):
        """Test E: Exchange Rate Caching"""
        print("\n=== E. Exchange Rate Caching ===")
        
        try:
            with open('/app/js/utils.js', 'r') as f:
                content = f.read()
            
            required_components = [
                '_cachedNgnRate',
                '_cachedNgnRateAt', 
                'NGN_RATE_CACHE_TTL',
                '_fetchNgnRate'
            ]
            
            missing_components = []
            for component in required_components:
                if component not in content:
                    missing_components.append(component)
            
            if not missing_components:
                self.log_result("Exchange Rate Caching", True, "All caching components exist")
                
                # Check for hardcoded fallback rate
                if '1650' in content:
                    self.log_result("No Hardcoded Rate", False, "Hardcoded 1650 fallback rate found")
                else:
                    self.log_result("No Hardcoded Rate", True, "No hardcoded 1650 fallback rate")
            else:
                self.log_result("Exchange Rate Caching", False, f"Missing components: {missing_components}")
        except Exception as e:
            self.log_result("Exchange Rate Caching", False, f"Could not verify: {str(e)}")
    
    def test_null_safety(self):
        """Test F: Null Safety in All Payment Flows"""
        print("\n=== F. Null Safety in Payment Flows ===")
        
        try:
            # Check walletOk handlers null guards
            result = subprocess.run(['grep', '-c', '!priceNgn', '/app/js/_index.js'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                count = int(result.stdout.strip())
                if count >= 10:
                    self.log_result("WalletOk Null Guards", True, f"Found {count} !priceNgn null guards (≥10)")
                else:
                    self.log_result("WalletOk Null Guards", False, f"Only found {count} !priceNgn null guards (<10)")
            else:
                self.log_result("WalletOk Null Guards", False, "Could not count !priceNgn occurrences")
        except Exception as e:
            self.log_result("WalletOk Null Guards", False, f"Could not verify: {str(e)}")
        
        try:
            # Check bank payment flows null guards
            result = subprocess.run(['grep', '-c', '_rawNgn', '/app/js/_index.js'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                count = int(result.stdout.strip())
                if count >= 5:
                    self.log_result("Bank Payment Null Guards", True, f"Found {count} _rawNgn null guards (≥5)")
                else:
                    self.log_result("Bank Payment Null Guards", False, f"Only found {count} _rawNgn null guards (<5)")
            else:
                self.log_result("Bank Payment Null Guards", False, "Could not count _rawNgn occurrences")
        except Exception as e:
            self.log_result("Bank Payment Null Guards", False, f"Could not verify: {str(e)}")
    
    def test_new_action_registration(self):
        """Test G: New Action Registration"""
        print("\n=== G. New Action Registration ===")
        
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            if 'confirmUpgradeHostingPay' in content:
                # Count occurrences to ensure it's properly registered
                count = content.count('confirmUpgradeHostingPay')
                if count >= 2:  # Should appear in actions object and in handler
                    self.log_result("New Action Registration", True, 
                                  f"confirmUpgradeHostingPay registered ({count} occurrences)")
                else:
                    self.log_result("New Action Registration", False, 
                                  f"confirmUpgradeHostingPay found but may not be fully registered ({count} occurrences)")
            else:
                self.log_result("New Action Registration", False, "confirmUpgradeHostingPay not found")
        except Exception as e:
            self.log_result("New Action Registration", False, f"Could not verify: {str(e)}")
    
    def test_language_strings(self):
        """Test H: Language Strings"""
        print("\n=== H. Language Strings ===")
        
        required_strings = {
            'walletBalanceLowNgn': 'function',
            'ngnUnavailable': 'string', 
            'walletBalanceLow': 'string',
            'walletBalanceLowAmount': 'function',
            'walletSelectCurrency': 'function'
        }
        
        try:
            with open('/app/js/lang/en.js', 'r') as f:
                content = f.read()
            
            missing_strings = []
            for string_name, expected_type in required_strings.items():
                if string_name not in content:
                    missing_strings.append(string_name)
            
            if not missing_strings:
                self.log_result("Language Strings", True, "All required language strings exist")
            else:
                self.log_result("Language Strings", False, f"Missing strings: {missing_strings}")
        except Exception as e:
            self.log_result("Language Strings", False, f"Could not verify: {str(e)}")
    
    def run_all_tests(self):
        """Run all regression tests"""
        print("🔍 Starting NGN Wallet Regression Testing...")
        print("=" * 60)
        
        self.test_health_endpoint()
        self.test_service_logs()
        self.test_syntax_verification()
        self.test_import_export_verification()
        self.test_existing_functionality()
        self.test_exchange_rate_caching()
        self.test_null_safety()
        self.test_new_action_registration()
        self.test_language_strings()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 REGRESSION TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if "✅ PASS" in r])
        failed_tests = len([r for r in self.results if "❌ FAIL" in r])
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.critical_failures:
            print(f"\n🚨 CRITICAL FAILURES ({len(self.critical_failures)}):")
            for failure in self.critical_failures:
                print(f"  • {failure}")
        
        if self.minor_issues:
            print(f"\n⚠️  MINOR ISSUES ({len(self.minor_issues)}):")
            for issue in self.minor_issues:
                print(f"  • {issue}")
        
        if not self.critical_failures:
            print("\n✅ NO CRITICAL FAILURES - NGN wallet changes did not break existing functionality!")
        else:
            print(f"\n❌ {len(self.critical_failures)} CRITICAL FAILURES DETECTED - Existing functionality may be broken!")
        
        return len(self.critical_failures) == 0

if __name__ == "__main__":
    tester = RegressionTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)