#!/usr/bin/env python3
"""
Backend test for Reseller API usage-metrics additions (2026-09-08 follow-up).

Tests the NEW usage-metrics additions to the Reseller REST API:
1. GET /hosting/nbayftest → 200 with real WHM usage (disk, bandwidth, inodes)
2. GET /hosting/nbaykkd4zh → 200 with usage error (account not on live WHM)
3. GET /hosting?usage=true → 200 with usage_included:true, each account has usage
4. GET /hosting (no query) → 200 with usage_included:false, no usage key
5. REGRESSION: /hosting/plans, /renewals, /hosting/:user/credentials still work
6. Wallet balance unchanged ($5.00)
"""

import requests
import json
import os
import sys

# Configuration
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://49b04998-73a3-495c-94b7-ea9e42e66171.preview.emergentagent.com')
BASE_URL = f"{BACKEND_URL}/api/reseller/v1"
API_KEY = "rsk_live_cdc3f785ac3cfd813c6143d7813e1a59cc15fc42327ab736"
HEADERS = {"X-API-Key": API_KEY}

# Test counters
passed = 0
failed = 0
tests = []

def test(name, condition, details=""):
    """Record a test result."""
    global passed, failed
    if condition:
        passed += 1
        print(f"✅ {name}")
        tests.append({"name": name, "passed": True, "details": details})
    else:
        failed += 1
        print(f"❌ {name}")
        if details:
            print(f"   Details: {details}")
        tests.append({"name": name, "passed": False, "details": details})

def get(path, params=None):
    """Make a GET request."""
    url = f"{BASE_URL}{path}"
    try:
        r = requests.get(url, headers=HEADERS, params=params, timeout=30)
        return r
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return None

def post(path, data=None):
    """Make a POST request."""
    url = f"{BASE_URL}{path}"
    try:
        r = requests.post(url, headers=HEADERS, json=data, timeout=30)
        return r
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return None

print("=" * 80)
print("RESELLER API USAGE-METRICS TEST")
print("=" * 80)
print(f"Base URL: {BASE_URL}")
print(f"API Key: {API_KEY[:20]}...")
print("=" * 80)
print()

# ============================================================================
# TEST 1: GET /hosting/nbayftest → 200 with real WHM usage
# ============================================================================
print("[TEST 1] GET /hosting/nbayftest → 200 with real WHM usage")
print("-" * 80)

r = get("/hosting/nbayftest")
test("1.1 Status code 200", r and r.status_code == 200, f"Got {r.status_code if r else 'None'}")

if r and r.status_code == 200:
    data = r.json()
    
    # Check that usage object exists
    test("1.2 usage object present", "usage" in data, f"Keys: {list(data.keys())}")
    
    if "usage" in data:
        usage = data["usage"]
        
        # Check that usage is NOT an error (nbayftest is a real WHM account)
        test("1.3 usage is NOT an error object", "error" not in usage or usage.get("error") is None, 
             f"usage: {json.dumps(usage, indent=2)}")
        
        # Check all required fields are present with numeric values
        required_fields = [
            "disk_used_mb", "disk_limit", "disk_used_pct",
            "bandwidth_used_mb", "bandwidth_limit", "bandwidth_used_pct", "bandwidth_period",
            "inodes_used", "inodes_limit"
        ]
        
        for field in required_fields:
            test(f"1.4.{field} present", field in usage, f"usage keys: {list(usage.keys())}")
        
        # Check numeric fields have numeric values (not null, not error)
        numeric_fields = ["disk_used_mb", "bandwidth_used_mb", "inodes_used"]
        for field in numeric_fields:
            if field in usage:
                value = usage[field]
                is_numeric = isinstance(value, (int, float)) and value is not None
                test(f"1.5.{field} is numeric", is_numeric, f"{field}={value} (type: {type(value).__name__})")
        
        # Check bandwidth_period is "current_month"
        if "bandwidth_period" in usage:
            test("1.6 bandwidth_period is 'current_month'", 
                 usage["bandwidth_period"] == "current_month",
                 f"Got: {usage['bandwidth_period']}")
        
        # Print the actual usage data for verification
        print()
        print("📊 ACTUAL USAGE DATA FOR nbayftest:")
        print(json.dumps(usage, indent=2))
        print()

print()

# ============================================================================
# TEST 2: GET /hosting/nbaykkd4zh → 200 with usage error (not on live WHM)
# ============================================================================
print("[TEST 2] GET /hosting/nbaykkd4zh → 200 with usage error")
print("-" * 80)

