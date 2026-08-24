#!/usr/bin/env python3
"""
Sales & Profit API Test - FLAT Profit-Margin Model (30%)
Re-verification after switching from per-category cost ratios to a single FLAT margin.
READ-ONLY on production MongoDB.
"""

import requests
import json
import sys
from typing import Dict, Any, List, Tuple

# Load backend URL from frontend/.env
def get_backend_url() -> str:
    """Read REACT_APP_BACKEND_URL from frontend/.env"""
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"❌ Failed to read REACT_APP_BACKEND_URL: {e}")
        sys.exit(1)
    return ""

BASE_URL = get_backend_url()
print(f"🔗 Testing Sales & Profit API at: {BASE_URL}/api/admin/sales")
print(f"📋 Scope: Verify FLAT profit-margin model (30%) - READ-ONLY on production MongoDB\n")

# Test results tracking
results: List[Tuple[str, bool, str]] = []
token = None

def add_result(name: str, success: bool, message: str):
    """Add a test result"""
    results.append((name, success, message))
    if success:
        print(f"   ✅ {name}: {message}")
    else:
        print(f"   ❌ {name}: {message}")

def test_login_wrong_password() -> bool:
    """CHECK 1: Login with wrong password should return 401"""
    print("🔐 CHECK 1: Login with wrong password")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/sales/login",
            json={"password": "wrong"},
            timeout=30
        )
        
        if response.status_code == 401:
            add_result("Login wrong password", True, "HTTP 401 (expected)")
            return True
        else:
            add_result("Login wrong password", False, f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        add_result("Login wrong password", False, f"Exception: {e}")
        return False

def test_login_correct_password() -> bool:
    """CHECK 2: Login with correct password should return 200 with token"""
    global token
    print("\n🔐 CHECK 2: Login with correct password")
    try:
        response = requests.post(
            f"{BASE_URL}/api/admin/sales/login",
            json={"password": "Nomadly123@"},
            timeout=30
        )
        
        if response.status_code != 200:
            add_result("Login correct password", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if "token" not in data or not data["token"]:
            add_result("Login correct password", False, "No token in response")
            return False
        
        token = data["token"]
        add_result("Login correct password", True, f"HTTP 200, token received (length: {len(token)})")
        return True
    except Exception as e:
        add_result("Login correct password", False, f"Exception: {e}")
        return False

def test_overview_range_all() -> bool:
    """CHECK 3: GET /overview?range=all - Verify FLAT 30% margin model"""
    print("\n📊 CHECK 3: GET /overview?range=all (FLAT 30% margin verification)")
    
    if not token:
        add_result("Overview range=all", False, "No token available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/sales/overview?range=all",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code != 200:
            add_result("Overview range=all", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check required top-level keys
        if "summary" not in data:
            add_result("Overview range=all", False, "Missing 'summary' key")
            return False
        
        summary = data["summary"]
        
        # Check summary has required keys
        required_keys = ["grossRevenue", "totalCost", "netProfit", "orders"]
        for key in required_keys:
            if key not in summary:
                add_result("Overview range=all", False, f"Missing summary.{key}")
                return False
        
        gross_revenue = summary["grossRevenue"]
        total_cost = summary["totalCost"]
        net_profit = summary["netProfit"]
        
        print(f"   📈 grossRevenue: ${gross_revenue:.2f}")
        print(f"   💰 totalCost: ${total_cost:.2f}")
        print(f"   💵 netProfit: ${net_profit:.2f}")
        
        # CRITICAL: Verify FLAT 30% margin model
        expected_profit = gross_revenue * 0.30
        expected_cost = gross_revenue * 0.70
        
        profit_diff = abs(net_profit - expected_profit)
        cost_diff = abs(total_cost - expected_cost)
        
        print(f"   🔍 Expected netProfit (30%): ${expected_profit:.2f}, diff: ${profit_diff:.2f}")
        print(f"   🔍 Expected totalCost (70%): ${expected_cost:.2f}, diff: ${cost_diff:.2f}")
        
        # Allow ±0.5 for rounding
        if profit_diff > 0.5:
            add_result("Overview range=all - profit margin", False, 
                      f"netProfit ${net_profit:.2f} != grossRevenue*0.30 ${expected_profit:.2f} (diff: ${profit_diff:.2f})")
            return False
        
        if cost_diff > 0.5:
            add_result("Overview range=all - cost margin", False,
                      f"totalCost ${total_cost:.2f} != grossRevenue*0.70 ${expected_cost:.2f} (diff: ${cost_diff:.2f})")
            return False
        
        # CRITICAL: Verify NO 'margin' key in summary
        if "margin" in summary:
            add_result("Overview range=all - no margin key", False, 
                      "summary has 'margin' key (should be removed in FLAT model)")
            return False
        
        # CRITICAL: Verify flatMarginPct == 30
        if "flatMarginPct" not in data:
            add_result("Overview range=all - flatMarginPct", False, "Missing top-level 'flatMarginPct'")
            return False
        
        if data["flatMarginPct"] != 30:
            add_result("Overview range=all - flatMarginPct value", False, 
                      f"flatMarginPct={data['flatMarginPct']}, expected 30")
            return False
        
        print(f"   ✅ flatMarginPct: {data['flatMarginPct']}")
        
        # CRITICAL: Verify byCategory items have profit ≈ revenue*0.30 and NO margin key
        if "byCategory" not in data:
            add_result("Overview range=all - byCategory", False, "Missing 'byCategory'")
            return False
        
        by_category = data["byCategory"]
        if not isinstance(by_category, list) or len(by_category) == 0:
            add_result("Overview range=all - byCategory array", False, "byCategory is not a non-empty array")
            return False
        
        print(f"   📊 Checking {len(by_category)} byCategory items...")
        category_errors = []
        for item in by_category:
            if "margin" in item:
                category_errors.append(f"{item.get('category', 'unknown')}: has 'margin' key")
                continue
            
            revenue = item.get("revenue", 0)
            profit = item.get("profit", 0)
            expected_cat_profit = revenue * 0.30
            cat_profit_diff = abs(profit - expected_cat_profit)
            
            if cat_profit_diff > 0.5:
                category_errors.append(
                    f"{item.get('category', 'unknown')}: profit ${profit:.2f} != revenue*0.30 ${expected_cat_profit:.2f}"
                )
        
        if category_errors:
            add_result("Overview range=all - byCategory items", False, 
                      f"{len(category_errors)} category errors: {'; '.join(category_errors[:3])}")
            return False
        
        print(f"   ✅ All byCategory items: profit ≈ revenue*0.30, NO 'margin' key")
        
        # CRITICAL: Verify 'weekly' array exists and has required structure
        if "weekly" not in data:
            add_result("Overview range=all - weekly", False, "Missing 'weekly' array")
            return False
        
        weekly = data["weekly"]
        if not isinstance(weekly, list) or len(weekly) == 0:
            add_result("Overview range=all - weekly array", False, "weekly is not a non-empty array")
            return False
        
        # Check first weekly item structure
        first_week = weekly[0]
        required_week_keys = ["weekStart", "label", "revenue", "cost", "profit", "orders"]
        for key in required_week_keys:
            if key not in first_week:
                add_result("Overview range=all - weekly structure", False, f"weekly[0] missing '{key}'")
                return False
        
        print(f"   ✅ weekly array: {len(weekly)} items, correct structure")
        
        # CRITICAL: Verify summary.thisWeekProfit exists and is a number
        if "thisWeekProfit" not in summary:
            add_result("Overview range=all - thisWeekProfit", False, "Missing summary.thisWeekProfit")
            return False
        
        if not isinstance(summary["thisWeekProfit"], (int, float)):
            add_result("Overview range=all - thisWeekProfit type", False, 
                      f"thisWeekProfit is not a number: {type(summary['thisWeekProfit'])}")
            return False
        
        print(f"   ✅ summary.thisWeekProfit: ${summary['thisWeekProfit']:.2f}")
        
        add_result("Overview range=all", True, 
                  f"All checks passed (grossRevenue=${gross_revenue:.2f}, netProfit=${net_profit:.2f}, flatMarginPct=30)")
        return True
        
    except Exception as e:
        add_result("Overview range=all", False, f"Exception: {e}")
        return False

def test_overview_range_30d() -> bool:
    """CHECK 4: GET /overview?range=30d - Verify FLAT 30% margin model"""
    print("\n📊 CHECK 4: GET /overview?range=30d (FLAT 30% margin verification)")
    
    if not token:
        add_result("Overview range=30d", False, "No token available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/sales/overview?range=30d",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code != 200:
            add_result("Overview range=30d", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        summary = data.get("summary", {})
        
        gross_revenue = summary.get("grossRevenue", 0)
        total_cost = summary.get("totalCost", 0)
        net_profit = summary.get("netProfit", 0)
        
        print(f"   📈 grossRevenue: ${gross_revenue:.2f}")
        print(f"   💰 totalCost: ${total_cost:.2f}")
        print(f"   💵 netProfit: ${net_profit:.2f}")
        
        # Verify FLAT 30% margin model
        expected_profit = gross_revenue * 0.30
        profit_diff = abs(net_profit - expected_profit)
        
        print(f"   🔍 Expected netProfit (30%): ${expected_profit:.2f}, diff: ${profit_diff:.2f}")
        
        if profit_diff > 0.5:
            add_result("Overview range=30d", False, 
                      f"netProfit ${net_profit:.2f} != grossRevenue*0.30 ${expected_profit:.2f}")
            return False
        
        add_result("Overview range=30d", True, 
                  f"FLAT 30% margin verified (grossRevenue=${gross_revenue:.2f}, netProfit=${net_profit:.2f})")
        return True
        
    except Exception as e:
        add_result("Overview range=30d", False, f"Exception: {e}")
        return False

def test_transactions() -> bool:
    """CHECK 5: GET /transactions?range=all&group=sale - Verify FLAT 30% margin on rows"""
    print("\n📋 CHECK 5: GET /transactions?range=all&group=sale (FLAT 30% margin on rows)")
    
    if not token:
        add_result("Transactions", False, "No token available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/sales/transactions?range=all&group=sale&page=1&limit=25",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code != 200:
            add_result("Transactions", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Check structure
        required_keys = ["total", "page", "limit", "pages", "rows"]
        for key in required_keys:
            if key not in data:
                add_result("Transactions", False, f"Missing '{key}' in response")
                return False
        
        rows = data["rows"]
        if not isinstance(rows, list) or len(rows) == 0:
            add_result("Transactions", False, "rows is not a non-empty array")
            return False
        
        print(f"   📊 Checking {len(rows)} transaction rows...")
        
        # Check rows for FLAT 30% margin and NO 'margin' key
        row_errors = []
        for i, row in enumerate(rows):
            # Check NO 'margin' key
            if "margin" in row:
                row_errors.append(f"Row {i}: has 'margin' key")
                continue
            
            # For sale rows, verify profit ≈ amountUsd*0.30
            if row.get("group") == "sale":
                amount_usd = row.get("amountUsd", 0)
                profit = row.get("profit", 0)
                expected_profit = amount_usd * 0.30
                profit_diff = abs(profit - expected_profit)
                
                # Allow ±0.02 for rounding on individual transactions
                if profit_diff > 0.02:
                    row_errors.append(
                        f"Row {i}: profit ${profit:.2f} != amountUsd*0.30 ${expected_profit:.2f}"
                    )
        
        if row_errors:
            add_result("Transactions", False, 
                      f"{len(row_errors)} row errors: {'; '.join(row_errors[:3])}")
            return False
        
        add_result("Transactions", True, 
                  f"All {len(rows)} rows: profit ≈ amountUsd*0.30, NO 'margin' key (total={data['total']})")
        return True
        
    except Exception as e:
        add_result("Transactions", False, f"Exception: {e}")
        return False

def test_export_csv() -> bool:
    """CHECK 6: GET /export.csv - Verify CSV format without Margin% column"""
    print("\n📄 CHECK 6: GET /export.csv?range=all&group=sale (CSV format verification)")
    
    if not token:
        add_result("Export CSV", False, "No token available")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/admin/sales/export.csv?range=all&group=sale",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code != 200:
            add_result("Export CSV", False, f"Expected 200, got {response.status_code}")
            return False
        
        # Check Content-Type
        content_type = response.headers.get("Content-Type", "")
        if "text/csv" not in content_type:
            add_result("Export CSV", False, f"Expected text/csv, got {content_type}")
            return False
        
        # Get CSV content
        csv_content = response.text
        lines = csv_content.strip().split('\n')
        
        if len(lines) < 2:
            add_result("Export CSV", False, f"CSV has only {len(lines)} lines (expected header + data)")
            return False
        
        # CRITICAL: Verify header format (NO Margin% column)
        header = lines[0]
        expected_header = "TransactionID,Date,Type,Category,Group,CustomerChatId,Product,AmountUSD,CostUSD,ProfitUSD,Status"
        
        print(f"   📋 CSV header: {header}")
        print(f"   📋 Expected:   {expected_header}")
        
        if header != expected_header:
            add_result("Export CSV", False, 
                      f"Header mismatch. Got: {header}")
            return False
        
        # Verify NO "Margin%" in header
        if "Margin%" in header or "Margin" in header:
            add_result("Export CSV", False, "Header contains 'Margin%' or 'Margin' (should be removed)")
            return False
        
        add_result("Export CSV", True, 
                  f"HTTP 200, Content-Type: text/csv, header correct (NO Margin% column), {len(lines)} lines")
        return True
        
    except Exception as e:
        add_result("Export CSV", False, f"Exception: {e}")
        return False

def test_health_no_regression() -> bool:
    """CHECK 7: GET /api/health - Verify no regression"""
    print("\n🏥 CHECK 7: GET /api/health (no regression)")
    
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=30)
        
        if response.status_code != 200:
            add_result("Health check", False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if data.get("status") != "healthy":
            add_result("Health check", False, f"status={data.get('status')}, expected 'healthy'")
            return False
        
        if data.get("database") != "connected":
            add_result("Health check", False, f"database={data.get('database')}, expected 'connected'")
            return False
        
        add_result("Health check", True, "status=healthy, database=connected")
        return True
        
    except Exception as e:
        add_result("Health check", False, f"Exception: {e}")
        return False

def check_nodejs_supervisor() -> bool:
    """CHECK 8: Verify nodejs supervisor is running"""
    print("\n🔧 CHECK 8: nodejs supervisor status")
    
    try:
        import subprocess
        result = subprocess.run(
            ["sudo", "supervisorctl", "status", "nodejs"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if "RUNNING" in result.stdout:
            add_result("nodejs supervisor", True, "RUNNING")
            return True
        else:
            add_result("nodejs supervisor", False, f"Not running: {result.stdout}")
            return False
    except Exception as e:
        add_result("nodejs supervisor", False, f"Exception: {e}")
        return False

def check_nodejs_logs() -> bool:
    """CHECK 9: Verify no NEW errors in nodejs logs"""
    print("\n📝 CHECK 9: nodejs error logs")
    
    try:
        import subprocess
        result = subprocess.run(
            ["tail", "-n", "100", "/var/log/supervisor/nodejs.err.log"],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        # Check for NEW errors (not the expected Telnyx 401)
        error_patterns = ["SyntaxError", "ReferenceError", "Cannot read properties"]
        new_errors = []
        
        for line in result.stdout.split('\n'):
            for pattern in error_patterns:
                if pattern in line and "PhoneMonitor" not in line and "BalanceMonitor" not in line:
                    new_errors.append(line.strip())
        
        if new_errors:
            add_result("nodejs logs", False, f"Found {len(new_errors)} NEW errors (excluding expected Telnyx 401)")
            return False
        else:
            add_result("nodejs logs", True, "No NEW errors (only expected PhoneMonitor/BalanceMonitor Telnyx 401)")
            return True
    except Exception as e:
        add_result("nodejs logs", False, f"Exception: {e}")
        return False

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("📊 TEST SUMMARY - Sales & Profit API FLAT Margin Model (30%)")
    print("="*80)
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    print(f"\n✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    
    if total - passed > 0:
        print("\n❌ FAILED CHECKS:")
        for name, success, message in results:
            if not success:
                print(f"   • {name}: {message}")
    
    print("\n" + "="*80)
    
    if passed == total:
        print("✅ ALL CHECKS PASSED - FLAT 30% margin model verified")
        print("="*80)
        return True
    else:
        print("❌ SOME CHECKS FAILED - Issues found")
        print("="*80)
        return False

def main():
    """Run all tests"""
    print("="*80)
    print("🧪 SALES & PROFIT API TEST - FLAT PROFIT-MARGIN MODEL (30%)")
    print("="*80)
    print("Changes verified:")
    print("  • Removed per-category cost ratios and exact costing")
    print("  • Single FLAT margin: profit = revenue * 0.30, cost = revenue * 0.70")
    print("  • Removed 'margin' field from all responses")
    print("  • Added top-level 'flatMarginPct' field (=30)")
    print("  • Added 'weekly' array and 'summary.thisWeekProfit'")
    print("  • CSV export: removed 'Margin%' column")
    print("="*80)
    print()
    
    # Run all checks
    check1 = test_login_wrong_password()
    check2 = test_login_correct_password()
    check3 = test_overview_range_all()
    check4 = test_overview_range_30d()
    check5 = test_transactions()
    check6 = test_export_csv()
    check7 = test_health_no_regression()
    check8 = check_nodejs_supervisor()
    check9 = check_nodejs_logs()
    
    # Print summary
    all_passed = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()
