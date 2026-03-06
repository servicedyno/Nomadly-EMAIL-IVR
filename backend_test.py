#!/usr/bin/env python3
"""
Backend Test Suite for Bulk IVR Credit Protection Fixes
Tests the 3 critical credit protection fixes in bulk-call-service.js
"""

import requests
import json
import sys
import os

# Configuration
BASE_URL = "http://localhost:5000"
HEADERS = {"Content-Type": "application/json"}

class TestResults:
    def __init__(self):
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = []
        
    def add_result(self, test_name, passed, message=""):
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
            print(f"✅ {test_name}")
        else:
            self.failed_tests.append({"test": test_name, "message": message})
            print(f"❌ {test_name}: {message}")
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"BULK IVR CREDIT PROTECTION FIXES TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Tests: {self.total_tests}")
        print(f"Passed: {self.passed_tests}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.passed_tests/self.total_tests)*100:.1f}%")
        
        if self.failed_tests:
            print(f"\nFAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  • {failure['test']}: {failure['message']}")

def test_service_health():
    """Test basic Node.js service health"""
    results = TestResults()
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        results.add_result("Service Health Check", 
                         response.status_code == 200 and response.json().get("status") == "healthy",
                         f"Status: {response.status_code}, Response: {response.json()}")
    except Exception as e:
        results.add_result("Service Health Check", False, str(e))
    
    return results

def check_bulk_call_service_structure():
    """Verify bulk-call-service.js structure and exports exist"""
    results = TestResults()
    
    # Check if file exists and has expected functions
    try:
        with open("/app/js/bulk-call-service.js", "r") as f:
            content = f.read()
            
        # Test that required functions exist
        required_functions = [
            "initBulkCallService", "startCampaign", "fireNextBatch", 
            "onCallStatusUpdate", "getBalance", "get"
        ]
        
        for func in required_functions:
            results.add_result(f"Function {func} exists", 
                             func in content,
                             f"Function {func} not found in bulk-call-service.js")
                             
        # Test required imports
        required_imports = [
            "const { getBalance } = require('./utils.js')",
            "const { get } = require('./db.js')"
        ]
        
        for imp in required_imports:
            results.add_result(f"Import statement present: {imp.split('=')[0].strip()}", 
                             imp in content,
                             f"Missing import: {imp}")
    
    except Exception as e:
        results.add_result("Bulk Call Service File Access", False, str(e))
    
    return results

def test_fix_a_pre_campaign_credit_check():
    """Test Fix A: Pre-campaign credit check in startCampaign function"""
    results = TestResults()
    
    try:
        with open("/app/js/bulk-call-service.js", "r") as f:
            content = f.read()
            
        # Find startCampaign function
        start_campaign_match = "async function startCampaign(campaignId)" in content
        results.add_result("startCampaign function exists", start_campaign_match,
                          "startCampaign function not found with expected signature")
        
        if start_campaign_match:
            # Check for pre-campaign credit check section
            pre_check_comment = "PRE-CAMPAIGN CREDIT CHECK" in content
            results.add_result("Pre-campaign credit check section exists", pre_check_comment,
                              "PRE-CAMPAIGN CREDIT CHECK comment not found")
            
            # Check for wallet and phone numbers validation
            wallet_check = "_walletOf" in content and "_phoneNumbersOf" in content
            results.add_result("Wallet and phone numbers collections initialized", wallet_check,
                              "_walletOf or _phoneNumbersOf not found")
            
            # Check for minute limit check using voice service
            minute_limit_check = "_voiceService.isMinuteLimitReached" in content
            results.add_result("Voice service minute limit check", minute_limit_check,
                              "_voiceService.isMinuteLimitReached not found")
            
            # Check for "Campaign Blocked — No Credits" message
            blocked_message = "Campaign Blocked — No Credits" in content
            results.add_result("Campaign blocked message exists", blocked_message,
                              "Campaign blocked message not found")
            
            # Check for wallet balance validation
            wallet_balance_check = "usdBal < rate" in content
            results.add_result("Wallet balance validation", wallet_balance_check,
                              "Wallet balance validation logic not found")
            
            # Check for low balance warning
            low_balance_warning = "Low Balance Warning" in content
            results.add_result("Low balance warning exists", low_balance_warning,
                              "Low balance warning message not found")
        
    except Exception as e:
        results.add_result("Fix A - File Access", False, str(e))
    
    return results

