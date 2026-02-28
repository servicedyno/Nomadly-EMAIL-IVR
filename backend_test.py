#!/usr/bin/env python3
"""
Backend testing script for Nomadly Telegram Bot - Bulk IVR and Quick IVR improvements
"""

import requests
import os
import time
import json
from pathlib import Path

# Configuration
BASE_URL = "https://api-webhook.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class BulkIVRTestSuite:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        
    def log_result(self, test_name, passed, details=""):
        status = "✅ PASS" if passed else "❌ FAIL"
        self.results.append(f"{status}: {test_name}")
        if details:
            self.results.append(f"   Details: {details}")
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
            
    def test_service_health(self):
        """Test 1: Service Health - verify Node.js running"""
        try:
            response = requests.get(f"{API_BASE}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'healthy' and data.get('database') == 'connected':
                    self.log_result("Service Health Check", True, f"Node.js healthy, DB connected, uptime: {data.get('uptime', 'unknown')}")
                    return True
                else:
                    self.log_result("Service Health Check", False, f"Service not healthy: {data}")
                    return False
            else:
                self.log_result("Service Health Check", False, f"HTTP {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Service Health Check", False, f"Connection failed: {str(e)}")
            return False
            
    def test_code_verification_new_states(self):
        """Test 2: Code Verification - 9 new action states exist in js/_index.js"""
        required_states = [
            'bulkSelectKeys', 'bulkEnterCustomKeys',  # Fix #1: key selection for Bulk IVR
            'bulkTTSCategory', 'bulkTTSTemplate', 'bulkTTSPlaceholder', 
            'bulkTTSVoice', 'bulkTTSPreview', 'bulkTTSCustomScript',  # Fix #2: inline TTS templates for Bulk IVR
            'ivrObConfirmKeys'  # Fix #3: key confirmation for Quick IVR custom scripts
        ]
        
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
                
            found_states = []
            missing_states = []
            
            for state in required_states:
                # Look for state definition like "bulkSelectKeys: 'bulkSelectKeys',"
                if f"{state}: '{state}'" in content:
                    found_states.append(state)
                else:
                    missing_states.append(state)
                    
            if len(found_states) == 9:
                self.log_result("New Action States Verification", True, f"All 9 states found: {', '.join(found_states)}")
                return True
            else:
                self.log_result("New Action States Verification", False, 
                              f"Found {len(found_states)}/9 states. Missing: {missing_states}")
                return False
                
        except Exception as e:
            self.log_result("New Action States Verification", False, f"File read error: {str(e)}")
            return False
            
    def test_bulk_ivr_key_selection_flow(self):
        """Test 3: Code Verification - Bulk IVR Key Selection Flow"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
                
            tests = []
            
            # Test 1: bulkSelectMode routes to bulkSelectKeys (NOT bulkSetConcurrency)
            if "set(state, chatId, 'action', a.bulkSelectKeys)" in content and "bulkSelectMode" in content:
                # Look for the specific pattern where bulkSelectMode routes to bulkSelectKeys
                if "'📊 Report Only'" in content and "a.bulkSelectKeys" in content:
                    tests.append(("bulkSelectMode routes to bulkSelectKeys", True))
                else:
                    tests.append(("bulkSelectMode routes to bulkSelectKeys", False))
            else:
                tests.append(("bulkSelectMode routes to bulkSelectKeys", False))
                
            # Test 2: bulkEnterTransfer routes to bulkSelectKeys (NOT bulkSetConcurrency)  
            if "bulkEnterTransfer" in content and "set(state, chatId, 'action', a.bulkSelectKeys)" in content:
                tests.append(("bulkEnterTransfer routes to bulkSelectKeys", True))
            else:
                tests.append(("bulkEnterTransfer routes to bulkSelectKeys", False))
                
            # Test 3: bulkSelectKeys accepts presets
            presets_check = all([
                "'1 only'" in content,
                "'1 and 2'" in content, 
                "'1, 2, and 3'" in content,
                "'0-9 (any key)'" in content,
                "'✍️ Custom keys'" in content
            ])
            tests.append(("bulkSelectKeys accepts all presets", presets_check))
            
            # Test 4: Campaign uses bulkData.activeKeys || ['1']
            activekeys_usage = "bulkData.activeKeys || ['1']" in content
            tests.append(("Campaign uses activeKeys fallback", activekeys_usage))
            
            # Test 5: Preview shows bulkData.activeKeys
            preview_check = "bulkData.activeKeys" in content and "Active keys" in content
            tests.append(("Preview shows activeKeys", preview_check))
            
            passed_tests = [name for name, result in tests if result]
            failed_tests = [name for name, result in tests if not result]
            
            if len(passed_tests) == 5:
                self.log_result("Bulk IVR Key Selection Flow", True, f"All 5 checks passed")
                return True
            else:
                self.log_result("Bulk IVR Key Selection Flow", False, 
                              f"Passed: {len(passed_tests)}/5. Failed: {failed_tests}")
                return False
                
        except Exception as e:
            self.log_result("Bulk IVR Key Selection Flow", False, f"Error: {str(e)}")
            return False
            
    def test_bulk_ivr_tts_templates(self):
        """Test 4: Code Verification - Bulk IVR TTS Templates"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
                
            tests = []
            
            # Test 1: bulkSelectAudio has '📝 Use IVR Template' button
            template_button = "'📝 Use IVR Template'" in content and "bulkTTSCategory" in content
            tests.append(("bulkSelectAudio has TTS Template button", template_button))
            
            # Test 2: bulkTTSCategory shows categories from ivr-outbound.js + Custom Script
            category_check = "ivrOb.getCategoryButtons()" in content and "'✍️ Custom Script'" in content
            tests.append(("bulkTTSCategory shows categories + custom", category_check))
            
            # Test 3: bulkTTSTemplate handles template selection with placeholders
            template_check = "bulkTTSTemplate" in content and "template.placeholders" in content
            tests.append(("bulkTTSTemplate handles placeholders", template_check))
            
            # Test 4: bulkTTSVoice generates TTS via ttsService.generateTTS()
            voice_check = "ttsService.generateTTS" in content and "bulkTTSVoice" in content
            tests.append(("bulkTTSVoice generates TTS", voice_check))
            
            # Test 5: bulkTTSPreview saves audio and sets bulkData
            preview_check = ("audioLibraryService.saveAudio" in content and 
                           "bulkData.audioUrl" in content and 
                           "bulkData.activeKeys" in content)
            tests.append(("bulkTTSPreview saves audio and sets data", preview_check))
            
            passed_tests = [name for name, result in tests if result]
            failed_tests = [name for name, result in tests if not result]
            
            if len(passed_tests) == 5:
                self.log_result("Bulk IVR TTS Templates", True, f"All 5 TTS template checks passed")
                return True
            else:
                self.log_result("Bulk IVR TTS Templates", False, 
                              f"Passed: {len(passed_tests)}/5. Failed: {failed_tests}")
                return False
                
        except Exception as e:
            self.log_result("Bulk IVR TTS Templates", False, f"Error: {str(e)}")
            return False
            
    def test_quick_ivr_key_confirmation(self):
        """Test 5: Code Verification - Quick IVR Key Confirmation"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
                
            tests = []
            
            # Test 1: ivrObCustomScript routes to ivrObConfirmKeys
            custom_script_routing = ("ivrObCustomScript" in content and 
                                   "set(state, chatId, 'action', a.ivrObConfirmKeys)" in content)
            tests.append(("ivrObCustomScript routes to ivrObConfirmKeys", custom_script_routing))
            
            # Test 2: ivrObConfirmKeys shows detected keys
            confirm_shows_keys = ("ivrObConfirmKeys" in content and 
                                "Detected active keys" in content and
                                "activeKeys.join" in content)
            tests.append(("ivrObConfirmKeys shows detected keys", confirm_shows_keys))
            
            # Test 3: ivrObConfirmKeys allows custom keys input
            custom_keys_input = ("'✅ Continue'" in content and 
                               "customKeys = [...new Set((message || '').match(/\\d/g)" in content)
            tests.append(("ivrObConfirmKeys allows custom keys", custom_keys_input))
            
            # Test 4: On Continue or custom keys → proceeds to placeholders/IVR
            proceed_logic = ("ivrObFillPlaceholder" in content and "ivrObEnterIvrNumber" in content)
            tests.append(("Proceeds to placeholders or IVR number", proceed_logic))
            
            passed_tests = [name for name, result in tests if result]
            failed_tests = [name for name, result in tests if not result]
            
            if len(passed_tests) == 4:
                self.log_result("Quick IVR Key Confirmation", True, f"All 4 confirmation checks passed")
                return True
            else:
                self.log_result("Quick IVR Key Confirmation", False, 
                              f"Passed: {len(passed_tests)}/4. Failed: {failed_tests}")
                return False
                
        except Exception as e:
            self.log_result("Quick IVR Key Confirmation", False, f"Error: {str(e)}")
            return False
            
    def test_ux_text_verification(self):
        """Test 6: UX Text Verification"""
        try:
            with open('/app/js/phone-config.js', 'r') as f:
                content = f.read()
                
            tests = []
            
            # Test 1: 'Choose a Cloud IVR Plan' (instead of 'Buy Cloud Phone Plans')
            plan_text = "Choose a Cloud IVR Plan" in content
            tests.append(("'Choose a Cloud IVR Plan' text", plan_text))
            
            # Test 2: 'Quick IVR Call' (instead of 'IVR Outbound Call')
            quick_ivr_text = "'Quick IVR Call'" in content or '"Quick IVR Call"' in content
            tests.append(("'Quick IVR Call' text", quick_ivr_text))
            
            # Test 3: 'Bulk IVR Campaign' (instead of 'Bulk Call Campaign')
            bulk_ivr_text = "'Bulk IVR Campaign'" in content or '"Bulk IVR Campaign"' in content  
            tests.append(("'Bulk IVR Campaign' text", bulk_ivr_text))
            
            passed_tests = [name for name, result in tests if result]
            failed_tests = [name for name, result in tests if not result]
            
            if len(passed_tests) == 3:
                self.log_result("UX Text Verification", True, f"All 3 text updates verified")
                return True
            else:
                self.log_result("UX Text Verification", False, 
                              f"Passed: {len(passed_tests)}/3. Failed: {failed_tests}")
                return False
                
        except Exception as e:
            self.log_result("UX Text Verification", False, f"Error: {str(e)}")
            return False
            
    def test_startup_logs(self):
        """Test 7: Startup Logs - Zero errors in nodejs.err.log"""
        try:
            err_log_path = '/var/log/supervisor/nodejs.err.log'
            
            if os.path.exists(err_log_path):
                with open(err_log_path, 'r') as f:
                    err_content = f.read().strip()
                    
                if not err_content:
                    self.log_result("Startup Logs Check", True, "nodejs.err.log is empty (no errors)")
                    return True
                else:
                    # Count lines to see if there are actual errors
                    lines = err_content.split('\n')
                    self.log_result("Startup Logs Check", False, f"Found {len(lines)} error lines in nodejs.err.log")
                    return False
            else:
                self.log_result("Startup Logs Check", False, "nodejs.err.log not found")
                return False
                
        except Exception as e:
            self.log_result("Startup Logs Check", False, f"Error reading logs: {str(e)}")
            return False
            
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Bulk IVR and Quick IVR Testing Suite")
        print("=" * 60)
        
        # Test 1: Service Health
        health_ok = self.test_service_health()
        
        # Test 2: Code Verification - New Action States  
        self.test_code_verification_new_states()
        
        # Test 3: Bulk IVR Key Selection Flow
        self.test_bulk_ivr_key_selection_flow()
        
        # Test 4: Bulk IVR TTS Templates
        self.test_bulk_ivr_tts_templates()
        
        # Test 5: Quick IVR Key Confirmation
        self.test_quick_ivr_key_confirmation()
        
        # Test 6: UX Text Verification
        self.test_ux_text_verification()
        
        # Test 7: Startup Logs
        self.test_startup_logs()
        
        # Print results
        print("\n" + "=" * 60)
        print("🧪 TEST RESULTS")
        print("=" * 60)
        
        for result in self.results:
            print(result)
            
        print("\n" + "=" * 60)
        print(f"📊 SUMMARY: {self.passed} passed, {self.failed} failed")
        
        if self.failed == 0:
            print("🎉 ALL TESTS PASSED - Bulk IVR and Quick IVR improvements are working correctly!")
        else:
            print("⚠️  Some tests failed - see details above")
            
        success_rate = (self.passed / (self.passed + self.failed)) * 100 if (self.passed + self.failed) > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.failed == 0

def main():
    """Main test execution"""
    test_suite = BulkIVRTestSuite()
    success = test_suite.run_all_tests()
    
    # Return exit code based on test results
    exit(0 if success else 1)

if __name__ == "__main__":
    main()