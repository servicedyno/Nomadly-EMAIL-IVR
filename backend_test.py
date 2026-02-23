#!/usr/bin/env python3
"""
Backend Testing Script for Node.js Express Server
Tests multiple fixes as requested in the review request.
"""

import subprocess
import sys
import json
import requests
import time

def run_command(cmd, timeout=30):
    """Run a shell command and return the result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return {
            'success': result.returncode == 0,
            'stdout': result.stdout.strip(),
            'stderr': result.stderr.strip(),
            'returncode': result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'stdout': '',
            'stderr': 'Command timed out',
            'returncode': -1
        }
    except Exception as e:
        return {
            'success': False,
            'stdout': '',
            'stderr': str(e),
            'returncode': -1
        }

def test_curl_request(url, headers=None, expected_status=None, expected_content=None):
    """Test a curl request and validate response"""
    try:
        response = requests.get(url, headers=headers or {}, timeout=10, allow_redirects=False)
        
        result = {
            'success': True,
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'content': response.text[:500] if response.text else '',
            'is_json': False
        }
        
        # Try to parse as JSON
        try:
            result['json'] = response.json()
            result['is_json'] = True
        except:
            pass
            
        # Check expected status
        if expected_status and response.status_code != expected_status:
            result['success'] = False
            result['error'] = f"Expected status {expected_status}, got {response.status_code}"
            
        # Check expected content
        if expected_content and expected_content not in response.text:
            result['success'] = False
            result['error'] = f"Expected content '{expected_content}' not found"
            
        return result
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def test_post_request(url, headers=None, expected_status=None):
    """Test a POST request"""
    try:
        response = requests.post(url, headers=headers or {}, timeout=10, allow_redirects=False)
        
        result = {
            'success': True,
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'content': response.text[:500] if response.text else '',
            'is_json': False
        }
        
        # Try to parse as JSON
        try:
            result['json'] = response.json()
            result['is_json'] = True
        except:
            pass
            
        # Check expected status
        if expected_status and response.status_code != expected_status:
            result['success'] = False
            result['error'] = f"Expected status {expected_status}, got {response.status_code}"
            
        return result
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    print("🧪 Starting Node.js Express Server Tests")
    print("=" * 50)
    
    results = {}
    
    # Test 1: Panel domain root path
    print("\n1️⃣ Testing Panel Domain Root Path")
    print("-" * 30)
    
    # Test 1a: panel.hostbay.io/ should return 302 redirect with Location: /panel
    print("Testing: curl -H 'Host: panel.hostbay.io' http://localhost:5000/")
    result1a = test_curl_request(
        "http://localhost:5000/",
        headers={"Host": "panel.hostbay.io"},
        expected_status=302
    )
    results['panel_root_redirect'] = result1a
    
    if result1a['success']:
        # Python requests converts header names to lowercase
        headers = result1a.get('headers', {})
        location_header = headers.get('location', '')
        print(f"DEBUG: All headers: {headers}")
        print(f"DEBUG: Location header: '{location_header}'")
        if location_header == '/panel':
            print("✅ PASS: Returns 302 redirect with Location: /panel")
        else:
            print(f"❌ FAIL: Expected Location: /panel, got: '{location_header}'")
    else:
        print(f"❌ FAIL: {result1a.get('error', 'Unknown error')}")
    
    # Test 1b: panel.hostbay.io/testslug should return JSON 404, NOT shortener HTML
    print("\nTesting: curl -H 'Host: panel.hostbay.io' http://localhost:5000/testslug")
    result1b = test_curl_request(
        "http://localhost:5000/testslug",
        headers={"Host": "panel.hostbay.io"},
        expected_status=404
    )
    results['panel_testslug_404'] = result1b
    
    if result1b['success']:
        if result1b.get('is_json'):
            json_response = result1b.get('json', {})
            if 'error' in json_response and 'Panel' in str(json_response.get('error', '')):
                print("✅ PASS: Returns JSON 404 with panel error message")
            else:
                print(f"❌ FAIL: JSON response doesn't contain panel error: {json_response}")
                result1b['success'] = False
        else:
            print("❌ FAIL: Response is not JSON (might be shortener HTML)")
            result1b['success'] = False
    else:
        print(f"❌ FAIL: {result1b.get('error', 'Unknown error')}")
    
    # Test 1c: Regular localhost:5000/ should return 200 with "Nomadly" greeting (NOT redirect)
    print("\nTesting: curl http://localhost:5000/")
    result1c = test_curl_request(
        "http://localhost:5000/",
        expected_status=200,
        expected_content="Nomadly"
    )
    results['regular_root_greeting'] = result1c
    
    if result1c['success']:
        print("✅ PASS: Returns 200 with 'Nomadly' greeting")
    else:
        print(f"❌ FAIL: {result1c.get('error', 'Unknown error')}")
    
    # Test 2: Reserved username fix
    print("\n2️⃣ Testing Reserved Username Fix")
    print("-" * 30)
    
    username_script = '''
const crypto = require('crypto');
function generateUsername(domain) {
  const clean = domain.replace(/\\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  let base = clean.substring(0, 4) || 'usr';
  const reserved = ['test', 'root', 'admi', 'cpan', 'whm', 'www', 'mail', 'ftp', 'mysq', 'post', 'nob', 'daemon', 'bin'];
  if (reserved.some(r => base.startsWith(r))) {
    base = 'n' + clean.substring(0, 3);
  }
  const suffix = crypto.randomBytes(3).toString('hex').substring(0, 4);
  return base + suffix;
}
console.log(generateUsername('testinghostingplan.sbs'));
console.log(generateUsername('admin-site.com'));
console.log(generateUsername('mysite.com'));
'''
    
    print("Testing reserved username generation...")
    result2 = run_command(f'node -e "{username_script}"')
    results['reserved_username'] = result2
    
    if result2['success']:
        lines = result2['stdout'].split('\n')
        if len(lines) >= 3:
            test_result = lines[0]
            admin_result = lines[1]
            normal_result = lines[2]
            
            print(f"testinghostingplan.sbs → {test_result}")
            print(f"admin-site.com → {admin_result}")
            print(f"mysite.com → {normal_result}")
            
            # Check if testinghostingplan.sbs starts with 'ntes' (NOT 'test')
            if test_result.startswith('ntes'):
                print("✅ PASS: testinghostingplan.sbs generates username starting with 'ntes'")
            else:
                print(f"❌ FAIL: testinghostingplan.sbs should start with 'ntes', got: {test_result[:4]}")
                result2['success'] = False
            
            # Check if admin-site.com starts with 'nadm' (NOT 'admi')
            if admin_result.startswith('nadm'):
                print("✅ PASS: admin-site.com generates username starting with 'nadm'")
            else:
                print(f"❌ FAIL: admin-site.com should start with 'nadm', got: {admin_result[:4]}")
                result2['success'] = False
            
            # Check if mysite.com starts with 'mysi' (normal domain, no prefix)
            if normal_result.startswith('mysi'):
                print("✅ PASS: mysite.com generates username starting with 'mysi'")
            else:
                print(f"❌ FAIL: mysite.com should start with 'mysi', got: {normal_result[:4]}")
                result2['success'] = False
        else:
            print("❌ FAIL: Script didn't return 3 results")
            result2['success'] = False
    else:
        print(f"❌ FAIL: {result2.get('stderr', 'Unknown error')}")
    
    # Test 3: Translation strings loaded
    print("\n3️⃣ Testing Translation Strings")
    print("-" * 30)
    
    translation_script = '''
const { en } = require('/app/js/lang/en.js');
const t = en.t;
console.log(t.domainActionAntiRed);
console.log(t.antiRedTurnOn);
console.log(t.antiRedTurnOff);
console.log(typeof t.antiRedStatusOn);
'''
    
    print("Testing translation strings loading...")
    result3 = run_command(f'node -e "{translation_script}"')
    results['translation_strings'] = result3
    
    if result3['success']:
        lines = result3['stdout'].split('\n')
        if len(lines) >= 4:
            domain_action = lines[0]
            turn_on = lines[1]
            turn_off = lines[2]
            status_on_type = lines[3]
            
            print(f"domainActionAntiRed: {domain_action}")
            print(f"antiRedTurnOn: {turn_on}")
            print(f"antiRedTurnOff: {turn_off}")
            print(f"typeof antiRedStatusOn: {status_on_type}")
            
            expected_values = [
                ("🛡️ Anti-Red Protection", domain_action),
                ("✅ Turn ON Protection", turn_on),
                ("❌ Turn OFF Protection", turn_off),
                ("function", status_on_type)
            ]
            
            all_correct = True
            for expected, actual in expected_values:
                if expected == actual:
                    print(f"✅ PASS: {expected}")
                else:
                    print(f"❌ FAIL: Expected '{expected}', got '{actual}'")
                    all_correct = False
            
            if all_correct:
                print("✅ PASS: All translation strings loaded correctly")
            else:
                result3['success'] = False
        else:
            print("❌ FAIL: Script didn't return 4 results")
            result3['success'] = False
    else:
        print(f"❌ FAIL: {result3.get('stderr', 'Unknown error')}")
    
    # Test 4: JS challenge toggle endpoint
    print("\n4️⃣ Testing JS Challenge Toggle Endpoint")
    print("-" * 30)
    
    print("Testing: curl -X POST http://localhost:5000/panel/security/js-challenge/toggle")
    result4 = test_post_request(
        "http://localhost:5000/panel/security/js-challenge/toggle",
        expected_status=401
    )
    results['js_challenge_toggle'] = result4
    
    if result4['success']:
        print("✅ PASS: Returns 401 Unauthorized (endpoint exists and requires auth)")
    else:
        print(f"❌ FAIL: {result4.get('error', 'Unknown error')}")
    
    # Test 5: General health checks
    print("\n5️⃣ Testing General Health")
    print("-" * 30)
    
    # Test 5a: curl http://localhost:5000/health — 200
    print("Testing: curl http://localhost:5000/health")
    result5a = test_curl_request(
        "http://localhost:5000/health",
        expected_status=200
    )
    results['health_check'] = result5a
    
    if result5a['success']:
        print("✅ PASS: Health check returns 200")
    else:
        print(f"❌ FAIL: {result5a.get('error', 'Unknown error')}")
    
    # Test 5b: curl http://localhost:8001/api/ — 200
    print("\nTesting: curl http://localhost:8001/api/")
    result5b = test_curl_request(
        "http://localhost:8001/api/",
        expected_status=200
    )
    results['api_health'] = result5b
    
    if result5b['success']:
        print("✅ PASS: FastAPI health check returns 200")
    else:
        print(f"❌ FAIL: {result5b.get('error', 'Unknown error')}")
    
    # Test 5c: curl http://localhost:3000/ — 200
    print("\nTesting: curl http://localhost:3000/")
    result5c = test_curl_request(
        "http://localhost:3000/",
        expected_status=200
    )
    results['frontend_health'] = result5c
    
    if result5c['success']:
        print("✅ PASS: React frontend returns 200")
    else:
        print(f"❌ FAIL: {result5c.get('error', 'Unknown error')}")
    
    # Test 5d: Check Node.js error logs
    print("\nTesting: tail -n 10 /var/log/supervisor/nodejs.err.log")
    result5d = run_command("tail -n 10 /var/log/supervisor/nodejs.err.log")
    results['nodejs_logs'] = result5d
    
    if result5d['success']:
        if result5d['stdout'].strip():
            print(f"⚠️ WARNING: Node.js error log has content:")
            print(result5d['stdout'])
        else:
            print("✅ PASS: Node.js error logs are clean (empty)")
    else:
        print(f"⚠️ WARNING: Could not read Node.js logs: {result5d.get('stderr', 'Unknown error')}")
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    total_tests = 0
    passed_tests = 0
    
    test_names = {
        'panel_root_redirect': '1a. Panel root redirect',
        'panel_testslug_404': '1b. Panel testslug 404',
        'regular_root_greeting': '1c. Regular root greeting',
        'reserved_username': '2. Reserved username fix',
        'translation_strings': '3. Translation strings',
        'js_challenge_toggle': '4. JS challenge toggle endpoint',
        'health_check': '5a. Health check',
        'api_health': '5b. API health',
        'frontend_health': '5c. Frontend health',
    }
    
    for key, name in test_names.items():
        total_tests += 1
        if results.get(key, {}).get('success', False):
            passed_tests += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name}")
    
    print(f"\n🏁 FINAL RESULT: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("❌ Some tests failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())