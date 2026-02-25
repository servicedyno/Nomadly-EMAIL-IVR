#!/usr/bin/env python3
"""
Test script for bidirectional crypto payment fallback logic in Nomadly Telegram bot.
This script performs static code analysis to verify all fallback patterns are correctly implemented.
"""

import re
import requests
import sys

def test_fallback_log_lines():
    """Test 1: Verify all 20 fallback log lines exist"""
    print("TEST 1: Verifying 20 [CryptoFallback] log lines...")
    
    with open('/app/js/_index.js', 'r') as f:
        content = f.read()
    
    # Find all [CryptoFallback] lines
    fallback_lines = re.findall(r'\[CryptoFallback\][^\']*', content)
    
    expected_patterns = [
        # BlockBee → DynoPay fallback (10 lines)
        'BlockBee unavailable for wallet, falling back to DynoPay',
        'BlockBee unavailable for digital product, falling back to DynoPay',
        'BlockBee unavailable for virtual card, falling back to DynoPay',
        'BlockBee unavailable for domain, falling back to DynoPay',
        'BlockBee unavailable for hosting, falling back to DynoPay',
        'BlockBee unavailable for VPS, falling back to DynoPay',
        'BlockBee unavailable for VPS upgrade, falling back to DynoPay',
        'BlockBee unavailable for plan, falling back to DynoPay',
        'BlockBee unavailable for phone, falling back to DynoPay',
        'BlockBee unavailable for leads, falling back to DynoPay',
        # DynoPay → BlockBee fallback (10 lines)
        'DynoPay unavailable for wallet, falling back to BlockBee',
        'DynoPay unavailable for digital product, falling back to BlockBee',
        'DynoPay unavailable for virtual card, falling back to BlockBee',
        'DynoPay unavailable for domain, falling back to BlockBee',
        'DynoPay unavailable for hosting, falling back to BlockBee',
        'DynoPay unavailable for VPS, falling back to BlockBee',
        'DynoPay unavailable for VPS upgrade, falling back to BlockBee',
        'DynoPay unavailable for plan, falling back to BlockBee',
        'DynoPay unavailable for phone, falling back to BlockBee',
        'DynoPay unavailable for leads, falling back to BlockBee',
    ]
    
    found_patterns = [line.strip("'") for line in fallback_lines]
    
    print(f"Expected: {len(expected_patterns)} lines")
    print(f"Found: {len(found_patterns)} lines")
    
    missing = []
    for pattern in expected_patterns:
        if not any(pattern in found for found in found_patterns):
            missing.append(pattern)
    
    if missing:
        print(f"❌ MISSING PATTERNS: {missing}")
        return False
    
    if len(found_patterns) != 20:
        print(f"❌ Expected exactly 20 lines, found {len(found_patterns)}")
        return False
        
    print("✅ All 20 [CryptoFallback] log lines found")
    return True

def test_no_generate_blockbee_address():
    """Test 2: Verify no references to broken generateBlockBeeAddress remain"""
    print("\nTEST 2: Checking for generateBlockBeeAddress references...")
    
    with open('/app/js/_index.js', 'r') as f:
        content = f.read()
    
    if 'generateBlockBeeAddress' in content:
        count = content.count('generateBlockBeeAddress')
        print(f"❌ Found {count} references to generateBlockBeeAddress")
        return False
    
    print("✅ No generateBlockBeeAddress references found")
    return True

def test_blockbee_bbresult_pattern():
    """Test 3: Verify BlockBee if-blocks use bbResult pattern"""
    print("\nTEST 3: Verifying BlockBee if-blocks use bbResult pattern...")
    
    with open('/app/js/_index.js', 'r') as f:
        content = f.read()
    
    # Find all BlockBee if-blocks
    blockbee_patterns = re.findall(
        r'const bbResult = await getCryptoDepositAddress.*?\n.*?if \(bbResult\?\.address\)', 
        content, 
        re.DOTALL
    )
    
    expected_count = 10  # 10 payment types
    found_count = len(blockbee_patterns)
    
    print(f"Expected: {expected_count} BlockBee patterns")
    print(f"Found: {found_count} BlockBee patterns")
    
    if found_count != expected_count:
        print(f"❌ Expected {expected_count} BlockBee patterns, found {found_count}")
        return False
    
    print("✅ All BlockBee if-blocks use bbResult pattern correctly")
    return True

