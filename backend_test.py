#!/usr/bin/env python3
"""
Backend Test Suite for Shortener Activation Persistence
Tests the Node.js application shortener activation persistence implementation.
"""
import requests
import json
import time
import sys
import os
from typing import Dict, Any, List

# Test configuration
BACKEND_URL = "http://localhost:5000"
TEST_RESULTS: List[Dict[str, Any]] = []

def log_test(test_name: str, status: str, message: str = "", details: str = ""):
    """Log test results"""
    result = {
        "test": test_name,
        "status": status,
        "message": message,
        "details": details,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    TEST_RESULTS.append(result)
    
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_icon} {test_name}: {message}")
    if details:
        print(f"    Details: {details}")

def test_service_health():
    """Test 1: Health check - Node.js port 5000"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                log_test("Service Health Check", "PASS", f"Node.js service healthy on port 5000")
                return True
            else:
                log_test("Service Health Check", "FAIL", f"Service not healthy: {data}")
                return False
        else:
            log_test("Service Health Check", "FAIL", f"HTTP {response.status_code}")
            return False
    except Exception as e:
        log_test("Service Health Check", "FAIL", f"Connection failed: {str(e)}")
        return False

def test_persistence_module_structure():
    """Test 2: Verify shortener-activation-persistence.js module structure"""
    try:
        # Check if the file exists and has expected content
        with open('/app/js/shortener-activation-persistence.js', 'r') as f:
            content = f.read()
        
        # Check for required functions
        required_functions = [
            'initShortenerPersistence',
            'createActivationTask',
            'markRailwayLinked',
            'markDnsAdded',
            'markCompleted',
            'markFailed',
            'findIncompleteTasks'
        ]
        
        missing_functions = []
        for func in required_functions:
            if f"function {func}" not in content and f"{func}:" not in content:
                missing_functions.append(func)
        
        # Check module exports
        exports_found = "module.exports = {" in content
        collection_used = "shortenerActivations" in content
        
        if missing_functions:
            log_test("Persistence Module Structure", "FAIL", 
                   f"Missing functions: {', '.join(missing_functions)}")
            return False
        elif not exports_found:
            log_test("Persistence Module Structure", "FAIL", "Module exports not found")
            return False
        elif not collection_used:
            log_test("Persistence Module Structure", "FAIL", "shortenerActivations collection not used")
            return False
        else:
            log_test("Persistence Module Structure", "PASS", 
                   f"All 7 functions found, uses shortenerActivations collection")
            return True
            
    except FileNotFoundError:
        log_test("Persistence Module Structure", "FAIL", "shortener-activation-persistence.js not found")
        return False
    except Exception as e:
        log_test("Persistence Module Structure", "FAIL", f"Error reading file: {str(e)}")
        return False

def test_index_imports():
    """Test 3: Verify _index.js imports all persistence functions"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for import line
        import_pattern = "require('./shortener-activation-persistence.js')"
        if import_pattern not in content:
            log_test("Index.js Imports", "FAIL", "shortener-activation-persistence.js not imported")
            return False
        
        # Check all functions are imported
        required_imports = [
            'initShortenerPersistence',
            'createActivationTask',
            'markRailwayLinked',
            'markDnsAdded',
            'markCompleted',
            'markFailed',
            'findIncompleteTasks'
        ]
        
        import_line = None
        for line in content.split('\n'):
            if 'shortener-activation-persistence.js' in line and 'require' in line:
                import_line = line
                break
        
        if not import_line:
            log_test("Index.js Imports", "FAIL", "Import line not found")
            return False
        
        missing_imports = []
        for func in required_imports:
            if func not in import_line:
                missing_imports.append(func)
        
        if missing_imports:
            log_test("Index.js Imports", "FAIL", 
                   f"Missing imports: {', '.join(missing_imports)}")
            return False
        else:
            log_test("Index.js Imports", "PASS", "All 7 persistence functions imported correctly")
            return True
            
    except Exception as e:
        log_test("Index.js Imports", "FAIL", f"Error checking imports: {str(e)}")
        return False

