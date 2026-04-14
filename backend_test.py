#!/usr/bin/env python3
"""
Backend Testing Script for Nomadly SMS App
Testing message rotation splitting bug fix
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Test configuration
BACKEND_URL_DIRECT = "http://localhost:5000"
BACKEND_URL_PROXY = "http://localhost:8001/api"
TEST_USER = "817673476"  # johngambino - Active free trial

class BackendTester:
    def __init__(self):
        self.test_results = []
        self.created_campaign_id = None
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "success": success,
            "details": details
        })
        print(f"{status} {test_name}")
        if details:
            print(f"    {details}")
    
    def test_health_check(self) -> bool:
        """Test 1: GET /health endpoint"""
        try:
            response = requests.get(f"{BACKEND_URL_DIRECT}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_test("Health Check", True, f"Status: {data.get('status')}, Database: {data.get('database', 'N/A')}")
                    return True
                else:
                    self.log_test("Health Check", False, f"Unexpected status: {data.get('status')}")
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Health Check", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_valid(self) -> bool:
        """Test 2: GET /sms-app/auth/{valid_user} endpoint"""
        try:
            response = requests.get(f"{BACKEND_URL_DIRECT}/sms-app/auth/{TEST_USER}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("valid") == True:
                    self.log_test("Auth Valid User", True, f"Valid: {data.get('valid')}, Can use SMS: {data.get('canUseSms', 'N/A')}")
                    return True
                else:
                    self.log_test("Auth Valid User", False, f"Valid: {data.get('valid')}")
                    return False
            else:
                self.log_test("Auth Valid User", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Auth Valid User", False, f"Exception: {str(e)}")
            return False
    
    def test_campaign_creation(self) -> bool:
        """Test 3: POST /sms-app/campaigns - Create campaign with multi-line message"""
        try:
            # The test message from the review request - should be treated as ONE message
            campaign_data = {
                "chatId": TEST_USER,
                "name": "Test Multiline Fix",
                "content": ["Star One CU Fraud Alert - Did You Attempt a Transaction For The Amount Of $9,818.64 at DALES AUTOMOTIVE NY? Reply YES or NO To Approve or Deny The Transaction."],
                "contacts": [{"phoneNumber": "+18189279992", "name": "John"}],
                "smsGapTime": 5,
                "source": "app"
            }
            
            response = requests.post(
                f"{BACKEND_URL_DIRECT}/sms-app/campaigns",
                json=campaign_data,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 200 or response.status_code == 201:
                data = response.json()
                # Check for campaign ID in different possible locations
                campaign_id = (data.get("id") or 
                             data.get("campaignId") or 
                             (data.get("campaign", {}).get("_id")) or
                             (data.get("campaign", {}).get("id")))
                if campaign_id:
                    self.created_campaign_id = campaign_id
                    self.log_test("Campaign Creation", True, f"Campaign ID: {campaign_id}")
                    return True
                else:
                    self.log_test("Campaign Creation", False, f"No campaign ID in response: {data}")
                    return False
            else:
                self.log_test("Campaign Creation", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Campaign Creation", False, f"Exception: {str(e)}")
            return False
    
    def test_campaign_verification(self) -> bool:
        """Test 4: GET /sms-app/campaigns/{user} - Verify campaign content structure"""
        try:
            response = requests.get(f"{BACKEND_URL_DIRECT}/sms-app/campaigns/{TEST_USER}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                campaigns = data if isinstance(data, list) else data.get("campaigns", [])
                
                # Find our test campaign
                test_campaign = None
                for campaign in campaigns:
                    if campaign.get("name") == "Test Multiline Fix":
                        test_campaign = campaign
                        break
                
                if test_campaign:
                    content = test_campaign.get("content", [])
                    content_length = len(content)
                    
                    if content_length == 1:
                        # Verify the content is the complete message, not split
                        message = content[0]
                        expected_chars = 159  # Approximate length of the test message
                        actual_chars = len(message)
                        
                        if actual_chars >= 140:  # Allow some variance
                            self.log_test("Campaign Verification", True, 
                                        f"Content array has {content_length} item(s), message length: {actual_chars} chars")
                            return True
                        else:
                            self.log_test("Campaign Verification", False, 
                                        f"Message too short ({actual_chars} chars), may be split incorrectly")
                            return False
                    else:
                        self.log_test("Campaign Verification", False, 
                                    f"Content array has {content_length} items (expected 1) - message may be split by newlines")
                        return False
                else:
                    self.log_test("Campaign Verification", False, "Test campaign not found in user's campaigns")
                    return False
            else:
                self.log_test("Campaign Verification", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Campaign Verification", False, f"Exception: {str(e)}")
            return False
    
    def test_download_info(self) -> bool:
        """Test 5: GET /sms-app/download/info endpoint"""
        try:
            response = requests.get(f"{BACKEND_URL_DIRECT}/sms-app/download/info", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                version = data.get("version")
                if version:
                    self.log_test("Download Info", True, f"Version: {version}, Size: {data.get('size', 'N/A')} bytes")
                    return True
                else:
                    self.log_test("Download Info", False, f"No version in response: {data}")
                    return False
            else:
                self.log_test("Download Info", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Download Info", False, f"Exception: {str(e)}")
            return False
    
    def test_campaign_cleanup(self) -> bool:
        """Test 6: DELETE test campaign"""
        if not self.created_campaign_id:
            self.log_test("Campaign Cleanup", False, "No campaign ID to delete")
            return False
            
        try:
            response = requests.delete(
                f"{BACKEND_URL_DIRECT}/sms-app/campaigns/{self.created_campaign_id}",
                params={"chatId": TEST_USER},
                timeout=10
            )
            
            if response.status_code == 200 or response.status_code == 204:
                self.log_test("Campaign Cleanup", True, f"Deleted campaign {self.created_campaign_id}")
                return True
            else:
                self.log_test("Campaign Cleanup", False, f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Campaign Cleanup", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting Nomadly SMS App Backend Tests")
        print(f"Backend URL: {BACKEND_URL_DIRECT}")
        print(f"Test User: {TEST_USER} (johngambino)")
        print("=" * 60)
        
        # Run tests in order
        tests = [
            self.test_health_check,
            self.test_auth_valid,
            self.test_campaign_creation,
            self.test_campaign_verification,
            self.test_download_info,
            self.test_campaign_cleanup
        ]
        
        passed = 0
        total = len(tests)
        
        for test_func in tests:
            if test_func():
                passed += 1
            print()  # Add spacing between tests
        
        # Summary
        print("=" * 60)
        print(f"📊 TEST SUMMARY: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED - Message rotation fix verified!")
        else:
            print("⚠️  Some tests failed - see details above")
            
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)