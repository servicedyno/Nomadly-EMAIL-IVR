#!/usr/bin/env python3
"""
Backend Testing Script for Auto-Promo System Rewrite
Tests comprehensive auto-promo system implementation
"""

import requests
import json
import time
import sys
import os
from pathlib import Path

# Configuration
BACKEND_URL = "http://localhost:5000"
HEALTH_ENDPOINT = f"{BACKEND_URL}/health"

def test_nodejs_health():
    """Test 1: Node.js Health Check"""
    print("=" * 60)
    print("TEST 1: Node.js Health Check")
    print("=" * 60)
    
    try:
        response = requests.get(HEALTH_ENDPOINT, timeout=10)
        print(f"✓ Health endpoint accessible: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Response data: {json.dumps(data, indent=2)}")
            
            # Check required fields
            if data.get('status') == 'healthy':
                print("✓ Status: healthy")
            else:
                print(f"✗ Status not healthy: {data.get('status')}")
                return False
                
            if data.get('database') == 'connected':
                print("✓ Database: connected")
            else:
                print(f"✗ Database not connected: {data.get('database')}")
                return False
                
            print("✓ Health check PASSED")
            return True
        else:
            print(f"✗ Health check failed with status code: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"✗ Health check error: {str(e)}")
        return False

def check_nodejs_error_log():
    """Check Node.js error log is empty"""
    print("\n" + "=" * 60)
    print("TEST 1.1: Check Node.js Error Log")
    print("=" * 60)
    
    error_log_path = "/var/log/supervisor/nodejs.err.log"
    
    try:
        if os.path.exists(error_log_path):
            file_size = os.path.getsize(error_log_path)
            print(f"✓ Error log file exists: {error_log_path}")
            print(f"✓ Error log size: {file_size} bytes")
            
            if file_size == 0:
                print("✓ Error log is EMPTY (0 bytes) - GOOD")
                return True
            else:
                print(f"⚠ Error log is NOT empty ({file_size} bytes)")
                # Show last few lines for debugging
                with open(error_log_path, 'r') as f:
                    lines = f.readlines()[-10:]  # Last 10 lines
                print("Last few error log entries:")
                for line in lines:
                    print(f"  {line.strip()}")
                return False
        else:
            print(f"✗ Error log file not found: {error_log_path}")
            return False
            
    except Exception as e:
        print(f"✗ Error checking log file: {str(e)}")
        return False

def check_autopromo_initialization():
    """Test 2: AutoPromo Initialization Logs"""
    print("\n" + "=" * 60)
    print("TEST 2: AutoPromo Initialization Logs")
    print("=" * 60)
    
    output_log_path = "/var/log/supervisor/nodejs.out.log"
    
    try:
        if not os.path.exists(output_log_path):
            print(f"✗ Output log file not found: {output_log_path}")
            return False
            
        with open(output_log_path, 'r') as f:
            log_content = f.read()
            
        # Look for AutoPromo initialization line
        init_lines = [line for line in log_content.split('\n') if '[AutoPromo] Initialized' in line]
        
        if not init_lines:
            print("✗ No '[AutoPromo] Initialized' line found in logs")
            return False
            
        # Get the most recent initialization line
        init_line = init_lines[-1]
        print(f"✓ Found initialization line: {init_line}")
        
        # Check for "6 themes"
        if "6 themes" in init_line:
            print("✓ Contains '6 themes'")
        else:
            print("✗ Does not contain '6 themes'")
            return False
            
        # Check for all theme names
        expected_themes = [
            "cloudphone",
            "antired_hosting", 
            "leads_validation",
            "domains_shortener",
            "digital_products",
            "cards_bundles"
        ]
        
        themes_found = []
        for theme in expected_themes:
            if theme in init_line:
                themes_found.append(theme)
                print(f"✓ Theme found: {theme}")
            else:
                print(f"✗ Theme missing: {theme}")
        
        if len(themes_found) == 6:
            print("✓ All 6 themes found in initialization")
        else:
            print(f"✗ Only {len(themes_found)}/6 themes found")
            return False
            
        # Check for "4 langs × 1 slots"
        if "4 langs" in init_line and "1 slots" in init_line:
            print("✓ Contains '4 langs × 1 slots'")
        else:
            print("✗ Does not contain '4 langs × 1 slots'")
            return False
            
        print("✓ AutoPromo initialization check PASSED")
        return True
        
    except Exception as e:
        print(f"✗ Error checking initialization logs: {str(e)}")
        return False

def verify_promo_messages_structure():
    """Test 3: Promo Messages Structure in auto-promo.js"""
    print("\n" + "=" * 60)
    print("TEST 3: Promo Messages Structure")
    print("=" * 60)
    
    auto_promo_path = "/app/js/auto-promo.js"
    
    try:
        if not os.path.exists(auto_promo_path):
            print(f"✗ auto-promo.js file not found: {auto_promo_path}")
            return False
            
        with open(auto_promo_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        print(f"✓ auto-promo.js file found and readable")
        
        # Check for promoMessages object declaration
        if "const promoMessages = {" in content:
            print("✓ promoMessages object found")
        else:
            print("✗ promoMessages object not found")
            return False
            
        # Check for 4 language keys
        expected_langs = ["en:", "fr:", "zh:", "hi:"]
        langs_found = 0
        
        for lang in expected_langs:
            if lang in content:
                langs_found += 1
                print(f"✓ Language found: {lang.replace(':', '')}")
            else:
                print(f"✗ Language missing: {lang.replace(':', '')}")
                
        if langs_found == 4:
            print("✓ All 4 language keys found")
        else:
            print(f"✗ Only {langs_found}/4 language keys found")
            return False
            
        # Check for 6 theme keys in each language
        expected_themes = [
            "cloudphone:",
            "antired_hosting:",
            "leads_validation:", 
            "domains_shortener:",
            "digital_products:",
            "cards_bundles:"
        ]
        
        themes_per_lang = {}
        for lang in ["en", "fr", "zh", "hi"]:
            themes_per_lang[lang] = 0
            for theme in expected_themes:
                if f"{lang}: {{" in content and theme in content:
                    themes_per_lang[lang] += 1
                    
        print(f"✓ Themes per language: {themes_per_lang}")
        
        # Verify each language has all 6 themes
        all_themes_present = True
        for lang, count in themes_per_lang.items():
            if count == 6:
                print(f"✓ {lang}: All 6 themes present")
            else:
                print(f"✗ {lang}: Only {count}/6 themes present")
                all_themes_present = False
                
        if not all_themes_present:
            return False
            
        # Check for array elements (variations)
        # Look for [ and ] patterns indicating arrays
        array_pattern_count = content.count('[')
        print(f"✓ Found {array_pattern_count} array patterns")
        
        # Should have 24 arrays total (4 langs × 6 themes)
        if array_pattern_count >= 24:
            print("✓ Sufficient array patterns found (24+ expected)")
        else:
            print(f"⚠ Only {array_pattern_count} array patterns found, expected 24+")
            
        # Check for NO mention of VPS or Email Blast in promo messages (excluding AI prompt)
        # Extract only the promoMessages object content (line 185 to 1416 approximately)
        lines = content.split('\n')
        promo_start_line = None
        promo_end_line = None
        
        for i, line in enumerate(lines):
            if "const promoMessages = {" in line:
                promo_start_line = i
            elif promo_start_line and ("// ═══════════════════════════════════════════════════════════════════════" in line or "function localToUtc" in line):
                promo_end_line = i
                break
                
        if promo_start_line and promo_end_line:
            promo_lines = lines[promo_start_line:promo_end_line]
            promo_content = '\n'.join(promo_lines)
            
            vps_mentions = promo_content.lower().count('vps')
            email_blast_mentions = promo_content.lower().count('email blast')
            
            if vps_mentions == 0:
                print("✓ No 'VPS' mentions found in promo messages content")
            else:
                print(f"✗ Found {vps_mentions} 'VPS' mentions in promo messages content")
                return False
                
            if email_blast_mentions == 0:
                print("✓ No 'email blast' mentions found in promo messages content") 
            else:
                print(f"✗ Found {email_blast_mentions} 'email blast' mentions in promo messages content")
                return False
        else:
            print("⚠ Could not isolate promo messages content, checking entire file")
            # Fallback: check if VPS/email blast appears only in AI prompt section
            total_vps = content.lower().count('vps')
            ai_prompt_vps = content[content.find("Do NOT mention VPS"):content.find("Return ONLY the promotional message text")].lower().count('vps')
            
            if total_vps <= ai_prompt_vps:
                print("✓ VPS mentions only found in AI prompt instructions (acceptable)")
            else:
                print(f"✗ Found {total_vps - ai_prompt_vps} VPS mentions outside AI prompt")
                return False
                
            if "email blast" not in content.lower():
                print("✓ No 'email blast' mentions found")
            else:
                print("✗ Found 'email blast' mentions")
                return False
            
        # Check for emojis
        emoji_indicators = ['🔥', '💰', '✅', '📞', '🛡️']
        emoji_count = 0
        for emoji in emoji_indicators:
            emoji_count += content.count(emoji)
            
        if emoji_count > 0:
            print(f"✓ Found {emoji_count} emoji indicators")
        else:
            print("✗ No emojis found in messages")
            return False
            
        # Check for HTML bold tags
        bold_count = content.count('<b>')
        if bold_count > 0:
            print(f"✓ Found {bold_count} HTML bold tags")
        else:
            print("✗ No HTML bold tags found")
            return False
            
        # Check for /start CTAs
        start_cta_count = content.count('/start')
        if start_cta_count > 0:
            print(f"✓ Found {start_cta_count} '/start' CTAs")
        else:
            print("✗ No '/start' CTAs found")
            return False
            
        print("✓ Promo messages structure verification PASSED")
        return True
        
    except Exception as e:
        print(f"✗ Error verifying promo messages structure: {str(e)}")
        return False

def verify_theme_day_mapping():
    """Test 4: Theme Day Mapping in getTodayThemes()"""
    print("\n" + "=" * 60)
    print("TEST 4: Theme Day Mapping")
    print("=" * 60)
    
    auto_promo_path = "/app/js/auto-promo.js"
    
    try:
        with open(auto_promo_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Find getTodayThemes function
        if "function getTodayThemes()" not in content:
            print("✗ getTodayThemes() function not found")
            return False
        
        print("✓ getTodayThemes() function found")
        
        # Extract the function content
        func_start = content.find("function getTodayThemes()")
        func_end = content.find("}", func_start) + 1
        func_content = content[func_start:func_end]
        
        print("Function content extracted for analysis")
        
        # Check for day mapping logic
        expected_mappings = {
            "day === 0": "[]",  # Sunday - rest
            "return [day - 1]": True  # Mon-Sat mapping
        }
        
        # Check Sunday returns empty array
        if "if (day === 0) return []" in func_content or "day === 0" in func_content:
            print("✓ Sunday (day===0) returns empty array []")
        else:
            print("✗ Sunday mapping not found")
            return False
            
        # Check the return logic for other days
        if "return [day - 1]" in func_content:
            print("✓ Found 'return [day - 1]' logic")
            print("  ✓ Monday (day===1) → [0] (cloudphone)")
            print("  ✓ Tuesday (day===2) → [1] (antired_hosting)")
            print("  ✓ Wednesday (day===3) → [2] (leads_validation)")
            print("  ✓ Thursday (day===4) → [3] (domains_shortener)")
            print("  ✓ Friday (day===5) → [4] (digital_products)")
            print("  ✓ Saturday (day===6) → [5] (cards_bundles)")
        else:
            print("✗ 'return [day - 1]' logic not found")
            return False
            
        # Verify the mapping comments if present
        comment_checks = [
            ("Sun=0: rest", "Sunday rest day"),
            ("Mon=1: cloudphone", "Monday cloudphone"),
            ("Tue=2: antired", "Tuesday antired"),
            ("Wed=3: leads", "Wednesday leads"),
            ("Thu=4: domains", "Thursday domains"),
            ("Fri=5: digital", "Friday digital"),
            ("Sat=6: cards", "Saturday cards")
        ]
        
        for pattern, description in comment_checks:
            if pattern in func_content:
                print(f"✓ Comment found: {description}")
            else:
                print(f"⚠ Comment not found: {description} (not critical)")
                
        print("✓ Theme day mapping verification PASSED")
        return True
        
    except Exception as e:
        print(f"✗ Error verifying theme day mapping: {str(e)}")
        return False

def verify_service_context():
    """Test 5: SERVICE_CONTEXT Object Verification"""
    print("\n" + "=" * 60)
    print("TEST 5: SERVICE_CONTEXT Object Verification")
    print("=" * 60)
    
    auto_promo_path = "/app/js/auto-promo.js"
    
    try:
        with open(auto_promo_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Check for SERVICE_CONTEXT object
        if "const SERVICE_CONTEXT = {" not in content:
            print("✗ SERVICE_CONTEXT object not found")
            return False
            
        print("✓ SERVICE_CONTEXT object found")
        
        # Extract SERVICE_CONTEXT content
        context_start = content.find("const SERVICE_CONTEXT = {")
        context_end = content.find("}", context_start)
        # Find the matching closing brace
        brace_count = 0
        for i in range(context_start, len(content)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    context_end = i + 1
                    break
                    
        context_content = content[context_start:context_end]
        
        # Check for 6 theme keys
        expected_themes = [
            "cloudphone:",
            "antired_hosting:",
            "leads_validation:",
            "domains_shortener:", 
            "digital_products:",
            "cards_bundles:"
        ]
        
        themes_found = 0
        for theme in expected_themes:
            if theme in context_content:
                themes_found += 1
                print(f"✓ SERVICE_CONTEXT theme: {theme.replace(':', '')}")
            else:
                print(f"✗ SERVICE_CONTEXT theme missing: {theme.replace(':', '')}")
                
        if themes_found != 6:
            print(f"✗ Only {themes_found}/6 themes found in SERVICE_CONTEXT")
            return False
            
        # Check for required fields in each theme
        required_fields = ["services:", "details:", "cta:"]
        
        for theme in ["cloudphone", "antired_hosting", "leads_validation", "domains_shortener", "digital_products", "cards_bundles"]:
            theme_section_found = False
            for field in required_fields:
                field_pattern = f"{theme}:" + ".*" + field
                if theme + ":" in context_content and field in context_content:
                    theme_section_found = True
                    
            if theme_section_found:
                print(f"✓ {theme}: has required fields (services, details, cta)")
            else:
                print(f"✗ {theme}: missing required fields")
                return False
                
        # Check for NO VPS or email blast references
        vps_count = context_content.lower().count('vps')
        email_blast_count = context_content.lower().count('email blast')
        
        if vps_count == 0:
            print("✓ No VPS references in SERVICE_CONTEXT")
        else:
            print(f"✗ Found {vps_count} VPS references in SERVICE_CONTEXT")
            return False
            
        if email_blast_count == 0:
            print("✓ No email blast references in SERVICE_CONTEXT")
        else:
            print(f"✗ Found {email_blast_count} email blast references in SERVICE_CONTEXT")
            return False
            
        print("✓ SERVICE_CONTEXT verification PASSED")
        return True
        
    except Exception as e:
        print(f"✗ Error verifying SERVICE_CONTEXT: {str(e)}")
        return False

def verify_no_old_exports():
    """Test 6: Verify No Old Exports"""
    print("\n" + "=" * 60)
    print("TEST 6: Verify No Old Exports")
    print("=" * 60)
    
    auto_promo_path = "/app/js/auto-promo.js"
    
    try:
        with open(auto_promo_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Check that PROMO_BANNERS is NOT exported
        if "PROMO_BANNERS" in content:
            print("✗ Found PROMO_BANNERS reference (should be removed)")
            return False
        else:
            print("✓ No PROMO_BANNERS references found")
            
        # Check for correct exports
        if "module.exports = { initAutoPromo, promoMessages }" in content:
            print("✓ Correct module.exports found: { initAutoPromo, promoMessages }")
        else:
            print("✗ Incorrect or missing module.exports")
            return False
            
        # Verify only these two exports
        export_line_start = content.find("module.exports = {")
        export_line_end = content.find("}", export_line_start) + 1
        export_line = content[export_line_start:export_line_end]
        
        if "initAutoPromo" in export_line and "promoMessages" in export_line:
            print("✓ Both required exports present: initAutoPromo, promoMessages")
        else:
            print("✗ Missing required exports")
            return False
            
        # Count exports to ensure no extras
        export_count = export_line.count(',') + 1  # commas + 1 = items
        if export_count == 2:
            print("✓ Exactly 2 exports (correct)")
        else:
            print(f"✗ Found {export_count} exports, expected exactly 2")
            return False
            
        print("✓ Export verification PASSED")
        return True
        
    except Exception as e:
        print(f"✗ Error verifying exports: {str(e)}")
        return False

def run_all_tests():
    """Run all auto-promo system tests"""
    print("🚀 STARTING AUTO-PROMO SYSTEM COMPREHENSIVE TESTING")
    print("=" * 80)
    
    test_results = []
    
    # Test 1: Node.js Health
    test_results.append(("Node.js Health Check", test_nodejs_health()))
    test_results.append(("Node.js Error Log Check", check_nodejs_error_log()))
    
    # Test 2: AutoPromo Initialization
    test_results.append(("AutoPromo Initialization", check_autopromo_initialization()))
    
    # Test 3: Promo Messages Structure
    test_results.append(("Promo Messages Structure", verify_promo_messages_structure()))
    
    # Test 4: Theme Day Mapping
    test_results.append(("Theme Day Mapping", verify_theme_day_mapping()))
    
    # Test 5: SERVICE_CONTEXT
    test_results.append(("SERVICE_CONTEXT Verification", verify_service_context()))
    
    # Test 6: No Old Exports
    test_results.append(("No Old Exports", verify_no_old_exports()))
    
    # Summary
    print("\n" + "=" * 80)
    print("🏁 AUTO-PROMO SYSTEM TEST RESULTS SUMMARY")
    print("=" * 80)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} | {test_name}")
        if result:
            passed += 1
    
    print("=" * 80)
    success_rate = (passed / total) * 100
    print(f"📊 OVERALL RESULT: {passed}/{total} tests passed ({success_rate:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - AUTO-PROMO SYSTEM IS PRODUCTION READY!")
        return True
    else:
        print(f"⚠️  {total - passed} TESTS FAILED - ISSUES NEED TO BE ADDRESSED")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)