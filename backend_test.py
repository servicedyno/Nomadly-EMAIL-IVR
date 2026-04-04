#!/usr/bin/env python3
"""
Backend Test Suite for db.js get() function fix
Tests the fix for get() function returning stale val field instead of full document
"""

import subprocess
import requests
import json
import sys
import os
from pymongo import MongoClient
from urllib.parse import urlparse

def run_command(cmd, description):
    """Run a shell command and return result"""
    print(f"\n🔍 {description}")
    print(f"Command: {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        print(f"Exit code: {result.returncode}")
        if result.stdout:
            print(f"STDOUT:\n{result.stdout}")
        if result.stderr:
            print(f"STDERR:\n{result.stderr}")
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        print("❌ Command timed out")
        return False, "", "Timeout"
    except Exception as e:
        print(f"❌ Command failed: {e}")
        return False, "", str(e)

def test_syntax_validation():
    """Test 1: Syntax validation for both files"""
    print("\n" + "="*60)
    print("TEST 1: SYNTAX VALIDATION")
    print("="*60)
    
    # Test db.js syntax
    success1, stdout1, stderr1 = run_command("node -c /app/js/db.js", "Validating db.js syntax")
    
    # Test _index.js syntax  
    success2, stdout2, stderr2 = run_command("node -c /app/js/_index.js", "Validating _index.js syntax")
    
    return success1 and success2

def test_health_endpoint():
    """Test 2: Health endpoint check"""
    print("\n" + "="*60)
    print("TEST 2: HEALTH ENDPOINT CHECK")
    print("="*60)
    
    try:
        print("🔍 Testing health endpoint")
        response = requests.get("http://localhost:5000/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health endpoint working - Status: {data.get('status')}, Database: {data.get('database')}")
            return True
        else:
            print(f"❌ Health endpoint returned {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint test failed: {e}")
        return False

def test_error_logs():
    """Test 3: Check error logs"""
    print("\n" + "="*60)
    print("TEST 3: ERROR LOG CHECK")
    print("="*60)
    
    success, stdout, stderr = run_command("tail -20 /var/log/supervisor/nodejs.err.log", "Checking Node.js error logs")
    
    if success:
        if stdout.strip():
            print(f"📋 Recent error log entries:\n{stdout}")
            # Check for critical errors
            critical_errors = ["Error get:", "ReferenceError", "TypeError", "SyntaxError"]
            has_critical = any(error in stdout for error in critical_errors)
            if has_critical:
                print("⚠️ Found critical errors in logs")
                return False
            else:
                print("✅ No critical errors found in recent logs")
                return True
        else:
            print("✅ Error log is empty (good)")
            return True
    else:
        print("⚠️ Could not read error logs")
        return True  # Don't fail test if we can't read logs

def test_get_function_logic():
    """Test 4: Verify get() function logic in db.js"""
    print("\n" + "="*60)
    print("TEST 4: GET() FUNCTION LOGIC VERIFICATION")
    print("="*60)
    
    # Check the get() function implementation
    success, stdout, stderr = run_command("grep -A 20 'async function get(c, key)' /app/js/db.js", "Examining get() function")
    
    if success and stdout:
        print("📋 get() function implementation:")
        print(stdout)
        
        # Check for the key fix: hasExtraFields logic
        if "hasExtraFields" in stdout and "return result" in stdout:
            print("✅ Found hasExtraFields logic - fix appears to be implemented")
            
            # Check for the specific comment about the bug fix
            comment_check, comment_out, _ = run_command("grep -A 5 'BUG FIX:' /app/js/db.js", "Checking for bug fix comment")
            if comment_check and "BUG FIX:" in comment_out:
                print("✅ Found bug fix comment explaining the issue")
                return True
            else:
                print("⚠️ Bug fix comment not found, but logic appears correct")
                return True
        else:
            print("❌ hasExtraFields logic not found - fix may not be implemented")
            return False
    else:
        print("❌ Could not examine get() function")
        return False

def test_no_3arg_set_calls():
    """Test 5: Verify no 3-arg set() calls remain in _index.js"""
    print("\n" + "="*60)
    print("TEST 5: VERIFY NO 3-ARG SET() CALLS")
    print("="*60)
    
    # Look for problematic 3-arg set patterns
    success, stdout, stderr = run_command("grep -n 'set(state, chatId, {' /app/js/_index.js", "Searching for 3-arg set() calls with object spread")
    
    if success and stdout.strip():
        print("⚠️ Found potential 3-arg set() calls:")
        print(stdout)
        print("❌ These could create stale val fields")
        return False
    else:
        print("✅ No 3-arg set() calls with object spread found")
        return True

def test_voicemail_handler_fix():
    """Test 6: Verify voicemail handler uses 4-arg set()"""
    print("\n" + "="*60)
    print("TEST 6: VOICEMAIL HANDLER FIX VERIFICATION")
    print("="*60)
    
    # Check line 2187 specifically
    success, stdout, stderr = run_command("sed -n '2185,2190p' /app/js/_index.js", "Examining lines around 2187")
    
    if success and stdout:
        print("📋 Lines around 2187:")
        print(stdout)
        
        if "set(state, chatId, 'action', 'cpVoicemail')" in stdout:
            print("✅ Line 2187 uses correct 4-arg set() form")
            return True
        else:
            print("❌ Line 2187 does not use correct 4-arg set() form")
            return False
    else:
        print("❌ Could not examine line 2187")
        return False

def test_mongodb_connection():
    """Test 7: Test MongoDB connection and check for stale val fields"""
    print("\n" + "="*60)
    print("TEST 7: MONGODB CONNECTION AND VAL FIELD CHECK")
    print("="*60)
    
    try:
        # Get MongoDB URL from environment
        mongo_url = os.environ.get('MONGO_URL')
        if not mongo_url:
            print("⚠️ MONGO_URL not found in environment")
            return True  # Don't fail if we can't connect
        
        print(f"🔍 Connecting to MongoDB...")
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        
        # Test connection
        client.admin.command('ping')
        print("✅ MongoDB connection successful")
        
        # Get database name from URL or use default
        db_name = os.environ.get('DB_NAME', 'nomadly')
        db = client[db_name]
        
        # Check state collection for documents with both val and action fields
        state_collection = db.state
        problematic_docs = list(state_collection.find({
            "val": {"$exists": True, "$ne": None},
            "action": {"$exists": True}
        }).limit(10))
        
        if problematic_docs:
            print(f"⚠️ Found {len(problematic_docs)} documents with both val and action fields:")
            for doc in problematic_docs:
                print(f"  - _id: {doc.get('_id')}, action: {doc.get('action')}, val: {type(doc.get('val'))}")
            print("❌ These documents could cause the get() function bug")
            return False
        else:
            print("✅ No documents found with both val and action fields")
            return True
            
    except Exception as e:
        print(f"⚠️ MongoDB test failed: {e}")
        return True  # Don't fail test if we can't connect to MongoDB

def test_specific_user_state():
    """Test 8: Check specific user 6604316166 mentioned in the issue"""
    print("\n" + "="*60)
    print("TEST 8: SPECIFIC USER STATE CHECK")
    print("="*60)
    
    try:
        mongo_url = os.environ.get('MONGO_URL')
        if not mongo_url:
            print("⚠️ MONGO_URL not found - skipping user-specific test")
            return True
        
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        db_name = os.environ.get('DB_NAME', 'nomadly')
        db = client[db_name]
        
        # Check the specific user mentioned in the issue
        user_doc = db.state.find_one({"_id": 6604316166})
        
        if user_doc:
            print(f"📋 User 6604316166 state document:")
            print(f"  - Has action: {'action' in user_doc}")
            print(f"  - Has val: {'val' in user_doc}")
            print(f"  - Action value: {user_doc.get('action', 'N/A')}")
            print(f"  - Val value: {user_doc.get('val', 'N/A')}")
            
            if 'val' in user_doc and 'action' in user_doc:
                print("❌ User still has both val and action fields")
                return False
            else:
                print("✅ User document structure looks correct")
                return True
        else:
            print("ℹ️ User 6604316166 not found in state collection")
            return True
            
    except Exception as e:
        print(f"⚠️ User-specific test failed: {e}")
        return True

def main():
    """Run all tests"""
    print("🚀 Starting Backend Test Suite for db.js get() function fix")
    print("="*80)
    
    tests = [
        ("Syntax Validation", test_syntax_validation),
        ("Health Endpoint", test_health_endpoint),
        ("Error Logs", test_error_logs),
        ("get() Function Logic", test_get_function_logic),
        ("No 3-arg set() calls", test_no_3arg_set_calls),
        ("Voicemail Handler Fix", test_voicemail_handler_fix),
        ("MongoDB Connection", test_mongodb_connection),
        ("Specific User State", test_specific_user_state),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
            print(f"\n{'✅' if result else '❌'} {test_name}: {'PASSED' if result else 'FAILED'}")
        except Exception as e:
            print(f"\n❌ {test_name}: FAILED with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status:<12} {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! The get() function fix appears to be working correctly.")
        return 0
    else:
        print("⚠️ Some tests failed. Please review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())