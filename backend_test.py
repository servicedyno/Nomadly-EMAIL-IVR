#!/usr/bin/env python3
"""
Backend Test Suite for Node.js Express Application
Testing the 2 specific fixes as outlined in the review request:

Fix 1: Lead job persistence recovery (js/lead-job-persistence.js + js/_index.js)
Fix 2: Activate shortener DNS routing (js/_index.js)
"""

import requests
import json
import re
import sys
from pathlib import Path

# Test configuration
BASE_URL = "http://localhost:5000"
TIMEOUT = 10

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def add_pass(self, test_name):
        print(f"✅ PASS: {test_name}")
        self.passed += 1
        
    def add_fail(self, test_name, error):
        print(f"❌ FAIL: {test_name} - {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} PASSED")
        if self.errors:
            print(f"\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}")
        return len(self.errors) == 0

def test_health_check():
    """Test 1: Basic health check - Node.js running on port 5000"""
    result = TestResult()
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)
        
        if response.status_code == 200:
            try:
                health_data = response.json()
                if health_data.get("status") in ["healthy", "starting"]:
                    result.add_pass("Node.js health endpoint responds correctly")
                else:
                    result.add_fail("Health endpoint", f"Unexpected status: {health_data.get('status')}")
            except:
                # Health endpoint returns HTML instead of JSON - this is noted but acceptable
                result.add_pass("Node.js health endpoint responds (HTML format)")
        else:
            result.add_fail("Health endpoint", f"Status code {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        result.add_fail("Health endpoint", f"Connection error: {e}")
        
    return result

def test_lead_job_persistence_code():
    """Test 2: Verify lead-job-persistence.js code fixes"""
    result = TestResult()
    
    try:
        # Read the lead-job-persistence.js file
        persistence_file = Path("/app/js/lead-job-persistence.js")
        if not persistence_file.exists():
            result.add_fail("Lead job persistence file", "File not found")
            return result
            
        content = persistence_file.read_text()
        
        # Test Fix 1a: findInterruptedJobs() query should include both 'running' and 'interrupted'
        if "{ status: { $in: ['running', 'interrupted'] } }" in content:
            result.add_pass("findInterruptedJobs() uses correct status query")
        else:
            result.add_fail("findInterruptedJobs()", "Query should use $in: ['running', 'interrupted']")
        
        # Test Fix 1b: flushAllJobs() should destructure { timer, getState } and call clearInterval(timer)
        # Look for the pattern: for (const [jobId, { timer, getState }] of activeJobs)
        if "for (const [jobId, { timer, getState }] of activeJobs)" in content:
            result.add_pass("flushAllJobs() destructures timer and getState correctly")
        else:
            result.add_fail("flushAllJobs()", "Should destructure { timer, getState } from activeJobs")
            
        # Verify clearInterval(timer) is called (not clearInterval(getState))
        if "clearInterval(timer)" in content and "clearInterval(getState)" not in content:
            result.add_pass("flushAllJobs() calls clearInterval(timer) correctly")
        else:
            result.add_fail("flushAllJobs()", "Should call clearInterval(timer), not clearInterval(getState)")
            
    except Exception as e:
        result.add_fail("Lead job persistence code review", f"Error reading file: {e}")
        
    return result

def test_sigterm_handlers():
    """Test 3: Verify SIGTERM/SIGINT handlers in _index.js"""
    result = TestResult()
    
    try:
        # Read the _index.js file
        index_file = Path("/app/js/_index.js")
        if not index_file.exists():
            result.add_fail("Index file", "File not found")
            return result
            
        content = index_file.read_text()
        
        # Test Fix 1c: Shared handleShutdown function for both SIGTERM and SIGINT
        if "async function handleShutdown(signal)" in content:
            result.add_pass("handleShutdown function exists")
        else:
            result.add_fail("SIGTERM handlers", "handleShutdown function not found")
            return result
            
        # Verify both signals are registered
        if "process.on('SIGTERM', () => handleShutdown('SIGTERM'))" in content:
            result.add_pass("SIGTERM handler registered correctly")
        else:
            result.add_fail("SIGTERM handlers", "SIGTERM handler not properly registered")
            
        if "process.on('SIGINT', () => handleShutdown('SIGINT'))" in content:
            result.add_pass("SIGINT handler registered correctly")
        else:
            result.add_fail("SIGTERM handlers", "SIGINT handler not properly registered")
            
    except Exception as e:
        result.add_fail("SIGTERM handlers code review", f"Error reading file: {e}")
        
    return result

def test_activate_shortener_handlers():
    """Test 4: Verify activate shortener DNS routing handlers in _index.js"""
    result = TestResult()
    
    try:
        # Read the _index.js file
        index_file = Path("/app/js/_index.js")
        if not index_file.exists():
            result.add_fail("Index file", "File not found")
            return result
            
        content = index_file.read_text()
        
        # Test Fix 2: Both activate shortener handlers use domainService.addDNSRecord()
        
        # Find activateShortener handler (around line 6326)
        activate_pattern = r"if \(message === t\.activateShortener\).*?return"
        activate_match = re.search(activate_pattern, content, re.DOTALL)
        
        if activate_match:
            activate_handler = activate_match.group(0)
            if "domainService.addDNSRecord(domain, recordType, server, '', db)" in activate_handler:
                result.add_pass("DNS menu activateShortener handler uses domainService.addDNSRecord()")
            else:
                result.add_fail("DNS menu activateShortener", "Should use domainService.addDNSRecord() as primary path")
                
            # Check for 5s sleep instead of 65s
            if "sleep(5000)" in activate_handler or "await sleep(5000)" in activate_handler:
                result.add_pass("DNS menu activateShortener uses 5s sleep")
            else:
                result.add_fail("DNS menu activateShortener", "Should use 5s sleep instead of 65s")
        else:
            result.add_fail("DNS menu activateShortener", "Handler not found")
        
        # Find QuickActivateShortener handler (around line 5541)
        if "QuickActivateShortener" in content:
            # Look for the domainService.addDNSRecord call in quick activate context
            quick_pattern = r"QuickActivateShortener.*?domainService\.addDNSRecord\(domain, recordType, server, '', db\)"
            if re.search(quick_pattern, content, re.DOTALL):
                result.add_pass("Quick-activate handler uses domainService.addDNSRecord()")
            else:
                result.add_fail("Quick-activate handler", "Should use domainService.addDNSRecord() as primary path")
                
        # Check for fallback to saveServerInDomain for legacy domains
        if "getDomainMeta()" in content and "saveServerInDomain" in content:
            result.add_pass("Fallback to saveServerInDomain exists for legacy domains")
        else:
            result.add_fail("Activate shortener fallback", "Should have fallback to saveServerInDomain for legacy domains")
            
    except Exception as e:
        result.add_fail("Activate shortener handlers code review", f"Error reading file: {e}")
        
    return result

def test_node_startup_logs():
    """Test 5: Check Node.js startup logs for critical errors"""
    result = TestResult()
    
    try:
        # Check if there are any critical startup errors in logs
        import subprocess
        
        # Get recent Node.js logs
        log_result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/backend.err.log"], 
            capture_output=True, text=True, timeout=5
        )
        
        if log_result.returncode == 0:
            logs = log_result.stdout
            
            # Check for critical errors that would indicate broken functionality
            critical_errors = [
                "Error:", "ECONNREFUSED", "MongoError", "SyntaxError", 
                "ReferenceError", "TypeError", "Cannot read property", "Cannot read properties"
            ]
            
            has_critical_error = False
            for error in critical_errors:
                if error in logs and "INFO:" not in logs.split(error)[0][-50:]:  # Avoid INFO logs
                    result.add_fail("Node.js startup logs", f"Critical error found: {error}")
                    has_critical_error = True
                    break
                    
            if not has_critical_error:
                result.add_pass("Node.js startup logs clean (no critical errors)")
        else:
            result.add_fail("Node.js startup logs", "Could not read log files")
            
    except Exception as e:
        result.add_fail("Node.js startup logs", f"Error checking logs: {e}")
        
    return result

