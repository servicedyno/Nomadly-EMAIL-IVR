"""
Phone Test Page OTP API Tests
Tests the new OTP-based authentication flow for SIP test credentials
- POST /api/phone/test/verify-otp endpoint
"""
import pytest
import requests
import os

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestVerifyOtpEndpoint:
    """Tests for POST /api/phone/test/verify-otp endpoint"""
    
    def test_verify_otp_with_invalid_otp_returns_401(self):
        """Test that invalid OTP returns 401 unauthorized"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": "123456"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Response should contain 'error' field"
        assert "Invalid OTP" in data.get("error", ""), f"Error message mismatch: {data}"
        print(f"✅ Invalid OTP returns 401: {data.get('message', data.get('error'))}")
    
    def test_verify_otp_with_short_otp_returns_400(self):
        """Test that OTP with wrong length returns 400 bad request"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": "12345"},  # Only 5 digits
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Response should contain 'error' field"
        print(f"✅ Short OTP returns 400: {data.get('message', data.get('error'))}")
    
    def test_verify_otp_with_long_otp_returns_400(self):
        """Test that OTP with too many digits returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": "1234567"},  # 7 digits
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Response should contain 'error' field"
        print(f"✅ Long OTP returns 400: {data.get('message', data.get('error'))}")
    
    def test_verify_otp_with_empty_otp_returns_400(self):
        """Test that empty OTP returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": ""},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Response should contain 'error' field"
        print(f"✅ Empty OTP returns 400: {data.get('message', data.get('error'))}")
    
    def test_verify_otp_missing_otp_field_returns_400(self):
        """Test that missing OTP field returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Response should contain 'error' field"
        print(f"✅ Missing OTP field returns 400: {data.get('message', data.get('error'))}")
    
    def test_verify_otp_with_non_numeric_returns_400(self):
        """Test that non-numeric OTP returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": "abcdef"},
            headers={"Content-Type": "application/json"}
        )
        
        # Should be 400 (invalid format) or 401 (invalid OTP)
        assert response.status_code in [400, 401], f"Expected 400 or 401, got {response.status_code}"
        data = response.json()
        assert "error" in data, "Response should contain 'error' field"
        print(f"✅ Non-numeric OTP returns {response.status_code}: {data.get('message', data.get('error'))}")
    
    def test_verify_otp_returns_json(self):
        """Test that endpoint always returns valid JSON"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": "000000"},
            headers={"Content-Type": "application/json"}
        )
        
        # Should be able to parse JSON
        data = response.json()
        assert isinstance(data, dict), "Response should be a JSON object"
        print(f"✅ Response is valid JSON: {data}")
    
    def test_verify_otp_error_response_structure(self):
        """Test that error responses have proper structure"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": "999999"},
            headers={"Content-Type": "application/json"}
        )
        
        data = response.json()
        
        # Error response should have error and optionally message
        if response.status_code != 200:
            assert "error" in data or "message" in data, "Error response should have error or message field"
            print(f"✅ Error response structure valid: {data}")


class TestOldCredentialsEndpointRemoved:
    """Test that the old /api/phone/test/credentials endpoint is removed"""
    
    def test_old_credentials_endpoint_not_found(self):
        """Test that POST /api/phone/test/credentials returns 404 or error"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/credentials",
            headers={"Content-Type": "application/json"}
        )
        
        # Old endpoint should be removed - expect 404 or some error
        # If it returns 200, the endpoint is still active (which it shouldn't be)
        if response.status_code == 200:
            data = response.json()
            # Check if it's returning actual credentials (it shouldn't)
            if "sipUsername" in data and "sipPassword" in data:
                pytest.fail("Old /api/phone/test/credentials endpoint should be removed but is still returning credentials")
            print(f"⚠️ Endpoint returns 200 but no credentials: {data}")
        else:
            print(f"✅ Old credentials endpoint returns {response.status_code} (expected - endpoint removed)")


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
