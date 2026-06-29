#!/usr/bin/env python3
"""
Test Sequence 7: Anti-red captcha and hosting setup verification for eventiestopart.de
READ-ONLY tests only - no mutations
"""

import os
import sys
import json
import requests
from pymongo import MongoClient
import subprocess

# Configuration
BACKEND_URL = "https://env-preview-4.preview.emergentagent.com/api"
ADMIN_KEY = "o/Qb8ArGahlquhCQ"
MONGO_URL = "mongodb://mongo:UCPkknTGVOBzrnOiXoIYyVhampeslSIR@roundhouse.proxy.rlwy.net:52715"
DB_NAME = "test"
CF_API_KEY = "f34d09dc650e795a0025e790535264a932021"
CF_EMAIL = "expressdrop247@gmail.com"
CF_ZONE_ID = "e359e2be4eddcad3380b20fa86a8070d"
CF_ACCOUNT_ID = "ed6035ebf6bd3d85f5b26c60189a21e2"
CF_KV_NAMESPACE = "812aca1cbade413d9814bff1708e74db"

# Test results
results = {
    "test_sequence": 7,
    "domain": "eventiestopart.de",
    "tests": []
}

def log_test(name, passed, details):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {name}")
    print(f"Details: {details}")
    results["tests"].append({
        "name": name,
        "passed": passed,
        "details": details
    })

def test_mongodb_hosting_plan():
    """Test 1: Verify domain is on rsvp7498 and not moved"""
    print("\n" + "="*80)
    print("TEST 1: MongoDB - Hosting plan verification")
    print("="*80)
    
    try:
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Check chatId 7290657217 has 3 accounts
        accounts = list(db.cpanelAccounts.find({"chatId": "7290657217"}))
        
        if len(accounts) != 3:
            log_test("MongoDB: chatId 7290657217 account count", False, 
                    f"Expected 3 accounts, found {len(accounts)}")
            return False
        
        log_test("MongoDB: chatId 7290657217 account count", True, 
                f"Found 3 accounts as expected")
        
        # Verify specific domains
        account_map = {acc["_id"]: acc.get("domain") for acc in accounts}
        
        expected = {
            "rsvp7498": "eventiestopart.de",
            "rsvp83ac": "rsvpcrumelbell.de",
            "blis01a1": "blissfultoparti.de"
        }
        
        all_correct = True
        for acc_id, expected_domain in expected.items():
            actual_domain = account_map.get(acc_id)
            if actual_domain != expected_domain:
                log_test(f"MongoDB: {acc_id} domain", False,
                        f"Expected {expected_domain}, got {actual_domain}")
                all_correct = False
            else:
                log_test(f"MongoDB: {acc_id} domain", True,
                        f"Correctly set to {expected_domain}")
        
        # Check no OTHER account has eventiestopart.de
        all_accounts = list(db.cpanelAccounts.find({"domain": "eventiestopart.de"}))
        if len(all_accounts) > 1:
            log_test("MongoDB: eventiestopart.de uniqueness", False,
                    f"Found {len(all_accounts)} accounts with eventiestopart.de (expected 1)")
            all_correct = False
        else:
            log_test("MongoDB: eventiestopart.de uniqueness", True,
                    "Domain only on rsvp7498 (not moved)")
        
        client.close()
        return all_correct
        
    except Exception as e:
        log_test("MongoDB connection", False, f"Error: {str(e)}")
        return False

