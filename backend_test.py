#!/usr/bin/env python3
"""
Backend Test for Bug Report #2 — Reseller API File Manager
Tests extract mis-destination, move/rename "Access denied", copy path duplication
against LIVE cPanel server 68.183.77.106 (account namea3a5, jailed to account home)
"""

import requests
import json
import time
import base64
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://2584b3e8-68cb-49ff-a2e3-3bf0f369edd1.preview.emergentagent.com/api/reseller/v1"
API_KEY = "rsk_live_testfix_namea3a5_filemgr_ssl_2026"
ACCOUNT = "namea3a5"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Unique timestamp suffix for temp directory
TS = str(int(time.time()))
TMP = f"public_html/nwv_{TS}"
TMP_D = f"public_html/nwv_{TS}_d"

# Test zip file (contains hello.txt with content "hello from nw_verify extract test\n")
ZIP_BASE64 = "UEsDBAoAAAAAANlJNl361aB0IgAAACIAAAAJAAAAaGVsbG8udHh0aGVsbG8gZnJvbSBud192ZXJpZnkgZXh0cmFjdCB0ZXN0ClBLAQIeAwoAAAAAANlJNl361aB0IgAAACIAAAAJAAAAAAAAAAEAAACkgQAAAABoZWxsby50eHRQSwUGAAAAAAEAAQA3AAAASQAAAAAA"

# Test results
test_results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    test_results["total"] += 1
    if passed:
        test_results["passed"] += 1
        status = "✅ PASS"
    else:
        test_results["failed"] += 1
        status = "❌ FAIL"
    
    test_results["tests"].append({
        "name": name,
        "passed": passed,
        "details": details
    })
    print(f"{status}: {name}")
    if details:
        print(f"  {details}")

