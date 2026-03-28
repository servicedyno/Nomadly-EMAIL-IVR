#!/usr/bin/env python3

"""
Phase 4 Backend Testing - MongoDB schema + monthly-only billing + auto-renewal scheduler
Testing all critical Phase 4 components as specified in the review request.
"""

import subprocess
import sys
import os
import json
import time
from datetime import datetime

def run_command(cmd, cwd=None):
    """Run a command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'returncode': result.returncode
        }
    except Exception as e:
        return {
            'success': False,
            'stdout': '',
            'stderr': str(e),
            'returncode': -1
        }

def test_contabo_service_suite():
    """Test the Contabo service test suite (18 tests)"""
    print("🧪 Testing Contabo Service Suite...")
    result = run_command("cd /app && node js/tests/test_contabo_service.js")
    
    if result['success']:
        # Parse the output to count tests
        output = result['stdout']
        if "18 passed, 0 failed" in output:
            print("✅ Contabo Service Suite: 18/18 tests passed")
            return True
        else:
            print(f"❌ Contabo Service Suite: Unexpected result")
            print(f"Output: {output}")
            return False
    else:
        print(f"❌ Contabo Service Suite failed: {result['stderr']}")
        return False

def test_vm_instance_setup_suite():
    """Test the VM instance setup test suite (17 tests)"""
    print("🧪 Testing VM Instance Setup Suite...")
    result = run_command("cd /app && node js/tests/test_vm_instance_setup.js")
    
    if result['success']:
        # Parse the output to count tests
        output = result['stdout']
        if "17 passed, 0 failed" in output:
            print("✅ VM Instance Setup Suite: 17/17 tests passed")
            return True
        else:
            print(f"❌ VM Instance Setup Suite: Unexpected result")
            print(f"Output: {output}")
            return False
    else:
        print(f"❌ VM Instance Setup Suite failed: {result['stderr']}")
        return False

def test_syntax_validation():
    """Test syntax validation of key JavaScript files"""
    print("🧪 Testing JavaScript Syntax Validation...")
    
    files_to_check = [
        "js/contabo-service.js",
        "js/vm-instance-setup.js", 
        "js/_index.js"
    ]
    
    all_passed = True
    for file_path in files_to_check:
        result = run_command(f"cd /app && node -c {file_path}")
        if result['success']:
            print(f"✅ Syntax check passed: {file_path}")
        else:
            print(f"❌ Syntax check failed: {file_path}")
            print(f"Error: {result['stderr']}")
            all_passed = False
    
    return all_passed

def test_service_health():
    """Test Node.js service health"""
    print("🧪 Testing Service Health...")
    
    # Check service status
    status_result = run_command("sudo supervisorctl status nodejs")
    if not status_result['success'] or "RUNNING" not in status_result['stdout']:
        print(f"❌ Node.js service not running: {status_result['stdout']}")
        return False
    
    print("✅ Node.js service is RUNNING")
    
    # Check error logs
    log_result = run_command("tail -n 10 /var/log/supervisor/nodejs.err.log")
    if log_result['success']:
        if log_result['stdout'].strip() == "":
            print("✅ No errors in Node.js error log")
        else:
            print(f"⚠️ Found entries in error log: {log_result['stdout']}")
    
    return True

def test_mongodb_indexes():
    """Test MongoDB indexes for Phase 4"""
    print("🧪 Testing MongoDB Indexes...")
    
    index_check_script = """
