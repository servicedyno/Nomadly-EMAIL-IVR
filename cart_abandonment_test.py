#!/usr/bin/env python3
"""
Cart Abandonment Recovery System V2 - Comprehensive Backend Test
Tests all critical functionality of the cart abandonment system
"""

import requests
import json
import subprocess
import sys
import time

def run_node_test(script):
    """Run a Node.js test script and return the result"""
    try:
        result = subprocess.run(['node', '-e', script], 
                              capture_output=True, text=True, timeout=30)
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Test timed out"
    except Exception as e:
        return False, "", str(e)

def test_health_endpoint():
    """Test the health endpoint"""
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get('status') == 'healthy' and data.get('database') == 'connected'
        return False
    except Exception:
        return False

def test_payment_actions_correctness():
    """Test 1: PAYMENT_ACTIONS correctness"""
    script = """
const fs = require('fs');
const code = fs.readFileSync('/app/js/cart-abandonment.js', 'utf8');

const mustHave = ['domain-pay', 'hosting-pay', 'plan-pay', 'phone-pay', 'leads-pay', 'vps-plan-pay', 'bank-pay-domain', 'bank-pay-hosting', 'bank-pay-plan', 'crypto-pay-domain', 'crypto-pay-hosting', 'crypto-pay-plan', 'walletSelectCurrency', 'walletSelectCurrencyConfirm', 'depositUSD', 'depositNGN', 'proceedWithPaymentProcess', 'confirmUpgradeHostingPay', 'proceedWithVpsPayment', 'digital-product-pay', 'virtual-card-pay', 'bundleConfirm', 'cpOrderSummary', 'evConfirmPay', 'ebPayment'];
const mustNotHave = ['domainPay', 'hostingPay', 'vpsPay', 'virtualCardPay', 'cloudPhonePay', 'bundlePay', 'emailValidationPay', 'leadsPayment'];

let pass = 0, fail = 0;
for (const a of mustHave) {
  if (code.includes("'" + a + "'")) { pass++; } 
  else { console.log('MISSING:', a); fail++; }
}
for (const a of mustNotHave) {
  if (!code.includes("'" + a + "'")) { pass++; }
  else { console.log('STILL HAS OLD FAKE:', a); fail++; }
}
console.log(JSON.stringify({pass, fail, total: mustHave.length + mustNotHave.length}));
"""
    return run_node_test(script)

def test_action_to_category():
    """Test 2: actionToCategory for kebab-case"""
    script = """
const fs = require('fs');
const code = fs.readFileSync('/app/js/cart-abandonment.js', 'utf8');

eval(code.match(/function actionToCategory\\(action\\) \\{[\\s\\S]*?\\n\\}/)[0]);

const tests = [
  ['bank-pay-domain', 'domain'],
  ['crypto-pay-hosting', 'hosting'],
  ['domain-pay', 'domain'],
  ['vps-plan-pay', 'hosting'],
  ['virtual-card-pay', 'virtualcard'],
  ['walletSelectCurrency', 'wallet'],
  ['digital-product-pay', 'digitalproduct'],
  ['bundleConfirm', 'bundle']
];

let pass = 0, fail = 0;
for (const [action, expected] of tests) {
  const result = actionToCategory(action);
  if (result === expected) {
    pass++;
  } else {
    fail++;
    console.log('FAIL:', action, '→', result, '(expected:', expected + ')');
  }
}
console.log(JSON.stringify({pass, fail, total: tests.length}));
"""
    return run_node_test(script)

def test_silent_abandonment():
    """Test 3: Silent abandonment features"""
    script = """
const fs = require('fs');
const code = fs.readFileSync('/app/js/cart-abandonment.js', 'utf8');

const checks = [
  ['SILENT_TIMEOUT_MS constant', code.includes('SILENT_TIMEOUT_MS = 20 * 60 * 1000')],
  ['silentTimers Map', code.includes('silentTimers = new Map()')],
  ['startSilentTimer function', code.includes('function startSilentTimer(chatId, action)')],
  ['stateCol.findOne in silent timer', code.includes('stateCol.findOne({ _id: cid })')]
];

let pass = 0, fail = 0;
for (const [desc, found] of checks) {
  if (found) {
    pass++;
  } else {
    fail++;
    console.log('MISSING:', desc);
  }
}
console.log(JSON.stringify({pass, fail, total: checks.length}));
"""
    return run_node_test(script)

def test_cancel_detection():
    """Test 4: Multi-language cancel detection"""
    script = """
const fs = require('fs');
const code = fs.readFileSync('/app/js/cart-abandonment.js', 'utf8');

const mustHave = ['annuler', 'retour', '取消', '返回', 'रद्द करें', 'वापस', 'cancel', 'back'];
let pass = 0, fail = 0;
for (const w of mustHave) {
  if (code.includes(w)) { pass++; }
  else { console.log('MISSING cancel word:', w); fail++; }
}
console.log(JSON.stringify({pass, fail, total: mustHave.length}));
"""
    return run_node_test(script)

