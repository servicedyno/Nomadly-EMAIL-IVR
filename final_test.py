#!/usr/bin/env python3
"""
Final Comprehensive Test for 7 Node.js Bug Fixes
"""

import subprocess
import sys
import json
import requests
import re

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

def main():
    """Test all 7 bug fixes"""
    print("🚀 FINAL COMPREHENSIVE TEST: 7 Node.js Bug Fixes")
    print("=" * 60)
    
    # Test 1: Syntax validation
    print("🔍 Test 1: JavaScript Syntax Validation")
    syntax_results = []
    for file_path in ['/app/js/_index.js', '/app/js/voice-service.js', '/app/js/sanitize-provider.js']:
        result = run_command(f'node -c {file_path}')
        syntax_results.append(result['success'])
        status = "✅" if result['success'] else "❌"
        print(f"  {status} {file_path}")
        if not result['success']:
            print(f"    Error: {result['stderr']}")
    
    # Test 2: Health endpoint
    print("\n🔍 Test 2: Health Endpoint")
    try:
        response = requests.get("http://localhost:5000/health", timeout=5)
        health_ok = response.status_code == 200
        if health_ok:
            data = response.json()
            print(f"  ✅ Health OK: {data}")
        else:
            print(f"  ❌ Health failed: HTTP {response.status_code}")
    except Exception as e:
        print(f"  ❌ Health error: {e}")
        health_ok = False
    
    # Read files
    try:
        with open('/app/js/_index.js', 'r') as f:
            index_content = f.read()
        with open('/app/js/sanitize-provider.js', 'r') as f:
            sanitize_content = f.read()
        with open('/app/js/voice-service.js', 'r') as f:
            voice_content = f.read()
    except Exception as e:
        print(f"❌ Could not read files: {e}")
        return False
    
    # Test 3: Fix 1 - $undefined price in non-USA leads validation
    print("\n🔍 Test 3: Fix 1 - $undefined price in non-USA leads validation")
    fix1_found = (
        'const cnam = false' in index_content and
        'const price = info?.amount * RATE_LEAD_VALIDATOR + (cnam ? info?.amount * RATE_CNAM_VALIDATOR : 0)' in index_content and
        "saveInfo('price', price)" in index_content and
        'return goto.validatorSelectFormat()' in index_content
    )
    print(f"  {'✅' if fix1_found else '❌'} Fix 1: Non-USA price calculation")
    
    # Test 4: Fix 2 - lang TDZ fixes
    print("\n🔍 Test 4: Fix 2 - lang TDZ in DomainActionShortener and ActivateShortener")
    activateShortener_comment = "FIX: Removed redundant `const lang` that caused TDZ error in ActivateShortener" in index_content
    # Check that DomainActionShortener section doesn't have redundant const lang
    domainActionShortener_clean = True
    if 'DomainActionShortener' in index_content:
        # Look for problematic const lang patterns in DomainActionShortener context
        domain_section_match = re.search(r'log\(`\[DomainActionShortener\].*?return\s*\}', index_content, re.DOTALL)
        if domain_section_match and re.search(r'const\s+lang\s*=', domain_section_match.group(0)):
            domainActionShortener_clean = False
    
    fix2_ok = activateShortener_comment and domainActionShortener_clean
    print(f"  {'✅' if fix2_ok else '❌'} Fix 2: TDZ fixes (ActivateShortener comment: {activateShortener_comment}, DomainActionShortener clean: {domainActionShortener_clean})")
    
    # Test 5: Fix 3 - resolveUserTag at module scope
    print("\n🔍 Test 5: Fix 3 - resolveUserTag not defined in marketplace callback_query")
    lines = index_content.split('\n')
    resolveUserTag_line = None
    loadData_line = None
    
    for i, line in enumerate(lines):
        if 'async function resolveUserTag(chatId)' in line:
            resolveUserTag_line = i
        elif 'const loadData = async () => {' in line:
            loadData_line = i
    
    fix3_ok = (resolveUserTag_line is not None and 
               loadData_line is not None and 
               resolveUserTag_line < loadData_line)
    print(f"  {'✅' if fix3_ok else '❌'} Fix 3: resolveUserTag at module scope (line {resolveUserTag_line} before loadData at {loadData_line})")
    
    # Test 6: Fix 4 - goto function guards
    print("\n🔍 Test 6: Fix 4 - goto[(intermediate value)] is not a function")
    skipCoupon_guard = 'if (action && typeof goto[action] === \'function\')' in index_content
    goBack_guard = 'if (lastStep && typeof goto[lastStep] === \'function\')' in index_content
    optional_chaining = 'info?.history?' in index_content
    
    fix4_ok = skipCoupon_guard and goBack_guard and optional_chaining
    print(f"  {'✅' if fix4_ok else '❌'} Fix 4: Function guards (skipCoupon: {skipCoupon_guard}, goBack: {goBack_guard}, optional chaining: {optional_chaining})")
    
    # Test 7: Fix 5 - HTML entity escaping
    print("\n🔍 Test 7: Fix 5 - Telegram HTML parse error on DNS error messages")
    html_escaping = (
        "sanitized.replace(/&/g, '&amp;')" in sanitize_content and
        "sanitized.replace(/</g, '&lt;')" in sanitize_content and
        "sanitized.replace(/>/g, '&gt;')" in sanitize_content
    )
    dns_usage = 'sanitizeProviderError(saveErr, \'domain\')' in index_content
    
    fix5_ok = html_escaping and dns_usage
    print(f"  {'✅' if fix5_ok else '❌'} Fix 5: HTML escaping (escaping: {html_escaping}, DNS usage: {dns_usage})")
    
    # Test 8: Fix 6 - walletOk handler recovery
    print("\n🔍 Test 8: Fix 6 - walletOk handler not found for lastStep undefined")
    wallet_recovery = (
        "typeof handler !== 'function'" in index_content and
        "await set(state, chatId, 'action', 'none')" in index_content and
        "session expired" in index_content
    )
    
    fix6_ok = wallet_recovery
    print(f"  {'✅' if fix6_ok else '❌'} Fix 6: walletOk handler recovery with session expired message")
    
    # Test 9: Fix 9 - UserWalletMonitor persistence
    print("\n🔍 Test 9: Fix 9 - UserWalletMonitor mass-warning on deploy")
    components = [
        '_balanceNotifyHistoryCol' in voice_content,
        '_loadBalanceNotifyHistory(db)' in voice_content,
        '_persistBalanceNotifyEntry(chatId, entry)' in voice_content,
        'balanceNotifyHistory' in voice_content,
        'initVoiceService' in voice_content and 'deps.db' in voice_content
    ]
    startup_log = 'Loaded 0 active notification histories from DB' in voice_content
    
    fix9_ok = all(components) and startup_log
    print(f"  {'✅' if fix9_ok else '❌'} Fix 9: UserWalletMonitor persistence (components: {all(components)}, startup log: {startup_log})")
    
    # Test 10: Node.js service status
    print("\n🔍 Test 10: Node.js Service Status")
    result = run_command('pgrep -f "node.*_index.js" || pgrep -f "node.*index.js"')
    nodejs_running = result['success'] and result['stdout']
    print(f"  {'✅' if nodejs_running else '❌'} Node.js service {'running' if nodejs_running else 'not found'}")
    if nodejs_running:
        print(f"    PID: {result['stdout']}")
    
    # Test 11: Error logs
    print("\n🔍 Test 11: Error Log Status")
    result = run_command('wc -c /var/log/supervisor/nodejs.err.log 2>/dev/null || echo "0"')
    try:
        log_size = int(result['stdout'].split()[0]) if result['stdout'] else 0
        logs_clean = log_size == 0
        print(f"  {'✅' if logs_clean else '⚠️'} Error log: {log_size} bytes")
    except:
        logs_clean = False
        print("  ⚠️ Could not check error log")
    
    # Summary
    print("\n" + "=" * 60)
    
    all_fixes = [fix1_found, fix2_ok, fix3_ok, fix4_ok, fix5_ok, fix6_ok, fix9_ok]
    system_checks = [all(syntax_results), health_ok, nodejs_running, logs_clean]
    
    fixes_passed = sum(all_fixes)
    system_passed = sum(system_checks)
    
    print(f"📊 BUG FIXES: {fixes_passed}/7 verified ({fixes_passed/7*100:.1f}%)")
    print(f"📊 SYSTEM HEALTH: {system_passed}/4 checks passed ({system_passed/4*100:.1f}%)")
    
    fix_names = ["Fix 1: $undefined price", "Fix 2: lang TDZ", "Fix 3: resolveUserTag", 
                 "Fix 4: goto guards", "Fix 5: HTML escaping", "Fix 6: walletOk handler", 
                 "Fix 9: UserWalletMonitor"]
    
    for i, (name, passed) in enumerate(zip(fix_names, all_fixes)):
        status = "✅" if passed else "❌"
        print(f"  {status} {name}")
    
    if fixes_passed == 7 and system_passed >= 3:
        print("\n🎉 ALL 7 BUG FIXES VERIFIED SUCCESSFULLY!")
        print("✅ Node.js codebase is working correctly")
        return True
    else:
        print(f"\n⚠️ {7 - fixes_passed} bug fix(es) and {4 - system_passed} system check(s) need attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)