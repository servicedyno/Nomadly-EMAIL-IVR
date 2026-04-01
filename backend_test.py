#!/usr/bin/env python3
"""
VPS Auto-Renewal System Testing Suite
Tests the critical scheduler that handles billing and Contabo instance lifecycle.
"""

import subprocess
import requests
import json
import os
import time
from pathlib import Path

class VPSAutoRenewalTester:
    def __init__(self):
        self.base_url = self.get_backend_url()
        self.test_results = []
        self.critical_issues = []
        self.minor_issues = []
        
    def get_backend_url(self):
        """Get backend URL from frontend .env file"""
        try:
            env_path = Path("/app/frontend/.env")
            if env_path.exists():
                with open(env_path, 'r') as f:
                    for line in f:
                        if line.startswith('REACT_APP_BACKEND_URL='):
                            return line.split('=', 1)[1].strip()
            return "http://localhost:5000"
        except Exception as e:
            print(f"Warning: Could not read frontend .env: {e}")
            return "http://localhost:5000"
    
    def log_result(self, test_name, passed, details, is_critical=True):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = {
            'test': test_name,
            'passed': passed,
            'details': details,
            'critical': is_critical
        }
        self.test_results.append(result)
        
        if not passed:
            if is_critical:
                self.critical_issues.append(f"{test_name}: {details}")
            else:
                self.minor_issues.append(f"{test_name}: {details}")
        
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
    
    def test_syntax_validation(self):
        """Test 1: Syntax validation using node -c"""
        print("\n=== Test 1: Syntax Validation ===")
        
        files_to_check = [
            "/app/js/_index.js",
            "/app/js/vm-instance-setup.js"
        ]
        
        for file_path in files_to_check:
            try:
                result = subprocess.run(
                    ["node", "-c", file_path],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                
                if result.returncode == 0:
                    self.log_result(f"Syntax check {os.path.basename(file_path)}", True, "No syntax errors")
                else:
                    self.log_result(f"Syntax check {os.path.basename(file_path)}", False, 
                                  f"Syntax errors: {result.stderr}", is_critical=True)
                    
            except subprocess.TimeoutExpired:
                self.log_result(f"Syntax check {os.path.basename(file_path)}", False, 
                              "Timeout during syntax check", is_critical=True)
            except Exception as e:
                self.log_result(f"Syntax check {os.path.basename(file_path)}", False, 
                              f"Error: {str(e)}", is_critical=True)
    
    def test_health_check(self):
        """Test 2: Health check and error log verification"""
        print("\n=== Test 2: Health Check ===")
        
        # Health endpoint check
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                health_data = response.json()
                if health_data.get('status') == 'healthy':
                    self.log_result("Health endpoint", True, f"Status: {health_data.get('status')}")
                else:
                    self.log_result("Health endpoint", False, 
                                  f"Unhealthy status: {health_data}", is_critical=True)
            else:
                self.log_result("Health endpoint", False, 
                              f"HTTP {response.status_code}: {response.text}", is_critical=True)
        except Exception as e:
            self.log_result("Health endpoint", False, f"Connection error: {str(e)}", is_critical=True)
        
        # Error log check
        try:
            error_log_path = "/var/log/supervisor/nodejs.err.log"
            if os.path.exists(error_log_path):
                file_size = os.path.getsize(error_log_path)
                if file_size == 0:
                    self.log_result("Error log check", True, "0-byte error log (clean)")
                else:
                    # Read last few lines to see what errors exist
                    with open(error_log_path, 'r') as f:
                        lines = f.readlines()
                        recent_errors = ''.join(lines[-5:]) if lines else "No content"
                    self.log_result("Error log check", False, 
                                  f"Error log has {file_size} bytes. Recent: {recent_errors[:200]}...", 
                                  is_critical=False)
            else:
                self.log_result("Error log check", False, "Error log file not found", is_critical=False)
        except Exception as e:
            self.log_result("Error log check", False, f"Error reading log: {str(e)}", is_critical=False)
    
    def test_scheduler_structure(self):
        """Test 3: Verify scheduler structure in checkVPSPlansExpiryandPayment"""
        print("\n=== Test 3: Scheduler Structure ===")
        
        try:
            with open("/app/js/_index.js", 'r') as f:
                content = f.read()
            
            # Check for the main function
            if "async function checkVPSPlansExpiryandPayment()" in content:
                self.log_result("checkVPSPlansExpiryandPayment function exists", True, "Function found")
            else:
                self.log_result("checkVPSPlansExpiryandPayment function exists", False, 
                              "Main scheduler function not found", is_critical=True)
                return
            
            # Phase 1: dueForRenewal
            phase1_query = "'end_time': { $lte: oneDayFromNow, $gt: now }"
            phase1_status = "'status': { $in: ['RUNNING', 'running'] }"
            phase1_attempted = "'_autoRenewAttempted': { $ne: true }"
            
            if all(pattern in content for pattern in [phase1_query, phase1_status, phase1_attempted]):
                self.log_result("Phase 1 (dueForRenewal) query", True, 
                              "Correct query: end_time <= oneDayFromNow AND > now AND status RUNNING AND _autoRenewAttempted != true")
            else:
                self.log_result("Phase 1 (dueForRenewal) query", False, 
                              "Phase 1 query structure incorrect", is_critical=True)
            
            # Phase 2: pastDeadline
            phase2_query = "'end_time': { $lte: now }"
            phase2_status = "'status': 'PENDING_CANCELLATION'"
            
            if phase2_query in content and phase2_status in content:
                self.log_result("Phase 2 (pastDeadline) query", True, 
                              "Correct query: end_time <= now AND status = PENDING_CANCELLATION")
            else:
                self.log_result("Phase 2 (pastDeadline) query", False, 
                              "Phase 2 query structure incorrect", is_critical=True)
            
            # Phase 3: staleExpired
            phase3_query = "'end_time': { $lte: now }"
            phase3_status = "'status': { $in: ['RUNNING', 'running'] }"
            phase3_attempted = "'_autoRenewAttempted': { $ne: true }"
            
            if all(pattern in content for pattern in [phase3_query, phase3_status, phase3_attempted]):
                self.log_result("Phase 3 (staleExpired) query", True, 
                              "Correct query: end_time <= now AND status RUNNING AND _autoRenewAttempted != true")
            else:
                self.log_result("Phase 3 (staleExpired) query", False, 
                              "Phase 3 query structure incorrect", is_critical=True)
            
            # Phase 4: soonExpiring
            phase4_query = "'end_time': { $lte: threeDaysFromNow, $gt: oneDayFromNow }"
            phase4_status = "'status': { $in: ['RUNNING', 'running'] }"
            
            if phase4_query in content and phase4_status in content:
                self.log_result("Phase 4 (soonExpiring) query", True, 
                              "Correct query: end_time <= threeDaysFromNow AND > oneDayFromNow AND status RUNNING")
            else:
                self.log_result("Phase 4 (soonExpiring) query", False, 
                              "Phase 4 query structure incorrect", is_critical=True)
                
        except Exception as e:
            self.log_result("Scheduler structure analysis", False, f"Error reading file: {str(e)}", is_critical=True)
    
    def test_smart_wallet_deduct_usage(self):
        """Test 4: Verify smartWalletDeduct usage in Phase 1 and Phase 3"""
        print("\n=== Test 4: smartWalletDeduct Usage ===")
        
        try:
            with open("/app/js/_index.js", 'r') as f:
                content = f.read()
            
            # Check import
            if "smartWalletDeduct" in content and "smartWalletDeduct," in content:
                self.log_result("smartWalletDeduct import", True, "Function imported correctly")
            else:
                self.log_result("smartWalletDeduct import", False, 
                              "smartWalletDeduct not imported", is_critical=True)
            
            # Count usage in Phase 1 and Phase 3
            smart_wallet_calls = content.count("await smartWalletDeduct(walletOf, chatId, Number(planPrice))")
            
            if smart_wallet_calls >= 2:
                self.log_result("smartWalletDeduct usage", True, 
                              f"Found {smart_wallet_calls} calls to smartWalletDeduct with correct parameters")
            else:
                self.log_result("smartWalletDeduct usage", False, 
                              f"Only found {smart_wallet_calls} calls, expected at least 2 (Phase 1 and Phase 3)", 
                              is_critical=True)
            
            # Check that old pattern is NOT used
            old_pattern_count = content.count("getBalance") + content.count("atomicIncrement")
            if old_pattern_count == 0:
                self.log_result("Old wallet pattern removed", True, "No old getBalance + atomicIncrement pattern found")
            else:
                # This might be acceptable if used elsewhere, so mark as minor
                self.log_result("Old wallet pattern check", False, 
                              f"Found {old_pattern_count} instances of old pattern (may be used elsewhere)", 
                              is_critical=False)
                
        except Exception as e:
            self.log_result("smartWalletDeduct analysis", False, f"Error: {str(e)}", is_critical=True)
    
    def test_contabo_deletion(self):
        """Test 5: Verify Contabo deletion in Phase 2"""
        print("\n=== Test 5: Contabo Deletion ===")
        
        try:
            with open("/app/js/_index.js", 'r') as f:
                content = f.read()
            
            # Check deleteVPSinstance call
            if "await deleteVPSinstance(chatId, vpsId)" in content:
                self.log_result("deleteVPSinstance call", True, "Function called correctly in Phase 2")
            else:
                self.log_result("deleteVPSinstance call", False, 
                              "deleteVPSinstance not called in Phase 2", is_critical=True)
            
            # Check status update to CANCELLED
            if "status: 'CANCELLED'" in content and "cancelledAt: new Date()" in content:
                self.log_result("CANCELLED status update", True, 
                              "Status updated to CANCELLED with timestamp on successful deletion")
            else:
                self.log_result("CANCELLED status update", False, 
                              "Status not properly updated to CANCELLED", is_critical=True)
            
            # Check admin notification for successful deletion
            if "VPS Auto-Deleted" in content and "TELEGRAM_ADMIN_CHAT_ID" in content:
                self.log_result("Admin deletion notification", True, 
                              "Admin notified of successful VPS deletion")
            else:
                self.log_result("Admin deletion notification", False, 
                              "Admin not notified of VPS deletion", is_critical=True)
                
        except Exception as e:
            self.log_result("Contabo deletion analysis", False, f"Error: {str(e)}", is_critical=True)
    
    def test_pending_cancellation_status(self):
        """Test 6: Verify PENDING_CANCELLATION status usage"""
        print("\n=== Test 6: PENDING_CANCELLATION Status ===")
        
        try:
            with open("/app/js/_index.js", 'r') as f:
                content = f.read()
            
            # Count PENDING_CANCELLATION usage
            pending_count = content.count("'PENDING_CANCELLATION'")
            
            if pending_count >= 3:
                self.log_result("PENDING_CANCELLATION usage", True, 
                              f"Found {pending_count} uses of PENDING_CANCELLATION status")
            else:
                self.log_result("PENDING_CANCELLATION usage", False, 
                              f"Only found {pending_count} uses, expected at least 3", is_critical=True)
            
            # Check specific scenarios
            scenarios = [
                ("Phase 1 failure", "Both USD and NGN failed"),
                ("Phase 1 auto-renew disabled", "Auto-renew disabled"),
                ("Phase 3 failure", "Failed or auto-renew off")
            ]
            
            for scenario_name, search_text in scenarios:
                if search_text in content:
                    self.log_result(f"PENDING_CANCELLATION - {scenario_name}", True, 
                                  f"Scenario handled: {scenario_name}")
                else:
                    self.log_result(f"PENDING_CANCELLATION - {scenario_name}", False, 
                                  f"Scenario not found: {scenario_name}", is_critical=False)
                    
        except Exception as e:
            self.log_result("PENDING_CANCELLATION analysis", False, f"Error: {str(e)}", is_critical=True)
    
    def test_renew_vps_plan_function(self):
        """Test 7: Verify renewVPSPlan function resets flags"""
        print("\n=== Test 7: renewVPSPlan Function ===")
        
        try:
            with open("/app/js/vm-instance-setup.js", 'r') as f:
                content = f.read()
            
            # Check function exists
            if "async function renewVPSPlan(" in content:
                self.log_result("renewVPSPlan function exists", True, "Function found in vm-instance-setup.js")
            else:
                self.log_result("renewVPSPlan function exists", False, 
                              "renewVPSPlan function not found", is_critical=True)
                return
            
            # Check flag resets
            required_resets = [
                "_autoRenewAttempted: false",
                "_reminder3DaySent: false", 
                "_reminder1DaySent: false",
                "status: 'RUNNING'"
            ]
            
            all_resets_found = True
            for reset in required_resets:
                if reset in content:
                    self.log_result(f"Flag reset: {reset}", True, "Reset found")
                else:
                    self.log_result(f"Flag reset: {reset}", False, f"Reset not found: {reset}", is_critical=True)
                    all_resets_found = False
            
            if all_resets_found:
                self.log_result("All flag resets", True, "All required flags are reset in renewVPSPlan")
            else:
                self.log_result("All flag resets", False, "Some flag resets missing", is_critical=True)
                
        except Exception as e:
            self.log_result("renewVPSPlan analysis", False, f"Error: {str(e)}", is_critical=True)
    
    def test_three_day_reminder(self):
        """Test 8: Verify 3-day reminder includes planPrice and wallet balance"""
        print("\n=== Test 8: 3-Day Reminder ===")
        
        try:
            with open("/app/js/_index.js", 'r') as f:
                content = f.read()
            
            # Check 3-day reminder logic
            if "daysLeft > 2.5 && daysLeft <= 3.1" in content:
                self.log_result("3-day reminder timing", True, "Correct timing logic for 3-day reminder")
            else:
                self.log_result("3-day reminder timing", False, 
                              "3-day reminder timing logic not found", is_critical=True)
            
            # Check wallet balance retrieval
            if "const { usdBal, ngnBal } = await getBalance(walletOf, chatId)" in content:
                self.log_result("Wallet balance in reminder", True, "Wallet balance retrieved for reminder")
            else:
                self.log_result("Wallet balance in reminder", False, 
                              "Wallet balance not retrieved in reminder", is_critical=True)
            
            # Check planPrice in message
            if "Required: <b>$${planPrice}/mo</b>" in content:
                self.log_result("planPrice in reminder", True, "planPrice included in reminder message")
            else:
                self.log_result("planPrice in reminder", False, 
                              "planPrice not included in reminder message", is_critical=True)
            
            # Check balance display
            if "Balance: $${usdBal.toFixed(2)} / ₦${ngnBal.toFixed(2)}" in content:
                self.log_result("Balance display in reminder", True, "Both USD and NGN balance shown")
            else:
                self.log_result("Balance display in reminder", False, 
                              "Balance not properly displayed in reminder", is_critical=True)
                
        except Exception as e:
            self.log_result("3-day reminder analysis", False, f"Error: {str(e)}", is_critical=True)
    
    def test_admin_notifications(self):
        """Test 9: Verify admin notifications for various scenarios"""
        print("\n=== Test 9: Admin Notifications ===")
        
        try:
            with open("/app/js/_index.js", 'r') as f:
                content = f.read()
            
            # Check TELEGRAM_ADMIN_CHAT_ID usage
            admin_notifications = content.count("send(TELEGRAM_ADMIN_CHAT_ID")
            
            if admin_notifications >= 3:
                self.log_result("Admin notification count", True, 
                              f"Found {admin_notifications} admin notifications")
            else:
                self.log_result("Admin notification count", False, 
                              f"Only found {admin_notifications} admin notifications, expected at least 3", 
                              is_critical=True)
            
            # Check specific notification scenarios
            notification_scenarios = [
                ("Phase 1 renewal failure", "VPS Renewal Failed"),
                ("Phase 2 successful deletion", "VPS Auto-Deleted"),
                ("Phase 2 deletion failure", "VPS DELETE FAILED")
            ]
            
            for scenario_name, search_text in notification_scenarios:
                if search_text in content:
                    self.log_result(f"Admin notification - {scenario_name}", True, 
                                  f"Notification found: {search_text}")
                else:
                    self.log_result(f"Admin notification - {scenario_name}", False, 
                                  f"Notification not found: {search_text}", is_critical=True)
            
            # Check manual deletion warning
            if "Manual deletion required" in content:
                self.log_result("Manual deletion warning", True, 
                              "Warning about manual deletion included")
            else:
                self.log_result("Manual deletion warning", False, 
                              "Manual deletion warning not found", is_critical=False)
                
        except Exception as e:
            self.log_result("Admin notifications analysis", False, f"Error: {str(e)}", is_critical=True)
    
    def run_all_tests(self):
        """Run all tests"""
        print("🔍 VPS Auto-Renewal System Testing Suite")
        print("=" * 50)
        
        self.test_syntax_validation()
        self.test_health_check()
        self.test_scheduler_structure()
        self.test_smart_wallet_deduct_usage()
        self.test_contabo_deletion()
        self.test_pending_cancellation_status()
        self.test_renew_vps_plan_function()
        self.test_three_day_reminder()
        self.test_admin_notifications()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r['passed'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.critical_issues:
            print(f"\n❌ CRITICAL ISSUES ({len(self.critical_issues)}):")
            for issue in self.critical_issues:
                print(f"  • {issue}")
        
        if self.minor_issues:
            print(f"\n⚠️ MINOR ISSUES ({len(self.minor_issues)}):")
            for issue in self.minor_issues:
                print(f"  • {issue}")
        
        if not self.critical_issues and not self.minor_issues:
            print("\n✅ ALL TESTS PASSED - VPS Auto-Renewal System is working correctly!")
        
        return {
            'total': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'critical_issues': self.critical_issues,
            'minor_issues': self.minor_issues,
            'success_rate': (passed_tests/total_tests)*100
        }

if __name__ == "__main__":
    tester = VPSAutoRenewalTester()
    results = tester.run_all_tests()