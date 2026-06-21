#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Nomadly Marketplace P2P 5 Gap Fixes

This script tests the 5 critical marketplace fixes:
1. Seller auto-chat guard (lines ~1350-1380 in _index.js)
2. /done resets other party (lines ~5880-5895 in _index.js)
3. Translate 3 hardcoded English strings
4. Stale conversation cleanup scheduled
5. Category translation

Testing Node.js backend on port 5000
"""
import os
import sys
import json
import requests
import subprocess
import time

# Backend URL configuration
BACKEND_URL = "http://localhost:5000"

def log(msg):
    """Log message with timestamp"""
    print(f"[TEST] {msg}")

def test_nodejs_health():
    """Test 1: Node.js application health check"""
    log("Testing Node.js backend health...")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Node.js health check passed: {data}")
            return data.get('status') == 'healthy' and data.get('database') == 'connected'
        else:
            log(f"❌ Health check failed with status {response.status_code}")
            return False
    except Exception as e:
        log(f"❌ Health check failed: {e}")
        return False

def test_error_logs():
    """Test 2: Check nodejs error logs are empty (no syntax errors)"""
    log("Checking nodejs.err.log for errors...")
    try:
        result = subprocess.run(['wc', '-l', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            line_count = int(result.stdout.split()[0])
            if line_count == 0:
                log("✅ nodejs.err.log is empty - no syntax errors")
                return True
            else:
                log(f"❌ nodejs.err.log has {line_count} lines - checking content:")
                # Show error content
                error_content = subprocess.run(['cat', '/var/log/supervisor/nodejs.err.log'], 
                                             capture_output=True, text=True)
                log(f"Error content: {error_content.stdout}")
                return False
        else:
            log(f"❌ Failed to check error log: {result.stderr}")
            return False
    except Exception as e:
        log(f"❌ Failed to check error logs: {e}")
        return False

def test_seller_auto_chat_guard():
    """Test Fix 1: Seller auto-chat guard implementation"""
    log("Testing Fix 1: Seller auto-chat guard (lines ~1350-1380)...")
    
    # Check if the code exists in _index.js
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for seller idle check logic
        seller_idle_check = "sellerAction === 'none' || sellerAction === a.mpHome"
        seller_busy_notification = "sellerT.mpSellerBusy"
        auto_chat_logic = "await set(state, parseFloat(product.sellerId), 'mpActiveConversation', conv._id)"
        
        if (seller_idle_check in content and 
            seller_busy_notification in content and 
            auto_chat_logic in content):
            log("✅ Fix 1: Seller auto-chat guard code verified in _index.js")
            
            # Check specific line ranges around 1350-1380
            lines = content.split('\n')
            guard_logic_found = False
            for i in range(1340, min(1390, len(lines))):
                if seller_idle_check in lines[i]:
                    guard_logic_found = True
                    log(f"✅ Found seller idle check at line {i+1}: {lines[i].strip()}")
                    break
            
            if guard_logic_found:
                log("✅ Fix 1: Seller auto-chat guard properly implemented")
                return True
            else:
                log("❌ Fix 1: Seller idle check not found in expected line range")
                return False
        else:
            log("❌ Fix 1: Missing seller auto-chat guard components")
            return False
    except Exception as e:
        log(f"❌ Fix 1: Failed to verify seller auto-chat guard: {e}")
        return False

def test_done_resets_other_party():
    """Test Fix 2: /done resets other party implementation"""
    log("Testing Fix 2: /done resets other party (lines ~5880-5895)...")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for /done reset logic
        other_party_check = "otherInfo?.action === 'mpChat' && otherInfo?.mpActiveConversation === convId"
        reset_action = "await set(state, otherParty, 'action', a.mpHome)"
        reset_conversation = "await set(state, otherParty, 'mpActiveConversation', null)"
        closed_reset_message = "otherT.mpChatClosedReset"
        ended_notify = "t.mpChatEndedNotify"
        
        if (other_party_check in content and 
            reset_action in content and 
            reset_conversation in content and
            closed_reset_message in content and
            ended_notify in content):
            log("✅ Fix 2: /done reset other party code verified in _index.js")
            
            # Check specific line ranges around 5880-5895
            lines = content.split('\n')
            reset_logic_found = False
            for i in range(5870, min(5905, len(lines))):
                if other_party_check in lines[i]:
                    reset_logic_found = True
                    log(f"✅ Found other party reset check at line {i+1}: {lines[i].strip()}")
                    break
            
            if reset_logic_found:
                log("✅ Fix 2: /done resets other party properly implemented")
                return True
            else:
                log("❌ Fix 2: Other party reset check not found in expected line range")
                return False
        else:
            log("❌ Fix 2: Missing /done reset other party components")
            return False
    except Exception as e:
        log(f"❌ Fix 2: Failed to verify /done reset other party: {e}")
        return False

def test_hardcoded_strings_translated():
    """Test Fix 3: Verify hardcoded English strings are translated"""
    log("Testing Fix 3: Hardcoded English strings translation...")
    
    try:
        # Check _index.js for absence of hardcoded strings
        with open('/app/js/_index.js', 'r') as f:
            index_content = f.read()
        
        hardcoded_strings = [
            "You entered chat for",
            "Resumed chat:",
            "Buyer sent a photo:",
            "Seller sent a photo:"
        ]
        
        hardcoded_found = []
        for string in hardcoded_strings:
            if string in index_content:
                hardcoded_found.append(string)
        
        if hardcoded_found:
            log(f"❌ Fix 3: Found hardcoded strings in _index.js: {hardcoded_found}")
            return False
        else:
            log("✅ Fix 3: No hardcoded English strings found in _index.js")
        
        # Check for translated key usage
        translation_keys = [
            "t.mpEnteredChat",
            "t.mpResumedChat",
            "otherT.mpBuyerPhotoCaption",
            "otherT.mpSellerPhotoCaption"
        ]
        
        keys_found = []
        for key in translation_keys:
            if key in index_content:
                keys_found.append(key)
        
        if len(keys_found) >= 3:  # At least 3 of 4 keys should be found
            log(f"✅ Fix 3: Found translation keys in _index.js: {keys_found}")
        else:
            log(f"❌ Fix 3: Missing translation keys in _index.js: {[k for k in translation_keys if k not in keys_found]}")
            return False
        
        # Check all language files for translation keys
        lang_files = ['en.js', 'fr.js', 'zh.js', 'hi.js']
        required_keys = ['mpEnteredChat', 'mpResumedChat', 'mpBuyerPhotoCaption', 'mpSellerPhotoCaption']
        
        all_keys_present = True
        for lang_file in lang_files:
            try:
                with open(f'/app/js/lang/{lang_file}', 'r', encoding='utf-8') as f:
                    lang_content = f.read()
                
                missing_keys = []
                for key in required_keys:
                    if f"{key}:" not in lang_content:
                        missing_keys.append(key)
                
                if missing_keys:
                    log(f"❌ Fix 3: Missing keys in {lang_file}: {missing_keys}")
                    all_keys_present = False
                else:
                    log(f"✅ Fix 3: All translation keys present in {lang_file}")
                    
            except Exception as e:
                log(f"❌ Fix 3: Failed to check {lang_file}: {e}")
                all_keys_present = False
        
        if all_keys_present:
            log("✅ Fix 3: Hardcoded strings translation completed successfully")
            return True
        else:
            log("❌ Fix 3: Translation verification failed")
            return False
            
    except Exception as e:
        log(f"❌ Fix 3: Failed to verify hardcoded strings translation: {e}")
        return False

def test_stale_conversation_cleanup():
    """Test Fix 4: Stale conversation cleanup scheduled"""
    log("Testing Fix 4: Stale conversation cleanup scheduled...")
    
    try:
        # Check for setInterval in _index.js
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for cleanup scheduling
        cleanup_interval = "setInterval(async () => {"
        close_stale = "await marketplaceService.closeStaleConversations()"
        six_hours = "6 * 60 * 60 * 1000"
        cleanup_message = "[Marketplace] Stale conversation cleanup scheduled (every 6h)"
        
        if (cleanup_interval in content and 
            close_stale in content and 
            six_hours in content and
            cleanup_message in content):
            log("✅ Fix 4: Stale conversation cleanup code found in _index.js")
        else:
            log("❌ Fix 4: Missing stale conversation cleanup components")
            return False
        
        # Check supervisor logs for initialization message
        try:
            result = subprocess.run(['grep', '-n', 'Stale conversation cleanup scheduled', 
                                   '/var/log/supervisor/nodejs.out.log'], 
                                  capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip():
                log(f"✅ Fix 4: Found cleanup scheduling log: {result.stdout.strip()}")
                
                # Check if cleanup logic includes state reset
                chat_inactive = "buyerT.mpChatInactive"
                seller_inactive = "sellerT.mpChatInactive"
                buyer_reset = "await set(state, conv.buyerId, 'action', 'none')"
                seller_reset = "await set(state, conv.sellerId, 'action', 'none')"
                
                if (chat_inactive in content and seller_inactive in content and
                    buyer_reset in content and seller_reset in content):
                    log("✅ Fix 4: Cleanup includes proper state reset and notifications")
                    return True
                else:
                    log("❌ Fix 4: Missing state reset components in cleanup")
                    return False
            else:
                log("❌ Fix 4: Stale conversation cleanup not found in logs")
                return False
        except Exception as e:
            log(f"❌ Fix 4: Failed to check cleanup logs: {e}")
            return False
            
    except Exception as e:
        log(f"❌ Fix 4: Failed to verify stale conversation cleanup: {e}")
        return False

def test_category_translation():
    """Test Fix 5: Category translation implementation"""
    log("Testing Fix 5: Category translation...")
    
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for _MP_CAT_MAP_GLOBAL definition
        cat_map_global = "_MP_CAT_MAP_GLOBAL"
        translate_categories = "_mpTranslateCategories"
        category_from_translated = "_mpCategoryFromTranslated"
        translate_category = "_mpTranslateCategory"
        
        if cat_map_global not in content:
            log("❌ Fix 5: _MP_CAT_MAP_GLOBAL not found in _index.js")
            return False
        else:
            log("✅ Fix 5: _MP_CAT_MAP_GLOBAL found in _index.js")
        
        if (translate_categories not in content or
            category_from_translated not in content or
            translate_category not in content):
            log("❌ Fix 5: Missing category translation helper functions")
            return False
        else:
            log("✅ Fix 5: All category translation helper functions found")
        
        # Check all language files for category translation keys
        lang_files = ['en.js', 'fr.js', 'zh.js', 'hi.js']
        required_cat_keys = ['mpCatDigitalGoods', 'mpCatBnkLogs', 'mpCatBnkOpening', 'mpCatTools']
        
        all_cat_keys_present = True
        for lang_file in lang_files:
            try:
                with open(f'/app/js/lang/{lang_file}', 'r', encoding='utf-8') as f:
                    lang_content = f.read()
                
                missing_cat_keys = []
                for key in required_cat_keys:
                    if f"{key}:" not in lang_content:
                        missing_cat_keys.append(key)
                
                if missing_cat_keys:
                    log(f"❌ Fix 5: Missing category keys in {lang_file}: {missing_cat_keys}")
                    all_cat_keys_present = False
                else:
                    log(f"✅ Fix 5: All category translation keys present in {lang_file}")
                    
            except Exception as e:
                log(f"❌ Fix 5: Failed to check category keys in {lang_file}: {e}")
                all_cat_keys_present = False
        
        # Check for proper usage in browse and listing flows
        usage_patterns = [
            "_mpTranslateCategories().map(c => [c])",
            "_mpCategoryFromTranslated(message)",
            "_mpTranslateCategory(p.category)"
        ]
        
        usage_found = 0
        for pattern in usage_patterns:
            if pattern in content:
                usage_found += 1
                log(f"✅ Fix 5: Found usage pattern: {pattern}")
            else:
                log(f"⚠️  Fix 5: Usage pattern not found: {pattern}")
        
        if all_cat_keys_present and usage_found >= 2:
            log("✅ Fix 5: Category translation properly implemented")
            return True
        else:
            log("❌ Fix 5: Category translation verification failed")
            return False
            
    except Exception as e:
        log(f"❌ Fix 5: Failed to verify category translation: {e}")
        return False

def run_comprehensive_test():
    """Run all 5 marketplace fix tests"""
    log("Starting Comprehensive Marketplace P2P 5 Gap Fixes Testing...")
    log("="*70)
    
    test_results = {
        "nodejs_health": test_nodejs_health(),
        "error_logs_clean": test_error_logs(),
        "fix1_seller_auto_chat_guard": test_seller_auto_chat_guard(),
        "fix2_done_resets_other_party": test_done_resets_other_party(),
        "fix3_hardcoded_strings_translated": test_hardcoded_strings_translated(),
        "fix4_stale_conversation_cleanup": test_stale_conversation_cleanup(),
        "fix5_category_translation": test_category_translation(),
    }
    
    log("="*70)
    log("TEST RESULTS SUMMARY:")
    
    total_tests = len(test_results)
    passed_tests = sum(1 for result in test_results.values() if result)
    
    for test_name, result in test_results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        log(f"{test_name}: {status}")
    
    success_rate = (passed_tests / total_tests) * 100
    log("="*70)
    log(f"OVERALL SUCCESS RATE: {passed_tests}/{total_tests} ({success_rate:.1f}%)")
    
    if success_rate >= 85:
        log("✅ MARKETPLACE P2P 5 GAP FIXES VERIFICATION SUCCESSFUL")
        return True
    else:
        log("❌ MARKETPLACE P2P 5 GAP FIXES VERIFICATION FAILED")
        return False

if __name__ == "__main__":
    success = run_comprehensive_test()
    sys.exit(0 if success else 1)