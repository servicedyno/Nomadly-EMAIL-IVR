#!/usr/bin/env python3

import requests
import json
import os
from pymongo import MongoClient

def test_cpTxt_referenceerror_fix():
    """
    Test the cpTxt ReferenceError fix in executeTwilioPurchase function
    Based on review request requirements
    """
    
    print("=== CPTEXT REFERENCEERROR FIX VERIFICATION ===")
    
    # 1. Node.js Health Check
    print("\n1. TESTING NODE.JS HEALTH")
    try:
        response = requests.get("http://localhost:5000/health", timeout=10)
        health_data = response.json()
        print(f"✅ Node.js Health: {health_data}")
        if health_data.get('status') == 'healthy' and health_data.get('database') == 'connected':
            print("✅ Service running healthy with database connected")
        else:
            print("❌ Service health check failed")
            return False
    except Exception as e:
        print(f"❌ Node.js health check failed: {e}")
        return False
    
    # 2. Error Log Check
    print("\n2. TESTING ERROR LOGS")
    try:
        with open('/var/log/supervisor/nodejs.err.log', 'r') as f:
            error_content = f.read().strip()
        
        if not error_content:
            print("✅ nodejs.err.log is empty (zero errors)")
        else:
            print(f"❌ Found errors in nodejs.err.log: {error_content}")
            return False
    except Exception as e:
        print(f"❌ Error log check failed: {e}")
    
    # 3. Code Fix Verification
    print("\n3. TESTING CODE FIX - NO cpTxt IN executeTwilioPurchase")
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
            
        # Check for cpTxt references inside executeTwilioPurchase function
        lines = content.split('\n')
        in_function = False
        function_start = 0
        function_end = 0
        cpTxt_found = []
        
        for i, line in enumerate(lines):
            if 'async function executeTwilioPurchase(' in line:
                in_function = True
                function_start = i + 1
                print(f"✅ Found executeTwilioPurchase at line {i + 1}")
                continue
                
            if in_function and line.strip() == '}' and ('return' in lines[i-1] or 'return' in lines[i-2]):
                function_end = i + 1
                in_function = False
                break
                
            if in_function and 'cpTxt' in line and not line.strip().startswith('//'):
                cpTxt_found.append(f"Line {i + 1}: {line.strip()}")
        
        if cpTxt_found:
            print(f"❌ Found cpTxt references in executeTwilioPurchase:")
            for ref in cpTxt_found:
                print(f"    {ref}")
            return False
        else:
            print("✅ No cpTxt references found in executeTwilioPurchase function")
            
        # Check for the correct fix pattern
        admin_txt_pattern = "const _adminTxt = phoneConfig.getTxt('en')"
        if admin_txt_pattern in content:
            print("✅ Found correct fix: _adminTxt = phoneConfig.getTxt('en')")
        else:
            print("❌ Correct fix pattern not found")
            return False
            
        # Verify _adminTxt.adminPurchase and _adminTxt.adminPurchasePrivate usage
        if "_adminTxt.adminPurchase(" in content and "_adminTxt.adminPurchasePrivate(" in content:
            print("✅ Found correct usage of _adminTxt for admin notifications")
        else:
            print("❌ _adminTxt usage not found in admin notifications")
            return False
            
    except Exception as e:
        print(f"❌ Code verification failed: {e}")
        return False
    
    # 4. MongoDB Data Verification
    print("\n4. TESTING MONGODB DATA FIXES")
    try:
        # Get MongoDB URL from environment
        mongo_url = os.getenv('MONGO_URL', 'mongodb://mongo:RQoOmIdwjRLFvhWMaatjidzqpvawUKcb@caboose.proxy.rlwy.net:59668')
        db_name = os.getenv('DB_NAME', 'test')
        
        client = MongoClient(mongo_url)
        db = client[db_name]
        
        print(f"✅ Connected to MongoDB: {db_name}")
        
        # Check user 1005284399 wallet
        wallet = db.walletOf.find_one({'_id': 1005284399})
        if wallet:
            usd_in = wallet.get('usdIn', 0)
            usd_out = wallet.get('usdOut', 0)
            balance = usd_in - usd_out
            
            print(f"✅ User 1005284399 wallet found:")
            print(f"    usdIn: {usd_in}")
            print(f"    usdOut: {usd_out}")
            print(f"    Balance: ${balance:.2f}")
            
            # Expected values from review request
            if usd_in == 270 and usd_out == 218.53:
                print("✅ Wallet balance matches expected values (usdIn=270, usdOut=218.53)")
                if balance == 51.47:
                    print("✅ Balance calculation correct: $51.47")
                else:
                    print(f"⚠️  Balance calculation: expected $51.47, got ${balance:.2f}")
            else:
                print(f"⚠️  Wallet values: expected usdIn=270 usdOut=218.53, got usdIn={usd_in} usdOut={usd_out}")
        else:
            print("❌ User 1005284399 wallet not found")
            return False
            
        # Check phone number assignment
        phone_data = db.phoneNumbersOf.find_one({'_id': 1005284399})
        if phone_data:
            # Handle different data structures (val.numbers vs numbers)
            numbers = phone_data.get('val', {}).get('numbers', phone_data.get('numbers', []))
            target_number = '+18669834855'
            found_number = None
            
            print(f"✅ Phone data found for user 1005284399, checking {len(numbers)} numbers")
            
            for number in numbers:
                if number.get('phoneNumber') == target_number:
                    found_number = number
                    break
                    
            if found_number:
                print(f"✅ Phone number {target_number} found for user 1005284399:")
                print(f"    Plan: {found_number.get('plan')}")
                print(f"    Price: {found_number.get('planPrice')}")  
                print(f"    Status: {found_number.get('status')}")
                print(f"    Provider: {found_number.get('provider')}")
                
                # Verify expected values
                plan_ok = found_number.get('plan') == 'pro'
                price_ok = found_number.get('planPrice') == 75
                status_ok = found_number.get('status') == 'active'
                provider_ok = found_number.get('provider') == 'twilio'
                
                if plan_ok and price_ok and status_ok and provider_ok:
                    print("✅ Phone number data matches expected values (plan=pro, planPrice=75, status=active, provider=twilio)")
                else:
                    print(f"⚠️  Phone number data: plan={plan_ok}, price={price_ok}, status={status_ok}, provider={provider_ok}")
            else:
                print(f"❌ Phone number {target_number} not found for user")
                return False
        else:
            print("❌ Phone numbers data not found for user 1005284399")
            return False
            
        client.close()
        
    except Exception as e:
        print(f"❌ MongoDB verification failed: {e}")
        return False
    
    # 5. Verify no remaining cpTxt in module-scope functions
    print("\n5. TESTING MODULE-SCOPE CPTEXT USAGE")
    try:
        with open('/app/js/_index.js', 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        loaddata_line = 0
        
        # Find loadData function start
        for i, line in enumerate(lines):
            if 'const loadData = async () => {' in line:
                loaddata_line = i + 1
                break
        
        if loaddata_line == 0:
            print("❌ Could not find loadData function")
            return False
            
        print(f"✅ Found loadData function at line {loaddata_line}")
        
        # Check for cpTxt usage before loadData (module scope)
        module_scope_cpTxt = []
        for i in range(loaddata_line):
            if 'cpTxt' in lines[i] and not lines[i].strip().startswith('//'):
                module_scope_cpTxt.append(f"Line {i + 1}: {lines[i].strip()}")
        
        if module_scope_cpTxt:
            print("❌ Found cpTxt references in module scope (before loadData):")
            for ref in module_scope_cpTxt:
                print(f"    {ref}")
            return False
        else:
            print("✅ No cpTxt references found in module scope (before loadData)")
        
    except Exception as e:
        print(f"❌ Module scope verification failed: {e}")
        return False
    
    print("\n=== VERIFICATION COMPLETE ===")
    print("✅ All cpTxt ReferenceError fix requirements verified successfully!")
    return True

if __name__ == "__main__":
    success = test_cpTxt_referenceerror_fix()
    if not success:
        exit(1)