def test_cloudflare_worker_routes():
    """Test 2: Verify 3 Worker routes pointing to antired-challenge"""
    print("\n" + "="*80)
    print("TEST 2: Cloudflare Worker routes")
    print("="*80)
    
    try:
        headers = {
            "X-Auth-Email": CF_EMAIL,
            "X-Auth-Key": CF_API_KEY,
            "Content-Type": "application/json"
        }
        
        url = f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/workers/routes"
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            log_test("Cloudflare Worker routes API", False,
                    f"HTTP {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        if not data.get("success"):
            log_test("Cloudflare Worker routes API", False,
                    f"API returned success=false: {data.get('errors')}")
            return False
        
        routes = data.get("result", [])
        
        # Count routes pointing to antired-challenge
        antired_routes = [r for r in routes if r.get("script") == "antired-challenge"]
        
        if len(antired_routes) != 3:
            log_test("Cloudflare Worker routes count", False,
                    f"Expected 3 routes to antired-challenge, found {len(antired_routes)}")
            return False
        
        log_test("Cloudflare Worker routes count", True,
                f"Found 3 routes pointing to antired-challenge")
        
        # Log route patterns
        for i, route in enumerate(antired_routes, 1):
            pattern = route.get("pattern", "N/A")
            print(f"  Route {i}: {pattern}")
        
        return True
        
    except Exception as e:
        log_test("Cloudflare Worker routes", False, f"Error: {str(e)}")
        return False

def test_cloudflare_zone_status():
    """Test 3: Verify zone status is active"""
    print("\n" + "="*80)
    print("TEST 3: Cloudflare zone status")
    print("="*80)
    
    try:
        headers = {
            "X-Auth-Email": CF_EMAIL,
            "X-Auth-Key": CF_API_KEY,
            "Content-Type": "application/json"
        }
        
        url = f"https://api.cloudflare.com/client/v4/zones?name=eventiestopart.de"
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            log_test("Cloudflare zone status API", False,
                    f"HTTP {response.status_code}: {response.text}")
            return False
        
        data = response.json()
        if not data.get("success"):
            log_test("Cloudflare zone status API", False,
                    f"API returned success=false: {data.get('errors')}")
            return False
        
        zones = data.get("result", [])
        if not zones:
            log_test("Cloudflare zone status", False, "No zone found for eventiestopart.de")
            return False
        
        zone = zones[0]
        status = zone.get("status")
        
        if status != "active":
            log_test("Cloudflare zone status", False,
                    f"Expected 'active', got '{status}'")
            return False
        
        log_test("Cloudflare zone status", True, "Zone status is 'active'")
        return True
        
    except Exception as e:
        log_test("Cloudflare zone status", False, f"Error: {str(e)}")
        return False

def test_challenge_bypass_not_set():
    """Test 4: Verify challenge bypass is NOT set in KV"""
    print("\n" + "="*80)
    print("TEST 4: Challenge bypass KV check")
    print("="*80)
    
    try:
        headers = {
            "X-Auth-Email": CF_EMAIL,
            "X-Auth-Key": CF_API_KEY,
            "Content-Type": "application/json"
        }
        
        key = "bypass:eventiestopart.de"
        url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces/{CF_KV_NAMESPACE}/values/{key}"
        response = requests.get(url, headers=headers, timeout=30)
        
        # Should return 404 or error indicating key not found
        if response.status_code == 404:
            log_test("Challenge bypass NOT set", True,
                    "Key not found (bypass is NOT set, challenge IS active)")
            return True
        elif response.status_code == 200:
            log_test("Challenge bypass NOT set", False,
                    f"Key EXISTS (bypass is SET, challenge is DISABLED): {response.text}")
            return False
        else:
            # Check if error message indicates key not found
            try:
                data = response.json()
                errors = data.get("errors", [])
                if any("not found" in str(err).lower() for err in errors):
                    log_test("Challenge bypass NOT set", True,
                            "Key not found (bypass is NOT set, challenge IS active)")
                    return True
            except:
                pass
            
            log_test("Challenge bypass check", False,
                    f"Unexpected response HTTP {response.status_code}: {response.text}")
            return False
        
    except Exception as e:
        log_test("Challenge bypass check", False, f"Error: {str(e)}")
        return False

def test_behavioral_comparison():
    """Test 5: Compare behavior of eventiestopart.de and rsvpcrumelbell.de"""
    print("\n" + "="*80)
    print("TEST 5: Behavioral comparison (both domains should return HTTP 302)")
    print("="*80)
    
    domains = ["eventiestopart.de", "rsvpcrumelbell.de"]
    behaviors = {}
    
    for domain in domains:
        try:
            # Use curl with timeout to get headers
            cmd = f"timeout 10 curl -s -D - https://{domain} -o /dev/null 2>&1"
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)
            output = result.stdout
            
            # Extract HTTP status, location, cf-ray
            http_status = None
            location = None
            cf_ray = None
            
            for line in output.split('\n'):
                if line.startswith('HTTP/'):
                    http_status = line.strip()
                elif line.lower().startswith('location:'):
                    location = line.split(':', 1)[1].strip()
                elif line.lower().startswith('cf-ray:'):
                    cf_ray = line.split(':', 1)[1].strip()
            
            behaviors[domain] = {
                "http_status": http_status,
                "location": location,
                "cf_ray": cf_ray
            }
            
            print(f"\n{domain}:")
            print(f"  HTTP Status: {http_status}")
            print(f"  Location: {location}")
            print(f"  CF-Ray: {cf_ray}")
            
        except Exception as e:
            log_test(f"Behavioral test: {domain}", False, f"Error: {str(e)}")
            return False
    
    # Both should return HTTP 302
    all_passed = True
    for domain in domains:
        status = behaviors[domain]["http_status"]
        if status and "302" in status:
            log_test(f"Behavioral test: {domain} returns 302", True,
                    f"Correctly returns HTTP 302")
        else:
            log_test(f"Behavioral test: {domain} returns 302", False,
                    f"Expected HTTP 302, got {status}")
            all_passed = False
    
    # Both should have location header
    for domain in domains:
        location = behaviors[domain]["location"]
        if location:
            log_test(f"Behavioral test: {domain} has location header", True,
                    f"Location: {location}")
        else:
            log_test(f"Behavioral test: {domain} has location header", False,
                    "No location header found")
            all_passed = False
    
    return all_passed