require('dotenv').config();
const { MongoClient } = require('mongodb');
(async () => {
  try {
    const client = await MongoClient.connect(process.env.MONGO_URL);
    const db = client.db();
    
    const vpsIndexes = await db.collection('vpsPlansOf').indexes();
    const sshIndexes = await db.collection('sshKeysOf').indexes();
    
    console.log('INDEXES_RESULT:', JSON.stringify({
      vpsPlansOf: vpsIndexes.map(i => i.name),
      sshKeysOf: sshIndexes.map(i => i.name)
    }));
    
    await client.close();
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
})();
"""
    
    result = run_command(f"cd /app && node -e \"{index_check_script}\"")
    
    if result['success']:
        output = result['stdout']
        if "INDEXES_RESULT:" in output:
            # Extract JSON from output
            json_start = output.find("INDEXES_RESULT:") + len("INDEXES_RESULT:")
            json_str = output[json_start:].strip()
            try:
                indexes = json.loads(json_str)
                
                # Check required vpsPlansOf indexes
                required_vps_indexes = ['_id_', 'chatId_1', 'contaboInstanceId_1', 'status_1_end_time_1', 'vpsId_1']
                vps_indexes = indexes.get('vpsPlansOf', [])
                
                missing_vps = [idx for idx in required_vps_indexes if idx not in vps_indexes]
                if missing_vps:
                    print(f"❌ Missing vpsPlansOf indexes: {missing_vps}")
                    return False
                
                # Check required sshKeysOf indexes  
                required_ssh_indexes = ['_id_', 'telegramId_1', 'contaboSecretId_1']
                ssh_indexes = indexes.get('sshKeysOf', [])
                
                missing_ssh = [idx for idx in required_ssh_indexes if idx not in ssh_indexes]
                if missing_ssh:
                    print(f"❌ Missing sshKeysOf indexes: {missing_ssh}")
                    return False
                
                print("✅ All required MongoDB indexes present")
                print(f"   vpsPlansOf: {vps_indexes}")
                print(f"   sshKeysOf: {ssh_indexes}")
                return True
                
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse index result: {e}")
                return False
        else:
            print(f"❌ No index result found in output: {output}")
            return False
    else:
        print(f"❌ MongoDB index check failed: {result['stderr']}")
        return False

def test_code_inspection():
    """Test specific code changes for Phase 4"""
    print("🧪 Testing Code Inspection...")
    
    # Test 1: checkVPSPlansExpiryandPayment function
    print("   Checking checkVPSPlansExpiryandPayment function...")
    result = run_command("cd /app && grep -A 20 'checkVPSPlansExpiryandPayment()' js/_index.js")
    
    if not result['success']:
        print("❌ checkVPSPlansExpiryandPayment function not found")
        return False
    
    # Check for key patterns in the function
    function_content = result['stdout']
    required_patterns = [
        "status.*RUNNING.*running",  # Query for running status
        "end_time.*lte.*now",        # Query for expired plans
        "autoRenewable",             # Auto-renewal logic
        "setMonth.*getMonth.*1",     # 1-month extension
        "EXPIRED"                    # Mark as expired
    ]
    
    missing_patterns = []
    for pattern in required_patterns:
        if not any(pattern.lower() in line.lower() for line in function_content.split('\n')):
            missing_patterns.append(pattern)
    
    if missing_patterns:
        print(f"❌ Missing patterns in checkVPSPlansExpiryandPayment: {missing_patterns}")
        return False
    
    print("✅ checkVPSPlansExpiryandPayment function has required logic")
    
    # Test 2: Monthly-only billing flow
    print("   Checking monthly-only billing flow...")
    result = run_command("cd /app && grep -A 10 -B 5 'Monthly.*skip.*billing.*cycle' js/_index.js")
    
    if result['success'] and "Monthly" in result['stdout']:
        print("✅ Monthly-only billing flow confirmed")
    else:
        print("⚠️ Monthly-only billing flow pattern not clearly found")
    
    # Test 3: Payment method selection for VPS upgrades
    print("   Checking VPS upgrade payment methods...")
    result = run_command("cd /app && grep -A 5 'vps-upgrade-plan-pay' js/_index.js")
    
    if result['success'] and "k.pay" in result['stdout']:
        print("✅ VPS upgrade uses k.pay (all payment methods)")
    else:
        print("❌ VPS upgrade payment method selection not found")
        return False
    
    # Test 4: VPS reminder code using flat schema
    print("   Checking VPS reminder flat schema usage...")
    result = run_command("cd /app && grep -A 10 'entry.chatId.*entry.end_time' js/_index.js")
    
    if result['success']:
        print("✅ VPS reminder code uses flat Contabo schema")
    else:
        # Alternative check
        result2 = run_command("cd /app && grep -A 20 'sendRemindersForExpiringPackages' js/_index.js")
        if result2['success'] and "entry.chatId" in result2['stdout']:
            print("✅ VPS reminder code uses flat Contabo schema")
        else:
            print("❌ VPS reminder flat schema usage not confirmed")
            return False
    
    return True

def main():
    """Main test execution"""
    print("=" * 60)
    print("🚀 Phase 4 Backend Testing - MongoDB + Monthly Billing + Auto-Renewal")
    print("=" * 60)
    
    tests = [
        ("Contabo Service Suite (18 tests)", test_contabo_service_suite),
        ("VM Instance Setup Suite (17 tests)", test_vm_instance_setup_suite), 
        ("JavaScript Syntax Validation", test_syntax_validation),
        ("Service Health Check", test_service_health),
        ("MongoDB Indexes Verification", test_mongodb_indexes),
        ("Code Inspection", test_code_inspection)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        print("-" * 40)
        
        try:
            success = test_func()
            results.append((test_name, success))
            
            if success:
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
                
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 PHASE 4 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status:12} {test_name}")
    
    print("-" * 60)
    print(f"📈 Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL PHASE 4 TESTS PASSED!")
        return True
    else:
        print("⚠️  Some tests failed - review required")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)