def api_call(method: str, endpoint: str, data: Optional[Dict] = None, expect_status: int = 200) -> Dict[str, Any]:
    """Make API call and return response"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            resp = requests.get(url, headers=HEADERS, timeout=30)
        elif method == "POST":
            resp = requests.post(url, headers=HEADERS, json=data, timeout=30)
        elif method == "DELETE":
            resp = requests.delete(url, headers=HEADERS, json=data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        # Try to parse JSON
        try:
            result = resp.json()
        except:
            result = {"_raw_text": resp.text[:500]}
        
        result["_status_code"] = resp.status_code
        return result
    except Exception as e:
        return {
            "_error": str(e),
            "_status_code": 0
        }

def check_healed(response: Dict, test_name: str) -> bool:
    """Check if response shows successful healing via WHM fallback"""
    if response.get("_status_code") != 200:
        log_test(test_name, False, f"HTTP {response.get('_status_code')}: {response.get('_error', 'Unknown error')}")
        return False
    
    # Status is at top level, not inside data
    status = response.get("status")
    
    # Check for failure indicators
    if status == 0:
        errors = response.get("errors", [])
        code = response.get("code", "")
        session_fallback = response.get("session_fallback", "")
        
        if "Access denied" in str(errors) or code == "CPANEL_AUTH_FAILURE" or "whm-fallback-failed" in session_fallback:
            log_test(test_name, False, f"CPANEL_AUTH_FAILURE: status=0, code={code}, errors={errors}, session_fallback={session_fallback}")
            return False
    
    # Check for success with healing
    if status == 1:
        healed = response.get("healed", False)
        healed_via = response.get("healed_via", "")
        
        if healed and healed_via in ["whm-fallback", "whm-session", "whm-root-uapi"]:
            return True
        elif not healed:
            # Some operations might succeed without needing healing
            return True
    
    log_test(test_name, False, f"Unexpected response: status={status}, response={json.dumps(response, indent=2)[:500]}")
    return False

def verify_path(response: Dict, expected_src: str, expected_dest: str, test_name: str) -> bool:
    """Verify src and dest paths in response"""
    # Check both top level and data level for src/dest
    actual_src = response.get("src") or response.get("data", {}).get("src", "")
    actual_dest = response.get("dest") or response.get("data", {}).get("dest", "")
    
    src_match = actual_src == expected_src
    dest_match = actual_dest == expected_dest
    
    if src_match and dest_match:
        log_test(test_name, True, f"src={actual_src}, dest={actual_dest}")
        return True
    else:
        log_test(test_name, False, f"Path mismatch:\n  Expected src={expected_src}, dest={expected_dest}\n  Actual src={actual_src}, dest={actual_dest}")
        return False

def verify_file_in_listing(dir_path: str, filename: str, test_name: str) -> bool:
    """Verify file exists in directory listing"""
    resp = api_call("GET", f"/hosting/{ACCOUNT}/files?dir=/{dir_path}")
    
    if resp.get("_status_code") != 200:
        log_test(test_name, False, f"Failed to list directory: HTTP {resp.get('_status_code')}")
        return False
    
    # Files can be at top level "files" key, or "data" key (which is an array)
    files = resp.get("files")
    if files is None:
        data = resp.get("data")
        if isinstance(data, list):
            files = data
        elif isinstance(data, dict):
            files = data.get("files", [])
        else:
            files = []
    
    # Check if filename exists in the listing
    file_names = [f.get("name") or f.get("file") for f in files]
    
    if filename in file_names:
        log_test(test_name, True, f"File '{filename}' found in {dir_path}")
        return True
    else:
        log_test(test_name, False, f"File '{filename}' NOT found in {dir_path}. Files: {file_names}")
        return False

def cleanup_directory(dir_path: str, dir_name: str):
    """Clean up test directory"""
    print(f"\n🧹 Cleaning up: {dir_path}/{dir_name}")
    resp = api_call("DELETE", f"/hosting/{ACCOUNT}/files", {
        "dir": dir_path,
        "file": dir_name,
        "isDirectory": True
    })
    
    status = resp.get("status") or resp.get("data", {}).get("status")
    if resp.get("_status_code") == 200 and status == 1:
        print(f"✅ Cleanup successful: {dir_path}/{dir_name}")
    else:
        print(f"⚠️  Cleanup warning: {dir_path}/{dir_name} - {resp}")

def main():
    print("=" * 80)
    print("Bug Report #2 — Reseller API File Manager LIVE Test")
    print("=" * 80)
    print(f"Account: {ACCOUNT}")
    print(f"Server: 68.183.77.106 (LIVE)")
    print(f"Temp dir: {TMP}")
    print(f"Base URL: {BASE_URL}")
    print("=" * 80)
    print()
    
    try:
        # ========================================================================
        # STEP 1: Create temp directory
        # ========================================================================
        print("📁 STEP 1: Create temp directory")
        resp = api_call("POST", f"/hosting/{ACCOUNT}/files/mkdir", {
            "dir": "public_html",
            "name": f"nwv_{TS}"
        })
        
        if not check_healed(resp, "1. mkdir temp directory"):
            print("❌ Failed to create temp directory. Aborting.")
            return
        
        # ========================================================================
        # STEP 2: Upload zip file
        # ========================================================================
        print("\n📤 STEP 2: Upload zip file")
        resp = api_call("POST", f"/hosting/{ACCOUNT}/files/upload", {
            "dir": TMP,
            "fileName": "nw_verify.zip",
            "content_base64": ZIP_BASE64
        })
        
        if not check_healed(resp, "2. upload nw_verify.zip"):
            print("❌ Failed to upload zip. Aborting.")
            cleanup_directory("public_html", f"nwv_{TS}")
            return
        
        # ========================================================================
        # STEP 3: ISSUE A - Extract without destDir (should extract to same dir)
        # ========================================================================
        print("\n📦 STEP 3: ISSUE A - Extract without destDir")
        resp = api_call("POST", f"/hosting/{ACCOUNT}/files/extract", {
            "dir": TMP,
            "file": "nw_verify.zip"
        })
        
        if not check_healed(resp, "3a. extract without destDir (status check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            return
        
        # Verify paths
        expected_src = f"/home/{ACCOUNT}/{TMP}/nw_verify.zip"
        expected_dest = f"/home/{ACCOUNT}/{TMP}"
        
        if not verify_path(resp, expected_src, expected_dest, "3b. extract without destDir (path check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            return
        
        # Verify hello.txt is in the directory
        if not verify_file_in_listing(TMP, "hello.txt", "3c. extract without destDir (file listing check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            return
        
        # ========================================================================
        # STEP 4: ISSUE A - Extract with destDir (should honor destDir)
        # ========================================================================
        print("\n📦 STEP 4: ISSUE A - Extract with destDir")
        
        # Create destination directory
        resp = api_call("POST", f"/hosting/{ACCOUNT}/files/mkdir", {
            "dir": "public_html",
            "name": f"nwv_{TS}_d"
        })
        
        if not check_healed(resp, "4a. mkdir destination directory"):
            cleanup_directory("public_html", f"nwv_{TS}")
            return
        
        # Extract to destination directory
        resp = api_call("POST", f"/hosting/{ACCOUNT}/files/extract", {
            "dir": TMP,
            "file": "nw_verify.zip",
            "destDir": TMP_D
        })
        
        if not check_healed(resp, "4b. extract with destDir (status check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Verify paths
        expected_dest = f"/home/{ACCOUNT}/{TMP_D}"
        
        actual_dest = resp.get("dest") or resp.get("data", {}).get("dest", "")
        
        if actual_dest == expected_dest:
            log_test("4c. extract with destDir (path check)", True, f"dest={actual_dest}")
        else:
            log_test("4c. extract with destDir (path check)", False, f"Expected dest={expected_dest}, got {actual_dest}")
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Verify hello.txt is in the destination directory
        if not verify_file_in_listing(TMP_D, "hello.txt", "4d. extract with destDir (file listing check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # ========================================================================
        # STEP 5: ISSUE C - Copy (should not duplicate path)
        # ========================================================================
        print("\n📋 STEP 5: ISSUE C - Copy")
        
        # Create sub directory
        resp = api_call("POST", f"/hosting/{ACCOUNT}/files/mkdir", {
            "dir": TMP,
            "name": "sub"
        })
        
        if not check_healed(resp, "5a. mkdir sub directory"):
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Copy hello.txt to sub directory
        resp = api_call("POST", f"/hosting/{ACCOUNT}/files/copy", {
            "sourceDir": TMP,
            "fileName": "hello.txt",
            "destDir": f"{TMP}/sub"
        })
        
        if not check_healed(resp, "5b. copy hello.txt (status check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Verify dest path (should NOT duplicate sourceDir)
        expected_dest = f"/home/{ACCOUNT}/{TMP}/sub"
        
        actual_dest = resp.get("dest") or resp.get("data", {}).get("dest", "")
        
        # Check for path duplication bug
        if f"{TMP}/{TMP}" in actual_dest or f"/{TMP}/sub/{TMP}" in actual_dest:
            log_test("5c. copy (path duplication check)", False, f"Path duplication detected: dest={actual_dest}")
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        if actual_dest == expected_dest:
            log_test("5c. copy (path check)", True, f"dest={actual_dest}")
        else:
            log_test("5c. copy (path check)", False, f"Expected dest={expected_dest}, got {actual_dest}")
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Verify hello.txt is in sub directory
        if not verify_file_in_listing(f"{TMP}/sub", "hello.txt", "5d. copy (file listing check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # ========================================================================
        # STEP 6: ISSUE B - Move (should not get "Access denied")
        # ========================================================================
        print("\n🚚 STEP 6: ISSUE B - Move")
        
        resp = api_call("POST", f"/hosting/{ACCOUNT}/files/move", {
            "sourceDir": TMP,
            "fileName": "nw_verify.zip",
            "destDir": f"{TMP}/sub"
        })
        
        if not check_healed(resp, "6a. move nw_verify.zip (status check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Verify dest path
        expected_dest = f"/home/{ACCOUNT}/{TMP}/sub/nw_verify.zip"
        
        actual_dest = resp.get("dest") or resp.get("data", {}).get("dest", "")
        
        if actual_dest == expected_dest:
            log_test("6b. move (path check)", True, f"dest={actual_dest}")
        else:
            log_test("6b. move (path check)", False, f"Expected dest={expected_dest}, got {actual_dest}")
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Verify nw_verify.zip is in sub directory
        if not verify_file_in_listing(f"{TMP}/sub", "nw_verify.zip", "6c. move (file in dest check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Verify nw_verify.zip is NOT in source directory
        resp = api_call("GET", f"/hosting/{ACCOUNT}/files?dir=/{TMP}")
        files = resp.get("files")
        if files is None:
            data = resp.get("data")
            if isinstance(data, list):
                files = data
            elif isinstance(data, dict):
                files = data.get("files", [])
            else:
                files = []
        file_names = [f.get("name") or f.get("file") for f in files]
        
        if "nw_verify.zip" not in file_names:
            log_test("6d. move (file removed from source check)", True, f"nw_verify.zip removed from {TMP}")
        else:
            log_test("6d. move (file removed from source check)", False, f"nw_verify.zip still in {TMP}")
        
        # ========================================================================
        # STEP 7: ISSUE B - Rename (should not get "Access denied")
        # ========================================================================
        print("\n✏️  STEP 7: ISSUE B - Rename")
        
        resp = api_call("POST", f"/hosting/{ACCOUNT}/files/rename", {
            "dir": TMP,
            "oldName": "hello.txt",
            "newName": "hello_renamed.txt"
        })
        
        if not check_healed(resp, "7a. rename hello.txt (status check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Verify dest path
        expected_dest = f"/home/{ACCOUNT}/{TMP}/hello_renamed.txt"
        
        actual_dest = resp.get("dest") or resp.get("data", {}).get("dest", "")
        
        if actual_dest == expected_dest:
            log_test("7b. rename (path check)", True, f"dest={actual_dest}")
        else:
            log_test("7b. rename (path check)", False, f"Expected dest={expected_dest}, got {actual_dest}")
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Verify hello_renamed.txt exists
        if not verify_file_in_listing(TMP, "hello_renamed.txt", "7c. rename (new file exists check)"):
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
            return
        
        # Verify hello.txt does NOT exist
        resp = api_call("GET", f"/hosting/{ACCOUNT}/files?dir=/{TMP}")
        files = resp.get("files")
        if files is None:
            data = resp.get("data")
            if isinstance(data, list):
                files = data
            elif isinstance(data, dict):
                files = data.get("files", [])
            else:
                files = []
        file_names = [f.get("name") or f.get("file") for f in files]
        
        if "hello.txt" not in file_names:
            log_test("7d. rename (old file removed check)", True, f"hello.txt removed from {TMP}")
        else:
            log_test("7d. rename (old file removed check)", False, f"hello.txt still in {TMP}")
        
        # ========================================================================
        # STEP 8: REGRESSION - Verify reads still work
        # ========================================================================
        print("\n🔍 STEP 8: REGRESSION - Verify reads still work")
        
        resp = api_call("GET", f"/hosting/{ACCOUNT}/files?dir=/public_html")
        
        if resp.get("_status_code") == 200:
            status = resp.get("status")
            healed_via = resp.get("healed_via", "")
            
            if status == 1 and healed_via in ["whm-root-uapi", "whm-fallback", "whm-session"]:
                log_test("8. regression - list public_html", True, f"status=1, healed_via={healed_via}")
            else:
                log_test("8. regression - list public_html", False, f"Unexpected response: status={status}, healed_via={healed_via}")
        else:
            log_test("8. regression - list public_html", False, f"HTTP {resp.get('_status_code')}")
        
        # ========================================================================
        # STEP 9: CLEANUP
        # ========================================================================
        print("\n🧹 STEP 9: CLEANUP")
        
        cleanup_directory("public_html", f"nwv_{TS}")
        cleanup_directory("public_html", f"nwv_{TS}_d")
        
        # Verify cleanup
        resp = api_call("GET", f"/hosting/{ACCOUNT}/files?dir=/public_html")
        files = resp.get("files")
        if files is None:
            data = resp.get("data")
            if isinstance(data, list):
                files = data
            elif isinstance(data, dict):
                files = data.get("files", [])
            else:
                files = []
        file_names = [f.get("name") or f.get("file") for f in files]
        
        if f"nwv_{TS}" not in file_names and f"nwv_{TS}_d" not in file_names:
            log_test("9. cleanup verification", True, f"Both temp directories removed")
        else:
            log_test("9. cleanup verification", False, f"Temp directories still exist: {file_names}")
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        
        # Attempt cleanup
        try:
            cleanup_directory("public_html", f"nwv_{TS}")
            cleanup_directory("public_html", f"nwv_{TS}_d")
        except:
            pass
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total tests: {test_results['total']}")
    print(f"Passed: {test_results['passed']} ✅")
    print(f"Failed: {test_results['failed']} ❌")
    print(f"Pass rate: {test_results['passed'] / test_results['total'] * 100:.1f}%")
    print("=" * 80)
    
    if test_results['failed'] > 0:
        print("\n❌ FAILED TESTS:")
        for test in test_results['tests']:
            if not test['passed']:
                print(f"  • {test['name']}")
                if test['details']:
                    print(f"    {test['details']}")
        sys.exit(1)
    else:
        print("\n✅ ALL TESTS PASSED!")
        sys.exit(0)

if __name__ == "__main__":
    main()
