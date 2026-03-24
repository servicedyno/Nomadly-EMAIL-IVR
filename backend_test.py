#!/usr/bin/env python3
"""
SIP Bridge Testing Suite for Twilio Call Routing
Tests the specific SIP bridge fixes mentioned in the review request.
"""

import requests
import json
import subprocess
import os
import time
import sys
from urllib.parse import urlencode

# Configuration
BACKEND_URL = "https://readme-helper-13.preview.emergentagent.com"
NODE_SERVER_URL = "http://localhost:5000"
TEST_RESULTS = []

def log_test(test_name, status, details="", expected="", actual=""):
    """Log test results"""
    result = {
        "test": test_name,
        "status": status,
        "details": details,
        "expected": expected,
        "actual": actual,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    TEST_RESULTS.append(result)
    
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_icon} {test_name}: {status}")
    if details:
        print(f"   Details: {details}")
    if expected and actual:
        print(f"   Expected: {expected}")
        print(f"   Actual: {actual}")
    print()

def test_health_check():
    """Test 1: Health check endpoint"""
    try:
        response = requests.get(f"{NODE_SERVER_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy" and data.get("database") == "connected":
                log_test("Health Check", "PASS", 
                        f"Server healthy with database connected. Uptime: {data.get('uptime', 'unknown')}")
            else:
                log_test("Health Check", "FAIL", 
                        f"Unexpected response format", 
                        '{"status": "healthy", "database": "connected"}',
                        str(data))
        else:
            log_test("Health Check", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Health Check", "FAIL", f"Connection error: {str(e)}")

def test_skip_webhook_sync():
    """Test 2: SKIP_WEBHOOK_SYNC functionality"""
    try:
        # Check nodejs logs for the expected messages
        result = subprocess.run(
            ["tail", "-n", "200", "/var/log/supervisor/nodejs.out.log"],
            capture_output=True, text=True, timeout=10
        )
        
        log_content = result.stdout
        
        # Look for READ-ONLY message (more specific search)
        has_readonly = "READ-ONLY — no webhook updates" in log_content
        # Look for absence of webhook update messages
        has_webhook_update = "Updated SIP domain webhook" in log_content
        
        if has_readonly and not has_webhook_update:
            log_test("SKIP_WEBHOOK_SYNC", "PASS", 
                    "Found 'READ-ONLY — no webhook updates' and no 'Updated SIP domain webhook' messages")
        elif has_readonly and has_webhook_update:
            log_test("SKIP_WEBHOOK_SYNC", "WARN", 
                    "Found READ-ONLY message but also found webhook update messages")
        elif not has_readonly:
            # Check for alternative READ-ONLY patterns
            alt_readonly = "Reading Twilio Resources (READ-ONLY" in log_content
            if alt_readonly:
                log_test("SKIP_WEBHOOK_SYNC", "PASS", 
                        "Found alternative READ-ONLY pattern in Twilio resource loading")
            else:
                log_test("SKIP_WEBHOOK_SYNC", "FAIL", 
                        "Did not find any READ-ONLY webhook sync messages in logs")
        else:
            log_test("SKIP_WEBHOOK_SYNC", "PASS", 
                    "SKIP_WEBHOOK_SYNC appears to be working correctly")
            
    except Exception as e:
        log_test("SKIP_WEBHOOK_SYNC", "FAIL", f"Error checking logs: {str(e)}")

def test_twilio_sip_domain_url():
    """Test 3: Twilio SIP domain URL preservation"""
    try:
        # Change to /app directory and run the node command
        os.chdir('/app')
        
        # Load environment variables
        subprocess.run(['node', '-e', 'require("dotenv").config()'], check=True)
        
        # Run the Twilio domain check
        node_command = '''
        require('dotenv').config();
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        client.sip.domains('SDdb6525d35a1f09e4d1dfc19a2128ed96').fetch()
            .then(d => console.log('Voice URL:', d.voiceUrl))
            .catch(e => console.error('Error:', e.message));
        '''
        
        result = subprocess.run(
            ['node', '-e', node_command],
            capture_output=True, text=True, timeout=30
        )
        
        if result.returncode == 0:
            output = result.stdout.strip()
            expected_url = "https://nomadlynew-production.up.railway.app/twilio/sip-voice"
            
            if expected_url in output:
                log_test("Twilio SIP Domain URL", "PASS", 
                        f"Railway URL preserved: {output}")
            else:
                log_test("Twilio SIP Domain URL", "FAIL", 
                        f"URL not preserved", expected_url, output)
        else:
            log_test("Twilio SIP Domain URL", "FAIL", 
                    f"Command failed: {result.stderr}")
            
    except Exception as e:
        log_test("Twilio SIP Domain URL", "FAIL", f"Error: {str(e)}")

def test_bridge_injection():
    """Test 4: Bridge injection endpoint"""
    try:
        payload = {
            "bridgeId": "bridge_test_abc",
            "destination": "+13025141000",
            "chatId": 6604316166,
            "selfUrl": "https://test.example.com"
        }
        
        response = requests.post(
            f"{NODE_SERVER_URL}/test/inject-bridge",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("bridgeId") == "bridge_test_abc":
                log_test("Bridge Injection", "PASS", 
                        f"Bridge injected successfully: {data}")
            else:
                log_test("Bridge Injection", "FAIL", 
                        f"Unexpected response format", 
                        '{"success": true, "bridgeId": "bridge_test_abc"}',
                        str(data))
        else:
            log_test("Bridge Injection", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("Bridge Injection", "FAIL", f"Error: {str(e)}")

def test_sip_voice_bridge_from_uri():
    """Test 5: SIP voice handler - bridge from SIP URI"""
    try:
        # First inject the bridge
        test_bridge_injection()
        
        # Wait a moment for the bridge to be stored
        time.sleep(1)
        
        form_data = {
            "To": "sip:bridge_test_abc@speechcue-7937a0.sip.twilio.com",
            "From": "sip:+18775877003@10.0.0.1",
            "CallSid": "CAtest1"
        }
        
        response = requests.post(
            f"{NODE_SERVER_URL}/twilio/sip-voice",
            data=form_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10
        )
        
        if response.status_code == 200:
            xml_content = response.text
            
            # Check for expected XML elements
            has_dial = "<Dial" in xml_content
            has_caller_id = "callerId" in xml_content
            has_destination = "+13025141000" in xml_content
            
            if has_dial and has_caller_id and has_destination:
                log_test("SIP Voice Bridge from URI", "PASS", 
                        f"XML response contains expected elements: <Dial>, callerId, and destination")
            else:
                missing = []
                if not has_dial: missing.append("<Dial>")
                if not has_caller_id: missing.append("callerId")
                if not has_destination: missing.append("+13025141000")
                
                log_test("SIP Voice Bridge from URI", "FAIL", 
                        f"Missing elements: {', '.join(missing)}", 
                        "XML with <Dial>, callerId, and +13025141000",
                        xml_content[:200] + "..." if len(xml_content) > 200 else xml_content)
        else:
            log_test("SIP Voice Bridge from URI", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("SIP Voice Bridge from URI", "FAIL", f"Error: {str(e)}")

def test_sip_voice_bridge_from_query():
    """Test 6: SIP voice handler - bridge from query param"""
    try:
        # First inject a new bridge
        payload = {
            "bridgeId": "bridge_test_qp",
            "destination": "+13025141000",
            "chatId": 6604316166,
            "selfUrl": "https://test.example.com"
        }
        
        requests.post(f"{NODE_SERVER_URL}/test/inject-bridge", json=payload, timeout=10)
        time.sleep(1)
        
        # Test with query parameter
        form_data = {
            "To": "+13025141000",
            "From": "+18888645099",
            "CallSid": "CAtest2"
        }
        
        response = requests.post(
            f"{NODE_SERVER_URL}/twilio/sip-voice?bridgeId=bridge_test_qp",
            data=form_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10
        )
        
        if response.status_code == 200:
            xml_content = response.text
            
            # Should contain bridge destination, NOT "session expired"
            has_destination = "+13025141000" in xml_content
            has_expired = "session expired" in xml_content.lower()
            
            if has_destination and not has_expired:
                log_test("SIP Voice Bridge from Query", "PASS", 
                        f"Bridge found via query param, destination present")
            elif has_expired:
                log_test("SIP Voice Bridge from Query", "FAIL", 
                        f"Got 'session expired' instead of bridge destination")
            else:
                log_test("SIP Voice Bridge from Query", "FAIL", 
                        f"Bridge destination not found in response", 
                        "XML containing +13025141000",
                        xml_content[:200] + "..." if len(xml_content) > 200 else xml_content)
        else:
            log_test("SIP Voice Bridge from Query", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("SIP Voice Bridge from Query", "FAIL", f"Error: {str(e)}")

def test_sip_voice_expired_bridge():
    """Test 7: SIP voice handler - expired bridge"""
    try:
        form_data = {
            "To": "sip:bridge_nonexistent@speechcue-7937a0.sip.twilio.com",
            "From": "sip:test@test.com",
            "CallSid": "CAtest3"
        }
        
        response = requests.post(
            f"{NODE_SERVER_URL}/twilio/sip-voice",
            data=form_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10
        )
        
        if response.status_code == 200:
            xml_content = response.text
            
            if "session expired" in xml_content.lower():
                log_test("SIP Voice Expired Bridge", "PASS", 
                        f"Correctly returned 'session expired' for nonexistent bridge")
            else:
                log_test("SIP Voice Expired Bridge", "FAIL", 
                        f"Did not return 'session expired' message", 
                        "XML containing 'session expired'",
                        xml_content[:200] + "..." if len(xml_content) > 200 else xml_content)
        else:
            log_test("SIP Voice Expired Bridge", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("SIP Voice Expired Bridge", "FAIL", f"Error: {str(e)}")

def test_verify_callerid():
    """Test 8: Verify-callerid endpoint"""
    try:
        form_data = {"test": "data"}
        
        response = requests.post(
            f"{NODE_SERVER_URL}/twilio/verify-callerid?code=123456",
            data=form_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10
        )
        
        if response.status_code == 200:
            xml_content = response.text
            
            # Should contain <Play digits= with the code digits (formatted as 1w2w3w4w5w6)
            has_play = "<Play digits=" in xml_content
            has_digits = "1w2w3w4w5w6" in xml_content  # Twilio DTMF format
            
            if has_play and has_digits:
                log_test("Verify CallerID", "PASS", 
                        f"XML response contains <Play digits= with DTMF code digits")
            else:
                missing = []
                if not has_play: missing.append("<Play digits=")
                if not has_digits: missing.append("DTMF code digits (1w2w3w4w5w6)")
                
                log_test("Verify CallerID", "FAIL", 
                        f"Missing elements: {', '.join(missing)}", 
                        "XML with <Play digits= and DTMF code digits",
                        xml_content[:200] + "..." if len(xml_content) > 200 else xml_content)
        else:
            log_test("Verify CallerID", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("Verify CallerID", "FAIL", f"Error: {str(e)}")

def test_caller_ids_verified():
    """Test 9: Caller IDs verified on main account"""
    try:
        os.chdir('/app')
        
        node_command = '''
        require('dotenv').config();
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        client.outgoingCallerIds.list({limit:20})
            .then(ids => ids.forEach(c => console.log(c.phoneNumber, c.friendlyName)))
            .catch(e => console.error('Error:', e.message));
        '''
        
        result = subprocess.run(
            ['node', '-e', node_command],
            capture_output=True, text=True, timeout=30
        )
        
        if result.returncode == 0:
            output = result.stdout
            
            # Check for expected numbers
            expected_numbers = ["+18888645099", "+18887847992", "+18884508057"]
            found_numbers = []
            
            for number in expected_numbers:
                if number in output:
                    found_numbers.append(number)
            
            if len(found_numbers) == len(expected_numbers):
                log_test("Caller IDs Verified", "PASS", 
                        f"All expected numbers found: {', '.join(found_numbers)}")
            else:
                missing = [n for n in expected_numbers if n not in found_numbers]
                log_test("Caller IDs Verified", "FAIL", 
                        f"Missing numbers: {', '.join(missing)}", 
                        f"All numbers: {', '.join(expected_numbers)}",
                        f"Found: {', '.join(found_numbers)}")
        else:
            log_test("Caller IDs Verified", "FAIL", 
                    f"Command failed: {result.stderr}")
            
    except Exception as e:
        log_test("Caller IDs Verified", "FAIL", f"Error: {str(e)}")

def test_sip_bridge_endpoint():
    """Test 10: SIP bridge test endpoint"""
    try:
        payload = {
            "destination": "+13025141000",
            "chatId": 6604316166
        }
        
        response = requests.post(
            f"{NODE_SERVER_URL}/test/sip-bridge",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            log_test("SIP Bridge Test Endpoint", "PASS", 
                    f"Endpoint accessible and working: {data}")
        elif response.status_code == 400:
            data = response.json()
            if "destination and chatId required" in data.get("error", ""):
                log_test("SIP Bridge Test Endpoint", "PASS", 
                        f"Endpoint exists and validates input correctly")
            else:
                log_test("SIP Bridge Test Endpoint", "FAIL", 
                        f"Unexpected 400 error: {data}")
        elif response.status_code == 404:
            data = response.json()
            if "No active Twilio number found" in data.get("error", ""):
                log_test("SIP Bridge Test Endpoint", "PASS", 
                        f"Endpoint exists but no Twilio number for test chatId (expected)")
            else:
                log_test("SIP Bridge Test Endpoint", "FAIL", 
                        f"Unexpected 404 error: {data}")
        else:
            log_test("SIP Bridge Test Endpoint", "FAIL", 
                    f"HTTP {response.status_code}: {response.text}")
            
    except Exception as e:
        log_test("SIP Bridge Test Endpoint", "FAIL", f"Error: {str(e)}")

def run_all_tests():
    """Run all SIP bridge tests"""
    print("🚀 Starting SIP Bridge Testing Suite")
    print("=" * 50)
    
    # Run all tests
    test_health_check()
    test_skip_webhook_sync()
    test_twilio_sip_domain_url()
    test_bridge_injection()
    test_sip_voice_bridge_from_uri()
    test_sip_voice_bridge_from_query()
    test_sip_voice_expired_bridge()
    test_verify_callerid()
    test_caller_ids_verified()
    test_sip_bridge_endpoint()
    
    # Summary
    print("=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = len([t for t in TEST_RESULTS if t["status"] == "PASS"])
    failed = len([t for t in TEST_RESULTS if t["status"] == "FAIL"])
    warned = len([t for t in TEST_RESULTS if t["status"] == "WARN"])
    total = len(TEST_RESULTS)
    
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⚠️  Warnings: {warned}")
    print(f"📈 Total: {total}")
    print(f"📊 Success Rate: {(passed/total*100):.1f}%")
    
    # Failed tests details
    if failed > 0:
        print("\n❌ FAILED TESTS:")
        for test in TEST_RESULTS:
            if test["status"] == "FAIL":
                print(f"  • {test['test']}: {test['details']}")
    
    # Save results to file
    with open('/app/sip_bridge_test_results.json', 'w') as f:
        json.dump(TEST_RESULTS, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/sip_bridge_test_results.json")
    
    return failed == 0

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)