#!/usr/bin/env python3
"""
Backend Test for Nomadly - Review Request Verification
Tests the specific endpoints mentioned in the review request:
1. GET http://localhost:5000/health
2. GET http://localhost:8001/api/health  
3. POST http://localhost:5000/twilio/voice-webhook
4. POST http://localhost:5000/twilio/sms-webhook
5. POST http://localhost:5000/twilio/voice-status
"""

import requests
import json
import sys
from urllib.parse import urlencode

# Test configuration
NODEJS_URL = "http://localhost:5000"
FASTAPI_URL = "http://localhost:8001"

def test_health_endpoints():
    """Test health check endpoints"""
    print("🔍 Testing Health Check Endpoints...")
    
    # Test 1: Direct Node.js health check
    try:
        response = requests.get(f"{NODEJS_URL}/health", timeout=10)
        print(f"✅ GET {NODEJS_URL}/health - Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify expected fields
            if data.get("status") == "healthy" and "database" in data:
                print("   ✅ Health check response format is correct")
            else:
                print("   ❌ Health check response missing expected fields")
                return False
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error testing Node.js health: {e}")
        return False
    
    # Test 2: FastAPI proxy health check
    try:
        response = requests.get(f"{FASTAPI_URL}/api/health", timeout=10)
        print(f"✅ GET {FASTAPI_URL}/api/health - Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Response: {json.dumps(data, indent=2)}")
            
            # Verify expected fields
            if data.get("status") == "healthy" and "database" in data:
                print("   ✅ Proxy health check response format is correct")
            else:
                print("   ❌ Proxy health check response missing expected fields")
                return False
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error testing FastAPI proxy health: {e}")
        return False
    
    return True

def test_twilio_voice_webhook():
    """Test Twilio voice webhook endpoint"""
    print("\n🔍 Testing Twilio Voice Webhook...")
    
    # Test data as specified in review request
    webhook_data = {
        'To': '+18339561373',
        'From': '+19106516884', 
        'CallSid': 'test123'
    }
    
    try:
        response = requests.post(
            f"{NODEJS_URL}/twilio/voice-webhook",
            data=webhook_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=10
        )
        
        print(f"✅ POST {NODEJS_URL}/twilio/voice-webhook - Status: {response.status_code}")
        print(f"   Request data: {webhook_data}")
        
        if response.status_code == 200:
            # Check if response is valid TwiML XML
            content_type = response.headers.get('content-type', '').lower()
            if 'xml' in content_type or response.text.strip().startswith('<?xml') or response.text.strip().startswith('<Response'):
                print("   ✅ Response appears to be valid TwiML XML")
                print(f"   Content-Type: {content_type}")
                print(f"   Response length: {len(response.text)} chars")
                # Print first 200 chars of response for verification
                preview = response.text[:200] + "..." if len(response.text) > 200 else response.text
                print(f"   Response preview: {preview}")
                return True
            else:
                print(f"   ❌ Response doesn't appear to be XML. Content-Type: {content_type}")
                print(f"   Response: {response.text[:500]}")
                return False
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error testing voice webhook: {e}")
        return False

def test_twilio_sms_webhook():
    """Test Twilio SMS webhook endpoint"""
    print("\n🔍 Testing Twilio SMS Webhook...")
    
    # Test data as specified in review request
    webhook_data = {
        'To': '+18339561373',
        'From': '+19106516884',
        'Body': 'test'
    }
    
    try:
        response = requests.post(
            f"{NODEJS_URL}/twilio/sms-webhook",
            data=webhook_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=10
        )
        
        print(f"✅ POST {NODEJS_URL}/twilio/sms-webhook - Status: {response.status_code}")
        print(f"   Request data: {webhook_data}")
        
        if response.status_code == 200:
            # Check if response is valid TwiML XML
            content_type = response.headers.get('content-type', '').lower()
            if 'xml' in content_type or response.text.strip().startswith('<?xml') or response.text.strip().startswith('<Response'):
                print("   ✅ Response appears to be valid TwiML XML")
                print(f"   Content-Type: {content_type}")
                print(f"   Response length: {len(response.text)} chars")
                # Print first 200 chars of response for verification
                preview = response.text[:200] + "..." if len(response.text) > 200 else response.text
                print(f"   Response preview: {preview}")
                return True
            else:
                print(f"   ❌ Response doesn't appear to be XML. Content-Type: {content_type}")
                print(f"   Response: {response.text[:500]}")
                return False
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error testing SMS webhook: {e}")
        return False

def test_twilio_voice_status():
    """Test Twilio voice status webhook endpoint"""
    print("\n🔍 Testing Twilio Voice Status Webhook...")
    
    # Test data as specified in review request
    status_data = {
        'CallSid': 'test',
        'CallStatus': 'completed',
        'CallDuration': '60',
        'To': '+18339561373',
        'From': '+19106516884'
    }
    
    try:
        response = requests.post(
            f"{NODEJS_URL}/twilio/voice-status",
            data=status_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=10
        )
        
        print(f"✅ POST {NODEJS_URL}/twilio/voice-status - Status: {response.status_code}")
        print(f"   Request data: {status_data}")
        
        if response.status_code == 200:
            print("   ✅ Voice status webhook returned 200 as expected")
            print(f"   Response length: {len(response.text)} chars")
            # Print response for verification (should be minimal for status webhooks)
            if response.text:
                preview = response.text[:200] + "..." if len(response.text) > 200 else response.text
                print(f"   Response: {preview}")
            else:
                print("   Response: (empty - normal for status webhooks)")
            return True
        else:
            print(f"   ❌ Expected 200, got {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error testing voice status webhook: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Nomadly Backend Tests - Review Request Verification")
    print("=" * 70)
    
    tests = [
        ("Health Check Endpoints", test_health_endpoints),
        ("Twilio Voice Webhook", test_twilio_voice_webhook),
        ("Twilio SMS Webhook", test_twilio_sms_webhook),
        ("Twilio Voice Status", test_twilio_voice_status),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"✅ {test_name} - PASSED")
            else:
                print(f"❌ {test_name} - FAILED")
        except Exception as e:
            print(f"❌ {test_name} - ERROR: {e}")
        
        print("-" * 50)
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Backend endpoints are working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the output above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())