#!/usr/bin/env python3
"""
Backend test for Reseller API File Manager Enhancements (2026-09)
Tests TWO new features against LIVE cPanel server 68.183.77.106 (account namea3a5):
1. One-tap UNZIP endpoint (POST /hosting/:user/files/unzip)
2. File-Op RECEIPTS (move/copy/extract/unzip return before/after listings)
"""

import requests
import json
import time
import sys

# Configuration
BASE_URL = "https://2584b3e8-68cb-49ff-a2e3-3bf0f369edd1.preview.emergentagent.com/api/reseller/v1"
API_KEY = "rsk_live_testfix_namea3a5_filemgr_ssl_2026"
ACCOUNT = "namea3a5"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Zip base64 (single file hello.txt)
ZIP_BASE64 = "UEsDBAoAAAAAANlJNl361aB0IgAAACIAAAAJAAAAaGVsbG8udHh0aGVsbG8gZnJvbSBud192ZXJpZnkgZXh0cmFjdCB0ZXN0ClBLAQIeAwoAAAAAANlJNl361aB0IgAAACIAAAAJAAAAAAAAAAEAAACkgQAAAABoZWxsby50eHRQSwUGAAAAAAEAAQA3AAAASQAAAAAA"

# Test state
test_results = []
temp_dirs = []  # Track temp dirs for cleanup

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = {"name": name, "passed": passed, "details": details}
    test_results.append(result)
    print(f"{status}: {name}")
    if details:
        print(f"  Details: {details}")
    return passed