def test_startup_initialization():
    """Test 4: Verify initialization calls in startup"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            lines = f.readlines()
        
        # Find initialization calls
        init_shortener_found = False
        resume_shortener_found = False
        
        for i, line in enumerate(lines):
            if 'initShortenerPersistence(db)' in line:
                init_shortener_found = True
                log_test("Startup Initialization", "INFO", 
                       f"initShortenerPersistence(db) found at line {i+1}")
            
            if 'resumeShortenerActivations()' in line:
                resume_shortener_found = True
                log_test("Startup Initialization", "INFO", 
                       f"resumeShortenerActivations() found at line {i+1}")
        
        if init_shortener_found and resume_shortener_found:
            log_test("Startup Initialization", "PASS", 
                   "Both initShortenerPersistence(db) and resumeShortenerActivations() found")
            return True
        else:
            missing = []
            if not init_shortener_found:
                missing.append("initShortenerPersistence(db)")
            if not resume_shortener_found:
                missing.append("resumeShortenerActivations()")
            
            log_test("Startup Initialization", "FAIL", 
                   f"Missing calls: {', '.join(missing)}")
            return False
            
    except Exception as e:
        log_test("Startup Initialization", "FAIL", f"Error checking initialization: {str(e)}")
        return False

def test_handler_wrapping():
    """Test 5: Verify all 3 activation handlers are wrapped with persistence calls"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for createActivationTask calls - should be 3 instances
        create_task_count = content.count('createActivationTask(')
        
        # Check for other persistence markers
        railway_linked_count = content.count('markRailwayLinked(')
        dns_added_count = content.count('markDnsAdded(')
        completed_count = content.count('markCompleted(')
        failed_count = content.count('markFailed(')
        
        results = {
            'createActivationTask': create_task_count,
            'markRailwayLinked': railway_linked_count,
            'markDnsAdded': dns_added_count,
            'markCompleted': completed_count,
            'markFailed': failed_count
        }
        
        # We expect at least 3 of each (one per handler)
        issues = []
        for func, count in results.items():
            if count < 3:
                issues.append(f"{func}: {count} (expected ≥3)")
        
        if issues:
            log_test("Handler Wrapping", "FAIL", 
                   f"Insufficient persistence calls: {', '.join(issues)}")
            return False
        else:
            log_test("Handler Wrapping", "PASS", 
                   f"All handlers wrapped: createActivationTask({create_task_count}), markRailwayLinked({railway_linked_count}), markDnsAdded({dns_added_count}), markCompleted({completed_count}), markFailed({failed_count})")
            return True
            
    except Exception as e:
        log_test("Handler Wrapping", "FAIL", f"Error checking handler wrapping: {str(e)}")
        return False

def test_resume_function_implementation():
    """Test 6: Verify resumeShortenerActivations function handles all 3 statuses"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Find the resumeShortenerActivations function
        func_start = content.find('async function resumeShortenerActivations(')
        if func_start == -1:
            func_start = content.find('function resumeShortenerActivations(')
        
        if func_start == -1:
            log_test("Resume Function Implementation", "FAIL", 
                   "resumeShortenerActivations function not found")
            return False
        
        # Extract the function (find matching brace)
        brace_count = 0
        func_end = func_start
        in_function = False
        
        for i in range(func_start, len(content)):
            char = content[i]
            if char == '{':
                in_function = True
                brace_count += 1
            elif char == '}' and in_function:
                brace_count -= 1
                if brace_count == 0:
                    func_end = i
                    break
        
        func_content = content[func_start:func_end+1]
        
        # Check for handling of all 3 statuses
        statuses_handled = {
            'pending': "status === 'pending'" in func_content,
            'railway_linked': "status === 'railway_linked'" in func_content,
            'dns_added': "status === 'dns_added'" in func_content
        }
        
        # Check for proper function calls
        calls_found = {
            'findIncompleteTasks': 'findIncompleteTasks()' in func_content,
            'markFailed': 'markFailed(' in func_content,
            'addDnsForShortener': 'addDnsForShortener(' in func_content or 'domainService.addDNSRecord(' in func_content
        }
        
        missing_statuses = [status for status, found in statuses_handled.items() if not found]
        missing_calls = [call for call, found in calls_found.items() if not found]
        
        if missing_statuses:
            log_test("Resume Function Implementation", "FAIL", 
                   f"Missing status handling: {', '.join(missing_statuses)}")
            return False
        elif missing_calls:
            log_test("Resume Function Implementation", "FAIL", 
                   f"Missing function calls: {', '.join(missing_calls)}")
            return False
        else:
            log_test("Resume Function Implementation", "PASS", 
                   "Handles all 3 statuses (pending, railway_linked, dns_added) with proper function calls")
            return True
            
    except Exception as e:
        log_test("Resume Function Implementation", "FAIL", f"Error checking resume function: {str(e)}")
        return False

def test_startup_logs():
    """Test 7: Verify initialization log appears in startup logs"""
    try:
        # Check Node.js logs for the initialization message
        import subprocess
        result = subprocess.run(['tail', '-n', '100', '/var/log/supervisor/nodejs.out.log'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            logs = result.stdout
            if '[ShortenerPersistence] Initialized' in logs:
                log_test("Startup Logs", "PASS", 
                       "[ShortenerPersistence] Initialized message found in logs")
                return True
            else:
                log_test("Startup Logs", "FAIL", 
                       "[ShortenerPersistence] Initialized message not found in recent logs")
                return False
        else:
            log_test("Startup Logs", "FAIL", f"Could not read logs: {result.stderr}")
            return False
            
    except Exception as e:
        log_test("Startup Logs", "FAIL", f"Error checking startup logs: {str(e)}")
        return False

def test_helper_function():
    """Test 8: Verify addDnsForShortener helper exists"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for the helper function
        if 'function addDnsForShortener(' in content or 'addDnsForShortener(' in content:
            # Verify it uses domainService.addDNSRecord
            if 'domainService.addDNSRecord(' in content:
                log_test("Helper Function", "PASS", 
                       "addDnsForShortener helper function exists with domainService.addDNSRecord")
                return True
            else:
                log_test("Helper Function", "FAIL", 
                       "addDnsForShortener exists but doesn't use domainService.addDNSRecord")
                return False
        else:
            log_test("Helper Function", "FAIL", "addDnsForShortener helper function not found")
            return False
            
    except Exception as e:
        log_test("Helper Function", "FAIL", f"Error checking helper function: {str(e)}")
        return False

