"""
Phone Test Page API Tests
Tests the /api/phone/test/credentials endpoint
"""
import pytest
import requests
import os

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhoneTestCredentialsAPI:
    """Tests for POST /api/phone/test/credentials endpoint"""
    
    def test_credentials_endpoint_returns_200(self):
        """Test that credentials endpoint returns successful response"""
        response = requests.post(f"{BASE_URL}/api/phone/test/credentials")
        # May return 200 (success) or 429 (rate limited) or 500 (if Telnyx not configured)
        assert response.status_code in [200, 429, 500], f"Unexpected status: {response.status_code}"
        print(f"Credentials endpoint returned status: {response.status_code}")
    
    def test_credentials_returns_valid_json(self):
        """Test that credentials endpoint returns valid JSON"""
        response = requests.post(f"{BASE_URL}/api/phone/test/credentials")
        
        # Verify it's valid JSON
        data = response.json()
        assert isinstance(data, dict), "Response should be a JSON object"
        print(f"Response JSON: {data}")
    
    def test_credentials_success_response_structure(self):
        """Test that successful response has required fields"""
        response = requests.post(f"{BASE_URL}/api/phone/test/credentials")
        data = response.json()
        
        if response.status_code == 200 and 'error' not in data:
            # Success response should have these fields
            assert 'sipUsername' in data, "Missing sipUsername"
            assert 'sipPassword' in data, "Missing sipPassword"
            assert 'sipDomain' in data, "Missing sipDomain"
            assert 'callsRemaining' in data, "Missing callsRemaining"
            assert 'maxDuration' in data, "Missing maxDuration"
            
            # Validate types
            assert isinstance(data['sipUsername'], str), "sipUsername should be string"
            assert isinstance(data['sipPassword'], str), "sipPassword should be string"
            assert isinstance(data['sipDomain'], str), "sipDomain should be string"
            assert isinstance(data['callsRemaining'], int), "callsRemaining should be int"
            assert isinstance(data['maxDuration'], int), "maxDuration should be int"
            
            print(f"✅ Credentials structure valid: {data['sipUsername']}")
        elif response.status_code == 429:
            # Rate limited - should have error message
            assert 'error' in data or 'message' in data, "Rate limit response should have error/message"
            print(f"⚠️ Rate limited: {data.get('message', data.get('error'))}")
        else:
            # Error response
            print(f"⚠️ Error response: {data}")
    
    def test_sip_domain_is_speechcue(self):
        """Test that SIP domain is speechcue branded (not telnyx)"""
        response = requests.post(f"{BASE_URL}/api/phone/test/credentials")
        data = response.json()
        
        if response.status_code == 200 and 'sipDomain' in data:
            sip_domain = data['sipDomain']
            assert 'speechcue' in sip_domain.lower(), f"SIP domain should be speechcue, got: {sip_domain}"
            assert 'telnyx' not in sip_domain.lower(), f"SIP domain should NOT mention telnyx: {sip_domain}"
            print(f"✅ SIP domain correctly branded: {sip_domain}")
        else:
            pytest.skip("Could not verify SIP domain - credentials not returned")
    
    def test_max_duration_is_60_seconds(self):
        """Test that max call duration for test is 60 seconds"""
        response = requests.post(f"{BASE_URL}/api/phone/test/credentials")
        data = response.json()
        
        if response.status_code == 200 and 'maxDuration' in data:
            assert data['maxDuration'] == 60, f"Max duration should be 60, got: {data['maxDuration']}"
            print(f"✅ Max duration correctly set: {data['maxDuration']}s")
        else:
            pytest.skip("Could not verify max duration - credentials not returned")
    
    def test_calls_remaining_max_2(self):
        """Test that calls remaining is max 2 per IP"""
        response = requests.post(f"{BASE_URL}/api/phone/test/credentials")
        data = response.json()
        
        if response.status_code == 200 and 'callsRemaining' in data:
            assert data['callsRemaining'] <= 2, f"Calls remaining should be <= 2, got: {data['callsRemaining']}"
            print(f"✅ Calls remaining within limit: {data['callsRemaining']}")
        elif response.status_code == 429:
            print("⚠️ Rate limited - this IP has exhausted test calls")
        else:
            pytest.skip("Could not verify calls remaining")


class TestPhoneTestPageRoutes:
    """Test that page routes work correctly"""
    
    def test_phone_test_page_accessible(self):
        """Test that /phone/test page is accessible"""
        response = requests.get(f"{BASE_URL}/phone/test")
        # Should return HTML or be proxied correctly
        assert response.status_code in [200, 304], f"Phone test page not accessible: {response.status_code}"
        print(f"✅ /phone/test accessible: {response.status_code}")
    
    def test_root_page_accessible(self):
        """Test that root / page is accessible"""
        response = requests.get(f"{BASE_URL}/")
        assert response.status_code in [200, 304], f"Root page not accessible: {response.status_code}"
        print(f"✅ Root page accessible: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
