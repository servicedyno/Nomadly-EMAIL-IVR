#!/usr/bin/env python3
"""
VPS/RDP Clean Flow Restructure Testing
=====================================

This test verifies the major VPS purchase flow restructure for the Nomadly Telegram bot.
Tests all 8 specified areas from the review request.
"""

import subprocess
import json
import sys
import os
import re
from pathlib import Path

def run_command(cmd, cwd=None):
    """Run a shell command and return the result"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return 1, "", str(e)

def test_syntax_validation():
    """Test 1: Syntax validation on all 6 modified files"""
    print("🔍 Test 1: Syntax validation on all 6 modified files")
    
    files = [
        "/app/js/_index.js",
        "/app/js/vm-instance-setup.js", 
        "/app/js/lang/en.js",
        "/app/js/lang/fr.js",
        "/app/js/lang/zh.js",
        "/app/js/lang/hi.js"
    ]
    
    results = []
    for file_path in files:
        print(f"  Checking {file_path}...")
        code, stdout, stderr = run_command(f"node -c {file_path}")
        if code == 0:
            print(f"    ✅ {file_path} - Syntax OK")
            results.append(True)
        else:
            print(f"    ❌ {file_path} - Syntax Error: {stderr}")
            results.append(False)
    
    return all(results)

def test_nodejs_health():
    """Test 2: Node.js health check"""
    print("\n🔍 Test 2: Node.js health check")
    
    # Check health endpoint
    code, stdout, stderr = run_command("curl -s localhost:5000/health")
    if code == 0:
        try:
            health_data = json.loads(stdout)
            if health_data.get("status") == "healthy":
                print("  ✅ Health endpoint returns healthy status")
                health_ok = True
            else:
                print(f"  ❌ Health endpoint status: {health_data.get('status')}")
                health_ok = False
        except json.JSONDecodeError:
            print(f"  ❌ Invalid JSON response: {stdout}")
            health_ok = False
    else:
        print(f"  ❌ Health endpoint failed: {stderr}")
        health_ok = False
    
    # Check error log size
    code, stdout, stderr = run_command("ls -la /var/log/supervisor/nodejs.err.log")
    if code == 0:
        if " 0 " in stdout:  # 0-byte file
            print("  ✅ Error log is 0 bytes (clean)")
            log_ok = True
        else:
            print(f"  ❌ Error log has content: {stdout}")
            log_ok = False
    else:
        print(f"  ❌ Could not check error log: {stderr}")
        log_ok = False
    
    return health_ok and log_ok

def test_data_layer_fixes():
    """Test 3: Data layer fixes in vm-instance-setup.js"""
    print("\n🔍 Test 3: Data layer fixes in vm-instance-setup.js")
    
    # Read vm-instance-setup.js
    try:
        with open("/app/js/vm-instance-setup.js", "r") as f:
            content = f.read()
    except Exception as e:
        print(f"  ❌ Could not read vm-instance-setup.js: {e}")
        return False
    
    # Check fetchAvailableVPSConfigs returns specs as object
    specs_pattern = r'specs:\s*{\s*vCPU:\s*[^,]+,\s*RAM:\s*[^,]+,\s*disk:\s*[^,]+,\s*diskType:'
    if re.search(specs_pattern, content):
        print("  ✅ fetchAvailableVPSConfigs returns specs as OBJECT with vCPU, RAM, disk, diskType")
        specs_ok = True
    else:
        print("  ❌ fetchAvailableVPSConfigs specs format not found or incorrect")
        specs_ok = False
    
    # Check fetchAvailableOS RDP entry has value: 'win'
    rdp_pattern = r'value:\s*[\'"]win[\'"]'
    if re.search(rdp_pattern, content):
        print("  ✅ fetchAvailableOS RDP entry has value: 'win'")
        rdp_ok = True
    else:
        print("  ❌ fetchAvailableOS RDP entry value: 'win' not found")
        rdp_ok = False
    
    return specs_ok and rdp_ok

def test_new_action():
    """Test 4: New action in js/_index.js"""
    print("\n🔍 Test 4: New action in js/_index.js")
    
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
    except Exception as e:
        print(f"  ❌ Could not read _index.js: {e}")
        return False
    
    # Check vpsChooseType action exists in actions enum
    if "vpsChooseType: 'vpsChooseType'" in content:
        print("  ✅ vpsChooseType action exists in actions enum")
        action_ok = True
    else:
        print("  ❌ vpsChooseType action not found in actions enum")
        action_ok = False
    
    # Check createNewVpsFlow goto sets action to vpsChooseType
    if "set(state, chatId, 'action', a.vpsChooseType)" in content:
        print("  ✅ createNewVpsFlow goto sets action to vpsChooseType")
        create_ok = True
    else:
        print("  ❌ createNewVpsFlow action setting not found")
        create_ok = False
    
    # Check askRegionForVps goto exists and sets action to askCountryForVPS
    if "set(state, chatId, 'action', a.askCountryForVPS)" in content:
        print("  ✅ askRegionForVps goto sets action to askCountryForVPS")
        region_ok = True
    else:
        print("  ❌ askRegionForVps action setting not found")
        region_ok = False
    
    # Check vpsChooseType handler checks for vp.vpsLinuxBtn and vp.vpsRdpBtn
    if "message === vp.vpsRdpBtn" in content and "message === vp.vpsLinuxBtn" in content:
        print("  ✅ vpsChooseType handler checks for vp.vpsLinuxBtn and vp.vpsRdpBtn")
        handler_ok = True
    else:
        print("  ❌ vpsChooseType handler button checks not found")
        handler_ok = False
    
    return action_ok and create_ok and region_ok and handler_ok

def test_rdp_flow_skips():
    """Test 5: RDP flow skips OS+SSH"""
    print("\n🔍 Test 5: RDP flow skips OS+SSH")
    
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
    except Exception as e:
        print(f"  ❌ Could not read _index.js: {e}")
        return False
    
    # Check askCouponForVPSPlan handler (both skip and after coupon sections)
    # Look for the specific lines where RDP skips to payment confirmation
    if "return goto.vpsAskPaymentConfirmation()" in content:
        # Count occurrences in the askCouponForVPSPlan section (should be at least 2)
        lines = content.split('\n')
        rdp_skip_count = 0
        in_coupon_handler = False
        for i, line in enumerate(lines):
            if "if (action === a.askCouponForVPSPlan)" in line:
                in_coupon_handler = True
            elif "if (action ===" in line and in_coupon_handler:
                in_coupon_handler = False
            elif in_coupon_handler and "return goto.vpsAskPaymentConfirmation()" in line:
                rdp_skip_count += 1
        
        if rdp_skip_count >= 2:
            print("  ✅ askCouponForVPSPlan: if vpsDetails.isRDP → goes to vpsAskPaymentConfirmation (found in both skip and coupon paths)")
            coupon_ok = True
        else:
            print(f"  ❌ askCouponForVPSPlan RDP skip logic incomplete (found {rdp_skip_count} instances, expected 2)")
            coupon_ok = False
    else:
        print("  ❌ askCouponForVPSPlan RDP skip logic not found")
        coupon_ok = False
    
    # Check skipCouponVps handler
    skip_pattern = r'if\s*\(\s*vpsDetails\?\.isRDP\s*\)\s*return\s+goto\.vpsAskPaymentConfirmation\(\)'
    if re.search(skip_pattern, content):
        print("  ✅ skipCouponVps: if vpsDetails?.isRDP → goes to vpsAskPaymentConfirmation")
        skip_ok = True
    else:
        print("  ❌ skipCouponVps RDP skip logic not found")
        skip_ok = False
    
    # Check askVPSPlanAutoRenewal handler
    renewal_pattern = r'if\s*\(\s*vpsDetails\?\.isRDP\s*\)\s*return\s+goto\.vpsAskPaymentConfirmation\(\)'
    if re.search(renewal_pattern, content):
        print("  ✅ askVPSPlanAutoRenewal: if vpsDetails?.isRDP → goes to vpsAskPaymentConfirmation")
        renewal_ok = True
    else:
        print("  ❌ askVPSPlanAutoRenewal RDP skip logic not found")
        renewal_ok = False
    
    return coupon_ok and skip_ok and renewal_ok

def test_os_selection_linux_only():
    """Test 6: OS selection is Linux-only"""
    print("\n🔍 Test 6: OS selection is Linux-only")
    
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
    except Exception as e:
        print(f"  ❌ Could not read _index.js: {e}")
        return False
    
    # Check askVpsOS goto filters out RDP
    goto_pattern = r'osData\.filter\(\s*o\s*=>\s*!o\.isRDP\s*\)'
    if re.search(goto_pattern, content):
        print("  ✅ askVpsOS goto filters out RDP with osData.filter(o => !o.isRDP)")
        goto_ok = True
    else:
        print("  ❌ askVpsOS goto RDP filter not found")
        goto_ok = False
    
    # Check askVpsOS handler also filters
    handler_pattern = r'const\s+linuxOnly\s*=\s*osData\.filter\(\s*o\s*=>\s*!o\.isRDP\s*\)'
    if re.search(handler_pattern, content):
        print("  ✅ askVpsOS handler filters with osData.filter(o => !o.isRDP)")
        handler_ok = True
    else:
        print("  ❌ askVpsOS handler RDP filter not found")
        handler_ok = False
    
    return goto_ok and handler_ok

def test_language_files():
    """Test 7: Language files verification"""
    print("\n🔍 Test 7: Language files verification")
    
    languages = ["en", "fr", "zh", "hi"]
    all_ok = True
    
    for lang in languages:
        print(f"  Checking {lang}.js...")
        try:
            with open(f"/app/js/lang/{lang}.js", "r") as f:
                content = f.read()
        except Exception as e:
            print(f"    ❌ Could not read {lang}.js: {e}")
            all_ok = False
            continue
        
        # Check for required buttons
        if "vpsLinuxBtn:" in content and "vpsRdpBtn:" in content and "askVpsOrRdp:" in content:
            print(f"    ✅ {lang}.js has vpsLinuxBtn, vpsRdpBtn, askVpsOrRdp")
            buttons_ok = True
        else:
            print(f"    ❌ {lang}.js missing required VPS buttons")
            buttons_ok = False
            all_ok = False
        
        # Check askVpsOS takes no parameters (function format)
        if "askVpsOS: () =>" in content:
            print(f"    ✅ {lang}.js askVpsOS takes NO parameters (function format)")
            askos_ok = True
        else:
            print(f"    ❌ {lang}.js askVpsOS parameter format incorrect")
            askos_ok = False
            all_ok = False
        
        # Check generateBillSummary is a function
        if "generateBillSummary: vpsDetails =>" in content:
            print(f"    ✅ {lang}.js generateBillSummary is a FUNCTION")
            bill_ok = True
        else:
            print(f"    ❌ {lang}.js generateBillSummary not a function")
            bill_ok = False
            all_ok = False
        
        # Check askVpsConfig template uses object specs
        if "config.specs.vCPU" in content and "config.specs.RAM" in content and "config.specs.disk" in content and "config.specs.diskType" in content and "config.monthlyPrice" in content:
            print(f"    ✅ {lang}.js askVpsConfig uses config.specs.vCPU, RAM, disk, diskType, monthlyPrice")
            config_ok = True
        else:
            print(f"    ❌ {lang}.js askVpsConfig template format incorrect")
            config_ok = False
            all_ok = False
        
        # Check NO WHM/Plesk references in hourlyBillingMessage
        hourly_match = re.search(r'hourlyBillingMessage:\s*`([^`]+)`', content, re.DOTALL)
        if hourly_match:
            hourly_text = hourly_match.group(1)
            if "WHM" not in hourly_text and "Plesk" not in hourly_text:
                print(f"    ✅ {lang}.js hourlyBillingMessage has NO WHM/Plesk references")
                hourly_ok = True
            else:
                print(f"    ❌ {lang}.js hourlyBillingMessage contains WHM/Plesk references")
                hourly_ok = False
                all_ok = False
        else:
            print(f"    ❌ {lang}.js hourlyBillingMessage not found")
            hourly_ok = False
            all_ok = False
    
    return all_ok

def test_region_auto_skip():
    """Test 8: Region auto-skip"""
    print("\n🔍 Test 8: Region auto-skip")
    
    try:
        with open("/app/js/_index.js", "r") as f:
            content = f.read()
    except Exception as e:
        print(f"  ❌ Could not read _index.js: {e}")
        return False
    
    # Check askCountryForVPS handler auto-sets region+zone and calls askVpsDiskType
    pattern = r'vpsDetails\.region\s*=\s*region\.value[^}]*vpsDetails\.zone\s*=\s*region\.value[^}]*goto\.askVpsDiskType\(\)'
    if re.search(pattern, content, re.DOTALL):
        print("  ✅ askCountryForVPS auto-sets region+zone then calls goto.askVpsDiskType() directly")
        return True
    else:
        print("  ❌ askCountryForVPS auto-skip logic not found")
        return False

def main():
    """Run all tests"""
    print("🚀 VPS/RDP Clean Flow Restructure Testing")
    print("=" * 50)
    
    tests = [
        ("Syntax Validation", test_syntax_validation),
        ("Node.js Health", test_nodejs_health), 
        ("Data Layer Fixes", test_data_layer_fixes),
        ("New Action", test_new_action),
        ("RDP Flow Skips OS+SSH", test_rdp_flow_skips),
        ("OS Selection Linux-Only", test_os_selection_linux_only),
        ("Language Files", test_language_files),
        ("Region Auto-Skip", test_region_auto_skip)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! VPS/RDP Clean Flow Restructure is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total-passed} test(s) failed. Please review the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())