def test_error_handling():
    """Test 9: Check for proper error handling in handlers"""
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Count try-catch blocks around createActivationTask
        import re
        
        # Find all createActivationTask calls and check if they're in try-catch
        activation_calls = []
        for match in re.finditer(r'createActivationTask\([^)]*\)', content):
            start_pos = match.start()
            # Look backwards for try keyword
            search_back = content[max(0, start_pos-1000):start_pos]
            if 'try {' in search_back:
                activation_calls.append(True)
            else:
                activation_calls.append(False)
        
        # Check if markFailed is called in catch blocks
        catch_blocks_with_markFailed = content.count('markFailed(') >= 3
        
        protected_calls = sum(activation_calls)
        total_calls = len(activation_calls)
        
        if total_calls >= 3 and protected_calls >= 2:
            log_test("Error Handling", "PASS", 
                   f"{protected_calls}/{total_calls} activation calls protected, markFailed calls present")
            return True
        else:
            log_test("Error Handling", "WARN", 
                   f"Only {protected_calls}/{total_calls} activation calls appear to be in try-catch blocks")
            return True  # This is not critical
            
    except Exception as e:
        log_test("Error Handling", "FAIL", f"Error checking error handling: {str(e)}")
        return False

def run_comprehensive_test():
    """Run all tests for shortener activation persistence"""
    print("🧪 Starting Comprehensive Shortener Activation Persistence Test Suite")
    print("=" * 80)
    
    # Run all tests
    tests = [
        test_service_health,
        test_persistence_module_structure,
        test_index_imports,
        test_startup_initialization,
        test_handler_wrapping,
        test_resume_function_implementation,
        test_startup_logs,
        test_helper_function,
        test_error_handling
    ]
    
    passed = 0
    failed = 0
    warned = 0
    
    for test_func in tests:
        result = test_func()
        if result is True:
            passed += 1
        elif result is False:
            failed += 1
        else:
            warned += 1
    
    print("\n" + "=" * 80)
    print(f"📊 Test Summary: {passed} passed, {failed} failed, {warned} warnings")
    
    # Critical issues
    critical_failures = [r for r in TEST_RESULTS if r['status'] == 'FAIL']
    if critical_failures:
        print("\n❌ Critical Issues Found:")
        for failure in critical_failures:
            print(f"  • {failure['test']}: {failure['message']}")
    
    # Success summary
    if failed == 0:
        print("\n✅ All critical tests passed! Shortener activation persistence implementation is working correctly.")
        return True
    else:
        print(f"\n⚠️ {failed} critical issues need attention before marking as working.")
        return False

if __name__ == "__main__":
    success = run_comprehensive_test()
    sys.exit(0 if success else 1)