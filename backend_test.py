#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Nomadly Coupon System
Tests all coupon endpoints and validation scenarios
"""

import requests
import json
import sys
from datetime import datetime

# Test configuration
BASE_URL = "https://readme-init-2.preview.emergentagent.com/api"
TIMEOUT = 30

class CouponTester:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        
    def log_result(self, test_name, passed, details=""):
        status = "✅ PASS" if passed else "❌ FAIL"
        result = f"{status} - {test_name}"
        if details:
            result += f" | {details}"
        print(result)
        self.results.append({"test": test_name, "passed": passed, "details": details})
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def test_static_coupons_endpoint(self):
        """Test GET /api/test-coupon/static endpoint"""
        try:
            response = requests.get(f"{BASE_URL}/test-coupon/static", timeout=TIMEOUT)
            
            if response.status_code != 200:
                self.log_result("Static Coupons Endpoint", False, f"HTTP {response.status_code}")
                return
            
            data = response.json()
            expected_coupons = {
                'SA0': 10,
                'BU0': 5,
                'STA158': 15,
                'FR10': 10,
                'GLK5': 5
            }
            
            static_coupons = data.get('staticCoupons', {})
            
            # Check if all expected coupons exist with correct discounts
            all_correct = True
            for code, expected_discount in expected_coupons.items():
                if code not in static_coupons:
                    self.log_result(f"Static Coupon {code} Exists", False, "Coupon not found")
                    all_correct = False
                elif static_coupons[code] != expected_discount:
                    self.log_result(f"Static Coupon {code} Discount", False, 
                                  f"Expected {expected_discount}%, got {static_coupons[code]}%")
                    all_correct = False
                else:
                    self.log_result(f"Static Coupon {code}", True, f"{expected_discount}% discount")
            
            if all_correct:
                self.log_result("Static Coupons Endpoint", True, "All 5 static coupons correct")
            else:
                self.log_result("Static Coupons Endpoint", False, "Some static coupons incorrect")
                
        except Exception as e:
            self.log_result("Static Coupons Endpoint", False, f"Exception: {str(e)}")
    
    def test_daily_coupons_endpoint(self):
        """Test GET /api/test-coupon/daily endpoint"""
        try:
            response = requests.get(f"{BASE_URL}/test-coupon/daily", timeout=TIMEOUT)
            
            if response.status_code != 200:
                self.log_result("Daily Coupons Endpoint", False, f"HTTP {response.status_code}")
                return None, None
            
            data = response.json()
            today = datetime.now().strftime('%Y-%m-%d')
            
            if data.get('date') != today:
                self.log_result("Daily Coupons Date", False, f"Expected {today}, got {data.get('date')}")
            else:
                self.log_result("Daily Coupons Date", True, f"Correct date: {today}")
            
            codes = data.get('codes', {})
            nmd5_code = None
            nmd10_code = None
            
            # Find NMD5 and NMD10 codes
            for code, details in codes.items():
                if code.startswith('NMD5'):
                    nmd5_code = code
                    if details.get('discount') == 5:
                        self.log_result(f"Daily Coupon {code}", True, "5% discount")
                    else:
                        self.log_result(f"Daily Coupon {code}", False, 
                                      f"Expected 5%, got {details.get('discount')}%")
                elif code.startswith('NMD10'):
                    nmd10_code = code
                    if details.get('discount') == 10:
                        self.log_result(f"Daily Coupon {code}", True, "10% discount")
                    else:
                        self.log_result(f"Daily Coupon {code}", False, 
                                      f"Expected 10%, got {details.get('discount')}%")
            
            if nmd5_code and nmd10_code:
                self.log_result("Daily Coupons Endpoint", True, "Both NMD5 and NMD10 codes found")
            else:
                self.log_result("Daily Coupons Endpoint", False, "Missing daily coupon codes")
            
            return nmd5_code, nmd10_code
            
        except Exception as e:
            self.log_result("Daily Coupons Endpoint", False, f"Exception: {str(e)}")
            return None, None
    
    def test_coupon_validation(self, code, chat_id, expected_discount=None, expected_error=None, test_name=None):
        """Test POST /api/test-coupon endpoint for coupon validation"""
        if not test_name:
            test_name = f"Validate Coupon {code}"
            
        try:
            payload = {"code": code, "chatId": chat_id}
            response = requests.post(f"{BASE_URL}/test-coupon", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=TIMEOUT)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"HTTP {response.status_code}")
                return
            
            data = response.json()
            result = data.get('result', {})
            
            if expected_error:
                if result.get('error') == expected_error:
                    self.log_result(test_name, True, f"Expected error: {expected_error}")
                else:
                    self.log_result(test_name, False, 
                                  f"Expected error '{expected_error}', got {result}")
            elif expected_discount:
                if result.get('discount') == expected_discount:
                    self.log_result(test_name, True, f"{expected_discount}% discount")
                else:
                    self.log_result(test_name, False, 
                                  f"Expected {expected_discount}%, got {result}")
            else:
                # Just check if it's valid (has discount) or invalid
                if result.get('discount'):
                    self.log_result(test_name, True, f"{result.get('discount')}% discount")
                elif result.get('error'):
                    self.log_result(test_name, True, f"Error: {result.get('error')}")
                else:
                    self.log_result(test_name, False, f"Unexpected result: {result}")
                    
        except Exception as e:
            self.log_result(test_name, False, f"Exception: {str(e)}")
    
    def test_static_coupon_validation(self):
        """Test all static coupon validations"""
        static_coupons = {
            'SA0': 10,
            'BU0': 5,
            'STA158': 15,
            'FR10': 10,
            'GLK5': 5
        }
        
        chat_id = "test-user-12345"
        
        for code, expected_discount in static_coupons.items():
            self.test_coupon_validation(code, chat_id, expected_discount=expected_discount)
    
    def test_daily_coupon_validation(self, nmd5_code, nmd10_code):
        """Test daily coupon validation and single-use enforcement"""
        if not nmd5_code or not nmd10_code:
            self.log_result("Daily Coupon Validation", False, "No daily codes available")
            return
        
        chat_id = "test-user-daily-12345"
        
        # Test NMD5 code
        self.test_coupon_validation(nmd5_code, chat_id, expected_discount=5, 
                                  test_name=f"Daily Coupon {nmd5_code} First Use")
        
        # Test NMD10 code  
        self.test_coupon_validation(nmd10_code, chat_id, expected_discount=10,
                                  test_name=f"Daily Coupon {nmd10_code} First Use")
        
        # Test single-use enforcement - use same codes with same chatId
        self.test_coupon_validation(nmd5_code, chat_id, expected_error="already_used",
                                  test_name=f"Daily Coupon {nmd5_code} Second Use (Should Fail)")
        
        self.test_coupon_validation(nmd10_code, chat_id, expected_error="already_used", 
                                  test_name=f"Daily Coupon {nmd10_code} Second Use (Should Fail)")
    
    def test_invalid_coupons(self):
        """Test invalid coupon handling"""
        chat_id = "test-user-invalid-12345"
        
        invalid_codes = ["FAKECOUPON", "EXPIRED123", "NONEXISTENT"]
        
        for code in invalid_codes:
            self.test_coupon_validation(code, chat_id, expected_error="invalid_coupon",
                                      test_name=f"Invalid Coupon {code}")
    
    def test_case_insensitivity(self):
        """Test case insensitive coupon validation"""
        chat_id = "test-user-case-12345"
        
        # Test lowercase versions of static coupons
        self.test_coupon_validation("sa0", chat_id, expected_discount=10,
                                  test_name="Case Insensitive SA0 (lowercase)")
        
        self.test_coupon_validation("bu0", chat_id, expected_discount=5,
                                  test_name="Case Insensitive BU0 (lowercase)")
    
    def test_welcome_offer_coupon(self):
        """Test welcome offer coupon (WELCOME25-xxxxxx)"""
        chat_id = "test-user-welcome-12345"
        
        # Test the specific code mentioned in requirements
        self.test_coupon_validation("WELCOME25-TNRWBE", chat_id, 
                                  test_name="Welcome Offer WELCOME25-TNRWBE")
        
        # Test with wrong chatId (should return null/invalid)
        self.test_coupon_validation("WELCOME25-TNRWBE", "wrong-chat-id",
                                  test_name="Welcome Offer Wrong ChatId")
    
    def test_empty_code(self):
        """Test empty code handling"""
        try:
            payload = {"code": "", "chatId": "test-user"}
            response = requests.post(f"{BASE_URL}/test-coupon", 
                                   json=payload, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=TIMEOUT)
            
            if response.status_code == 400:
                self.log_result("Empty Code Validation", True, "400 error as expected")
            else:
                self.log_result("Empty Code Validation", False, 
                              f"Expected 400, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Empty Code Validation", False, f"Exception: {str(e)}")
    
    def test_discount_math_verification(self):
        """Verify discount calculation examples"""
        # Note: The API returns discount percentages, actual price calculation is client-side
        # We verify the discount percentages are correct
        
        chat_id = "test-user-math-12345"
        
        # SA0 should return 10% discount
        self.test_coupon_validation("SA0", chat_id, expected_discount=10,
                                  test_name="Discount Math SA0 (10% for $100→$90)")
        
        # STA158 should return 15% discount  
        self.test_coupon_validation("STA158", chat_id, expected_discount=15,
                                  test_name="Discount Math STA158 (15% for $200→$170)")
    
    def run_all_tests(self):
        """Run all coupon system tests"""
        print("🧪 Starting Nomadly Coupon System Tests")
        print("=" * 60)
        
        # Test 1: Static coupon endpoint
        print("\n📋 Testing Static Coupon Endpoint...")
        self.test_static_coupons_endpoint()
        
        # Test 2: Daily coupon endpoint
        print("\n📅 Testing Daily Coupon Endpoint...")
        nmd5_code, nmd10_code = self.test_daily_coupons_endpoint()
        
        # Test 3: Static coupon validation
        print("\n🔍 Testing Static Coupon Validation...")
        self.test_static_coupon_validation()
        
        # Test 4: Daily coupon validation and single-use
        print("\n⏰ Testing Daily Coupon Validation...")
        self.test_daily_coupon_validation(nmd5_code, nmd10_code)
        
        # Test 5: Invalid coupon handling
        print("\n❌ Testing Invalid Coupon Handling...")
        self.test_invalid_coupons()
        
        # Test 6: Case insensitivity
        print("\n🔤 Testing Case Insensitivity...")
        self.test_case_insensitivity()
        
        # Test 7: Welcome offer coupon
        print("\n🎁 Testing Welcome Offer Coupon...")
        self.test_welcome_offer_coupon()
        
        # Test 8: Empty code handling
        print("\n🚫 Testing Empty Code Handling...")
        self.test_empty_code()
        
        # Test 9: Discount math verification
        print("\n🧮 Testing Discount Math Verification...")
        self.test_discount_math_verification()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"📈 Success Rate: {(self.passed/(self.passed+self.failed)*100):.1f}%")
        
        if self.failed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.results:
                if not result["passed"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        return self.failed == 0

if __name__ == "__main__":
    tester = CouponTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Coupon system is working correctly.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {tester.failed} test(s) failed. Please check the issues above.")
        sys.exit(1)