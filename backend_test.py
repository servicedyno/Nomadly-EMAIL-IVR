#!/usr/bin/env python3
"""
Backend Test for VPS IP Failover System + Catch-all Optimization
Tests all components mentioned in the review request.
"""

import subprocess
import requests
import json
import sys
import os
from pathlib import Path

def run_command(cmd, description=""):
    """Run a shell command and return result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'description': description
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'stdout': '',
            'stderr': 'Command timed out',
            'description': description
        }

def check_file_content(file_path, patterns, description=""):
    """Check if file contains specific patterns"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        results = {}
        for pattern_name, pattern in patterns.items():
            if isinstance(pattern, list):
                # Check if all patterns in list exist
                results[pattern_name] = all(p in content for p in pattern)
            else:
                results[pattern_name] = pattern in content
        
        return {
            'success': all(results.values()),
            'results': results,
            'description': description
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'description': description
        }

def test_syntax_checks():
    """Test 1: Syntax check for all 3 files"""
    print("🔍 Test 1: Syntax Checks")
    
    files_to_check = [
        '/app/js/_index.js',
        '/app/js/email-validation.js', 
        '/app/js/email-validation-worker.js'
    ]
    
    results = []
    for file_path in files_to_check:
        result = run_command(f'node -c {file_path}', f'Syntax check for {file_path}')
        results.append(result)
        status = "✅ PASS" if result['success'] else "❌ FAIL"
        print(f"  {status} {file_path}")
        if not result['success']:
            print(f"    Error: {result['stderr']}")
    
    return all(r['success'] for r in results)

def test_nodejs_health():
    """Test 2: Node.js running clean"""
    print("\n🔍 Test 2: Node.js Health Check")
    
    # Check health endpoint
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        health_ok = response.status_code == 200 and 'healthy' in response.text
        print(f"  {'✅ PASS' if health_ok else '❌ FAIL'} Health endpoint: {response.status_code}")
        if health_ok:
            health_data = response.json()
            print(f"    Status: {health_data.get('status')}")
            print(f"    Database: {health_data.get('database')}")
    except Exception as e:
        health_ok = False
        print(f"  ❌ FAIL Health endpoint error: {e}")
    
    # Check error log size
    error_log_result = run_command('ls -la /var/log/supervisor/nodejs.err.log', 'Check error log size')
    error_log_empty = '0 ' in error_log_result['stdout']  # Check if size is 0 bytes
    print(f"  {'✅ PASS' if error_log_empty else '❌ FAIL'} Error log is 0 bytes")
    if not error_log_empty:
        print(f"    Log info: {error_log_result['stdout']}")
    
    return health_ok and error_log_empty

def test_ev_admin_ips_action():
    """Test 3: evAdminIps action exists in actions enum"""
    print("\n🔍 Test 3: evAdminIps Action in Enum")
    
    patterns = {
        'evAdminIps_enum': "evAdminIps: 'evAdminIps'"
    }
    
    result = check_file_content('/app/js/_index.js', patterns, 'evAdminIps in actions enum')
    status = "✅ PASS" if result['success'] else "❌ FAIL"
    print(f"  {status} evAdminIps exists in actions enum")
    
    return result['success']

def test_ip_manager_handler():
    """Test 4: IP Manager admin handler with required buttons"""
    print("\n🔍 Test 4: IP Manager Admin Handler")
    
    patterns = {
        'handler_condition': "action === a.evAdminIps && isAdmin(chatId)",
        'refresh_button': "'🔄 Refresh IPs'",
        'fetch_contabo_button': "'📡 Fetch from Contabo'",
        'add_ip_button': "'➕ Add IP'",
        'remove_ip_button': "'🗑 Remove IP'",
        'reset_health_button': "'♻️ Reset Health'",
        'back_button': "'🔙 Back'"
    }
    
    result = check_file_content('/app/js/_index.js', patterns, 'IP Manager handler buttons')
    status = "✅ PASS" if result['success'] else "❌ FAIL"
    print(f"  {status} IP Manager handler with all required buttons")
    
    for button, found in result.get('results', {}).items():
        print(f"    {'✅' if found else '❌'} {button}")
    
    return result['success']

def test_helper_functions():
    """Test 5: Helper functions exist"""
    print("\n🔍 Test 5: Helper Functions")
    
    patterns = {
        '_evWorkerGet': 'function _evWorkerGet(path)',
        '_evWorkerPost': 'function _evWorkerPost(path, data)',
        '_evWorkerDelete': 'function _evWorkerDelete(path, data)',
        '_fetchContaboIps': 'async function _fetchContaboIps()'
    }
    
    result = check_file_content('/app/js/_index.js', patterns, 'Helper functions')
    status = "✅ PASS" if result['success'] else "❌ FAIL"
    print(f"  {status} All helper functions exist")
    
    for func, found in result.get('results', {}).items():
        print(f"    {'✅' if found else '❌'} {func}")
    
    return result['success']

def test_failover_endpoint():
    """Test 6: Failover endpoint exists"""
    print("\n🔍 Test 6: Failover Endpoint")
    
    patterns = {
        'failover_endpoint': "app.post('/ev-ip-failover'",
        'telegram_notification': 'TELEGRAM_ADMIN_CHAT_ID'
    }
    
    result = check_file_content('/app/js/_index.js', patterns, 'Failover endpoint')
    status = "✅ PASS" if result['success'] else "❌ FAIL"
    print(f"  {status} /ev-ip-failover endpoint exists with Telegram notification")
    
    return result['success']

