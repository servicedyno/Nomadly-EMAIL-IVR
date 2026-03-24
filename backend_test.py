#!/usr/bin/env python3
"""
Auto-Promo System Testing Script
Tests email_validation and marketplace themes integration
"""

import re
import json
import sys
from pathlib import Path

def read_file(filepath):
    """Read file content safely"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"❌ Error reading {filepath}: {e}")
        return None

def test_themes_array():
    """Test 1: THEMES array includes email_validation and marketplace (8 elements total)"""
    print("🔍 Test 1: THEMES array structure")
    
    content = read_file('/app/js/auto-promo.js')
    if not content:
        return False
    
    # Find THEMES array definition
    themes_match = re.search(r'const THEMES = \[(.*?)\]', content, re.DOTALL)
    if not themes_match:
        print("❌ THEMES array not found")
        return False
    
    themes_content = themes_match.group(1)
    themes = [theme.strip().strip("'\"") for theme in themes_content.split(',') if theme.strip()]
    
    print(f"📊 Found THEMES array with {len(themes)} elements: {themes}")
    
    # Check for 8 elements total
    if len(themes) != 8:
        print(f"❌ Expected 8 themes, found {len(themes)}")
        return False
    
    # Check for email_validation and marketplace
    if 'email_validation' not in themes:
        print("❌ email_validation not found in THEMES")
        return False
    
    if 'marketplace' not in themes:
        print("❌ marketplace not found in THEMES")
        return False
    
    print("✅ THEMES array has 8 elements including email_validation and marketplace")
    return True

def test_service_context():
    """Test 2: SERVICE_CONTEXT has email_validation and marketplace entries"""
    print("\n🔍 Test 2: SERVICE_CONTEXT structure")
    
    content = read_file('/app/js/auto-promo.js')
    if not content:
        return False
    
    # Check email_validation entry
    email_validation_match = re.search(r'email_validation:\s*{(.*?)},\s*marketplace:', content, re.DOTALL)
    if not email_validation_match:
        print("❌ email_validation entry not found in SERVICE_CONTEXT")
        return False
    
    ev_content = email_validation_match.group(1)
    if 'services:' not in ev_content or 'details:' not in ev_content or 'cta:' not in ev_content:
        print("❌ email_validation missing required fields (services, details, cta)")
        return False
    
    # Check marketplace entry
    marketplace_match = re.search(r'marketplace:\s*{(.*?)}\s*}', content, re.DOTALL)
    if not marketplace_match:
        print("❌ marketplace entry not found in SERVICE_CONTEXT")
        return False
    
    mp_content = marketplace_match.group(1)
    if 'services:' not in mp_content or 'details:' not in mp_content or 'cta:' not in mp_content:
        print("❌ marketplace missing required fields (services, details, cta)")
        return False
    
    print("✅ SERVICE_CONTEXT has email_validation and marketplace with required fields")
    return True

def test_promo_messages():
    """Test 3-13: Promo messages in all languages"""
    print("\n🔍 Test 3-13: Promo messages structure")
    
    content = read_file('/app/js/auto-promo.js')
    if not content:
        return False
    
    languages = ['en', 'fr', 'zh', 'hi']
    themes = ['email_validation', 'marketplace']
    
    results = []
    
    for lang in languages:
        for theme in themes:
            # Find the theme section in the language
            pattern = rf'{lang}:\s*{{.*?{theme}:\s*\[(.*?)\]'
            match = re.search(pattern, content, re.DOTALL)
            
            if not match:
                print(f"❌ {lang} {theme} not found")
                results.append(False)
                continue
            
            # Count variations (should be 3)
            variations_content = match.group(1)
            # Count backtick-quoted strings
            variations = re.findall(r'`([^`]*)`', variations_content)
            
            if len(variations) < 3:
                print(f"❌ {lang} {theme} has only {len(variations)} variations, expected 3")
                results.append(False)
                continue
            
            print(f"✅ {lang} {theme}: {len(variations)} variations found")
            results.append(True)
    
    # Test specific content for key languages
    test_results = []
    
    # French email_validation - look for "Validation d'Emails" or "NETTOYEZ"
    if "Validation d'Emails" in content or "NETTOYEZ" in content:
        print("✅ French email_validation content found")
        test_results.append(True)
    else:
        print("❌ French email_validation content not found")
        test_results.append(False)
    
    # French marketplace - look for "ACHETEZ & VENDEZ"
    if "ACHETEZ & VENDEZ" in content:
        print("✅ French marketplace content found")
        test_results.append(True)
    else:
        print("❌ French marketplace content not found")
        test_results.append(False)
    
    # Chinese email_validation - look for "清洗邮件列表" or "邮件验证"
    if "清洗邮件列表" in content or "邮件验证" in content:
        print("✅ Chinese email_validation content found")
        test_results.append(True)
    else:
        print("❌ Chinese email_validation content not found")
        test_results.append(False)
    
    # Chinese marketplace - look for "安全买卖" or "市场"
    if "安全买卖" in content or "市场" in content:
        print("✅ Chinese marketplace content found")
        test_results.append(True)
    else:
        print("❌ Chinese marketplace content not found")
        test_results.append(False)
    
    # Hindi email_validation - look for "ईमेल लिस्ट साफ"
    if "ईमेल लिस्ट साफ" in content:
        print("✅ Hindi email_validation content found")
        test_results.append(True)
    else:
        print("❌ Hindi email_validation content not found")
        test_results.append(False)
    
    # Hindi marketplace - look for "सुरक्षित खरीदें"
    if "सुरक्षित खरीदें" in content:
        print("✅ Hindi marketplace content found")
        test_results.append(True)
    else:
        print("❌ Hindi marketplace content not found")
        test_results.append(False)
    
    return all(results + test_results)

def test_cross_sell_messages():
    """Test 14-18: Cross-sell messages in all languages"""
    print("\n🔍 Test 14-18: Cross-sell messages structure")
    
    content = read_file('/app/js/auto-promo.js')
    if not content:
        return False
    
    languages = ['en', 'fr', 'zh', 'hi']
    themes = ['email_validation', 'marketplace']
    
    # Find crossSellMessages section
    cross_sell_match = re.search(r'const crossSellMessages = {(.*?)^}', content, re.DOTALL | re.MULTILINE)
    if not cross_sell_match:
        print("❌ crossSellMessages not found")
        return False
    
    cross_sell_content = cross_sell_match.group(1)
    
    results = []
    
    for lang in languages:
        for theme in themes:
            # Check if theme exists in cross-sell for this language
            pattern = rf'{lang}:\s*{{.*?{theme}:\s*\['
            if re.search(pattern, cross_sell_content, re.DOTALL):
                print(f"✅ {lang} crossSell {theme} found")
                results.append(True)
            else:
                print(f"❌ {lang} crossSell {theme} not found")
                results.append(False)
    
    return all(results)

def test_day_schedule():
    """Test 19-22: DAY_SCHEDULE includes email_validation(6) and marketplace(7)"""
    print("\n🔍 Test 19-22: DAY_SCHEDULE structure")
    
    content = read_file('/app/js/auto-promo.js')
    if not content:
        return False
    
    # Find DAY_SCHEDULE
    schedule_match = re.search(r'const DAY_SCHEDULE = {(.*?)^  }', content, re.DOTALL | re.MULTILINE)
    if not schedule_match:
        print("❌ DAY_SCHEDULE not found")
        return False
    
    schedule_content = schedule_match.group(1)
    print(f"📊 DAY_SCHEDULE content found")
    
    # Check for index 6 (email_validation)
    if ', 6' in schedule_content or '[6,' in schedule_content or '[6]' in schedule_content:
        print("✅ Index 6 (email_validation) found in DAY_SCHEDULE")
        has_6 = True
    else:
        print("❌ Index 6 (email_validation) not found in DAY_SCHEDULE")
        has_6 = False
    
    # Check for index 7 (marketplace)
    if ', 7' in schedule_content or '[7,' in schedule_content or '[7]' in schedule_content:
        print("✅ Index 7 (marketplace) found in DAY_SCHEDULE")
        has_7 = True
    else:
        print("❌ Index 7 (marketplace) not found in DAY_SCHEDULE")
        has_7 = False
    
    # Count occurrences to ensure they appear at least twice
    count_6 = schedule_content.count('6')
    count_7 = schedule_content.count('7')
    
    print(f"📊 Index 6 appears {count_6} times, Index 7 appears {count_7} times")
    
    appears_twice_6 = count_6 >= 2
    appears_twice_7 = count_7 >= 2
    
    if appears_twice_6:
        print("✅ email_validation (6) appears at least twice")
    else:
        print("❌ email_validation (6) should appear at least twice")
    
    if appears_twice_7:
        print("✅ marketplace (7) appears at least twice")
    else:
        print("❌ marketplace (7) should appear at least twice")
    
    return has_6 and has_7 and appears_twice_6 and appears_twice_7

def test_key_content():
    """Test 23-25: Key content checks"""
    print("\n🔍 Test 23-25: Key content verification")
    
    content = read_file('/app/js/auto-promo.js')
    if not content:
        return False
    
    results = []
    
    # Test 23: email_validation mentions "97%" accuracy and "50" free trial
    if "97%" in content and "50" in content:
        print("✅ email_validation mentions 97% accuracy and 50 free trial")
        results.append(True)
    else:
        print("❌ email_validation missing 97% accuracy or 50 free trial")
        results.append(False)
    
    # Test 24: marketplace mentions "escrow" and "P2P"
    if "escrow" in content and "P2P" in content:
        print("✅ marketplace mentions escrow and P2P")
        results.append(True)
    else:
        print("❌ marketplace missing escrow or P2P mentions")
        results.append(False)
    
    # Test 25: email_validation mentions "campaign-ready" or "deliverable"
    if "campaign-ready" in content or "deliverable" in content:
        print("✅ email_validation mentions campaign-ready or deliverable")
        results.append(True)
    else:
        print("❌ email_validation missing campaign-ready or deliverable")
        results.append(False)
    
    return all(results)

def main():
    """Run all tests"""
    print("🚀 Starting Auto-Promo Email Validation & Marketplace Theme Tests")
    print("=" * 70)
    
    tests = [
        ("Structure: THEMES array", test_themes_array),
        ("Structure: SERVICE_CONTEXT", test_service_context),
        ("Content: Promo messages", test_promo_messages),
        ("Content: Cross-sell messages", test_cross_sell_messages),
        ("Schedule: DAY_SCHEDULE", test_day_schedule),
        ("Content: Key phrases", test_key_content),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append(result)
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"\n{status} {test_name}")
        except Exception as e:
            print(f"\n❌ ERROR {test_name}: {e}")
            results.append(False)
    
    print("\n" + "=" * 70)
    print("📊 FINAL RESULTS")
    print("=" * 70)
    
    passed = sum(results)
    total = len(results)
    
    print(f"Tests passed: {passed}/{total}")
    print(f"Success rate: {passed/total*100:.1f}%")
    
    if all(results):
        print("🎉 ALL TESTS PASSED - Email validation and marketplace themes properly integrated!")
        return 0
    else:
        print("⚠️  SOME TESTS FAILED - Check the output above for details")
        return 1

if __name__ == "__main__":
    sys.exit(main())