def test_dns_health():
    """Test 6: Verify DNS records"""
    print("\n" + "="*80)
    print("TEST 6: DNS health check")
    print("="*80)
    
    all_passed = True
    
    # Test A record
    try:
        cmd = "dig A eventiestopart.de @8.8.8.8 +short"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        a_records = result.stdout.strip().split('\n')
        a_records = [r for r in a_records if r]
        
        if not a_records:
            log_test("DNS: A record", False, "No A records found")
            all_passed = False
        else:
            # Check if any record is a Cloudflare IP (104.21.x or 172.67.x)
            cf_ips = [ip for ip in a_records if ip.startswith('104.21.') or ip.startswith('172.67.')]
            if cf_ips:
                log_test("DNS: A record", True,
                        f"Resolves to Cloudflare IPs: {', '.join(cf_ips)}")
            else:
                log_test("DNS: A record", False,
                        f"IPs don't match Cloudflare pattern: {', '.join(a_records)}")
                all_passed = False
    except Exception as e:
        log_test("DNS: A record", False, f"Error: {str(e)}")
        all_passed = False
    
    # Test NS record
    try:
        cmd = "dig NS eventiestopart.de @8.8.8.8 +short"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        ns_records = result.stdout.strip().split('\n')
        ns_records = [r.rstrip('.') for r in ns_records if r]
        
        expected_ns = ["anderson.ns.cloudflare.com", "leanna.ns.cloudflare.com"]
        
        if not ns_records:
            log_test("DNS: NS record", False, "No NS records found")
            all_passed = False
        else:
            # Check if expected NS are present
            found_ns = [ns for ns in expected_ns if any(ns in record for record in ns_records)]
            if len(found_ns) == 2:
                log_test("DNS: NS record", True,
                        f"Correct NS records: {', '.join(ns_records)}")
            else:
                log_test("DNS: NS record", False,
                        f"Expected {expected_ns}, got {ns_records}")
                all_passed = False
    except Exception as e:
        log_test("DNS: NS record", False, f"Error: {str(e)}")
        all_passed = False
    
    return all_passed

def test_infrastructure():
    """Test 7: Verify infrastructure"""
    print("\n" + "="*80)
    print("TEST 7: Infrastructure check")
    print("="*80)
    
    all_passed = True
    
    # Check nodejs service
    try:
        cmd = "sudo supervisorctl status nodejs"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        output = result.stdout.strip()
        
        if "RUNNING" in output:
            log_test("Infrastructure: nodejs service", True, output)
        else:
            log_test("Infrastructure: nodejs service", False, output)
            all_passed = False
    except Exception as e:
        log_test("Infrastructure: nodejs service", False, f"Error: {str(e)}")
        all_passed = False
    
    # Check API endpoint
    try:
        response = requests.get(BACKEND_URL + "/", timeout=30)
        if response.status_code == 200:
            log_test("Infrastructure: API endpoint", True,
                    f"GET {BACKEND_URL}/ returns HTTP 200")
        else:
            log_test("Infrastructure: API endpoint", False,
                    f"GET {BACKEND_URL}/ returns HTTP {response.status_code}")
            all_passed = False
    except Exception as e:
        log_test("Infrastructure: API endpoint", False, f"Error: {str(e)}")
        all_passed = False
    
    return all_passed

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("TEST SEQUENCE 7: Anti-red captcha verification for eventiestopart.de")
    print("="*80)
    print(f"Domain: eventiestopart.de")
    print(f"User: @ddgocrazy (chatId: 7290657217)")
    print(f"Hosting Plan: rsvp7498")
    print("="*80)
    
    # Run all tests
    test_results = []
    test_results.append(("MongoDB hosting plan check", test_mongodb_hosting_plan()))
    test_results.append(("Cloudflare Worker routes", test_cloudflare_worker_routes()))
    test_results.append(("Cloudflare zone status", test_cloudflare_zone_status()))
    test_results.append(("Challenge bypass NOT set", test_challenge_bypass_not_set()))
    test_results.append(("Behavioral comparison", test_behavioral_comparison()))
    test_results.append(("DNS health", test_dns_health()))
    test_results.append(("Infrastructure", test_infrastructure()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED")
        print("\nCONCLUSION:")
        print("1. Domain eventiestopart.de is still on hosting plan rsvp7498 (NOT moved)")
        print("2. Anti-red Worker is active (3 routes → antired-challenge)")
        print("3. Challenge bypass is NOT set (challenge page IS active)")
        print("4. Zone status is 'active' (not pending)")
        print("5. Both domains behave identically (HTTP 302 from datacenter IPs)")
        print("6. DNS is healthy (Cloudflare IPs and NS records)")
        print("7. Infrastructure is operational")
        return 0
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
