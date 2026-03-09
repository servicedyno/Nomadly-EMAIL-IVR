#!/usr/bin/env python3
"""
Railway Crash Log Bug Fixes Verification Test

Tests 4 critical bug fixes in /app/js/_index.js after Railway crash log analysis:
1. TDZ Fix (line ~2154): Database connection check without t.dbConnecting reference
2. Marketplace Scoping Fix (line ~1640): String literal 'mpHome' instead of a.mpHome  
3. walletOk Safety Fix (line ~10576): Handler type checking before calling
4. t.failedAudio TDZ Fix (line ~1819): Hardcoded string instead of t.failedAudio

Node.js app runs on port 5000 (proxied through FastAPI on 8001).
"""

import requests
import json
import subprocess
import re
import os
from datetime import datetime

class RailwayBugFixVerifier:
    def __init__(self):
        self.base_url = "http://localhost:5000"
        self.results = {
            "test_timestamp": datetime.now().isoformat(),
            "fixes_verified": [],
            "test_results": {}
        }
        
    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def test_nodejs_health(self):
        """Verify Node.js health endpoint returns expected response"""
        self.log("Testing Node.js health endpoint...")
        
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                expected_fields = ["status", "database"]
                
                if all(field in data for field in expected_fields):
                    if data["status"] == "healthy" and data["database"] == "connected":
                        self.log("✅ Node.js health check PASSED")
                        self.results["test_results"]["nodejs_health"] = {
                            "status": "PASS",
                            "response": data,
                            "details": "Service healthy with database connected"
                        }
                        return True
                    else:
                        self.log(f"❌ Health check failed: {data}")
                        self.results["test_results"]["nodejs_health"] = {
                            "status": "FAIL", 
                            "response": data,
                            "details": "Service not healthy or database not connected"
                        }
                        return False
                else:
                    self.log(f"❌ Missing expected fields in health response: {data}")
                    self.results["test_results"]["nodejs_health"] = {
                        "status": "FAIL",
                        "response": data,
                        "details": f"Missing fields: {set(expected_fields) - set(data.keys())}"
                    }
                    return False
            else:
                self.log(f"❌ Health endpoint returned status {response.status_code}")
                self.results["test_results"]["nodejs_health"] = {
                    "status": "FAIL",
                    "status_code": response.status_code,
                    "details": f"Unexpected HTTP status: {response.status_code}"
                }
                return False
                
        except Exception as e:
            self.log(f"❌ Health check failed with error: {e}")
            self.results["test_results"]["nodejs_health"] = {
                "status": "FAIL",
                "error": str(e),
                "details": "Exception during health check"
            }
            return False
            
    def test_supervisor_logs(self):
        """Check supervisor logs for syntax/runtime errors"""
        self.log("Checking supervisor error logs...")
        
        try:
            # Check if error log exists and get its size
            error_log_path = "/var/log/supervisor/nodejs.err.log"
            
            if os.path.exists(error_log_path):
                # Get log size
                log_size = os.path.getsize(error_log_path)
                
                # Read recent errors (last 100 lines)
                result = subprocess.run(
                    ["tail", "-100", error_log_path], 
                    capture_output=True, 
                    text=True
                )
                
                error_content = result.stdout.strip()
                
                # Check for critical syntax errors or crashes related to our fixes
                critical_patterns = [
                    r"ReferenceError.*dbConnecting",
                    r"ReferenceError.*failedAudio", 
                    r"TypeError.*walletOk.*is not a function",
                    r"ReferenceError.*mpHome",
                    r"SyntaxError",
                    r"Cannot access.*before initialization"
                ]
                
                critical_errors = []
                for pattern in critical_patterns:
                    matches = re.findall(pattern, error_content, re.IGNORECASE)
                    if matches:
                        critical_errors.extend(matches)
                
                if critical_errors:
                    self.log(f"❌ Found critical errors in logs: {critical_errors}")
                    self.results["test_results"]["supervisor_logs"] = {
                        "status": "FAIL",
                        "log_size_bytes": log_size,
                        "critical_errors": critical_errors,
                        "details": "Critical errors found that may relate to our fixes"
                    }
                    return False
                else:
                    # Minor errors are acceptable (like scheduled job issues)
                    self.log(f"✅ No critical errors found (log size: {log_size} bytes)")
                    self.results["test_results"]["supervisor_logs"] = {
                        "status": "PASS",
                        "log_size_bytes": log_size,
                        "critical_errors": [],
                        "details": "No critical syntax/runtime errors found"
                    }
                    return True
            else:
                self.log("❌ Error log file not found")
                self.results["test_results"]["supervisor_logs"] = {
                    "status": "FAIL",
                    "details": "Error log file does not exist"
                }
                return False
                
        except Exception as e:
            self.log(f"❌ Error checking logs: {e}")
            self.results["test_results"]["supervisor_logs"] = {
                "status": "FAIL",
                "error": str(e),
                "details": "Exception while checking supervisor logs"
            }
            return False
            
    def verify_code_fixes(self):
        """Verify the 4 specific code fixes in _index.js"""
        self.log("Verifying code fixes in /app/js/_index.js...")
        
        try:
            with open("/app/js/_index.js", "r") as f:
                content = f.read()
            
            fixes_results = {}
            
            # Fix 1: TDZ Fix - No t.dbConnecting references
            self.log("Checking Fix 1: TDZ Fix (no t.dbConnecting references)")
            if "t.dbConnecting" not in content:
                self.log("✅ Fix 1 VERIFIED: No t.dbConnecting references found")
                fixes_results["fix_1_tdz_dbconnecting"] = {
                    "status": "PASS",
                    "details": "No t.dbConnecting references found - TDZ error prevented"
                }
            else:
                self.log("❌ Fix 1 FAILED: t.dbConnecting references still exist")
                fixes_results["fix_1_tdz_dbconnecting"] = {
                    "status": "FAIL", 
                    "details": "Found t.dbConnecting references that would cause TDZ error"
                }
            
            # Fix 2: Marketplace Scoping Fix - Check for correct 'mpHome' usage at line ~1640
            self.log("Checking Fix 2: Marketplace Scoping Fix ('mpHome' string literal)")
            lines = content.split('\n')
            
            # Find the specific line around 1640
            marketplace_fix_found = False
            for i, line in enumerate(lines[1635:1645], 1636):
                if "sellerAction === 'mpHome'" in line:
                    self.log(f"✅ Fix 2 VERIFIED: Found 'mpHome' string literal at line {i}")
                    fixes_results["fix_2_marketplace_scoping"] = {
                        "status": "PASS",
                        "line_number": i,
                        "details": "Uses string literal 'mpHome' instead of a.mpHome"
                    }
                    marketplace_fix_found = True
                    break
            
            if not marketplace_fix_found:
                self.log("❌ Fix 2 FAILED: 'mpHome' string literal not found at expected location")
                fixes_results["fix_2_marketplace_scoping"] = {
                    "status": "FAIL",
                    "details": "Expected 'mpHome' string literal not found around line 1640"
                }
            
            # Fix 3: walletOk Safety Fix - Check for handler type checking
            self.log("Checking Fix 3: walletOk Safety Fix (handler type checking)")
            walletok_pattern = r"typeof handler !== 'function'"
            if re.search(walletok_pattern, content):
                self.log("✅ Fix 3 VERIFIED: Handler type checking found")
                fixes_results["fix_3_walletok_safety"] = {
                    "status": "PASS",
                    "details": "Handler type checking implemented to prevent crashes"
                }
            else:
                self.log("❌ Fix 3 FAILED: Handler type checking not found")
                fixes_results["fix_3_walletok_safety"] = {
                    "status": "FAIL",
                    "details": "Handler type checking not implemented"
                }
            
            # Fix 4: t.failedAudio TDZ Fix - Check for hardcoded error message
            self.log("Checking Fix 4: t.failedAudio TDZ Fix (hardcoded error string)")
            if "t.failedAudio" not in content:
                # Look for the hardcoded string
                audio_error_pattern = r"Failed to save audio greeting\. Please try again"
                if re.search(audio_error_pattern, content):
                    self.log("✅ Fix 4 VERIFIED: Hardcoded audio error string found, no t.failedAudio")
                    fixes_results["fix_4_tdz_failedaudio"] = {
                        "status": "PASS",
                        "details": "Uses hardcoded error string instead of t.failedAudio"
                    }
                else:
                    self.log("❌ Fix 4 PARTIAL: No t.failedAudio but hardcoded string not found")
                    fixes_results["fix_4_tdz_failedaudio"] = {
                        "status": "PARTIAL",
                        "details": "No t.failedAudio found but expected hardcoded string not located"
                    }
            else:
                self.log("❌ Fix 4 FAILED: t.failedAudio references still exist")
                fixes_results["fix_4_tdz_failedaudio"] = {
                    "status": "FAIL",
                    "details": "Found t.failedAudio references that would cause TDZ error"
                }
            
            self.results["test_results"]["code_fixes"] = fixes_results
            
            # Count successful fixes
            successful_fixes = sum(1 for fix in fixes_results.values() if fix["status"] == "PASS")
            total_fixes = len(fixes_results)
            
            self.log(f"Code fixes verification: {successful_fixes}/{total_fixes} fixes verified")
            return successful_fixes == total_fixes
            
        except Exception as e:
            self.log(f"❌ Error verifying code fixes: {e}")
            self.results["test_results"]["code_fixes"] = {
                "status": "FAIL",
                "error": str(e),
                "details": "Exception during code verification"
            }
            return False
            
    def run_comprehensive_test(self):
        """Run all verification tests"""
        self.log("🚀 Starting Railway Crash Log Bug Fixes Verification")
        self.log("="*70)
        
        tests = [
            ("Node.js Health Check", self.test_nodejs_health),
            ("Supervisor Error Logs", self.test_supervisor_logs), 
            ("Code Fixes Verification", self.verify_code_fixes)
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_name, test_func in tests:
            self.log(f"\n🧪 Running: {test_name}")
            try:
                if test_func():
                    passed_tests += 1
                    self.log(f"✅ {test_name}: PASSED")
                else:
                    self.log(f"❌ {test_name}: FAILED")
            except Exception as e:
                self.log(f"💥 {test_name}: ERROR - {e}")
        
        # Final summary
        self.log("\n" + "="*70)
        self.log("🏁 VERIFICATION SUMMARY")
        self.log("="*70)
        
        success_rate = (passed_tests / total_tests) * 100
        self.log(f"Tests Passed: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
        
        if passed_tests == total_tests:
            self.log("🎉 ALL RAILWAY CRASH LOG BUG FIXES VERIFIED SUCCESSFULLY!")
            self.results["overall_status"] = "ALL_PASS"
        else:
            self.log("⚠️  Some tests failed - review results above")
            self.results["overall_status"] = "PARTIAL_PASS"
        
        self.results["tests_passed"] = passed_tests
        self.results["total_tests"] = total_tests
        self.results["success_rate"] = success_rate
        
        return self.results

if __name__ == "__main__":
    verifier = RailwayBugFixVerifier()
    results = verifier.run_comprehensive_test()
    
    # Save results to file
    with open("/app/railway_fix_verification_results.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📄 Results saved to: /app/railway_fix_verification_results.json")