def test_fix_b_per_batch_credit_check():
    """Test Fix B: Per-batch credit check in fireNextBatch function"""
    results = TestResults()
    
    try:
        with open("/app/js/bulk-call-service.js", "r") as f:
            content = f.read()
            
        # Find fireNextBatch function
        fire_next_batch_match = "async function fireNextBatch(campaignId)" in content
        results.add_result("fireNextBatch function exists", fire_next_batch_match,
                          "fireNextBatch function not found with expected signature")
        
        if fire_next_batch_match:
            # Check for per-batch credit check section
            per_batch_comment = "PER-BATCH CREDIT CHECK" in content
            results.add_result("Per-batch credit check section exists", per_batch_comment,
                              "PER-BATCH CREDIT CHECK comment not found")
            
            # Check for credit check before for loop
            credit_check_logic = "toFire.length > 0 && _walletOf && _voiceService" in content
            results.add_result("Credit check before call firing", credit_check_logic,
                              "Credit check logic before firing calls not found")
            
            # Check for campaign pausing logic
            campaign_pause = "state.paused = true" in content
            results.add_result("Campaign pausing logic", campaign_pause,
                              "Campaign pausing logic not found")
            
            # Check for "Campaign Paused — Credits Exhausted" message
            paused_message = "Campaign Paused — Credits Exhausted" in content
            results.add_result("Campaign paused message exists", paused_message,
                              "Campaign paused message not found")
            
            # Check for database status update to 'paused'
            db_status_update = "status: 'paused'" in content
            results.add_result("Database status update to paused", db_status_update,
                              "Database status update to 'paused' not found")
        
    except Exception as e:
        results.add_result("Fix B - File Access", False, str(e))
    
    return results

def test_fix_c_post_billing_wallet_exhaustion():
    """Test Fix C: Post-billing wallet exhaustion in onCallStatusUpdate function"""
    results = TestResults()
    
    try:
        with open("/app/js/bulk-call-service.js", "r") as f:
            content = f.read()
            
        # Find onCallStatusUpdate function
        call_status_update_match = "async function onCallStatusUpdate(" in content
        results.add_result("onCallStatusUpdate function exists", call_status_update_match,
                          "onCallStatusUpdate function not found")
        
        if call_status_update_match:
            # Check for billing section
            billing_section = "billCallMinutesUnified" in content
            results.add_result("Billing section exists", billing_section,
                              "billCallMinutesUnified call not found")
            
            # Check for post-billing check section
            post_billing_comment = "POST-BILLING" in content
            results.add_result("Post-billing check section exists", post_billing_comment,
                              "POST-BILLING comment not found")
            
            # Check for overage minutes condition
            overage_check = "billingResult.overageMin > 0" in content
            results.add_result("Overage minutes check", overage_check,
                              "billingResult.overageMin > 0 condition not found")
            
            # Check for wallet balance check after billing
            post_billing_wallet_check = "usdBal < billingResult.rate" in content
            results.add_result("Post-billing wallet check", post_billing_wallet_check,
                              "Post-billing wallet balance check not found")
            
            # Check for "Campaign Auto-Paused — Wallet Depleted" message
            auto_paused_message = "Campaign Auto-Paused — Wallet Depleted" in content
            results.add_result("Auto-paused message exists", auto_paused_message,
                              "Campaign Auto-Paused message not found")
            
            # Check that it only triggers for overage calls (not plan-minute-only calls)
            overage_only_trigger = "billingResult.overageMin > 0 && _walletOf" in content
            results.add_result("Overage-only trigger logic", overage_only_trigger,
                              "Overage-only trigger condition not found")
        
    except Exception as e:
        results.add_result("Fix C - File Access", False, str(e))
    
    return results

