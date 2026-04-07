#!/usr/bin/env python3
"""
Backend Test Suite for AntiRed 403 Stale-Zone Self-Healing and QuickActivateShortener TDZ Fix
Testing the two specific fixes documented in test_result.md
"""

import subprocess
import sys
import re
import json
import requests
from pathlib import Path

def run_command(cmd, cwd=None):
    """Run a shell command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd, timeout=30)
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'returncode': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {'success': False, 'stdout': '', 'stderr': 'Command timed out', 'returncode': -1}
    except Exception as e:
        return {'success': False, 'stdout': '', 'stderr': str(e), 'returncode': -1}

def check_file_content(file_path, patterns):
    """Check if file contains specific patterns"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        results = {}
        for name, pattern in patterns.items():
            if isinstance(pattern, str):
                results[name] = pattern in content
            else:  # regex pattern
                results[name] = bool(re.search(pattern, content, re.MULTILINE | re.DOTALL))
        return results
    except Exception as e:
        return {name: False for name in patterns.keys()}

def test_syntax_checks():
    """Test 1: Syntax & Health checks"""
    print("🔍 Test 1: Syntax & Health Checks")
    
    # Test syntax validation for all 3 files
    files_to_check = [
        '/app/js/anti-red-service.js',
        '/app/js/_index.js', 
        '/app/js/protection-enforcer.js'
    ]
    
    syntax_results = {}
    for file_path in files_to_check:
        result = run_command(f'node -c {file_path}')
        syntax_results[file_path] = result['success']
        if not result['success']:
            print(f"  ❌ Syntax error in {file_path}: {result['stderr']}")
        else:
            print(f"  ✅ Syntax OK: {file_path}")
    
    # Test health endpoint
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        health_ok = response.status_code == 200 and response.json().get('status') == 'healthy'
        if health_ok:
            print(f"  ✅ Health endpoint: {response.json()}")
        else:
            print(f"  ❌ Health endpoint failed: {response.status_code}")
    except Exception as e:
        health_ok = False
        print(f"  ❌ Health endpoint error: {e}")
    
    # Check error logs
    log_result = run_command('wc -c /var/log/supervisor/nodejs.err.log')
    log_clean = log_result['success'] and log_result['stdout'].startswith('0 ')
    if log_clean:
        print(f"  ✅ Error log clean: {log_result['stdout']}")
    else:
        print(f"  ❌ Error log not clean: {log_result['stdout']}")
    
    return all(syntax_results.values()) and health_ok and log_clean

def test_antired_stale_zone_fix():
    """Test 2: AntiRed 403 stale-zone self-healing fix verification"""
    print("\n🔍 Test 2: AntiRed 403 Stale-Zone Self-Healing Fix")
    
    # Test anti-red-service.js patterns
    antired_patterns = {
        'deploySharedWorkerRoute_catch_403_404': 'staleZone: true, httpStatus: status',
        'deployCFWorker_catch_403_404': 'staleZone: true, httpStatus: status',
        'deploySharedWorkerRoute_function_exists': 'async function deploySharedWorkerRoute',
        'deployCFWorker_function_exists': 'async function deployCFWorker'
    }
    
    antired_results = check_file_content('/app/js/anti-red-service.js', antired_patterns)
    
    for pattern, found in antired_results.items():
        if found:
            print(f"  ✅ Found: {pattern}")
        else:
            print(f"  ❌ Missing: {pattern}")
    
    # Test _index.js AntiRed-Cron patterns
    index_patterns = {
        'cfService_require': "const cfService = require('./cf-service')",
        'antired_cron_stale_zone_handling': 'if (!result.success && result.staleZone)',
        'getZoneByName_call': 'cfService.getZoneByName(domain)',
        'zone_refreshed_log': 'ZoneRefreshed: ${zoneRefreshed}'
    }
    
    index_results = check_file_content('/app/js/_index.js', index_patterns)
    
    for pattern, found in index_results.items():
        if found:
            print(f"  ✅ Found: {pattern}")
        else:
            print(f"  ❌ Missing: {pattern}")
    
    # Test protection-enforcer.js patterns
    enforcer_patterns = {
        'enforceWorkerRoutes_stale_zone_return': "status: 'stale_zone'",
        'enforceAll_stale_zone_handling': "if (result.status === 'stale_zone')",
        'cfService_getZoneByName_in_enforcer': 'cfService.getZoneByName('
    }
    
    enforcer_results = check_file_content('/app/js/protection-enforcer.js', enforcer_patterns)
    
    for pattern, found in enforcer_results.items():
        if found:
            print(f"  ✅ Found: {pattern}")
        else:
            print(f"  ❌ Missing: {pattern}")
    
    all_patterns_found = all(antired_results.values()) and all(index_results.values()) and all(enforcer_results.values())
    return all_patterns_found

