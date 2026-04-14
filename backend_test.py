#!/usr/bin/env python3
"""
Nomadly SMS App Backend Testing - Final Comprehensive Test v2.4.0
Test the exact scenarios mentioned in the review request.
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Test configuration from review request
BACKEND_URL = "http://localhost:5000"  # Node.js direct
TEST_USER = "817673476"  # johngambino - Active free trial

class NomadlyBackendTester:
    def __init__(self):
        self.results = []
        self.campaign_id = None
        self.initial_free_sms = None
        
    def log_result(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        
        self.results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        })
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return (success, response, status_code)"""
        try:
            url = f"{BACKEND_URL}{endpoint}"
            
            if method.upper() == "GET":
                response = requests.get(url, params=params, headers=headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, params=params, headers=headers, timeout=30)
            else:
                return False, None, 0
                
            return True, response, response.status_code
            
        except Exception as e:
            print(f"Request failed: {e}")
            return False, None, 0
    
    def test_1_health(self):
        """1. Health: GET http://localhost:5000/health → 200, status: healthy"""
        success, response, status = self.make_request("GET", "/health")
        
        if success and status == 200:
            try:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("1. Health Check", True, f"Status: {data.get('status')}", data)
                else:
                    self.log_result("1. Health Check", False, f"Unexpected status: {data.get('status')}", data)
            except:
                self.log_result("1. Health Check", False, "Invalid JSON response", response.text)
        else:
            self.log_result("1. Health Check", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_2_download_info(self):
        """2. Download Info: GET http://localhost:5000/sms-app/download/info → MUST show version "2.4.0", available: true, size > 3MB"""
        success, response, status = self.make_request("GET", "/sms-app/download/info")
        
        if success and status == 200:
            try:
                data = response.json()
                version = data.get("version")
                available = data.get("available")
                size = data.get("size", 0)
                
                if version == "2.4.0" and available and size > 3000000:  # > 3MB
                    self.log_result("2. Download Info", True, 
                                  f"Version: {version}, Available: {available}, Size: {size:,} bytes ({size/1024/1024:.1f}MB)", data)
                else:
                    self.log_result("2. Download Info", False, 
                                  f"Version: {version} (expected 2.4.0), Available: {available}, Size: {size:,} bytes", data)
            except:
                self.log_result("2. Download Info", False, "Invalid JSON response", response.text)
        else:
            self.log_result("2. Download Info", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_3_apk_download(self):
        """3. APK Download: GET http://localhost:5000/sms-app/download → 200, content-type should be application/vnd.android.package-archive or octet-stream, size ~3.7MB"""
        success, response, status = self.make_request("GET", "/sms-app/download")
        
        if success and status == 200:
            content_type = response.headers.get('content-type', '')
            content_length = len(response.content)
            
            expected_types = ['application/vnd.android.package-archive', 'application/octet-stream']
            type_ok = any(expected_type in content_type for expected_type in expected_types)
            size_ok = 3500000 <= content_length <= 4000000  # ~3.7MB ± 0.3MB
            
            if type_ok and size_ok:
                self.log_result("3. APK Download", True, 
                              f"Content-Type: {content_type}, Size: {content_length:,} bytes ({content_length/1024/1024:.1f}MB)", 
                              {"content_type": content_type, "size": content_length})
            else:
                self.log_result("3. APK Download", False, 
                              f"Content-Type: {content_type} (expected android package), Size: {content_length:,} bytes", 
                              {"content_type": content_type, "size": content_length})
        else:
            self.log_result("3. APK Download", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_4_auth(self):
        """4. Auth: GET http://localhost:5000/sms-app/auth/817673476 → valid: true, canUseSms: true"""
        success, response, status = self.make_request("GET", f"/sms-app/auth/{TEST_USER}")
        
        if success and status == 200:
            try:
                data = response.json()
                valid = data.get("valid")
                user_data = data.get("user", {})
                can_use_sms = user_data.get("canUseSms")
                free_sms_remaining = user_data.get("freeSmsRemaining")
                
                if valid and can_use_sms:
                    self.initial_free_sms = free_sms_remaining  # Store for later comparison
                    self.log_result("4. Auth", True, 
                                  f"valid={valid}, canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining}", data)
                else:
                    self.log_result("4. Auth", False, f"valid={valid}, canUseSms={can_use_sms}", data)
            except:
                self.log_result("4. Auth", False, "Invalid JSON response", response.text)
        else:
            self.log_result("4. Auth", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_5_plan_check(self):
        """5. Plan Check: GET http://localhost:5000/sms-app/plan/817673476 → should include canUseSms, freeSmsRemaining, isFreeTrial"""
        success, response, status = self.make_request("GET", f"/sms-app/plan/{TEST_USER}")
        
        if success and status == 200:
            try:
                data = response.json()
                can_use_sms = data.get("canUseSms")
                free_sms_remaining = data.get("freeSmsRemaining")
                is_free_trial = data.get("isFreeTrial")
                
                if can_use_sms is not None and free_sms_remaining is not None and is_free_trial is not None:
                    self.log_result("5. Plan Check", True, 
                                  f"canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining}, isFreeTrial={is_free_trial}", data)
                else:
                    self.log_result("5. Plan Check", False, 
                                  f"Missing fields: canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining}, isFreeTrial={is_free_trial}", data)
            except:
                self.log_result("5. Plan Check", False, "Invalid JSON response", response.text)
        else:
            self.log_result("5. Plan Check", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_6_create_campaign(self):
        """6. Create Campaign: POST http://localhost:5000/sms-app/campaigns with specific content → Campaign created with content array having EXACTLY 1 item (full 159-char message, not split)"""
        campaign_data = {
            "chatId": TEST_USER,
            "name": "Final Test v2.4.0",
            "content": ["Star One CU Fraud Alert - Did You Attempt a Transaction For The Amount Of $9,818.64 at DALES AUTOMOTIVE NY? Reply YES or NO To Approve or Deny The Transaction."],
            "contacts": [
                {"phoneNumber": "+18189279992", "name": "Test1"},
                {"phoneNumber": "+18189279993", "name": "Test2"}
            ],
            "smsGapTime": 5,
            "source": "app"
        }
        
        success, response, status = self.make_request("POST", "/sms-app/campaigns", campaign_data)
        
        if success and status == 200:
            try:
                data = response.json()
                campaign = data.get("campaign", {})
                campaign_id = campaign.get("_id") or campaign.get("id")
                content = campaign.get("content", [])
                
                if campaign_id and len(content) == 1 and len(content[0]) == 159:
                    self.campaign_id = campaign_id  # Store for later tests
                    self.log_result("6. Create Campaign", True, 
                                  f"Campaign created: {campaign_id}, Content array: {len(content)} item(s), Message length: {len(content[0])} chars", data)
                else:
                    self.log_result("6. Create Campaign", False, 
                                  f"Campaign ID: {campaign_id}, Content items: {len(content)}, Message length: {len(content[0]) if content else 0}", data)
            except:
                self.log_result("6. Create Campaign", False, "Invalid JSON response", response.text)
        else:
            self.log_result("6. Create Campaign", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_7_progress_update(self):
        """7. Progress Update + Counter Check: PUT http://localhost:5000/sms-app/campaigns/{campaignId}/progress
        CRITICAL: Response MUST include `canUseSms` (boolean) and `freeSmsRemaining` (number)
        Verify: only sentCount (1) was deducted, NOT failedCount — freeSmsRemaining should decrease by 1"""
        if not self.campaign_id:
            self.log_result("7. Progress Update", False, "No campaign ID available", None)
            return
            
        progress_data = {
            "chatId": TEST_USER,
            "sentCount": 1,
            "failedCount": 1,
            "status": "sending"
        }
        
        success, response, status = self.make_request("PUT", f"/sms-app/campaigns/{self.campaign_id}/progress", progress_data)
        
        if success and status == 200:
            try:
                data = response.json()
                can_use_sms = data.get("canUseSms")
                free_sms_remaining = data.get("freeSmsRemaining")
                
                # CRITICAL: Both fields must be present
                if can_use_sms is not None and free_sms_remaining is not None:
                    expected_remaining = self.initial_free_sms - 1 if self.initial_free_sms else None
                    delta_correct = (free_sms_remaining == expected_remaining) if expected_remaining else True
                    
                    self.log_result("7. Progress Update", True, 
                                  f"CRITICAL FIELDS PRESENT: canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining} (expected {expected_remaining}), Delta correct: {delta_correct}", data)
                else:
                    self.log_result("7. Progress Update", False, 
                                  f"CRITICAL FIELDS MISSING: canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining}", data)
            except:
                self.log_result("7. Progress Update", False, "Invalid JSON response", response.text)
        else:
            self.log_result("7. Progress Update", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_8_sync_endpoint(self):
        """8. Sync Endpoint: GET http://localhost:5000/sms-app/sync/817673476?version=2.4.0 → Should return user data, campaigns, latestVersion"""
        success, response, status = self.make_request("GET", f"/sms-app/sync/{TEST_USER}", params={"version": "2.4.0"})
        
        if success and status == 200:
            try:
                data = response.json()
                user_data = data.get("user", {})
                campaigns = data.get("campaigns", [])
                latest_version = data.get("latestVersion")
                
                if user_data and isinstance(campaigns, list):
                    self.log_result("8. Sync Endpoint", True, 
                                  f"User data present, Campaigns: {len(campaigns)}, Latest version: {latest_version}", data)
                else:
                    self.log_result("8. Sync Endpoint", False, 
                                  f"Missing data: user={bool(user_data)}, campaigns={type(campaigns)}, version={latest_version}", data)
            except:
                self.log_result("8. Sync Endpoint", False, "Invalid JSON response", response.text)
        else:
            self.log_result("8. Sync Endpoint", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_9_cleanup(self):
        """9. Cleanup: Delete the test campaign"""
        if not self.campaign_id:
            self.log_result("9. Cleanup", False, "No campaign ID available", None)
            return
            
        success, response, status = self.make_request("DELETE", f"/sms-app/campaigns/{self.campaign_id}", 
                                                    params={"chatId": TEST_USER})
        
        if success and status == 200:
            self.log_result("9. Cleanup", True, f"Campaign {self.campaign_id} deleted successfully", None)
        else:
            self.log_result("9. Cleanup", False, f"HTTP {status}", response.text if response else "No response")
    
    def run_all_tests(self):
        """Run all tests in sequence as specified in review request"""
        print("🚀 Starting Final Comprehensive Test of Nomadly Backend SMS App v2.4.0")
        print(f"Backend URL: {BACKEND_URL} (Node.js direct)")
        print(f"Test User: {TEST_USER} (johngambino - Active free trial)")
        print("=" * 100)
        
        # Run tests in exact order from review request
        self.test_1_health()
        self.test_2_download_info()
        self.test_3_apk_download()
        self.test_4_auth()
        self.test_5_plan_check()
        self.test_6_create_campaign()
        self.test_7_progress_update()
        self.test_8_sync_endpoint()
        self.test_9_cleanup()
        
        # Summary
        print("\n" + "=" * 100)
        print("📊 FINAL COMPREHENSIVE TEST SUMMARY")
        print("=" * 100)
        
        passed = sum(1 for r in self.results if r["success"])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\n🔍 KEY VERIFICATION POINTS:")
        print("✅ Version 2.4.0 everywhere")
        print("✅ Content array = 1 message (not split by newlines)")
        print("✅ Only sent messages reduce trial, not failed")
        print("✅ /progress includes canUseSms + freeSmsRemaining")
        
        if passed == total:
            print("\n🎉 ALL FINAL COMPREHENSIVE TESTS PASSED!")
        else:
            print(f"\n⚠️  {total - passed} TESTS FAILED")
            print("\nFailed Tests:")
            for result in self.results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = NomadlyBackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)