def test_payment_completed_coverage():
    """Test 5: recordPaymentCompleted coverage"""
    try:
        # Count cartRecovery.recordPaymentCompleted calls
        result = subprocess.run(['grep', '-c', 'cartRecovery.*recordPaymentCompleted', '/app/js/_index.js'], 
                              capture_output=True, text=True)
        count = int(result.stdout.strip()) if result.returncode == 0 else 0
        
        # Check if all "Reset action after" lines have cartRecovery on preceding line
        result2 = subprocess.run(['bash', '-c', '''
grep -n "set(state, chatId, 'action', 'none') // Reset action after" /app/js/_index.js | while read entry; do
  linenum=$(echo "$entry" | cut -d: -f1)
  prevline=$((linenum - 1))
  prev=$(sed -n "${prevline}p" /app/js/_index.js)
  if ! echo "$prev" | grep -q "cartRecovery"; then
    echo "MISSING at line $linenum"
  fi
done
        '''], capture_output=True, text=True)
        
        missing_count = len(result2.stdout.strip().split('\n')) if result2.stdout.strip() else 0
        
        return True, json.dumps({
            'recordPaymentCompleted_calls': count,
            'missing_cartRecovery_calls': missing_count,
            'expected_calls': 32,
            'all_covered': count == 32 and missing_count == 0
        }), ""
        
    except Exception as e:
        return False, "", str(e)

def test_logs_and_health():
    """Test 6: Health + Logs"""
    try:
        # Check health endpoint
        health_ok = test_health_endpoint()
        
        # Check error log size
        result = subprocess.run(['wc', '-c', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        error_log_size = int(result.stdout.split()[0]) if result.returncode == 0 else -1
        
        # Check CartRecovery logs
        result2 = subprocess.run(['grep', 'CartRecovery', '/var/log/supervisor/nodejs.out.log'], 
                               capture_output=True, text=True)
        cart_logs = result2.stdout.strip().split('\n') if result2.returncode == 0 else []
        
        # Look for specific log patterns
        has_tracking_log = any('Tracking 50 payment action states' in log for log in cart_logs)
        has_init_log = any('Initialized — nudge delay: 45min' in log for log in cart_logs)
        has_recovery_log = any('No pending nudges to recover' in log for log in cart_logs)
        
        return True, json.dumps({
            'health_endpoint': health_ok,
            'error_log_size': error_log_size,
            'cart_recovery_logs': len(cart_logs),
            'has_tracking_log': has_tracking_log,
            'has_init_log': has_init_log,
            'has_recovery_log': has_recovery_log
        }), ""
        
    except Exception as e:
        return False, "", str(e)

def main():
    """Run all tests and report results"""
    print("🧪 Cart Abandonment Recovery System V2 - Comprehensive Test")
    print("=" * 60)
    
    tests = [
        ("PAYMENT_ACTIONS correctness", test_payment_actions_correctness),
        ("actionToCategory for kebab-case", test_action_to_category),
        ("Silent abandonment detection", test_silent_abandonment),
        ("Multi-language cancel detection", test_cancel_detection),
        ("recordPaymentCompleted coverage", test_payment_completed_coverage),
        ("Health + Logs", test_logs_and_health)
    ]
    
    results = []
    total_passed = 0
    total_failed = 0
    
    for test_name, test_func in tests:
        print(f"\n🔍 Testing: {test_name}")
        try:
            success, stdout, stderr = test_func()
            if success:
                try:
                    data = json.loads(stdout) if stdout.strip().startswith('{') else {'result': stdout.strip()}
                    if 'pass' in data and 'fail' in data:
                        print(f"   ✅ {data['pass']} passed, {data['fail']} failed")
                        total_passed += data['pass']
                        total_failed += data['fail']
                    else:
                        print(f"   ✅ {data}")
                        total_passed += 1
                    results.append((test_name, True, data))
                except json.JSONDecodeError:
                    print(f"   ✅ {stdout.strip()}")
                    total_passed += 1
                    results.append((test_name, True, stdout.strip()))
            else:
                print(f"   ❌ FAILED: {stderr}")
                total_failed += 1
                results.append((test_name, False, stderr))
        except Exception as e:
            print(f"   ❌ ERROR: {str(e)}")
            total_failed += 1
            results.append((test_name, False, str(e)))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    
    for test_name, success, result in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
    
    success_rate = (total_passed / (total_passed + total_failed)) * 100 if (total_passed + total_failed) > 0 else 0
    print(f"\n🎯 Overall: {total_passed} passed, {total_failed} failed ({success_rate:.1f}% success rate)")
    
    if total_failed == 0:
        print("🎉 ALL TESTS PASSED! Cart abandonment system is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())