def test_dynopay_dynoresult_pattern():
    """Test 4: Verify DynoPay else-blocks use dynoResult pattern"""
    print("\nTEST 4: Verifying DynoPay else-blocks use dynoResult pattern...")
    
    with open('/app/js/_index.js', 'r') as f:
        content = f.read()
    
    # Find DynoPay patterns
    dynopay_patterns = re.findall(
        r'const dynoResult = await getDynopayCryptoAddress', 
        content
    )
    
    expected_count = 20  # 10 primary + 10 fallback patterns
    found_count = len(dynopay_patterns)
    
    print(f"Expected: {expected_count} DynoPay patterns")
    print(f"Found: {found_count} DynoPay patterns")
    
    if found_count != expected_count:
        print(f"❌ Expected {expected_count} DynoPay patterns, found {found_count}")
        return False
    
    print("✅ All DynoPay else-blocks use dynoResult pattern correctly")
    return True

def test_tracking_collections():
    """Test 5: Verify correct tracking collections"""
    print("\nTEST 5: Verifying correct tracking collections...")
    
    with open('/app/js/_index.js', 'r') as f:
        content = f.read()
    
    # Find all contexts where tracking is set after crypto address generation
    lines = content.split('\n')
    
    blockbee_primary_count = 0
    dynopay_primary_count = 0
    blockbee_fallback_count = 0
    dynopay_fallback_count = 0
    
    for i, line in enumerate(lines):
        # Count BlockBee primary success (bbResult -> chatIdOfPayment)
        if 'bbResult?.address' in line and i+3 < len(lines):
            next_lines = '\n'.join(lines[i+1:i+4])
            if 'set(chatIdOfPayment' in next_lines:
                blockbee_primary_count += 1
        
        # Count DynoPay primary success (dynoResult -> chatIdOfDynopayPayment)
        if 'dynoResult?.address' in line and i+3 < len(lines):
            next_lines = '\n'.join(lines[i+1:i+4])
            if 'set(chatIdOfDynopayPayment' in next_lines:
                dynopay_primary_count += 1
        
        # Count BlockBee fallback (after DynoPay fails -> chatIdOfPayment)
        if '[CryptoFallback] DynoPay unavailable' in line and i+5 < len(lines):
            next_lines = '\n'.join(lines[i+1:i+6])
            if 'set(chatIdOfPayment' in next_lines:
                blockbee_fallback_count += 1
                
        # Count DynoPay fallback (after BlockBee fails -> chatIdOfDynopayPayment)
        if '[CryptoFallback] BlockBee unavailable' in line and i+5 < len(lines):
            next_lines = '\n'.join(lines[i+1:i+6])
            if 'set(chatIdOfDynopayPayment' in next_lines:
                dynopay_fallback_count += 1
    
    print(f"BlockBee primary success tracking: {blockbee_primary_count}")
    print(f"DynoPay primary success tracking: {dynopay_primary_count}")
    print(f"BlockBee fallback tracking: {blockbee_fallback_count}")
    print(f"DynoPay fallback tracking: {dynopay_fallback_count}")
    
    # Each payment type should have proper tracking
    expected_count = 10  # 10 payment types
    
    if blockbee_primary_count != expected_count:
        print(f"❌ Expected {expected_count} BlockBee primary patterns, found {blockbee_primary_count}")
        return False
        
    if blockbee_fallback_count != expected_count:
        print(f"❌ Expected {expected_count} BlockBee fallback patterns, found {blockbee_fallback_count}")
        return False
        
    if dynopay_fallback_count != expected_count:
        print(f"❌ Expected {expected_count} DynoPay fallback patterns, found {dynopay_fallback_count}")
        return False
    
    print("✅ Tracking collections are correctly used")
    return True

