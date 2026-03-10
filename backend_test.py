#!/usr/bin/env python3
"""
Win-back campaign fix verification test
Testing the lastMessageAt backfill fix for Nomadly Telegram Bot backend

Requirements tested:
1. Node.js Health: GET http://localhost:5000/health should return 200 with healthy status
2. Backfill Marker Exists: Check MongoDB collection 'state' for document with _id: '__winback_backfill_done'
3. lastMessageAt Coverage: Count state docs with lastMessageAt and numeric _id
4. Inactive Users Query: Count state docs with lastMessageAt older than 7 days AND _id > 0
5. Startup Logs: Check for backfill completion messages
6. findInactiveUsers Query: Verify $gt: 0 filter exists in js/monetization-engine.js
7. Index on lastMessageAt: Verify createIndex({ lastMessageAt: 1 }) exists
"""

import requests
import subprocess
import os
import json
from datetime import datetime, timedelta

class WinBackTestResults:
    def __init__(self):
        self.results = {}
        self.all_passed = True
    
    def add_result(self, test_name, passed, details=""):
        self.results[test_name] = {
            'passed': passed,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        if not passed:
            self.all_passed = False
        
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"    Details: {details}")
    
    def print_summary(self):
        print("\n" + "="*70)
        print("WIN-BACK CAMPAIGN FIX TEST SUMMARY")
        print("="*70)
        
        passed_count = sum(1 for r in self.results.values() if r['passed'])
        total_count = len(self.results)
        
        print(f"Tests passed: {passed_count}/{total_count}")
        print(f"Overall result: {'✅ ALL TESTS PASSED' if self.all_passed else '❌ SOME TESTS FAILED'}")
        print()
        
        for test_name, result in self.results.items():
            status = "✅" if result['passed'] else "❌"
            print(f"{status} {test_name}")
            if result['details']:
                print(f"    {result['details']}")

