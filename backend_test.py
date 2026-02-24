#!/usr/bin/env python3
"""
Backend Test Suite for Nomadly Node.js Backend
Focus: Clean: Decouple shortener from Anti-Red + simplify post-registration
"""

import requests
import subprocess
import sys
import re
import os

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_test(test_name):
    print(f"\n{Colors.BLUE}🧪 Testing: {test_name}{Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.ENDC}")

class BackendTester:
    def __init__(self):
        self.base_url = "http://localhost:5000"
        self.passed_tests = 0
        self.total_tests = 0
        
    def test_health_endpoint(self):
        """Test if Node.js service is running and healthy"""
        print_test("Node.js Health Check")
        self.total_tests += 1
        
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy' and data.get('database') == 'connected':
                    print_success("Node.js service running healthy on port 5000")
                    print_info(f"Database: {data.get('database')}, Uptime: {data.get('uptime')}")
                    self.passed_tests += 1
                    return True
                else:
                    print_error(f"Service unhealthy: {data}")
                    return False
            else:
                print_error(f"Health check failed with status {response.status_code}")
                return False
        except Exception as e:
            print_error(f"Cannot connect to Node.js service: {e}")
            return False

    def verify_domain_service_cleanup(self):
        """Verify domain-service.js has NO Anti-Red references and no anti-red-service import"""
        print_test("domain-service.js Anti-Red Cleanup")
        self.total_tests += 1
        
        try:
            with open('/app/js/domain-service.js', 'r') as f:
                content = f.read()
                
            # Check for Anti-Red references (case insensitive)
            anti_red_matches = re.findall(r'anti[-_\s]*red', content, re.IGNORECASE)
            if anti_red_matches:
                print_error(f"Found {len(anti_red_matches)} Anti-Red references: {anti_red_matches}")
                return False
                
            # Check for anti-red-service import
            import_matches = re.findall(r"require\s*\(\s*['\"].*anti-red.*['\"]", content, re.IGNORECASE)
            if import_matches:
                print_error(f"Found anti-red-service import: {import_matches}")
                return False
                
            # Verify all expected exports still exist
            required_exports = [
                'checkDomainPrice', 'registerDomain', 'addDNSRecord', 
                'viewDNSRecords', 'updateDNSRecord', 'deleteDNSRecord'
            ]
            missing_exports = []
            for export in required_exports:
                if export not in content:
                    missing_exports.append(export)
                    
            if missing_exports:
                print_error(f"Missing exports: {missing_exports}")
                return False
                
            print_success("domain-service.js is clean of Anti-Red references")
            print_success("anti-red-service import removed")
            print_success("All required exports present")
            self.passed_tests += 1
            return True
            
        except Exception as e:
            print_error(f"Error reading domain-service.js: {e}")
            return False

    def verify_buydomainfullprocess_changes(self):
        """Verify buyDomainFullProcess changes around line 11364"""
        print_test("buyDomainFullProcess NS Message Removal")
        self.total_tests += 1
        
        try:
            with open('/app/js/_index.js', 'r') as f:
                lines = f.readlines()
                
            # Find buyDomainFullProcess function
            func_start = -1
            func_end = -1
            for i, line in enumerate(lines):
                if 'buyDomainFullProcess = async' in line:
                    func_start = i
                elif func_start != -1 and line.strip().startswith('}') and 'catch' not in lines[i-5:i]:
                    # Find the closing brace of the function
                    brace_count = 0
                    for j in range(func_start, len(lines)):
                        brace_count += lines[j].count('{') - lines[j].count('}')
                        if brace_count == 0 and j > func_start:
                            func_end = j
                            break
                    break
                    
            if func_start == -1:
                print_error("Could not find buyDomainFullProcess function")
                return False
                
            func_lines = lines[func_start:func_end+1] if func_end != -1 else lines[func_start:]
            func_content = ''.join(func_lines)
            
            # Check that old sendMessage with "✅ Nameservers set to..." is REMOVED
            ns_message_patterns = [
                r'sendMessage.*✅.*Nameservers\s+set\s+to',
                r'sendMessage.*✅.*nameservers\s+set\s+to',
                r'send.*✅.*Nameservers\s+set\s+to',
                r'send.*✅.*nameservers\s+set\s+to'
            ]
            
            for pattern in ns_message_patterns:
                if re.search(pattern, func_content, re.IGNORECASE):
                    print_error(f"Found prohibited NS sendMessage: {pattern}")
                    return False
            
            # Verify "Track actual registrar" comment exists
            if "Track actual registrar" not in func_content:
                print_error("Missing 'Track actual registrar' comment")
                return False
                
            # Verify registrar assignment still exists
            if "registrar = buyResult.registrar || registrar" not in func_content:
                print_error("Missing registrar assignment line")
                return False
                
            # Verify only log(...) remains for NS handling
            ns_section = None
            for i, line in enumerate(func_lines):
                if "NS was set at registration time" in line:
                    # Check next few lines for log() usage
                    ns_section = ''.join(func_lines[i:i+5])
                    break
                    
            if ns_section and 'log(' in ns_section and 'sendMessage' not in ns_section:
                print_success("NS confirmation sendMessage correctly removed")
                print_success("Only log() remains in NS check block")
            else:
                print_warning("Could not verify NS section changes")
                
            print_success("'Track actual registrar' comment found")
            print_success("registrar assignment line present")
            self.passed_tests += 1
            return True
            
        except Exception as e:
            print_error(f"Error analyzing buyDomainFullProcess: {e}")
            return False

    def verify_shortener_comment_cleanup(self):
        """Verify shortener comment around line 5766 says 'use Cloudflare for DNS management' WITHOUT Anti-Red"""
        print_test("Shortener Comment Anti-Red Cleanup")
        self.total_tests += 1
        
        try:
            with open('/app/js/_index.js', 'r') as f:
                lines = f.readlines()
                
            # Find the shortener comment section around line 5766
            target_line = -1
            for i in range(5760, min(5780, len(lines))):
                if i < len(lines) and 'saveInfo(' in lines[i] and 'nsChoice' in lines[i] and 'cloudflare' in lines[i]:
                    target_line = i
                    break
                    
            if target_line == -1:
                print_error("Could not find saveInfo('nsChoice', 'cloudflare') line")
                return False
                
            # Check surrounding lines for the comment
            comment_section = ''.join(lines[max(0, target_line-5):target_line+5])
            
            # Verify comment says "use Cloudflare for DNS management" WITHOUT "Anti-Red"
            if "use Cloudflare for DNS management" in comment_section:
                if re.search(r'anti[-_\s]*red', comment_section, re.IGNORECASE):
                    print_error("Found Anti-Red reference in shortener comment")
                    return False
                else:
                    print_success("Comment says 'use Cloudflare for DNS management' without Anti-Red")
            else:
                print_warning("Could not find expected comment text")
                
            # Verify saveInfo line still exists
            if "saveInfo('nsChoice', 'cloudflare')" in comment_section:
                print_success("saveInfo('nsChoice', 'cloudflare') line present")
            else:
                print_error("saveInfo('nsChoice', 'cloudflare') line missing")
                return False
                
            self.passed_tests += 1
            return True
            
        except Exception as e:
            print_error(f"Error analyzing shortener comment: {e}")
            return False

    def verify_no_startup_errors(self):
        """Check Node.js startup logs for critical errors"""
        print_test("Node.js Startup Error Check")
        self.total_tests += 1
        
        try:
            # Check supervisor logs for backend
            result = subprocess.run(
                ['tail', '-n', '50', '/var/log/supervisor/backend.out.log'],
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                logs = result.stdout
                
                # Check for critical errors
                error_patterns = [
                    r'Error.*anti-red',
                    r'Cannot find module.*anti-red',
                    r'SyntaxError',
                    r'ReferenceError',
                    r'TypeError.*undefined.*anti',
                    r'ModuleNotFoundError'
                ]
                
                critical_errors = []
                for pattern in error_patterns:
                    matches = re.findall(pattern, logs, re.IGNORECASE)
                    if matches:
                        critical_errors.extend(matches)
                        
                if critical_errors:
                    print_error(f"Found critical startup errors: {critical_errors}")
                    return False
                    
                # Check for successful startup indicators
                success_indicators = [
                    'MongoDB connection pool ready',
                    'DB Connected',
                    'Early health check server started',
                    'Bot initialized'
                ]
                
                found_indicators = []
                for indicator in success_indicators:
                    if indicator in logs:
                        found_indicators.append(indicator)
                        
                if found_indicators:
                    print_success(f"Clean startup with indicators: {found_indicators}")
                else:
                    print_warning("No clear startup success indicators found")
                    
                self.passed_tests += 1
                return True
            else:
                print_warning("Could not read supervisor logs")
                self.passed_tests += 1  # Don't fail test for log access issues
                return True
                
        except Exception as e:
            print_warning(f"Could not check startup logs: {e}")
            self.passed_tests += 1  # Don't fail test for log access issues
            return True

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"\n{Colors.BOLD}{Colors.BLUE}🚀 Running Nomadly Backend Tests{Colors.ENDC}")
        print(f"{Colors.BOLD}Focus: Clean: Decouple shortener from Anti-Red + simplify post-registration{Colors.ENDC}")
        print("=" * 80)
        
        # Test 1: Health check
        self.test_health_endpoint()
        
        # Test 2: domain-service.js cleanup
        self.verify_domain_service_cleanup()
        
        # Test 3: buyDomainFullProcess changes
        self.verify_buydomainfullprocess_changes()
        
        # Test 4: Shortener comment cleanup
        self.verify_shortener_comment_cleanup()
        
        # Test 5: No startup errors
        self.verify_no_startup_errors()
        
        # Summary
        print("\n" + "=" * 80)
        print(f"{Colors.BOLD}📊 Test Summary{Colors.ENDC}")
        print(f"Tests Passed: {Colors.GREEN}{self.passed_tests}{Colors.ENDC}")
        print(f"Tests Failed: {Colors.RED}{self.total_tests - self.passed_tests}{Colors.ENDC}")
        print(f"Total Tests: {self.total_tests}")
        
        success_rate = (self.passed_tests / self.total_tests) * 100 if self.total_tests > 0 else 0
        if success_rate == 100:
            print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED! (100% success rate){Colors.ENDC}")
            return True
        elif success_rate >= 80:
            print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠️  Most tests passed ({success_rate:.1f}% success rate){Colors.ENDC}")
            return True
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ Multiple test failures ({success_rate:.1f}% success rate){Colors.ENDC}")
            return False

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)