def test_qr_code_generation():
    """Test 6: Verify correct QR code generation"""
    print("\nTEST 6: Verifying correct QR code generation...")
    
    with open('/app/js/_index.js', 'r') as f:
        content = f.read()
    
    # Check BlockBee uses sendQrCode with bbResult.bb
    blockbee_qr = re.findall(r'sendQrCode\(bot, chatId, bbResult\.bb', content)
    
    # Check DynoPay uses generateQr with dynoResult.qr_code
    dynopay_qr = re.findall(r'generateQr\(bot, chatId, dynoResult\.qr_code', content)
    
    print(f"Found BlockBee QR patterns: {len(blockbee_qr)}")
    print(f"Found DynoPay QR patterns: {len(dynopay_qr)}")
    
    if len(blockbee_qr) < 10:
        print(f"❌ Insufficient BlockBee QR patterns: {len(blockbee_qr)}")
        return False
        
    if len(dynopay_qr) < 10:
        print(f"❌ Insufficient DynoPay QR patterns: {len(dynopay_qr)}")
        return False
    
    print("✅ QR code generation patterns are correct")
    return True

def test_hosting_provider_updates():
    """Test 7: Verify hosting paymentIntents provider update on fallback"""
    print("\nTEST 7: Verifying hosting paymentIntents provider updates...")
    
    with open('/app/js/_index.js', 'r') as f:
        content = f.read()
    
    # Check BlockBee→DynoPay fallback updates provider to 'dynopay'
    dynopay_update = re.findall(r'paymentIntents\.updateOne.*provider.*dynopay', content)
    
    # Check DynoPay→BlockBee fallback updates provider to 'blockbee'
    blockbee_update = re.findall(r'paymentIntents\.updateOne.*provider.*blockbee', content)
    
    print(f"Found DynoPay provider updates: {len(dynopay_update)}")
    print(f"Found BlockBee provider updates: {len(blockbee_update)}")
    
    if len(dynopay_update) < 1:
        print("❌ Missing DynoPay provider update")
        return False
        
    if len(blockbee_update) < 1:
        print("❌ Missing BlockBee provider update")
        return False
    
    print("✅ Hosting paymentIntents provider updates are correct")
    return True

def test_nodejs_health():
    """Test 8: Verify Node.js health check"""
    print("\nTEST 8: Checking Node.js health...")
    
    try:
        response = requests.get('http://localhost:5000/health', timeout=10)
        data = response.json()
        
        if response.status_code != 200:
            print(f"❌ Health check failed with status {response.status_code}")
            return False
            
        if data.get('status') != 'healthy':
            print(f"❌ Service status is {data.get('status')}, expected 'healthy'")
            return False
            
        if data.get('database') != 'connected':
            print(f"❌ Database status is {data.get('database')}, expected 'connected'")
            return False
        
        print(f"✅ Node.js service healthy (uptime: {data.get('uptime', 'unknown')})")
        return True
        
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 TESTING BIDIRECTIONAL CRYPTO PAYMENT FALLBACK LOGIC")
    print("=" * 60)
    
    tests = [
        test_fallback_log_lines,
        test_no_generate_blockbee_address,
        test_blockbee_bbresult_pattern,
        test_dynopay_dynoresult_pattern,
        test_tracking_collections,
        test_qr_code_generation,
        test_hosting_provider_updates,
        test_nodejs_health
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"SUMMARY: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED - Bidirectional crypto payment fallback logic is working correctly!")
        return True
    else:
        print("❌ SOME TESTS FAILED - Review the implementation")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)