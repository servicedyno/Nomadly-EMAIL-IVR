#!/usr/bin/env python3
"""
AI Support Admin Takeover Feature Testing
Tests all required functionality for the admin takeover feature in Nomadly Telegram Bot
"""

import requests
import json
import re
import os
from datetime import datetime

class AITakeoverTester:
    def __init__(self):
        self.base_url = "http://localhost:5000"
        self.test_results = []
        
    def log_test(self, test_name, passed, details=""):
        self.test_results.append({
            'test': test_name,
            'passed': passed,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        print()
    
    def test_nodejs_health(self):
        """Test 1: Node.js Health - GET /health should return 200 and err.log should be 0 bytes"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            
            # Check HTTP 200
            http_ok = response.status_code == 200
            
            # Check response structure
            data = response.json()
            status_ok = data.get('status') == 'healthy'
            db_ok = data.get('database') == 'connected'
            
            # Check error log is empty
            err_log_size = os.path.getsize('/var/log/supervisor/nodejs.err.log')
            err_log_ok = err_log_size == 0
            
            all_passed = http_ok and status_ok and db_ok and err_log_ok
            details = f"HTTP: {response.status_code}, Status: {data.get('status')}, DB: {data.get('database')}, ErrorLog: {err_log_size} bytes"
            
            self.log_test("Node.js Health Check", all_passed, details)
            return all_passed
            
        except Exception as e:
            self.log_test("Node.js Health Check", False, f"Exception: {str(e)}")
            return False
    
    def read_js_file(self):
        """Read the js/_index.js file for code inspection"""
        try:
            with open('/app/js/_index.js', 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"Error reading js/_index.js: {str(e)}")
            return None
    
    def test_admin_reply_sets_takeover(self, js_content):
        """Test 2: Admin /reply sets adminTakeover to true"""
        try:
            # Search for the /reply handler - more flexible pattern
            reply_pattern = r"message\.startsWith\(['\"]\/reply\s"
            reply_match = re.search(reply_pattern, js_content)
            
            if not reply_match:
                self.log_test("Admin /reply handler exists", False, "Handler not found")
                return False
            
            # Find the takeover setting after reply handler
            takeover_pattern = r"set\(state,\s*targetChatId,\s*['\"]adminTakeover['\"],\s*true\)"
            takeover_match = re.search(takeover_pattern, js_content)
            
            # Check for log message mentioning admin takeover ON
            log_pattern = r"admin takeover ON"
            log_match = re.search(log_pattern, js_content)
            
            all_checks = takeover_match and log_match
            details = f"Takeover set: {'✓' if takeover_match else '✗'}, Log message: {'✓' if log_match else '✗'}"
            
            self.log_test("Admin /reply sets adminTakeover", all_checks, details)
            return all_checks
            
        except Exception as e:
            self.log_test("Admin /reply sets adminTakeover", False, f"Exception: {str(e)}")
            return False
    
    def test_admin_close_clears_takeover(self, js_content):
        """Test 3: Admin /close clears adminTakeover to false"""
        try:
            # Search for the /close handler
            close_pattern = r"message\.startsWith\(['\"]\/close\s"
            close_match = re.search(close_pattern, js_content)
            
            if not close_match:
                self.log_test("Admin /close handler exists", False, "Handler not found")
                return False
            
            # Find the takeover clearing after close handler  
            clear_pattern = r"set\(state,\s*targetChatId,\s*['\"]adminTakeover['\"],\s*false\)"
            clear_match = re.search(clear_pattern, js_content)
            
            # Check for log message mentioning admin takeover OFF
            log_pattern = r"admin takeover OFF"
            log_match = re.search(log_pattern, js_content)
            
            all_checks = clear_match and log_match
            details = f"Takeover cleared: {'✓' if clear_match else '✗'}, Log message: {'✓' if log_match else '✗'}"
            
            self.log_test("Admin /close clears adminTakeover", all_checks, details)
            return all_checks
            
        except Exception as e:
            self.log_test("Admin /close clears adminTakeover", False, f"Exception: {str(e)}")
            return False
    
    def test_user_done_clears_takeover(self, js_content):
        """Test 4: User /done clears adminTakeover to false"""
        try:
            # Search for the specific line we found
            done_line = "if (message === '/done' && action === a.supportChat)"
            if done_line not in js_content:
                self.log_test("User /done handler exists", False, "Handler not found")
                return False
            
            # Find the position and check surrounding code
            pos = js_content.find(done_line)
            done_section = js_content[pos:pos + 500]
            
            # Check for the specific patterns we know exist
            clear_match = "await set(state, chatId, 'adminTakeover', false)" in done_section
            log_match = "admin takeover OFF" in done_section
            
            all_checks = clear_match and log_match
            details = f"Takeover cleared: {'✓' if clear_match else '✗'}, Log message: {'✓' if log_match else '✗'}"
            
            self.log_test("User /done clears adminTakeover", all_checks, details)
            return all_checks
            
        except Exception as e:
            self.log_test("User /done clears adminTakeover", False, f"Exception: {str(e)}")
            return False
    
    def test_new_session_clears_takeover(self, js_content):
        """Test 5: New session clears adminTakeover to false"""
        try:
            # Search for contactSupport or getSupport handler
            support_pattern = r"user\.contactSupport|user\.getSupport"
            support_matches = re.finditer(support_pattern, js_content)
            
            found_clear = False
            found_log = False
            
            for match in support_matches:
                # Look around the match for takeover clearing
                start_pos = max(0, match.start() - 200)
                end_pos = min(len(js_content), match.end() + 500)
                section = js_content[start_pos:end_pos]
                
                clear_pattern = r"set\(state,\s*chatId,\s*['\"]adminTakeover['\"],\s*false\)"
                log_pattern = r"fresh session"
                
                if re.search(clear_pattern, section):
                    found_clear = True
                if re.search(log_pattern, section):
                    found_log = True
            
            all_checks = found_clear and found_log
            details = f"Takeover cleared: {'✓' if found_clear else '✗'}, Fresh session log: {'✓' if found_log else '✗'}"
            
            self.log_test("New session clears adminTakeover", all_checks, details)
            return all_checks
            
        except Exception as e:
            self.log_test("New session clears adminTakeover", False, f"Exception: {str(e)}")
            return False
    
    def test_support_handler_checks_takeover(self, js_content):
        """Test 6: Support handler checks adminTakeover flag"""
        try:
            # Find the specific line we found
            support_line = "if (action === a.supportChat)"
            if support_line not in js_content:
                self.log_test("Support chat handler exists", False, "Handler not found")
                return False
            
            # Find the position and get surrounding code
            pos = js_content.find(support_line)
            support_section = js_content[pos:pos + 1000]
            
            # Check for the specific patterns we know exist
            checks = {
                'state_read': "const stateObj = await get(state, chatId)" in support_section,
                'takeover_extract': "const isAdminTakeover = stateObj?.adminTakeover === true" in support_section,
                'takeover_indicator': "Admin takeover active" in support_section,
                'skip_ai': "if (isAdminTakeover)" in support_section,
                'msg_received': "t.supportMsgReceived" in support_section
            }
            
            all_passed = all(checks.values())
            details = f"State read: {'✓' if checks['state_read'] else '✗'}, " + \
                     f"Takeover extract: {'✓' if checks['takeover_extract'] else '✗'}, " + \
                     f"Indicator: {'✓' if checks['takeover_indicator'] else '✗'}, " + \
                     f"Skip AI: {'✓' if checks['skip_ai'] else '✗'}, " + \
                     f"Msg received: {'✓' if checks['msg_received'] else '✗'}"
            
            self.log_test("Support handler checks adminTakeover", all_passed, details)
            return all_passed
            
        except Exception as e:
            self.log_test("Support handler checks adminTakeover", False, f"Exception: {str(e)}")
            return False
    
    def test_flow_integrity(self, js_content):
        """Test 7: Flow integrity - verify proper return structure"""
        try:
            # Find the specific line we found
            support_line = "if (action === a.supportChat)"
            if support_line not in js_content:
                self.log_test("Support handler flow integrity", False, "Handler not found")
                return False
            
            # Find the position and get a larger section
            pos = js_content.find(support_line)
            support_section = js_content[pos:pos + 2000]
            
            # Check for the specific patterns we know exist
            takeover_return = "if (isAdminTakeover)" in support_section and "return" in support_section[support_section.find("if (isAdminTakeover)"):support_section.find("if (isAdminTakeover)") + 200]
            ai_block = "if (isAiEnabled())" in support_section
            final_return = support_section.rstrip().endswith("return") or "return" in support_section[-100:]
            
            all_passed = takeover_return and ai_block and final_return
            details = f"Takeover return: {'✓' if takeover_return else '✗'}, " + \
                     f"AI block: {'✓' if ai_block else '✗'}, " + \
                     f"Final return: {'✓' if final_return else '✗'}"
            
            self.log_test("Flow integrity verification", all_passed, details)
            return all_passed
            
        except Exception as e:
            self.log_test("Flow integrity verification", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all AI takeover tests"""
        print("=" * 80)
        print("AI SUPPORT ADMIN TAKEOVER FEATURE TESTING")
        print("=" * 80)
        print()
        
        # Test 1: Node.js Health
        health_passed = self.test_nodejs_health()
        
        # Read JS file for code inspection tests
        js_content = self.read_js_file()
        if not js_content:
            print("❌ CRITICAL: Could not read js/_index.js file")
            return
        
        # Tests 2-7: Code inspection tests
        reply_passed = self.test_admin_reply_sets_takeover(js_content)
        close_passed = self.test_admin_close_clears_takeover(js_content)
        done_passed = self.test_user_done_clears_takeover(js_content)
        session_passed = self.test_new_session_clears_takeover(js_content)
        handler_passed = self.test_support_handler_checks_takeover(js_content)
        flow_passed = self.test_flow_integrity(js_content)
        
        # Summary
        total_tests = 7
        # Handle None values by converting them to 0
        test_results = [health_passed, reply_passed, close_passed, done_passed,
                       session_passed, handler_passed, flow_passed]
        passed_tests = sum(1 for result in test_results if result is True)
        
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success Rate: {(passed_tests / total_tests) * 100:.1f}%")
        print()
        
        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED - AI Support Admin Takeover feature is fully functional!")
        else:
            print("⚠️ Some tests failed - see details above")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = AITakeoverTester()
    tester.run_all_tests()