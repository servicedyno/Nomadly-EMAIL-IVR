#!/usr/bin/env python3
"""
Backend test for Sales & Profit admin analytics API
Tests all endpoints for the Nomadly platform admin dashboard
READ-ONLY testing over production-connected MongoDB
"""

import requests
import json
import sys
from typing import Dict, Any

# Read backend URL from frontend/.env
def get_backend_url():
    with open('/app/frontend/.env', 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                return line.split('=')[1].strip()
    return None

BASE_URL = get_backend_url()
PASSWORD = "Nomadly123@"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_check(check_num: str, description: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}CHECK {check_num}: {description}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")

def print_pass(message: str):
    print(f"{Colors.GREEN}✅ PASS: {message}{Colors.RESET}")

def print_fail(message: str):
    print(f"{Colors.RED}❌ FAIL: {message}{Colors.RESET}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ️  INFO: {message}{Colors.RESET}")

# Test results tracking
test_results = {
    "total": 0,
    "passed": 0,
    "failed": 0,
    "checks": []
}

def record_result(check_num: str, description: str, passed: bool, details: str = ""):
    test_results["total"] += 1
    if passed:
        test_results["passed"] += 1
        print_pass(f"Check {check_num} passed: {description}")
    else:
        test_results["failed"] += 1
        print_fail(f"Check {check_num} failed: {description}")
    
    test_results["checks"].append({
        "check": check_num,
        "description": description,
        "passed": passed,
        "details": details
    })
    
    if details:
        print_info(details)

def test_1_login_wrong_password():
    """Check 1: POST /login with wrong password → expect HTTP 401"""
    print_check("1", "POST /api/admin/sales/login with wrong password")
    
    url = f"{BASE_URL}/api/admin/sales/login"
    payload = {"password": "wrong"}
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        
        print_info(f"URL: {url}")
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text[:200]}")
        
        if response.status_code == 401:
            try:
                data = response.json()
                if "error" in data and "Incorrect password" in data["error"]:
                    record_result("1", "Wrong password returns 401 with correct error", True, 
                                f"Error message: {data['error']}")
                else:
                    record_result("1", "Wrong password returns 401 but incorrect error message", False,
                                f"Expected 'Incorrect password', got: {data}")
            except Exception:
                record_result("1", "Wrong password returns 401 but response is not JSON", False,
                            f"Response: {response.text}")
        else:
            record_result("1", "Wrong password did not return 401", False,
                        f"Expected 401, got {response.status_code}")
    except Exception as e:
        record_result("1", "Exception during test", False, f"Error: {str(e)}")

