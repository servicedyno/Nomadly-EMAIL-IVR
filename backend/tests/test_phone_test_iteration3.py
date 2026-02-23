"""
Backend Tests for Speechcue SIP Test Page - Iteration 3
Tests for:
1. POST /api/phone/test/verify-otp with invalid OTP returns 401 with '/testsip' in message
2. POST /api/phone/test/verify-otp with short OTP returns 400
3. Old GET /api/sip-test-credentials endpoint is removed (should 404)
4. SipTest.js file has been deleted
"""

import pytest
import requests
import os

# Get base URL from environment variable
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhoneTestOtpEndpoint:
    """Tests for the /api/phone/test/verify-otp endpoint with /testsip command"""

    def test_invalid_otp_returns_401_with_testsip_message(self):
        """POST /api/phone/test/verify-otp with invalid OTP returns 401 with '/testsip' in message"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": "999999"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        data = response.json()
        assert "error" in data, "Response should have 'error' field"
        assert "message" in data, "Response should have 'message' field"
        
        # Verify '/testsip' is mentioned in the error message (not '/test')
        assert "/testsip" in data["message"], f"Message should mention '/testsip', got: {data['message']}"
        
        # Verify old '/test' command is NOT mentioned
        # Check that '/test' is NOT present without being part of '/testsip'
        message_without_testsip = data["message"].replace("/testsip", "")
        assert "/test" not in message_without_testsip, f"Old '/test' command should not be in message: {data['message']}"

    def test_short_otp_returns_400(self):
        """POST /api/phone/test/verify-otp with short OTP (< 6 digits) returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": "123"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        assert response.status_code == 400, f"Expected 400 for short OTP, got {response.status_code}"
        
        data = response.json()
        assert "error" in data or "message" in data, "Response should have error details"

    def test_long_otp_returns_400(self):
        """POST /api/phone/test/verify-otp with long OTP (> 6 digits) returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": "12345678"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        assert response.status_code == 400, f"Expected 400 for long OTP, got {response.status_code}"

    def test_empty_otp_returns_400(self):
        """POST /api/phone/test/verify-otp with empty OTP returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": ""},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        assert response.status_code == 400, f"Expected 400 for empty OTP, got {response.status_code}"

    def test_missing_otp_returns_400(self):
        """POST /api/phone/test/verify-otp with missing OTP field returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        assert response.status_code == 400, f"Expected 400 for missing OTP, got {response.status_code}"


class TestOldEndpointRemoved:
    """Tests to verify old endpoints are properly removed"""

    def test_old_sip_test_credentials_endpoint_removed(self):
        """GET /api/sip-test-credentials should return 404 (endpoint removed)"""
        response = requests.get(
            f"{BASE_URL}/api/sip-test-credentials",
            timeout=10
        )
        
        # Should return 404 since the endpoint was removed
        assert response.status_code == 404, f"Old /api/sip-test-credentials endpoint should return 404, got {response.status_code}"


class TestFileCleanup:
    """Tests to verify old files are properly deleted"""

    def test_siptest_js_file_deleted(self):
        """SipTest.js file should no longer exist at /app/frontend/src/pages/SipTest.js"""
        siptest_path = "/app/frontend/src/pages/SipTest.js"
        file_exists = os.path.exists(siptest_path)
        
        assert not file_exists, f"SipTest.js file should be deleted but still exists at {siptest_path}"


class TestExpiredOtp:
    """Tests for expired OTP handling"""

    def test_expired_otp_returns_401_with_testsip_message(self):
        """POST /api/phone/test/verify-otp with expired OTP returns 401 with '/testsip' in message"""
        # Use a random OTP that doesn't exist (effectively expired)
        response = requests.post(
            f"{BASE_URL}/api/phone/test/verify-otp",
            json={"otp": "000001"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        assert response.status_code == 401, f"Expected 401 for invalid/expired OTP, got {response.status_code}"
        
        data = response.json()
        assert "/testsip" in data.get("message", ""), "Error message should mention /testsip command"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
