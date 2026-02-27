#!/usr/bin/env python3
"""
Backend test for Nomadly Telegram bot translation system
"""

import requests
import subprocess
import json
import sys
import os

# Get backend URL from frontend/.env
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.strip().split('=', 1)[1]
    except Exception as e:
        print(f"Error reading backend URL: {e}")
        return None

def test_service_health():
    """Test Node.js service health endpoint"""
    print("=== Testing Service Health ===")
    backend_url = get_backend_url()
    if not backend_url:
        print("❌ Could not retrieve backend URL from frontend/.env")
        return False
        
    try:
        # Test health endpoint
        health_url = f"{backend_url}/health"
        print(f"Testing health endpoint: {health_url}")
        
        response = requests.get(health_url, timeout=10)
        print(f"Health endpoint status: {response.status_code}")
        print(f"Response content type: {response.headers.get('content-type', 'unknown')}")
        
        # Check if it's returning HTML (which indicates frontend redirect) or JSON (expected)
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            if 'application/json' in content_type:
                print("✅ Health endpoint returns proper JSON")
                return True
            elif 'text/html' in content_type:
                print("⚠️  Health endpoint returns HTML (likely frontend route, need to check Node.js directly)")
                # This indicates the request is being handled by React frontend instead of Node.js
                return False
            else:
                print(f"❌ Health endpoint returns unexpected content type: {content_type}")
                return False
        else:
            print(f"❌ Health endpoint failed with status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Health endpoint test failed: {e}")
        return False

def test_phone_config_translations():
    """Test phone-config.js getTxt() returns translated text for FR, ZH, HI"""
    print("\n=== Testing phone-config.js Translations ===")
    
    cmd = '''node -e "
const pc = require('/app/js/phone-config.js'); 
const fr = pc.getTxt('fr'); 
const zh = pc.getTxt('zh'); 
const hi = pc.getTxt('hi'); 
console.log('FR selectType:', typeof fr.selectType === 'function' ? '✅ function' : '❌'); 
console.log('ZH manageNumber:', typeof zh.manageNumber === 'function' ? '✅ function' : '❌'); 
console.log('HI ivrMenu:', typeof hi.ivrMenu === 'function' ? '✅ function' : '❌'); 
console.log('FR smsInboxEmpty:', fr.smsInboxEmpty.includes('Aucun') ? '✅' : '❌'); 
console.log('ZH forwardingDisabled:', typeof zh.forwardingDisabled === 'function' ? '✅' : '❌'); 
console.log('HI renewMenu:', typeof hi.renewMenu === 'function' ? '✅' : '❌');
"'''
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/app')
        if result.returncode == 0:
            print("phone-config.js translation test results:")
            print(result.stdout)
            
            # Check for any failures
            failures = result.stdout.count('❌')
            successes = result.stdout.count('✅')
            
            print(f"Translation functions test: {successes} successes, {failures} failures")
            return failures == 0
        else:
            print(f"❌ phone-config.js test failed with error:")
            print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ phone-config.js test error: {e}")
        return False

def test_upgrade_message_multilingual():
    """Test upgradeMessage() returns translated text for FR, ZH, HI"""
    print("\n=== Testing upgradeMessage Multilingual ===")
    
    cmd = '''node -e "
const pc = require('/app/js/phone-config.js'); 
console.log('FR:', pc.upgradeMessage('ivr','Starter','fr').includes('nécessite')); 
console.log('ZH:', pc.upgradeMessage('voicemail','Starter','zh').includes('需要')); 
console.log('HI:', pc.upgradeMessage('callRecording','Pro','hi').includes('आवश्यक'));
"'''
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/app')
        if result.returncode == 0:
            print("upgradeMessage multilingual test results:")
            print(result.stdout)
            
            # Check if all translations contain expected text
            lines = result.stdout.strip().split('\n')
            all_passed = all('true' in line for line in lines)
            
            print(f"upgradeMessage multilingual test: {'✅ PASSED' if all_passed else '❌ FAILED'}")
            return all_passed
        else:
            print(f"❌ upgradeMessage test failed with error:")
            print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ upgradeMessage test error: {e}")
        return False

