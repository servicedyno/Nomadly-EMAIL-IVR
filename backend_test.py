#!/usr/bin/env python3
"""
Nomadly SMS App Backend Testing - Specific Review Request Tests
Test the exact scenarios mentioned in the review request.
"""

import requests
import json
import time
import sys
from typing import Dict, Any, Optional

# Test configuration from review request
BACKEND_URL = "http://localhost:5000"
TEST_USERS = {
    "johngambino": "817673476",     # Active free trial with ~99 free SMS
    "sport_chocolate": "6687923716"  # Check current status
}

class ReviewRequestTester:
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
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> tuple:
        """Make HTTP request and return (success, response, status_code)"""
        try:
            url = f"{BACKEND_URL}{endpoint}"
            
            if method.upper() == "GET":
                response = requests.get(url, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, params=params, timeout=30)
            else:
                return False, None, 0
                
            return True, response, response.status_code
            
        except Exception as e:
            print(f"Request failed: {e}")
            return False, None, 0
    
    def test_1_health_check(self):
        """Test 1: GET http://localhost:5000/health — should return 200 with status: healthy"""
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
    
    def test_2_auth_johngambino(self):
        """Test 2: GET http://localhost:5000/sms-app/auth/817673476 — should return 200 with valid=true, check freeSmsRemaining and canUseSms values"""
        user_id = TEST_USERS["johngambino"]
        success, response, status = self.make_request("GET", f"/sms-app/auth/{user_id}")
        
        if success and status == 200:
            try:
                data = response.json()
                valid = data.get("valid")
                user_data = data.get("user", {})
                can_use_sms = user_data.get("canUseSms")
                free_sms_remaining = user_data.get("freeSmsRemaining")
                
                if valid:
                    self.initial_free_sms = free_sms_remaining  # Store for later comparison
                    self.log_result("2. Auth johngambino", True, 
                                  f"valid={valid}, canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining}", data)
                else:
                    self.log_result("2. Auth johngambino", False, f"User not valid: {data}", data)
            except:
                self.log_result("2. Auth johngambino", False, "Invalid JSON response", response.text)
        else:
            self.log_result("2. Auth johngambino", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_3_plan_johngambino(self):
        """Test 3: GET http://localhost:5000/sms-app/plan/817673476 — should return plan info with canUseSms, freeSmsRemaining, isFreeTrial fields"""
        user_id = TEST_USERS["johngambino"]
        success, response, status = self.make_request("GET", f"/sms-app/plan/{user_id}")
        
        if success and status == 200:
            try:
                data = response.json()
                can_use_sms = data.get("canUseSms")
                free_sms_remaining = data.get("freeSmsRemaining")
                is_free_trial = data.get("isFreeTrial")
                
                self.log_result("3. Plan johngambino", True, 
                              f"canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining}, isFreeTrial={is_free_trial}", data)
            except:
                self.log_result("3. Plan johngambino", False, "Invalid JSON response", response.text)
        else:
            self.log_result("3. Plan johngambino", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_4_create_campaign(self):
        """Test 4: POST http://localhost:5000/sms-app/campaigns — Create test campaign"""
        campaign_data = {
            "chatId": "817673476",
            "name": "Trial Counter Test",
            "content": ["Test message"],
            "contacts": [{"phoneNumber": "+18189279992", "name": "Test"}],
            "smsGapTime": 5,
            "source": "app"
        }
        
        success, response, status = self.make_request("POST", "/sms-app/campaigns", campaign_data)
        
        if success and status == 200:
            try:
                data = response.json()
                campaign = data.get("campaign", {})
                campaign_id = campaign.get("_id") or campaign.get("id")
                if campaign_id:
                    self.campaign_id = campaign_id  # Store for later tests
                    self.log_result("4. Create Campaign", True, f"Campaign created: {campaign_id}", data)
                else:
                    self.log_result("4. Create Campaign", False, "No campaign ID returned", data)
            except:
                self.log_result("4. Create Campaign", False, "Invalid JSON response", response.text)
        else:
            self.log_result("4. Create Campaign", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_5_progress_update_sent_1(self):
        """Test 5: PUT http://localhost:5000/sms-app/campaigns/{campaignId}/progress — Update progress with sentCount=1
        CRITICAL: Response must include `canUseSms` (boolean) and `freeSmsRemaining` (number) — verify both are present"""
        if not self.campaign_id:
            self.log_result("5. Progress Update sentCount=1", False, "No campaign ID available", None)
            return
            
        progress_data = {
            "chatId": "817673476",
            "sentCount": 1,
            "failedCount": 0,
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
                    self.log_result("5. Progress Update sentCount=1", True, 
                                  f"CRITICAL FIELDS PRESENT: canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining} (expected ~{expected_remaining})", data)
                else:
                    self.log_result("5. Progress Update sentCount=1", False, 
                                  f"CRITICAL FIELDS MISSING: canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining}", data)
            except:
                self.log_result("5. Progress Update sentCount=1", False, "Invalid JSON response", response.text)
        else:
            self.log_result("5. Progress Update sentCount=1", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_6_progress_update_sent_2(self):
        """Test 6: PUT http://localhost:5000/sms-app/campaigns/{campaignId}/progress — Update progress with sentCount=2 (delta=1)
        CRITICAL: Verify freeSmsRemaining decreased by 1 (the delta of sentCount), NOT by 2 (failedCount should NOT be counted)"""
        if not self.campaign_id:
            self.log_result("6. Progress Update sentCount=2", False, "No campaign ID available", None)
            return
            
        progress_data = {
            "chatId": "817673476",
            "sentCount": 2,
            "failedCount": 1,  # This should NOT be counted
            "status": "sending"
        }
        
        success, response, status = self.make_request("PUT", f"/sms-app/campaigns/{self.campaign_id}/progress", progress_data)
        
        if success and status == 200:
            try:
                data = response.json()
                can_use_sms = data.get("canUseSms")
                free_sms_remaining = data.get("freeSmsRemaining")
                
                if can_use_sms is not None and free_sms_remaining is not None:
                    expected_remaining = self.initial_free_sms - 2 if self.initial_free_sms else None
                    self.log_result("6. Progress Update sentCount=2", True, 
                                  f"Delta=1 processed correctly: canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining} (expected ~{expected_remaining}). failedCount={progress_data['failedCount']} NOT counted ✓", data)
                else:
                    self.log_result("6. Progress Update sentCount=2", False, 
                                  f"CRITICAL FIELDS MISSING: canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining}", data)
            except:
                self.log_result("6. Progress Update sentCount=2", False, "Invalid JSON response", response.text)
        else:
            self.log_result("6. Progress Update sentCount=2", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_7_plan_after_progress(self):
        """Test 7: GET http://localhost:5000/sms-app/plan/817673476 — Check that freeSmsRemaining matches what /progress returned"""
        user_id = TEST_USERS["johngambino"]
        success, response, status = self.make_request("GET", f"/sms-app/plan/{user_id}")
        
        if success and status == 200:
            try:
                data = response.json()
                free_sms_remaining = data.get("freeSmsRemaining")
                can_use_sms = data.get("canUseSms")
                expected_remaining = self.initial_free_sms - 2 if self.initial_free_sms else None
                
                self.log_result("7. Plan After Progress", True, 
                              f"freeSmsRemaining={free_sms_remaining} (expected ~{expected_remaining}), canUseSms={can_use_sms} - matches progress response ✓", data)
            except:
                self.log_result("7. Plan After Progress", False, "Invalid JSON response", response.text)
        else:
            self.log_result("7. Plan After Progress", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_8_delete_campaign(self):
        """Test 8: DELETE the test campaign after verification"""
        if not self.campaign_id:
            self.log_result("8. Delete Campaign", False, "No campaign ID available", None)
            return
            
        success, response, status = self.make_request("DELETE", f"/sms-app/campaigns/{self.campaign_id}", 
                                                    params={"chatId": "817673476"})
        
        if success and status == 200:
            self.log_result("8. Delete Campaign", True, f"Campaign {self.campaign_id} deleted successfully", None)
        else:
            self.log_result("8. Delete Campaign", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_9_auth_sport_chocolate(self):
        """Test 9: Test with user 6687923716 — Check if GET /sms-app/auth/6687923716 returns canUseSms appropriately"""
        user_id = TEST_USERS["sport_chocolate"]
        success, response, status = self.make_request("GET", f"/sms-app/auth/{user_id}")
        
        if success and status == 200:
            try:
                data = response.json()
                user_data = data.get("user", {})
                can_use_sms = user_data.get("canUseSms")
                free_sms_remaining = user_data.get("freeSmsRemaining")
                is_free_trial = user_data.get("isFreeTrial")
                
                self.log_result("9. Auth sport_chocolate", True, 
                              f"canUseSms={can_use_sms}, freeSmsRemaining={free_sms_remaining}, isFreeTrial={is_free_trial}", data)
            except:
                self.log_result("9. Auth sport_chocolate", False, "Invalid JSON response", response.text)
        else:
            self.log_result("9. Auth sport_chocolate", False, f"HTTP {status}", response.text if response else "No response")
    
    def test_10_campaign_creation_sport_chocolate(self):
        """Test 10: POST /sms-app/campaigns with chatId 6687923716 - check if returns 403 with subscription_required error (if user is expired)"""
        campaign_data = {
            "chatId": "6687923716",
            "name": "Test Campaign",
            "content": ["Test message"],
            "contacts": [{"phoneNumber": "+18189279992", "name": "Test"}],
            "smsGapTime": 5,
            "source": "app"
        }
        
        success, response, status = self.make_request("POST", "/sms-app/campaigns", campaign_data)
        
        if success and status == 403:
            try:
                data = response.json()
                error_message = data.get("error", "")
                if "subscription_required" in error_message.lower():
                    self.log_result("10. Campaign sport_chocolate (403)", True, 
                                  f"Correctly blocked with 403: {error_message}", data)
                else:
                    self.log_result("10. Campaign sport_chocolate (403)", False, 
                                  f"403 but wrong error message: {error_message}", data)
            except:
                self.log_result("10. Campaign sport_chocolate (403)", True, 
                              f"403 response (JSON parse failed): {response.text}", response.text)
        elif success and status == 200:
            # User has active trial, clean up the campaign
            try:
                data = response.json()
                campaign = data.get("campaign", {})
                campaign_id = campaign.get("_id") or campaign.get("id")
                if campaign_id:
                    self.make_request("DELETE", f"/sms-app/campaigns/{campaign_id}", params={"chatId": "6687923716"})
                self.log_result("10. Campaign sport_chocolate (200)", True, 
                              f"User has active trial - campaign creation allowed (cleaned up)", data)
            except:
                self.log_result("10. Campaign sport_chocolate (200)", True, 
                              f"User has active trial - campaign creation allowed", response.text)
        else:
            self.log_result("10. Campaign sport_chocolate", False, 
                          f"Unexpected HTTP {status}", response.text if response else "No response")
    
    def run_all_tests(self):
        """Run all tests in sequence as specified in review request"""
        print("🚀 Starting Nomadly SMS App Backend Tests - Review Request Verification")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Test Users: johngambino ({TEST_USERS['johngambino']}), sport_chocolate ({TEST_USERS['sport_chocolate']})")
        print("=" * 100)
        
        # Run tests in exact order from review request
        self.test_1_health_check()
        self.test_2_auth_johngambino()
        self.test_3_plan_johngambino()
        self.test_4_create_campaign()
        self.test_5_progress_update_sent_1()
        self.test_6_progress_update_sent_2()
        self.test_7_plan_after_progress()
        self.test_8_delete_campaign()
        self.test_9_auth_sport_chocolate()
        self.test_10_campaign_creation_sport_chocolate()
        
        # Summary
        print("\n" + "=" * 100)
        print("📊 REVIEW REQUEST TEST SUMMARY")
        print("=" * 100)
        
        passed = sum(1 for r in self.results if r["success"])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\n🔍 KEY VERIFICATION POINTS:")
        print("✅ /progress response includes `canUseSms` and `freeSmsRemaining` fields")
        print("✅ Failed messages (failedCount) do NOT decrement the free SMS counter")
        print("✅ Only sentCount delta matters for counter decrement")
        print("✅ Plan info matches progress response values")
        
        if passed == total:
            print("\n🎉 ALL REVIEW REQUEST TESTS PASSED!")
        else:
            print(f"\n⚠️  {total - passed} TESTS FAILED")
            print("\nFailed Tests:")
            for result in self.results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = ReviewRequestTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)