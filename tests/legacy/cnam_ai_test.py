#!/usr/bin/env python3
"""
Backend Test Script for Nomadly Node.js Application
Testing CNAM optimizations and AI Support Chat Module
"""

import requests
import time
import json
import subprocess
import sys
from typing import Dict, List, Tuple, Optional

class BackendTester:
    def __init__(self):
        self.base_url = "http://localhost:5000"
        self.results = []
        self.errors = []
        
    def log_result(self, test_name: str, success: bool, details: str = "", critical: bool = False):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "critical": critical,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.results.append(result)
        
        status = "✅" if success else "❌"
        critical_marker = " (CRITICAL)" if critical else ""
        print(f"{status} {test_name}{critical_marker}")
        if details:
            print(f"   Details: {details}")
        print()
    
    def test_health_endpoint(self) -> bool:
        """Test GET /health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_keys = {"status", "database"}
                
                if all(key in data for key in expected_keys):
                    if data["status"] == "healthy" and data["database"] == "connected":
                        self.log_result("Health Endpoint", True, 
                                      f"Status: {data['status']}, Database: {data['database']}")
                        return True
                    else:
                        self.log_result("Health Endpoint", False, 
                                      f"Invalid status or database state: {data}", critical=True)
                        return False
                else:
                    self.log_result("Health Endpoint", False, 
                                  f"Missing required keys. Got: {list(data.keys())}", critical=True)
                    return False
            else:
                self.log_result("Health Endpoint", False, 
                              f"HTTP {response.status_code}: {response.text}", critical=True)
                return False
                
        except requests.exceptions.RequestException as e:
            self.log_result("Health Endpoint", False, f"Request failed: {str(e)}", critical=True)
            return False
    
    def check_supervisor_logs(self) -> Tuple[bool, bool, bool]:
        """Check supervisor logs for AI initialization and errors"""
        ai_initialized = False
        mongo_initialized = False
        no_errors = True
        
        try:
            # Check for AI Support initialization messages
            result = subprocess.run([
                "grep", "-i", "AI Support", "/var/log/supervisor/nodejs.out.log"
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                output_lines = result.stdout.strip().split('\n')
                for line in output_lines:
                    if "OpenAI initialized" in line:
                        ai_initialized = True
                    if "MongoDB collections initialized" in line:
                        mongo_initialized = True
            
            # Check error log is empty
            result = subprocess.run([
                "ls", "-la", "/var/log/supervisor/nodejs.err.log"
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                # Check if error log is empty (size 0)
                if " 0 " in result.stdout:
                    no_errors = True
                else:
                    no_errors = False
                    # Get error content if file is not empty
                    error_result = subprocess.run([
                        "cat", "/var/log/supervisor/nodejs.err.log"
                    ], capture_output=True, text=True)
                    if error_result.returncode == 0 and error_result.stdout.strip():
                        self.errors.append(f"Error log content: {error_result.stdout[:500]}")
            
            return ai_initialized, mongo_initialized, no_errors
            
        except Exception as e:
            self.log_result("Supervisor Logs Check", False, f"Failed to check logs: {str(e)}")
            return False, False, False
    
    def test_ai_support_logs(self) -> bool:
        """Test AI support initialization in logs"""
        ai_init, mongo_init, no_errors = self.check_supervisor_logs()
        
        if ai_init and mongo_init and no_errors:
            self.log_result("AI Support Initialization", True, 
                          "OpenAI and MongoDB collections initialized, no errors in error log")
            return True
        else:
            details = []
            if not ai_init:
                details.append("OpenAI not initialized")
            if not mongo_init:
                details.append("MongoDB collections not initialized")
            if not no_errors:
                details.append("Errors found in nodejs.err.log")
            
            self.log_result("AI Support Initialization", False, 
                          "; ".join(details), critical=True)
            return False
    
    def verify_cnam_optimizations(self) -> bool:
        """Verify CNAM optimization code exists in validatePhoneBulk.js"""
        try:
            with open('/app/js/validatePhoneBulk.js', 'r') as f:
                content = f.read()
            
            # Check for key CNAM optimization features
            checks = {
                "CNAM_MISS_THRESHOLD": "CNAM_MISS_THRESHOLD = 50" in content,
                "VoIP Carrier Pre-filter": "VOIP_WHOLESALE_CARRIERS" in content and "VoIP Carrier" in content,
                "Area Code Yield Tracking": "AREA_CODE_MIN_YIELD" in content and "acYield" in content,
                "CNAM Cost Cap": "CNAM_COST_CAP_MULTIPLIER" in content and "estimatedCost" in content,
                "Partial Delivery Logic": "_partialReason" in content and "_deliveredCount" in content,
            }
            
            passed_checks = sum(1 for check in checks.values() if check)
            total_checks = len(checks)
            
            if passed_checks == total_checks:
                self.log_result("CNAM Optimizations Code", True, 
                              f"All {total_checks} optimization features found")
                return True
            else:
                failed_checks = [name for name, passed in checks.items() if not passed]
                self.log_result("CNAM Optimizations Code", False, 
                              f"{passed_checks}/{total_checks} checks passed. Missing: {', '.join(failed_checks)}")
                return False
                
        except Exception as e:
            self.log_result("CNAM Optimizations Code", False, f"Failed to verify code: {str(e)}")
            return False
    
    def verify_ai_support_integration(self) -> bool:
        """Verify AI support integration in main application"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check for key AI support integration points
            checks = {
                "AI Support Import": "require('./ai-support.js')" in content,
                "AI Initialization": "initAiSupport(db)" in content,
                "AI Response Handler": "getAiResponse(chatId, message)" in content,
                "AI Enabled Check": "isAiEnabled()" in content,
                "Escalation Logic": "escalate" in content and "NEEDS HUMAN ATTENTION" in content,
            }
            
            passed_checks = sum(1 for check in checks.values() if check)
            total_checks = len(checks)
            
            if passed_checks == total_checks:
                self.log_result("AI Support Integration Code", True, 
                              f"All {total_checks} integration features found")
                return True
            else:
                failed_checks = [name for name, passed in checks.items() if not passed]
                self.log_result("AI Support Integration Code", False, 
                              f"{passed_checks}/{total_checks} checks passed. Missing: {', '.join(failed_checks)}")
                return False
                
        except Exception as e:
            self.log_result("AI Support Integration Code", False, f"Failed to verify integration: {str(e)}")
            return False
    
    def check_ai_support_module(self) -> bool:
        """Verify ai-support.js module exists and has required functions"""
        try:
            with open('/app/js/ai-support.js', 'r') as f:
                content = f.read()
            
            # Check for required exports and functions
            required_functions = [
                "initAiSupport",
                "getAiResponse", 
                "clearHistory",
                "needsEscalation",
                "isAiEnabled"
            ]
            
            missing_functions = []
            for func in required_functions:
                if func not in content:
                    missing_functions.append(func)
            
            if not missing_functions:
                self.log_result("AI Support Module", True, 
                              f"All required functions present: {', '.join(required_functions)}")
                return True
            else:
                self.log_result("AI Support Module", False, 
                              f"Missing functions: {', '.join(missing_functions)}")
                return False
                
        except FileNotFoundError:
            self.log_result("AI Support Module", False, "ai-support.js file not found", critical=True)
            return False
        except Exception as e:
            self.log_result("AI Support Module", False, f"Failed to check module: {str(e)}")
            return False
    
    def check_service_status(self) -> bool:
        """Check Node.js service status via supervisor"""
        try:
            result = subprocess.run([
                "sudo", "supervisorctl", "status", "nodejs"
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                if "RUNNING" in result.stdout:
                    self.log_result("Node.js Service Status", True, 
                                  "Service is running via supervisorctl")
                    return True
                else:
                    self.log_result("Node.js Service Status", False, 
                                  f"Service not running: {result.stdout}", critical=True)
                    return False
            else:
                self.log_result("Node.js Service Status", False, 
                              f"supervisorctl command failed: {result.stderr}", critical=True)
                return False
                
        except Exception as e:
            self.log_result("Node.js Service Status", False, f"Failed to check service: {str(e)}")
            return False
    
    def count_cnam_activity(self) -> bool:
        """Count cnamMissStreak occurrences in logs to verify CNAM optimization is active"""
        try:
            result = subprocess.run([
                "grep", "-c", "cnamMissStreak", "/var/log/supervisor/nodejs.out.log"
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                count = int(result.stdout.strip())
                if count > 0:
                    self.log_result("CNAM Activity Verification", True, 
                                  f"Found {count} cnamMissStreak entries in logs - CNAM optimization is active")
                    return True
                else:
                    self.log_result("CNAM Activity Verification", False, 
                                  "No cnamMissStreak entries found - CNAM optimization may not be active")
                    return False
            else:
                # grep returns 1 when no matches found, which is OK for this test
                self.log_result("CNAM Activity Verification", False, 
                              "No cnamMissStreak entries found in logs")
                return False
                
        except Exception as e:
            self.log_result("CNAM Activity Verification", False, f"Failed to check CNAM activity: {str(e)}")
            return False
    
    def run_all_tests(self) -> None:
        """Run all backend tests"""
        print("=" * 60)
        print("NOMADLY BACKEND TESTING - CNAM & AI SUPPORT")
        print("=" * 60)
        print()
        
        # Critical health checks first
        health_ok = self.test_health_endpoint()
        service_ok = self.check_service_status()
        
        if not health_ok or not service_ok:
            print("❌ CRITICAL: Basic service health failed. Stopping tests.")
            self.print_summary()
            return
        
        # AI Support tests
        self.check_ai_support_module()
        self.test_ai_support_logs()
        self.verify_ai_support_integration()
        
        # CNAM optimization tests
        self.verify_cnam_optimizations()
        self.count_cnam_activity()
        
        self.print_summary()
    
    def print_summary(self) -> None:
        """Print test summary"""
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        critical_failures = [r for r in self.results if not r["success"] and r.get("critical", False)]
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        print()
        
        if critical_failures:
            print("🚨 CRITICAL FAILURES:")
            for failure in critical_failures:
                print(f"   • {failure['test']}: {failure['details']}")
            print()
        
        if self.errors:
            print("⚠️  ADDITIONAL ERRORS:")
            for error in self.errors:
                print(f"   • {error}")
            print()
        
        # Overall status
        if critical_failures:
            print("❌ OVERALL STATUS: CRITICAL ISSUES FOUND")
        elif passed_tests == total_tests:
            print("✅ OVERALL STATUS: ALL TESTS PASSED")
        else:
            print("⚠️  OVERALL STATUS: SOME NON-CRITICAL ISSUES FOUND")

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()