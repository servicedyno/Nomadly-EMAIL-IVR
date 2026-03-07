#!/usr/bin/env python3

import requests
import json
import time
import sys
import os
import subprocess

def log(message):
    print(f"[TEST] {message}")

def test_nodejs_health():
    """Test 1: Node.js Health Check"""
    log("Testing Node.js health check...")
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Health check passed: {data}")
            return True
        else:
            log(f"❌ Health check failed with status {response.status_code}")
            return False
    except Exception as e:
        log(f"❌ Health check failed: {e}")
        return False

def check_nodejs_error_logs():
    """Test 2: Check Node.js error logs are empty"""
    log("Checking Node.js error logs...")
    try:
        result = subprocess.run(['ls', '-la', '/var/log/supervisor/nodejs.err.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            # File exists, check size
            result = subprocess.run(['wc', '-c', '/var/log/supervisor/nodejs.err.log'], 
                                  capture_output=True, text=True)
            size = int(result.stdout.split()[0])
            if size == 0:
                log("✅ Node.js error log is EMPTY (0 bytes)")
                return True
            else:
                log(f"❌ Node.js error log has {size} bytes")
                # Show last 10 lines of error log
                result = subprocess.run(['tail', '-10', '/var/log/supervisor/nodejs.err.log'], 
                                      capture_output=True, text=True)
                log(f"Last 10 lines of error log:\n{result.stdout}")
                return False
        else:
            log("❌ Node.js error log file not found")
            return False
    except Exception as e:
        log(f"❌ Error checking Node.js error logs: {e}")
        return False

def test_balance_monitor_exports():
    """Test 3: Check balance-monitor.js module exports"""
    log("Testing balance-monitor.js module exports...")
    try:
        # Test by trying to require the module in Node.js
        test_script = """
        try {
            const balanceMonitor = require('./js/balance-monitor.js');
            const requiredExports = ['initBalanceMonitor', 'checkAllBalances', 'checkTelnyxBalance', 'checkTwilioBalance'];
            const hasAll = requiredExports.every(exp => typeof balanceMonitor[exp] === 'function');
            console.log(JSON.stringify({
                success: hasAll,
                exports: Object.keys(balanceMonitor),
                required: requiredExports
            }));
        } catch (e) {
            console.log(JSON.stringify({success: false, error: e.message}));
        }
        """
        
        result = subprocess.run(['node', '-e', test_script], 
                              capture_output=True, text=True, cwd='/app')
        
        if result.returncode == 0:
            data = json.loads(result.stdout.strip())
            if data.get('success'):
                log(f"✅ Module exports verified: {data.get('exports')}")
                return True
            else:
                log(f"❌ Module exports missing: {data}")
                return False
        else:
            log(f"❌ Module test failed: {result.stderr}")
            return False
    except Exception as e:
        log(f"❌ Error testing module exports: {e}")
        return False

def check_initialization_logs():
    """Test 4: Check for initialization log message"""
    log("Checking for balance monitor initialization logs...")
    try:
        result = subprocess.run(['grep', '-i', 'BalanceMonitor.*Initialized.*checking every.*120min.*warn.*crit', 
                               '/var/log/supervisor/nodejs.out.log'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            log(f"✅ Initialization log found: {result.stdout.strip()}")
            return True
        else:
            # Try a more flexible search
            result = subprocess.run(['grep', '-i', 'BalanceMonitor.*Initialized', 
                                   '/var/log/supervisor/nodejs.out.log'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                log(f"✅ Balance monitor initialization found: {result.stdout.strip()}")
                return True
            else:
                log("❌ Balance monitor initialization log not found")
                return False
    except Exception as e:
        log(f"❌ Error checking initialization logs: {e}")
        return False

def check_startup_balance_check():
    """Test 5: Check for startup balance check message (30s after startup)"""
    log("Checking for startup balance check logs...")
    try:
        result = subprocess.run(['grep', '-i', 'Running provider balance checks', 
                               '/var/log/supervisor/nodejs.out.log'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            log(f"✅ Startup balance check found: {result.stdout.strip()}")
            return True
        else:
            log("❌ Startup balance check log not found")
            return False
    except Exception as e:
        log(f"❌ Error checking startup balance check logs: {e}")
        return False

def check_telnyx_balance_logs():
    """Test 6: Check for Telnyx balance check logs"""
    log("Checking for Telnyx balance check logs...")
    try:
        result = subprocess.run(['grep', '-i', 'Telnyx.*USD.*\\[', 
                               '/var/log/supervisor/nodejs.out.log'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            log(f"✅ Telnyx balance logs found: {result.stdout.strip()}")
            return True
        else:
            log("❌ Telnyx balance logs not found")
            return False
    except Exception as e:
        log(f"❌ Error checking Telnyx balance logs: {e}")
        return False

def check_twilio_balance_logs():
    """Test 7: Check for Twilio balance check logs"""
    log("Checking for Twilio balance check logs...")
    try:
        result = subprocess.run(['grep', '-i', 'Twilio.*USD.*\\[', 
                               '/var/log/supervisor/nodejs.out.log'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            log(f"✅ Twilio balance logs found: {result.stdout.strip()}")
            return True
        else:
            log("❌ Twilio balance logs not found")
            return False
    except Exception as e:
        log(f"❌ Error checking Twilio balance logs: {e}")
        return False

def check_alert_sent_logs():
    """Test 8: Check for alert sent logs (should show WARNING alert for Twilio ~$6.13)"""
    log("Checking for balance alert logs...")
    try:
        result = subprocess.run(['grep', '-i', 'WARNING alert sent.*Twilio', 
                               '/var/log/supervisor/nodejs.out.log'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            log(f"✅ Twilio WARNING alert found: {result.stdout.strip()}")
            return True
        else:
            # Check for any alert sent logs
            result = subprocess.run(['grep', '-i', 'alert sent', 
                                   '/var/log/supervisor/nodejs.out.log'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                log(f"✅ Alert logs found: {result.stdout.strip()}")
                return True
            else:
                log("❌ No balance alert logs found")
                return False
    except Exception as e:
        log(f"❌ Error checking alert logs: {e}")
        return False

def check_integration_in_index():
    """Test 9: Check integration in _index.js"""
    log("Checking balance monitor integration in _index.js...")
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        # Check for require statement
        if "require('./balance-monitor.js')" in content:
            log("✅ balance-monitor.js require statement found")
            require_found = True
        else:
            log("❌ balance-monitor.js require statement not found")
            require_found = False
        
        # Check for initBalanceMonitor call
        if "initBalanceMonitor(bot)" in content:
            log("✅ initBalanceMonitor(bot) call found")
            init_found = True
        else:
            log("❌ initBalanceMonitor(bot) call not found")
            init_found = False
        
        # Check if it's after EmailBlast initialization
        email_blast_idx = content.find("emailBlastService.initEmailBlast")
        balance_monitor_idx = content.find("initBalanceMonitor(bot)")
        
        if email_blast_idx != -1 and balance_monitor_idx != -1 and balance_monitor_idx > email_blast_idx:
            log("✅ Balance monitor initialized after EmailBlast service")
            order_correct = True
        else:
            log("⚠️ Balance monitor initialization order unclear")
            order_correct = False
        
        return require_found and init_found
    except Exception as e:
        log(f"❌ Error checking integration: {e}")
        return False

def check_threshold_configuration():
    """Test 10: Check threshold configuration in balance-monitor.js"""
    log("Checking threshold configuration...")
    try:
        with open('/app/js/balance-monitor.js', 'r') as f:
            content = f.read()
        
        checks = []
        
        # Check for BALANCE_WARN_THRESHOLD
        if "BALANCE_WARN_THRESHOLD" in content and "process.env.BALANCE_WARN_THRESHOLD" in content and "'10'" in content:
            log("✅ BALANCE_WARN_THRESHOLD configured (default 10)")
            checks.append(True)
        else:
            log("❌ BALANCE_WARN_THRESHOLD not properly configured")
            checks.append(False)
        
        # Check for BALANCE_CRIT_THRESHOLD  
        if "BALANCE_CRIT_THRESHOLD" in content and "process.env.BALANCE_CRIT_THRESHOLD" in content and "'5'" in content:
            log("✅ BALANCE_CRIT_THRESHOLD configured (default 5)")
            checks.append(True)
        else:
            log("❌ BALANCE_CRIT_THRESHOLD not properly configured")
            checks.append(False)
        
        # Check for BALANCE_CHECK_INTERVAL_MIN
        if "BALANCE_CHECK_INTERVAL_MIN" in content and "process.env.BALANCE_CHECK_INTERVAL_MIN" in content and "'120'" in content:
            log("✅ BALANCE_CHECK_INTERVAL_MIN configured (default 120)")
            checks.append(True)
        else:
            log("❌ BALANCE_CHECK_INTERVAL_MIN not properly configured")
            checks.append(False)
        
        return all(checks)
    except Exception as e:
        log(f"❌ Error checking threshold configuration: {e}")
        return False

def check_alert_deduplication():
    """Test 11: Check alert deduplication configuration"""
    log("Checking alert deduplication configuration...")
    try:
        with open('/app/js/balance-monitor.js', 'r') as f:
            content = f.read()
        
        # Check for DEDUP_WINDOW_MS set to 6 hours
        if "DEDUP_WINDOW_MS = 6 * 60 * 60 * 1000" in content:
            log("✅ Alert deduplication window set to 6 hours")
            return True
        else:
            log("❌ Alert deduplication window not properly configured")
            return False
    except Exception as e:
        log(f"❌ Error checking alert deduplication: {e}")
        return False

def main():
    """Run all Provider Balance Monitor tests"""
    log("Starting Provider Balance Monitor comprehensive testing...")
    log("=" * 60)
    
    tests = [
        ("Node.js Health Check", test_nodejs_health),
        ("Node.js Error Logs Empty", check_nodejs_error_logs), 
        ("Module Exports", test_balance_monitor_exports),
        ("Initialization Logs", check_initialization_logs),
        ("Startup Balance Check", check_startup_balance_check),
        ("Telnyx Balance Check Logs", check_telnyx_balance_logs),
        ("Twilio Balance Check Logs", check_twilio_balance_logs),
        ("Alert Sent Logs", check_alert_sent_logs),
        ("Integration in _index.js", check_integration_in_index),
        ("Threshold Configuration", check_threshold_configuration),
        ("Alert Deduplication", check_alert_deduplication),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        log(f"\n--- {test_name} ---")
        try:
            if test_func():
                passed += 1
                log(f"✅ {test_name}: PASSED")
            else:
                failed += 1
                log(f"❌ {test_name}: FAILED")
        except Exception as e:
            failed += 1
            log(f"❌ {test_name}: ERROR - {e}")
    
    log("\n" + "=" * 60)
    log(f"PROVIDER BALANCE MONITOR TEST SUMMARY")
    log(f"Total Tests: {len(tests)}")
    log(f"Passed: {passed}")
    log(f"Failed: {failed}")
    log(f"Success Rate: {passed/len(tests)*100:.1f}%")
    
    if failed == 0:
        log("🎉 ALL TESTS PASSED - Provider Balance Monitor is working correctly!")
        return True
    else:
        log(f"⚠️ {failed} test(s) failed - Provider Balance Monitor has issues")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)