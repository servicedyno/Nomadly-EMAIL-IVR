#!/usr/bin/env python3
"""
cPanel Panel Backend Test - Broken User Auth Fallback Verification
Tests account nbayftest / testingbays.sbs with DEAD user-level cPanel auth.
All operations must succeed via WHM-root fallback (no 401/403/500, no HTML login page).
"""

import requests
import json
import sys
import time

# Base URL from frontend/.env
BASE_URL = "https://credential-staging.preview.emergentagent.com"

# Test credentials
USERNAME = "nbayftest"
PIN = "241743"
DOMAIN = "testingbays.sbs"

# Test artifacts (will be created and cleaned up)
TEST_SUBDOMAINS = ["qatest1", "qabulk1", "qabulk2"]

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name, details=""):
        self.passed.append((test_name, details))
        print(f"{GREEN}✅ PASS{RESET}: {test_name}")
        if details:
            print(f"   {details}")
    
    def add_fail(self, test_name, details=""):
        self.failed.append((test_name, details))
        print(f"{RED}❌ FAIL{RESET}: {test_name}")
        if details:
            print(f"   {details}")
    
    def add_warning(self, test_name, details=""):
        self.warnings.append((test_name, details))
        print(f"{YELLOW}⚠️  WARN{RESET}: {test_name}")
        if details:
            print(f"   {details}")
    
    def summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"✅ Passed: {len(self.passed)}")
        print(f"❌ Failed: {len(self.failed)}")
        print(f"⚠️  Warnings: {len(self.warnings)}")
        
        if self.failed:
            print(f"\n{RED}FAILED TESTS:{RESET}")
            for name, details in self.failed:
                print(f"  • {name}")
                if details:
                    print(f"    {details}")
        
        if self.warnings:
            print(f"\n{YELLOW}WARNINGS:{RESET}")
            for name, details in self.warnings:
                print(f"  • {name}")
                if details:
                    print(f"    {details}")
        
        return len(self.failed) == 0

def check_html_leak(response_text, test_name):
    """Check if response contains cPanel login page HTML"""
    if "<!DOCTYPE html>" in response_text or "<!DOCTYPE HTML>" in response_text.upper():
        return f"Response contains HTML login page (auth leak detected)"
    return None

def check_subdomain_doubling(subdomain_name, root_domain):
    """Check if subdomain name is doubled like 'sub.domain.com.domain.com'"""
    expected = f"{subdomain_name}.{root_domain}"
    doubled = f"{subdomain_name}.{root_domain}.{root_domain}"
    return expected, doubled