def test_dependencies_verification():
    """Test that all required dependencies are properly configured"""
    results = TestResults()
    
    try:
        # Check _index.js for bulk call service initialization
        with open("/app/js/_index.js", "r") as f:
            index_content = f.read()
            
        # Check that walletOf is passed as 4th parameter in initialization
        init_with_wallet = "bulkCallService.initBulkCallService(db, bot," in index_content
        results.add_result("Bulk call service initialization found", init_with_wallet,
                          "bulkCallService.initBulkCallService call not found")
        
        # Check for wallet parameter in init call
        wallet_param_check = "walletOf)" in index_content or ", walletOf" in index_content
        results.add_result("walletOf parameter in initialization", wallet_param_check,
                          "walletOf parameter not found in initialization call")
        
        # Verify bulk-call-service.js accepts walletOf parameter
        with open("/app/js/bulk-call-service.js", "r") as f:
            bulk_content = f.read()
            
        init_function_signature = "async function initBulkCallService(db, bot, twilioService, walletOf)" in bulk_content
        results.add_result("initBulkCallService accepts walletOf parameter", init_function_signature,
                          "initBulkCallService function signature doesn't match expected parameters")
        
        # Check that _walletOf and _phoneNumbersOf are properly initialized
        wallet_init = "_walletOf = walletOf || db.collection('walletOf')" in bulk_content
        results.add_result("_walletOf initialization", wallet_init,
                          "_walletOf initialization not found")
        
        phone_numbers_init = "_phoneNumbersOf = db.collection('phoneNumbersOf')" in bulk_content
        results.add_result("_phoneNumbersOf initialization", phone_numbers_init,
                          "_phoneNumbersOf initialization not found")
        
        # Check that required utilities are imported
        get_balance_import = "const { getBalance } = require('./utils.js')" in bulk_content
        results.add_result("getBalance import from utils.js", get_balance_import,
                          "getBalance import not found")
        
        get_import = "const { get } = require('./db.js')" in bulk_content
        results.add_result("get import from db.js", get_import,
                          "get import not found")
        
    except Exception as e:
        results.add_result("Dependencies verification", False, str(e))
    
    return results

def check_startup_logs():
    """Check that the service started correctly with expected log messages"""
    results = TestResults()
    
    try:
        # Check for empty error log
        with open("/var/log/supervisor/nodejs.err.log", "r") as f:
            error_content = f.read().strip()
        
        results.add_result("Error log is empty", len(error_content) == 0,
                          f"Error log contains: {error_content[:200] if error_content else 'empty'}")
        
        # Check for expected initialization message
        with open("/var/log/supervisor/nodejs.out.log", "r") as f:
            log_content = f.read()
        
        bulk_call_init = "[BulkCall] Service initialized (Speechcue mode)" in log_content
        results.add_result("BulkCall service initialization message", bulk_call_init,
                          "BulkCall service initialization message not found")
        
        voice_service_init = "[VoiceService] Initialized" in log_content
        results.add_result("VoiceService initialization message", voice_service_init,
                          "VoiceService initialization message not found")
        
    except Exception as e:
        results.add_result("Startup logs check", False, str(e))
    
    return results

def main():
    print("🧪 BULK IVR CREDIT PROTECTION FIXES - COMPREHENSIVE TESTING")
    print("="*70)
    print("Testing 3 critical fixes in bulk-call-service.js:")
    print("  • Fix A: Pre-campaign credit check (startCampaign)")
    print("  • Fix B: Per-batch credit check (fireNextBatch)")  
    print("  • Fix C: Post-billing wallet exhaustion (onCallStatusUpdate)")
    print("="*70)
    
    all_results = TestResults()
    
    # Run all test suites
    test_suites = [
        ("🏥 Service Health Check", test_service_health),
        ("📋 Service Structure Verification", check_bulk_call_service_structure),
        ("🔍 Fix A: Pre-Campaign Credit Check", test_fix_a_pre_campaign_credit_check),
        ("🔍 Fix B: Per-Batch Credit Check", test_fix_b_per_batch_credit_check),
        ("🔍 Fix C: Post-Billing Wallet Exhaustion", test_fix_c_post_billing_wallet_exhaustion),
        ("⚙️  Dependencies Verification", test_dependencies_verification),
        ("📜 Startup Logs Check", check_startup_logs)
    ]
    
    for suite_name, test_function in test_suites:
        print(f"\n{suite_name}")
        print("-" * len(suite_name))
        
        suite_results = test_function()
        
        # Aggregate results
        all_results.total_tests += suite_results.total_tests
        all_results.passed_tests += suite_results.passed_tests
        all_results.failed_tests.extend(suite_results.failed_tests)
    
    # Print final summary
    all_results.print_summary()
    
    # Return exit code based on results
    return 0 if len(all_results.failed_tests) == 0 else 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)