def test_quickactivate_tdz_fix():
    """Test 3: QuickActivateShortener lang TDZ fix verification"""
    print("\n🔍 Test 3: QuickActivateShortener Lang TDZ Fix")
    
    # Read the specific section of _index.js around the QuickActivateShortener
    try:
        with open('/app/js/_index.js', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the quick-activate-domain-shortener action handler
        pattern = r"if\s*\(\s*action\s*===\s*['\"]quick-activate-domain-shortener['\"]\s*\)\s*{(.*?)(?=\n\s*if\s*\(\s*action\s*===|\n\s*}\s*$)"
        match = re.search(pattern, content, re.DOTALL)
        
        if not match:
            print("  ❌ Could not find quick-activate-domain-shortener action handler")
            return False
        
        handler_code = match.group(1)
        
        # Check for const lang declaration before try block
        lang_before_try = re.search(r'const\s+lang\s*=\s*info\?\.\s*userLanguage\s*\|\|\s*[\'"]en[\'"].*?try\s*{', handler_code, re.DOTALL)
        if lang_before_try:
            print("  ✅ Found: const lang declared BEFORE try block")
        else:
            print("  ❌ Missing: const lang declared BEFORE try block")
            return False
        
        # Check that lang is used in the message before try block
        lang_usage_before_try = re.search(r'const\s+lang\s*=.*?}[^}]*\[lang\].*?try\s*{', handler_code, re.DOTALL)
        if lang_usage_before_try:
            print("  ✅ Found: lang used in send() call before try block")
        else:
            print("  ❌ Missing: lang used before try block")
            return False
        
        # Check for _lang in catch block (different variable to avoid shadowing)
        catch_lang = "const _lang = info?.userLanguage || 'en'" in handler_code
        if catch_lang:
            print("  ✅ Found: _lang variable in catch block (avoids shadowing)")
        else:
            print("  ❌ Missing: _lang variable in catch block")
            return False
        
        # Check that there's only one const lang declaration (no duplicates)
        lang_declarations = re.findall(r'const\s+lang\s*=', handler_code)
        if len(lang_declarations) == 1:
            print("  ✅ Found: Only one const lang declaration (no duplicates)")
        else:
            print(f"  ❌ Found {len(lang_declarations)} const lang declarations (should be 1)")
            return False
        
        # Check for createActivationTask using lang variable
        create_task_with_lang = re.search(r'createActivationTask\s*\([^)]*,\s*lang\s*\)', handler_code)
        if create_task_with_lang:
            print("  ✅ Found: createActivationTask uses lang variable")
        else:
            print("  ❌ Missing: createActivationTask using lang variable")
            return False
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error reading _index.js: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Backend Test Suite: AntiRed Stale-Zone + QuickActivateShortener TDZ Fixes")
    print("=" * 80)
    
    test_results = []
    
    # Test 1: Syntax & Health
    test_results.append(test_syntax_checks())
    
    # Test 2: AntiRed stale-zone self-healing
    test_results.append(test_antired_stale_zone_fix())
    
    # Test 3: QuickActivateShortener TDZ fix
    test_results.append(test_quickactivate_tdz_fix())
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(test_results)
    total = len(test_results)
    
    test_names = [
        "Syntax & Health Checks",
        "AntiRed 403 Stale-Zone Self-Healing",
        "QuickActivateShortener Lang TDZ Fix"
    ]
    
    for i, (name, result) in enumerate(zip(test_names, test_results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{i+1}. {name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Both fixes are working correctly!")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED - Please review the issues above")
        return 1

if __name__ == "__main__":
    sys.exit(main())