def test_lang_files_completeness():
    """Test that FR, ZH, HI lang files have no missing user/t keys"""
    print("\n=== Testing Lang Files Completeness ===")
    
    cmd = '''node -e "
const en = require('/app/js/lang/en.js').en; 
const fr = require('/app/js/lang/fr.js').fr; 
const zh = require('/app/js/lang/zh.js').zh; 
const hi = require('/app/js/lang/hi.js').hi; 
['fr','zh','hi'].forEach(l => { 
    const obj = {fr,zh,hi}[l]; 
    const tMissing = ['dnsWarningHostedDomain','dnsProceedAnyway','dnsCancel','domainTypeRegistered','domainTypeExternal'].filter(k => !obj.t?.hasOwnProperty(k)); 
    const uMissing = ['buyLeads','validateLeads','shortenLink','confirmRenewNow','cancelRenewNow','toggleAutoRenew'].filter(k => !obj.user?.hasOwnProperty(k)); 
    console.log(l.toUpperCase() + ': t missing=' + tMissing.length + ', user missing=' + uMissing.length); 
});
"'''
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/app')
        if result.returncode == 0:
            print("Lang files completeness test results:")
            print(result.stdout)
            
            # Check if all languages have 0 missing keys
            lines = result.stdout.strip().split('\n')
            all_complete = all('missing=0' in line and 'missing=0' in line for line in lines)
            
            print(f"Lang files completeness: {'✅ COMPLETE' if all_complete else '❌ MISSING KEYS'}")
            return all_complete
        else:
            print(f"❌ Lang files completeness test failed with error:")
            print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ Lang files completeness test error: {e}")
        return False

def test_bot_startup():
    """Test Node.js startup status"""
    print("\n=== Testing Bot Startup ===")
    
    try:
        # Check if "Main application ready" exists in logs
        result = subprocess.run(
            ['grep', '-c', 'Main application ready', '/var/log/supervisor/nodejs.out.log'],
            capture_output=True, text=True
        )
        
        if result.returncode == 0 and int(result.stdout.strip()) > 0:
            print("✅ 'Main application ready' found in logs")
            startup_ok = True
        else:
            print("❌ 'Main application ready' not found in logs")
            startup_ok = False
        
        # Check error log is empty (last 5 lines)
        error_result = subprocess.run(
            ['tail', '-5', '/var/log/supervisor/nodejs.err.log'],
            capture_output=True, text=True
        )
        
        if error_result.returncode == 0 and error_result.stdout.strip() == "":
            print("✅ Error log is clean (no recent errors)")
            errors_ok = True
        else:
            print(f"⚠️  Error log contains: {error_result.stdout.strip()}")
            errors_ok = len(error_result.stdout.strip()) == 0
        
        return startup_ok and errors_ok
        
    except Exception as e:
        print(f"❌ Bot startup test error: {e}")
        return False

def test_inline_translations_count():
    """Test _index.js inline translations count"""
    print("\n=== Testing _index.js Inline Translations Count ===")
    
    try:
        result = subprocess.run(
            ['grep', '-c', '[lang]', '/app/js/_index.js'],
            capture_output=True, text=True
        )
        
        if result.returncode == 0:
            count = int(result.stdout.strip())
            print(f"Inline translations found: {count}")
            
            if count >= 100:
                print(f"✅ Inline translations count: {count} (≥100)")
                return True
            else:
                print(f"❌ Inline translations count: {count} (<100)")
                return False
        else:
            print("❌ Failed to count inline translations")
            return False
            
    except Exception as e:
        print(f"❌ Inline translations count test error: {e}")
        return False

def main():
    """Run all translation system tests"""
    print("Starting Nomadly Telegram Bot Translation System Tests\n")
    
    tests = [
        ("Service Health", test_service_health),
        ("phone-config.js Translations", test_phone_config_translations),
        ("upgradeMessage Multilingual", test_upgrade_message_multilingual),
        ("Lang Files Completeness", test_lang_files_completeness),
        ("Bot Startup", test_bot_startup),
        ("Inline Translations Count", test_inline_translations_count)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        try:
            print(f"\n{'='*50}")
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results[test_name] = False
    
    # Summary
    print(f"\n{'='*50}")
    print("=== TRANSLATION SYSTEM TEST SUMMARY ===")
    print(f"{'='*50}")
    
    passed = sum(1 for success in results.values() if success)
    total = len(results)
    
    for test_name, success in results.items():
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All translation system tests PASSED!")
        return True
    else:
        print(f"\n⚠️  {total - passed} tests FAILED - requires attention")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)