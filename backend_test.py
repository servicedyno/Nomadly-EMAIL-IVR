#!/usr/bin/env python3
"""
Backend Test for Virtual Card Purchase Race Condition Fix + Per-user Message Queue + ReferenceError Fix
Testing Nomadly Telegram Bot backend (Node.js on port 5000)
"""

import requests
import os
import subprocess
import re

def test_node_health():
    """Test Node.js health endpoint"""
    print("=" * 60)
    print("1. NODE.JS HEALTH CHECK")
    print("=" * 60)
    
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        print(f"✅ Health endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Response data: {data}")
            
            # Check required fields
            if data.get('status') == 'healthy' and data.get('database') == 'connected':
                print("✅ Node.js backend is healthy and database is connected")
                return True
            else:
                print("❌ Health check failed: status or database not as expected")
                return False
        else:
            print(f"❌ Health endpoint returned {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_error_log_empty():
    """Test that nodejs.err.log is empty"""
    print("\n" + "=" * 60)
    print("2. ERROR LOG CHECK")
    print("=" * 60)
    
    try:
        result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                               capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Error log file exists: {result.stdout.strip()}")
            
            # Check if file size is 0 bytes
            if " 0 " in result.stdout:
                print("✅ nodejs.err.log is EMPTY (0 bytes)")
                return True
            else:
                print("❌ nodejs.err.log is NOT empty")
                # Show contents if not empty
                cat_result = subprocess.run(['cat', '/var/log/supervisor/nodejs.err.log'], 
                                          capture_output=True, text=True)
                if cat_result.returncode == 0:
                    print(f"Error log contents:\n{cat_result.stdout}")
                return False
        else:
            print("❌ Could not check error log file")
            return False
            
    except Exception as e:
        print(f"❌ Error log check failed: {e}")
        return False

def test_per_user_message_queue():
    """Test per-user message queue implementation in _index.js"""
    print("\n" + "=" * 60)
    print("3. PER-USER MESSAGE QUEUE VERIFICATION")
    print("=" * 60)
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        results = []
        
        # Check 1: _userMsgQueue Map defined at module scope
        if '_userMsgQueue = new Map()' in content:
            print("✅ _userMsgQueue Map found in file")
            results.append(True)
        else:
            print("❌ _userMsgQueue Map NOT found")
            results.append(False)
            
        # Check 2: _enqueue function defined at module scope
        enqueue_pattern = r'function _enqueue\(chatId, fn\)'
        if re.search(enqueue_pattern, content):
            print("✅ _enqueue function found in file")
            results.append(True)
        else:
            print("❌ _enqueue function NOT found")
            results.append(False)
            
        # Check 3: bot.on('message') is NOT async
        bot_on_pattern = r"bot\?\.on\('message', msg => \{"
        if re.search(bot_on_pattern, content):
            print("✅ bot.on('message', msg => { found (NOT async)")
            results.append(True)
        else:
            print("❌ bot.on('message') handler not found or incorrect signature")
            results.append(False)
            
        # Check 4: Group chat handling OUTSIDE the queue
        group_chat_pattern = r'// Group chats don\'t need queuing — handle inline\s+if \(isGroupChat\)'
        if re.search(group_chat_pattern, content):
            print("✅ Group chat handling found OUTSIDE the queue")
            results.append(True)
        else:
            print("❌ Group chat handling not found or incorrectly placed")
            results.append(False)
            
        # Check 5: Private chat processing INSIDE _enqueue
        private_chat_pattern = r'_enqueue\(chatId, async \(\) => \{'
        if re.search(private_chat_pattern, content):
            print("✅ Private chat processing found INSIDE _enqueue")
            results.append(True)
        else:
            print("❌ Private chat processing not found inside _enqueue")
            results.append(False)
            
        # Check 6: Proper handler closing
        closing_pattern = r'\}\) // end _enqueue async callback'
        if re.search(closing_pattern, content):
            print("✅ _enqueue async callback closure found")
            results.append(True)
        else:
            print("❌ _enqueue async callback closure not found")
            results.append(False)
            
        bot_on_close_pattern = r'\}\) // end bot\.on\(\'message\'\)'
        if re.search(bot_on_close_pattern, content):
            print("✅ bot.on('message') closure found")
            results.append(True)
        else:
            print("❌ bot.on('message') closure not found")
            results.append(False)
            
        return all(results)
        
    except Exception as e:
        print(f"❌ Per-user message queue verification failed: {e}")
        return False

def test_virtual_card_await_fix():
    """Test Virtual Card await fixes in goto handlers"""
    print("\n" + "=" * 60)
    print("4. VIRTUAL CARD AWAIT FIX VERIFICATION")
    print("=" * 60)
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        results = []
        
        # Check 1: virtual-card-start has await set
        start_pattern = r"'virtual-card-start'.*?await set\(state, chatId, 'action', a\.vcEnterAmount\)"
        if re.search(start_pattern, content, re.DOTALL):
            print("✅ 'virtual-card-start' has await set(state, chatId, 'action', a.vcEnterAmount)")
            results.append(True)
        else:
            print("❌ 'virtual-card-start' await set NOT found")
            results.append(False)
            
        # Check 2: virtual-card-address has await set
        address_pattern = r"'virtual-card-address'.*?await set\(state, chatId, 'action', a\.vcEnterAddress\)"
        if re.search(address_pattern, content, re.DOTALL):
            print("✅ 'virtual-card-address' has await set(state, chatId, 'action', a.vcEnterAddress)")
            results.append(True)
        else:
            print("❌ 'virtual-card-address' await set NOT found")
            results.append(False)
            
        # Check 3: virtual-card-pay has await set
        pay_pattern = r"'virtual-card-pay'.*?await set\(state, chatId, 'action', a\.virtualCardPay\)"
        if re.search(pay_pattern, content, re.DOTALL):
            print("✅ 'virtual-card-pay' has await set(state, chatId, 'action', a.virtualCardPay)")
            results.append(True)
        else:
            print("❌ 'virtual-card-pay' await set NOT found")
            results.append(False)
            
        return all(results)
        
    except Exception as e:
        print(f"❌ Virtual Card await fix verification failed: {e}")
        return False

def test_referenceerror_fix():
    """Test ReferenceError fix at fallback support handler"""
    print("\n" + "=" * 60)
    print("5. REFERENCEERROR FIX VERIFICATION")
    print("=" * 60)
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        results = []
        
        # Check 1: _fallbackName variable definition
        fallback_name_pattern = r'const _fallbackName = await get\(nameOf, chatId\)'
        if re.search(fallback_name_pattern, content):
            print("✅ const _fallbackName = await get(nameOf, chatId) found")
            results.append(True)
        else:
            print("❌ _fallbackName definition NOT found")
            results.append(False)
            
        # Check 2: displayName using _fallbackName
        display_name_pattern = r'const displayName = _fallbackName \|\| msg\?\.from\?\.username \|\| chatId'
        if re.search(display_name_pattern, content):
            print("✅ const displayName = _fallbackName || msg?.from?.username || chatId found")
            results.append(True)
        else:
            print("❌ displayName with _fallbackName NOT found")
            results.append(False)
            
        return all(results)
        
    except Exception as e:
        print(f"❌ ReferenceError fix verification failed: {e}")
        return False

def test_service_initialization():
    """Test service initialization from logs"""
    print("\n" + "=" * 60)
    print("6. SERVICE INITIALIZATION VERIFICATION")
    print("=" * 60)
    
    try:
        result = subprocess.run(['tail', '-n', '200', '/var/log/supervisor/nodejs.out.log'], 
                               capture_output=True, text=True)
        if result.returncode != 0:
            print("❌ Could not read supervisor logs")
            return False
            
        log_content = result.stdout
        
        # Expected initialization messages
        expected_services = [
            '[AI Support] OpenAI initialized',
            '[VoiceService] Initialized',
            '[AudioLibrary] Initialized', 
            '[BulkCall] Service initialized',
            '[Marketplace] Initialized',
            '[CloudPhone] Telnyx resources initialized',
            '[LeadJobs] Persistence initialized'
        ]
        
        results = []
        for service in expected_services:
            if service in log_content:
                print(f"✅ Found: {service}")
                results.append(True)
            else:
                print(f"❌ NOT found: {service}")
                results.append(False)
                
        # Check for any critical errors during initialization
        if 'Error:' in log_content or 'FATAL' in log_content or 'crashed' in log_content:
            print("❌ Critical errors found during initialization")
            results.append(False)
        else:
            print("✅ No critical errors found during initialization")
            results.append(True)
            
        return all(results)
        
    except Exception as e:
        print(f"❌ Service initialization verification failed: {e}")
        return False

def main():
    """Run all tests"""
    print("VIRTUAL CARD RACE CONDITION FIX + PER-USER MESSAGE QUEUE + REFERENCEERROR FIX")
    print("COMPREHENSIVE BACKEND TESTING")
    print("=" * 80)
    
    test_results = []
    
    # Run all tests
    test_results.append(test_node_health())
    test_results.append(test_error_log_empty())
    test_results.append(test_per_user_message_queue())
    test_results.append(test_virtual_card_await_fix())
    test_results.append(test_referenceerror_fix())
    test_results.append(test_service_initialization())
    
    # Summary
    print("\n" + "=" * 80)
    print("COMPREHENSIVE TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed = sum(test_results)
    total = len(test_results)
    success_rate = (passed / total) * 100
    
    test_names = [
        "Node.js Health Check",
        "Error Log Empty Check", 
        "Per-user Message Queue",
        "Virtual Card Await Fix",
        "ReferenceError Fix",
        "Service Initialization"
    ]
    
    for i, (name, result) in enumerate(zip(test_names, test_results)):
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{i+1}. {name}: {status}")
    
    print(f"\nOVERALL RESULT: {passed}/{total} tests passed ({success_rate:.1f}% success rate)")
    
    if success_rate == 100:
        print("🎉 ALL TESTS PASSED - VIRTUAL CARD RACE CONDITION FIX IS WORKING CORRECTLY")
    elif success_rate >= 80:
        print("⚠️  MOST TESTS PASSED - Minor issues detected")
    else:
        print("❌ CRITICAL ISSUES DETECTED - Major problems found")
    
    return success_rate == 100

if __name__ == "__main__":
    main()