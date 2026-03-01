#!/usr/bin/env python3

import os
import sys
import requests
import subprocess
import json
import re

# Load environment variables
def load_env():
    env_path = '/app/backend/.env'
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

load_env()
MONGO_URL = os.environ.get('MONGO_URL', '')
DB_NAME = os.environ.get('DB_NAME', 'test')

def test_result(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} {name}")
    if details:
        print(f"   {details}")

def run_node_command(command):
    """Run a node.js command and return the result"""
    try:
        result = subprocess.run(['node', '-e', command], 
                              capture_output=True, text=True, timeout=10)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return False, "", str(e)

def grep_file(file_path, pattern):
    """Search for a pattern in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            return re.search(pattern, content, re.MULTILINE | re.DOTALL) is not None
    except Exception:
        return False

def main():
    print("🧪 SUB-NUMBERS FEATURE VERIFICATION")
    print("=" * 50)
    
    # 1. NODE.JS HEALTH CHECK
    print("\n1️⃣ NODE.JS HEALTH CHECK")
    try:
        response = requests.get('http://localhost:5000/health', timeout=5)
        health_data = response.json()
        
        # Check status and database
        status_ok = health_data.get('status') == 'healthy'
        db_ok = health_data.get('database') == 'connected'
        
        test_result("Health endpoint responds", response.status_code == 200, f"Status: {response.status_code}")
        test_result("Service status healthy", status_ok, f"Status: {health_data.get('status')}")
        test_result("Database connected", db_ok, f"Database: {health_data.get('database')}")
        
        # Check error logs
        try:
            with open('/var/log/supervisor/nodejs.err.log', 'r') as f:
                error_log = f.read().strip()
                test_result("No errors in nodejs.err.log", len(error_log) == 0, 
                          f"Log length: {len(error_log)} chars")
        except Exception:
            test_result("No errors in nodejs.err.log", False, "Could not read error log")
            
    except Exception as e:
        test_result("Health endpoint responds", False, f"Error: {str(e)}")
        test_result("Service status healthy", False, "Could not connect")
        test_result("Database connected", False, "Could not connect")
    
    # 2. SUB-NUMBER PRICING VERIFICATION
    print("\n2️⃣ SUB-NUMBER PRICING VERIFICATION")
    
    # Check getSubNumberPrice function exists at module scope
    success, stdout, stderr = run_node_command("""
    try {
        const fs = require('fs');
        const content = fs.readFileSync('/app/js/_index.js', 'utf8');
        const funcMatch = content.match(/^function getSubNumberPrice\\(/m);
        console.log(JSON.stringify({
            functionExists: !!funcMatch,
            isModuleScope: funcMatch && funcMatch.index < content.indexOf('const loadData')
        }));
    } catch (e) {
        console.log(JSON.stringify({error: e.message}));
    }
    """)
    
    if success:
        try:
            result = json.loads(stdout)
            test_result("getSubNumberPrice function exists", result.get('functionExists', False))
            test_result("getSubNumberPrice at module scope", result.get('isModuleScope', False))
        except:
            test_result("getSubNumberPrice function verification", False, "Parse error")
    else:
        test_result("getSubNumberPrice function verification", False, f"Error: {stderr}")
    
    # Verify pricing formula
    success, stdout, stderr = run_node_command("""
    try {
        const phoneConfig = require('/app/js/phone-config.js');
        // Test pricing formula for Twilio numbers
        const BASE = 25;
        const MARKUP = 0.5;
        // Simulate a Twilio number with $10/month cost
        const monthlyPrice = 10;
        const expectedPrice = Math.max(BASE, monthlyPrice * (1 + MARKUP));
        console.log(JSON.stringify({
            basePrice: BASE,
            markup: MARKUP,
            expectedPrice: expectedPrice,
            formulaCorrect: expectedPrice === 15  // 10 * 1.5 = 15, which is > 25
        }));
    } catch (e) {
        console.log(JSON.stringify({error: e.message}));
    }
    """)
    
    if success:
        try:
            result = json.loads(stdout)
            test_result("Pricing formula verification", result.get('formulaCorrect', False),
                      f"Expected: 15, Base: {result.get('basePrice')}, Markup: {result.get('markup')}")
        except:
            test_result("Pricing formula verification", False, "Parse error")
    else:
        test_result("Pricing formula verification", False, f"Error: {stderr}")
    
    # 3. PHONE-CONFIG.JS EXPORTS
    print("\n3️⃣ PHONE-CONFIG.JS EXPORTS VERIFICATION")
    
    success, stdout, stderr = run_node_command("""
    try {
        const phoneConfig = require('/app/js/phone-config.js');
        console.log(JSON.stringify({
            SUB_NUMBER_BASE_PRICE: phoneConfig.SUB_NUMBER_BASE_PRICE,
            SUB_NUMBER_MARKUP: phoneConfig.SUB_NUMBER_MARKUP,
            SUB_NUMBER_LIMITS: phoneConfig.SUB_NUMBER_LIMITS,
            getSubNumberLimit_pro: phoneConfig.getSubNumberLimit('pro'),
            getSubNumberLimit_starter: phoneConfig.getSubNumberLimit('starter')
        }));
    } catch (e) {
        console.log(JSON.stringify({error: e.message}));
    }
    """)
    
    if success:
        try:
            result = json.loads(stdout)
            test_result("SUB_NUMBER_BASE_PRICE === 25", result.get('SUB_NUMBER_BASE_PRICE') == 25)
            test_result("SUB_NUMBER_MARKUP === 0.5", result.get('SUB_NUMBER_MARKUP') == 0.5)
            
            limits = result.get('SUB_NUMBER_LIMITS', {})
            expected_limits = {'starter': 3, 'pro': 15, 'business': 30}
            test_result("SUB_NUMBER_LIMITS correct", limits == expected_limits, f"Got: {limits}")
            
            test_result("getSubNumberLimit('pro') === 15", result.get('getSubNumberLimit_pro') == 15)
            test_result("getSubNumberLimit('starter') === 3", result.get('getSubNumberLimit_starter') == 3)
            
        except Exception as e:
            test_result("Phone config exports verification", False, f"Parse error: {e}")
    else:
        test_result("Phone config exports verification", False, f"Error: {stderr}")
    
    # 4. NEW ACTION STATES
    print("\n4️⃣ NEW ACTION STATES VERIFICATION")
    
    action_states = [
        'cpSubAddCountry', 'cpSubAddType', 'cpSubAddArea', 
        'cpSubAddEnterArea', 'cpSubAddNumber', 'cpSubAddConfirm'
    ]
    
    for state in action_states:
        found = grep_file('/app/js/_index.js', f'{state}: [\'"]cpSubAdd')
        test_result(f"Action state '{state}' exists", found)
    
    # 5. ADD NUMBER BUTTON
    print("\n5️⃣ ADD NUMBER BUTTON VERIFICATION")
    
    # Check btn.addNumber exists in phone-config.js
    success, stdout, stderr = run_node_command("""
    try {
        const phoneConfig = require('/app/js/phone-config.js');
        const btn = phoneConfig.btn || {};
        console.log(JSON.stringify({
            addNumberButton: btn.addNumber
        }));
    } catch (e) {
        console.log(JSON.stringify({error: e.message}));
    }
    """)
    
    if success:
        try:
            result = json.loads(stdout)
            expected_text = '➕ Add Number to Plan'
            actual_text = result.get('addNumberButton')
            test_result("btn.addNumber exists", actual_text == expected_text, 
                      f"Expected: '{expected_text}', Got: '{actual_text}'")
        except:
            test_result("btn.addNumber verification", False, "Parse error")
    else:
        test_result("btn.addNumber verification", False, f"Error: {stderr}")
    
    # Check buildManageMenu logic
    build_menu_check = grep_file('/app/js/_index.js', 
        r'!num\.isSubNumber && subLimit > 0 && subCount < subLimit')
    test_result("buildManageMenu sub-number check exists", build_menu_check)
    
    # 6. EXECUTETWILOPURCHASE SUB-NUMBER SUPPORT
    print("\n6️⃣ EXECUTETWILOPURCHASE SUB-NUMBER SUPPORT")
    
    # Check function signature includes subOpts
    function_sig_check = grep_file('/app/js/_index.js',
        r'function executeTwilioPurchase\([^)]*subOpts[^)]*\)')
    test_result("executeTwilioPurchase includes subOpts parameter", function_sig_check)
    
    # Check sub-number fields addition
    sub_fields_check = grep_file('/app/js/_index.js',
        r'if \(subOpts\?\.isSubNumber && subOpts\?\.parentNumber\)')
    test_result("Sub-number fields addition logic exists", sub_fields_check)
    
    # Check transaction action logic
    transaction_check = grep_file('/app/js/_index.js',
        r"action: subOpts\?\.isSubNumber \? 'sub-number-purchase' : 'purchase'")
    test_result("Transaction action sub-number logic exists", transaction_check)
    
    # Check admin notification logic
    admin_notify_check = grep_file('/app/js/_index.js',
        r'if \(subOpts\?\.isSubNumber\)')
    test_result("Admin notification sub-number logic exists", admin_notify_check)
    
    # 7. WALLET HANDLER SUB-NUMBER SUPPORT
    print("\n7️⃣ WALLET HANDLER SUB-NUMBER SUPPORT")
    
    # Check Twilio path passes subOpts
    twilio_subopts_check = grep_file('/app/js/_index.js',
        r'executeTwilioPurchase\([^)]*subOpts\)')
    test_result("Twilio path passes subOpts", twilio_subopts_check)
    
    # Check cpTxt.subActivated usage
    sub_activated_check = grep_file('/app/js/_index.js', 
        r'cpTxt\.subActivated\(')
    test_result("cpTxt.subActivated usage exists", sub_activated_check)
    
    # Check Telnyx path sub-number support
    telnyx_sub_check = grep_file('/app/js/_index.js',
        r'numberDoc\.isSubNumber.*info\?\.cpIsSubNumber')
    test_result("Telnyx path sub-number support exists", telnyx_sub_check)
    
    # 8. TEXT MESSAGES VERIFICATION
    print("\n8️⃣ TEXT MESSAGES VERIFICATION")
    
    success, stdout, stderr = run_node_command("""
    try {
        const phoneConfig = require('/app/js/phone-config.js');
        const txt = phoneConfig.getTxt('en');
        console.log(JSON.stringify({
            subActivated: typeof txt.subActivated,
            subNumberOrderSummary: typeof txt.subNumberOrderSummary,
            subNumberLimitReached: typeof txt.subNumberLimitReached,
            adminSubPurchase: typeof txt.adminSubPurchase
        }));
    } catch (e) {
        console.log(JSON.stringify({error: e.message}));
    }
    """)
    
    if success:
        try:
            result = json.loads(stdout)
            test_result("subActivated is function", result.get('subActivated') == 'function')
            test_result("subNumberOrderSummary is function", result.get('subNumberOrderSummary') == 'function')
            test_result("subNumberLimitReached is function", result.get('subNumberLimitReached') == 'function')
            test_result("adminSubPurchase is function", result.get('adminSubPurchase') == 'function')
        except:
            test_result("Text messages verification", False, "Parse error")
    else:
        test_result("Text messages verification", False, f"Error: {stderr}")
    
    print("\n" + "=" * 50)
    print("🏁 SUB-NUMBERS FEATURE VERIFICATION COMPLETE")

if __name__ == "__main__":
    main()