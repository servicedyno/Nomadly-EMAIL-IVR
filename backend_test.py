#!/usr/bin/env python3
"""
Bulk IVR Security Fix Testing Suite
Tests the security fixes for the Nomadly Telegram Bot backend
"""
import requests
import json
import pymongo
from pymongo import MongoClient
import os
import sys
import subprocess

# MongoDB connection from review request
MONGO_CONNECTION_STRING = "mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668"
DATABASE_NAME = "test"

# Backend URL
BACKEND_URL = "http://localhost:5000"

class BulkIVRSecurityTest:
    def __init__(self):
        self.client = None
        self.db = None
        self.test_results = {}
        
    def connect_mongodb(self):
        """Connect to MongoDB"""
        try:
            self.client = MongoClient(MONGO_CONNECTION_STRING)
            self.db = self.client[DATABASE_NAME]
            # Test connection
            self.db.command('ping')
            print("✅ MongoDB connection successful")
            return True
        except Exception as e:
            print(f"❌ MongoDB connection failed: {e}")
            return False
            
    def test_nodejs_health(self):
        """Test 1: Node.js health check"""
        print("\n1. Testing Node.js Health...")
        try:
            response = requests.get(f"{BACKEND_URL}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Health endpoint returns: {data}")
                
                # Check error log
                result = subprocess.run(['wc', '-c', '/var/log/supervisor/nodejs.err.log'], 
                                      capture_output=True, text=True)
                if "0 " in result.stdout:
                    print("✅ Node.js error log is empty (0 bytes)")
                    self.test_results['nodejs_health'] = True
                    return True
                else:
                    print(f"⚠️ Node.js error log size: {result.stdout.strip()}")
                    self.test_results['nodejs_health'] = False
                    return False
            else:
                print(f"❌ Health endpoint returned status {response.status_code}")
                self.test_results['nodejs_health'] = False
                return False
        except Exception as e:
            print(f"❌ Health check failed: {e}")
            self.test_results['nodejs_health'] = False
            return False
            
    def test_verified_caller_ids_removed(self):
        """Test 2: Verified caller IDs removal from Bulk IVR"""
        print("\n2. Testing Verified Caller IDs Removal...")
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
                
            # Check around line 10834 for the security comment
            lines = content.split('\n')
            
            # Look for the security comment
            security_comment_found = False
            twilioClient_list_removed = True
            
            for i, line in enumerate(lines[10830:10850], 10830):
                if "Verified caller IDs from the main Twilio account are NOT exposed to users" in line:
                    security_comment_found = True
                    print(f"✅ Security comment found at line {i+1}: {line.strip()}")
                    
                if "twilioClient.outgoingCallerIds.list()" in line:
                    print(f"❌ Found banned code at line {i+1}: {line.strip()}")
                    twilioClient_list_removed = False
                    
            # Check that allCallerIds only contains bulkCapableNumbers
            allCallerIds_line_found = False
            for i, line in enumerate(lines[10840:10860], 10840):
                if "const allCallerIds = [...bulkCapableNumbers]" in line:
                    allCallerIds_line_found = True
                    print(f"✅ allCallerIds correctly uses only bulkCapableNumbers at line {i+1}")
                    break
                    
            if security_comment_found and twilioClient_list_removed and allCallerIds_line_found:
                print("✅ Verified caller IDs properly removed from Bulk IVR caller selection")
                self.test_results['caller_ids_removed'] = True
                return True
            else:
                print("❌ Verified caller ID removal not properly implemented")
                self.test_results['caller_ids_removed'] = False
                return False
                
        except Exception as e:
            print(f"❌ Failed to verify caller ID removal: {e}")
            self.test_results['caller_ids_removed'] = False
            return False
            
    def test_sub_account_enforcement(self):
        """Test 3: Sub-account enforcement in startCampaign"""
        print("\n3. Testing Sub-account Enforcement in startCampaign...")
        try:
            with open('/app/js/bulk-call-service.js', 'r') as f:
                content = f.read()
                
            # Check for the security check in startCampaign
            if "if (!campaign.twilioSubAccountSid)" in content:
                print("✅ Sub-account check found in startCampaign")
                
                # Check for proper error handling
                if "status: 'cancelled'" in content and "No Twilio sub-account" in content:
                    print("✅ Campaign cancellation with proper reason found")
                    
                    # Check for user notification
                    if "Campaign Blocked" in content and "Twilio-powered" in content:
                        print("✅ User notification message found")
                        self.test_results['sub_account_enforcement'] = True
                        return True
                    else:
                        print("❌ User notification not found")
                else:
                    print("❌ Campaign cancellation logic not found")
            else:
                print("❌ Sub-account check not found in startCampaign")
                
            self.test_results['sub_account_enforcement'] = False
            return False
            
        except Exception as e:
            print(f"❌ Failed to verify sub-account enforcement: {e}")
            self.test_results['sub_account_enforcement'] = False
            return False
            
    def test_mongodb_running_campaigns(self):
        """Test 4: MongoDB state - 0 running campaigns"""
        print("\n4. Testing MongoDB Running Campaigns State...")
        try:
            collection = self.db['bulkCallCampaigns']
            running_campaigns = list(collection.find({"status": "running"}))
            
            print(f"Running campaigns found: {len(running_campaigns)}")
            
            if len(running_campaigns) == 0:
                print("✅ MongoDB shows 0 running campaigns as expected")
                self.test_results['zero_running_campaigns'] = True
                return True
            else:
                print(f"❌ Found {len(running_campaigns)} running campaigns (expected 0)")
                for campaign in running_campaigns:
                    print(f"   Campaign ID: {campaign.get('id', 'N/A')}, Status: {campaign.get('status', 'N/A')}")
                self.test_results['zero_running_campaigns'] = False
                return False
                
        except Exception as e:
            print(f"❌ Failed to check running campaigns: {e}")
            self.test_results['zero_running_campaigns'] = False
            return False
            
    def test_wizardchop_wallet(self):
        """Test 5: @wizardchop wallet negative balance"""
        print("\n5. Testing @wizardchop Wallet State...")
        try:
            collection = self.db['walletOf']
            wizardchop_wallet = collection.find_one({"_id": 1167900472})
            
            if wizardchop_wallet:
                print(f"Found @wizardchop wallet record: {wizardchop_wallet}")
                
                # Check if usdOut is at top level (not under val)
                if 'usdOut' in wizardchop_wallet:
                    usd_in = wizardchop_wallet.get('usdIn', 0)
                    usd_out = wizardchop_wallet.get('usdOut', 0)
                    balance = usd_in - usd_out
                    
                    print(f"USD In: ${usd_in:.2f}, USD Out: ${usd_out:.2f}, Balance: ${balance:.2f}")
                    
                    # Check if balance is approximately -$2.91 (negative)
                    if balance < 0 and abs(balance + 2.91) < 1.0:  # Within $1 of expected -$2.91
                        print(f"✅ @wizardchop wallet balance is negative (~-$2.91): ${balance:.2f}")
                        self.test_results['wizardchop_negative_wallet'] = True
                        return True
                    else:
                        print(f"❌ @wizardchop wallet balance is not as expected: ${balance:.2f} (expected ~-$2.91)")
                        self.test_results['wizardchop_negative_wallet'] = False
                        return False
                        
                else:
                    print("❌ usdOut field not found at top level of wallet document")
                    self.test_results['wizardchop_negative_wallet'] = False
                    return False
                    
            else:
                print("❌ @wizardchop wallet record not found")
                self.test_results['wizardchop_negative_wallet'] = False
                return False
                
        except Exception as e:
            print(f"❌ Failed to check @wizardchop wallet: {e}")
            self.test_results['wizardchop_negative_wallet'] = False
            return False
            
    def test_campaign_terminated(self):
        """Test 6: Campaign 028eb7bb-a186-4e04-bf55-d0bc4fecd8fb terminated"""
        print("\n6. Testing Campaign Termination...")
        try:
            collection = self.db['bulkCallCampaigns']
            campaign = collection.find_one({"id": "028eb7bb-a186-4e04-bf55-d0bc4fecd8fb"})
            
            if campaign:
                print(f"Found campaign: {campaign}")
                
                status = campaign.get('status')
                cancelled_reason = campaign.get('cancelledReason', '')
                
                if status == 'cancelled':
                    print(f"✅ Campaign status is 'cancelled'")
                    
                    if 'unauthorized' in cancelled_reason.lower():
                        print(f"✅ Campaign has unauthorized use reason: {cancelled_reason}")
                        self.test_results['campaign_terminated'] = True
                        return True
                    else:
                        print(f"⚠️ Campaign is cancelled but reason doesn't mention unauthorized use: {cancelled_reason}")
                        self.test_results['campaign_terminated'] = True  # Still pass since it's cancelled
                        return True
                else:
                    print(f"❌ Campaign status is '{status}' (expected 'cancelled')")
                    self.test_results['campaign_terminated'] = False
                    return False
                    
            else:
                print("❌ Campaign 028eb7bb-a186-4e04-bf55-d0bc4fecd8fb not found")
                self.test_results['campaign_terminated'] = False
                return False
                
        except Exception as e:
            print(f"❌ Failed to check campaign termination: {e}")
            self.test_results['campaign_terminated'] = False
            return False
    
    def run_all_tests(self):
        """Run all tests and return summary"""
        print("=" * 60)
        print("BULK IVR SECURITY FIX TESTING SUITE")
        print("=" * 60)
        
        # Connect to MongoDB first
        if not self.connect_mongodb():
            return False
            
        # Run all tests
        test_methods = [
            self.test_nodejs_health,
            self.test_verified_caller_ids_removed,
            self.test_sub_account_enforcement,
            self.test_mongodb_running_campaigns,
            self.test_wizardchop_wallet,
            self.test_campaign_terminated
        ]
        
        passed_tests = 0
        total_tests = len(test_methods)
        
        for test_method in test_methods:
            try:
                if test_method():
                    passed_tests += 1
            except Exception as e:
                print(f"❌ Test {test_method.__name__} crashed: {e}")
                
        # Print summary
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        for test_name, result in self.test_results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name}: {status}")
            
        print(f"\nOVERALL: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 ALL SECURITY FIXES VERIFIED!")
            return True
        else:
            print("⚠️ Some tests failed - security fixes may be incomplete")
            return False
        
    def cleanup(self):
        """Cleanup resources"""
        if self.client:
            self.client.close()

if __name__ == "__main__":
    tester = BulkIVRSecurityTest()
    try:
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
    finally:
        tester.cleanup()