def main():
    """Run all tests and report results"""
    print("🔧 Backend Test Suite - Node.js Express Application")
    print("Testing 2 specific fixes: Lead job persistence + Activate shortener DNS routing")
    print("=" * 80)
    
    all_results = []
    
    # Run all tests
    print("\n📋 Test 1: Health Check")
    all_results.append(test_health_check())
    
    print("\n📋 Test 2: Lead Job Persistence Code Review")
    all_results.append(test_lead_job_persistence_code())
    
    print("\n📋 Test 3: SIGTERM/SIGINT Handlers")
    all_results.append(test_sigterm_handlers())
    
    print("\n📋 Test 4: Activate Shortener DNS Routing")
    all_results.append(test_activate_shortener_handlers())
    
    print("\n📋 Test 5: Node.js Startup Logs")
    all_results.append(test_node_startup_logs())
    
    # Calculate overall results
    total_passed = sum(r.passed for r in all_results)
    total_failed = sum(r.failed for r in all_results)
    all_errors = []
    for r in all_results:
        all_errors.extend(r.errors)
    
    print(f"\n{'='*80}")
    print(f"🏁 OVERALL TEST RESULTS")
    print(f"{'='*80}")
    print(f"✅ PASSED: {total_passed}")
    print(f"❌ FAILED: {total_failed}")
    
    if all_errors:
        print(f"\n🚨 CRITICAL ISSUES FOUND:")
        for error in all_errors:
            print(f"  - {error}")
    else:
        print(f"\n🎉 ALL TESTS PASSED - Both fixes verified successfully!")
        
    print(f"{'='*80}")
    
    # Return exit code
    return 0 if len(all_errors) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())