def main():
    results = TestResults()
    token = None
    created_subdomains = []
    
    print("="*80)
    print("cPanel Panel Backend Test - Broken User Auth Fallback")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Account: {USERNAME} / {DOMAIN}")
    print(f"Expected: All operations succeed via WHM-root fallback")
    print("="*80 + "\n")
    
    # ========================================================================
    # A. LOGIN
    # ========================================================================
    print("\n[A] LOGIN TEST")
    print("-" * 80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/panel/login",
            json={"username": USERNAME, "pin": PIN},
            timeout=30
        )
        
        if response.status_code == 429:
            results.add_warning("Login rate-limited (429)", "Waiting 5s and retrying...")
            time.sleep(5)
            response = requests.post(
                f"{BASE_URL}/api/panel/login",
                json={"username": USERNAME, "pin": PIN},
                timeout=30
            )
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                token = data["token"]
                results.add_pass("Login successful", f"Token received, domain: {data.get('domain', 'N/A')}")
                
                # Check for HTML leak
                html_leak = check_html_leak(response.text, "Login")
                if html_leak:
                    results.add_fail("Login response contains HTML", html_leak)
            else:
                results.add_fail("Login missing token", f"Response: {data}")
        else:
            results.add_fail(f"Login failed with status {response.status_code}", response.text[:200])
    except Exception as e:
        results.add_fail("Login exception", str(e))
        print(f"\n{RED}Cannot proceed without login token. Exiting.{RESET}")
        return False
    
    if not token:
        print(f"\n{RED}Cannot proceed without login token. Exiting.{RESET}")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # ========================================================================
    # B. SESSION
    # ========================================================================
    print("\n[B] SESSION TEST")
    print("-" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/panel/session", headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            html_leak = check_html_leak(response.text, "Session")
            
            if html_leak:
                results.add_fail("Session response contains HTML", html_leak)
            elif "username" in data or "domain" in data:
                results.add_pass("Session endpoint", f"Username: {data.get('username', 'N/A')}, Domain: {data.get('domain', 'N/A')}")
            else:
                results.add_fail("Session missing expected fields", f"Response: {data}")
        else:
            results.add_fail(f"Session failed with status {response.status_code}", response.text[:200])
    except Exception as e:
        results.add_fail("Session exception", str(e))
    
    # ========================================================================
    # C. DOMAINS LIST
    # ========================================================================
    print("\n[C] DOMAINS LIST TEST")
    print("-" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/panel/domains", headers=headers, timeout=30)
        
        if response.status_code == 200:
            html_leak = check_html_leak(response.text, "Domains")
            
            if html_leak:
                results.add_fail("Domains response contains HTML", html_leak)
            else:
                try:
                    data = response.json()
                    # Handle nested structure: {status: 1, data: {main_domain: ...}}
                    if isinstance(data, dict):
                        if "main_domain" in data:
                            results.add_pass("Domains list", f"Main domain: {data.get('main_domain', 'N/A')}")
                        elif "data" in data and isinstance(data["data"], dict) and "main_domain" in data["data"]:
                            results.add_pass("Domains list", f"Main domain: {data['data'].get('main_domain', 'N/A')}")
                        else:
                            results.add_fail("Domains unexpected format", f"Response: {data}")
                    elif isinstance(data, list):
                        results.add_pass("Domains list", f"Returned {len(data)} domains")
                    else:
                        results.add_fail("Domains unexpected format", f"Response: {data}")
                except json.JSONDecodeError:
                    results.add_fail("Domains response not JSON", response.text[:200])
        else:
            results.add_fail(f"Domains failed with status {response.status_code}", response.text[:200])
    except Exception as e:
        results.add_fail("Domains exception", str(e))
    
    # ========================================================================
    # D. SUBDOMAINS LIST
    # ========================================================================
    print("\n[D] SUBDOMAINS LIST TEST")
    print("-" * 80)
    
    existing_subdomains = []
    try:
        response = requests.get(f"{BASE_URL}/api/panel/subdomains", headers=headers, timeout=30)
        
        if response.status_code == 200:
            html_leak = check_html_leak(response.text, "Subdomains")
            
            if html_leak:
                results.add_fail("Subdomains response contains HTML", html_leak)
            else:
                try:
                    data = response.json()
                    if isinstance(data, dict) and "data" in data:
                        subdomains = data["data"]
                        existing_subdomains = [s.get("domain", s.get("subdomain", "")) for s in subdomains]
                        
                        # Check for expected subdomains
                        expected = ["shop", "blog", "api", "dev"]
                        found = [s for s in expected if any(s in sub for sub in existing_subdomains)]
                        
                        results.add_pass("Subdomains list", f"Found {len(subdomains)} subdomains (expected: {', '.join(expected)})")
                        
                        # Check for doubling
                        for sub in subdomains:
                            sub_name = sub.get("domain", sub.get("subdomain", ""))
                            if sub_name.count(DOMAIN) > 1:
                                results.add_fail(f"Subdomain name doubled: {sub_name}", "Name contains domain twice")
                    else:
                        results.add_fail("Subdomains unexpected format", f"Response: {data}")
                except json.JSONDecodeError:
                    results.add_fail("Subdomains response not JSON", response.text[:200])
        else:
            results.add_fail(f"Subdomains failed with status {response.status_code}", response.text[:200])
    except Exception as e:
        results.add_fail("Subdomains exception", str(e))
    
    # ========================================================================
    # E. FILE CONTENT READ
    # ========================================================================
    print("\n[E] FILE CONTENT READ TEST")
    print("-" * 80)
    
    try:
        # First, list files in public_html to find a real file
        response = requests.get(
            f"{BASE_URL}/api/panel/files",
            params={"dir": "/public_html"},
            headers=headers,
            timeout=60
        )
        
        if response.status_code == 200:
            html_leak = check_html_leak(response.text, "Files list")
            
            if html_leak:
                results.add_fail("Files list response contains HTML", html_leak)
            else:
                try:
                    data = response.json()
                    files = data.get("data", []) if isinstance(data, dict) else data
                    
                    # Find a readable file (not directory)
                    readable_file = None
                    for f in files:
                        if isinstance(f, dict):
                            # Check if it's a file (not a directory)
                            if f.get("type") == "file" and not f.get("dir", False):
                                readable_file = f.get("name", f.get("file"))
                                break
                    
                    if readable_file:
                        # Try to read the file content
                        response = requests.get(
                            f"{BASE_URL}/api/panel/files/content",
                            params={"dir": "/public_html", "file": readable_file},
                            headers=headers,
                            timeout=60
                        )
                        
                        if response.status_code == 200:
                            html_leak = check_html_leak(response.text, "File content")
                            
                            # Check if it's an error response
                            try:
                                error_data = response.json()
                                if "error" in error_data or ("status" in error_data and error_data.get("status") == 0):
                                    # Check if it's the HTML login page leak
                                    if "<!DOCTYPE html>" in str(error_data.get("errors", [])):
                                        results.add_fail(
                                            "File content WHM fallback failed", 
                                            f"Auth failure detected, WHM fallback attempted but failed. File: {readable_file}. "
                                            f"Error: {error_data.get('errors', 'Unknown')}"
                                        )
                                    else:
                                        results.add_fail("File content returned error", f"Response: {error_data}")
                                else:
                                    results.add_pass("File content read", f"Read file: {readable_file} ({len(response.text)} bytes)")
                            except json.JSONDecodeError:
                                # Not JSON, check for HTML leak in raw content
                                if html_leak:
                                    results.add_fail("File content response contains HTML login page", html_leak)
                                else:
                                    # Actual file content
                                    results.add_pass("File content read", f"Read file: {readable_file} ({len(response.text)} bytes)")
                        else:
                            results.add_fail(f"File content failed with status {response.status_code}", response.text[:200])
                    else:
                        results.add_warning("No readable file found in /public_html", "Skipping file content test")
                except json.JSONDecodeError:
                    results.add_fail("Files list response not JSON", response.text[:200])
        else:
            results.add_fail(f"Files list failed with status {response.status_code}", response.text[:200])
    except Exception as e:
        results.add_fail("File content exception", str(e))
    
    # ========================================================================
    # F. SUBDOMAIN CREATE + DELETE (qatest1)
    # ========================================================================
    print("\n[F] SUBDOMAIN CREATE + DELETE TEST (qatest1)")
    print("-" * 80)
    
    try:
        # Create subdomain
        response = requests.post(
            f"{BASE_URL}/api/panel/subdomains/create",
            json={"subdomain": "qatest1", "rootdomain": DOMAIN},
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            html_leak = check_html_leak(response.text, "Subdomain create")
            
            if html_leak:
                results.add_fail("Subdomain create response contains HTML", html_leak)
            else:
                try:
                    data = response.json()
                    if data.get("status") == 1 or data.get("success"):
                        results.add_pass("Subdomain create (qatest1)", "Created successfully")
                        created_subdomains.append(f"qatest1.{DOMAIN}")
                        
                        # Verify it appears in the list
                        time.sleep(2)
                        response = requests.get(f"{BASE_URL}/api/panel/subdomains", headers=headers, timeout=30)
                        
                        if response.status_code == 200:
                            data = response.json()
                            subdomains = data.get("data", []) if isinstance(data, dict) else data
                            subdomain_names = [s.get("domain", s.get("subdomain", "")) for s in subdomains]
                            
                            expected_name = f"qatest1.{DOMAIN}"
                            doubled_name = f"qatest1.{DOMAIN}.{DOMAIN}"
                            
                            if doubled_name in subdomain_names:
                                results.add_fail("Subdomain name doubled", f"Found: {doubled_name}")
                            elif expected_name in subdomain_names or "qatest1" in str(subdomain_names):
                                results.add_pass("Subdomain verify (qatest1)", f"Found in list as single FQDN")
                            else:
                                results.add_fail("Subdomain not found in list", f"Expected: {expected_name}")
                    else:
                        results.add_fail("Subdomain create failed", f"Response: {data}")
                except json.JSONDecodeError:
                    results.add_fail("Subdomain create response not JSON", response.text[:200])
        else:
            results.add_fail(f"Subdomain create failed with status {response.status_code}", response.text[:200])
    except Exception as e:
        results.add_fail("Subdomain create exception", str(e))
    
    # Delete qatest1
    if f"qatest1.{DOMAIN}" in created_subdomains:
        try:
            response = requests.post(
                f"{BASE_URL}/api/panel/subdomains/delete",
                json={"subdomain": f"qatest1.{DOMAIN}"},
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("status") == 1 or data.get("success"):
                        results.add_pass("Subdomain delete (qatest1)", "Deleted successfully")
                        created_subdomains.remove(f"qatest1.{DOMAIN}")
                        
                        # Verify it's gone
                        time.sleep(2)
                        response = requests.get(f"{BASE_URL}/api/panel/subdomains", headers=headers, timeout=30)
                        
                        if response.status_code == 200:
                            data = response.json()
                            subdomains = data.get("data", []) if isinstance(data, dict) else data
                            subdomain_names = [s.get("domain", s.get("subdomain", "")) for s in subdomains]
                            
                            if f"qatest1.{DOMAIN}" not in subdomain_names and "qatest1" not in str(subdomain_names):
                                results.add_pass("Subdomain verify deleted (qatest1)", "Confirmed removed from list")
                            else:
                                results.add_fail("Subdomain still in list after delete", f"Found: qatest1")
                    else:
                        results.add_fail("Subdomain delete failed", f"Response: {data}")
                except json.JSONDecodeError:
                    results.add_fail("Subdomain delete response not JSON", response.text[:200])
            else:
                results.add_fail(f"Subdomain delete failed with status {response.status_code}", response.text[:200])
        except Exception as e:
            results.add_fail("Subdomain delete exception", str(e))
    
    # ========================================================================
    # G. BULK SUBDOMAIN IMPORT (qabulk1, qabulk2)
    # ========================================================================
    print("\n[G] BULK SUBDOMAIN IMPORT TEST (qabulk1, qabulk2)")
    print("-" * 80)
    
    try:
        # Create bulk subdomains
        response = requests.post(
            f"{BASE_URL}/api/panel/subdomains/bulk-create",
            json={"subdomains": "qabulk1, qabulk2", "rootdomain": DOMAIN},
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            html_leak = check_html_leak(response.text, "Bulk subdomain create")
            
            if html_leak:
                results.add_fail("Bulk subdomain create response contains HTML", html_leak)
            else:
                try:
                    data = response.json()
                    summary = data.get("summary", {})
                    
                    if summary.get("total") == 2 and summary.get("succeeded", 0) == 2:
                        results.add_pass("Bulk subdomain create", f"Created 2/2 subdomains successfully")
                        created_subdomains.extend([f"qabulk1.{DOMAIN}", f"qabulk2.{DOMAIN}"])
                        
                        # Verify they appear in the list
                        time.sleep(2)
                        response = requests.get(f"{BASE_URL}/api/panel/subdomains", headers=headers, timeout=30)
                        
                        if response.status_code == 200:
                            data = response.json()
                            subdomains = data.get("data", []) if isinstance(data, dict) else data
                            subdomain_names = [s.get("domain", s.get("subdomain", "")) for s in subdomains]
                            
                            found_bulk1 = any("qabulk1" in s for s in subdomain_names)
                            found_bulk2 = any("qabulk2" in s for s in subdomain_names)
                            
                            doubled_bulk1 = f"qabulk1.{DOMAIN}.{DOMAIN}" in subdomain_names
                            doubled_bulk2 = f"qabulk2.{DOMAIN}.{DOMAIN}" in subdomain_names
                            
                            if doubled_bulk1 or doubled_bulk2:
                                results.add_fail("Bulk subdomain names doubled", f"Found doubled names")
                            elif found_bulk1 and found_bulk2:
                                results.add_pass("Bulk subdomain verify", "Both qabulk1 and qabulk2 found as single FQDNs")
                            else:
                                results.add_fail("Bulk subdomains not found in list", f"qabulk1: {found_bulk1}, qabulk2: {found_bulk2}")
                    else:
                        results.add_fail("Bulk subdomain create incomplete", f"Summary: {summary}")
                except json.JSONDecodeError:
                    results.add_fail("Bulk subdomain create response not JSON", response.text[:200])
        else:
            results.add_fail(f"Bulk subdomain create failed with status {response.status_code}", response.text[:200])
    except Exception as e:
        results.add_fail("Bulk subdomain create exception", str(e))
    
    # Delete bulk subdomains
    for bulk_sub in ["qabulk1", "qabulk2"]:
        if f"{bulk_sub}.{DOMAIN}" in created_subdomains:
            try:
                response = requests.post(
                    f"{BASE_URL}/api/panel/subdomains/delete",
                    json={"subdomain": f"{bulk_sub}.{DOMAIN}"},
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        if data.get("status") == 1 or data.get("success"):
                            results.add_pass(f"Bulk subdomain delete ({bulk_sub})", "Deleted successfully")
                            created_subdomains.remove(f"{bulk_sub}.{DOMAIN}")
                        else:
                            results.add_fail(f"Bulk subdomain delete failed ({bulk_sub})", f"Response: {data}")
                    except json.JSONDecodeError:
                        results.add_fail(f"Bulk subdomain delete response not JSON ({bulk_sub})", response.text[:200])
                else:
                    results.add_fail(f"Bulk subdomain delete failed with status {response.status_code} ({bulk_sub})", response.text[:200])
            except Exception as e:
                results.add_fail(f"Bulk subdomain delete exception ({bulk_sub})", str(e))
    
    # ========================================================================
    # H. MYSQL DATABASES (READ-ONLY)
    # ========================================================================
    print("\n[H] MYSQL DATABASES TEST (READ-ONLY)")
    print("-" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/panel/mysql/databases", headers=headers, timeout=30)
        
        if response.status_code == 200:
            html_leak = check_html_leak(response.text, "MySQL databases")
            
            if html_leak:
                results.add_fail("MySQL databases response contains HTML", html_leak)
            else:
                try:
                    data = response.json()
                    if isinstance(data, dict) and ("data" in data or "databases" in data):
                        results.add_pass("MySQL databases list", "Returned successfully (read-only)")
                    elif isinstance(data, list):
                        results.add_pass("MySQL databases list", f"Returned {len(data)} databases (read-only)")
                    else:
                        results.add_pass("MySQL databases list", "Returned successfully (read-only)")
                except json.JSONDecodeError:
                    results.add_fail("MySQL databases response not JSON", response.text[:200])
        else:
            results.add_fail(f"MySQL databases failed with status {response.status_code}", response.text[:200])
    except Exception as e:
        results.add_fail("MySQL databases exception", str(e))
    
    # ========================================================================
    # I. MYSQL USERS (READ-ONLY)
    # ========================================================================
    print("\n[I] MYSQL USERS TEST (READ-ONLY)")
    print("-" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/api/panel/mysql/users", headers=headers, timeout=30)
        
        if response.status_code == 200:
            html_leak = check_html_leak(response.text, "MySQL users")
            
            if html_leak:
                results.add_fail("MySQL users response contains HTML", html_leak)
            else:
                try:
                    data = response.json()
                    if isinstance(data, dict) and ("data" in data or "users" in data):
                        results.add_pass("MySQL users list", "Returned successfully (read-only)")
                    elif isinstance(data, list):
                        results.add_pass("MySQL users list", f"Returned {len(data)} users (read-only)")
                    else:
                        results.add_pass("MySQL users list", "Returned successfully (read-only)")
                except json.JSONDecodeError:
                    results.add_fail("MySQL users response not JSON", response.text[:200])
        else:
            results.add_fail(f"MySQL users failed with status {response.status_code}", response.text[:200])
    except Exception as e:
        results.add_fail("MySQL users exception", str(e))
    
    # ========================================================================
    # CLEANUP CHECK
    # ========================================================================
    print("\n[CLEANUP CHECK]")
    print("-" * 80)
    
    if created_subdomains:
        results.add_fail("Cleanup incomplete", f"Remaining test subdomains: {', '.join(created_subdomains)}")
        print(f"{RED}WARNING: The following test subdomains were not cleaned up:{RESET}")
        for sub in created_subdomains:
            print(f"  • {sub}")
    else:
        results.add_pass("Cleanup complete", "All test subdomains were deleted")
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    success = results.summary()
    
    return success

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Test interrupted by user{RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{RED}Unexpected error: {e}{RESET}")
        sys.exit(1)
