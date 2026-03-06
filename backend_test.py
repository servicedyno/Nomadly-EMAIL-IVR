#!/usr/bin/env python3
"""
Nomadly Telegram Bot Bug Fixes Verification Test
Tests for Railway deployment log 34447901-61be-40db-ae82-647bc5926e82 bug fixes
"""

import requests
import re
import json
import time
from typing import Dict, List, Optional

# Configuration
BACKEND_URL = "http://localhost:5000"
TWILIO_SERVICE_PATH = "/app/js/twilio-service.js"
INDEX_PATH = "/app/js/_index.js"

class NomadlyBugFixTester:
    def __init__(self):
        self.results = []
        print("🔍 Nomadly Telegram Bot Bug Fixes Verification Test")
        print("=" * 60)

    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   {details}")
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })

    def test_service_health(self):
        """Test 1: Verify Node.js service health"""
        try:
            response = requests.get(f"{BACKEND_URL}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and data.get("database") == "connected":
                    self.log_test("Service Health Check", True, 
                                f"Status: {data.get('status')}, Database: {data.get('database')}, Uptime: {data.get('uptime')}")
                    return True
                else:
                    self.log_test("Service Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Service Health Check", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Service Health Check", False, f"Connection error: {str(e)}")
            return False

    def test_error_logs_empty(self):
        """Test 2: Verify error logs are empty"""
        try:
            import os
            error_log_path = "/var/log/supervisor/nodejs.err.log"
            if os.path.exists(error_log_path):
                size = os.path.getsize(error_log_path)
                if size == 0:
                    self.log_test("Error Log Empty", True, "nodejs.err.log is 0 bytes")
                    return True
                else:
                    # Read first few lines of error log
                    with open(error_log_path, 'r') as f:
                        errors = f.read(500)
                    self.log_test("Error Log Empty", False, f"Log size: {size} bytes, content: {errors[:200]}")
                    return False
            else:
                self.log_test("Error Log Empty", False, "Error log file not found")
                return False
        except Exception as e:
            self.log_test("Error Log Empty", False, f"Error checking log: {str(e)}")
            return False

    def test_createbundle_bug_fix(self):
        """Test 3: Bug Fix 1 - createBundle ambiguous regulation parameters"""
        try:
            # Read twilio-service.js file
            with open(TWILIO_SERVICE_PATH, 'r') as f:
                content = f.read()
            
            # Find createBundle function (around line 617)
            lines = content.split('\n')
            createbundle_line = None
            for i, line in enumerate(lines):
                if 'async function createBundle(' in line:
                    createbundle_line = i + 1  # 1-based line numbering
                    break
            
            if not createbundle_line:
                self.log_test("createBundle Function Found", False, "createBundle function not found")
                return False
            
            self.log_test("createBundle Function Found", True, f"Found at line {createbundle_line}")
            
            # Check for the fix implementation
            func_start = createbundle_line - 1
            func_end = min(func_start + 50, len(lines))  # Check ~50 lines from function start
            func_content = '\n'.join(lines[func_start:func_end])
            
            # Verify key elements of the fix
            checks = {
                "regulationSid parameter": "regulationSid" in lines[createbundle_line - 1],
                "ambiguous regulation comment": "ambiguous regulation parameters" in func_content,
                "conditional regulationSid logic": "if (regulationSid)" in func_content,
                "else clause for other params": "} else {" in func_content and ("endUserType" in func_content or "isoCountry" in func_content),
                "opts.regulationSid assignment": "opts.regulationSid = regulationSid" in func_content
            }
            
            all_passed = True
            for check_name, passed in checks.items():
                self.log_test(f"createBundle - {check_name}", passed)
                if not passed:
                    all_passed = False
            
            return all_passed
            
        except Exception as e:
            self.log_test("createBundle Bug Fix", False, f"Error reading file: {str(e)}")
            return False

    def test_notifyadmin_bug_fix(self):
        """Test 4: Bug Fix 2 - notifyAdmin is not defined"""
        try:
            # Read _index.js file
            with open(INDEX_PATH, 'r') as f:
                content = f.read()
            
            lines = content.split('\n')
            
            # Find notifyAdmin function definition (around line 514)
            notifyadmin_def_line = None
            for i, line in enumerate(lines):
                if 'const notifyAdmin = (' in line or 'const notifyAdmin=' in line:
                    notifyadmin_def_line = i + 1  # 1-based line numbering
                    break
            
            if not notifyadmin_def_line:
                self.log_test("notifyAdmin Definition Found", False, "notifyAdmin function definition not found")
                return False
            
            self.log_test("notifyAdmin Definition Found", True, f"Found at line {notifyadmin_def_line}")
            
            # Check function implementation
            func_start = notifyadmin_def_line - 1
            func_end = min(func_start + 20, len(lines))
            func_content = '\n'.join(lines[func_start:func_end])
            
            # Verify function structure
            checks = {
                "Arrow function syntax": "const notifyAdmin = (" in func_content,
                "try/catch wrapper": "try {" in func_content and "} catch" in func_content,
                "TELEGRAM_ADMIN_CHAT_ID check": "TELEGRAM_ADMIN_CHAT_ID" in func_content,
                "bot.sendMessage call": "bot?.sendMessage" in func_content or "bot.sendMessage" in func_content,
                "HTML parse_mode": "parse_mode: 'HTML'" in func_content or 'parse_mode: "HTML"' in func_content
            }
            
            all_passed = True
            for check_name, passed in checks.items():
                self.log_test(f"notifyAdmin - {check_name}", passed)
                if not passed:
                    all_passed = False
            
            # Count notifyAdmin usage sites
            usage_count = content.count('notifyAdmin(')
            expected_count = 16
            usage_correct = usage_count == expected_count
            self.log_test(f"notifyAdmin Usage Count", usage_correct, 
                         f"Found {usage_count} calls, expected {expected_count}")
            
            if not usage_correct:
                all_passed = False
            
            # Verify definition comes before first usage
            first_usage_line = None
            for i, line in enumerate(lines):
                if 'notifyAdmin(' in line and i + 1 != notifyadmin_def_line:
                    first_usage_line = i + 1
                    break
            
            if first_usage_line and notifyadmin_def_line < first_usage_line:
                self.log_test("notifyAdmin Definition Before Usage", True, 
                             f"Definition at line {notifyadmin_def_line}, first usage at line {first_usage_line}")
            elif first_usage_line:
                self.log_test("notifyAdmin Definition Before Usage", False,
                             f"Definition at line {notifyadmin_def_line}, first usage at line {first_usage_line}")
                all_passed = False
            else:
                self.log_test("notifyAdmin Definition Before Usage", False, "No usage found")
                all_passed = False
            
            return all_passed
            
        except Exception as e:
            self.log_test("notifyAdmin Bug Fix", False, f"Error reading file: {str(e)}")
            return False

    def test_services_initialization(self):
        """Test 5: Verify all services are initialized in logs"""
        try:
            import os
            log_path = "/var/log/supervisor/nodejs.out.log"
            if not os.path.exists(log_path):
                self.log_test("Services Initialization", False, "nodejs.out.log not found")
                return False
            
            with open(log_path, 'r') as f:
                log_content = f.read()
            
            # Check for key service initializations
            expected_services = [
                "[AudioLibrary] Initialized",
                "[BulkCall] Service initialized",
                "[VoiceService] Initialized",
                "[LeadJobs] Persistence initialized",
                "[BundleChecker] Scheduled every 30min"
            ]
            
            all_services_found = True
            for service in expected_services:
                if service in log_content:
                    self.log_test(f"Service Init - {service.split(']')[0][1:]}", True)
                else:
                    self.log_test(f"Service Init - {service.split(']')[0][1:]}", False)
                    all_services_found = False
            
            return all_services_found
            
        except Exception as e:
            self.log_test("Services Initialization", False, f"Error reading logs: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all tests and return summary"""
        print("\n🚀 Starting Bug Fix Verification Tests...")
        print("-" * 40)
        
        # Run tests in order
        tests_passed = 0
        total_tests = 0
        
        test_functions = [
            self.test_service_health,
            self.test_error_logs_empty, 
            self.test_createbundle_bug_fix,
            self.test_notifyadmin_bug_fix,
            self.test_services_initialization
        ]
        
        for test_func in test_functions:
            result = test_func()
            total_tests += 1
            if result:
                tests_passed += 1
            print()  # Blank line between tests
        
        # Summary
        print("=" * 60)
        print("📊 FINAL TEST SUMMARY")
        print("=" * 60)
        
        for result in self.results:
            status = "✅" if result["passed"] else "❌"
            print(f"{status} {result['test']}")
            if result["details"] and not result["passed"]:
                print(f"   {result['details']}")
        
        success_rate = (tests_passed / total_tests) * 100
        print(f"\n🎯 SUCCESS RATE: {tests_passed}/{total_tests} tests passed ({success_rate:.1f}%)")
        
        if tests_passed == total_tests:
            print("🎉 ALL BUG FIXES VERIFIED SUCCESSFULLY!")
            return True
        else:
            print("⚠️  Some tests failed - see details above")
            return False

if __name__ == "__main__":
    tester = NomadlyBugFixTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)