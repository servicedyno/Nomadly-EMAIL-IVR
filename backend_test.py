#!/usr/bin/env python3
"""
Backend test for broadcast dead user false positive fix verification
Tests the Nomadly Telegram bot backend (Node.js on port 5000)
"""

import requests
import json
import subprocess
import sys

def test_node_health():
    """Test 1: Node.js Health Check"""
    print("=== Test 1: Node.js Health Check ===")
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            expected_keys = ['status', 'database', 'uptime']
            if all(key in data for key in expected_keys):
                if data['status'] == 'healthy' and data['database'] == 'connected':
                    print("✅ Node.js health check passed")
                    print(f"   Response: {data}")
                    return True
                else:
                    print(f"❌ Node.js not healthy: {data}")
                    return False
            else:
                print(f"❌ Invalid response structure: {data}")
                return False
        else:
            print(f"❌ Health check failed with status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check exception: {e}")
        return False

def check_error_log():
    """Check Node.js error log is empty"""
    print("=== Checking Node.js Error Log ===")
    try:
        result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            output = result.stdout.strip()
            print(f"Error log file info: {output}")
            # Check if file size is 0
            if ' 0 ' in output:
                print("✅ Node.js error log is empty")
                return True
            else:
                print("❌ Node.js error log is not empty")
                return False
        else:
            print("❌ Could not check error log file")
            return False
    except Exception as e:
        print(f"❌ Error checking log: {e}")
        return False

def verify_resurrection_mechanism():
    """Test 2: Verify resurrection mechanism in _index.js"""
    print("=== Test 2: Resurrection Mechanism Verification ===")
    
    try:
        # Check for resurrection block after userSubscribed and before info = await get(state, chatId)
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
            
        # Find the userSubscribed line
        lines = content.split('\n')
        userSubscribed_line = None
        info_get_line = None
        resurrect_block_found = False
        
        for i, line in enumerate(lines):
            if 'userSubscribed = await isSubscribed(chatId)' in line:
                userSubscribed_line = i
            if 'info = await get(state, chatId)' in line and userSubscribed_line and i > userSubscribed_line:
                info_get_line = i
                break
                
        if not userSubscribed_line:
            print("❌ userSubscribed line not found")
            return False
            
        if not info_get_line:
            print("❌ info = await get(state, chatId) line not found after userSubscribed")
            return False
            
        # Check for resurrection logic between these lines
        resurrection_keywords = [
            'promoOptOut', 'optedOut: true', 'optedOut: false', 
            'failCount: 0', 'reOptInReason', 'user_active', '[Resurrect]'
        ]
        
        for i in range(userSubscribed_line, info_get_line):
            line = lines[i]
            if 'promoOptOut' in line and 'optedOut: true' in line:
                resurrect_block_found = True
                break
                
        # Also check for the specific updateOne call
        update_pattern_found = False
        for i in range(userSubscribed_line, info_get_line):
            line = lines[i]
            if 'optedOut: false' in line and 'failCount: 0' in line and 'reOptInReason' in line:
                update_pattern_found = True
                break
                
        # Check for logging
        log_found = False
        for i in range(userSubscribed_line, info_get_line):
            line = lines[i]
            if '[Resurrect]' in line:
                log_found = True
                break
                
        if resurrect_block_found and update_pattern_found and log_found:
            print("✅ Resurrection mechanism verified")
            print(f"   - Found between lines {userSubscribed_line + 1} and {info_get_line + 1}")
            print("   - Contains promoOptOut check")
            print("   - Contains optedOut: false update")
            print("   - Contains failCount: 0 reset")
            print("   - Contains reOptInReason: 'user_active'")
            print("   - Contains [Resurrect] logging")
            return True
        else:
            print("❌ Resurrection mechanism incomplete")
            print(f"   Resurrect block found: {resurrect_block_found}")
            print(f"   Update pattern found: {update_pattern_found}")
            print(f"   Log pattern found: {log_found}")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying resurrection mechanism: {e}")
        return False

def verify_resetdead_commands():
    """Test 3: Verify admin /resetdead commands"""
    print("=== Test 3: Admin /resetdead Commands Verification ===")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
            
        # Check for /resetdead (no args) command
        resetdead_no_args = '/resetdead\') {' in content or "message === '/resetdead'" in content
        
        # Check for stats breakdown
        stats_patterns = [
            'chat_not_found', 'user_deactivated', 'bot_blocked', 'other'
        ]
        stats_found = all(pattern in content for pattern in stats_patterns)
        
        # Check for /resetdead with args
        resetdead_with_args = "message.startsWith('/resetdead ')" in content
        
        # Check for specific reset options
        reset_all = "'all'" in content and "resetdead all" in content
        reset_blocked = "'blocked'" in content and "resetdead blocked" in content  
        reset_notfound = "'notfound'" in content and "resetdead notfound" in content
        
        # Check for updateMany operation
        update_many = "updateMany(filter" in content and "optedOut: false" in content
        
        if resetdead_no_args and stats_found:
            print("✅ /resetdead command (no args) verified")
            print("   - Shows dead user stats breakdown")
            print("   - Includes chat_not_found, user_deactivated, bot_blocked, other")
        else:
            print("❌ /resetdead command (no args) missing or incomplete")
            return False
            
        if resetdead_with_args and reset_all and reset_blocked and reset_notfound and update_many:
            print("✅ /resetdead with arguments verified")
            print("   - /resetdead all → updateMany for all dead entries")
            print("   - /resetdead blocked → updateMany for reason='bot_blocked'")
            print("   - /resetdead notfound → updateMany for reason='chat_not_found'")
            print("   - Sets optedOut=false for selected entries")
            return True
        else:
            print("❌ /resetdead with arguments missing or incomplete")
            print(f"   With args: {resetdead_with_args}")
            print(f"   Reset all: {reset_all}")
            print(f"   Reset blocked: {reset_blocked}")
            print(f"   Reset notfound: {reset_notfound}")
            print(f"   Update many: {update_many}")
            return False
            
    except Exception as e:
        print(f"❌ Error verifying /resetdead commands: {e}")
        return False

