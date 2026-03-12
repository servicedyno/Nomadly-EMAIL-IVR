#!/usr/bin/env python3
"""
Backend Testing for Nomadly Telegram Bot - viewHostingPlan TDZ Crash Fix
==========================================================================
This test verifies the fix for the TDZ (Temporal Dead Zone) issue in the viewHostingPlanDetails function
where isWeekly was used before its declaration, causing ReferenceError crashes.
"""

import requests
import json
import subprocess
import os
import sys
from datetime import datetime

class TDZFixTester:
    def __init__(self):
        self.base_url = "http://localhost:5000"
        self.test_results = []
        
    def log_test_result(self, test_name, success, details=""):
        """Log test results for reporting"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            'test': test_name,
            'success': success,
            'status': status,
            'details': details
        })
        print(f"{status}: {test_name}")
        if details and not success:
            print(f"    Details: {details}")
            
    def test_nodejs_health(self):
        """Test 1: Node.js Health Check"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["status", "database"]
                
                if data.get("status") == "healthy" and data.get("database") == "connected":
                    self.log_test_result("Node.js Health Check", True, 
                        f"Status: {data.get('status')}, Database: {data.get('database')}")
                    return True
                else:
                    self.log_test_result("Node.js Health Check", False, 
                        f"Invalid response data: {data}")
                    return False
            else:
                self.log_test_result("Node.js Health Check", False, 
                    f"HTTP {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_test_result("Node.js Health Check", False, f"Request failed: {e}")
            return False
            
    def test_error_log_empty(self):
        """Test 2: Verify nodejs.err.log is empty"""
        try:
            error_log_path = "/var/log/supervisor/nodejs.err.log"
            
            if os.path.exists(error_log_path):
                file_size = os.path.getsize(error_log_path)
                if file_size == 0:
                    self.log_test_result("Error Log Empty Check", True, 
                        f"{error_log_path} is empty (0 bytes)")
                    return True
                else:
                    # Read first 500 chars of error log to see what errors exist
                    with open(error_log_path, 'r') as f:
                        error_content = f.read(500)
                    self.log_test_result("Error Log Empty Check", False, 
                        f"{error_log_path} has {file_size} bytes. Content: {error_content}")
                    return False
            else:
                self.log_test_result("Error Log Empty Check", False, 
                    f"{error_log_path} does not exist")
                return False
                
        except Exception as e:
            self.log_test_result("Error Log Empty Check", False, f"Error checking log: {e}")
            return False
            
    def test_isweekly_tdz_fix(self):
        """Test 3: Verify isWeekly TDZ fix in viewHostingPlanDetails function"""
        try:
            index_js_path = "/app/js/_index.js"
            
            if not os.path.exists(index_js_path):
                self.log_test_result("isWeekly TDZ Fix", False, f"{index_js_path} not found")
                return False
            
            # Read the file and find the viewHostingPlanDetails function
            with open(index_js_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Find the function start
            function_start_line = None
            for i, line in enumerate(lines):
                if 'viewHostingPlanDetails: async (domain) => {' in line:
                    function_start_line = i
                    break
            
            if function_start_line is None:
                self.log_test_result("isWeekly TDZ Fix", False, 
                    "viewHostingPlanDetails function not found")
                return False
            
            # Find the relevant lines within the function (next 50 lines should be enough)
            function_lines = lines[function_start_line:function_start_line + 50]
            
            isweekly_declaration_line = None
            autorenew_usage_line = None
            button_usage_line = None
            
            for i, line in enumerate(function_lines):
                line_content = line.strip()
                
                # Find isWeekly declaration
                if 'const isWeekly = (plan.plan' in line_content and '.includes(\'week\')' in line_content:
                    isweekly_declaration_line = function_start_line + i + 1  # 1-based line number
                
                # Find autoRenewStatus usage of isWeekly
                if 'const autoRenewStatus = isWeekly ?' in line_content:
                    autorenew_usage_line = function_start_line + i + 1
                
                # Find button usage of isWeekly
                if 'if (!isWeekly) buttons.push' in line_content:
                    button_usage_line = function_start_line + i + 1
            
            # Verify all parts were found
            missing_parts = []
            if isweekly_declaration_line is None:
                missing_parts.append("isWeekly declaration")
            if autorenew_usage_line is None:
                missing_parts.append("autoRenewStatus usage")
            if button_usage_line is None:
                missing_parts.append("button conditional usage")
            
            if missing_parts:
                self.log_test_result("isWeekly TDZ Fix", False, 
                    f"Missing parts: {', '.join(missing_parts)}")
                return False
            
            # Verify the fix: declaration must come BEFORE usage
            declaration_before_autorenew = isweekly_declaration_line < autorenew_usage_line
            declaration_before_button = isweekly_declaration_line < button_usage_line
            
            if declaration_before_autorenew and declaration_before_button:
                self.log_test_result("isWeekly TDZ Fix", True, 
                    f"Declaration (line {isweekly_declaration_line}) comes before usage "
                    f"(autoRenew: line {autorenew_usage_line}, button: line {button_usage_line})")
                return True
            else:
                self.log_test_result("isWeekly TDZ Fix", False, 
                    f"TDZ issue still exists! Declaration: line {isweekly_declaration_line}, "
                    f"autoRenew usage: line {autorenew_usage_line}, "
                    f"button usage: line {button_usage_line}")
                return False
                
        except Exception as e:
            self.log_test_result("isWeekly TDZ Fix", False, f"Error analyzing code: {e}")
            return False
            
    def test_isweekly_occurrences(self):
        """Test 4: Verify exactly 3 isWeekly occurrences, all after declaration"""
        try:
            # Use grep to find all isWeekly occurrences
            result = subprocess.run(
                ['grep', '-n', 'isWeekly', '/app/js/_index.js'],
                capture_output=True, text=True
            )
            
            if result.returncode != 0:
                self.log_test_result("isWeekly Occurrences Check", False, 
                    "No isWeekly occurrences found or grep failed")
                return False
            
            lines = result.stdout.strip().split('\n')
            
            if len(lines) != 3:
                self.log_test_result("isWeekly Occurrences Check", False, 
                    f"Expected 3 occurrences, found {len(lines)}: {lines}")
                return False
            
            # Verify the pattern: declaration, then usages
            expected_patterns = [
                ('const isWeekly =', 'declaration'),
                ('isWeekly ?', 'autoRenew usage'),
                ('!isWeekly)', 'button conditional')
            ]
            
            for i, (line, (pattern, description)) in enumerate(zip(lines, expected_patterns)):
                if pattern not in line:
                    self.log_test_result("isWeekly Occurrences Check", False, 
                        f"Line {i+1} doesn't match expected pattern '{pattern}': {line}")
                    return False
            
            self.log_test_result("isWeekly Occurrences Check", True, 
                f"Found exactly 3 occurrences in correct order:\n" + 
                "\n".join([f"  {i+1}. {line.strip()}" for i, line in enumerate(lines)]))
            return True
            
        except Exception as e:
            self.log_test_result("isWeekly Occurrences Check", False, f"Error checking occurrences: {e}")
            return False
            
    def test_no_other_tdz_issues(self):
        """Test 5: Search for other potential TDZ issues in the codebase"""
        try:
            # Look for common TDZ error patterns in logs
            log_paths = [
                "/var/log/supervisor/nodejs.out.log",
                "/var/log/supervisor/nodejs.err.log"
            ]
            
            tdz_errors_found = []
            
            for log_path in log_paths:
                if os.path.exists(log_path) and os.path.getsize(log_path) > 0:
                    # Search for TDZ-related error patterns
                    result = subprocess.run(
                        ['grep', '-i', '-n', 'Cannot access.*before initialization', log_path],
                        capture_output=True, text=True
                    )
                    
                    if result.returncode == 0:  # Found matches
                        tdz_errors_found.extend(result.stdout.strip().split('\n'))
            
            if tdz_errors_found:
                self.log_test_result("No Other TDZ Issues", False, 
                    f"Found TDZ errors in logs: {tdz_errors_found}")
                return False
            else:
                self.log_test_result("No Other TDZ Issues", True, 
                    "No TDZ errors found in current logs")
                return True
                
        except Exception as e:
            self.log_test_result("No Other TDZ Issues", False, f"Error checking for TDZ issues: {e}")
            return False

    def run_all_tests(self):
        """Run all tests and generate summary report"""
        print(f"{'='*70}")
        print(f"NOMADLY TELEGRAM BOT - viewHostingPlan TDZ CRASH FIX TESTING")
        print(f"{'='*70}")
        print(f"Test execution started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Execute all tests
        tests = [
            self.test_nodejs_health,
            self.test_error_log_empty, 
            self.test_isweekly_tdz_fix,
            self.test_isweekly_occurrences,
            self.test_no_other_tdz_issues
        ]
        
        passed = 0
        total = len(tests)
        
        for test_func in tests:
            if test_func():
                passed += 1
            print()  # Add spacing between tests
        
        # Generate summary
        print(f"{'='*70}")
        print(f"TEST SUMMARY")
        print(f"{'='*70}")
        
        success_rate = (passed / total) * 100
        
        print(f"Tests passed: {passed}/{total} ({success_rate:.1f}%)")
        print()
        
        # Detailed results
        for result in self.test_results:
            print(f"{result['status']}: {result['test']}")
            if result['details']:
                # Indent details for readability
                detail_lines = result['details'].split('\n')
                for line in detail_lines:
                    if line.strip():
                        print(f"    {line}")
        
        print()
        print(f"{'='*70}")
        
        if success_rate == 100:
            print("🎉 ALL TESTS PASSED! viewHostingPlan TDZ crash fix is working correctly.")
        elif success_rate >= 80:
            print(f"⚠️  Most tests passed ({success_rate:.1f}%). Check failed tests above.")
        else:
            print(f"❌ CRITICAL ISSUES FOUND ({success_rate:.1f}% pass rate). Review failures above.")
        
        print(f"{'='*70}")
        
        return success_rate == 100

if __name__ == "__main__":
    tester = TDZFixTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)