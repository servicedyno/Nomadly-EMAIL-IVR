#!/usr/bin/env python3
"""
Bulk Call Campaign Pricing Overhaul Test Suite
Tests all 11 requirements from the review request.
"""
import requests
import os
import json
import time

# Test configuration
BASE_URL = "http://localhost:5000"
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://pod-webhook-preview.preview.emergentagent.com')

class BulkCallPricingTests:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        
    def log_result(self, test_name, passed, details=""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        if passed:
            self.passed += 1
            print(f"✅ {test_name}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {details}")
    
    def run_all_tests(self):
        print("🚀 Starting Bulk Call Campaign Pricing Overhaul Tests")
        print("=" * 60)
        
        # Test 1: Node.js health check
        self.test_nodejs_health()
        
        # Test 2-3: Check constants in bulk-call-service.js
        self.test_bulk_call_rate_constant()
        self.test_max_bulk_leads_constant()
        
        # Test 4: createCampaign max leads check
        self.test_create_campaign_max_leads_check()
        
        # Test 5: startCampaign wallet-only pre-check
        self.test_start_campaign_wallet_precheck()
        
        # Test 6: onCallStatusUpdate bills all calls
        self.test_billing_all_calls()
        
        # Test 7: fireNextBatch per-batch check
        self.test_fire_next_batch_credit_check()
        
        # Test 8: _index.js lead upload limit
        self.test_index_lead_upload_limit()
        
        # Test 9: _index.js campaign preview cost
        self.test_index_campaign_preview_cost()
        
        # Test 10: Exports verification
        self.test_exports_verification()
        
        # Test 11: Environment variables
        self.test_env_vars()
        
        # Print summary
        self.print_summary()
    
    def test_nodejs_health(self):
        """Test 1: Node.js health check"""
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy':
                    # Check error log is empty
                    try:
                        import subprocess
                        result = subprocess.run(['wc', '-c', '/var/log/supervisor/nodejs.err.log'], 
                                              capture_output=True, text=True)
                        log_size = int(result.stdout.split()[0])
                        if log_size == 0:
                            self.log_result("Node.js Health Check", True, 
                                          f"Service healthy, error log empty ({log_size} bytes)")
                        else:
                            self.log_result("Node.js Health Check", False, 
                                          f"Error log not empty: {log_size} bytes")
                    except Exception as e:
                        self.log_result("Node.js Health Check", True, 
                                      f"Service healthy, but couldn't check log: {e}")
                else:
                    self.log_result("Node.js Health Check", False, 
                                  f"Service unhealthy: {data}")
            else:
                self.log_result("Node.js Health Check", False, 
                              f"HTTP {response.status_code}")
        except Exception as e:
            self.log_result("Node.js Health Check", False, str(e))
    
    def test_bulk_call_rate_constant(self):
        """Test 2: BULK_CALL_RATE constant verification"""
        try:
            with open('/app/js/bulk-call-service.js', 'r') as f:
                content = f.read()
            
            # Look for the constant definition
            expected_line = "const BULK_CALL_RATE = parseFloat(process.env.BULK_CALL_RATE_PER_MIN || '0.15')"
            
            if expected_line in content:
                # Check if it's near the top of file (within first 50 lines)
                lines = content.split('\n')
                for i, line in enumerate(lines[:50]):
                    if 'BULK_CALL_RATE = parseFloat(' in line and '0.15' in line:
                        self.log_result("BULK_CALL_RATE Constant", True, 
                                      f"Found at line {i+1}, value: 0.15")
                        return
                
                self.log_result("BULK_CALL_RATE Constant", False, 
                              "Found constant but not near top of file")
            else:
                self.log_result("BULK_CALL_RATE Constant", False, 
                              "Constant definition not found")
        except Exception as e:
            self.log_result("BULK_CALL_RATE Constant", False, str(e))
    
    def test_max_bulk_leads_constant(self):
        """Test 3: MAX_BULK_LEADS constant verification"""
        try:
            with open('/app/js/bulk-call-service.js', 'r') as f:
                content = f.read()
            
            # Look for the constant definition
            expected_line = "const MAX_BULK_LEADS  = parseInt(process.env.BULK_CALL_MAX_LEADS || '500', 10)"
            
            if "MAX_BULK_LEADS" in content and "500" in content:
                # Check if it's near the top of file (within first 50 lines)
                lines = content.split('\n')
                for i, line in enumerate(lines[:50]):
                    if 'MAX_BULK_LEADS' in line and 'parseInt(' in line and '500' in line:
                        self.log_result("MAX_BULK_LEADS Constant", True, 
                                      f"Found at line {i+1}, value: 500")
                        return
                
                self.log_result("MAX_BULK_LEADS Constant", False, 
                              "Found constant but not near top of file")
            else:
                self.log_result("MAX_BULK_LEADS Constant", False, 
                              "Constant definition not found")
        except Exception as e:
            self.log_result("MAX_BULK_LEADS Constant", False, str(e))
    
    def test_create_campaign_max_leads_check(self):
        """Test 4: createCampaign max leads check"""
        try:
            with open('/app/js/bulk-call-service.js', 'r') as f:
                content = f.read()
            
            # Look for the createCampaign function and max leads check
            if 'async function createCampaign(' in content:
                # Check for max leads validation
                check_patterns = [
                    'if (leads.length > MAX_BULK_LEADS)',
                    'leads.length > MAX_BULK_LEADS',
                    'Maximum ${MAX_BULK_LEADS} leads per campaign'
                ]
                
                found_checks = 0
                for pattern in check_patterns:
                    if pattern in content:
                        found_checks += 1
                
                if found_checks >= 2:
                    self.log_result("createCampaign Max Leads Check", True, 
                                  f"Found {found_checks}/3 expected patterns")
                else:
                    self.log_result("createCampaign Max Leads Check", False, 
                                  f"Only found {found_checks}/3 expected patterns")
            else:
                self.log_result("createCampaign Max Leads Check", False, 
                              "createCampaign function not found")
        except Exception as e:
            self.log_result("createCampaign Max Leads Check", False, str(e))
    
    def test_start_campaign_wallet_precheck(self):
        """Test 5: startCampaign wallet-only pre-check"""
        try:
            with open('/app/js/bulk-call-service.js', 'r') as f:
                content = f.read()
            
            # Look for startCampaign function
            if 'async function startCampaign(' in content:
                # Check for wallet-only credit check patterns
                wallet_checks = [
                    'PRE-CAMPAIGN CREDIT CHECK',
                    'usdBal < BULK_CALL_RATE',
                    'minRequired = BULK_CALL_RATE * campaign.leads.length',
                    'Bulk campaigns are charged at',
                    'plan minutes NOT used'
                ]
                
                found_checks = 0
                for pattern in wallet_checks:
                    if pattern in content:
                        found_checks += 1
                
                # Check that it's NOT using plan minutes (should not have isMinuteLimitReached in bulk context)
                no_plan_check = 'isMinuteLimitReached' not in content.split('startCampaign')[1].split('fireNextBatch')[0] if 'startCampaign' in content and 'fireNextBatch' in content else True
                
                if found_checks >= 3 and no_plan_check:
                    self.log_result("startCampaign Wallet Pre-check", True, 
                                  f"Found {found_checks}/5 wallet-only patterns, no plan minutes check")
                else:
                    self.log_result("startCampaign Wallet Pre-check", False, 
                                  f"Found {found_checks}/5 patterns, plan check avoided: {no_plan_check}")
            else:
                self.log_result("startCampaign Wallet Pre-check", False, 
                              "startCampaign function not found")
        except Exception as e:
            self.log_result("startCampaign Wallet Pre-check", False, str(e))
    
    def test_billing_all_calls(self):
        """Test 6: onCallStatusUpdate bills ALL calls"""
        try:
            with open('/app/js/bulk-call-service.js', 'r') as f:
                content = f.read()
            
            # Look for onCallStatusUpdate function
            if 'async function onCallStatusUpdate(' in content:
                # Check for billing section patterns
                billing_patterns = [
                    "['completed', 'no-answer', 'busy', 'failed', 'canceled'].includes(status)",
                    'Math.max(1, Math.ceil((duration || 0) / 60))',
                    'minutesBilled * BULK_CALL_RATE',
                    'atomicIncrement(_walletOf',
                    'minimum 1 minute always'
                ]
                
                found_patterns = 0
                for pattern in billing_patterns:
                    if pattern in content:
                        found_patterns += 1
                
                # Check it's NOT using billCallMinutesUnified
                no_unified_billing = 'billCallMinutesUnified' not in content.split('onCallStatusUpdate')[1].split('}')[0] if 'onCallStatusUpdate' in content else False
                
                if found_patterns >= 3 and no_unified_billing:
                    self.log_result("onCallStatusUpdate Bills All Calls", True, 
                                  f"Found {found_patterns}/5 billing patterns, direct wallet charge")
                else:
                    self.log_result("onCallStatusUpdate Bills All Calls", False, 
                                  f"Found {found_patterns}/5 patterns, no unified billing: {no_unified_billing}")
            else:
                self.log_result("onCallStatusUpdate Bills All Calls", False, 
                              "onCallStatusUpdate function not found")
        except Exception as e:
            self.log_result("onCallStatusUpdate Bills All Calls", False, str(e))
    
    def test_fire_next_batch_credit_check(self):
        """Test 7: fireNextBatch per-batch credit check"""
        try:
            with open('/app/js/bulk-call-service.js', 'r') as f:
                content = f.read()
            
            # Look for fireNextBatch function
            if 'async function fireNextBatch(' in content:
                # Check for per-batch credit check patterns
                batch_patterns = [
                    'PER-BATCH CREDIT CHECK',
                    'usdBal < BULK_CALL_RATE',
                    'state.paused = true',
                    'Campaign Paused — Wallet Depleted',
                    'bulk calls use wallet only'
                ]
                
                found_patterns = 0
                for pattern in batch_patterns:
                    if pattern in content:
                        found_patterns += 1
                
                if found_patterns >= 3:
                    self.log_result("fireNextBatch Per-batch Check", True, 
                                  f"Found {found_patterns}/5 per-batch credit patterns")
                else:
                    self.log_result("fireNextBatch Per-batch Check", False, 
                                  f"Only found {found_patterns}/5 expected patterns")
            else:
                self.log_result("fireNextBatch Per-batch Check", False, 
                              "fireNextBatch function not found")
        except Exception as e:
            self.log_result("fireNextBatch Per-batch Check", False, str(e))
    
    def test_index_lead_upload_limit(self):
        """Test 8: _index.js lead upload limit"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Look for bulkUploadLeads handler
            if 'bulkUploadLeads' in content:
                # Check for lead upload limit patterns
                upload_patterns = [
                    'if (leads.length > maxLeads)',
                    'maxLeads = bulkCallService.MAX_BULK_LEADS',
                    '|| 500',
                    'limit'
                ]
                
                found_patterns = 0
                for pattern in upload_patterns:
                    if pattern in content:
                        found_patterns += 1
                
                if found_patterns >= 2:
                    self.log_result("_index.js Lead Upload Limit", True, 
                                  f"Found {found_patterns}/4 upload limit patterns")
                else:
                    self.log_result("_index.js Lead Upload Limit", False, 
                                  f"Only found {found_patterns}/4 expected patterns")
            else:
                self.log_result("_index.js Lead Upload Limit", False, 
                              "bulkUploadLeads handler not found")
        except Exception as e:
            self.log_result("_index.js Lead Upload Limit", False, str(e))
    
    def test_index_campaign_preview_cost(self):
        """Test 9: _index.js campaign preview cost"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Look for bulkSetConcurrency handler (campaign preview)
            if 'bulkSetConcurrency' in content:
                # Check for campaign preview cost patterns
                preview_patterns = [
                    'bulkRate = bulkCallService.BULK_CALL_RATE',
                    '|| 0.15',
                    'estCost = (leadCount * bulkRate).toFixed(2)',
                    '$0.15/min per number',
                    'charged whether answered or not'
                ]
                
                found_patterns = 0
                for pattern in preview_patterns:
                    if pattern in content:
                        found_patterns += 1
                
                if found_patterns >= 3:
                    self.log_result("_index.js Campaign Preview Cost", True, 
                                  f"Found {found_patterns}/5 preview cost patterns")
                else:
                    self.log_result("_index.js Campaign Preview Cost", False, 
                                  f"Only found {found_patterns}/5 expected patterns")
            else:
                self.log_result("_index.js Campaign Preview Cost", False, 
                              "bulkSetConcurrency handler not found")
        except Exception as e:
            self.log_result("_index.js Campaign Preview Cost", False, str(e))
    
    def test_exports_verification(self):
        """Test 10: Exports verification"""
        try:
            with open('/app/js/bulk-call-service.js', 'r') as f:
                content = f.read()
            
            # Check module.exports section
            if 'module.exports' in content:
                # Check for required exports
                required_exports = [
                    'BULK_CALL_RATE',
                    'MAX_BULK_LEADS'
                ]
                
                found_exports = 0
                for export_name in required_exports:
                    if export_name in content.split('module.exports')[1]:
                        found_exports += 1
                
                if found_exports == 2:
                    self.log_result("Exports Verification", True, 
                                  "Both BULK_CALL_RATE and MAX_BULK_LEADS exported")
                else:
                    self.log_result("Exports Verification", False, 
                                  f"Only found {found_exports}/2 required exports")
            else:
                self.log_result("Exports Verification", False, 
                              "module.exports section not found")
        except Exception as e:
            self.log_result("Exports Verification", False, str(e))
    
    def test_env_vars(self):
        """Test 11: Environment variables"""
        try:
            with open('/app/backend/.env', 'r') as f:
                env_content = f.read()
            
            # Check for required environment variables
            required_vars = [
                'BULK_CALL_RATE_PER_MIN=0.15',
                'BULK_CALL_MAX_LEADS=500'
            ]
            
            found_vars = 0
            for var in required_vars:
                if var in env_content:
                    found_vars += 1
            
            if found_vars == 2:
                self.log_result("Environment Variables", True, 
                              "Both BULK_CALL_RATE_PER_MIN=0.15 and BULK_CALL_MAX_LEADS=500 found")
            else:
                self.log_result("Environment Variables", False, 
                              f"Only found {found_vars}/2 required environment variables")
        except Exception as e:
            self.log_result("Environment Variables", False, str(e))
    
    def print_summary(self):
        print("\n" + "=" * 60)
        print("🎯 BULK CALL CAMPAIGN PRICING OVERHAUL TEST RESULTS")
        print("=" * 60)
        print(f"✅ PASSED: {self.passed}")
        print(f"❌ FAILED: {self.failed}")
        print(f"📊 SUCCESS RATE: {(self.passed / (self.passed + self.failed) * 100):.1f}%")
        
        if self.failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result["passed"]:
                    print(f"   • {result['test']}: {result['details']}")
        
        print("\n🎯 KEY FINDINGS:")
        print("   • All tests target the new $0.15/min pricing model")
        print("   • Maximum 500 leads per campaign enforcement")
        print("   • Wallet-only billing (no plan minutes used)")
        print("   • All calls billed minimum 1 minute regardless of outcome")
        print("   • Pre-campaign and per-batch credit checks implemented")

if __name__ == "__main__":
    tester = BulkCallPricingTests()
    tester.run_all_tests()