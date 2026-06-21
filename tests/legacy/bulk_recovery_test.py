#!/usr/bin/env python3

"""
Bulk IVR Campaign Recovery Feature Test
Tests the recoverRunningCampaigns() function and all related components
"""

import requests
import json
import subprocess
import re
import os
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "http://localhost:5000"
TEST_RESULTS = []

def log_result(test_name, status, details="", expected="", actual=""):
    """Log test result with detailed information"""
    result = {
        'test': test_name,
        'status': status,  # 'PASS', 'FAIL', 'WARNING'
        'details': details,
        'expected': expected,
        'actual': actual,
        'timestamp': datetime.now().isoformat()
    }
    TEST_RESULTS.append(result)
    
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{icon} {test_name}: {status}")
    if details:
        print(f"   {details}")
    if expected and actual:
        print(f"   Expected: {expected}")
        print(f"   Actual: {actual}")
    print()

def check_file_content(file_path, search_patterns, test_name):
    """Check if file contains specific patterns"""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
            
        found_patterns = []
        missing_patterns = []
        
        for pattern_name, pattern in search_patterns.items():
            if isinstance(pattern, str):
                # Simple string search
                if pattern in content:
                    found_patterns.append(pattern_name)
                else:
                    missing_patterns.append(f"{pattern_name}: '{pattern}'")
            else:
                # Regex pattern
                if re.search(pattern, content, re.MULTILINE | re.DOTALL):
                    found_patterns.append(pattern_name)
                else:
                    missing_patterns.append(f"{pattern_name}: {pattern.pattern}")
        
        if missing_patterns:
            log_result(test_name, "FAIL", 
                      f"Missing patterns: {', '.join(missing_patterns)}",
                      f"All {len(search_patterns)} patterns found",
                      f"{len(found_patterns)}/{len(search_patterns)} patterns found")
            return False
        else:
            log_result(test_name, "PASS", 
                      f"All {len(search_patterns)} patterns found: {', '.join(found_patterns)}")
            return True
            
    except Exception as e:
        log_result(test_name, "FAIL", f"Error reading file: {str(e)}")
        return False

