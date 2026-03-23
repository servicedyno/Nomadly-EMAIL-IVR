#!/usr/bin/env python3
"""
Email Validation Service Backend Test Suite
Tests all components of the Nomadly Email Validation Service
"""

import requests
import json
import subprocess
import sys
import time
from typing import Dict, List, Any

class EmailValidationTester:
    def __init__(self):
        self.vps_worker_url = "http://5.189.166.127:8787"
        self.worker_secret = "ev-worker-secret-2026"
        self.main_server_url = "http://localhost:5000"
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "status": status
        }
        self.test_results.append(result)
        print(f"{status}: {test_name}")
        if details:
            print(f"    Details: {details}")
        return success

    def test_vps_worker_health(self) -> bool:
        """Test VPS Worker Health Check"""
        try:
            response = requests.get(f"{self.vps_worker_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok":
                    return self.log_test("VPS Worker Health", True, f"Active: {data.get('active', 0)}, Cached MX: {data.get('cached_mx', 0)}")
                else:
                    return self.log_test("VPS Worker Health", False, f"Status not ok: {data}")
            else:
                return self.log_test("VPS Worker Health", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("VPS Worker Health", False, f"Connection error: {str(e)}")

    def test_vps_worker_smtp_verification(self) -> bool:
        """Test VPS Worker SMTP Verification"""
        test_emails = [
            "real@gmail.com",
            "nonexistent999@gmail.com", 
            "fake@nonexistentdomain123.com",
            "admin@google.com"
        ]
        
        try:
            headers = {
                "Authorization": f"Bearer {self.worker_secret}",
                "Content-Type": "application/json"
            }
            payload = {"emails": test_emails}
            
            response = requests.post(
                f"{self.vps_worker_url}/verify-smtp",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                
                if len(results) == 4:
                    # Verify expected results
                    expected_patterns = {
                        "fake@nonexistentdomain123.com": "invalid",  # no_mx
                        "real@gmail.com": "invalid",  # rejected by Gmail
                        "admin@google.com": "catch_all",  # catch-all domain
                        "nonexistent999@gmail.com": ["valid", "invalid"]  # Gmail behavior varies
                    }
                    
                    all_correct = True
                    details = []
                    
                    for result in results:
                        email = result["email"]
                        status = result["status"]
                        expected = expected_patterns.get(email)
                        
                        if isinstance(expected, list):
                            correct = status in expected
                        else:
                            correct = status == expected
                            
                        if correct:
                            details.append(f"{email} → {status} ✓")
                        else:
                            details.append(f"{email} → {status} (expected {expected}) ❌")
                            all_correct = False
                    
                    return self.log_test("VPS Worker SMTP Verification", all_correct, "; ".join(details))
                else:
                    return self.log_test("VPS Worker SMTP Verification", False, f"Expected 4 results, got {len(results)}")
            else:
                return self.log_test("VPS Worker SMTP Verification", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            return self.log_test("VPS Worker SMTP Verification", False, f"Error: {str(e)}")

    def test_email_validation_engine(self) -> bool:
        """Test 7-Layer Email Validation Engine"""
        try:
            # Run the Node.js test command
            test_script = '''
const ev = require('./js/email-validation.js')
const { calculatePrice, pricingTable } = require('./js/email-validation-config.js')

async function test() {
  const results = {}
  
  // Test parsing
  const emails = ev.parseEmailList('user@gmail.com,noreply@example.com,bad@@syntax,test@tempmail.com,admin@google.com')
  results.parsed_count = emails.length
  
  // Test layers
  results.syntax_valid = ev.validateSyntax('test@gmail.com')
  results.syntax_invalid = !ev.validateSyntax('bad@@')
  results.disposable = ev.isDisposable('test@tempmail.com')
  results.role_based = ev.isRoleBased('admin@google.com')
  results.free_provider = ev.isFreeProvider('test@gmail.com')
  
  // Test pricing
  results.price_500 = calculatePrice(500)
  results.price_5000 = calculatePrice(5000)
  results.price_30000 = calculatePrice(30000)
  
  // Test full batch
  const batch_results = await ev.validateEmailBatch(['test@gmail.com', 'admin@google.com', 'fake@nonexistentxyz.com'], {})
  results.batch_results = batch_results.map(r => ({
    email: r.email,
    category: r.category,
    score: r.score
  }))
  
  console.log(JSON.stringify(results))
}
test().catch(console.error)
            '''
            
            result = subprocess.run(
                ["node", "-e", test_script],
                cwd="/app",
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                try:
                    data = json.loads(result.stdout.strip())
                    
                    # Verify all components
                    checks = [
                        (data.get("parsed_count") == 4, "Email parsing"),
                        (data.get("syntax_valid") == True, "Syntax validation (valid)"),
                        (data.get("syntax_invalid") == True, "Syntax validation (invalid)"),
                        (data.get("disposable") == True, "Disposable detection"),
                        (data.get("role_based") == True, "Role-based detection"),
                        (data.get("free_provider") == True, "Free provider detection"),
                        (data.get("price_500", {}).get("total") == 2.5, "Pricing tier 1"),
                        (data.get("price_5000", {}).get("total") == 20, "Pricing tier 2"),
                        (data.get("price_30000", {}).get("total") == 90, "Pricing tier 3"),
                        (len(data.get("batch_results", [])) == 3, "Batch validation")
                    ]
                    
                    passed = sum(1 for check, _ in checks if check)
                    total = len(checks)
                    
                    details = f"{passed}/{total} checks passed"
                    if passed < total:
                        failed = [name for check, name in checks if not check]
                        details += f" - Failed: {', '.join(failed)}"
                    
                    return self.log_test("Email Validation Engine (7 layers)", passed == total, details)
                    
                except json.JSONDecodeError:
                    return self.log_test("Email Validation Engine (7 layers)", False, f"Invalid JSON output: {result.stdout}")
            else:
                return self.log_test("Email Validation Engine (7 layers)", False, f"Node.js error: {result.stderr}")
                
        except Exception as e:
            return self.log_test("Email Validation Engine (7 layers)", False, f"Error: {str(e)}")

    def test_service_orchestrator_initialization(self) -> bool:
        """Test Service Orchestrator Initialization"""
        try:
            # Check for initialization message in logs
            result = subprocess.run(
                ["grep", "-i", "emailvalidation.*service.*initialized", "/var/log/supervisor/nodejs.out.log"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0 and result.stdout.strip():
                lines = result.stdout.strip().split('\n')
                return self.log_test("Service Orchestrator Initialization", True, f"Found {len(lines)} initialization messages")
            else:
                return self.log_test("Service Orchestrator Initialization", False, "No initialization messages found in logs")
                
        except Exception as e:
            return self.log_test("Service Orchestrator Initialization", False, f"Error: {str(e)}")

    def test_main_server_health(self) -> bool:
        """Test Main Server Health"""
        try:
            response = requests.get(f"{self.main_server_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    return self.log_test("Main Server Health", True, f"Database: {data.get('database')}, Uptime: {data.get('uptime')}")
                else:
                    return self.log_test("Main Server Health", False, f"Status not healthy: {data}")
            else:
                return self.log_test("Main Server Health", False, f"HTTP {response.status_code}")
        except Exception as e:
            return self.log_test("Main Server Health", False, f"Connection error: {str(e)}")

    def test_env_variables(self) -> bool:
        """Test .env has all EV_ variables"""
        try:
            result = subprocess.run(
                ["grep", "EV_\\|EMAIL_VALIDATION", "/app/backend/.env"],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                ev_vars = [line for line in lines if line.strip() and not line.startswith('#')]
                
                required_vars = [
                    "EMAIL_VALIDATION_ON",
                    "EV_TIER_1_MAX", "EV_TIER_1_PRICE",
                    "EV_TIER_2_MAX", "EV_TIER_2_PRICE", 
                    "EV_TIER_3_MAX", "EV_TIER_3_PRICE",
                    "EV_TIER_4_MAX", "EV_TIER_4_PRICE",
                    "EV_MIN_EMAILS", "EV_MAX_EMAILS", "EV_MAX_PASTE",
                    "EV_WORKER_URL", "EV_WORKER_SECRET",
                    "EV_WORKER_BATCH", "EV_WORKER_TIMEOUT"
                ]
                
                found_vars = [line.split('=')[0] for line in ev_vars]
                missing = [var for var in required_vars if var not in found_vars]
                
                if not missing:
                    return self.log_test("Environment Variables", True, f"Found {len(ev_vars)} EV_ variables")
                else:
                    return self.log_test("Environment Variables", False, f"Missing: {', '.join(missing)}")
            else:
                return self.log_test("Environment Variables", False, "No EV_ variables found")
                
        except Exception as e:
            return self.log_test("Environment Variables", False, f"Error: {str(e)}")

    def test_bot_flow_compilation(self) -> bool:
        """Test bot flow code compiles without errors"""
        try:
            # Check for compilation errors
            with open("/var/log/supervisor/nodejs.err.log", "r") as f:
                error_log = f.read().strip()
            
            if not error_log:
                # Check for email validation patterns in bot code
                result = subprocess.run(
                    ["grep", "-c", "evMenu\\|evUploadList\\|evConfirmPay\\|emailValidation", "/app/js/_index.js"],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    count = int(result.stdout.strip())
                    if count > 0:
                        return self.log_test("Bot Flow Compilation", True, f"Found {count} email validation patterns, no errors in log")
                    else:
                        return self.log_test("Bot Flow Compilation", False, "No email validation patterns found")
                else:
                    return self.log_test("Bot Flow Compilation", False, "Could not check patterns")
            else:
                return self.log_test("Bot Flow Compilation", False, f"Errors in log: {error_log[:200]}...")
                
        except Exception as e:
            return self.log_test("Bot Flow Compilation", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run all tests and generate summary"""
        print("🧪 Email Validation Service Backend Test Suite")
        print("=" * 60)
        
        tests = [
            self.test_vps_worker_health,
            self.test_vps_worker_smtp_verification,
            self.test_email_validation_engine,
            self.test_service_orchestrator_initialization,
            self.test_main_server_health,
            self.test_env_variables,
            self.test_bot_flow_compilation
        ]
        
        passed = 0
        total = len(tests)
        
        for test_func in tests:
            if test_func():
                passed += 1
            print()
        
        print("=" * 60)
        print(f"📊 SUMMARY: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
        
        if passed == total:
            print("🎉 All tests passed! Email Validation Service is fully functional.")
        else:
            print("⚠️  Some tests failed. Check details above.")
            failed_tests = [r for r in self.test_results if not r["success"]]
            print("\n❌ Failed tests:")
            for test in failed_tests:
                print(f"  • {test['test']}: {test['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = EmailValidationTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)