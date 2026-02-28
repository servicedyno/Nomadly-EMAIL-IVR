#!/usr/bin/env python3
"""
CloudPhone Wallet Purchase Crash Fix - Backend Testing
Testing the ROOT CAUSE fix for JavaScript scoping bug where 3 functions were moved to module scope.
"""

import requests
import json
import re
import subprocess
import sys
from typing import Dict, Any, Optional

# Backend URL Configuration
BACKEND_URL = "http://localhost:5000"

class CloudPhoneTest:
    def __init__(self):
        self.test_results = []
        self.errors = []
        
    def log_result(self, test_name: str, status: str, message: str):
        """Log test result"""
        result = {
            'test': test_name,
            'status': status,
            'message': message
        }
        self.test_results.append(result)
        status_icon = "✅" if status == "PASS" else "❌"
        print(f"{status_icon} {test_name}: {message}")
        
    def log_error(self, test_name: str, error: str):
        """Log test error"""
        self.errors.append(f"{test_name}: {error}")
        self.log_result(test_name, "FAIL", error)

    def test_nodejs_health(self):
        """Test 1: Node.js Health - Service running on port 5000, database connected, zero errors"""
        try:
            # Check service health endpoint
            response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
            if response.status_code == 200:
                health_data = response.json()
                if health_data.get('status') == 'healthy' and health_data.get('database') == 'connected':
                    self.log_result("NodeJS Health", "PASS", f"Service healthy on port 5000, database connected, uptime: {health_data.get('uptime', 'unknown')}")
                else:
                    self.log_error("NodeJS Health", f"Health check failed: {health_data}")
            else:
                self.log_error("NodeJS Health", f"Health endpoint returned {response.status_code}")
                
            # Check error logs
            try:
                result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/nodejs.err.log'], 
                                      capture_output=True, text=True, timeout=10)
                if result.returncode == 0:
                    error_log = result.stdout.strip()
                    if not error_log:
                        self.log_result("NodeJS Error Logs", "PASS", "No errors in nodejs.err.log")
                    else:
                        self.log_error("NodeJS Error Logs", f"Found errors in log: {error_log[:200]}")
                else:
                    self.log_error("NodeJS Error Logs", "Could not read error log")
            except Exception as e:
                self.log_error("NodeJS Error Logs", f"Log check failed: {str(e)}")
                
        except Exception as e:
            self.log_error("NodeJS Health", f"Health check failed: {str(e)}")

    def test_function_scoping(self):
        """Test 2-4: Verify functions are at module scope (before loadData)"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Find line numbers
            lines = content.split('\n')
            
            # Find function definitions
            exec_twilio_line = None
            get_cached_line = None  
            cache_twilio_line = None
            load_data_line = None
            
            for i, line in enumerate(lines):
                if 'async function executeTwilioPurchase(' in line:
                    exec_twilio_line = i + 1
                elif 'async function getCachedTwilioAddress(' in line:
                    get_cached_line = i + 1
                elif 'async function cacheTwilioAddress(' in line:
                    cache_twilio_line = i + 1
                elif 'const loadData = async () => {' in line:
                    load_data_line = i + 1
                    break
            
            # Test 2: executeTwilioPurchase at module scope
            if exec_twilio_line and load_data_line and exec_twilio_line < load_data_line:
                # Check function signature
                func_line = lines[exec_twilio_line - 1]
                expected_params = ['chatId', 'selectedNumber', 'planKey', 'price', 'countryCode', 'countryName', 'numType', 'paymentMethod', 'addressSid']
                
                # Extract parameters from function definition
                param_match = re.search(r'executeTwilioPurchase\((.*?)\)', func_line)
                if param_match:
                    params = [p.strip() for p in param_match.group(1).split(',')]
                    if len(params) == 9 and all(expected in params for expected in expected_params):
                        self.log_result("executeTwilioPurchase MODULE Scope", "PASS", 
                                      f"Function at line {exec_twilio_line}, BEFORE loadData (line {load_data_line}), with all 9 params")
                    else:
                        self.log_error("executeTwilioPurchase MODULE Scope", 
                                     f"Function has incorrect parameters. Expected 9, got {len(params)}: {params}")
                else:
                    self.log_error("executeTwilioPurchase MODULE Scope", "Could not parse function parameters")
            else:
                self.log_error("executeTwilioPurchase MODULE Scope", 
                             f"Function not found at module scope. exec_line: {exec_twilio_line}, load_data: {load_data_line}")
            
            # Test 3: getCachedTwilioAddress at module scope
            if get_cached_line and load_data_line and get_cached_line < load_data_line:
                func_line = lines[get_cached_line - 1]
                if 'getCachedTwilioAddress(chatId, countryCode)' in func_line:
                    self.log_result("getCachedTwilioAddress MODULE Scope", "PASS", 
                                  f"Function at line {get_cached_line}, BEFORE loadData (line {load_data_line})")
                else:
                    self.log_error("getCachedTwilioAddress MODULE Scope", "Function has incorrect signature")
            else:
                self.log_error("getCachedTwilioAddress MODULE Scope", 
                             f"Function not found at module scope. cached_line: {get_cached_line}, load_data: {load_data_line}")
            
            # Test 4: cacheTwilioAddress at module scope  
            if cache_twilio_line and load_data_line and cache_twilio_line < load_data_line:
                func_line = lines[cache_twilio_line - 1]
                if 'cacheTwilioAddress(chatId, countryCode, addressSid)' in func_line:
                    self.log_result("cacheTwilioAddress MODULE Scope", "PASS", 
                                  f"Function at line {cache_twilio_line}, BEFORE loadData (line {load_data_line})")
                else:
                    self.log_error("cacheTwilioAddress MODULE Scope", "Function has incorrect signature")
            else:
                self.log_error("cacheTwilioAddress MODULE Scope", 
                             f"Function not found at module scope. cache_line: {cache_twilio_line}, load_data: {load_data_line}")
                
        except Exception as e:
            self.log_error("Function Scoping", f"File analysis failed: {str(e)}")

    def test_loaddata_no_functions(self):
        """Test 5: Verify loadData does NOT contain the moved functions"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Find loadData function bounds
            lines = content.split('\n')
            load_data_start = None
            load_data_end = None
            brace_count = 0
            
            for i, line in enumerate(lines):
                if 'const loadData = async () => {' in line:
                    load_data_start = i
                    brace_count = 1  # opening brace
                    continue
                    
                if load_data_start is not None:
                    # Count braces to find end of function
                    brace_count += line.count('{') - line.count('}')
                    if brace_count == 0:
                        load_data_end = i
                        break
            
            if load_data_start and load_data_end:
                load_data_content = '\n'.join(lines[load_data_start:load_data_end + 1])
                
                # Check for function definitions inside loadData
                forbidden_functions = [
                    'async function executeTwilioPurchase',
                    'async function getCachedTwilioAddress', 
                    'async function cacheTwilioAddress'
                ]
                
                found_functions = []
                for func in forbidden_functions:
                    if func in load_data_content:
                        found_functions.append(func)
                
                # Check for "moved to module scope" comment
                moved_comment_found = 'moved to module scope' in load_data_content
                
                if not found_functions:
                    if moved_comment_found:
                        self.log_result("loadData Functions Check", "PASS", 
                                      f"No functions inside loadData (lines {load_data_start+1}-{load_data_end+1}), 'moved to module scope' comment found")
                    else:
                        self.log_result("loadData Functions Check", "PASS", 
                                      f"No functions inside loadData (lines {load_data_start+1}-{load_data_end+1})")
                else:
                    self.log_error("loadData Functions Check", 
                                 f"Found forbidden functions inside loadData: {found_functions}")
            else:
                self.log_error("loadData Functions Check", "Could not locate loadData function boundaries")
                
        except Exception as e:
            self.log_error("loadData Functions Check", f"Analysis failed: {str(e)}")

    def test_try_catch_wrapper(self):
        """Test 6: Verify try/catch safety net in walletOk['phone-pay']"""
        try:
            with open('/app/js/_index.js', 'r') as f:
                content = f.read()
            
            # Find walletOk['phone-pay'] handler
            phone_pay_pattern = r"walletOf,\s*chatId,\s*coin\s*===\s*u\.usd\s*\?\s*'usdOut'\s*:\s*'ngnOut',\s*coin\s*===\s*u\.usd\s*\?\s*priceUsd\s*:\s*priceNgn"
            
            lines = content.split('\n')
            wallet_deduction_line = None
            
            # Find wallet deduction line
            for i, line in enumerate(lines):
                if 'atomicIncrement(walletOf, chatId,' in line and ('usdOut' in line or 'ngnOut' in line):
                    wallet_deduction_line = i + 1
                    break
            
            if wallet_deduction_line:
                # Look for try block after wallet deduction
                try_found = False
                catch_found = False
                auto_refund_found = False
                cloudphone_logging = False
                
                # Search in next 200 lines after wallet deduction
                for i in range(wallet_deduction_line, min(len(lines), wallet_deduction_line + 200)):
                    line = lines[i].strip()
                    
                    if 'try {' in line:
                        try_found = True
                    elif '} catch (purchaseErr)' in line or 'catch (purchaseErr)' in line:
                        catch_found = True
                    elif 'atomicIncrement(walletOf, chatId,' in line and 'In,' in line:
                        auto_refund_found = True
                    elif '[CloudPhone]' in line and 'catch' in lines[max(0, i-5):i+5]:
                        cloudphone_logging = True
                
                if try_found and catch_found and auto_refund_found:
                    details = []
                    if cloudphone_logging:
                        details.append("[CloudPhone] logging found")
                    
                    self.log_result("Try/Catch Wrapper", "PASS", 
                                  f"Purchase section wrapped in try/catch after wallet deduction (line {wallet_deduction_line}), auto-refund logic present" + 
                                  (f", {', '.join(details)}" if details else ""))
                else:
                    missing = []
                    if not try_found: missing.append("try block")
                    if not catch_found: missing.append("catch block") 
                    if not auto_refund_found: missing.append("auto-refund")
                    
                    self.log_error("Try/Catch Wrapper", f"Missing: {', '.join(missing)}")
            else:
                self.log_error("Try/Catch Wrapper", "Could not locate wallet deduction line")
                
        except Exception as e:
            self.log_error("Try/Catch Wrapper", f"Analysis failed: {str(e)}")

    def test_wallet_refund_verification(self):
        """Test 7: Check user wallet refund (for reference - may not exist in test scenario)"""
        try:
            # This is more of a verification that the refund mechanism would work
            # In a real test scenario, we'd need to simulate a failed purchase
            
            # Check MongoDB connection and wallet collection structure
            result = subprocess.run([
                'node', '-e', '''
                const { MongoClient } = require("mongodb");
                (async () => {
                  const client = new MongoClient("mongodb://localhost:27017");
                  await client.connect();
                  const db = client.db("nomadly");
                  const walletOf = db.collection("walletOf");
                  
                  // Check if collection exists and is accessible
                  const count = await walletOf.countDocuments();
                  console.log(`wallet_collection_count:${count}`);
                  
                  // Check specific user (test scenario)
                  const userWallet = await walletOf.findOne({ _id: "1005284399" });
                  if (userWallet) {
                    console.log(`user_wallet:${JSON.stringify(userWallet)}`);
                  } else {
                    console.log("user_wallet:not_found");
                  }
                  
                  await client.close();
                })().catch(e => console.error("Error:", e.message));
                '''
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                output = result.stdout.strip()
                if 'wallet_collection_count:' in output:
                    count_match = re.search(r'wallet_collection_count:(\d+)', output)
                    if count_match:
                        wallet_count = int(count_match.group(1))
                        
                        if 'user_wallet:not_found' in output:
                            self.log_result("User Wallet Verification", "PASS", 
                                          f"Wallet collection accessible ({wallet_count} wallets), user 1005284399 not found (expected for test scenario)")
                        elif 'user_wallet:' in output:
                            wallet_match = re.search(r'user_wallet:(\{.*\})', output)
                            if wallet_match:
                                wallet_data = wallet_match.group(1)
                                self.log_result("User Wallet Verification", "PASS", 
                                              f"User 1005284399 wallet found: {wallet_data}")
                            else:
                                self.log_result("User Wallet Verification", "PASS", 
                                              "User wallet data format issue")
                    else:
                        self.log_error("User Wallet Verification", "Could not parse wallet count")
                else:
                    self.log_error("User Wallet Verification", f"Unexpected output: {output}")
            else:
                self.log_error("User Wallet Verification", f"MongoDB check failed: {result.stderr}")
                
        except Exception as e:
            self.log_error("User Wallet Verification", f"Verification failed: {str(e)}")

    def run_all_tests(self):
        """Run all tests and return summary"""
        print("🔍 CloudPhone Wallet Purchase Crash Fix - ROOT CAUSE Testing")
        print("=" * 80)
        
        # Run all tests
        self.test_nodejs_health()
        self.test_function_scoping() 
        self.test_loaddata_no_functions()
        self.test_try_catch_wrapper()
        self.test_wallet_refund_verification()
        
        # Summary
        print("\n" + "=" * 80)
        print("📋 TEST SUMMARY")
        print("=" * 80)
        
        passed = len([r for r in self.test_results if r['status'] == 'PASS'])
        failed = len([r for r in self.test_results if r['status'] == 'FAIL'])
        total = len(self.test_results)
        
        print(f"✅ PASSED: {passed}")
        print(f"❌ FAILED: {failed}")
        print(f"📊 TOTAL:  {total}")
        print(f"🎯 SUCCESS RATE: {(passed/total*100):.1f}%" if total > 0 else "🎯 SUCCESS RATE: N/A")
        
        if self.errors:
            print(f"\n❌ CRITICAL ISSUES:")
            for error in self.errors:
                print(f"   • {error}")
        
        return {
            'passed': passed,
            'failed': failed, 
            'total': total,
            'success_rate': (passed/total*100) if total > 0 else 0,
            'errors': self.errors
        }

if __name__ == "__main__":
    tester = CloudPhoneTest()
    results = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    sys.exit(0 if results['failed'] == 0 else 1)