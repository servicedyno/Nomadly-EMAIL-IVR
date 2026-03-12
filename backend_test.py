#!/usr/bin/env python3
"""
Backend Test for Auto-Promo 2x Daily System
Testing all 6 requirements from the review request
"""

import requests
import json
import subprocess
import sys
import os
import re

def test_1_nodejs_health():
    """Test 1: Node.js Health Check"""
    print("=" * 60)
    print("TEST 1: Node.js Health Check")
    print("=" * 60)
    
    try:
        response = requests.get("http://localhost:5000/health", timeout=10)
        print(f"✅ Health endpoint returns {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            expected_keys = ["status", "database"]
            has_status = data.get("status") == "healthy"
            has_database = data.get("database") == "connected"
            
            print(f"✅ Status: {data.get('status')} (expected: healthy)")
            print(f"✅ Database: {data.get('database')} (expected: connected)")
            print(f"   Response: {data}")
            
            if has_status and has_database:
                print("✅ Health check PASSED")
                test1_pass = True
            else:
                print("❌ Health check content FAILED")
                test1_pass = False
        else:
            print(f"❌ Wrong status code: {response.status_code}")
            test1_pass = False
            
    except Exception as e:
        print(f"❌ Health check FAILED: {e}")
        test1_pass = False
    
    # Check error log is empty
    try:
        result = subprocess.run(["wc", "-c", "/var/log/supervisor/nodejs.err.log"], 
                               capture_output=True, text=True, check=True)
        bytes_count = int(result.stdout.split()[0])
        if bytes_count == 0:
            print("✅ nodejs.err.log is EMPTY (0 bytes)")
            test1_pass = test1_pass and True
        else:
            print(f"❌ nodejs.err.log has {bytes_count} bytes")
            test1_pass = False
    except Exception as e:
        print(f"❌ Error log check failed: {e}")
        test1_pass = False
    
    return test1_pass

def test_2_schedule_initialization():
    """Test 2: Schedule Initialization Logs"""
    print("\n" + "=" * 60)
    print("TEST 2: Schedule Initialization")
    print("=" * 60)
    
    try:
        # Check for initialization log
        result = subprocess.run(["grep", "-n", "AutoPromo.*Initialized.*8 jobs", "/var/log/supervisor/nodejs.out.log"], 
                               capture_output=True, text=True)
        
        if result.returncode == 0:
            init_line = result.stdout.strip().split('\n')[-1]  # Get latest occurrence
            print(f"✅ Found initialization: {init_line}")
            
            # Check for "8 jobs (4 langs × 2 slots/day)"
            if "8 jobs" in init_line and "4 langs × 2 slots" in init_line:
                print("✅ Correct job count: 8 jobs (4 langs × 2 slots/day)")
                test2a_pass = True
            else:
                print("❌ Wrong job configuration in init line")
                test2a_pass = False
        else:
            print("❌ Initialization line not found")
            test2a_pass = False
        
        # Check for schedule description
        result2 = subprocess.run(["grep", "-n", "Morning hero.*Evening cross-sell", "/var/log/supervisor/nodejs.out.log"], 
                                capture_output=True, text=True)
        
        if result2.returncode == 0:
            schedule_line = result2.stdout.strip().split('\n')[-1]
            print(f"✅ Found schedule: {schedule_line}")
            
            if "Morning hero (10am)" in schedule_line and "Evening cross-sell (7pm)" in schedule_line:
                print("✅ Correct schedule: Morning hero (10am) + Evening cross-sell (7pm)")
                test2b_pass = True
            else:
                print("❌ Wrong schedule description")
                test2b_pass = False
        else:
            print("❌ Schedule line not found")
            test2b_pass = False
        
        # Check for individual scheduled lines
        scheduled_lines = []
        languages = ["EN", "FR", "ZH", "HI"]
        times = {"EN": ("10:00", "19:00"), "FR": ("9:00", "18:00"), "ZH": ("2:00", "11:00"), "HI": ("4:30", "13:30")}
        
        for lang in languages:
            for slot_type in ["morning", "evening"]:
                pattern = f"Scheduled {slot_type} for {lang}"
                result3 = subprocess.run(["grep", pattern, "/var/log/supervisor/nodejs.out.log"], 
                                       capture_output=True, text=True)
                if result3.returncode == 0:
                    lines = result3.stdout.strip().split('\n')
                    latest_line = lines[-1] if lines else ""
                    scheduled_lines.append((lang, slot_type, latest_line))
        
        print(f"\n✅ Found {len(scheduled_lines)} scheduled entries:")
        for lang, slot_type, line in scheduled_lines:
            expected_morning, expected_evening = times[lang]
            expected_time = expected_morning if slot_type == "morning" else expected_evening
            if expected_time in line:
                print(f"   ✅ {lang} {slot_type}: {line}")
            else:
                print(f"   ❌ {lang} {slot_type}: {line} (missing {expected_time})")
        
        test2c_pass = len(scheduled_lines) >= 8  # Should have 8 entries (4 langs × 2 slots)
        
        return test2a_pass and test2b_pass and test2c_pass
        
    except Exception as e:
        print(f"❌ Schedule initialization test failed: {e}")
        return False

def test_3_crosssell_structure():
    """Test 3: crossSellMessages Structure"""
    print("\n" + "=" * 60)
    print("TEST 3: crossSellMessages Structure")
    print("=" * 60)
    
    try:
        # Use Node.js to check the crossSellMessages structure
        node_script = '''
const { crossSellMessages } = require('./auto-promo.js');

console.log("LANG_COUNT:" + Object.keys(crossSellMessages).length);
console.log("LANGUAGES:" + Object.keys(crossSellMessages).join(","));

const themes = Object.keys(crossSellMessages.en || {});
console.log("THEME_COUNT:" + themes.length);
console.log("THEMES:" + themes.join(","));

let totalVariations = 0;
let allVariationCounts = [];

for (const lang of Object.keys(crossSellMessages)) {
    for (const theme of themes) {
        const variations = crossSellMessages[lang][theme] || [];
        allVariationCounts.push(variations.length);
        totalVariations += variations.length;
    }
}

console.log("TOTAL_VARIATIONS:" + totalVariations);
console.log("VARIATION_COUNTS:" + allVariationCounts.join(","));

// Check message properties
const sampleMsg = crossSellMessages.en.cloudphone[0];
console.log("SAMPLE_LENGTH:" + sampleMsg.length);
console.log("HAS_EMOJI:" + sampleMsg.includes("🌙"));
console.log("HAS_START:" + sampleMsg.includes("/start"));
console.log("NO_VPS:" + !sampleMsg.toLowerCase().includes("vps"));
console.log("NO_EMAIL_BLAST:" + !sampleMsg.toLowerCase().includes("email blast"));
'''
        
        result = subprocess.run(["node", "-e", node_script], cwd="/app/js", 
                               capture_output=True, text=True, check=True)
        
        output_lines = result.stdout.strip().split('\n')
        results = {}
        for line in output_lines:
            if ':' in line:
                key, value = line.split(':', 1)
                results[key] = value
        
        # Verify structure
        lang_count = int(results.get("LANG_COUNT", "0"))
        theme_count = int(results.get("THEME_COUNT", "0"))
        total_variations = int(results.get("TOTAL_VARIATIONS", "0"))
        languages = results.get("LANGUAGES", "").split(",")
        themes = results.get("THEMES", "").split(",")
        
        print(f"✅ Languages ({lang_count}): {languages}")
        print(f"✅ Themes ({theme_count}): {themes}")
        
        # Check for expected languages
        expected_languages = ["en", "fr", "zh", "hi"]
        lang_check = all(lang in languages for lang in expected_languages)
        print(f"✅ Has all 4 languages: {lang_check}")
        
        # Check for expected themes  
        expected_themes = ["cloudphone", "antired_hosting", "leads_validation", "domains_shortener", "digital_products", "cards_bundles"]
        theme_check = all(theme in themes for theme in expected_themes)
        print(f"✅ Has all 6 themes: {theme_check}")
        
        # Check total variations (4 × 6 × 3 = 72)
        expected_total = 4 * 6 * 3
        variations_check = total_variations == expected_total
        print(f"✅ Total variations: {total_variations} (expected: {expected_total})")
        
        # Check each theme has exactly 3 variations
        variation_counts = [int(x) for x in results.get("VARIATION_COUNTS", "").split(",") if x]
        all_three_variations = all(count == 3 for count in variation_counts)
        print(f"✅ All themes have 3 variations: {all_three_variations}")
        
        # Check message properties
        sample_length = int(results.get("SAMPLE_LENGTH", "0"))
        has_emoji = results.get("HAS_EMOJI") == "true"
        has_start = results.get("HAS_START") == "true"
        no_vps = results.get("NO_VPS") == "true"
        no_email_blast = results.get("NO_EMAIL_BLAST") == "true"
        
        print(f"✅ Sample message length: {sample_length} chars (under 400: {sample_length < 400})")
        print(f"✅ Has emojis: {has_emoji}")
        print(f"✅ Has /start CTA: {has_start}")
        print(f"✅ NO VPS mention: {no_vps}")
        print(f"✅ NO Email Blast mention: {no_email_blast}")
        
        return (lang_check and theme_check and variations_check and all_three_variations and
                sample_length < 400 and has_emoji and has_start and no_vps and no_email_blast)
        
    except Exception as e:
        print(f"❌ crossSellMessages structure test failed: {e}")
        return False

def test_4_day_schedule_mapping():
    """Test 4: DAY_SCHEDULE Mapping"""
    print("\n" + "=" * 60)
    print("TEST 4: DAY_SCHEDULE Mapping")
    print("=" * 60)
    
    try:
        node_script = '''
const fs = require('fs');
const autoPromoCode = fs.readFileSync('./auto-promo.js', 'utf8');

// Extract DAY_SCHEDULE object
const dayScheduleMatch = autoPromoCode.match(/const DAY_SCHEDULE = {([^}]+)}/s);
if (!dayScheduleMatch) {
    console.log("ERROR: DAY_SCHEDULE not found");
    process.exit(1);
}

const dayScheduleText = dayScheduleMatch[1];
console.log("DAY_SCHEDULE_FOUND:true");

// Check each day mapping
const expectedMappings = {
    "0": "[]",
    "1": "[0, 3]", 
    "2": "[1, 2]",
    "3": "[2, 0]",
    "4": "[3, 1]",
    "5": "[4, 5]",
    "6": "[5, 4]"
};

let allCorrect = true;
for (const [day, expected] of Object.entries(expectedMappings)) {
    const regex = new RegExp(day + ":\\\\s*" + expected.replace(/[\\[\\]]/g, "\\\\$&"));
    const found = regex.test(dayScheduleText);
    console.log("DAY_" + day + ":" + found);
    if (!found) allCorrect = false;
}

console.log("ALL_MAPPINGS_CORRECT:" + allCorrect);
'''
        
        result = subprocess.run(["node", "-e", node_script], cwd="/app/js", 
                               capture_output=True, text=True, check=True)
        
        output_lines = result.stdout.strip().split('\n')
        results = {}
        for line in output_lines:
            if ':' in line:
                key, value = line.split(':', 1)
                results[key] = value
        
        schedule_found = results.get("DAY_SCHEDULE_FOUND") == "true"
        print(f"✅ DAY_SCHEDULE object found: {schedule_found}")
        
        if schedule_found:
            # Check individual day mappings
            day_mappings = {
                "0": "[] (Sunday — rest, empty array)",
                "1": "[0, 3] (Mon: cloudphone morning, domains_shortener evening)", 
                "2": "[1, 2] (Tue: antired morning, leads evening)",
                "3": "[2, 0] (Wed: leads morning, cloudphone evening)",
                "4": "[3, 1] (Thu: domains morning, antired evening)",
                "5": "[4, 5] (Fri: digital morning, cards evening)",
                "6": "[5, 4] (Sat: cards morning, digital evening)"
            }
            
            all_correct = True
            for day, description in day_mappings.items():
                day_correct = results.get(f"DAY_{day}") == "true"
                print(f"✅ Day {day}: {description} - {day_correct}")
                if not day_correct:
                    all_correct = False
            
            overall_correct = results.get("ALL_MAPPINGS_CORRECT") == "true"
            print(f"\n✅ All day mappings correct: {overall_correct}")
            
            return schedule_found and all_correct and overall_correct
        else:
            return False
        
    except Exception as e:
        print(f"❌ DAY_SCHEDULE mapping test failed: {e}")
        return False

def test_5_evening_behavior():
    """Test 5: Evening Behavior"""
    print("\n" + "=" * 60)
    print("TEST 5: Evening Behavior")
    print("=" * 60)
    
    try:
        node_script = '''
const fs = require('fs');
const autoPromoCode = fs.readFileSync('./auto-promo.js', 'utf8');

// Check broadcastPromoForLang function signature
const funcMatch = autoPromoCode.match(/async function broadcastPromoForLang\\(([^)]+)\\)/);
console.log("FUNC_HAS_SLOTTYPE:" + (funcMatch && funcMatch[1].includes("slotType")));

// Check if AI generation is wrapped in !isEvening check
const aiWrapped = autoPromoCode.includes("if (!isEvening)") && 
                  autoPromoCode.match(/if \\(!isEvening\\)\\s*{[^}]*generateDynamicPromo/s);
console.log("AI_WRAPPED_IN_IF_NOT_EVENING:" + !!aiWrapped);

// Check if GIF path is set to null for evening
const gifNullCheck = autoPromoCode.includes("!isEvening ? GIF_THEMES[theme] : null");
console.log("GIF_NULL_FOR_EVENING:" + gifNullCheck);

// Check sendPromoToUser receives isEvening parameter
const sendPromoMatch = autoPromoCode.match(/async function sendPromoToUser\\(([^)]+)\\)/);
console.log("SENDPROMO_HAS_ISEVENING:" + (sendPromoMatch && sendPromoMatch[1].includes("isEvening")));

// Check if crossSellMessages is used when evening
const crossSellUsage = autoPromoCode.includes("crossSellMessages") && 
                       autoPromoCode.match(/isEvening \\? crossSellMessages : promoMessages/);
console.log("CROSSSELL_USED_FOR_EVENING:" + !!crossSellUsage);
'''
        
        result = subprocess.run(["node", "-e", node_script], cwd="/app/js", 
                               capture_output=True, text=True, check=True)
        
        output_lines = result.stdout.strip().split('\n')
        results = {}
        for line in output_lines:
            if ':' in line:
                key, value = line.split(':', 1)
                results[key] = value
        
        func_has_slottype = results.get("FUNC_HAS_SLOTTYPE") == "true"
        ai_wrapped = results.get("AI_WRAPPED_IN_IF_NOT_EVENING") == "true"
        gif_null = results.get("GIF_NULL_FOR_EVENING") == "true"
        sendpromo_has_isevening = results.get("SENDPROMO_HAS_ISEVENING") == "true"
        crosssell_used = results.get("CROSSSELL_USED_FOR_EVENING") == "true"
        
        print(f"✅ broadcastPromoForLang accepts slotType parameter: {func_has_slottype}")
        print(f"✅ AI generation wrapped in if (!isEvening): {ai_wrapped}")
        print(f"✅ GIF path set to null for evening: {gif_null}")
        print(f"✅ sendPromoToUser receives isEvening parameter: {sendpromo_has_isevening}")
        print(f"✅ crossSellMessages used when isEvening=true: {crosssell_used}")
        
        return (func_has_slottype and ai_wrapped and gif_null and 
                sendpromo_has_isevening and crosssell_used)
        
    except Exception as e:
        print(f"❌ Evening behavior test failed: {e}")
        return False

def test_6_module_exports():
    """Test 6: Module Exports"""
    print("\n" + "=" * 60)
    print("TEST 6: Module Exports") 
    print("=" * 60)
    
    try:
        node_script = '''
const autoPromo = require('./auto-promo.js');
const exports = Object.keys(autoPromo);
console.log("EXPORTS:" + exports.join(","));
console.log("HAS_INITAUTOPROMO:" + exports.includes("initAutoPromo"));
console.log("HAS_PROMOMESSAGES:" + exports.includes("promoMessages"));
console.log("HAS_CROSSSELLMESSAGES:" + exports.includes("crossSellMessages"));
console.log("EXPORT_COUNT:" + exports.length);
'''
        
        result = subprocess.run(["node", "-e", node_script], cwd="/app/js", 
                               capture_output=True, text=True, check=True)
        
        output_lines = result.stdout.strip().split('\n')
        results = {}
        for line in output_lines:
            if ':' in line:
                key, value = line.split(':', 1)
                results[key] = value
        
        exports = results.get("EXPORTS", "").split(",")
        has_init = results.get("HAS_INITAUTOPROMO") == "true"
        has_promo = results.get("HAS_PROMOMESSAGES") == "true" 
        has_crosssell = results.get("HAS_CROSSSELLMESSAGES") == "true"
        export_count = int(results.get("EXPORT_COUNT", "0"))
        
        print(f"✅ Module exports ({export_count}): {exports}")
        print(f"✅ Has initAutoPromo: {has_init}")
        print(f"✅ Has promoMessages: {has_promo}")
        print(f"✅ Has crossSellMessages: {has_crosssell}")
        print(f"✅ Exports exactly 3 items: {export_count == 3}")
        
        return (has_init and has_promo and has_crosssell and export_count == 3)
        
    except Exception as e:
        print(f"❌ Module exports test failed: {e}")
        return False

def main():
    """Run all tests and report results"""
    print("🧪 AUTO-PROMO 2X DAILY SYSTEM TESTING")
    print("Testing 6 requirements from review request")
    print("=" * 60)
    
    tests = [
        ("Node.js Health Check", test_1_nodejs_health),
        ("Schedule Initialization", test_2_schedule_initialization), 
        ("crossSellMessages Structure", test_3_crosssell_structure),
        ("DAY_SCHEDULE Mapping", test_4_day_schedule_mapping),
        ("Evening Behavior", test_5_evening_behavior),
        ("Module Exports", test_6_module_exports)
    ]
    
    results = {}
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ {test_name} CRASHED: {e}")
            results[test_name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(tests)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 OVERALL: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Auto-promo 2x daily system is fully functional!")
        return 0
    else:
        print("⚠️  Some tests failed - check implementation")
        return 1

if __name__ == "__main__":
    sys.exit(main())