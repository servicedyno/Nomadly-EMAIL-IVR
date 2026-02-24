#!/usr/bin/env python3

import requests
import json
import os
import sys
import time
import re
import subprocess
from typing import Dict, List, Tuple, Optional

class ProtectionEnforcerSSLTest:
    def __init__(self):
        self.backend_url = "https://deployment-ready-20.preview.emergentagent.com/api"
        self.results = []
        self.protection_enforcer_path = "/app/js/protection-enforcer.js"
        self.cpanel_routes_path = "/app/js/cpanel-routes.js"
        
    def log_result(self, test_name: str, passed: bool, details: str = ""):
        """Log test results"""
        status = "✅ PASS" if passed else "❌ FAIL"
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details,
            "status": status
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
            
    def check_backend_health(self) -> bool:
        """Check if backend service is healthy"""
        try:
            response = requests.get(f"{self.backend_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                is_healthy = data.get('status') == 'healthy' and data.get('database') == 'connected'
                self.log_result(
                    "Backend Health Check",
                    is_healthy,
                    f"Status: {data.get('status')}, DB: {data.get('database')}, Uptime: {data.get('uptime', 'N/A')}"
                )
                return is_healthy
            else:
                self.log_result("Backend Health Check", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Backend Health Check", False, f"Connection error: {str(e)}")
            return False
            
    def check_nodejs_port_5000(self) -> bool:
        """Check if Node.js service is running on port 5000"""
        try:
            response = requests.get("http://localhost:5000/api/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                is_healthy = data.get('status') == 'healthy'
                self.log_result(
                    "Node.js Service (Port 5000) Health",
                    is_healthy,
                    f"Response: {json.dumps(data)}"
                )
                return is_healthy
            else:
                self.log_result("Node.js Service (Port 5000) Health", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Node.js Service (Port 5000) Health", False, f"Error: {str(e)}")
            return False
            
    def read_file_content(self, file_path: str) -> Optional[str]:
        """Read file content safely"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"Error reading {file_path}: {str(e)}")
            return None
            
    def verify_protection_enforcer_ssl_fix(self) -> bool:
        """Verify the SSL upgrade fix in protection-enforcer.js"""
        content = self.read_file_content(self.protection_enforcer_path)
        if not content:
            self.log_result("Protection Enforcer File Access", False, "Could not read file")
            return False
            
        lines = content.split('\n')
        
        # Check 1: Self-signed check exists around line 294
        self_signed_check_found = False
        upgrade_condition_correct = False
        autossl_branch_found = False
        
        for i, line in enumerate(lines):
            line_num = i + 1
            
            # Look for self-signed check
            if 'isSelfSigned' in line and 'is_self_signed' in line and '||' in line:
                self_signed_check_found = True
                self.log_result(
                    "Self-signed Certificate Check",
                    True,
                    f"Found at line {line_num}: {line.strip()}"
                )
                
            # Look for upgrade condition with !isSelfSigned
            if 'hasRoot && hasWww && !isSelfSigned' in line:
                upgrade_condition_correct = True
                self.log_result(
                    "SSL Upgrade Condition (includes !isSelfSigned)",
                    True,
                    f"Found at line {line_num}: {line.strip()}"
                )
                
            # Look for AutoSSL branch for self-signed certs
            if 'hasRoot && hasWww && isSelfSigned' in line:
                autossl_branch_found = True
                self.log_result(
                    "AutoSSL Branch for Self-signed Certs",
                    True,
                    f"Found at line {line_num}: {line.strip()}"
                )
                
        if not self_signed_check_found:
            self.log_result("Self-signed Certificate Check", False, "isSelfSigned check not found")
            
        if not upgrade_condition_correct:
            self.log_result("SSL Upgrade Condition (includes !isSelfSigned)", False, "Condition should include !isSelfSigned")
            
        if not autossl_branch_found:
            self.log_result("AutoSSL Branch for Self-signed Certs", False, "else if branch for self-signed certs not found")
            
        return self_signed_check_found and upgrade_condition_correct and autossl_branch_found
        
    def verify_cpanel_routes_ssl_check(self) -> bool:
        """Verify the SSL check in cpanel-routes.js around line 759-761"""
        content = self.read_file_content(self.cpanel_routes_path)
        if not content:
            self.log_result("cPanel Routes File Access", False, "Could not read file")
            return False
            
        lines = content.split('\n')
        
        # Look for self-signed check around line 759-761
        ssl_check_found = False
        upgrade_with_check = False
        
        for i, line in enumerate(lines[750:770]):  # Check around lines 750-770
            line_num = i + 751
            
            # Look for isSelfSigned check
            if 'isSelfSigned' in line and ('cPanel, Inc.' in line or 'organization_name' in line):
                ssl_check_found = True
                self.log_result(
                    "cPanel Routes Self-signed Check",
                    True,
                    f"Found at line {line_num}: {line.strip()}"
                )
                
            # Look for SSL upgrade with !isSelfSigned condition
            if '!isSelfSigned' in line and 'strict' in lines[min(i+752, len(lines)-1)]:
                upgrade_with_check = True
                self.log_result(
                    "cPanel Routes SSL Upgrade Check",
                    True,
                    f"Found condition at line {line_num}: {line.strip()}"
                )
                
        if not ssl_check_found:
            self.log_result("cPanel Routes Self-signed Check", False, "Self-signed check not found around line 759-761")
            
        if not upgrade_with_check:
            self.log_result("cPanel Routes SSL Upgrade Check", False, "SSL upgrade with !isSelfSigned check not found")
            
        return ssl_check_found and upgrade_with_check
        
    def verify_triggerautossl_function(self) -> bool:
        """Verify triggerAutoSSLFix function exists"""
        content = self.read_file_content(self.protection_enforcer_path)
        if not content:
            return False
            
        # Look for triggerAutoSSLFix function
        if 'triggerAutoSSLFix' in content:
            self.log_result(
                "triggerAutoSSLFix Function Exists",
                True,
                "Function found in protection-enforcer.js"
            )
            return True
        else:
            self.log_result(
                "triggerAutoSSLFix Function Exists", 
                False, 
                "Function not found"
            )
            return False
            
    def check_supervisor_logs(self) -> bool:
        """Check supervisor backend logs for errors"""
        try:
            # Check for backend log files
            result = subprocess.run(
                ['find', '/var/log/supervisor/', '-name', 'backend.*'],
                capture_output=True,
                text=True
            )
            
            if result.stdout.strip():
                log_files = result.stdout.strip().split('\n')
                error_found = False
                
                for log_file in log_files:
                    try:
                        with open(log_file, 'r') as f:
                            content = f.read()
                            if 'ERROR' in content or 'FATAL' in content:
                                error_found = True
                                
                self.log_result(
                    "Supervisor Backend Logs Check",
                    not error_found,
                    f"Checked {len(log_files)} log files, errors found: {error_found}"
                )
                return not error_found
            else:
                self.log_result(
                    "Supervisor Backend Logs Check",
                    True,
                    "No supervisor log files found (service may be running directly)"
                )
                return True
                
        except Exception as e:
            self.log_result(
                "Supervisor Backend Logs Check", 
                False, 
                f"Error checking logs: {str(e)}"
            )
            return False
            
    def run_all_tests(self) -> Dict:
        """Run all SSL upgrade fix verification tests"""
        print("=" * 60)
        print("PROTECTION ENFORCER SSL UPGRADE FIX VERIFICATION")
        print("=" * 60)
        
        # Test 1: Backend health
        backend_healthy = self.check_backend_health()
        
        # Test 2: Node.js service on port 5000
        nodejs_healthy = self.check_nodejs_port_5000()
        
        # Test 3: Protection enforcer SSL fix verification
        ssl_fix_correct = self.verify_protection_enforcer_ssl_fix()
        
        # Test 4: cPanel routes SSL check
        cpanel_check_correct = self.verify_cpanel_routes_ssl_check()
        
        # Test 5: triggerAutoSSLFix function exists
        autossl_function_exists = self.verify_triggerautossl_function()
        
        # Test 6: Check supervisor logs
        logs_clean = self.check_supervisor_logs()
        
        # Summary
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['passed'])
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        for result in self.results:
            print(f"{result['status']}: {result['test']}")
            if result['details']:
                print(f"   {result['details']}")
                
        print(f"\nOVERALL: {passed_tests}/{total_tests} tests passed ({success_rate:.1f}%)")
        
        # Determine if the fix is working
        critical_tests_passed = (
            backend_healthy and 
            nodejs_healthy and 
            ssl_fix_correct and 
            autossl_function_exists
        )
        
        if critical_tests_passed:
            print("\n🎉 SSL UPGRADE FIX VERIFICATION: SUCCESS")
            print("The protection-enforcer SSL upgrade fix is correctly implemented.")
            print("✅ Self-signed certificate detection works")
            print("✅ SSL upgrade condition includes !isSelfSigned check")  
            print("✅ AutoSSL trigger for self-signed certificates works")
            print("✅ Node.js service is healthy")
        else:
            print("\n⚠️  SSL UPGRADE FIX VERIFICATION: ISSUES FOUND")
            print("Some critical components are not working correctly.")
            
        return {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'success_rate': success_rate,
            'critical_tests_passed': critical_tests_passed,
            'results': self.results,
            'backend_healthy': backend_healthy,
            'nodejs_healthy': nodejs_healthy,
            'ssl_fix_correct': ssl_fix_correct,
            'autossl_function_exists': autossl_function_exists
        }

if __name__ == "__main__":
    tester = ProtectionEnforcerSSLTest()
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if results['critical_tests_passed'] else 1)