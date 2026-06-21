#!/usr/bin/env python3
"""
Targeted Backend Testing for 7 Node.js Bug Fixes
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

def test_all_fixes():
    """Test all 7 bug fixes comprehensively"""
    print("🚀 Testing 7 Node.js Bug Fixes")
    print("=" * 50)
    
    results = {}
    
    # Test 1: Syntax validation
    print("🔍 Test 1: Syntax Validation")
    syntax_ok = True
    for file_path in ['/app/js/_index.js', '/app/js/voice-service.js', '/app/js/sanitize-provider.js']:
        result = run_command(f'node -c {file_path}')
        if not result['success']:
            print(f"  ❌ {file_path}: {result['stderr']}")
            syntax_ok = False
        else:
            print(f"  ✅ {file_path}: OK")
    results['syntax'] = syntax_ok
    
    # Test 2: Health endpoint
    print("\n🔍 Test 2: Health Endpoint")
    try:
        response = requests.get("http://localhost:5000/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"  ✅ Health OK: {data}")
            results['health'] = True
        else:
            print(f"  ❌ Health failed: HTTP {response.status_code}")
            results['health'] = False
    except Exception as e:
        print(f"  ❌ Health error: {e}")
        results['health'] = False
    
    # Read the main file once
    try:
        with open('/app/js/_index.js', 'r') as f:
            index_content = f.read()
    except Exception as e:
        print(f"❌ Could not read _index.js: {e}")
        return False
    
    # Test 3: Fix 1 - $undefined price in non-USA leads validation
    print("\n🔍 Test 3: Fix 1 - Non-USA price calculation")
    fix1_pattern = r'if \(!.*USA.*\.includes\(info\?\.country\) && info\?\.phones\.length < 2000\) \{[^}]*const cnam = false[^}]*const price = info\?\.amount \* RATE_LEAD_VALIDATOR[^}]*saveInfo\(\'price\', price\)[^}]*return goto\.validatorSelectFormat\(\)'
    if re.search(fix1_pattern, index_content, re.DOTALL):
        print("  ✅ Fix 1: Non-USA price calculation found")
        results['fix1'] = True
    else:
        print("  ❌ Fix 1: Missing non-USA price calculation")
        results['fix1'] = False
    
    # Test 4: Fix 2 - lang TDZ fixes
    print("\n🔍 Test 4: Fix 2 - lang TDZ fixes")
    # Check for the fix comment in ActivateShortener
    activateShortener_fix = "FIX: Removed redundant `const lang` that caused TDZ error in ActivateShortener" in index_content
    
    # Check DomainActionShortener section doesn't have redundant const lang
    # Look for the section and verify no const lang inside it
    domainActionShortener_section = re.search(r'log\(`\[DomainActionShortener\].*?return\s*\}', index_content, re.DOTALL)
    domainActionShortener_clean = True
    if domainActionShortener_section:
        section_text = domainActionShortener_section.group(0)
        # Check if there's a const lang declaration in this section
        if re.search(r'const\s+lang\s*=', section_text):
            domainActionShortener_clean = False
    
    if activateShortener_fix and domainActionShortener_clean:
        print("  ✅ Fix 2: TDZ fixes verified")
        results['fix2'] = True
    else:
        print(f"  ❌ Fix 2: ActivateShortener={activateShortener_fix}, DomainActionShortener clean={domainActionShortener_clean}")
        results['fix2'] = False
    
    # Test 5: Fix 3 - resolveUserTag at module scope
    print("\n🔍 Test 5: Fix 3 - resolveUserTag placement")
    lines = index_content.split('\n')
    resolveUserTag_line = None
    loadData_line = None
    
    for i, line in enumerate(lines):
        if 'async function resolveUserTag(chatId)' in line:
            resolveUserTag_line = i
        elif 'const loadData = async () => {' in line:
            loadData_line = i
    
    if resolveUserTag_line is not None and loadData_line is not None and resolveUserTag_line < loadData_line:
        print(f"  ✅ Fix 3: resolveUserTag at line {resolveUserTag_line}, before loadData at {loadData_line}")
        results['fix3'] = True
    else:
        print(f"  ❌ Fix 3: resolveUserTag={resolveUserTag_line}, loadData={loadData_line}")
        results['fix3'] = False
    
    # Test 6: Fix 4 - goto function guards
    print("\n🔍 Test 6: Fix 4 - goto function guards")
    skipCoupon_guard = 'if (action && typeof goto[action] === \'function\')' in index_content
    goBack_guard = 'if (lastStep && typeof goto[lastStep] === \'function\')' in index_content
    
    if skipCoupon_guard and goBack_guard:
        print("  ✅ Fix 4: Function guards found")
        results['fix4'] = True
    else:
        print(f"  ❌ Fix 4: skipCoupon guard={skipCoupon_guard}, goBack guard={goBack_guard}")
        results['fix4'] = False
    
    # Test 7: Fix 5 - HTML entity escaping
    print("\n🔍 Test 7: Fix 5 - HTML entity escaping")
    try:
        with open('/app/js/sanitize-provider.js', 'r') as f:
            sanitize_content = f.read()
        
        html_escaping = (
            "sanitized.replace(/&/g, '&amp;')" in sanitize_content and
            "sanitized.replace(/</g, '&lt;')" in sanitize_content and
            "sanitized.replace(/>/g, '&gt;')" in sanitize_content
        )
        
        dns_usage = 'sanitizeProviderError(saveErr, \'domain\')' in index_content
        
        if html_escaping and dns_usage:
            print("  ✅ Fix 5: HTML escaping and DNS usage verified")
            results['fix5'] = True
        else:
            print(f"  ❌ Fix 5: HTML escaping={html_escaping}, DNS usage={dns_usage}")
            results['fix5'] = False
    except Exception as e:
        print(f"  ❌ Fix 5: Error reading sanitize-provider.js: {e}")
        results['fix5'] = False
    
    # Test 8: Fix 6 - walletOk handler recovery
    print("\n🔍 Test 8: Fix 6 - walletOk handler recovery")
    # Look for the specific pattern around the fix
    wallet_fix_pattern = r'if \(typeof handler !== \'function\'\) \{[^}]*await set\(state, chatId, \'action\', \'none\'\)[^}]*session expired'
    if re.search(wallet_fix_pattern, index_content, re.DOTALL | re.IGNORECASE):
        print("  ✅ Fix 6: walletOk handler recovery found")
        results['fix6'] = True
    else:
        print("  ❌ Fix 6: walletOk handler recovery not found")
        results['fix6'] = False
    
    # Test 9: Fix 9 - UserWalletMonitor persistence
    print("\n🔍 Test 9: Fix 9 - UserWalletMonitor persistence")
    try:
        with open('/app/js/voice-service.js', 'r') as f:
            voice_content = f.read()
        
        components = [
            '_balanceNotifyHistoryCol' in voice_content,
            '_loadBalanceNotifyHistory(db)' in voice_content,
            '_persistBalanceNotifyEntry(chatId, entry)' in voice_content,
            'balanceNotifyHistory' in voice_content
        ]
        
        if all(components):
            print("  ✅ Fix 9: UserWalletMonitor persistence components found")
            results['fix9'] = True
        else:
            print(f"  ❌ Fix 9: Missing components: {components}")
            results['fix9'] = False
    except Exception as e:
        print(f"  ❌ Fix 9: Error reading voice-service.js: {e}")
        results['fix9'] = False
    
    # Summary
    print("\n" + "=" * 50)
    passed = sum(results.values())
    total = len(results)
    print(f"📊 Results: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    for test, result in results.items():
        status = "✅" if result else "❌"
        print(f"  {status} {test}")
    
    if passed == total:
        print("\n🎉 ALL FIXES VERIFIED SUCCESSFULLY!")
        return True
    else:
        print(f"\n⚠️ {total - passed} fix(es) need attention")
        return False

if __name__ == "__main__":
    success = test_all_fixes()
    sys.exit(0 if success else 1)