#!/usr/bin/env python3
"""
VPS/RDP Button Visibility Fix - Comprehensive Backend Testing
Tests the VPS button visibility fix on the Nomadly Telegram bot.
"""

import subprocess
import json
import os
import sys
import re
from pathlib import Path

class VPSButtonTest:
    def __init__(self):
        self.test_results = []
        self.passed = 0
        self.failed = 0
        
    def log_test(self, test_name, passed, details=""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        self.test_results.append(f"{status}: {test_name}")
        if details:
            self.test_results.append(f"    {details}")
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            
    def run_command(self, cmd, cwd=None):
        """Run shell command and return result"""
        try:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
            return result.returncode == 0, result.stdout, result.stderr
        except Exception as e:
            return False, "", str(e)
    
    def test_syntax_validation(self):
        """Test 1: Syntax validation for all 5 modified files"""
        files = [
            '/app/js/lang/en.js',
            '/app/js/lang/fr.js', 
            '/app/js/lang/zh.js',
            '/app/js/lang/hi.js',
            '/app/js/_index.js'
        ]
        
        all_passed = True
        for file_path in files:
            success, stdout, stderr = self.run_command(f'node -c {file_path}')
            if success:
                self.log_test(f"Syntax validation: {os.path.basename(file_path)}", True)
            else:
                self.log_test(f"Syntax validation: {os.path.basename(file_path)}", False, f"Error: {stderr}")
                all_passed = False
                
        return all_passed
    
    def test_nodejs_health(self):
        """Test 2: Node.js health endpoint and error log"""
        # Check health endpoint
        success, stdout, stderr = self.run_command('curl -s localhost:5000/health')
        health_passed = False
        if success and 'healthy' in stdout:
            try:
                health_data = json.loads(stdout)
                if health_data.get('status') == 'healthy' and health_data.get('database') == 'connected':
                    health_passed = True
                    self.log_test("Health endpoint check", True, f"Status: {health_data.get('status')}, DB: {health_data.get('database')}")
                else:
                    self.log_test("Health endpoint check", False, f"Unexpected response: {stdout}")
            except json.JSONDecodeError:
                self.log_test("Health endpoint check", False, f"Invalid JSON response: {stdout}")
        else:
            self.log_test("Health endpoint check", False, f"Failed to reach endpoint: {stderr}")
        
        # Check error log size
        error_log_passed = False
        if os.path.exists('/var/log/supervisor/nodejs.err.log'):
            size = os.path.getsize('/var/log/supervisor/nodejs.err.log')
            if size == 0:
                error_log_passed = True
                self.log_test("Error log check", True, "0-byte error log (clean)")
            else:
                self.log_test("Error log check", False, f"Error log size: {size} bytes")
        else:
            self.log_test("Error log check", False, "Error log file not found")
            
        return health_passed and error_log_passed
    
    def test_vps_enabled_env(self):
        """Test 3: VPS_ENABLED environment variable"""
        env_file = '/app/backend/.env'
        if os.path.exists(env_file):
            with open(env_file, 'r') as f:
                content = f.read()
                if 'VPS_ENABLED=true' in content:
                    self.log_test("VPS_ENABLED environment variable", True, "Found VPS_ENABLED=true in .env")
                    return True
                else:
                    self.log_test("VPS_ENABLED environment variable", False, "VPS_ENABLED=true not found in .env")
                    return False
        else:
            self.log_test("VPS_ENABLED environment variable", False, ".env file not found")
            return False
    
    def test_keyboard_structure(self):
        """Test 4: Keyboard structure in all 4 language files"""
        lang_files = {
            'en': '/app/js/lang/en.js',
            'fr': '/app/js/lang/fr.js',
            'zh': '/app/js/lang/zh.js', 
            'hi': '/app/js/lang/hi.js'
        }
        
        all_passed = True
        for lang, file_path in lang_files.items():
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # Check for VPS conditional keyboard entry
                vps_pattern = r'\.\.\.\(VPS_ENABLED === \'true\' \? \[\[user\.vpsPlans\]\] : \[\]\)'
                if re.search(vps_pattern, content):
                    # Check positioning - should be after domainNames/hostingDomainsRedirect and before emailValidation/virtualCard
                    lines = content.split('\n')
                    vps_line = -1
                    domain_line = -1
                    email_line = -1
                    
                    for i, line in enumerate(lines):
                        if 'user.domainNames, user.hostingDomainsRedirect' in line:
                            domain_line = i
                        elif 'VPS_ENABLED === \'true\' ? [[user.vpsPlans]]' in line:
                            vps_line = i
                        elif 'user.emailValidation, user.virtualCard' in line:
                            email_line = i
                    
                    if domain_line < vps_line < email_line:
                        self.log_test(f"Keyboard structure ({lang})", True, "VPS button correctly positioned")
                    else:
                        self.log_test(f"Keyboard structure ({lang})", False, f"VPS button positioning incorrect. Domain: {domain_line}, VPS: {vps_line}, Email: {email_line}")
                        all_passed = False
                else:
                    self.log_test(f"Keyboard structure ({lang})", False, "VPS conditional keyboard entry not found")
                    all_passed = False
            else:
                self.log_test(f"Keyboard structure ({lang})", False, f"File not found: {file_path}")
                all_passed = False
                
        return all_passed
    
    def test_button_labels(self):
        """Test 5: Button label updates in all 4 language files"""
        expected_labels = {
            'en': '🖥️ VPS/RDP — Bulletproof Servers',
            'fr': '🖥️ VPS/RDP — Serveurs Blindés',
            'zh': '🖥️ VPS/RDP — 防弹服务器', 
            'hi': '🖥️ VPS/RDP — बुलेटप्रूफ सर्वर'
        }
        
        lang_files = {
            'en': '/app/js/lang/en.js',
            'fr': '/app/js/lang/fr.js',
            'zh': '/app/js/lang/zh.js',
            'hi': '/app/js/lang/hi.js'
        }
        
        all_passed = True
        for lang, file_path in lang_files.items():
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    expected = expected_labels[lang]
                    if f"vpsPlans: '{expected}'" in content:
                        self.log_test(f"Button label ({lang})", True, f"Correct label: {expected}")
                    else:
                        self.log_test(f"Button label ({lang})", False, f"Expected: {expected}")
                        all_passed = False
            else:
                self.log_test(f"Button label ({lang})", False, f"File not found: {file_path}")
                all_passed = False
                
        return all_passed
    
    def test_backward_compatibility(self):
        """Test 6: Backward compatibility in _index.js"""
        index_file = '/app/js/_index.js'
        if os.path.exists(index_file):
            with open(index_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Look for VPS handler section
            vps_section_found = False
            old_labels_found = False
            
            # Check for VPS plans comment
            if '//VPS plans' in content:
                vps_section_found = True
                
                # Check for backward compatibility with old button texts
                old_button_patterns = [
                    'Buy Bulletproof VPS🛡️ - Hourly/Monthly',
                    'Acheter un VPS Bulletproof🛡️ - Horaire/Mensuel',
                    '购买防弹 VPS🛡️ - 按小时/按月',
                    'बुलेटप्रूफ VPS🛡️ खरीदें - प्रति घंटा/मासिक'
                ]
                
                found_patterns = []
                for pattern in old_button_patterns:
                    if pattern in content:
                        found_patterns.append(pattern)
                
                if len(found_patterns) == len(old_button_patterns):
                    old_labels_found = True
                    self.log_test("Backward compatibility", True, f"Found all {len(found_patterns)} old button patterns")
                else:
                    self.log_test("Backward compatibility", False, f"Found only {len(found_patterns)}/{len(old_button_patterns)} old button patterns")
                    
                # Check for new user.vpsPlans reference
                if 'user.vpsPlans' in content:
                    self.log_test("New button reference", True, "user.vpsPlans found in handler")
                else:
                    self.log_test("New button reference", False, "user.vpsPlans not found in handler")
                    old_labels_found = False
            else:
                self.log_test("Backward compatibility", False, "VPS plans section not found")
                
            return vps_section_found and old_labels_found
        else:
            self.log_test("Backward compatibility", False, "_index.js file not found")
            return False
    
    def test_railway_env_verification(self):
        """Test 7: Railway environment variable verification"""
        # Since we can't directly access Railway API from this environment,
        # we'll check if the local environment shows VPS_ENABLED=true
        # and verify the Railway configuration files exist
        
        railway_files = ['/app/railway.json']
        env_vars_found = []
        
        # Check if Railway config exists
        railway_config_exists = any(os.path.exists(f) for f in railway_files)
        
        # Check local VPS_ENABLED
        local_vps_enabled = os.environ.get('VPS_ENABLED') == 'true'
        
        # Check .env file
        env_file_vps = False
        if os.path.exists('/app/backend/.env'):
            with open('/app/backend/.env', 'r') as f:
                content = f.read()
                env_file_vps = 'VPS_ENABLED=true' in content
        
        if railway_config_exists and (local_vps_enabled or env_file_vps):
            self.log_test("Railway environment setup", True, "Railway config exists and VPS_ENABLED=true found")
            return True
        else:
            details = f"Railway config: {railway_config_exists}, Local VPS_ENABLED: {local_vps_enabled}, .env VPS_ENABLED: {env_file_vps}"
            self.log_test("Railway environment setup", False, details)
            return False
    
    def run_all_tests(self):
        """Run all tests and return summary"""
        print("🧪 VPS/RDP Button Visibility Fix - Backend Testing")
        print("=" * 60)
        
        tests = [
            ("Syntax Validation", self.test_syntax_validation),
            ("Node.js Health", self.test_nodejs_health), 
            ("VPS_ENABLED Environment", self.test_vps_enabled_env),
            ("Keyboard Structure", self.test_keyboard_structure),
            ("Button Labels", self.test_button_labels),
            ("Backward Compatibility", self.test_backward_compatibility),
            ("Railway Environment", self.test_railway_env_verification)
        ]
        
        for test_name, test_func in tests:
            print(f"\n🔍 Running: {test_name}")
            try:
                result = test_func()
                print(f"Result: {'✅ PASS' if result else '❌ FAIL'}")
            except Exception as e:
                print(f"Result: ❌ ERROR - {str(e)}")
                self.log_test(test_name, False, f"Exception: {str(e)}")
        
        return self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        total = self.passed + self.failed
        success_rate = (self.passed / total * 100) if total > 0 else 0
        
        summary = {
            "total_tests": total,
            "passed": self.passed,
            "failed": self.failed,
            "success_rate": f"{success_rate:.1f}%",
            "details": self.test_results
        }
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {total}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {success_rate:.1f}%")
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            print(result)
        
        return summary

if __name__ == "__main__":
    tester = VPSButtonTest()
    summary = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if summary["failed"] == 0 else 1)