def test_2_login_correct_password():
    """Check 2: POST /login with correct password → expect HTTP 200 with token"""
    print_check("2", "POST /api/admin/sales/login with correct password")
    
    url = f"{BASE_URL}/api/admin/sales/login"
    payload = {"password": PASSWORD}
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        
        print_info(f"URL: {url}")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "token" in data and data["token"] and len(data["token"]) > 0:
                    record_result("2", "Correct password returns 200 with valid token", True,
                                f"Token received (length: {len(data['token'])})")
                    return data["token"]
                else:
                    record_result("2", "Correct password returns 200 but no valid token", False,
                                f"Response: {data}")
                    return None
            except Exception:
                record_result("2", "Correct password returns 200 but response is not JSON", False,
                            f"Response: {response.text}")
                return None
        else:
            record_result("2", "Correct password did not return 200", False,
                        f"Expected 200, got {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        record_result("2", "Exception during test", False, f"Error: {str(e)}")
        return None

def test_3_overview_no_auth():
    """Check 3: GET /overview?range=30d WITHOUT Authorization header → expect HTTP 401"""
    print_check("3", "GET /api/admin/sales/overview?range=30d without auth")
    
    url = f"{BASE_URL}/api/admin/sales/overview?range=30d"
    
    try:
        response = requests.get(url, timeout=10)
        
        print_info(f"URL: {url}")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            record_result("3", "Overview without auth returns 401", True)
        else:
            record_result("3", "Overview without auth did not return 401", False,
                        f"Expected 401, got {response.status_code}")
    except Exception as e:
        record_result("3", "Exception during test", False, f"Error: {str(e)}")

def test_4_overview_30d_with_auth(token: str):
    """Check 4: GET /overview?range=30d WITH Bearer token → HTTP 200 with proper structure"""
    print_check("4", "GET /api/admin/sales/overview?range=30d with auth")
    
    url = f"{BASE_URL}/api/admin/sales/overview?range=30d"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        print_info(f"URL: {url}")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            record_result("4", "Overview with auth did not return 200", False,
                        f"Expected 200, got {response.status_code}: {response.text[:200]}")
            return None
        
        try:
            data = response.json()
            
            # Check required keys
            required_keys = ["summary", "byCategory", "timeseries", "topProducts", "topCustomers", "deltas", "assumptions"]
            missing_keys = [key for key in required_keys if key not in data]
            
            if missing_keys:
                record_result("4", "Overview response missing required keys", False,
                            f"Missing keys: {missing_keys}")
                return None
            
            # Check summary structure
            summary = data.get("summary", {})
            summary_keys = ["grossRevenue", "totalCost", "netProfit", "margin", "orders", "avgOrderValue", "refunds", "deposits", "bonuses"]
            missing_summary_keys = [key for key in summary_keys if key not in summary]
            
            if missing_summary_keys:
                record_result("4", "Summary missing required keys", False,
                            f"Missing summary keys: {missing_summary_keys}")
                return None
            
            # Sanity checks
            gross_revenue = summary.get("grossRevenue", 0)
            total_cost = summary.get("totalCost", 0)
            net_profit = summary.get("netProfit", 0)
            margin = summary.get("margin", 0)
            
            print_info(f"Summary: grossRevenue=${gross_revenue:.2f}, totalCost=${total_cost:.2f}, netProfit=${net_profit:.2f}, margin={margin}")
            
            sanity_passed = True
            sanity_details = []
            
            # Check grossRevenue >= 0
            if gross_revenue < 0:
                sanity_passed = False
                sanity_details.append(f"grossRevenue is negative: {gross_revenue}")
            else:
                sanity_details.append(f"✓ grossRevenue >= 0: {gross_revenue}")
            
            # Check netProfit ≈ grossRevenue - totalCost (±0.05)
            expected_profit = gross_revenue - total_cost
            profit_diff = abs(net_profit - expected_profit)
            if profit_diff > 0.05:
                sanity_passed = False
                sanity_details.append(f"netProfit mismatch: expected {expected_profit:.2f}, got {net_profit:.2f}, diff={profit_diff:.2f}")
            else:
                sanity_details.append(f"✓ netProfit ≈ grossRevenue - totalCost (diff={profit_diff:.4f})")
            
            # Check margin is a number
            if not isinstance(margin, (int, float)):
                sanity_passed = False
                sanity_details.append(f"margin is not a number: {type(margin)}")
            else:
                sanity_details.append(f"✓ margin is a number: {margin}")
            
            # Check byCategory structure
            by_category = data.get("byCategory", [])
            if not isinstance(by_category, list):
                sanity_passed = False
                sanity_details.append("byCategory is not an array")
            else:
                sanity_details.append(f"✓ byCategory is an array with {len(by_category)} items")
                if len(by_category) > 0:
                    cat_keys = ["category", "revenue", "cost", "profit", "margin", "orders", "exact"]
                    sample_cat = by_category[0]
                    missing_cat_keys = [key for key in cat_keys if key not in sample_cat]
                    if missing_cat_keys:
                        sanity_passed = False
                        sanity_details.append(f"byCategory item missing keys: {missing_cat_keys}")
                    else:
                        sanity_details.append(f"✓ byCategory items have required keys")
            
            # Check timeseries structure
            timeseries = data.get("timeseries", [])
            if not isinstance(timeseries, list):
                sanity_passed = False
                sanity_details.append("timeseries is not an array")
            else:
                sanity_details.append(f"✓ timeseries is an array with {len(timeseries)} items")
                if len(timeseries) > 0:
                    ts_keys = ["date", "revenue", "cost", "profit", "orders"]
                    sample_ts = timeseries[0]
                    missing_ts_keys = [key for key in ts_keys if key not in sample_ts]
                    if missing_ts_keys:
                        sanity_passed = False
                        sanity_details.append(f"timeseries item missing keys: {missing_ts_keys}")
                    else:
                        sanity_details.append(f"✓ timeseries items have required keys")
            
            if sanity_passed:
                record_result("4", "Overview 30d with auth returns valid structure", True,
                            "\n  " + "\n  ".join(sanity_details))
            else:
                record_result("4", "Overview 30d with auth has sanity check failures", False,
                            "\n  " + "\n  ".join(sanity_details))
            
            return data
            
        except Exception as e:
            record_result("4", "Exception parsing overview response", False, f"Error: {str(e)}")
            return None
    except Exception as e:
        record_result("4", "Exception during test", False, f"Error: {str(e)}")
        return None

def test_5_overview_all_with_auth(token: str, data_30d: Dict[str, Any]):
    """Check 5: GET /overview?range=all WITH token → HTTP 200 (larger totals than 30d)"""
    print_check("5", "GET /api/admin/sales/overview?range=all with auth")
    
    url = f"{BASE_URL}/api/admin/sales/overview?range=all"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        print_info(f"URL: {url}")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            record_result("5", "Overview all with auth did not return 200", False,
                        f"Expected 200, got {response.status_code}: {response.text[:200]}")
            return None
        
        try:
            data = response.json()
            summary = data.get("summary", {})
            
            gross_revenue_all = summary.get("grossRevenue", 0)
            total_cost_all = summary.get("totalCost", 0)
            net_profit_all = summary.get("netProfit", 0)
            
            print_info(f"Summary (all): grossRevenue=${gross_revenue_all:.2f}, totalCost=${total_cost_all:.2f}, netProfit=${net_profit_all:.2f}")
            
            if data_30d:
                summary_30d = data_30d.get("summary", {})
                gross_revenue_30d = summary_30d.get("grossRevenue", 0)
                
                print_info(f"Comparison: all=${gross_revenue_all:.2f} vs 30d=${gross_revenue_30d:.2f}")
                
                if gross_revenue_all >= gross_revenue_30d:
                    record_result("5", "Overview all returns valid data (totals >= 30d)", True,
                                f"all=${gross_revenue_all:.2f} >= 30d=${gross_revenue_30d:.2f}")
                else:
                    record_result("5", "Overview all totals are less than 30d", False,
                                f"all=${gross_revenue_all:.2f} < 30d=${gross_revenue_30d:.2f}")
            else:
                record_result("5", "Overview all returns 200 (no 30d comparison)", True,
                            f"grossRevenue=${gross_revenue_all:.2f}")
            
            return data
            
        except Exception as e:
            record_result("5", "Exception parsing overview all response", False, f"Error: {str(e)}")
            return None
    except Exception as e:
        record_result("5", "Exception during test", False, f"Error: {str(e)}")
        return None

def test_6_transactions_with_filters(token: str):
    """Check 6: GET /transactions with filters → HTTP 200 with proper structure and filtering"""
    print_check("6", "GET /api/admin/sales/transactions with filters")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 6a: group=sale
    print_info("\n--- Test 6a: group=sale ---")
    url_sale = f"{BASE_URL}/api/admin/sales/transactions?range=all&group=sale&page=1&limit=25"
    
    try:
        response = requests.get(url_sale, headers=headers, timeout=10)
        
        print_info(f"URL: {url_sale}")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            record_result("6a", "Transactions group=sale did not return 200", False,
                        f"Expected 200, got {response.status_code}")
            return
        
        try:
            data = response.json()
            
            # Check structure
            required_keys = ["total", "page", "limit", "pages", "rows"]
            missing_keys = [key for key in required_keys if key not in data]
            
            if missing_keys:
                record_result("6a", "Transactions response missing required keys", False,
                            f"Missing keys: {missing_keys}")
                return
            
            rows = data.get("rows", [])
            print_info(f"Total: {data.get('total')}, Page: {data.get('page')}, Limit: {data.get('limit')}, Pages: {data.get('pages')}, Rows: {len(rows)}")
            
            # Check row structure
            if len(rows) > 0:
                row_keys = ["id", "date", "type", "category", "group", "amountUsd", "cost", "profit", "margin", "status"]
                sample_row = rows[0]
                missing_row_keys = [key for key in row_keys if key not in sample_row]
                
                if missing_row_keys:
                    record_result("6a", "Transaction row missing required keys", False,
                                f"Missing keys: {missing_row_keys}")
                    return
                
                # Verify all rows have group == "sale"
                non_sale_rows = [row for row in rows if row.get("group") != "sale"]
                if non_sale_rows:
                    record_result("6a", "Some rows do not have group=sale", False,
                                f"Found {len(non_sale_rows)} non-sale rows")
                    return
                
                record_result("6a", "Transactions group=sale returns valid structure and all rows have group=sale", True,
                            f"Total: {data.get('total')}, Rows returned: {len(rows)}")
            else:
                record_result("6a", "Transactions group=sale returns valid structure (no rows)", True,
                            "No rows in result (may be valid if no sales)")
        
        except Exception as e:
            record_result("6a", "Exception parsing transactions response", False, f"Error: {str(e)}")
            return
    except Exception as e:
        record_result("6a", "Exception during test", False, f"Error: {str(e)}")
        return
    
    # Test 6b: group=deposit
    print_info("\n--- Test 6b: group=deposit ---")
    url_deposit = f"{BASE_URL}/api/admin/sales/transactions?range=all&group=deposit&page=1&limit=25"
    
    try:
        response = requests.get(url_deposit, headers=headers, timeout=10)
        
        print_info(f"URL: {url_deposit}")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            record_result("6b", "Transactions group=deposit did not return 200", False,
                        f"Expected 200, got {response.status_code}")
            return
        
        try:
            data = response.json()
            rows = data.get("rows", [])
            print_info(f"Total: {data.get('total')}, Rows: {len(rows)}")
            
            if len(rows) > 0:
                # Verify all rows have group == "deposit"
                non_deposit_rows = [row for row in rows if row.get("group") != "deposit"]
                if non_deposit_rows:
                    record_result("6b", "Some rows do not have group=deposit", False,
                                f"Found {len(non_deposit_rows)} non-deposit rows")
                    return
                
                record_result("6b", "Transactions group=deposit returns valid data and all rows have group=deposit", True,
                            f"Total: {data.get('total')}, Rows returned: {len(rows)}")
            else:
                record_result("6b", "Transactions group=deposit returns valid structure (no rows)", True,
                            "No rows in result (may be valid if no deposits)")
        
        except Exception as e:
            record_result("6b", "Exception parsing transactions deposit response", False, f"Error: {str(e)}")
            return
    except Exception as e:
        record_result("6b", "Exception during test", False, f"Error: {str(e)}")
        return
    
    # Test 6c: search filter
    print_info("\n--- Test 6c: search filter ---")
    url_no_search = f"{BASE_URL}/api/admin/sales/transactions?range=all&group=sale&page=1&limit=1000"
    url_with_search = f"{BASE_URL}/api/admin/sales/transactions?range=all&group=sale&page=1&limit=1000&search=.com"
    
    try:
        response_no_search = requests.get(url_no_search, headers=headers, timeout=10)
        response_with_search = requests.get(url_with_search, headers=headers, timeout=10)
        
        if response_no_search.status_code == 200 and response_with_search.status_code == 200:
            data_no_search = response_no_search.json()
            data_with_search = response_with_search.json()
            
            total_no_search = data_no_search.get("total", 0)
            total_with_search = data_with_search.get("total", 0)
            
            print_info(f"Total without search: {total_no_search}")
            print_info(f"Total with search=.com: {total_with_search}")
            
            if total_with_search <= total_no_search:
                record_result("6c", "Search filter narrows results correctly", True,
                            f"Without search: {total_no_search}, With search: {total_with_search}")
            else:
                record_result("6c", "Search filter does not narrow results", False,
                            f"Without search: {total_no_search}, With search: {total_with_search}")
        else:
            record_result("6c", "Search filter test failed to get responses", False,
                        f"Status codes: no_search={response_no_search.status_code}, with_search={response_with_search.status_code}")
    except Exception as e:
        record_result("6c", "Exception during search filter test", False, f"Error: {str(e)}")

def test_7_export_csv(token: str):
    """Check 7: GET /export.csv → HTTP 200 with CSV content"""
    print_check("7", "GET /api/admin/sales/export.csv")
    
    url = f"{BASE_URL}/api/admin/sales/export.csv?range=all&group=sale"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        print_info(f"URL: {url}")
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        
        if response.status_code != 200:
            record_result("7", "Export CSV did not return 200", False,
                        f"Expected 200, got {response.status_code}")
            return
        
        # Check Content-Type
        content_type = response.headers.get('Content-Type', '')
        if 'text/csv' not in content_type.lower() and 'csv' not in content_type.lower():
            record_result("7", "Export CSV Content-Type is not text/csv", False,
                        f"Content-Type: {content_type}")
            return
        
        # Check CSV header
        csv_content = response.text
        lines = csv_content.split('\n')
        
        if len(lines) == 0:
            record_result("7", "Export CSV is empty", False)
            return
        
        first_line = lines[0].strip()
        print_info(f"First line: {first_line[:200]}")
        
        expected_header_start = "TransactionID,Date,Type,Category,Group,CustomerChatId,Product,AmountUSD"
        
        if first_line.startswith(expected_header_start):
            record_result("7", "Export CSV returns valid CSV with correct header", True,
                        f"Header: {first_line[:100]}..., Total lines: {len(lines)}")
        else:
            record_result("7", "Export CSV header does not match expected format", False,
                        f"Expected to start with: {expected_header_start}\nGot: {first_line[:100]}")
    
    except Exception as e:
        record_result("7", "Exception during test", False, f"Error: {str(e)}")

def test_8_no_regression():
    """Check 8: NO REGRESSION - health check and nodejs status"""
    print_check("8", "NO REGRESSION - health check and nodejs status")
    
    # Test 8a: Health check
    print_info("\n--- Test 8a: Health check ---")
    url = f"{BASE_URL}/api/health"
    
    try:
        response = requests.get(url, timeout=10)
        
        print_info(f"URL: {url}")
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                status = data.get("status")
                database = data.get("database")
                
                print_info(f"Response: {json.dumps(data, indent=2)}")
                
                if status == "healthy" and database == "connected":
                    record_result("8a", "Health check returns healthy and database connected", True)
                else:
                    record_result("8a", "Health check returns 200 but status is not healthy", False,
                                f"status={status}, database={database}")
            except Exception:
                record_result("8a", "Health check returns 200 but response is not JSON", False,
                            f"Response: {response.text}")
        else:
            record_result("8a", "Health check did not return 200", False,
                        f"Expected 200, got {response.status_code}")
    except Exception as e:
        record_result("8a", "Exception during health check", False, f"Error: {str(e)}")
    
    # Test 8b: nodejs supervisor status
    print_info("\n--- Test 8b: nodejs supervisor status ---")
    import subprocess
    
    try:
        result = subprocess.run(['sudo', 'supervisorctl', 'status', 'nodejs'], 
                              capture_output=True, text=True, timeout=5)
        
        print_info(f"Command: sudo supervisorctl status nodejs")
        print_info(f"Output: {result.stdout.strip()}")
        
        if "RUNNING" in result.stdout:
            record_result("8b", "nodejs supervisor process is RUNNING", True,
                        result.stdout.strip())
        else:
            record_result("8b", "nodejs supervisor process is not RUNNING", False,
                        result.stdout.strip())
    except Exception as e:
        record_result("8b", "Exception checking nodejs status", False, f"Error: {str(e)}")
    
    # Test 8c: Check for errors in logs
    print_info("\n--- Test 8c: Check nodejs error logs ---")
    
    try:
        result = subprocess.run(['tail', '-n', '100', '/var/log/supervisor/nodejs.err.log'],
                              capture_output=True, text=True, timeout=5)
        
        log_content = result.stdout
        
        # Check for SyntaxError or ReferenceError (excluding expected PhoneMonitor/BalanceMonitor 401s)
        error_lines = []
        for line in log_content.split('\n'):
            if 'SyntaxError' in line or 'ReferenceError' in line:
                # Exclude expected errors
                if 'PhoneMonitor' not in line and 'BalanceMonitor' not in line and 'Telnyx' not in line:
                    error_lines.append(line)
        
        if error_lines:
            record_result("8c", "Found SyntaxError/ReferenceError in nodejs logs", False,
                        f"Errors found:\n" + "\n".join(error_lines[:5]))
        else:
            # Check for expected PhoneMonitor/BalanceMonitor 401 errors
            expected_errors = [line for line in log_content.split('\n') 
                             if ('PhoneMonitor' in line or 'BalanceMonitor' in line) and '401' in line]
            
            if expected_errors:
                record_result("8c", "No NEW errors in nodejs logs (only expected PhoneMonitor/BalanceMonitor 401s)", True,
                            f"Found {len(expected_errors)} expected 401 errors")
            else:
                record_result("8c", "No errors in nodejs logs", True)
    except Exception as e:
        record_result("8c", "Exception checking nodejs logs", False, f"Error: {str(e)}")

def main():
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}Sales & Profit Admin Analytics API - Backend Test Suite{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.YELLOW}Base URL: {BASE_URL}{Colors.RESET}")
    print(f"{Colors.YELLOW}Testing READ-ONLY endpoints over production-connected MongoDB{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    # Run tests in sequence
    test_1_login_wrong_password()
    
    token = test_2_login_correct_password()
    
    if not token:
        print_fail("\nCannot proceed without valid token. Stopping tests.")
        print_summary()
        sys.exit(1)
    
    test_3_overview_no_auth()
    
    data_30d = test_4_overview_30d_with_auth(token)
    
    data_all = test_5_overview_all_with_auth(token, data_30d)
    
    test_6_transactions_with_filters(token)
    
    test_7_export_csv(token)
    
    test_8_no_regression()
    
    # Print summary
    print_summary()
    
    # Exit with appropriate code
    if test_results["failed"] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

def print_summary():
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    print(f"\nTotal Tests: {test_results['total']}")
    print(f"{Colors.GREEN}Passed: {test_results['passed']}{Colors.RESET}")
    print(f"{Colors.RED}Failed: {test_results['failed']}{Colors.RESET}")
    
    if test_results["failed"] == 0:
        print(f"\n{Colors.GREEN}✅ ALL TESTS PASSED{Colors.RESET}")
    else:
        print(f"\n{Colors.RED}❌ SOME TESTS FAILED{Colors.RESET}")
        print(f"\n{Colors.YELLOW}Failed checks:{Colors.RESET}")
        for check in test_results["checks"]:
            if not check["passed"]:
                print(f"  - Check {check['check']}: {check['description']}")
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}\n")

if __name__ == "__main__":
    main()
