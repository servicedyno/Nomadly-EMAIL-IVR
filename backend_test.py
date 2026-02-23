#!/usr/bin/env python3

"""
Backend Test Suite - CF Protection Coverage Fixes
Tests the 4 specific fixes implemented for full CF protection coverage at zone creation
"""

import requests
import json
import os
import sys
from typing import Dict, Any, List

class BackendTester:
    def __init__(self):
        # Get backend URL from frontend .env
        env_path = '/app/frontend/.env'
        self.backend_url = None
        try:
            with open(env_path, 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        self.backend_url = line.split('=', 1)[1].strip()
                        break
        except FileNotFoundError:
            pass
        
        if not self.backend_url:
            self.backend_url = 'http://localhost:5000'
        
        self.api_url = f"{self.backend_url}/api"
        self.results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None):
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.results.append(result)
        status = "✅" if success else "❌"
        print(f"{status} {test_name}: {message}")
        
    def test_node_service_health(self):
        """Test if Node.js backend service is running and healthy"""
        try:
            response = requests.get(f"{self.backend_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy':
                    self.log_result(
                        "Backend Health Check",
                        True,
                        f"Node.js service healthy, uptime: {data.get('uptime', 'unknown')}"
                    )
                    return True
                else:
                    self.log_result("Backend Health Check", False, f"Service unhealthy: {data}")
                    return False
            else:
                self.log_result("Backend Health Check", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Backend Health Check", False, f"Connection failed: {str(e)}")
            return False
    
    def verify_code_structure(self):
        """Verify all 4 fixes are structurally implemented correctly"""
        
        # Fix A: deploySharedWorkerRoute creates 3 routes 
        print("\n🔍 Verifying Fix A: deploySharedWorkerRoute creates 3 routes")
        with open('/app/js/anti-red-service.js', 'r') as f:
            content = f.read()
        
        # Check for all 3 route patterns
        has_main_route = '${domain}/*' in content and 'Deploy main domain route' in content
        has_bare_route = 'Deploy bare domain route' in content and 'r.pattern === domain' in content
        has_www_route = 'Deploy www variant route' in content and 'www.${domain}/*' in content
        
        fix_a_success = has_main_route and has_bare_route and has_www_route
        self.log_result(
            "Fix A: deploySharedWorkerRoute 3 routes",
            fix_a_success,
            f"Main route: {has_main_route}, Bare route: {has_bare_route}, WWW route: {has_www_route}",
            {
                "main_route_pattern": has_main_route,
                "bare_route_pattern": has_bare_route, 
                "www_route_pattern": has_www_route
            }
        )
        
        # Fix B: deployFullProtection uses deploySharedWorkerRoute
        print("\n🔍 Verifying Fix B: deployFullProtection uses deploySharedWorkerRoute")
        has_deploy_shared = 'results.cfWorker = await deploySharedWorkerRoute(domain, zone.id)' in content
        has_comment = '3d. Deploy shared Cloudflare Worker routes' in content
        
        fix_b_success = has_deploy_shared and has_comment
        self.log_result(
            "Fix B: deployFullProtection uses deploySharedWorkerRoute", 
            fix_b_success,
            f"Call found: {has_deploy_shared}, Comment found: {has_comment}",
            {"shared_worker_call": has_deploy_shared, "descriptive_comment": has_comment}
        )
        
        # Fix C: removeWorkerRoutes handles bare domain
        print("\n🔍 Verifying Fix C: removeWorkerRoutes handles bare domain")
        has_bare_filter = 'r.pattern === domain' in content and 'removeWorkerRoutes' in content
        has_triple_filter = 'r.pattern === `${domain}/*` || r.pattern === `www.${domain}/*` || r.pattern === domain' in content
        
        fix_c_success = has_bare_filter and has_triple_filter
        self.log_result(
            "Fix C: removeWorkerRoutes handles bare domain",
            fix_c_success, 
            f"Bare domain filter: {has_bare_filter}, Triple pattern filter: {has_triple_filter}",
            {"bare_domain_filter": has_bare_filter, "complete_filter": has_triple_filter}
        )
        
        # Fix D: createAntiBotRules creates 3 batches
        print("\n🔍 Verifying Fix D: createAntiBotRules creates 3 batches")
        with open('/app/js/cf-service.js', 'r') as f:
            cf_content = f.read()
        
        has_batches_array = 'const batches = [' in cf_content
        has_batch1 = "'Googlebot', 'bingbot', 'Baiduspider'" in cf_content
        has_batch2 = "'AhrefsBot', 'SemrushBot', 'MJ12bot'" in cf_content  
        has_batch3 = "'serpstatbot', 'Bytespider', 'GPTBot'" in cf_content
        has_existing_check = 'if (existingCount >= 3)' in cf_content
        has_batch_loop = 'for (let i = 0; i < batches.length; i++)' in cf_content
        
        fix_d_success = all([has_batches_array, has_batch1, has_batch2, has_batch3, has_existing_check, has_batch_loop])
        self.log_result(
            "Fix D: createAntiBotRules creates 3 batches",
            fix_d_success,
            f"Batches: {has_batches_array}, B1: {has_batch1}, B2: {has_batch2}, B3: {has_batch3}, Check: {has_existing_check}, Loop: {has_batch_loop}",
            {
                "batches_array": has_batches_array,
                "batch1_bots": has_batch1,
                "batch2_bots": has_batch2, 
                "batch3_bots": has_batch3,
                "existing_rules_check": has_existing_check,
                "batch_processing_loop": has_batch_loop
            }
        )
        
        return fix_a_success and fix_b_success and fix_c_success and fix_d_success
        
    def test_function_exports(self):
        """Verify all required functions are exported from modules"""
        
        # Test anti-red-service.js exports
        print("\n🔍 Verifying anti-red-service.js exports")
        with open('/app/js/anti-red-service.js', 'r') as f:
            content = f.read()
            
        required_exports = [
            'deploySharedWorkerRoute',
            'removeWorkerRoutes', 
            'deployFullProtection'
        ]
        
        missing_exports = []
        for export in required_exports:
            if export not in content or f'  {export},' not in content:
                missing_exports.append(export)
                
        antired_exports_success = len(missing_exports) == 0
        self.log_result(
            "anti-red-service.js exports",
            antired_exports_success,
            f"Missing exports: {missing_exports}" if missing_exports else "All required functions exported",
            {"missing_exports": missing_exports, "required_exports": required_exports}
        )
        
        # Test cf-service.js exports  
        print("\n🔍 Verifying cf-service.js exports")
        with open('/app/js/cf-service.js', 'r') as f:
            cf_content = f.read()
            
        cf_required_exports = ['createAntiBotRules']
        cf_missing_exports = []
        for export in cf_required_exports:
            if export not in cf_content or f'  {export},' not in cf_content:
                cf_missing_exports.append(export)
                
        cf_exports_success = len(cf_missing_exports) == 0
        self.log_result(
            "cf-service.js exports",
            cf_exports_success,
            f"Missing exports: {cf_missing_exports}" if cf_missing_exports else "All required functions exported", 
            {"missing_exports": cf_missing_exports, "required_exports": cf_required_exports}
        )
        
        return antired_exports_success and cf_exports_success
    
    def test_syntax_validation(self):
        """Validate JavaScript syntax using Node.js"""
        
        files_to_check = [
            '/app/js/anti-red-service.js',
            '/app/js/cf-service.js'
        ]
        
        all_valid = True
        for file_path in files_to_check:
            try:
                # Use node --check to validate syntax
                result = os.system(f'node --check {file_path} 2>/dev/null')
                file_valid = result == 0
                
                filename = os.path.basename(file_path)
                self.log_result(
                    f"JavaScript Syntax: {filename}",
                    file_valid,
                    "Valid JavaScript syntax" if file_valid else "Syntax errors detected",
                    {"file": file_path, "exit_code": result}
                )
                
                if not file_valid:
                    all_valid = False
                    
            except Exception as e:
                self.log_result(
                    f"JavaScript Syntax: {os.path.basename(file_path)}", 
                    False,
                    f"Validation error: {str(e)}",
                    {"file": file_path, "error": str(e)}
                )
                all_valid = False
                
        return all_valid
    
    def test_service_startup_logs(self):
        """Check Node.js service startup logs for any critical errors"""
        
        try:
            # Check supervisor logs for backend service
            result = os.popen('tail -n 50 /var/log/supervisor/backend.*.log 2>/dev/null | grep -i "error\\|failed\\|exception" | head -10').read().strip()
            
            if result:
                # Found some errors, but check if they're critical
                lines = result.split('\n')
                critical_errors = []
                for line in lines:
                    if any(keyword in line.lower() for keyword in ['syntax', 'module', 'cannot', 'failed to start']):
                        critical_errors.append(line)
                
                has_critical = len(critical_errors) > 0
                self.log_result(
                    "Service Startup Logs",
                    not has_critical,
                    f"Found {len(lines)} log entries, {len(critical_errors)} critical errors",
                    {"total_entries": len(lines), "critical_errors": critical_errors}
                )
                return not has_critical
            else:
                self.log_result(
                    "Service Startup Logs",
                    True, 
                    "No critical errors found in startup logs",
                    {"clean_startup": True}
                )
                return True
                
        except Exception as e:
            self.log_result(
                "Service Startup Logs",
                False,
                f"Could not check logs: {str(e)}",
                {"error": str(e)}
            )
            return False
    
    def generate_report(self):
        """Generate final test report"""
        
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r['success']])
        failed_tests = total_tests - passed_tests
        
        print(f"\n" + "="*70)
        print(f"🧪 CF PROTECTION COVERAGE FIXES - TEST REPORT")
        print(f"="*70)
        print(f"📊 Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"📈 Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"   • {result['test']}: {result['message']}")
        
        # Summary of fixes verification
        print(f"\n📋 FIXES VERIFICATION SUMMARY:")
        
        fix_results = {}
        for result in self.results:
            if result['test'].startswith('Fix '):
                fix_name = result['test'].split(':')[0]
                fix_results[fix_name] = result['success']
        
        for fix, success in fix_results.items():
            status = "✅" if success else "❌"
            print(f"   {status} {fix}: {'VERIFIED' if success else 'FAILED'}")
        
        all_fixes_working = all(fix_results.values()) if fix_results else False
        
        print(f"\n🎯 OVERALL RESULT:")
        if all_fixes_working and failed_tests == 0:
            print(f"   ✅ ALL CF PROTECTION COVERAGE FIXES WORKING CORRECTLY")
        elif all_fixes_working:
            print(f"   ⚠️  CF FIXES IMPLEMENTED BUT SOME TESTS FAILED") 
        else:
            print(f"   ❌ CRITICAL ISSUES WITH CF PROTECTION FIXES")
            
        return {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": passed_tests/total_tests*100,
            "all_fixes_working": all_fixes_working,
            "results": self.results
        }

def main():
    print("🚀 Starting CF Protection Coverage Fixes Backend Testing...")
    
    tester = BackendTester()
    
    # Run all tests
    print("\n" + "="*50)
    print("RUNNING BACKEND TESTS")
    print("="*50)
    
    # Test 1: Node.js service health
    tester.test_node_service_health()
    
    # Test 2: Verify all 4 fixes are implemented
    tester.verify_code_structure()
    
    # Test 3: Check function exports
    tester.test_function_exports()
    
    # Test 4: Validate JavaScript syntax
    tester.test_syntax_validation()
    
    # Test 5: Check startup logs
    tester.test_service_startup_logs()
    
    # Generate and display final report
    report = tester.generate_report()
    
    # Exit with appropriate code
    sys.exit(0 if report['failed'] == 0 else 1)

if __name__ == "__main__":
    main()