def test_catch_all_optimization():
    """Test 7: Catch-all optimization in email-validation.js"""
    print("\n🔍 Test 7: Catch-all Optimization")
    
    patterns = {
        'domain_buckets': 'const domainBuckets = new Map()',
        'catch_all_probe': 'ev-catchall-probe',
        'smtp_verify_batch': 'smtpVerifyBatch(probeEmails)',
        'catch_all_skip': 'skip individual SMTP',
        'catch_all_domain': 'catch_all_domain'
    }
    
    result = check_file_content('/app/js/email-validation.js', patterns, 'Catch-all optimization')
    status = "✅ PASS" if result['success'] else "❌ FAIL"
    print(f"  {status} Catch-all optimization with domainBuckets grouping")
    
    for feature, found in result.get('results', {}).items():
        print(f"    {'✅' if found else '❌'} {feature}")
    
    return result['success']

def test_worker_ip_pool():
    """Test 8: Worker IP pool features"""
    print("\n🔍 Test 8: Worker IP Pool Features")
    
    patterns = {
        'ip_pool_array': 'const ipPool = []',
        'init_ip_pool': 'function initIpPool()',
        'get_healthy_ip': 'function getHealthyIp()',
        'record_success': 'function recordSuccess(ipEntry)',
        'record_failure': 'function recordFailure(ipEntry, reason)',
        'notify_failover': 'async function notifyFailover(blockedIp, reason)',
        'save_ip_pool': 'function saveIpPool()'
    }
    
    result = check_file_content('/app/js/email-validation-worker.js', patterns, 'Worker IP pool')
    status = "✅ PASS" if result['success'] else "❌ FAIL"
    print(f"  {status} Worker IP pool with all management functions")
    
    for feature, found in result.get('results', {}).items():
        print(f"    {'✅' if found else '❌'} {feature}")
    
    return result['success']

def test_worker_management_endpoints():
    """Test 9: Worker management endpoints"""
    print("\n🔍 Test 9: Worker Management Endpoints")
    
    patterns = {
        'get_ips': "req.method === 'GET' && req.url === '/ips'",
        'post_ips': "req.method === 'POST' && req.url === '/ips'",
        'delete_ips': "req.method === 'DELETE' && req.url === '/ips'",
        'reset_ips': "req.method === 'POST' && req.url === '/ips/reset'"
    }
    
    result = check_file_content('/app/js/email-validation-worker.js', patterns, 'Worker management endpoints')
    status = "✅ PASS" if result['success'] else "❌ FAIL"
    print(f"  {status} Worker has all management endpoints (GET/POST/DELETE /ips, POST /ips/reset)")
    
    for endpoint, found in result.get('results', {}).items():
        print(f"    {'✅' if found else '❌'} {endpoint}")
    
    return result['success']

def test_worker_local_address():
    """Test 10: Worker localAddress usage"""
    print("\n🔍 Test 10: Worker localAddress Usage")
    
    patterns = {
        'smtp_verify_single_params': 'function smtpVerifySingle(email, mxHost, sourceIp',
        'local_address_binding': 'if (sourceIp) connOpts.localAddress = sourceIp',
        'source_ip_usage': 'const r = await smtpVerifySingle(email, mxHost, sourceIp)'
    }
    
    result = check_file_content('/app/js/email-validation-worker.js', patterns, 'Worker localAddress')
    status = "✅ PASS" if result['success'] else "❌ FAIL"
    print(f"  {status} smtpVerifySingle accepts and uses sourceIp for localAddress binding")
    
    for feature, found in result.get('results', {}).items():
        print(f"    {'✅' if found else '❌'} {feature}")
    
    return result['success']

def test_worker_ip_persistence():
    """Test 11: Worker IP persistence"""
    print("\n🔍 Test 11: Worker IP Persistence")
    
    patterns = {
        'ip_pool_file': "const IP_POOL_FILE = '/root/ev-ip-pool.json'",
        'save_ip_pool_call': 'saveIpPool()',
        'fs_write_sync': 'fs.writeFileSync(IP_POOL_FILE'
    }
    
    result = check_file_content('/app/js/email-validation-worker.js', patterns, 'Worker IP persistence')
    status = "✅ PASS" if result['success'] else "❌ FAIL"
    print(f"  {status} Worker saves IP pool to /root/ev-ip-pool.json")
    
    return result['success']

def main():
    """Run all tests"""
    print("🚀 VPS IP Failover System + Catch-all Optimization Test Suite")
    print("=" * 70)
    
    tests = [
        test_syntax_checks,
        test_nodejs_health,
        test_ev_admin_ips_action,
        test_ip_manager_handler,
        test_helper_functions,
        test_failover_endpoint,
        test_catch_all_optimization,
        test_worker_ip_pool,
        test_worker_management_endpoints,
        test_worker_local_address,
        test_worker_ip_persistence
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"  ❌ FAIL Test error: {e}")
            results.append(False)
    
    print("\n" + "=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(results)
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    print(f"📈 Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! VPS IP Failover System + Catch-all Optimization is working correctly.")
        return True
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)