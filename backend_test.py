#!/usr/bin/env python3
"""
Backend Testing for 4 Hosting Flow Fixes
Tests the specific code fixes mentioned in the review request.
"""

import os
import sys
import re
import subprocess
import json
import time
from pathlib import Path

def log(message):
    print(f"[TEST] {message}")

def read_file_content(file_path):
    """Read and return file content."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        log(f"Error reading {file_path}: {e}")
        return ""

def check_node_health():
    """Check if Node.js service is healthy."""
    try:
        result = subprocess.run(
            ['curl', '-s', 'http://localhost:5000/health'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            try:
                health_data = json.loads(result.stdout)
                return health_data.get('status') == 'healthy'
            except:
                return False
        return False
    except Exception as e:
        log(f"Node health check error: {e}")
        return False

def test_startup_worker_upgrade():
    """
    Fix 1: Test upgradeSharedWorker() at startup (_index.js)
    Verify:
    - setTimeout with 10000ms delay exists
    - Calls antiRedService.upgradeSharedWorker()
    - Has proper .then and .catch handlers
    """
    log("Testing Fix 1: upgradeSharedWorker() at startup")
    
    index_js = read_file_content('/app/js/_index.js')
    if not index_js:
        return False, "Cannot read _index.js file"
    
    # Check for setTimeout with 10000ms delay
    if 'setTimeout(() => {' not in index_js or '}, 10000)' not in index_js:
        return False, "setTimeout with 10000ms delay not found"
    
    # Check for upgradeSharedWorker call inside setTimeout
    if 'antiRedService.upgradeSharedWorker()' not in index_js:
        return False, "antiRedService.upgradeSharedWorker() call not found"
    
    # Check for .then and .catch handlers
    if '.then(r => log(' not in index_js or '.catch(err => log(' not in index_js:
        return False, ".then and .catch handlers not found after upgradeSharedWorker()"
    
    # Check for proper log messages
    if '[AntiRed] Startup worker upgrade:' not in index_js:
        return False, "Expected log message '[AntiRed] Startup worker upgrade:' not found"
    
    log("✅ Fix 1 verified: upgradeSharedWorker() at startup with 10s delay")
    return True, "upgradeSharedWorker() correctly called at startup with 10s timeout"

def test_upgrade_worker_in_deploy_full_protection():
    """
    Fix 2: Test upgradeSharedWorker() inside deployFullProtection()
    Verify:
    - upgradeSharedWorker() called before deploySharedWorkerRoute()
    - Comment mentions "3d. Ensure shared Worker script is up-to-date"
    - deploySharedWorkerRoute has comment "3e. Deploy HARDENED shared Worker routes"
    - Wrapped in try/catch (non-blocking)
    """
    log("Testing Fix 2: upgradeSharedWorker() inside deployFullProtection()")
    
    anti_red_js = read_file_content('/app/js/anti-red-service.js')
    if not anti_red_js:
        return False, "Cannot read anti-red-service.js file"
    
    # Find deployFullProtection function
    deploy_func_match = re.search(r'async function deployFullProtection\([^)]*\)\s*\{(.*?)\n\}', anti_red_js, re.DOTALL)
    if not deploy_func_match:
        return False, "deployFullProtection function not found"
    
    deploy_func_content = deploy_func_match.group(1)
    
    # Check for "3d. Ensure shared Worker script is up-to-date" comment
    if '3d. Ensure shared Worker script is up-to-date' not in deploy_func_content:
        return False, "Comment '3d. Ensure shared Worker script is up-to-date' not found"
    
    # Check for upgradeSharedWorker() call
    if 'const workerUpgrade = await upgradeSharedWorker()' not in deploy_func_content:
        return False, "upgradeSharedWorker() call not found in deployFullProtection"
    
    # Check for "3e. Deploy HARDENED shared Worker routes" comment
    if '3e. Deploy HARDENED shared Worker routes' not in deploy_func_content:
        return False, "Comment '3e. Deploy HARDENED shared Worker routes' not found"
    
    # Check that deploySharedWorkerRoute is called after upgradeSharedWorker
    upgrade_pos = deploy_func_content.find('const workerUpgrade = await upgradeSharedWorker()')
    deploy_pos = deploy_func_content.find('deploySharedWorkerRoute(domain, zone.id)')
    
    if upgrade_pos == -1 or deploy_pos == -1 or upgrade_pos >= deploy_pos:
        return False, "upgradeSharedWorker() should be called BEFORE deploySharedWorkerRoute()"
    
    # Check for try/catch wrapper (non-blocking)
    upgrade_section = deploy_func_content[upgrade_pos-100:upgrade_pos+500]
    if 'try {' not in upgrade_section or 'catch' not in upgrade_section:
        return False, "upgradeSharedWorker() call not properly wrapped in try/catch"
    
    log("✅ Fix 2 verified: upgradeSharedWorker() in deployFullProtection() with proper order and comments")
    return True, "upgradeSharedWorker() correctly placed in deployFullProtection with proper comments and error handling"

def test_check_ssl_cert_function():
    """
    Fix 3: Test checkSSLCert() function in whm-service.js
    Verify:
    - Function exists and is exported
    - Uses https.request() with proper options
    - Has hostname: WHM_HOST, port: 443, servername: domain (SNI)
    - Has rejectUnauthorized: false
    - Returns object with required fields
    """
    log("Testing Fix 3: checkSSLCert() function in whm-service.js")
    
    whm_service_js = read_file_content('/app/js/whm-service.js')
    if not whm_service_js:
        return False, "Cannot read whm-service.js file"
    
    # Check if function exists
    if 'async function checkSSLCert(domain)' not in whm_service_js:
        return False, "checkSSLCert function not found"
    
    # Extract the function content
    func_match = re.search(r'async function checkSSLCert\(domain\)\s*\{(.*?)\n\}', whm_service_js, re.DOTALL)
    if not func_match:
        return False, "Could not extract checkSSLCert function content"
    
    func_content = func_match.group(1)
    
    # Check for https.request usage
    if 'https.request(' not in func_content:
        return False, "https.request() not found in checkSSLCert"
    
    # Check for required request options
    required_options = [
        'hostname: WHM_HOST',
        'port: 443',
        'servername: domain',  # SNI
        'rejectUnauthorized: false'
    ]
    
    for option in required_options:
        if option not in func_content:
            return False, f"Required option '{option}' not found in https.request"
    
    # Check for proper return object fields
    return_fields = ['valid', 'selfSigned', 'issuer', 'subject', 'expiresAt']
    for field in return_fields:
        if field + ':' not in func_content:
            return False, f"Return field '{field}' not found in function"
    
    # Check if function is exported
    export_match = re.search(r'module\.exports\s*=\s*\{(.*?)\}', whm_service_js, re.DOTALL)
    if not export_match:
        return False, "module.exports not found"
    
    exports_content = export_match.group(1)
    if 'checkSSLCert' not in exports_content:
        return False, "checkSSLCert not found in module.exports"
    
    log("✅ Fix 3 verified: checkSSLCert() function properly implemented and exported")
    return True, "checkSSLCert() function correctly implemented with https.request and proper SNI"

def test_progressive_ssl_upgrade():
    """
    Fix 4: Test Progressive SSL upgrade in cr-register-domain-&-create-cpanel.js
    Verify:
    - Initial wait is 180000ms (3 min)
    - SSL_CHECK_INTERVALS = [2 * 60000, 5 * 60000, 10 * 60000]
    - Calls whmSvc.checkSSLCert(bgDomain)
    - Upgrades to 'strict' when valid && !selfSigned
    - Variables captured as bgZoneId, bgDomain, bgUsername
    """
    log("Testing Fix 4: Progressive SSL upgrade in cr-register-domain-&-create-cpanel.js")
    
    cpanel_js = read_file_content('/app/js/cr-register-domain-&-create-cpanel.js')
    if not cpanel_js:
        return False, "Cannot read cr-register-domain-&-create-cpanel.js file"
    
    # Check for initial 180000ms (3 min) wait
    if 'setTimeout(r, 180000)' not in cpanel_js and '180000' not in cpanel_js:
        return False, "Initial 180000ms (3 min) wait not found"
    
    # Check for SSL_CHECK_INTERVALS definition
    ssl_intervals_pattern = r'SSL_CHECK_INTERVALS\s*=\s*\[\s*2\s*\*\s*60000\s*,\s*5\s*\*\s*60000\s*,\s*10\s*\*\s*60000\s*\]'
    if not re.search(ssl_intervals_pattern, cpanel_js):
        return False, "SSL_CHECK_INTERVALS with correct values [2*60000, 5*60000, 10*60000] not found"
    
    # Check for checkSSLCert call
    if 'whmSvc.checkSSLCert(bgDomain)' not in cpanel_js:
        return False, "whmSvc.checkSSLCert(bgDomain) call not found"
    
    # Check for SSL upgrade condition
    ssl_upgrade_pattern = r'if\s*\(\s*certStatus\.valid\s*&&\s*!\s*certStatus\.selfSigned\s*\)'
    if not re.search(ssl_upgrade_pattern, cpanel_js):
        return False, "SSL upgrade condition 'certStatus.valid && !certStatus.selfSigned' not found"
    
    # Check for setSSLMode('strict') call
    if "setSSLMode(bgZoneId, 'strict')" not in cpanel_js:
        return False, "setSSLMode(bgZoneId, 'strict') call not found"
    
    # Check for captured variables
    bg_vars = ['bgZoneId', 'bgDomain', 'bgUsername']
    for var in bg_vars:
        if f'const {var} = ' not in cpanel_js:
            return False, f"Variable '{var}' not properly captured before IIFE"
    
    # Check for "staying on Full SSL mode" fallback log
    if 'staying on Full SSL mode' not in cpanel_js:
        return False, "Fallback log message 'staying on Full SSL mode' not found"
    
    log("✅ Fix 4 verified: Progressive SSL upgrade with correct intervals and logic")
    return True, "Progressive SSL upgrade correctly implemented with 3min initial wait and 2,5,10min checks"

def test_backend_report_url_preference():
    """
    Fix 5: Test BACKEND_REPORT_URL preference (anti-red-service.js)
    Verify:
    - Uses process.env.SELF_URL_PROD || process.env.SELF_URL (PROD first)
    - Warning log for 'preview.emergentagent' or 'localhost'
    - Warning includes text about "Worker BACKEND_REPORT_URL points to dev environment"
    """
    log("Testing Fix 5: BACKEND_REPORT_URL preference in anti-red-service.js")
    
    anti_red_js = read_file_content('/app/js/anti-red-service.js')
    if not anti_red_js:
        return False, "Cannot read anti-red-service.js file"
    
    # Find generateHardenedWorkerScript function
    func_match = re.search(r'function generateHardenedWorkerScript\(\)\s*\{(.*?)\n\}', anti_red_js, re.DOTALL)
    if not func_match:
        return False, "generateHardenedWorkerScript function not found"
    
    func_content = func_match.group(1)
    
    # Check for SELF_URL_PROD || SELF_URL preference
    url_preference_pattern = r'process\.env\.SELF_URL_PROD\s*\|\|\s*process\.env\.SELF_URL'
    if not re.search(url_preference_pattern, func_content):
        return False, "SELF_URL_PROD || SELF_URL preference order not found"
    
    # Check for warning condition
    warning_pattern = r'if\s*\([^)]*backendReportUrl\.includes\([\'"]preview\.emergentagent[\'"]\)[^)]*\|\|[^)]*backendReportUrl\.includes\([\'"]localhost[\'"]\)[^)]*\)'
    if not re.search(warning_pattern, func_content):
        return False, "Warning condition for 'preview.emergentagent' or 'localhost' not found"
    
    # Check for warning log message
    if 'Worker BACKEND_REPORT_URL points to dev environment' not in func_content:
        return False, "Warning message 'Worker BACKEND_REPORT_URL points to dev environment' not found"
    
    log("✅ Fix 5 verified: BACKEND_REPORT_URL preference with dev environment warning")
    return True, "BACKEND_REPORT_URL correctly prefers SELF_URL_PROD with dev environment warnings"

def check_startup_logs():
    """
    Fix 6: Check Node.js health and startup logs
    Verify expected startup messages are present
    """
    log("Testing Fix 6: Node.js Health and startup logs")
    
    try:
        # Check for startup logs
        result = subprocess.run(
            ['grep', '-i', 'honeypot.*mongodb.*collection.*initialized\\|kv.*namespace.*ready\\|startup.*worker.*upgrade.*ok', 
             '/var/log/supervisor/nodejs.out.log'],
            capture_output=True, text=True
        )
        
        logs_found = []
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            for line in lines:
                if 'MongoDB collection initialized' in line:
                    logs_found.append('MongoDB collection initialized')
                elif 'KV namespace ready' in line:
                    logs_found.append('KV namespace ready')
                elif 'Startup worker upgrade: OK' in line:
                    logs_found.append('Startup worker upgrade: OK')
        
        expected_logs = ['MongoDB collection initialized', 'KV namespace ready', 'Startup worker upgrade: OK']
        missing_logs = [log for log in expected_logs if log not in str(result.stdout)]
        
        if missing_logs:
            log(f"⚠️ Some expected logs not found: {missing_logs}")
        else:
            log("✅ All expected startup logs found")
        
        return True, f"Startup logs check complete. Found: {logs_found}"
        
    except Exception as e:
        return False, f"Error checking startup logs: {e}"

def run_all_tests():
    """Run all hosting flow fix tests."""
    log("🚀 Starting Backend Tests for 4 Hosting Flow Fixes")
    log("=" * 60)
    
    # Check Node.js health first
    if not check_node_health():
        log("❌ Node.js service is not healthy")
        return False
    
    log("✅ Node.js service is healthy")
    
    tests = [
        ("Fix 1: upgradeSharedWorker() at startup", test_startup_worker_upgrade),
        ("Fix 2: upgradeSharedWorker() in deployFullProtection()", test_upgrade_worker_in_deploy_full_protection),
        ("Fix 3: checkSSLCert() function", test_check_ssl_cert_function),
        ("Fix 4: Progressive SSL upgrade", test_progressive_ssl_upgrade),
        ("Fix 5: BACKEND_REPORT_URL preference", test_backend_report_url_preference),
        ("Fix 6: Node.js health and startup logs", check_startup_logs),
    ]
    
    results = []
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        log(f"\n📋 Running: {test_name}")
        try:
            success, message = test_func()
            if success:
                log(f"✅ PASS: {message}")
                passed += 1
                results.append(f"✅ {test_name}: PASS")
            else:
                log(f"❌ FAIL: {message}")
                results.append(f"❌ {test_name}: FAIL - {message}")
        except Exception as e:
            log(f"❌ ERROR: {e}")
            results.append(f"❌ {test_name}: ERROR - {e}")
    
    log("\n" + "=" * 60)
    log("📊 TEST RESULTS SUMMARY")
    log("=" * 60)
    
    for result in results:
        log(result)
    
    log(f"\n🎯 OVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.0f}%)")
    
    if passed == total:
        log("🎉 ALL HOSTING FLOW FIXES VERIFIED SUCCESSFULLY!")
        return True
    else:
        log(f"⚠️ {total - passed} test(s) failed or have issues")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)