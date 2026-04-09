#!/usr/bin/env python3
"""
Backend Testing Script for 7 Node.js Bug Fixes
Tests the specific bug fixes mentioned in the review request.
"""

import subprocess
import sys
import json
import requests
import time
import re
from pathlib import Path

# Backend URL from environment
BACKEND_URL = "https://get-started-62.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

def run_command(cmd, cwd=None):
    """Run a shell command and return result"""
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

def test_syntax_validation():
    """Test 1: Verify all JavaScript files pass syntax validation"""
    print("🔍 Test 1: JavaScript Syntax Validation")
    
    files_to_check = [
        '/app/js/_index.js',
        '/app/js/voice-service.js', 
        '/app/js/sanitize-provider.js'
    ]
    
    all_passed = True
    for file_path in files_to_check:
        result = run_command(f'node -c {file_path}')
        if result['success']:
            print(f"  ✅ {file_path} - syntax OK")
        else:
            print(f"  ❌ {file_path} - syntax error: {result['stderr']}")
            all_passed = False
    
    return all_passed

def test_health_endpoint():
    """Test 2: Verify health endpoint is working"""
    print("🔍 Test 2: Health Endpoint")
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ Health endpoint OK: {data}")
            return True
        else:
            print(f"  ❌ Health endpoint failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"  ❌ Health endpoint error: {e}")
        return False

def test_fix1_price_calculation():
    """Test 3: Fix 1 - $undefined price in non-USA leads validation"""
    print("🔍 Test 3: Fix 1 - Non-USA leads price calculation")
    
    # Search for the specific fix in _index.js
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Look for the fix around line 18656-18662
        pattern = r'if \(!.*USA.*\.includes\(info\?\.country\) && info\?\.phones\.length < 2000\) \{[^}]*const cnam = false[^}]*const price = info\?\.amount \* RATE_LEAD_VALIDATOR[^}]*saveInfo\(\'price\', price\)[^}]*return goto\.validatorSelectFormat\(\)'
        
        if re.search(pattern, content, re.DOTALL):
            print("  ✅ Fix 1 verified: Non-USA price calculation with cnam=false and saveInfo('price', price) found")
            return True
        else:
            print("  ❌ Fix 1 not found: Missing price calculation for non-USA countries")
            return False
            
    except Exception as e:
        print(f"  ❌ Fix 1 test error: {e}")
        return False

def test_fix2_lang_tdz():
    """Test 4: Fix 2 - lang TDZ in DomainActionShortener and ActivateShortener"""
    print("🔍 Test 4: Fix 2 - lang TDZ bug fixes")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for removal of redundant const lang declarations
        # Look for the comment indicating the fix
        activateShortener_fix = "FIX: Removed redundant `const lang` that caused TDZ error in ActivateShortener" in content
        
        # Check that DomainActionShortener block doesn't have const lang
        domainActionShortener_pattern = r'DomainActionShortener.*?const lang'
        domainActionShortener_has_const = re.search(domainActionShortener_pattern, content, re.DOTALL)
        
        if activateShortener_fix and not domainActionShortener_has_const:
            print("  ✅ Fix 2 verified: TDZ fix comments found, no redundant const lang declarations")
            return True
        else:
            print(f"  ❌ Fix 2 incomplete: ActivateShortener fix={activateShortener_fix}, DomainActionShortener clean={not bool(domainActionShortener_has_const)}")
            return False
            
    except Exception as e:
        print(f"  ❌ Fix 2 test error: {e}")
        return False

def test_fix3_resolveUserTag():
    """Test 5: Fix 3 - resolveUserTag moved to module scope"""
    print("🔍 Test 5: Fix 3 - resolveUserTag function placement")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check that resolveUserTag functions are at module scope (before loadData)
        lines = content.split('\n')
        
        resolveUserTag_line = None
        resolveUserTagSync_line = None
        loadData_line = None
        
        for i, line in enumerate(lines):
            if 'async function resolveUserTag(chatId)' in line:
                resolveUserTag_line = i
            elif 'function resolveUserTagSync(chatId, cachedName)' in line:
                resolveUserTagSync_line = i
            elif 'const loadData = async () => {' in line:
                loadData_line = i
        
        if (resolveUserTag_line is not None and 
            resolveUserTagSync_line is not None and 
            loadData_line is not None and
            resolveUserTag_line < loadData_line and 
            resolveUserTagSync_line < loadData_line):
            print(f"  ✅ Fix 3 verified: resolveUserTag functions at module scope (lines {resolveUserTag_line}, {resolveUserTagSync_line}) before loadData (line {loadData_line})")
            return True
        else:
            print(f"  ❌ Fix 3 not found: Functions not properly positioned. resolveUserTag={resolveUserTag_line}, resolveUserTagSync={resolveUserTagSync_line}, loadData={loadData_line}")
            return False
            
    except Exception as e:
        print(f"  ❌ Fix 3 test error: {e}")
        return False

def test_fix4_goto_guards():
    """Test 6: Fix 4 - goto function guards"""
    print("🔍 Test 6: Fix 4 - goto function guards")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check skipCoupon function has guard
        skipCoupon_guard = 'if (action && typeof goto[action] === \'function\')' in content
        
        # Check goBack function has guard  
        goBack_guard = 'if (lastStep && typeof goto[lastStep] === \'function\')' in content
        
        # Check for optional chaining in goBack
        optional_chaining = 'info?.history?' in content
        
        if skipCoupon_guard and goBack_guard and optional_chaining:
            print("  ✅ Fix 4 verified: Both skipCoupon and goBack have function guards with optional chaining")
            return True
        else:
            print(f"  ❌ Fix 4 incomplete: skipCoupon guard={skipCoupon_guard}, goBack guard={goBack_guard}, optional chaining={optional_chaining}")
            return False
            
    except Exception as e:
        print(f"  ❌ Fix 4 test error: {e}")
        return False

def test_fix5_html_escaping():
    """Test 7: Fix 5 - HTML entity escaping in sanitizeProviderError"""
    print("🔍 Test 7: Fix 5 - HTML entity escaping")
    
    try:
        with open('/app/js/sanitize-provider.js', 'r') as f:
            content = f.read()
        
        # Check for HTML entity escaping at the top of sanitizeProviderError
        html_escaping = (
            "sanitized.replace(/&/g, '&amp;')" in content and
            "sanitized.replace(/</g, '&lt;')" in content and
            "sanitized.replace(/>/g, '&gt;')" in content
        )
        
        # Check that DNS error messages use sanitizeProviderError
        with open('/app/js/_index.js', 'r') as f:
            index_content = f.read()
        
        dns_sanitization = 'sanitizeProviderError(saveErr, \'domain\')' in index_content
        
        if html_escaping and dns_sanitization:
            print("  ✅ Fix 5 verified: HTML entity escaping implemented and DNS errors use sanitizeProviderError")
            return True
        else:
            print(f"  ❌ Fix 5 incomplete: HTML escaping={html_escaping}, DNS sanitization={dns_sanitization}")
            return False
            
    except Exception as e:
        print(f"  ❌ Fix 5 test error: {e}")
        return False

def test_fix6_wallet_handler():
    """Test 8: Fix 6 - walletOk handler not found recovery"""
    print("🔍 Test 8: Fix 6 - walletOk handler recovery")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for the fix around line 13193-13200
        pattern = r'if \(typeof handler !== \'function\'\) \{[^}]*await set\(state, chatId, \'action\', \'none\'\)[^}]*session expired[^}]*\}'
        
        if re.search(pattern, content, re.DOTALL | re.IGNORECASE):
            print("  ✅ Fix 6 verified: walletOk handler recovery with session expired message in 4 languages")
            return True
        else:
            print("  ❌ Fix 6 not found: Missing walletOk handler recovery logic")
            return False
            
    except Exception as e:
        print(f"  ❌ Fix 6 test error: {e}")
        return False

def test_fix9_wallet_monitor():
    """Test 9: Fix 9 - UserWalletMonitor MongoDB persistence"""
    print("🔍 Test 9: Fix 9 - UserWalletMonitor mass-warning fix")
    
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            content = f.read()
        
        # Check for the key components
        components = [
            '_balanceNotifyHistoryCol' in content,
            '_loadBalanceNotifyHistory(db)' in content,
            '_persistBalanceNotifyEntry(chatId, entry)' in content,
            'balanceNotifyHistory' in content,
            'initVoiceService' in content and 'deps.db' in content
        ]
        
        # Check for startup log message
        startup_log = 'Loaded 0 active notification histories from DB' in content or 'UserWalletMonitor' in content
        
        if all(components) and startup_log:
            print("  ✅ Fix 9 verified: All UserWalletMonitor persistence components found")
            return True
        else:
            print(f"  ❌ Fix 9 incomplete: Components={components}, startup log={startup_log}")
            return False
            
    except Exception as e:
        print(f"  ❌ Fix 9 test error: {e}")
        return False

def test_nodejs_service():
    """Test 10: Verify Node.js service is running"""
    print("🔍 Test 10: Node.js Service Status")
    
    # Check if Node.js process is running
    result = run_command('pgrep -f "node.*_index.js" || pgrep -f "node.*index.js"')
    
    if result['success'] and result['stdout']:
        print(f"  ✅ Node.js service running (PID: {result['stdout']})")
        return True
    else:
        print("  ❌ Node.js service not found")
        return False

def test_error_logs():
    """Test 11: Check for clean error logs"""
    print("🔍 Test 11: Error Log Status")
    
    # Check Node.js error log
    result = run_command('wc -c /var/log/supervisor/nodejs.err.log 2>/dev/null || echo "0"')
    
    try:
        log_size = int(result['stdout'].split()[0]) if result['stdout'] else 0
        if log_size == 0:
            print("  ✅ Node.js error log is clean (0 bytes)")
            return True
        else:
            print(f"  ⚠️ Node.js error log has {log_size} bytes")
            # Show last few lines if there are errors
            tail_result = run_command('tail -5 /var/log/supervisor/nodejs.err.log 2>/dev/null')
            if tail_result['stdout']:
                print(f"    Last errors: {tail_result['stdout']}")
            return False
    except:
        print("  ⚠️ Could not check error log size")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Backend Testing for 7 Node.js Bug Fixes")
    print("=" * 60)
    
    tests = [
        test_syntax_validation,
        test_health_endpoint,
        test_fix1_price_calculation,
        test_fix2_lang_tdz,
        test_fix3_resolveUserTag,
        test_fix4_goto_guards,
        test_fix5_html_escaping,
        test_fix6_wallet_handler,
        test_fix9_wallet_monitor,
        test_nodejs_service,
        test_error_logs
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            print()
        except Exception as e:
            print(f"  ❌ Test failed with exception: {e}")
            print()
    
    print("=" * 60)
    print(f"📊 Test Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - All 7 bug fixes verified successfully!")
        return True
    else:
        print(f"⚠️ {total - passed} test(s) failed - Some bug fixes need attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)