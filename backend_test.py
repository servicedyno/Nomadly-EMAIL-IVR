#!/usr/bin/env python3
"""
Backend test for AI Support Chat multi-language fix verification
Tests all requirements from the review request
"""

import requests
import json
import sys
import os

# Backend URL from environment
BACKEND_URL = "http://localhost:5000"

def test_health_check():
    """Test Node.js health endpoint"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'healthy':
                print("✅ Health check: Node.js service is healthy")
                return True
            else:
                print(f"❌ Health check: Service unhealthy - {data}")
                return False
        else:
            print(f"❌ Health check: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def verify_translation_keys():
    """Verify translation keys exist in all 4 language files"""
    required_keys = ['supportMsgReceived', 'supportMsgSent', 'supportEnded', 'noSupportSession']
    languages = ['en', 'fr', 'zh', 'hi']
    
    results = []
    for lang in languages:
        lang_file = f"/app/js/lang/{lang}.js"
        try:
            with open(lang_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            missing_keys = []
            for key in required_keys:
                if f"{key}:" not in content:
                    missing_keys.append(key)
            
            if missing_keys:
                print(f"❌ Language {lang}: Missing keys {missing_keys}")
                results.append(False)
            else:
                print(f"✅ Language {lang}: All required translation keys present")
                results.append(True)
                
        except Exception as e:
            print(f"❌ Language {lang}: Error reading file - {e}")
            results.append(False)
    
    return all(results)

def verify_index_js_support_handler():
    """Verify _index.js support handler uses translated strings"""
    try:
        with open("/app/js/_index.js", 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check for translated strings (NOT hardcoded English)
        checks = [
            ("send(chatId, t.supportEnded", "Line ~4484: Uses t.supportEnded"),
            ("getAiResponse(chatId, message, lang)", "Line ~4507: Passes lang parameter"),
            ("send(chatId, t.supportMsgReceived", "Line ~4521: Uses t.supportMsgReceived"),
            ("send(chatId, t.supportMsgSent", "Line ~4526/4531: Uses t.supportMsgSent")
        ]
        
        results = []
        for check_text, description in checks:
            if check_text in content:
                print(f"✅ {description}")
                results.append(True)
            else:
                print(f"❌ {description} - NOT FOUND")
                results.append(False)
        
        # Check for hardcoded English strings (should NOT exist)
        hardcoded_strings = [
            "Message received!",
            "Message sent to support", 
            "Support session ended",
            "No active support session"
        ]
        
        hardcoded_found = []
        for hardcoded in hardcoded_strings:
            if hardcoded in content:
                hardcoded_found.append(hardcoded)
        
        if hardcoded_found:
            print(f"❌ Found hardcoded English strings: {hardcoded_found}")
            results.append(False)
        else:
            print("✅ No hardcoded English support strings found")
            results.append(True)
        
        return all(results)
        
    except Exception as e:
        print(f"❌ Error reading _index.js: {e}")
        return False

def verify_ai_support_multilang():
    """Verify ai-support.js multi-language implementation"""
    try:
        with open("/app/js/ai-support.js", 'r', encoding='utf-8') as f:
            content = f.read()
        
        checks = [
            # Function signature with lang parameter and default
            ("getAiResponse(chatId, userMessage, lang = 'en')", "getAiResponse accepts lang param with default 'en'"),
            
            # LANG_NAMES object
            ("LANG_NAMES = {", "LANG_NAMES object exists"),
            ("en: 'English'", "LANG_NAMES has en entry"),
            ("fr: 'French", "LANG_NAMES has fr entry"), 
            ("zh: 'Chinese", "LANG_NAMES has zh entry"),
            ("hi: 'Hindi", "LANG_NAMES has hi entry"),
            
            # Language instruction logic
            ("lang !== 'en'", "Non-English language instruction logic"),
            ("LANGUAGE REQUIREMENT", "Language requirement instruction"),
            
            # needsEscalation with lang parameter
            ("needsEscalation(message, lang)", "needsEscalation accepts lang param"),
            
            # ESCALATION_KEYWORDS object structure
            ("ESCALATION_KEYWORDS = {", "ESCALATION_KEYWORDS object exists"),
            ("en: [", "English escalation keywords"),
            ("fr: [", "French escalation keywords"),
            ("zh: [", "Chinese escalation keywords"),
            ("hi: [", "Hindi escalation keywords"),
            
            # Specific French keywords
            ("'remboursement'", "French keyword: remboursement"),
            ("'arnaque'", "French keyword: arnaque"),
            ("'ne fonctionne pas'", "French keyword: ne fonctionne pas"),
            
            # Specific Chinese keywords
            ("'退款'", "Chinese keyword: 退款"),
            ("'欺诈'", "Chinese keyword: 欺诈"),
            ("'不工作'", "Chinese keyword: 不工作"),
            
            # Specific Hindi keywords
            ("'रिफंड'", "Hindi keyword: रिफंड"),
            ("'धोखाधड़ी'", "Hindi keyword: धोखाधड़ी"),
            ("'काम नहीं कर रहा'", "Hindi keyword: काम नहीं कर रहा"),
            
            # Multi-language escalation detection in AI response
            ("agent humain", "French escalation phrase detection"),
            ("人工客服", "Chinese escalation phrase detection"),
            ("सहायता टीम", "Hindi escalation phrase detection")
        ]
        
        results = []
        for check_text, description in checks:
            if check_text in content:
                print(f"✅ {description}")
                results.append(True)
            else:
                print(f"❌ {description} - NOT FOUND")
                results.append(False)
        
        return all(results)
        
    except Exception as e:
        print(f"❌ Error reading ai-support.js: {e}")
        return False

def check_error_logs():
    """Check if error log is empty"""
    try:
        with open("/var/log/supervisor/nodejs.err.log", 'r') as f:
            content = f.read().strip()
        
        if not content:
            print("✅ Error log is empty (no startup errors)")
            return True
        else:
            print(f"❌ Error log contains errors: {content[:200]}...")
            return False
            
    except Exception as e:
        print(f"❌ Error reading error log: {e}")
        return False

def run_all_tests():
    """Run all verification tests"""
    print("🚀 Starting AI Support Chat Multi-Language Fix Verification")
    print("=" * 60)
    
    tests = [
        ("Node.js Health Check", test_health_check),
        ("Translation Keys Verification", verify_translation_keys), 
        ("_index.js Support Handler Verification", verify_index_js_support_handler),
        ("ai-support.js Multi-Language Verification", verify_ai_support_multilang),
        ("Error Log Check", check_error_logs)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        print("-" * 40)
        result = test_func()
        results.append((test_name, result))
        print()
    
    print("=" * 60)
    print("📊 FINAL RESULTS")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 SUMMARY: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! AI Support Chat multi-language fix is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)