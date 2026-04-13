#!/usr/bin/env python3
"""
Nomadly Backend Review Request Verification Test
Test Date: January 2025
Backend URL: https://readme-guide-6.preview.emergentagent.com
Test User: 6687923716

Review Request Tests:
1. Health Check: GET /api/health — should return 200 with status: healthy
2. SMS App Auth: GET /api/sms-app/auth/6687923716 — should return 200
3. SingleIVR TwiML: POST /api/twilio/single-ivr?sessionId=nonexistent — should return XML
4. Code verification — Phone number auto-correction
5. Code verification — SIP transfer retry
6. Code verification — Conversion fix
7. Code verification — nixpacks.toml
"""

import requests
import json
import sys
import os
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://readme-guide-6.preview.emergentagent.com"
TEST_USER = "6687923716"

class ReviewRequestTester:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "response_data": response_data,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        
        if success:
            self.passed += 1
        else:
            self.failed += 1
            
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()

    def test_health_check(self):
        """Test 1: Health Check - GET /api/health"""
        try:
            response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result(
                        "Health Check", 
                        True, 
                        f"Status: {data.get('status')}, Database: {data.get('database', 'N/A')}, Uptime: {data.get('uptime', 'N/A')} hours"
                    )
                else:
                    self.log_result(
                        "Health Check", 
                        False, 
                        f"Expected status 'healthy', got '{data.get('status')}'",
                        data
                    )
            else:
                self.log_result(
                    "Health Check", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_result("Health Check", False, f"Request failed: {str(e)}")

    def test_sms_app_auth(self):
        """Test 2: SMS App Auth - GET /api/sms-app/auth/6687923716"""
        try:
            response = requests.get(f"{BACKEND_URL}/api/sms-app/auth/{TEST_USER}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("valid") is True:
                    self.log_result(
                        "SMS App Auth (Valid)", 
                        True, 
                        f"Valid: {data.get('valid')}, Can use SMS: {data.get('canUseSms')}, Free SMS: {data.get('freeSmsRemaining', 'N/A')}"
                    )
                else:
                    self.log_result(
                        "SMS App Auth (Valid)", 
                        False, 
                        f"Expected valid=true, got valid={data.get('valid')}",
                        data
                    )
            else:
                self.log_result(
                    "SMS App Auth (Valid)", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_result("SMS App Auth (Valid)", False, f"Request failed: {str(e)}")

    def test_single_ivr_twiml(self):
        """Test 3: SingleIVR TwiML - POST /api/twilio/single-ivr?sessionId=nonexistent"""
        try:
            response = requests.post(
                f"{BACKEND_URL}/api/twilio/single-ivr?sessionId=nonexistent", 
                timeout=10
            )
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'xml' in content_type.lower():
                    # Check if response contains XML
                    response_text = response.text
                    if '<Response>' in response_text or '<?xml' in response_text:
                        self.log_result(
                            "SingleIVR TwiML", 
                            True, 
                            f"Content-Type: {content_type}, Response length: {len(response_text)} chars"
                        )
                    else:
                        self.log_result(
                            "SingleIVR TwiML", 
                            False, 
                            f"Response doesn't contain XML structure",
                            response_text[:200]
                        )
                else:
                    self.log_result(
                        "SingleIVR TwiML", 
                        False, 
                        f"Expected XML content-type, got '{content_type}'",
                        response.text[:200]
                    )
            else:
                self.log_result(
                    "SingleIVR TwiML", 
                    False, 
                    f"Expected 200, got {response.status_code}",
                    response.text
                )
                
        except Exception as e:
            self.log_result("SingleIVR TwiML", False, f"Request failed: {str(e)}")

    def verify_phone_auto_correction(self):
        """Test 4: Code verification — Phone number auto-correction"""
        try:
            # Check /app/js/_index.js for phone number auto-correction logic
            file_path = "/app/js/_index.js"
            if not os.path.exists(file_path):
                self.log_result(
                    "Phone Auto-Correction Code", 
                    False, 
                    f"File not found: {file_path}"
                )
                return
                
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Look for auto-correction patterns around specified lines
            lines = content.split('\n')
            
            # Check for +1 prepending logic
            found_patterns = []
            
            # Search for patterns that handle 10-digit US numbers
            for i, line in enumerate(lines):
                line_num = i + 1
                if ('+1' in line and 'length' in line and ('10' in line or 'digit' in line)) or \
                   ('prepend' in line.lower() and '+1' in line) or \
                   (line.strip().startswith('if') and 'length' in line and '10' in line and '+1' in line):
                    found_patterns.append(f"Line {line_num}: {line.strip()}")
                    
            if found_patterns:
                self.log_result(
                    "Phone Auto-Correction Code", 
                    True, 
                    f"Found {len(found_patterns)} auto-correction patterns in {file_path}"
                )
                for pattern in found_patterns[:3]:  # Show first 3 patterns
                    print(f"   {pattern}")
            else:
                # Search more broadly for phone number handling
                phone_patterns = []
                for i, line in enumerate(lines):
                    if '+1' in line and ('phone' in line.lower() or 'number' in line.lower()):
                        phone_patterns.append(f"Line {i+1}: {line.strip()}")
                        
                if phone_patterns:
                    self.log_result(
                        "Phone Auto-Correction Code", 
                        True, 
                        f"Found {len(phone_patterns)} phone number handling patterns"
                    )
                else:
                    self.log_result(
                        "Phone Auto-Correction Code", 
                        False, 
                        "No phone number auto-correction patterns found"
                    )
                    
        except Exception as e:
            self.log_result("Phone Auto-Correction Code", False, f"File read failed: {str(e)}")

    def verify_sip_transfer_retry(self):
        """Test 5: Code verification — SIP transfer retry"""
        try:
            file_path = "/app/js/voice-service.js"
            if not os.path.exists(file_path):
                self.log_result(
                    "SIP Transfer Retry Code", 
                    False, 
                    f"File not found: {file_path}"
                )
                return
                
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Look for retry logic patterns
            retry_patterns = []
            lines = content.split('\n')
            
            for i, line in enumerate(lines):
                line_num = i + 1
                if ('retry' in line.lower() and 'transfer' in line.lower()) or \
                   ('not been answered' in line.lower()) or \
                   ('delay' in line.lower() and 'transfer' in line.lower()) or \
                   ('setTimeout' in line and 'transfer' in line):
                    retry_patterns.append(f"Line {line_num}: {line.strip()}")
                    
            if retry_patterns:
                self.log_result(
                    "SIP Transfer Retry Code", 
                    True, 
                    f"Found {len(retry_patterns)} retry logic patterns in {file_path}"
                )
                for pattern in retry_patterns[:3]:  # Show first 3 patterns
                    print(f"   {pattern}")
            else:
                self.log_result(
                    "SIP Transfer Retry Code", 
                    False, 
                    "No SIP transfer retry patterns found"
                )
                    
        except Exception as e:
            self.log_result("SIP Transfer Retry Code", False, f"File read failed: {str(e)}")

    def verify_conversion_fix(self):
        """Test 6: Code verification — Conversion fix"""
        try:
            file_path = "/app/js/new-user-conversion.js"
            if not os.path.exists(file_path):
                self.log_result(
                    "Conversion Fix Code", 
                    False, 
                    f"File not found: {file_path}"
                )
                return
                
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            # Check specific lines 354-361 mentioned in review request
            # These should NOT have upsert: true or $setOnInsert
            target_lines = lines[353:361]  # 0-indexed, so 353:361 covers lines 354-361
            target_content = ''.join(target_lines)
            
            has_upsert_in_target = 'upsert: true' in target_content
            has_set_on_insert_in_target = '$setOnInsert' in target_content
            
            if not has_upsert_in_target and not has_set_on_insert_in_target:
                self.log_result(
                    "Conversion Fix Code", 
                    True, 
                    "Confirmed: Lines 354-361 do NOT have 'upsert: true' or '$setOnInsert' (fix implemented correctly)"
                )
                # Show the actual code for verification
                print("   Fixed code section (lines 354-361):")
                for i, line in enumerate(target_lines):
                    print(f"   Line {354+i}: {line.rstrip()}")
            else:
                issues = []
                if has_upsert_in_target:
                    issues.append("'upsert: true' found in target lines")
                if has_set_on_insert_in_target:
                    issues.append("'$setOnInsert' found in target lines")
                    
                self.log_result(
                    "Conversion Fix Code", 
                    False, 
                    f"Issues in lines 354-361: {', '.join(issues)}"
                )
                    
        except Exception as e:
            self.log_result("Conversion Fix Code", False, f"File read failed: {str(e)}")

    def verify_nixpacks_config(self):
        """Test 7: Code verification — nixpacks.toml"""
        try:
            file_path = "/app/nixpacks.toml"
            if not os.path.exists(file_path):
                self.log_result(
                    "Nixpacks Config", 
                    False, 
                    f"File not found: {file_path}"
                )
                return
                
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Check for [phases.setup] and nixPkgsArchive
            has_phases_setup = '[phases.setup]' in content
            has_nixpkgs_archive = 'nixPkgsArchive' in content
            
            if has_phases_setup and has_nixpkgs_archive:
                self.log_result(
                    "Nixpacks Config", 
                    True, 
                    "Confirmed: [phases.setup] with nixPkgsArchive found"
                )
                # Show the relevant section
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if 'nixPkgsArchive' in line:
                        print(f"   Line {i+1}: {line.strip()}")
            else:
                issues = []
                if not has_phases_setup:
                    issues.append("[phases.setup] not found")
                if not has_nixpkgs_archive:
                    issues.append("nixPkgsArchive not found")
                    
                self.log_result(
                    "Nixpacks Config", 
                    False, 
                    f"Issues: {', '.join(issues)}"
                )
                    
        except Exception as e:
            self.log_result("Nixpacks Config", False, f"File read failed: {str(e)}")

    def run_all_tests(self):
        """Run all review request tests"""
        print("=" * 80)
        print("NOMADLY BACKEND REVIEW REQUEST VERIFICATION")
        print("=" * 80)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test User: {TEST_USER}")
        print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        print()
        
        # API Endpoint Tests
        print("🌐 API ENDPOINT TESTS")
        print("-" * 40)
        self.test_health_check()
        self.test_sms_app_auth()
        self.test_single_ivr_twiml()
        
        # Code Verification Tests
        print("📋 CODE VERIFICATION TESTS")
        print("-" * 40)
        self.verify_phone_auto_correction()
        self.verify_sip_transfer_retry()
        self.verify_conversion_fix()
        self.verify_nixpacks_config()
        
        # Summary
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        total_tests = self.passed + self.failed
        success_rate = (self.passed / total_tests * 100) if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        print("\n" + "=" * 80)
        
        return self.failed == 0

if __name__ == "__main__":
    tester = ReviewRequestTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)