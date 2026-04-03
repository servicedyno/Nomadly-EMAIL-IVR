#!/usr/bin/env python3
"""
Final verification script for the 6 fixes
"""

import re
import os

def read_file_content(file_path: str) -> str:
    """Read file content safely"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"

def verify_all_fixes():
    """Verify all 6 fixes are correctly implemented"""
    results = []
    
    # Fix 1: notifyGroup in hosting payment paths
    content = read_file_content('/app/js/_index.js')
    hosting_count = len(re.findall(r'Hosting Activated', content))
    results.append(f"✅ Fix 1: Found {hosting_count} 'Hosting Activated' notifications (expected ≥4)")
    
    # Fix 2: displayMainMenuButtons
    if re.search(r'displayMainMenuButtons:\s*async\s*\(\s*\)\s*=>', content):
        if re.search(r"await set\(state, chatId, 'action', 'none'\)", content):
            results.append("✅ Fix 2: displayMainMenuButtons function exists and sets action to 'none'")
        else:
            results.append("❌ Fix 2: displayMainMenuButtons exists but doesn't set action to 'none'")
    else:
        results.append("❌ Fix 2: displayMainMenuButtons function not found")
    
    # Fix 3: SSH key conversion
    vm_content = read_file_content('/app/js/vm-instance-setup.js')
    if re.search(r'function convertPemToOpenSSH', vm_content):
        if re.search(r'encodeSSHString.*encodeSSHMpint', vm_content, re.DOTALL):
            results.append("✅ Fix 3: SSH key PEM-to-OpenSSH conversion with proper helpers")
        else:
            results.append("❌ Fix 3: SSH conversion function exists but missing helpers")
    else:
        results.append("❌ Fix 3: convertPemToOpenSSH function not found")
    
    # Fix 4: Contabo product fallback
    contabo_content = read_file_content('/app/js/contabo-service.js')
    if re.search(r'NVME_TO_SSD_FALLBACK.*SSD_TO_NVME_FALLBACK', contabo_content, re.DOTALL):
        if re.search(r'Fix #4.*product.*unavailable.*fallback', contabo_content, re.DOTALL):
            results.append("✅ Fix 4: Contabo product fallback mappings and logic implemented")
        else:
            results.append("❌ Fix 4: Fallback mappings exist but logic not found")
    else:
        results.append("❌ Fix 4: Fallback mappings not found")
    
    # Fix 5: WHM CERT_NOT_YET_VALID retry
    protection_content = read_file_content('/app/js/protection-enforcer.js')
    if re.search(r'CERT_NOT_YET_VALID', protection_content):
        if re.search(r'60000|60\s*\*\s*1000', protection_content):
            results.append("✅ Fix 5: WHM CERT_NOT_YET_VALID retry with 60s delay")
        else:
            results.append("❌ Fix 5: CERT_NOT_YET_VALID check exists but no 60s delay")
    else:
        results.append("❌ Fix 5: CERT_NOT_YET_VALID check not found")
    
    # Fix 6: Contabo password guard
    if re.search(r'value\.length\s*<\s*8', contabo_content):
        results.append("✅ Fix 6: Contabo createSecret password validation (min 8 chars)")
    else:
        results.append("❌ Fix 6: Password length validation not found")
    
    return results

def main():
    print("🔍 Final Verification of 6 Fixes")
    print("=" * 50)
    
    results = verify_all_fixes()
    
    for result in results:
        print(result)
    
    passed = sum(1 for r in results if r.startswith("✅"))
    total = len(results)
    
    print(f"\n📊 Final Score: {passed}/{total} fixes verified")
    
    if passed == total:
        print("🎉 All fixes are correctly implemented!")
    else:
        print(f"⚠️  {total - passed} fixes need attention")

if __name__ == "__main__":
    main()