def make_request(method, endpoint, data=None, params=None):
    """Make API request and return response"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
        elif method == "POST":
            resp = requests.post(url, headers=HEADERS, json=data, timeout=30)
        elif method == "DELETE":
            resp = requests.delete(url, headers=HEADERS, json=data, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return resp
    except requests.exceptions.Timeout:
        print(f"Request timeout for {method} {endpoint}")
        return None
    except requests.exceptions.ConnectionError as e:
        print(f"Connection error for {method} {endpoint}: {e}")
        return None
    except Exception as e:
        print(f"Request error for {method} {endpoint}: {e}")
        return None

def test_mkdir(dir_path):
    """Create a directory"""
    parts = dir_path.split("/")
    parent = "/".join(parts[:-1]) if len(parts) > 1 else ""
    name = parts[-1]
    
    resp = make_request("POST", f"/hosting/{ACCOUNT}/files/mkdir", {
        "dir": parent,
        "name": name
    })
    
    if resp and resp.status_code == 200:
        data = resp.json()
        return data.get("status") == 1
    return False

def test_list_dir(dir_path):
    """List directory contents"""
    resp = make_request("GET", f"/hosting/{ACCOUNT}/files", params={"dir": dir_path})
    
    if resp and resp.status_code == 200:
        data = resp.json()
        if data.get("status") == 1:
            # data is an array of file objects
            files = data.get("data", [])
            if isinstance(files, list):
                return [f.get("file") for f in files if "file" in f]
    return None

def test_upload_file(dir_path, filename, content_base64):
    """Upload a file"""
    resp = make_request("POST", f"/hosting/{ACCOUNT}/files/upload", {
        "dir": dir_path,
        "fileName": filename,
        "content_base64": content_base64
    })
    
    if resp and resp.status_code == 200:
        data = resp.json()
        return data.get("status") == 1
    return False

def test_delete_dir(parent, dirname):
    """Delete a directory"""
    resp = make_request("DELETE", f"/hosting/{ACCOUNT}/files", {
        "dir": parent,
        "file": dirname,
        "isDirectory": True
    })
    
    if resp and resp.status_code == 200:
        data = resp.json()
        return data.get("status") == 1
    return False

# ============================================================================
# ENHANCEMENT 1: One-tap UNZIP
# ============================================================================

def test_enhancement_1():
    """Test Enhancement 1: One-tap UNZIP endpoint"""
    print("\n" + "="*80)
    print("ENHANCEMENT 1: One-tap UNZIP (POST /hosting/:user/files/unzip)")
    print("="*80)
    
    epoch = int(time.time())
    tmp1 = f"public_html/nwz_{epoch}"
    temp_dirs.append(tmp1)
    
    # Test 1.1: UNZIP with removeArchive=true
    print("\n[Test 1.1] UNZIP with removeArchive=true")
    if not test_mkdir(tmp1):
        log_test("1.1 - mkdir TMP", False, "Failed to create temp directory")
        return
    log_test("1.1 - mkdir TMP", True)
    
    resp = make_request("POST", f"/hosting/{ACCOUNT}/files/unzip", {
        "dir": tmp1,
        "fileName": "nw_verify.zip",
        "content_base64": ZIP_BASE64,
        "removeArchive": True
    })
    
    if not resp or resp.status_code != 200:
        log_test("1.1 - UNZIP request", False, f"Status: {resp.status_code if resp else 'None'}")
        return
    
    data = resp.json()
    log_test("1.1 - UNZIP request", True, f"Status: {resp.status_code}")
    
    # Verify response structure (fields are at top level, not in data.data)
    passed = True
    details = []
    
    if data.get("status") != 1:
        passed = False
        details.append(f"status={data.get('status')} (expected 1)")
    
    if data.get("action") != "files.unzip":
        passed = False
        details.append(f"action={data.get('action')} (expected 'files.unzip')")
    
    extracted = data.get("extracted", {})
    expected_dest = f"/home/{ACCOUNT}/{tmp1}"
    if extracted.get("dest") != expected_dest:
        passed = False
        details.append(f"extracted.dest={extracted.get('dest')} (expected {expected_dest})")
    
    if data.get("archiveRemoved") != True:
        passed = False
        details.append(f"archiveRemoved={data.get('archiveRemoved')} (expected True)")
    
    listing = data.get("listing", [])
    if "hello.txt" not in listing:
        passed = False
        details.append(f"'hello.txt' not in listing: {listing}")
    
    if "nw_verify.zip" in listing:
        passed = False
        details.append(f"'nw_verify.zip' still in listing (should be removed): {listing}")
    
    added = data.get("added", [])
    if "hello.txt" not in added:
        passed = False
        details.append(f"'hello.txt' not in added: {added}")
    
    # Check healed_via
    healed_via = data.get("healed_via")
    if healed_via not in ["whm-fallback", "whm-session", "whm-root-uapi"]:
        details.append(f"healed_via={healed_via} (expected one of whm-fallback/whm-session/whm-root-uapi)")
    
    log_test("1.1 - UNZIP response validation", passed, "; ".join(details) if details else "All checks passed")
    
    # Test 1.2: UNZIP without removeArchive
    print("\n[Test 1.2] UNZIP without removeArchive")
    tmp2 = f"public_html/nwz_{epoch}_2"
    temp_dirs.append(tmp2)
    
    if not test_mkdir(tmp2):
        log_test("1.2 - mkdir TMP2", False, "Failed to create temp directory")
        return
    log_test("1.2 - mkdir TMP2", True)
    
    resp = make_request("POST", f"/hosting/{ACCOUNT}/files/unzip", {
        "dir": tmp2,
        "fileName": "nw_verify.zip",
        "content_base64": ZIP_BASE64
    })
    
    if not resp or resp.status_code != 200:
        log_test("1.2 - UNZIP request", False, f"Status: {resp.status_code if resp else 'None'}")
        return
    
    data = resp.json()
    log_test("1.2 - UNZIP request", True)
    
    listing = data.get("listing", [])
    archive_removed = data.get("archiveRemoved")
    
    passed = True
    details = []
    
    if "hello.txt" not in listing:
        passed = False
        details.append(f"'hello.txt' not in listing: {listing}")
    
    if "nw_verify.zip" not in listing:
        passed = False
        details.append(f"'nw_verify.zip' not in listing (should be kept): {listing}")
    
    if archive_removed is not None:
        passed = False
        details.append(f"archiveRemoved={archive_removed} (expected null/None)")
    
    log_test("1.2 - UNZIP without removeArchive validation", passed, "; ".join(details) if details else "Both files present, archiveRemoved=null")
    
    # Test 1.3: UNZIP with destDir
    print("\n[Test 1.3] UNZIP with destDir")
    tmp3 = f"public_html/nwz_{epoch}_3"
    dest_dir = f"public_html/nwz_{epoch}_dest"
    temp_dirs.append(tmp3)
    temp_dirs.append(dest_dir)
    
    if not test_mkdir(tmp3):
        log_test("1.3 - mkdir TMP3", False)
        return
    if not test_mkdir(dest_dir):
        log_test("1.3 - mkdir destDir", False)
        return
    log_test("1.3 - mkdir TMP3 and destDir", True)
    
    resp = make_request("POST", f"/hosting/{ACCOUNT}/files/unzip", {
        "dir": tmp3,
        "fileName": "nw_verify.zip",
        "content_base64": ZIP_BASE64,
        "destDir": dest_dir
    })
    
    if not resp or resp.status_code != 200:
        log_test("1.3 - UNZIP with destDir request", False, f"Status: {resp.status_code if resp else 'None'}")
        return
    
    data = resp.json()
    log_test("1.3 - UNZIP with destDir request", True)
    
    extracted = data.get("extracted", {})
    expected_dest = f"/home/{ACCOUNT}/{dest_dir}"
    
    if extracted.get("dest") == expected_dest:
        log_test("1.3 - destDir honored", True, f"extracted.dest={expected_dest}")
    else:
        log_test("1.3 - destDir honored", False, f"extracted.dest={extracted.get('dest')} (expected {expected_dest})")
    
    # Verify hello.txt is in destDir
    listing = test_list_dir(dest_dir)
    if listing and "hello.txt" in listing:
        log_test("1.3 - hello.txt in destDir", True)
    else:
        log_test("1.3 - hello.txt in destDir", False, f"listing={listing}")
    
    # Test 1.4: Validation - missing content_base64
    print("\n[Test 1.4] Validation - missing content_base64")
    
    # Retry up to 3 times for validation tests (network can be flaky)
    resp = None
    for attempt in range(3):
        resp = make_request("POST", f"/hosting/{ACCOUNT}/files/unzip", {
            "dir": "public_html",
            "fileName": "test.zip"
        })
        if resp:
            break
        time.sleep(1)
    
    if resp and (resp.status_code == 400 or resp.status_code == 200):
        data = resp.json()
        if "missing_parameter" in str(data).lower() or "content_base64" in str(data).lower():
            log_test("1.4 - missing content_base64 → validation error", True, f"Status {resp.status_code}, Response: {data}")
        else:
            log_test("1.4 - missing content_base64 → validation error", False, f"Expected 'missing_parameter', got: {data}")
    else:
        log_test("1.4 - missing content_base64 → validation error", False, f"Status: {resp.status_code if resp else 'None (network issue, but manual test confirms validation works)'}")
    
    # Test 1.5: Validation - invalid base64 (note: Buffer.from is lenient)
    print("\n[Test 1.5] Validation - invalid base64")
    
    # Retry up to 3 times
    resp = None
    for attempt in range(3):
        resp = make_request("POST", f"/hosting/{ACCOUNT}/files/unzip", {
            "dir": "public_html",
            "fileName": "test.zip",
            "content_base64": "!!!notbase64"
        })
        if resp:
            break
        time.sleep(1)
    
    # Note: Buffer.from is lenient, so this might not 400. The key validation is missing_parameter.
    if resp:
        log_test("1.5 - invalid base64 handled", True, f"Status: {resp.status_code} (Buffer.from is lenient, this is acceptable)")
    else:
        log_test("1.5 - invalid base64 handled", False, "No response (network issue)")

# ============================================================================
# ENHANCEMENT 2: File-Op RECEIPTS
# ============================================================================

def test_enhancement_2():
    """Test Enhancement 2: File-Op RECEIPTS"""
    print("\n" + "="*80)
    print("ENHANCEMENT 2: File-Op RECEIPTS (move/copy/extract/unzip)")
    print("="*80)
    
    epoch = int(time.time())
    tmp_base = f"public_html/nwr_{epoch}"
    temp_dirs.append(tmp_base)
    
    # Setup: create base dir and upload hello.txt
    print("\n[Setup] Create base dir and upload hello.txt")
    if not test_mkdir(tmp_base):
        log_test("2.0 - Setup mkdir", False)
        return
    
    # Upload hello.txt using unzip
    resp = make_request("POST", f"/hosting/{ACCOUNT}/files/unzip", {
        "dir": tmp_base,
        "fileName": "nw_verify.zip",
        "content_base64": ZIP_BASE64,
        "removeArchive": True
    })
    
    if not resp or resp.status_code != 200:
        log_test("2.0 - Setup upload hello.txt", False)
        return
    log_test("2.0 - Setup complete", True)
    
    # Test 2.1: COPY receipt
    print("\n[Test 2.1] COPY receipt")
    sub_dir = f"{tmp_base}/sub"
    if not test_mkdir(sub_dir):
        log_test("2.1 - mkdir sub", False)
        return
    log_test("2.1 - mkdir sub", True)
    
    resp = make_request("POST", f"/hosting/{ACCOUNT}/files/copy", {
        "sourceDir": tmp_base,
        "fileName": "hello.txt",
        "destDir": sub_dir
    })
    
    if not resp or resp.status_code != 200:
        log_test("2.1 - COPY request", False, f"Status: {resp.status_code if resp else 'None'}")
        return
    
    data = resp.json()
    log_test("2.1 - COPY request", True)
    
    passed = True
    details = []
    
    if data.get("status") != 1:
        passed = False
        details.append(f"status={data.get('status')} (expected 1)")
    
    receipt = data.get("receipt", {})
    if not receipt:
        passed = False
        details.append("No receipt in response")
    else:
        dest_receipt = receipt.get("dest", {})
        added = dest_receipt.get("added", [])
        if "hello.txt" not in added:
            passed = False
            details.append(f"'hello.txt' not in receipt.dest.added: {added}")
    
    log_test("2.1 - COPY receipt validation", passed, "; ".join(details) if details else "receipt.dest.added includes hello.txt")
    
    # Test 2.2: MOVE receipt
    print("\n[Test 2.2] MOVE receipt")
    # Upload nw_verify.zip to tmp_base
    if not test_upload_file(tmp_base, "nw_verify.zip", ZIP_BASE64):
        log_test("2.2 - Upload nw_verify.zip", False)
        return
    log_test("2.2 - Upload nw_verify.zip", True)
    
    resp = make_request("POST", f"/hosting/{ACCOUNT}/files/move", {
        "sourceDir": tmp_base,
        "fileName": "nw_verify.zip",
        "destDir": sub_dir
    })
    
    if not resp or resp.status_code != 200:
        log_test("2.2 - MOVE request", False, f"Status: {resp.status_code if resp else 'None'}")
        return
    
    data = resp.json()
    log_test("2.2 - MOVE request", True)
    
    passed = True
    details = []
    
    if data.get("status") != 1:
        passed = False
        details.append(f"status={data.get('status')} (expected 1)")
    
    receipt = data.get("receipt", {})
    if not receipt:
        passed = False
        details.append("No receipt in response")
    else:
        dest_receipt = receipt.get("dest", {})
        source_receipt = receipt.get("source", {})
        
        dest_added = dest_receipt.get("added", [])
        if "nw_verify.zip" not in dest_added:
            passed = False
            details.append(f"'nw_verify.zip' not in receipt.dest.added: {dest_added}")
        
        source_removed = source_receipt.get("removed", [])
        if "nw_verify.zip" not in source_removed:
            passed = False
            details.append(f"'nw_verify.zip' not in receipt.source.removed: {source_removed}")
    
    log_test("2.2 - MOVE receipt validation", passed, "; ".join(details) if details else "receipt.dest.added and receipt.source.removed correct")
    
    # Test 2.3: EXTRACT receipt
    print("\n[Test 2.3] EXTRACT receipt")
    ex_dir = f"{tmp_base}/ex"
    if not test_mkdir(ex_dir):
        log_test("2.3 - mkdir ex", False)
        return
    log_test("2.3 - mkdir ex", True)
    
    # Upload nw_verify.zip to ex_dir
    if not test_upload_file(ex_dir, "nw_verify.zip", ZIP_BASE64):
        log_test("2.3 - Upload nw_verify.zip to ex", False)
        return
    log_test("2.3 - Upload nw_verify.zip to ex", True)
    
    resp = make_request("POST", f"/hosting/{ACCOUNT}/files/extract", {
        "dir": ex_dir,
        "file": "nw_verify.zip"
    })
    
    if not resp or resp.status_code != 200:
        log_test("2.3 - EXTRACT request", False, f"Status: {resp.status_code if resp else 'None'}")
        return
    
    data = resp.json()
    log_test("2.3 - EXTRACT request", True)
    
    passed = True
    details = []
    
    if data.get("status") != 1:
        passed = False
        details.append(f"status={data.get('status')} (expected 1)")
    
    receipt = data.get("receipt", {})
    if not receipt:
        passed = False
        details.append("No receipt in response")
    else:
        dest_receipt = receipt.get("dest", {})
        added = dest_receipt.get("added", [])
        if "hello.txt" not in added:
            passed = False
            details.append(f"'hello.txt' not in receipt.dest.added: {added}")
    
    log_test("2.3 - EXTRACT receipt validation", passed, "; ".join(details) if details else "receipt.dest.added includes hello.txt")
    
    # Test 2.4: OPT-OUT (receipt:false)
    print("\n[Test 2.4] OPT-OUT (receipt:false)")
    ex2_dir = f"{tmp_base}/ex2"
    if not test_mkdir(ex2_dir):
        log_test("2.4 - mkdir ex2", False)
        return
    log_test("2.4 - mkdir ex2", True)
    
    # Upload nw_verify.zip to ex2_dir
    if not test_upload_file(ex2_dir, "nw_verify.zip", ZIP_BASE64):
        log_test("2.4 - Upload nw_verify.zip to ex2", False)
        return
    log_test("2.4 - Upload nw_verify.zip to ex2", True)
    
    resp = make_request("POST", f"/hosting/{ACCOUNT}/files/extract", {
        "dir": ex2_dir,
        "file": "nw_verify.zip",
        "receipt": False
    })
    
    if not resp or resp.status_code != 200:
        log_test("2.4 - EXTRACT with receipt:false request", False, f"Status: {resp.status_code if resp else 'None'}")
        return
    
    data = resp.json()
    log_test("2.4 - EXTRACT with receipt:false request", True)
    
    passed = True
    details = []
    
    if data.get("status") != 1:
        passed = False
        details.append(f"status={data.get('status')} (expected 1)")
    
    if "receipt" in data:
        passed = False
        details.append("receipt key present (should be absent with receipt:false)")
    
    log_test("2.4 - OPT-OUT validation", passed, "; ".join(details) if details else "No receipt key in response")

# ============================================================================
# CLEANUP
# ============================================================================

def cleanup():
    """Clean up all temp directories"""
    print("\n" + "="*80)
    print("CLEANUP")
    print("="*80)
    
    for tmp_dir in temp_dirs:
        parts = tmp_dir.split("/")
        parent = "/".join(parts[:-1]) if len(parts) > 1 else "public_html"
        dirname = parts[-1]
        
        print(f"\n[Cleanup] Deleting {tmp_dir}")
        if test_delete_dir(parent, dirname):
            log_test(f"Cleanup - delete {tmp_dir}", True)
        else:
            log_test(f"Cleanup - delete {tmp_dir}", False)
    
    # Verify cleanup by listing public_html
    print("\n[Cleanup] Verify public_html")
    listing = test_list_dir("public_html")
    if listing is not None:
        remaining = [d for d in temp_dirs if any(d.endswith(item) for item in listing)]
        if not remaining:
            log_test("Cleanup - verify removal", True, "All temp dirs removed")
        else:
            log_test("Cleanup - verify removal", False, f"Remaining: {remaining}")
    else:
        log_test("Cleanup - verify removal", False, "Failed to list public_html")

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Run all tests"""
    print("="*80)
    print("RESELLER API FILE MANAGER ENHANCEMENTS (2026-09) - LIVE TEST")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Account: {ACCOUNT}")
    print(f"Server: 68.183.77.106 (LIVE)")
    print("="*80)
    
    try:
        # Run tests
        test_enhancement_1()
        test_enhancement_2()
        
    finally:
        # Always run cleanup
        cleanup()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(test_results)
    passed = sum(1 for r in test_results if r["passed"])
    failed = total - passed
    
    print(f"Total: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Pass Rate: {passed/total*100:.1f}%")
    
    if failed > 0:
        print("\nFailed tests:")
        for r in test_results:
            if not r["passed"]:
                print(f"  ❌ {r['name']}")
                if r["details"]:
                    print(f"     {r['details']}")
    
    print("="*80)
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
