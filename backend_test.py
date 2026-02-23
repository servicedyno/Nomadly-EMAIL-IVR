#!/usr/bin/env python3
"""
Telnyx SIP Voice Service Integration Test
Tests the Node.js Express app endpoints for Telnyx voice webhook handling.
"""

import requests
import json
import sys
import time
from urllib.parse import urljoin

# Backend URL - Node.js service runs on port 5000
BACKEND_URL = "http://localhost:5000"

# Test configuration
TEST_CONFIG = {
    "inbound_number": "+18777000068",  # Number that was migrated to Call Control App
    "call_control_app_id": "2898117434361775526",
    "sip_connection_id": "2898118323872990714",
    "caller_number": "+15551234567",
    "timeout": 10
}

def log(message):
    """Log test messages with timestamp"""
    print(f"[TEST] {message}")

def test_health_check():
    """Test basic health check endpoint"""
    log("Testing health check endpoint...")
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=TEST_CONFIG["timeout"])
        log(f"Health check response: {response.status_code}")
        if response.status_code == 200:
            log("✅ Health check passed")
            return True
        else:
            log(f"❌ Health check failed with status {response.status_code}")
            return False
    except Exception as e:
        log(f"❌ Health check failed with exception: {e}")
        return False

def test_inbound_call_webhook():
    """Test inbound call to migrated number (should handle via Call Control App)"""
    log("Testing inbound call webhook handler...")
    
    webhook_data = {
        "data": {
            "event_type": "call.initiated",
            "payload": {
                "direction": "incoming",
                "from": TEST_CONFIG["caller_number"],
                "to": TEST_CONFIG["inbound_number"],
                "call_control_id": "test-inbound-001",
                "call_leg_id": "leg-001",
                "connection_id": TEST_CONFIG["call_control_app_id"],
                "state": "ringing"
            }
        }
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/telnyx/voice-webhook",
            json=webhook_data,
            timeout=TEST_CONFIG["timeout"],
            headers={"Content-Type": "application/json"}
        )
        
        log(f"Inbound call webhook response: {response.status_code}")
        
        if response.status_code == 200:
            log(f"✅ Inbound call webhook handled correctly")
            log(f"Response content: {response.text[:200] if response.text else 'No content'}")
            return True
        else:
            log(f"❌ Inbound call webhook failed with status {response.status_code}")
            log(f"Response: {response.text[:500] if response.text else 'No content'}")
            return False
            
    except Exception as e:
        log(f"❌ Inbound call webhook failed with exception: {e}")
        return False

def test_outbound_sip_call_webhook():
    """Test outbound SIP call (from SIP device via credential connection)"""
    log("Testing outbound SIP call webhook handler...")
    
    webhook_data = {
        "data": {
            "event_type": "call.initiated",
            "payload": {
                "direction": "outgoing",
                "from": TEST_CONFIG["inbound_number"],
                "to": TEST_CONFIG["caller_number"],
                "call_control_id": "test-outbound-001",
                "call_leg_id": "leg-002",
                "connection_id": TEST_CONFIG["sip_connection_id"],
                "state": "bridging"
            }
        }
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/telnyx/voice-webhook",
            json=webhook_data,
            timeout=TEST_CONFIG["timeout"],
            headers={"Content-Type": "application/json"}
        )
        
        log(f"Outbound SIP call webhook response: {response.status_code}")
        
        if response.status_code == 200:
            log(f"✅ Outbound SIP call webhook handled correctly")
            log(f"Response content: {response.text[:200] if response.text else 'No content'}")
            return True
        else:
            log(f"❌ Outbound SIP call webhook failed with status {response.status_code}")
            log(f"Response: {response.text[:500] if response.text else 'No content'}")
            return False
            
    except Exception as e:
        log(f"❌ Outbound SIP call webhook failed with exception: {e}")
        return False

def test_call_hangup_webhook():
    """Test call hangup event handling"""
    log("Testing call hangup webhook handler...")
    
    webhook_data = {
        "data": {
            "event_type": "call.hangup",
            "payload": {
                "direction": "incoming",
                "from": TEST_CONFIG["caller_number"],
                "to": TEST_CONFIG["inbound_number"],
                "call_control_id": "test-hangup-001",
                "call_leg_id": "leg-003",
                "connection_id": TEST_CONFIG["call_control_app_id"],
                "hangup_cause": "normal",
                "duration_secs": 30
            }
        }
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/telnyx/voice-webhook",
            json=webhook_data,
            timeout=TEST_CONFIG["timeout"],
            headers={"Content-Type": "application/json"}
        )
        
        log(f"Call hangup webhook response: {response.status_code}")
        
        if response.status_code == 200:
            log(f"✅ Call hangup webhook handled correctly")
            return True
        else:
            log(f"❌ Call hangup webhook failed with status {response.status_code}")
            log(f"Response: {response.text[:500] if response.text else 'No content'}")
            return False
            
    except Exception as e:
        log(f"❌ Call hangup webhook failed with exception: {e}")
        return False