def check_logs_for_pattern(log_file, patterns, test_name):
    """Check supervisor logs for specific patterns"""
    try:
        result = subprocess.run(['tail', '-n', '200', log_file], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            log_result(test_name, "FAIL", f"Cannot read log file {log_file}")
            return False
            
        content = result.stdout
        found_patterns = []
        missing_patterns = []
        
        for pattern_name, pattern in patterns.items():
            if pattern in content:
                found_patterns.append(pattern_name)
            else:
                missing_patterns.append(pattern_name)
        
        if missing_patterns:
            log_result(test_name, "FAIL", 
                      f"Missing log patterns: {', '.join(missing_patterns)}",
                      f"All {len(patterns)} patterns in logs",
                      f"{len(found_patterns)}/{len(patterns)} patterns found")
            return False
        else:
            log_result(test_name, "PASS", 
                      f"All {len(patterns)} patterns found in logs: {', '.join(found_patterns)}")
            return True
            
    except Exception as e:
        log_result(test_name, "FAIL", f"Error checking logs: {str(e)}")
        return False

def test_nodejs_health():
    """Test 1: Node.js health check"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                log_result("Node.js Health Check", "PASS", 
                          f"Service healthy: {data}")
                return True
            else:
                log_result("Node.js Health Check", "FAIL", 
                          f"Service not healthy: {data}")
                return False
        else:
            log_result("Node.js Health Check", "FAIL", 
                      f"HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_result("Node.js Health Check", "FAIL", f"Request failed: {str(e)}")
        return False

def test_error_logs():
    """Test 1b: Check for errors in logs"""
    try:
        result = subprocess.run(['stat', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            # Check file size
            stat_output = result.stdout
            if "Size: 0" in stat_output or " 0 " in stat_output:
                log_result("Error Log Check", "PASS", 
                          "No errors in nodejs.err.log (0 bytes)")
                return True
            else:
                log_result("Error Log Check", "WARNING", 
                          f"Error log file not empty: {stat_output}")
                return False
        else:
            log_result("Error Log Check", "FAIL", "Cannot stat error log file")
            return False
    except Exception as e:
        log_result("Error Log Check", "FAIL", f"Error checking logs: {str(e)}")
        return False

def test_recovery_startup_log():
    """Test 2: Recovery runs on startup"""
    patterns = {
        "BulkCall Recovery Message": "[BulkCall] Recovery:"
    }
    return check_logs_for_pattern('/var/log/supervisor/nodejs.out.log', patterns, 
                                "Recovery Startup Log Check")

def test_recovery_function_exists():
    """Test 3: recoverRunningCampaigns function exists"""
    patterns = {
        "Function Declaration": "async function recoverRunningCampaigns()",
        "MongoDB Query": "_collection.find({ status: 'running' })",
        "No Running Campaigns Log": "No running campaigns to recover",
        "Recovery Analysis Log": "analyzing...",
        "Function Export": "recoverRunningCampaigns"
    }
    return check_file_content('/app/js/bulk-call-service.js', patterns, 
                            "recoverRunningCampaigns Function Exists")

def test_sub_account_security_check():
    """Test 4: Sub-account security check (step 2)"""
    patterns = {
        "Sub-account Check": "if (!campaign.twilioSubAccountSid)",
        "Security Block": "Recovery blocked: no Twilio sub-account",
        "Cancel Reason": "cancelledReason: 'Recovery blocked: no Twilio sub-account'",
        "Security Log": "BLOCKED (no sub-account)"
    }
    return check_file_content('/app/js/bulk-call-service.js', patterns, 
                            "Sub-account Security Check")

def test_stale_campaign_check():
    """Test 5: Stale campaign check (step 3)"""
    patterns = {
        "Stale Hours Constant": "STALE_CAMPAIGN_HOURS = 24",
        "Last Activity Function": "getLastLeadActivity(campaign)",
        "Hours Since Activity": "hoursSinceActivity > STALE_CAMPAIGN_HOURS",
        "Hours Since Start": "hoursSinceStart > STALE_CAMPAIGN_HOURS",
        "Stale Cancel Reason": "Recovery cleanup: stale campaign"
    }
    return check_file_content('/app/js/bulk-call-service.js', patterns, 
                            "Stale Campaign Check")

def test_credit_check():
    """Test 6: Credit check (step 4)"""
    patterns = {
        "Balance Check": "getBalance(_walletOf, campaign.chatId)",
        "Credit Insufficient": "usdBal < BULK_CALL_RATE",
        "Reset Before Pause": "resetInflightLeads(campaignId, leads)",
        "Pause Status": "status: 'paused'",
        "Credit Check Log": "paused (wallet"
    }
    return check_file_content('/app/js/bulk-call-service.js', patterns, 
                            "Credit Check Logic")

def test_reset_inflight_leads():
    """Test 7: resetInflightLeads helper function"""
    patterns = {
        "Function Declaration": "async function resetInflightLeads(",
        "Status Check Calling": "leads[i].status === 'calling'",
        "Status Check Ringing": "leads[i].status === 'ringing'",
        "Reset Status": "resetOps[`leads.${i}.status`] = 'pending'",
        "Reset CallSid": "resetOps[`leads.${i}.callSid`] = null",
        "Reset StartedAt": "resetOps[`leads.${i}.startedAt`] = null"
    }
    return check_file_content('/app/js/bulk-call-service.js', patterns, 
                            "resetInflightLeads Function")

def test_resume_logic():
    """Test 8: Resume logic (step 5)"""
    patterns = {
        "Active Campaigns Population": "activeCampaigns[campaignId] = {",
        "Active Calls Reset": "activeCalls: 0",
        "Next Lead Index": "nextLeadIndex: 0",
        "Paused Flag": "paused: false",
        "Fire Next Batch": "fireNextBatch(campaignId)"
    }
    return check_file_content('/app/js/bulk-call-service.js', patterns, 
                            "Resume Logic")

def test_stagger_delay():
    """Test 9: 3-second stagger"""
    patterns = {
        "Stagger Comment": "Stagger campaign starts",
        "Stagger Delay": "setTimeout(r, 3000)",
        "Stagger Promise": "new Promise(r => setTimeout(r, 3000))"
    }
    return check_file_content('/app/js/bulk-call-service.js', patterns, 
                            "3-second Stagger")

def test_module_exports():
    """Test 10: Module export"""
    patterns = {
        "Module Exports": "module.exports = {",
        "Recovery Export": "recoverRunningCampaigns"
    }
    return check_file_content('/app/js/bulk-call-service.js', patterns, 
                            "Module Export Check")

def test_startup_delay():
    """Test 11: 15-second startup delay"""
    patterns = {
        "Init Function": "async function initBulkCallService(",
        "Timeout Call": "setTimeout(",
        "Recovery Call": "recoverRunningCampaigns()",
        "15 Second Delay": "15000"
    }
    return check_file_content('/app/js/bulk-call-service.js', patterns, 
                            "15-second Startup Delay")

def test_get_last_lead_activity():
    """Test 12: getLastLeadActivity helper"""
    patterns = {
        "Function Declaration": "function getLastLeadActivity(campaign)",
        "Completed At": "lead.completedAt",
        "Answered At": "lead.answeredAt", 
        "Started At": "lead.startedAt",
        "Latest Comparison": "if (!latest || d > latest)"
    }
    return check_file_content('/app/js/bulk-call-service.js', patterns, 
                            "getLastLeadActivity Helper")

def run_all_tests():
    """Run all tests and generate summary"""
    print("=" * 80)
    print("BULK IVR CAMPAIGN RECOVERY FEATURE TEST")
    print("=" * 80)
    print()
    
    # Run all tests
    tests = [
        test_nodejs_health,
        test_error_logs,
        test_recovery_startup_log,
        test_recovery_function_exists,
        test_sub_account_security_check,
        test_stale_campaign_check,
        test_credit_check,
        test_reset_inflight_leads,
        test_resume_logic,
        test_stagger_delay,
        test_module_exports,
        test_startup_delay,
        test_get_last_lead_activity
    ]
    
    passed = 0
    failed = 0
    warnings = 0
    
    for test_func in tests:
        try:
            success = test_func()
            if success:
                passed += 1
            else:
                # Check if it was a warning
                last_result = TEST_RESULTS[-1] if TEST_RESULTS else {}
                if last_result.get('status') == 'WARNING':
                    warnings += 1
                else:
                    failed += 1
        except Exception as e:
            print(f"❌ {test_func.__name__}: EXCEPTION - {str(e)}")
            failed += 1
    
    # Summary
    total = len(tests)
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⚠️  Warnings: {warnings}")
    print(f"Success Rate: {(passed/total)*100:.1f}%")
    print()
    
    if failed == 0:
        print("🎉 ALL CRITICAL TESTS PASSED!")
        print("Bulk IVR Campaign Recovery feature is fully functional.")
    else:
        print("🚨 SOME TESTS FAILED")
        print("Please review the failed tests above.")
    
    # Save detailed results
    with open('/app/bulk_recovery_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total': total,
                'passed': passed,
                'failed': failed,
                'warnings': warnings,
                'success_rate': f"{(passed/total)*100:.1f}%",
                'timestamp': datetime.now().isoformat()
            },
            'details': TEST_RESULTS
        }, f, indent=2)
    
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)