def test_nodejs_health():
    """Test 1: Node.js Health Check"""
    try:
        response = requests.get("http://localhost:5000/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                return True, f"Status: {data['status']}, Database: {data['database']}, Uptime: {data.get('uptime', 'N/A')}"
            else:
                return False, f"Unexpected health response: {data}"
        else:
            return False, f"HTTP {response.status_code}: {response.text}"
            
    except Exception as e:
        return False, f"Connection error: {str(e)}"

def test_error_log_empty():
    """Test 1b: Check nodejs error log is empty"""
    try:
        result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            output_lines = result.stdout.strip().split('\n')
            if output_lines:
                file_info = output_lines[-1]  # Last line should be the file info
                if ' 0 ' in file_info:  # File size is 0 bytes
                    return True, "Error log is empty (0 bytes)"
                else:
                    return False, f"Error log is not empty: {file_info}"
            else:
                return False, "Could not parse ls output"
        else:
            return False, f"ls command failed: {result.stderr}"
            
    except Exception as e:
        return False, f"Error checking log file: {str(e)}"

def test_startup_logs():
    """Test 5: Check startup logs for backfill messages"""
    try:
        result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/nodejs.out.log'], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode != 0:
            return False, f"tail command failed: {result.stderr}"
        
        log_content = result.stdout
        
        expected_messages = [
            "[WinBack] Backfill: seeded lastMessageAt from lastUpdated for 385 users",
            "[WinBack] Backfill: seeded lastMessageAt (30d ago) for 3058 users",
            "[WinBack] Backfill complete"
        ]
        
        found_messages = []
        for msg in expected_messages:
            if msg in log_content:
                found_messages.append(msg)
        
        if len(found_messages) == len(expected_messages):
            return True, f"All 3 expected backfill messages found"
        else:
            return False, f"Found {len(found_messages)}/{len(expected_messages)} expected messages: {found_messages}"
            
    except Exception as e:
        return False, f"Error checking logs: {str(e)}"

def test_monetization_engine_code():
    """Test 6: Verify findInactiveUsers query uses $gt: 0 filter"""
    try:
        with open('/app/js/monetization-engine.js', 'r') as f:
            content = f.read()
        
        # Check for the specific query pattern
        if '_id: { $type: \'number\', $gt: 0 }' in content:
            return True, "findInactiveUsers query correctly filters positive chatIds only"
        else:
            return False, "findInactiveUsers query missing $gt: 0 filter for positive chatIds"
            
    except Exception as e:
        return False, f"Error reading monetization-engine.js: {str(e)}"

def test_index_creation():
    """Test 7: Verify lastMessageAt index creation code exists"""
    try:
        with open('/app/js/monetization-engine.js', 'r') as f:
            content = f.read()
        
        # Check for index creation
        if '_stateCol.createIndex({ lastMessageAt: 1 })' in content:
            return True, "createIndex({ lastMessageAt: 1 }) found in initWinBack function"
        else:
            return False, "lastMessageAt index creation not found in code"
            
    except Exception as e:
        return False, f"Error reading monetization-engine.js: {str(e)}"

def run_mongodb_tests():
    """Tests 2, 3, 4, 7: MongoDB verification via Node.js"""
    
    node_script = '''
    const { MongoClient } = require('mongodb');
    const mongoUrl = process.env.MONGO_URL || 'mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668';
    const dbName = process.env.DB_NAME || 'test';
    
    (async () => {
      try {
        const client = new MongoClient(mongoUrl);
        await client.connect();
        const db = client.db(dbName);
        const stateCol = db.collection('state');
        
        const results = {};
        
        // Test 2: Check backfill marker exists
        const backfillMarker = await stateCol.findOne({ _id: '__winback_backfill_done' });
        results.backfillExists = !!backfillMarker;
        results.backfillDoneAt = backfillMarker ? backfillMarker.doneAt : null;
        
        // Test 3: Count docs with lastMessageAt
        const withLastMessageAt = await stateCol.countDocuments({
          lastMessageAt: { $exists: true },
          _id: { $type: 'number' }
        });
        results.lastMessageAtCount = withLastMessageAt;
        
        // Test 4: Count inactive users (7+ days old)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const inactiveUsers = await stateCol.countDocuments({
          lastMessageAt: { $lt: sevenDaysAgo, $exists: true },
          _id: { $type: 'number', $gt: 0 }
        });
        results.inactiveUsersCount = inactiveUsers;
        
        // Total user count for reference
        const totalUsers = await stateCol.countDocuments({ _id: { $type: 'number' } });
        results.totalUsers = totalUsers;
        
        // Test 7: Check if lastMessageAt index exists
        const indexes = await stateCol.listIndexes().toArray();
        const lastMessageAtIndex = indexes.find(idx => idx.key && idx.key.lastMessageAt);
        results.indexExists = !!lastMessageAtIndex;
        
        await client.close();
        console.log(JSON.stringify(results));
      } catch (e) {
        console.log(JSON.stringify({ error: e.message }));
      }
    })();
    '''
    
    try:
        result = subprocess.run(['node', '-e', node_script], 
                              capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            return {}, f"Node.js script failed: {result.stderr}"
        
        data = json.loads(result.stdout.strip())
        if 'error' in data:
            return {}, f"MongoDB connection error: {data['error']}"
        
        return data, None
        
    except json.JSONDecodeError as e:
        return {}, f"Failed to parse MongoDB test results: {str(e)}"
    except Exception as e:
        return {}, f"Error running MongoDB tests: {str(e)}"

def main():
    """Run all win-back campaign fix tests"""
    print("NOMADLY TELEGRAM BOT - WIN-BACK CAMPAIGN FIX VERIFICATION")
    print("Testing lastMessageAt backfill fix implementation")
    print("="*70)
    print()
    
    test_results = WinBackTestResults()
    
    # Test 1: Node.js Health Check
    passed, details = test_nodejs_health()
    test_results.add_result("1. Node.js Health Check", passed, details)
    
    # Test 1b: Error log empty
    passed, details = test_error_log_empty()
    test_results.add_result("1b. nodejs.err.log is Empty", passed, details)
    
    # MongoDB Tests (2, 3, 4, 7b)
    mongo_data, mongo_error = run_mongodb_tests()
    if mongo_error:
        test_results.add_result("2-4, 7b. MongoDB Tests", False, mongo_error)
    else:
        # Test 2: Backfill marker
        passed = mongo_data.get('backfillExists', False)
        details = f"doneAt: {mongo_data.get('backfillDoneAt', 'N/A')}" if passed else "Marker not found"
        test_results.add_result("2. Backfill Marker Exists", passed, details)
        
        # Test 3: lastMessageAt coverage
        count = mongo_data.get('lastMessageAtCount', 0)
        total = mongo_data.get('totalUsers', 0)
        passed = count >= 3400  # Should be ~3448
        details = f"{count} users have lastMessageAt field (total users: {total})"
        test_results.add_result("3. lastMessageAt Coverage", passed, details)
        
        # Test 4: Inactive users query
        inactive_count = mongo_data.get('inactiveUsersCount', 0)
        passed = inactive_count >= 3000  # Should be 3000+ users
        details = f"{inactive_count} users inactive for 7+ days (positive chatIds only)"
        test_results.add_result("4. Inactive Users Query", passed, details)
        
        # Test 7b: Index exists in MongoDB
        passed = mongo_data.get('indexExists', False)
        details = "lastMessageAt index created successfully" if passed else "Index not found"
        test_results.add_result("7b. lastMessageAt Index in MongoDB", passed, details)
    
    # Test 5: Startup logs
    passed, details = test_startup_logs()
    test_results.add_result("5. Startup Logs Verification", passed, details)
    
    # Test 6: Code verification - findInactiveUsers query
    passed, details = test_monetization_engine_code()
    test_results.add_result("6. findInactiveUsers Query Filter", passed, details)
    
    # Test 7a: Index creation code
    passed, details = test_index_creation()
    test_results.add_result("7a. Index Creation Code", passed, details)
    
    # Print final summary
    test_results.print_summary()
    
    return test_results.all_passed

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)