#!/usr/bin/env python3
"""
Marketplace Ban/Unban System Testing
Tests the Node.js Telegram bot marketplace ban/unban functionality
"""

import subprocess
import sys
import os
import json
import re
from typing import Dict, List, Tuple, Optional

class MarketplaceBanTestSuite:
    def __init__(self):
        self.test_results = []
        self.failed_tests = []
        
    def log_test(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append((test_name, passed, details))
        if not passed:
            self.failed_tests.append(test_name)
    
    def run_command(self, cmd: str, cwd: str = "/app") -> Tuple[int, str, str]:
        """Run shell command and return exit code, stdout, stderr"""
        try:
            result = subprocess.run(
                cmd, shell=True, cwd=cwd, 
                capture_output=True, text=True, timeout=30
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return 1, "", "Command timed out"
        except Exception as e:
            return 1, "", str(e)
    
    def test_marketplace_service_syntax(self):
        """Test 1: Syntax check marketplace-service.js"""
        exit_code, stdout, stderr = self.run_command("node -c /app/js/marketplace-service.js")
        passed = exit_code == 0
        details = stderr if stderr else "Syntax OK"
        self.log_test("marketplace-service.js syntax check", passed, details)
        return passed
    
    def test_marketplace_service_bans_variable(self):
        """Test 2: Check _bans variable declared"""
        exit_code, stdout, stderr = self.run_command("grep -n 'let _bans = null' /app/js/marketplace-service.js")
        passed = exit_code == 0 and "_bans = null" in stdout
        details = f"Found at line: {stdout.split(':')[0] if stdout else 'Not found'}"
        self.log_test("_bans variable declared", passed, details)
        return passed
    
    def test_marketplace_service_bans_initialization(self):
        """Test 3: Check _bans collection initialization"""
        exit_code, stdout, stderr = self.run_command("grep -n '_bans = db.collection' /app/js/marketplace-service.js")
        passed = exit_code == 0 and "marketplaceBans" in stdout
        details = f"Found at line: {stdout.split(':')[0] if stdout else 'Not found'}"
        self.log_test("_bans collection initialization", passed, details)
        return passed
    
    def test_marketplace_service_ban_index(self):
        """Test 4: Check ban index creation"""
        exit_code, stdout, stderr = self.run_command("grep -n 'createIndex.*oduserId\\|createIndex.*userId' /app/js/marketplace-service.js")
        passed = exit_code == 0 and ("oduserId" in stdout or "userId" in stdout)
        details = f"Found at line: {stdout.split(':')[0] if stdout else 'Not found'}"
        self.log_test("Ban index creation", passed, details)
        return passed
    
    def test_marketplace_service_ban_functions(self):
        """Test 5-7: Check banUser, unbanUser, isUserBanned functions exist"""
        functions = ["banUser", "unbanUser", "isUserBanned"]
        all_passed = True
        
        for func in functions:
            exit_code, stdout, stderr = self.run_command(f"grep -n 'async function {func}\\|function {func}' /app/js/marketplace-service.js")
            passed = exit_code == 0
            details = f"Found at line: {stdout.split(':')[0] if stdout else 'Not found'}"
            self.log_test(f"{func} function exists", passed, details)
            if not passed:
                all_passed = False
        
        return all_passed
    
    def test_marketplace_service_exports(self):
        """Test 8: Check all 3 functions in module.exports"""
        exit_code, stdout, stderr = self.run_command("grep -A 50 'module.exports' /app/js/marketplace-service.js")
        passed = all(func in stdout for func in ["banUser", "unbanUser", "isUserBanned"])
        missing = [func for func in ["banUser", "unbanUser", "isUserBanned"] if func not in stdout]
        details = f"Missing from exports: {missing}" if missing else "All functions exported"
        self.log_test("Ban functions in module.exports", passed, details)
        return passed
    
    def test_index_js_syntax(self):
        """Test 9: Syntax check _index.js"""
        exit_code, stdout, stderr = self.run_command("node -c /app/js/_index.js")
        passed = exit_code == 0
        details = stderr if stderr else "Syntax OK"
        self.log_test("_index.js syntax check", passed, details)
        return passed
    
    def test_nodejs_running_clean(self):
        """Test 10: Node.js running clean"""
        # Check supervisor status
        exit_code, stdout, stderr = self.run_command("sudo supervisorctl status nodejs")
        nodejs_running = "RUNNING" in stdout
        
        # Check health endpoint
        exit_code2, stdout2, stderr2 = self.run_command("curl -s localhost:5000/health")
        health_ok = "healthy" in stdout2 or "ok" in stdout2.lower()
        
        # Check error log size
        exit_code3, stdout3, stderr3 = self.run_command("wc -c /var/log/supervisor/nodejs.err.log")
        error_log_size = int(stdout3.split()[0]) if stdout3.split() else 999
        
        passed = nodejs_running and health_ok and error_log_size == 0
        details = f"Running: {nodejs_running}, Health: {health_ok}, Error log: {error_log_size} bytes"
        self.log_test("Node.js running clean", passed, details)
        return passed
    
    def test_ban_check_goto_marketplace(self):
        """Test 11: Ban check in goto.marketplace"""
        exit_code, stdout, stderr = self.run_command("grep -n -A 5 -B 5 'marketplace: async' /app/js/_index.js")
        # Look for isUserBanned check before set(state, chatId, 'action', a.mpHome)
        exit_code2, stdout2, stderr2 = self.run_command("grep -n -A 10 'marketplace: async' /app/js/_index.js | grep -B 5 -A 5 'isUserBanned\\|marketplaceService.isUserBanned'")
        passed = exit_code2 == 0 and "isUserBanned" in stdout2
        details = f"Found ban check in goto.marketplace: {'Yes' if passed else 'No'}"
        self.log_test("Ban check in goto.marketplace", passed, details)
        return passed
    
    def test_ban_check_mp_home_list_product(self):
        """Test 12: Ban check in mpHome's mpListProduct handler"""
        # Search for mpListProduct handler in mpHome context (around line 9180)
        exit_code, stdout, stderr = self.run_command("grep -n -A 10 -B 5 'if (message === t.mpListProduct)' /app/js/_index.js")
        exit_code2, stdout2, stderr2 = self.run_command("sed -n '9175,9195p' /app/js/_index.js | grep -n 'isUserBanned\\|marketplaceService.isUserBanned'")
        passed = exit_code2 == 0 or "isUserBanned" in stdout
        details = f"Found ban check in mpHome mpListProduct: {'Yes' if passed else 'No'}"
        self.log_test("Ban check in mpHome mpListProduct handler", passed, details)
        return passed
    
    def test_ban_check_mp_my_listings_list_product(self):
        """Test 13: Ban check in mpMyListings's mpListProduct handler"""
        # Search for mpListProduct handler in mpMyListings context (around line 9284)
        exit_code, stdout, stderr = self.run_command("sed -n '9280,9300p' /app/js/_index.js | grep -n 'isUserBanned\\|marketplaceService.isUserBanned'")
        exit_code2, stdout2, stderr2 = self.run_command("grep -n -A 10 -B 5 'if (message === t.mpListProduct)' /app/js/_index.js")
        passed = exit_code == 0 or "isUserBanned" in stdout2
        details = f"Found ban check in mpMyListings mpListProduct: {'Yes' if passed else 'No'}"
        self.log_test("Ban check in mpMyListings mpListProduct handler", passed, details)
        return passed
    
    def test_marketplace_access_restricted_message(self):
        """Test 14: All 3 ban check locations show 'Marketplace Access Restricted' message"""
        exit_code, stdout, stderr = self.run_command("grep -n 'Marketplace Access Restricted\\|marketplace.*restricted\\|access.*restricted' /app/js/_index.js")
        # Count occurrences
        occurrences = len(stdout.split('\n')) if stdout.strip() else 0
        passed = occurrences >= 3
        details = f"Found {occurrences} 'Marketplace Access Restricted' messages"
        self.log_test("Marketplace Access Restricted messages", passed, details)
        return passed
    
    def test_admin_mpban_command(self):
        """Test 15: Admin /mpban command exists"""
        exit_code, stdout, stderr = self.run_command("grep -n 'isAdmin.*mpban\\|/mpban.*isAdmin' /app/js/_index.js")
        passed = exit_code == 0 and "mpban" in stdout
        details = f"Found /mpban command: {'Yes' if passed else 'No'}"
        self.log_test("Admin /mpban command", passed, details)
        return passed
    
    def test_admin_mpban_handler(self):
        """Test 16: Admin /mpban handler with username lookup and banUser call"""
        exit_code, stdout, stderr = self.run_command("grep -n -A 20 '/mpban ' /app/js/_index.js")
        passed = exit_code == 0 and ("nameOf.find" in stdout and "marketplaceService.banUser" in stdout)
        details = f"Found /mpban handler with username lookup and banUser: {'Yes' if passed else 'No'}"
        self.log_test("Admin /mpban handler implementation", passed, details)
        return passed
    
    def test_admin_mpunban_command(self):
        """Test 17: Admin /mpunban command exists"""
        exit_code, stdout, stderr = self.run_command("grep -n 'isAdmin.*mpunban\\|/mpunban.*isAdmin' /app/js/_index.js")
        passed = exit_code == 0 and "mpunban" in stdout
        details = f"Found /mpunban command: {'Yes' if passed else 'No'}"
        self.log_test("Admin /mpunban command", passed, details)
        return passed
    
    def test_admin_mpunban_handler(self):
        """Test 18: Admin /mpunban handler with unbanUser call"""
        exit_code, stdout, stderr = self.run_command("grep -n -A 20 '/mpunban ' /app/js/_index.js")
        passed = exit_code == 0 and "marketplaceService.unbanUser" in stdout
        details = f"Found /mpunban handler with unbanUser call: {'Yes' if passed else 'No'}"
        self.log_test("Admin /mpunban handler implementation", passed, details)
        return passed
    
    def test_database_ban_record_exists(self):
        """Test 19: Check marketplaceBans collection has ban for userId '8317455811'"""
        node_script = """
const {MongoClient} = require('mongodb');
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/nomadly';
(async () => {
    try {
        const client = await MongoClient.connect(MONGO_URL);
        const db = client.db();
        const ban = await db.collection('marketplaceBans').findOne({userId: '8317455811'});
        console.log('Ban exists:', !!ban);
        if (ban) {
            console.log('Reason:', ban.reason || 'N/A');
            console.log('BannedAt:', ban.bannedAt || 'N/A');
        }
        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
"""
        # Write script to temp file and execute
        with open('/tmp/check_ban.js', 'w') as f:
            f.write(node_script)
        
        exit_code, stdout, stderr = self.run_command("cd /app && node /tmp/check_ban.js")
        passed = exit_code == 0 and "Ban exists: true" in stdout
        details = stdout.strip() if stdout else stderr
        self.log_test("Ban record exists for userId 8317455811", passed, details)
        return passed
    
    def test_database_no_active_products(self):
        """Test 20: Check no remaining active products for 8317455811"""
        node_script = """
const {MongoClient} = require('mongodb');
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/nomadly';
(async () => {
    try {
        const client = await MongoClient.connect(MONGO_URL);
        const db = client.db();
        const count = await db.collection('marketplaceProducts').countDocuments({
            sellerId: {$in: [8317455811, '8317455811']}, 
            status: 'active'
        });
        console.log('Active listings:', count);
        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
"""
        # Write script to temp file and execute
        with open('/tmp/check_products.js', 'w') as f:
            f.write(node_script)
        
        exit_code, stdout, stderr = self.run_command("cd /app && node /tmp/check_products.js")
        passed = exit_code == 0 and "Active listings: 0" in stdout
        details = stdout.strip() if stdout else stderr
        self.log_test("No active products for banned user 8317455811", passed, details)
        return passed
    
    def run_all_tests(self):
        """Run all marketplace ban/unban tests"""
        print("🧪 Starting Marketplace Ban/Unban System Tests")
        print("=" * 60)
        
        # marketplace-service.js tests
        print("\n📁 Testing marketplace-service.js:")
        self.test_marketplace_service_syntax()
        self.test_marketplace_service_bans_variable()
        self.test_marketplace_service_bans_initialization()
        self.test_marketplace_service_ban_index()
        self.test_marketplace_service_ban_functions()
        self.test_marketplace_service_exports()
        
        # _index.js tests
        print("\n📁 Testing _index.js:")
        self.test_index_js_syntax()
        self.test_nodejs_running_clean()
        self.test_ban_check_goto_marketplace()
        self.test_ban_check_mp_home_list_product()
        self.test_ban_check_mp_my_listings_list_product()
        self.test_marketplace_access_restricted_message()
        self.test_admin_mpban_command()
        self.test_admin_mpban_handler()
        self.test_admin_mpunban_command()
        self.test_admin_mpunban_handler()
        
        # Database verification tests
        print("\n🗄️ Testing Database:")
        self.test_database_ban_record_exists()
        self.test_database_no_active_products()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for _, passed, _ in self.test_results if passed)
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  • {test}")
        
        return failed_tests == 0

if __name__ == "__main__":
    test_suite = MarketplaceBanTestSuite()
    success = test_suite.run_all_tests()
    sys.exit(0 if success else 1)