r = get("/hosting/nbaykkd4zh")
test("2.1 Status code 200", r and r.status_code == 200, f"Got {r.status_code if r else 'None'}")

if r and r.status_code == 200:
    data = r.json()
    
    # Check that usage object exists
    test("2.2 usage object present", "usage" in data, f"Keys: {list(data.keys())}")
    
    if "usage" in data:
        usage = data["usage"]
        
        # Check that usage has an error (account not on live WHM)
        test("2.3 usage has error field", "error" in usage, f"usage: {json.dumps(usage, indent=2)}")
        
        if "error" in usage:
            test("2.4 error is 'account_summary_unavailable'", 
                 usage["error"] == "account_summary_unavailable",
                 f"Got error: {usage['error']}")
        
        print()
        print("📊 USAGE DATA FOR nbaykkd4zh (expected error):")
        print(json.dumps(usage, indent=2))
        print()

print()

# ============================================================================
# TEST 3: GET /hosting?usage=true → 200 with usage_included:true
# ============================================================================
print("[TEST 3] GET /hosting?usage=true → 200 with usage_included:true")
print("-" * 80)

r = get("/hosting", params={"usage": "true"})
test("3.1 Status code 200", r and r.status_code == 200, f"Got {r.status_code if r else 'None'}")

if r and r.status_code == 200:
    data = r.json()
    
    # Check usage_included is true
    test("3.2 usage_included is true", data.get("usage_included") == True, 
         f"Got: {data.get('usage_included')}")
    
    # Check accounts array exists
    test("3.3 accounts array present", "accounts" in data, f"Keys: {list(data.keys())}")
    
    if "accounts" in data:
        accounts = data["accounts"]
        test("3.4 accounts array not empty", len(accounts) > 0, f"Got {len(accounts)} accounts")
        
        # Check each account has a usage key
        for i, account in enumerate(accounts):
            username = account.get("username", f"account_{i}")
            test(f"3.5.{username} has usage key", "usage" in account, 
                 f"Keys: {list(account.keys())}")
            
            if "usage" in account:
                usage = account["usage"]
                # usage can be null (if not on WHM) or an object with disk_used_mb, etc.
                if usage is not None:
                    test(f"3.6.{username} usage has disk_used_mb", "disk_used_mb" in usage,
                         f"usage: {json.dumps(usage, indent=2)}")
        
        print()
        print(f"📊 FOUND {len(accounts)} ACCOUNTS WITH USAGE:")
        for account in accounts:
            print(f"  - {account.get('username')}: usage={account.get('usage')}")
        print()

print()

# ============================================================================
# TEST 4: GET /hosting (no query) → 200 with usage_included:false, no usage key
# ============================================================================
print("[TEST 4] GET /hosting (no query) → 200 with usage_included:false")
print("-" * 80)

r = get("/hosting")
test("4.1 Status code 200", r and r.status_code == 200, f"Got {r.status_code if r else 'None'}")

if r and r.status_code == 200:
    data = r.json()
    
    # Check usage_included is false
    test("4.2 usage_included is false", data.get("usage_included") == False, 
         f"Got: {data.get('usage_included')}")
    
    # Check accounts array exists
    test("4.3 accounts array present", "accounts" in data, f"Keys: {list(data.keys())}")
    
    if "accounts" in data:
        accounts = data["accounts"]
        test("4.4 accounts array not empty", len(accounts) > 0, f"Got {len(accounts)} accounts")
        
        # Check each account does NOT have a usage key (fast path)
        for i, account in enumerate(accounts):
            username = account.get("username", f"account_{i}")
            test(f"4.5.{username} does NOT have usage key", "usage" not in account, 
                 f"Keys: {list(account.keys())}")
        
        print()
        print(f"📊 FOUND {len(accounts)} ACCOUNTS WITHOUT USAGE (fast path):")
        for account in accounts:
            print(f"  - {account.get('username')}: keys={list(account.keys())}")
        print()

print()

# ============================================================================
# TEST 5: REGRESSION - Previously tested endpoints still work
# ============================================================================
print("[TEST 5] REGRESSION - Previously tested endpoints")
print("-" * 80)

