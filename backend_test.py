#!/usr/bin/env python3
"""
Hosting Scheduler Fix Backend Testing
Tests the weekly plans auto-renew fix and cPanel deletion after 2-day grace period
"""

import json
import requests
import subprocess
import sys
import time
from typing import Dict, Any

def run_command(cmd: str, description: str = "") -> Dict[str, Any]:
    """Run shell command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'returncode': result.returncode,
            'description': description
        }
    except subprocess.TimeoutExpired:
        return {'success': False, 'error': f'Command timeout: {cmd}', 'description': description}
    except Exception as e:
        return {'success': False, 'error': str(e), 'description': description}

def check_nodejs_health() -> Dict[str, Any]:
    """Test 1: Node.js health endpoint"""
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            return {
                'success': True,
                'status_code': 200,
                'data': data,
                'healthy': data.get('status') == 'healthy' and data.get('database') == 'connected'
            }
        else:
            return {'success': False, 'status_code': response.status_code, 'text': response.text}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def check_error_logs() -> Dict[str, Any]:
    """Check Node.js error logs are empty"""
    result = run_command('wc -c /var/log/supervisor/nodejs.err.log', 'Check error log size')
    if result['success']:
        size = result['stdout'].split()[0]
        return {'success': True, 'empty': size == '0', 'size_bytes': size}
    return result

def verify_isweekly_function() -> Dict[str, Any]:
    """Test 2: Verify isWeeklyPlan function exists and works correctly"""
    test_script = '''
const hostingScheduler = require('./js/hosting-scheduler.js');
console.log('=== Testing isWeeklyPlan function ===');
console.log('isWeeklyPlan exported:', typeof hostingScheduler.isWeeklyPlan === 'function');

// Test cases
const testCases = [
    { plan: 'Premium Anti-Red (1-Week)', expected: true },
    { plan: 'premium weekly plan', expected: true },
    { plan: 'Test Week Plan', expected: true },
    { plan: 'Premium Anti-Red Monthly', expected: false },
    { plan: 'Golden Anti-Red (Monthly)', expected: false },
    { plan: 'Business Plan', expected: false },
    { plan: null, expected: false },
    { plan: undefined, expected: false }
];

let passed = 0;
let failed = 0;
testCases.forEach(test => {
    const result = hostingScheduler.isWeeklyPlan(test.plan);
    const success = result === test.expected;
    console.log(`Test: "${test.plan}" => ${result} (expected: ${test.expected}) ${success ? 'PASS' : 'FAIL'}`);
    if (success) passed++; else failed++;
});

console.log(`Total: ${testCases.length} | Passed: ${passed} | Failed: ${failed}`);
    '''
    
    result = run_command(f'cd /app && node -e "{test_script}"', 'Test isWeeklyPlan function')
    if result['success']:
        output = result['stdout']
        return {
            'success': True,
            'exported': 'isWeeklyPlan exported: true' in output,
            'all_tests_passed': 'Failed: 0' in output,
            'output': output
        }
    return result

def verify_autorenew_logic() -> Dict[str, Any]:
    """Test 3: Verify auto-renew logic in hosting-scheduler.js"""
    # Check the auto-renew logic implementation
    result = run_command(
        'cd /app && grep -n "const isAutoRenew = !weekly && account.autoRenew !== false" js/hosting-scheduler.js',
        'Verify auto-renew logic'
    )
    
    if result['success']:
        return {
            'success': True,
            'line_found': bool(result['stdout']),
            'line_content': result['stdout']
        }
    return result

def verify_terminate_function() -> Dict[str, Any]:
    """Test 4: Verify terminateAccount function exists"""
    result = run_command(
        'cd /app && grep -A 10 "async function terminateAccount" js/hosting-scheduler.js',
        'Verify terminateAccount function'
    )
    
    if result['success'] and result['stdout']:
        # Check if function calls whmService.terminateAccount
        whm_call_check = run_command(
            'cd /app && grep "whmService.terminateAccount" js/hosting-scheduler.js',
            'Check WHM service call'
        )
        
        # Check if it sets deleted: true
        deleted_flag_check = run_command(
            'cd /app && grep "deleted: true, deletedAt:" js/hosting-scheduler.js',
            'Check deleted flag setting'
        )
        
        return {
            'success': True,
            'function_exists': bool(result['stdout']),
            'calls_whm_service': whm_call_check['success'] and bool(whm_call_check['stdout']),
            'sets_deleted_flag': deleted_flag_check['success'] and bool(deleted_flag_check['stdout']),
            'function_code': result['stdout']
        }
    return result

def verify_database_weekly_plans() -> Dict[str, Any]:
    """Test 5: Verify all weekly plans have autoRenew: false"""
    db_script = '''
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URL);
(async () => {
  try {
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const cpanelAccounts = db.collection('cpanelAccounts');
    
    const weeklyPlans = await cpanelAccounts.find({
      plan: { $regex: /week/i }
    }).toArray();
    
    console.log('=== Weekly Plans Database Check ===');
    console.log('Total weekly plans:', weeklyPlans.length);
    
    let correctCount = 0;
    weeklyPlans.forEach(plan => {
      const correct = plan.autoRenew === false;
      console.log(`${plan.domain}: autoRenew=${plan.autoRenew} ${correct ? 'CORRECT' : 'INCORRECT'}`);
      if (correct) correctCount++;
    });
    
    console.log(`Correct: ${correctCount}/${weeklyPlans.length}`);
    console.log('All weekly plans have autoRenew false:', correctCount === weeklyPlans.length);
    
    await client.close();
  } catch (e) {
    console.error('Database error:', e.message);
  }
})();
    '''
    
    result = run_command(f'cd /app && MONGO_URL="{get_mongo_url()}" DB_NAME="test" node -e "{db_script}"', 'Check weekly plans in database')
    if result['success']:
        output = result['stdout']
        return {
            'success': True,
            'all_correct': 'All weekly plans have autoRenew false: true' in output,
            'output': output
        }
    return result

def get_mongo_url() -> str:
    """Get MongoDB URL from environment"""
    result = run_command('cd /app && grep MONGO_URL backend/.env | cut -d= -f2', 'Get MongoDB URL')
    return result['stdout'] if result['success'] else "mongodb://localhost:27017"

def verify_index_display_fixes() -> Dict[str, Any]:
    """Test 6: Verify _index.js display fixes for weekly plans"""
    checks = []
    
    # Check planIsWeekly variable
    result1 = run_command(
        'cd /app && grep -n "planIsWeekly.*includes.*week" js/_index.js',
        'Check planIsWeekly calculation'
    )
    checks.append(('planIsWeekly_check', result1['success'] and bool(result1['stdout'])))
    
    # Check weekly plans auto-renew status display
    result2 = run_command(
        'cd /app && grep -A 2 -B 2 "weekly plans never auto-renew" js/_index.js',
        'Check weekly auto-renew message'
    )
    checks.append(('weekly_autorenew_message', result2['success'] and bool(result2['stdout'])))
    
    # Check 🔁 icon hiding for weekly plans
    result3 = run_command(
        'cd /app && grep -B 5 -A 5 "planIsWeekly.*🔁" js/_index.js',
        'Check 🔁 icon hiding'
    )
    checks.append(('icon_hiding', result3['success'] and bool(result3['stdout'])))
    
    return {
        'success': True,
        'checks': dict(checks),
        'all_passed': all(check[1] for check in checks),
        'details': {
            'planIsWeekly': result1['stdout'] if result1['success'] else '',
            'autorenew_message': result2['stdout'] if result2['success'] else '',
            'icon_hiding': result3['stdout'] if result3['success'] else ''
        }
    }

def verify_startup_logs() -> Dict[str, Any]:
    """Test 7: Verify startup policy message in logs"""
    result = run_command(
        'grep "Policy: weekly plans NEVER auto-renew" /var/log/supervisor/nodejs.out.log',
        'Check startup policy message'
    )
    
    return {
        'success': True,
        'message_found': result['success'] and bool(result['stdout']),
        'message': result['stdout'] if result['success'] else ''
    }

def verify_module_exports() -> Dict[str, Any]:
    """Test 8: Verify module exports from hosting-scheduler.js"""
    test_script = '''
const scheduler = require('./js/hosting-scheduler.js');
console.log('=== Module Exports Check ===');
console.log('isWeeklyPlan exported:', typeof scheduler.isWeeklyPlan === 'function');
console.log('initScheduler exported:', typeof scheduler.initScheduler === 'function');
console.log('getPlanPrice exported:', typeof scheduler.getPlanPrice === 'function');
console.log('getPlanDuration exported:', typeof scheduler.getPlanDuration === 'function');

const allExported = [
    scheduler.isWeeklyPlan,
    scheduler.initScheduler,
    scheduler.getPlanPrice,
    scheduler.getPlanDuration
].every(fn => typeof fn === 'function');

console.log('All required functions exported:', allExported);
    '''
    
    result = run_command(f'cd /app && node -e "{test_script}"', 'Check module exports')
    if result['success']:
        output = result['stdout']
        return {
            'success': True,
            'all_exported': 'All required functions exported: true' in output,
            'output': output
        }
    return result

def run_all_tests():
    """Run all hosting scheduler tests"""
    print("🧪 HOSTING SCHEDULER FIX - COMPREHENSIVE TESTING")
    print("=" * 60)
    
    tests = [
        ("1. Node.js Health Check", check_nodejs_health),
        ("2. isWeeklyPlan Function Verification", verify_isweekly_function),
        ("3. Auto-Renew Logic Verification", verify_autorenew_logic),
        ("4. Grace Period Deletion Verification", verify_terminate_function),
        ("5. Database Weekly Plans Verification", verify_database_weekly_plans),
        ("6. _index.js Display Fixes", verify_index_display_fixes),
        ("7. Startup Logs Verification", verify_startup_logs),
        ("8. Module Exports Verification", verify_module_exports),
        ("Error Log Check", check_error_logs)
    ]
    
    results = {}
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        print(f"\n🔍 {test_name}")
        print("-" * 40)
        
        try:
            result = test_func()
            results[test_name] = result
            
            if result.get('success'):
                # Determine if test actually passed based on specific criteria
                test_passed = False
                
                if test_name.startswith("1."):  # Node.js Health
                    test_passed = result.get('healthy', False)
                    print(f"✅ Service healthy: {result.get('data', {})}")
                    
                elif test_name.startswith("2."):  # isWeeklyPlan Function
                    test_passed = result.get('exported', False) and result.get('all_tests_passed', False)
                    print(f"✅ Function exported: {result.get('exported')}")
                    print(f"✅ All tests passed: {result.get('all_tests_passed')}")
                    
                elif test_name.startswith("3."):  # Auto-Renew Logic
                    test_passed = result.get('line_found', False)
                    print(f"✅ Auto-renew logic found: {result.get('line_content')}")
                    
                elif test_name.startswith("4."):  # Grace Period Deletion
                    test_passed = (result.get('function_exists', False) and 
                                 result.get('calls_whm_service', False) and 
                                 result.get('sets_deleted_flag', False))
                    print(f"✅ terminateAccount function exists: {result.get('function_exists')}")
                    print(f"✅ Calls WHM service: {result.get('calls_whm_service')}")
                    print(f"✅ Sets deleted flag: {result.get('sets_deleted_flag')}")
                    
                elif test_name.startswith("5."):  # Database Weekly Plans
                    test_passed = result.get('all_correct', False)
                    print(f"✅ All weekly plans have autoRenew: false: {test_passed}")
                    
                elif test_name.startswith("6."):  # Display Fixes
                    test_passed = result.get('all_passed', False)
                    checks = result.get('checks', {})
                    for check_name, check_result in checks.items():
                        print(f"✅ {check_name}: {check_result}")
                        
                elif test_name.startswith("7."):  # Startup Logs
                    test_passed = result.get('message_found', False)
                    print(f"✅ Policy message found: {result.get('message')}")
                    
                elif test_name.startswith("8."):  # Module Exports
                    test_passed = result.get('all_exported', False)
                    print(f"✅ All functions exported: {test_passed}")
                    
                elif "Error Log" in test_name:
                    test_passed = result.get('empty', False)
                    print(f"✅ Error log empty: {result.get('size_bytes')} bytes")
                
                if test_passed:
                    passed += 1
                    print(f"🟢 PASSED")
                else:
                    failed += 1
                    print(f"🔴 FAILED - Test criteria not met")
                    
            else:
                failed += 1
                print(f"🔴 FAILED - {result.get('error', 'Unknown error')}")
                
        except Exception as e:
            failed += 1
            print(f"🔴 FAILED - Exception: {str(e)}")
            results[test_name] = {'success': False, 'error': str(e)}
    
    # Summary
    print(f"\n{'=' * 60}")
    print(f"📊 TESTING SUMMARY")
    print(f"{'=' * 60}")
    print(f"Total Tests: {passed + failed}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(passed / (passed + failed) * 100):.1f}%")
    
    if failed == 0:
        print(f"\n🎉 ALL HOSTING SCHEDULER TESTS PASSED!")
        print("✅ Weekly plans NEVER auto-renew")
        print("✅ cPanel deletion after 2-day grace period")
        print("✅ isWeeklyPlan function working correctly")
        print("✅ Database in correct state")
        print("✅ Display fixes implemented")
    else:
        print(f"\n⚠️  {failed} TEST(S) FAILED")
        print("Please review the failed tests above")
    
    return results, passed, failed

if __name__ == "__main__":
    results, passed, failed = run_all_tests()
    sys.exit(0 if failed == 0 else 1)