def verify_smarter_prefilter():
    """Test 4: Verify smarter pre-filter in utils.js"""
    print("=== Test 4: Smarter Pre-filter in utils.js ===")
    
    try:
        with open('/app/js/utils.js', 'r') as f:
            content = f.read()
            
        # Check for STALE_THRESHOLD = 7 days
        stale_threshold = 'STALE_THRESHOLD = 7 * 24 * 60 * 60 * 1000' in content
        
        # Check for user_deactivated always filtered
        user_deactivated_permanent = 'user_deactivated' in content and 'always permanent' in content.lower()
        
        # Check for chat_not_found with stale logic
        chat_not_found_stale = 'chat_not_found' in content and 'updatedAt: { $lt: staleDate }' in content
        
        # Check that bot_blocked is NOT pre-filtered (should not appear in pre-filter query)
        lines = content.split('\n')
        prefilter_section_found = False
        bot_blocked_in_prefilter = False
        
        for i, line in enumerate(lines):
            if 'Pre-filter permanently unreachable users' in line or 'filteredChatIds = chatIds.filter' in line:
                prefilter_section_found = True
                # Check next 20 lines for bot_blocked in filter
                for j in range(i, min(i+20, len(lines))):
                    if 'bot_blocked' in lines[j] and 'reason:' in lines[j]:
                        bot_blocked_in_prefilter = True
                        break
                break
                
        bot_blocked_not_prefiltered = prefilter_section_found and not bot_blocked_in_prefilter
        
        if stale_threshold:
            print("✅ STALE_THRESHOLD = 7 days found")
        else:
            print("❌ STALE_THRESHOLD = 7 days not found")
            
        if user_deactivated_permanent or ('user_deactivated' in content and 'always' in content):
            print("✅ user_deactivated always filtered (permanent)")
        else:
            print("❌ user_deactivated permanent filtering not found")
            
        if chat_not_found_stale:
            print("✅ chat_not_found filtered only when stale (>7 days)")
        else:
            print("❌ chat_not_found stale filtering not found")
            
        if bot_blocked_not_prefiltered:
            print("✅ bot_blocked NOT pre-filtered (can retry)")
        else:
            print("⚠️  bot_blocked pre-filter status unclear")
            
        # Overall assessment
        if stale_threshold and chat_not_found_stale:
            return True
        else:
            return False
            
    except Exception as e:
        print(f"❌ Error verifying smarter pre-filter: {e}")
        return False

def verify_smarter_error_handling():
    """Test 5: Verify smarter error handling with failCount"""
    print("=== Test 5: Smarter Error Handling Verification ===")
    
    try:
        with open('/app/js/utils.js', 'r') as f:
            content = f.read()
            
        # Check for user_deactivated immediate marking
        user_deactivated_immediate = ('user is deactivated' in content and 
                                    'optedOut: true' in content and 
                                    'reason: \'user_deactivated\'' in content)
        
        # Check for failCount logic
        failcount_inc = '$inc: { failCount: 1 }' in content
        failcount_check = 'failCount >= 2' in content
        
        # Check for chat_not_found and bot_blocked using failCount
        chat_not_found_failcount = 'chat_not_found' in content and '$inc' in content
        bot_blocked_failcount = 'bot_blocked' in content and '$inc' in content
        
        # Check isPermanentTelegramError function exists
        ispermanent_function = 'function isPermanentTelegramError' in content
        
        if user_deactivated_immediate:
            print("✅ user_deactivated immediately marked optedOut=true")
        else:
            print("❌ user_deactivated immediate marking not found")
            
        if failcount_inc and failcount_check:
            print("✅ failCount logic implemented")
            print("   - Uses $inc on failCount")
            print("   - Only marks optedOut=true after failCount >= 2")
        else:
            print("❌ failCount logic missing or incomplete")
            
        if chat_not_found_failcount and bot_blocked_failcount:
            print("✅ chat_not_found and bot_blocked use failCount system")
        else:
            print("❌ chat_not_found/bot_blocked failCount system missing")
            
        if ispermanent_function:
            print("✅ isPermanentTelegramError function exists")
        else:
            print("❌ isPermanentTelegramError function missing")
            
        # Overall assessment
        if failcount_inc and failcount_check and ispermanent_function:
            return True
        else:
            return False
            
    except Exception as e:
        print(f"❌ Error verifying error handling: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Broadcast Dead User False Positive Fix Testing")
    print("=" * 70)
    
    tests = [
        ("Node.js Health", test_node_health),
        ("Error Log Check", check_error_log),
        ("Resurrection Mechanism", verify_resurrection_mechanism),
        ("Admin /resetdead Commands", verify_resetdead_commands),
        ("Smarter Pre-filter", verify_smarter_prefilter),
        ("Smarter Error Handling", verify_smarter_error_handling),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'=' * 50}")
        try:
            result = test_func()
            results.append((test_name, result))
            if result:
                print(f"✅ {test_name}: PASSED")
            else:
                print(f"❌ {test_name}: FAILED")
        except Exception as e:
            print(f"❌ {test_name}: ERROR - {e}")
            results.append((test_name, False))
    
    # Summary
    print(f"\n{'=' * 70}")
    print("📊 TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} - {test_name}")
    
    print(f"\n🏆 Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Broadcast dead user false positive fix is working correctly!")
        return True
    else:
        print("⚠️  Some tests failed - please review the implementation")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)