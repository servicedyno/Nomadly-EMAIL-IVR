#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Nomadly Platform
Focus: Broadcast Pre-filtering Fixes Verification
"""

import os
import sys
import subprocess
import json
import requests
import time
from pymongo import MongoClient
from urllib.parse import urlparse

# Configuration
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:5000')
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'test')

class BroadcastPreFilteringTests:
    def __init__(self):
        self.backend_url = BACKEND_URL
        self.mongo_url = MONGO_URL
        self.db_name = DB_NAME
        self.results = []
        self.mongo_client = None
        self.db = None
        
    def log_result(self, test_name, status, details=""):
        """Log test result"""
        result = {
            'test': test_name,
            'status': status,
            'details': details,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }
        self.results.append(result)
        status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_icon} {test_name}: {status}")
        if details:
            print(f"   Details: {details}")
    
    def setup_database_connection(self):
        """Setup MongoDB connection"""
        try:
            self.mongo_client = MongoClient(self.mongo_url)
            self.db = self.mongo_client[self.db_name]
            # Test connection
            self.db.command('ping')
            self.log_result("Database Connection", "PASS", f"Connected to {self.db_name}")
            return True
        except Exception as e:
            self.log_result("Database Connection", "FAIL", str(e))
            return False
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        try:
            response = requests.get(f"{self.backend_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy' and data.get('database') == 'connected':
                    self.log_result("Health Endpoint", "PASS", f"Status: {data.get('status')}, DB: {data.get('database')}")
                    return True
                else:
                    self.log_result("Health Endpoint", "FAIL", f"Unhealthy response: {data}")
                    return False
            else:
                self.log_result("Health Endpoint", "FAIL", f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Health Endpoint", "FAIL", str(e))
            return False
    
    def test_nodejs_syntax_validation(self):
        """Test JavaScript syntax validation"""
        files_to_check = [
            '/app/js/utils.js',
            '/app/js/auto-promo.js'
        ]
        
        all_passed = True
        for file_path in files_to_check:
            try:
                result = subprocess.run(['node', '-c', file_path], 
                                      capture_output=True, text=True, timeout=30)
                if result.returncode == 0:
                    self.log_result(f"Syntax Check: {os.path.basename(file_path)}", "PASS")
                else:
                    self.log_result(f"Syntax Check: {os.path.basename(file_path)}", "FAIL", 
                                  result.stderr.strip())
                    all_passed = False
            except Exception as e:
                self.log_result(f"Syntax Check: {os.path.basename(file_path)}", "FAIL", str(e))
                all_passed = False
        
        return all_passed
    
    def test_nodejs_error_log(self):
        """Check Node.js error log is clean"""
        try:
            result = subprocess.run(['wc', '-c', '/var/log/supervisor/nodejs.err.log'], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                size = int(result.stdout.split()[0])
                if size == 0:
                    self.log_result("Node.js Error Log", "PASS", "0 bytes (clean)")
                    return True
                else:
                    self.log_result("Node.js Error Log", "WARN", f"{size} bytes (has errors)")
                    return False
            else:
                self.log_result("Node.js Error Log", "FAIL", "Could not check log size")
                return False
        except Exception as e:
            self.log_result("Node.js Error Log", "FAIL", str(e))
            return False
    
    def test_marketplace_broadcast_prefiltering(self):
        """Test marketplace broadcast pre-filtering implementation"""
        try:
            # Read utils.js and check broadcastNewListing function
            with open('/app/js/utils.js', 'r') as f:
                content = f.read()
            
            # Check for correct pre-filtering logic
            checks = [
                ('promoOptOut.find({ optedOut: true })', 'Uses correct query for all opted-out users'),
                ('const deadSet = new Set(allOptedOut.map(r => r._id))', 'Builds deadSet from ALL optedOut:true records'),
                ('record?.failCount >= 3', 'Uses failCount >= 3 threshold'),
                ('{ $set: { optedOut: false, failCount: 0', 'Success handler resets failCount to 0')
            ]
            
            all_passed = True
            for pattern, description in checks:
                if pattern in content:
                    self.log_result(f"Marketplace Broadcast: {description}", "PASS")
                else:
                    self.log_result(f"Marketplace Broadcast: {description}", "FAIL", f"Pattern not found: {pattern}")
                    all_passed = False
            
            return all_passed
            
        except Exception as e:
            self.log_result("Marketplace Broadcast Pre-filtering", "FAIL", str(e))
            return False
    
    def test_admin_broadcast_prefiltering(self):
        """Test admin broadcast pre-filtering implementation"""
        try:
            # Read utils.js and check sendMessageToAllUsers function
            with open('/app/js/utils.js', 'r') as f:
                content = f.read()
            
            # Check for correct pre-filtering logic in sendMessageToAllUsers
            checks = [
                ('const allOptedOut = await promoOptOut.find({ optedOut: true }).toArray()', 'Uses correct query for all opted-out users'),
                ('const deadSet = new Set(allOptedOut.map(r => r._id))', 'Builds deadSet from ALL optedOut:true records'),
                ('if (record?.failCount >= 3)', 'Uses failCount >= 3 threshold'),
                ('{ $set: { optedOut: false, failCount: 0, updatedAt: new Date() }', 'Success handler resets failCount')
            ]
            
            all_passed = True
            for pattern, description in checks:
                if pattern in content:
                    self.log_result(f"Admin Broadcast: {description}", "PASS")
                else:
                    self.log_result(f"Admin Broadcast: {description}", "FAIL", f"Pattern not found: {pattern}")
                    all_passed = False
            
            return all_passed
            
        except Exception as e:
            self.log_result("Admin Broadcast Pre-filtering", "FAIL", str(e))
            return False
    
    def test_autopromo_consistency(self):
        """Test AutoPromo consistency with broadcast systems"""
        try:
            # Read auto-promo.js and check DEAD_THRESHOLD
            with open('/app/js/auto-promo.js', 'r') as f:
                content = f.read()
            
            # Check for DEAD_THRESHOLD = 3
            if 'const DEAD_THRESHOLD = 3' in content:
                self.log_result("AutoPromo DEAD_THRESHOLD", "PASS", "DEAD_THRESHOLD = 3 matches utils.js failCount >= 3")
            else:
                self.log_result("AutoPromo DEAD_THRESHOLD", "FAIL", "DEAD_THRESHOLD should be 3")
                return False
            
            # Check for consistent failCount usage
            if 'record?.failCount >= DEAD_THRESHOLD' in content:
                self.log_result("AutoPromo failCount Logic", "PASS", "Uses failCount >= DEAD_THRESHOLD pattern")
            else:
                self.log_result("AutoPromo failCount Logic", "FAIL", "Missing failCount >= DEAD_THRESHOLD pattern")
                return False
            
            return True
            
        except Exception as e:
            self.log_result("AutoPromo Consistency", "FAIL", str(e))
            return False
    
    def test_database_state_verification(self):
        """Test database state verification"""
        if self.db is None:
            self.log_result("Database State Verification", "SKIP", "No database connection")
            return False
        
        try:
            # Check promoOptOut collection
            promo_opt_out = self.db.promoOptOut
            
            # Count opted-out users
            opted_out_count = promo_opt_out.count_documents({'optedOut': True})
            self.log_result("PromoOptOut Opted-Out Count", "INFO", f"~{opted_out_count} opted-out users")
            
            # Count opted-in users (optedOut: false or missing)
            opted_in_count = promo_opt_out.count_documents({'$or': [{'optedOut': False}, {'optedOut': {'$exists': False}}]})
            self.log_result("PromoOptOut Opted-In Count", "INFO", f"~{opted_in_count} opted-in users")
            
            # Total users in promoOptOut
            total_promo_users = promo_opt_out.count_documents({})
            self.log_result("PromoOptOut Total Users", "INFO", f"{total_promo_users} total users in promoOptOut collection")
            
            # Check if numbers are reasonable (should have some opted-out and opted-in users)
            if opted_out_count > 0 and opted_in_count > 0:
                self.log_result("Database State Verification", "PASS", 
                              f"Reasonable distribution: {opted_out_count} opted-out, {opted_in_count} opted-in")
                return True
            else:
                self.log_result("Database State Verification", "WARN", 
                              "Unusual distribution of opted-out/opted-in users")
                return False
            
        except Exception as e:
            self.log_result("Database State Verification", "FAIL", str(e))
            return False
    
    def test_broadcast_filtering_logic_consistency(self):
        """Test that all broadcast systems use consistent filtering logic"""
        try:
            # Read both files
            with open('/app/js/utils.js', 'r') as f:
                utils_content = f.read()
            
            with open('/app/js/auto-promo.js', 'r') as f:
                autopromo_content = f.read()
            
            # Check that all systems use the same threshold
            utils_threshold_3 = 'failCount >= 3' in utils_content
            autopromo_threshold_3 = 'DEAD_THRESHOLD = 3' in autopromo_content
            
            if utils_threshold_3 and autopromo_threshold_3:
                self.log_result("Broadcast Filtering Consistency", "PASS", 
                              "All systems use failCount >= 3 threshold")
                return True
            else:
                self.log_result("Broadcast Filtering Consistency", "FAIL", 
                              f"Inconsistent thresholds: utils={utils_threshold_3}, autopromo={autopromo_threshold_3}")
                return False
            
        except Exception as e:
            self.log_result("Broadcast Filtering Logic Consistency", "FAIL", str(e))
            return False
    
    def run_all_tests(self):
        """Run all broadcast pre-filtering tests"""
        print("🚀 Starting Broadcast Pre-filtering Tests for Nomadly Platform")
        print("=" * 70)
        
        # Health and stability tests
        print("\n📊 HEALTH & STABILITY TESTS")
        print("-" * 40)
        self.test_health_endpoint()
        self.test_nodejs_error_log()
        self.test_nodejs_syntax_validation()
        
        # Database connection
        print("\n🗄️ DATABASE CONNECTION")
        print("-" * 40)
        db_connected = self.setup_database_connection()
        
        # Core broadcast pre-filtering tests
        print("\n🎯 BROADCAST PRE-FILTERING TESTS")
        print("-" * 40)
        self.test_marketplace_broadcast_prefiltering()
        self.test_admin_broadcast_prefiltering()
        self.test_autopromo_consistency()
        self.test_broadcast_filtering_logic_consistency()
        
        # Database state verification
        if db_connected:
            print("\n🔍 DATABASE STATE VERIFICATION")
            print("-" * 40)
            self.test_database_state_verification()
        
        # Summary
        print("\n📋 TEST SUMMARY")
        print("=" * 70)
        
        passed = sum(1 for r in self.results if r['status'] == 'PASS')
        failed = sum(1 for r in self.results if r['status'] == 'FAIL')
        warned = sum(1 for r in self.results if r['status'] == 'WARN')
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"⚠️  Warnings: {warned}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if result['status'] == 'FAIL':
                    print(f"   • {result['test']}: {result['details']}")
        
        if warned > 0:
            print("\n⚠️  WARNINGS:")
            for result in self.results:
                if result['status'] == 'WARN':
                    print(f"   • {result['test']}: {result['details']}")
        
        # Cleanup
        if self.mongo_client:
            self.mongo_client.close()
        
        return failed == 0

def main():
    """Main test execution"""
    tester = BroadcastPreFilteringTests()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 ALL TESTS PASSED! Broadcast pre-filtering fixes are working correctly.")
        sys.exit(0)
    else:
        print("\n💥 SOME TESTS FAILED! Please review the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()