# 5a. GET /hosting/plans
r = get("/hosting/plans")
test("5.1 GET /hosting/plans → 200", r and r.status_code == 200, f"Got {r.status_code if r else 'None'}")
if r and r.status_code == 200:
    data = r.json()
    test("5.2 /hosting/plans has platform object", "platform" in data)
    test("5.3 /hosting/plans has plans array", "plans" in data and len(data.get("plans", [])) > 0)
    # Check gold plan has visitor_captcha_available
    if "plans" in data:
        gold_plan = next((p for p in data["plans"] if "golden" in p.get("id", "").lower()), None)
        if gold_plan:
            test("5.4 gold plan has visitor_captcha_available:true", 
                 gold_plan.get("visitor_captcha_available") == True)

# 5b. GET /renewals
r = get("/renewals")
test("5.5 GET /renewals → 200", r and r.status_code == 200, f"Got {r.status_code if r else 'None'}")
if r and r.status_code == 200:
    data = r.json()
    test("5.6 /renewals has count field", "count" in data)
    test("5.7 /renewals has renewals array", "renewals" in data)

# 5c. GET /hosting/nbaykkd4zh/credentials
r = get("/hosting/nbaykkd4zh/credentials")
test("5.8 GET /hosting/:user/credentials → 200", r and r.status_code == 200, 
     f"Got {r.status_code if r else 'None'}")
if r and r.status_code == 200:
    data = r.json()
    test("5.9 credentials has mode field", "mode" in data)
    test("5.10 credentials mode is 'dry_run'", data.get("mode") == "dry_run")
    test("5.11 credentials panel_pin is null (dry_run)", data.get("panel_pin") is None)

# 5d. POST /hosting/nbaykkd4zh/renew
r = post("/hosting/nbaykkd4zh/renew", data={})
test("5.12 POST /hosting/:user/renew → 402 insufficient", r and r.status_code == 402, 
     f"Got {r.status_code if r else 'None'}")
if r and r.status_code == 402:
    data = r.json()
    test("5.13 renew error is 'insufficient_wallet_balance'", 
         data.get("error") == "insufficient_wallet_balance")

print()

# ============================================================================
# TEST 6: Wallet balance unchanged ($5.00)
# ============================================================================
print("[TEST 6] Wallet balance unchanged")
print("-" * 80)

r = get("/account")
test("6.1 GET /account → 200", r and r.status_code == 200, f"Got {r.status_code if r else 'None'}")

if r and r.status_code == 200:
    data = r.json()
    wallet_balance = data.get("wallet_balance_usd")
    test("6.2 wallet_balance_usd is 5", wallet_balance == 5, 
         f"Got wallet_balance_usd: {wallet_balance}")
    
    print()
    print(f"💰 WALLET BALANCE: ${wallet_balance}")
    print()

print()

# ============================================================================
# TEST 7: Check nodejs logs for errors
# ============================================================================
print("[TEST 7] Check nodejs logs for errors")
print("-" * 80)

import subprocess

try:
    # Check for 500 errors or stack traces in nodejs logs
    result = subprocess.run(
        ["tail", "-n", "100", "/var/log/supervisor/nodejs.err.log"],
        capture_output=True,
        text=True,
        timeout=5
    )
    
    log_content = result.stdout
    has_500 = "500" in log_content or "Internal Server Error" in log_content
    has_stack_trace = "Error:" in log_content or "at " in log_content
    
    test("7.1 No 500 errors in nodejs logs", not has_500, 
         "Found 500 errors in logs" if has_500 else "")
    test("7.2 No stack traces in nodejs logs", not has_stack_trace,
         "Found stack traces in logs" if has_stack_trace else "")
    
    if has_500 or has_stack_trace:
        print()
        print("⚠️  NODEJS ERROR LOG (last 100 lines):")
        print(log_content[-2000:])  # Last 2000 chars
        print()
    
except Exception as e:
    print(f"⚠️  Could not check nodejs logs: {e}")

print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"✅ Passed: {passed}")
print(f"❌ Failed: {failed}")
print(f"📊 Total:  {passed + failed}")
print(f"📈 Pass rate: {round(passed / (passed + failed) * 100, 1)}%" if (passed + failed) > 0 else "N/A")
print("=" * 80)

if failed > 0:
    print()
    print("❌ FAILED TESTS:")
    for t in tests:
        if not t["passed"]:
            print(f"  - {t['name']}")
            if t["details"]:
                print(f"    {t['details']}")
    print()
    sys.exit(1)
else:
    print()
    print("🎉 ALL TESTS PASSED!")
    print()
    sys.exit(0)