def check_startup_logs():
    """Check if startup logs show proper migration and resource initialization"""
    log("Checking startup logs for migration and initialization...")
    
    try:
        # Check nodejs startup logs
        import subprocess
        result = subprocess.run(
            ["tail", "-n", "50", "/var/log/supervisor/nodejs.out.log"],
            capture_output=True, text=True, timeout=5
        )
        
        logs = result.stdout
        
        # Check for migration message
        migration_found = False
        if f"Migrated {TEST_CONFIG['inbound_number']} to Call Control App" in logs:
            log(f"✅ Found migration message for {TEST_CONFIG['inbound_number']}")
            migration_found = True
        elif "Migration complete" in logs:
            log("✅ Found migration completion message")
            migration_found = True
        else:
            log("❌ Migration message not found in logs")
        
        # Check for Call Control App ID
        app_id_found = False
        if TEST_CONFIG["call_control_app_id"] in logs:
            log(f"✅ Found Call Control App ID: {TEST_CONFIG['call_control_app_id']}")
            app_id_found = True
        else:
            log(f"❌ Call Control App ID {TEST_CONFIG['call_control_app_id']} not found in logs")
        
        # Check for Telnyx resources initialization
        resources_found = False
        if "Telnyx Resources Ready" in logs:
            log("✅ Found Telnyx Resources Ready message")
            resources_found = True
        else:
            log("❌ Telnyx Resources Ready message not found")
        
        return migration_found and app_id_found and resources_found
        
    except Exception as e:
        log(f"❌ Error checking startup logs: {e}")
        return False

def check_error_logs():
    """Check error logs to ensure they're clean"""
    log("Checking error logs...")
    
    try:
        import subprocess
        result = subprocess.run(
            ["tail", "-n", "20", "/var/log/supervisor/nodejs.err.log"],
            capture_output=True, text=True, timeout=5
        )
        
        error_logs = result.stdout.strip()
        
        if not error_logs or error_logs == "Exit code: 0":
            log("✅ Error logs are clean (no errors)")
            return True
        else:
            log(f"⚠️ Found content in error logs: {error_logs}")
            # Check if errors are critical
            if any(keyword in error_logs.lower() for keyword in ['error', 'failed', 'exception']):
                log("❌ Critical errors found in logs")
                return False
            else:
                log("✅ Non-critical content in logs")
                return True
                
    except Exception as e:
        log(f"❌ Error checking error logs: {e}")
        return False

def test_webhook_endpoint_exists():
    """Test if the webhook endpoint exists and responds"""
    log("Testing webhook endpoint existence...")
    
    try:
        # Test with a minimal payload to see if endpoint exists
        response = requests.post(
            f"{BACKEND_URL}/telnyx/voice-webhook",
            json={"test": "ping"},
            timeout=TEST_CONFIG["timeout"],
            headers={"Content-Type": "application/json"}
        )
        
        # Any response (even 400) means the endpoint exists
        if response.status_code in [200, 400, 422]:
            log(f"✅ Webhook endpoint exists and responds (status: {response.status_code})")
            return True
        else:
            log(f"❌ Webhook endpoint returned unexpected status: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        log("❌ Webhook endpoint not reachable - connection error")
        return False
    except Exception as e:
        log(f"❌ Webhook endpoint test failed: {e}")
        return False

def main():
    """Run all tests and report results"""
    log("Starting Telnyx SIP Voice Service Integration Tests")
    log(f"Backend URL: {BACKEND_URL}")
    log(f"Test target number: {TEST_CONFIG['inbound_number']}")
    log("=" * 60)
    
    tests = [
        ("Health Check", test_health_check),
        ("Webhook Endpoint Exists", test_webhook_endpoint_exists),
        ("Startup Logs Check", check_startup_logs),
        ("Error Logs Check", check_error_logs),
        ("Inbound Call Webhook", test_inbound_call_webhook),
        ("Outbound SIP Call Webhook", test_outbound_sip_call_webhook),
        ("Call Hangup Webhook", test_call_hangup_webhook),
    ]
    
    results = []
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        log(f"\n--- Running: {test_name} ---")
        try:
            result = test_func()
            results.append((test_name, result))
            if result:
                passed += 1
            time.sleep(0.5)  # Small delay between tests
        except Exception as e:
            log(f"❌ Test {test_name} crashed: {e}")
            results.append((test_name, False))
    
    # Print summary
    log("\n" + "=" * 60)
    log("TEST SUMMARY")
    log("=" * 60)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        log(f"{status} - {test_name}")
    
    log(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        log("🎉 All tests passed!")
        return 0
    else:
        log("⚠️ Some tests failed!")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)