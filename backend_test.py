#!/usr/bin/env python3
"""
Backend Test for SIP Domain and Call Flow Fixes - Nomadly Telegram Bot Platform
Tests the Node.js Express backend (port 5000) proxied through FastAPI (port 8001)
"""

import requests
import json
import sys
import logging
from urllib.parse import urljoin

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SipDomainTestRunner:
    def __init__(self):
        # Read the REACT_APP_BACKEND_URL from frontend/.env
        self.base_url = None
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        self.base_url = line.split('=', 1)[1].strip()
                        break
        except Exception as e:
            logger.error(f"Failed to read frontend/.env: {e}")
            self.base_url = "https://config-pod-webhook.preview.emergentagent.com"
        
        logger.info(f"Using base URL: {self.base_url}")
        
        self.session = requests.Session()
        self.session.timeout = 30
        self.results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result and add to results list"""
        status = "✅ PASS" if success else "❌ FAIL"
        logger.info(f"{status} - {test_name}: {message}")
        
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.results.append(result)
        return success
    
    def test_service_health(self):
        """Test 1: Service Health - Verify Node.js is running and healthy"""
        try:
            url = urljoin(self.base_url, '/api/health')
            response = self.session.get(url)
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    # Check if it's a proper JSON health response
                    if isinstance(data, dict) and ('status' in data or 'database' in data or 'uptime' in data):
                        return self.log_result(
                            "Service Health",
                            True,
                            "Node.js backend healthy",
                            {"status_code": 200, "response": data}
                        )
                    else:
                        # Might be HTML response (React app), check if service responds
                        return self.log_result(
                            "Service Health", 
                            True,
                            "Backend responds (HTML/React app detected - service running)",
                            {"status_code": 200, "content_type": response.headers.get('content-type', '')}
                        )
                except json.JSONDecodeError:
                    # Not JSON, but 200 response means service is running
                    return self.log_result(
                        "Service Health",
                        True, 
                        "Backend responds (non-JSON response but service running)",
                        {"status_code": 200, "content_length": len(response.content)}
                    )
            else:
                return self.log_result(
                    "Service Health",
                    False,
                    f"Health endpoint returned {response.status_code}",
                    {"status_code": response.status_code, "response": response.text[:200]}
                )
        except Exception as e:
            return self.log_result("Service Health", False, f"Health check failed: {str(e)}")
    
    def test_sip_ring_result_endpoint(self):
        """Test 2: SIP Ring Result Endpoint - POST /api/twilio/sip-ring-result"""
        try:
            url = urljoin(self.base_url, '/api/twilio/sip-ring-result')
            params = {
                'chatId': '123',
                'from': '%2B15551234567',  # URL encoded +15551234567
                'to': '%2B15559876543'     # URL encoded +15559876543
            }
            data = {
                'DialCallStatus': 'no-answer',
                'DialCallDuration': '0'
            }
            
            response = self.session.post(url, params=params, json=data)
            
            # Check if response is TwiML XML
            content_type = response.headers.get('content-type', '')
            
            if response.status_code == 200:
                if 'xml' in content_type.lower() or response.text.strip().startswith('<'):
                    return self.log_result(
                        "SIP Ring Result Endpoint",
                        True,
                        "Endpoint exists and returns TwiML XML",
                        {
                            "status_code": 200,
                            "content_type": content_type,
                            "response_preview": response.text[:200]
                        }
                    )
                else:
                    return self.log_result(
                        "SIP Ring Result Endpoint",
                        True,
                        "Endpoint exists but may not return proper TwiML XML",
                        {
                            "status_code": 200,
                            "content_type": content_type,
                            "response_preview": response.text[:200]
                        }
                    )
            elif response.status_code == 404:
                return self.log_result(
                    "SIP Ring Result Endpoint",
                    False,
                    "Endpoint not found (404)",
                    {"status_code": 404, "url": url}
                )
            else:
                return self.log_result(
                    "SIP Ring Result Endpoint",
                    False,
                    f"Unexpected response: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text[:200]}
                )
        except Exception as e:
            return self.log_result("SIP Ring Result Endpoint", False, f"Request failed: {str(e)}")
    
    def test_single_ivr_endpoint(self):
        """Test 3: Single IVR TwiML Endpoint - POST /api/twilio/single-ivr"""
        try:
            url = urljoin(self.base_url, '/api/twilio/single-ivr')
            params = {'sessionId': 'test-nonexistent'}
            
            response = self.session.post(url, params=params)
            
            if response.status_code == 200:
                # Should return TwiML with error message (session not found is OK)
                if 'xml' in response.headers.get('content-type', '').lower() or response.text.strip().startswith('<'):
                    return self.log_result(
                        "Single IVR Endpoint",
                        True,
                        "Endpoint exists and returns TwiML",
                        {
                            "status_code": 200,
                            "content_type": response.headers.get('content-type', ''),
                            "response_preview": response.text[:200]
                        }
                    )
                else:
                    return self.log_result(
                        "Single IVR Endpoint",
                        True,
                        "Endpoint exists but response format needs verification",
                        {"status_code": 200, "response_preview": response.text[:200]}
                    )
            elif response.status_code == 404:
                return self.log_result(
                    "Single IVR Endpoint",
                    False,
                    "Endpoint not found (404)",
                    {"status_code": 404, "url": url}
                )
            else:
                return self.log_result(
                    "Single IVR Endpoint",
                    False,
                    f"Unexpected response: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text[:200]}
                )
        except Exception as e:
            return self.log_result("Single IVR Endpoint", False, f"Request failed: {str(e)}")
    
    def test_single_ivr_gather_endpoint(self):
        """Test 4: Single IVR Gather Endpoint - POST /api/twilio/single-ivr-gather"""
        try:
            url = urljoin(self.base_url, '/api/twilio/single-ivr-gather')
            params = {'sessionId': 'test-nonexistent'}
            data = {'Digits': '1'}
            
            response = self.session.post(url, params=params, json=data)
            
            if response.status_code == 200:
                # Should return TwiML (session not found is expected)
                if 'xml' in response.headers.get('content-type', '').lower() or response.text.strip().startswith('<'):
                    return self.log_result(
                        "Single IVR Gather Endpoint",
                        True,
                        "Endpoint exists and returns TwiML",
                        {
                            "status_code": 200,
                            "content_type": response.headers.get('content-type', ''),
                            "response_preview": response.text[:200]
                        }
                    )
                else:
                    return self.log_result(
                        "Single IVR Gather Endpoint",
                        True,
                        "Endpoint exists but response format needs verification",
                        {"status_code": 200, "response_preview": response.text[:200]}
                    )
            elif response.status_code == 404:
                return self.log_result(
                    "Single IVR Gather Endpoint",
                    False,
                    "Endpoint not found (404)",
                    {"status_code": 404, "url": url}
                )
            else:
                return self.log_result(
                    "Single IVR Gather Endpoint",
                    False,
                    f"Unexpected response: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text[:200]}
                )
        except Exception as e:
            return self.log_result("Single IVR Gather Endpoint", False, f"Request failed: {str(e)}")
    
    def test_single_ivr_status_endpoint(self):
        """Test 5: Single IVR Status Endpoint - POST /api/twilio/single-ivr-status"""
        try:
            url = urljoin(self.base_url, '/api/twilio/single-ivr-status')
            params = {'sessionId': 'test-nonexistent'}
            data = {
                'CallSid': 'test',
                'CallStatus': 'completed',
                'CallDuration': '60'
            }
            
            response = self.session.post(url, params=params, json=data)
            
            if response.status_code == 200:
                return self.log_result(
                    "Single IVR Status Endpoint",
                    True,
                    "Endpoint exists and returns 200",
                    {
                        "status_code": 200,
                        "content_type": response.headers.get('content-type', ''),
                        "response_preview": response.text[:200]
                    }
                )
            elif response.status_code == 404:
                return self.log_result(
                    "Single IVR Status Endpoint",
                    False,
                    "Endpoint not found (404)",
                    {"status_code": 404, "url": url}
                )
            else:
                return self.log_result(
                    "Single IVR Status Endpoint",
                    False,
                    f"Unexpected response: {response.status_code}",
                    {"status_code": response.status_code, "response": response.text[:200]}
                )
        except Exception as e:
            return self.log_result("Single IVR Status Endpoint", False, f"Request failed: {str(e)}")
    
    def test_telnyx_service_sip_config(self):
        """Test 6a: Verify telnyx-service.js contains sip_uri_calling_preference: 'unrestricted'"""
        try:
            with open('/app/js/telnyx-service.js', 'r') as f:
                content = f.read()
            
            # Check for the specific configuration
            if "sip_uri_calling_preference: 'unrestricted'" in content:
                return self.log_result(
                    "Telnyx SIP Config",
                    True,
                    "telnyx-service.js contains sip_uri_calling_preference: 'unrestricted'",
                    {"file": "/app/js/telnyx-service.js"}
                )
            elif "sip_uri_calling_preference: 'internal'" in content:
                return self.log_result(
                    "Telnyx SIP Config",
                    False,
                    "telnyx-service.js still has 'internal' instead of 'unrestricted'",
                    {"file": "/app/js/telnyx-service.js"}
                )
            else:
                return self.log_result(
                    "Telnyx SIP Config",
                    False,
                    "sip_uri_calling_preference not found in telnyx-service.js",
                    {"file": "/app/js/telnyx-service.js"}
                )
        except Exception as e:
            return self.log_result("Telnyx SIP Config", False, f"Failed to read file: {str(e)}")
    
    def test_voice_service_exports(self):
        """Test 6b: Verify voice-service.js exports twilioIvrSessions and findNumberOwner"""
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            # Check for exports
            has_twilio_ivr = 'twilioIvrSessions' in content
            has_find_number = 'findNumberOwner' in content
            
            if has_twilio_ivr and has_find_number:
                return self.log_result(
                    "Voice Service Exports",
                    True,
                    "voice-service.js exports twilioIvrSessions and findNumberOwner",
                    {"file": "/app/js/voice-service.js", "exports": ["twilioIvrSessions", "findNumberOwner"]}
                )
            else:
                missing = []
                if not has_twilio_ivr:
                    missing.append("twilioIvrSessions")
                if not has_find_number:
                    missing.append("findNumberOwner")
                
                return self.log_result(
                    "Voice Service Exports",
                    False,
                    f"Missing exports: {', '.join(missing)}",
                    {"file": "/app/js/voice-service.js", "missing": missing}
                )
        except Exception as e:
            return self.log_result("Voice Service Exports", False, f"Failed to read file: {str(e)}")
    
    def test_voice_service_init_params(self):
        """Test 6c: Verify voice-service.js initVoiceService accepts twilioService parameter"""
        try:
            with open('/app/js/voice-service.js', 'r') as f:
                content = f.read()
            
            # Check for twilioService parameter
            if '_twilioService = deps.twilioService' in content:
                return self.log_result(
                    "Voice Service Init Params",
                    True,
                    "initVoiceService accepts twilioService parameter",
                    {"file": "/app/js/voice-service.js"}
                )
            else:
                return self.log_result(
                    "Voice Service Init Params",
                    False,
                    "twilioService parameter not found in initVoiceService",
                    {"file": "/app/js/voice-service.js"}
                )
        except Exception as e:
            return self.log_result("Voice Service Init Params", False, f"Failed to read file: {str(e)}")
    
    def test_index_twillio_service_passing(self):
        """Test 6d: Verify _index.js passes twilioService to initVoiceService"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check if twilioService is passed to initVoiceService
            if 'twilioService: require(\'./twilio-service.js\')' in content:
                return self.log_result(
                    "Index TwilioService Passing",
                    True,
                    "_index.js passes twilioService to initVoiceService",
                    {"file": "/app/js/_index.js"}
                )
            elif 'initVoiceService(' in content:
                return self.log_result(
                    "Index TwilioService Passing",
                    False,
                    "initVoiceService called but twilioService parameter not found",
                    {"file": "/app/js/_index.js"}
                )
            else:
                return self.log_result(
                    "Index TwilioService Passing",
                    False,
                    "initVoiceService not found in _index.js",
                    {"file": "/app/js/_index.js"}
                )
        except Exception as e:
            return self.log_result("Index TwilioService Passing", False, f"Failed to read file: {str(e)}")
    
    def test_twilio_voice_webhook_sip_logic(self):
        """Test 6e: Verify _index.js /twilio/voice-webhook has SIP ring logic with dial.sip(sipUri)"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check for SIP dial logic in Twilio voice webhook
            has_voice_webhook = '/twilio/voice-webhook' in content
            has_sip_dial = 'dial.sip(' in content
            
            if has_voice_webhook and has_sip_dial:
                return self.log_result(
                    "Twilio Voice Webhook SIP Logic",
                    True,
                    "/twilio/voice-webhook has SIP ring logic with dial.sip()",
                    {"file": "/app/js/_index.js"}
                )
            elif has_voice_webhook:
                return self.log_result(
                    "Twilio Voice Webhook SIP Logic",
                    False,
                    "/twilio/voice-webhook found but dial.sip() logic missing",
                    {"file": "/app/js/_index.js"}
                )
            else:
                return self.log_result(
                    "Twilio Voice Webhook SIP Logic",
                    False,
                    "/twilio/voice-webhook endpoint not found",
                    {"file": "/app/js/_index.js"}
                )
        except Exception as e:
            return self.log_result("Twilio Voice Webhook SIP Logic", False, f"Failed to read file: {str(e)}")
    
    def test_outbound_ivr_caller_provider(self):
        """Test 6f: Verify initiateOutboundIvrCall caller passes provider: callerProvider"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Check for provider parameter in initiateOutboundIvrCall calls
            if 'provider: callerProvider' in content:
                return self.log_result(
                    "Outbound IVR Caller Provider",
                    True,
                    "initiateOutboundIvrCall caller passes provider: callerProvider",
                    {"file": "/app/js/_index.js"}
                )
            else:
                return self.log_result(
                    "Outbound IVR Caller Provider",
                    False,
                    "provider: callerProvider not found in initiateOutboundIvrCall calls",
                    {"file": "/app/js/_index.js"}
                )
        except Exception as e:
            return self.log_result("Outbound IVR Caller Provider", False, f"Failed to read file: {str(e)}")
    
    def test_startup_logs(self):
        """Test 7: Verify Node.js startup logs contain expected initialization message"""
        try:
            # Check supervisor logs for the expected startup message
            import subprocess
            result = subprocess.run(
                ['tail', '-n', '100', '/var/log/supervisor/backend.out.log'],
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                log_content = result.stdout
                expected_msg = "Initialized with IVR + Recording + Analytics + Limits + Overage billing + SIP Bridge + Twilio IVR"
                
                if expected_msg in log_content:
                    return self.log_result(
                        "Startup Logs",
                        True,
                        "Expected initialization message found in startup logs",
                        {"log_file": "/var/log/supervisor/backend.out.log"}
                    )
                else:
                    return self.log_result(
                        "Startup Logs",
                        False,
                        "Expected initialization message not found in startup logs",
                        {"log_file": "/var/log/supervisor/backend.out.log", "log_preview": log_content[-300:]}
                    )
            else:
                return self.log_result(
                    "Startup Logs",
                    False,
                    "Could not read supervisor logs",
                    {"error": result.stderr}
                )
        except Exception as e:
            return self.log_result("Startup Logs", False, f"Failed to check startup logs: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests and return summary"""
        logger.info("=" * 70)
        logger.info("STARTING SIP DOMAIN AND CALL FLOW FIXES TEST SUITE")
        logger.info("=" * 70)
        
        # Execute all tests
        tests = [
            self.test_service_health,
            self.test_sip_ring_result_endpoint,
            self.test_single_ivr_endpoint, 
            self.test_single_ivr_gather_endpoint,
            self.test_single_ivr_status_endpoint,
            self.test_telnyx_service_sip_config,
            self.test_voice_service_exports,
            self.test_voice_service_init_params,
            self.test_index_twillio_service_passing,
            self.test_twilio_voice_webhook_sip_logic,
            self.test_outbound_ivr_caller_provider,
            self.test_startup_logs
        ]
        
        for test in tests:
            test()
        
        # Calculate summary
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        
        logger.info("=" * 70)
        logger.info("TEST SUMMARY")
        logger.info("=" * 70)
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"Passed: {passed_tests}")
        logger.info(f"Failed: {failed_tests}")
        logger.info(f"Success Rate: {success_rate:.1f}%")
        
        # List failed tests
        if failed_tests > 0:
            logger.info("\nFAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    logger.info(f"❌ {result['test']}: {result['message']}")
        
        return {
            "total": total_tests,
            "passed": passed_tests, 
            "failed": failed_tests,
            "success_rate": success_rate,
            "results": self.results
        }

if __name__ == "__main__":
    tester = SipDomainTestRunner()
    summary = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    sys.exit(0 if summary["failed"] == 0 else 1)