#!/usr/bin/env python3
"""
Backend API Testing for Nomadly Telegram-bot UX/text fix batch
Tests B1 (newline fix), T4 (Quick IVR label), T5 (plan marketing consistency)
Plus OTP regression check
"""

import requests
import sys
import json

# Get backend URL from frontend/.env
BACKEND_URL = "https://f06fe503-30a9-4c4e-a049-cc26f354ea86.preview.emergentagent.com"

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def add_pass(self, test_name: str):
        self.passed += 1
        print(f"  ✅ {test_name}")
    
    def add_fail(self, test_name: str, reason: str):
        self.failed += 1
        error_msg = f"  ❌ {test_name}: {reason}"
        self.errors.append(error_msg)
        print(error_msg)
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*80}")
        print(f"OVERALL: {self.passed}/{total} assertions passed")
        print(f"{'='*80}")
        if self.errors:
            print("\nFAILED ASSERTIONS:")
            for error in self.errors:
                print(error)
        return self.failed == 0


def test_ux_fixes_audit(result: TestResult):
    """
    TEST 1: Verify B1 (newline fix), T4 (Quick IVR label), T5 (plan marketing consistency)
    """
    print("\n" + "="*80)
    print("TEST 1: UX Fixes Audit - B1, T4, T5 Verification")
    print("="*80)
    
    url = f"{BACKEND_URL}/api/dev/ux-fixes-audit"
    print(f"\nGET {url}\n")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            result.add_fail("HTTP 200", f"Got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return
        
        result.add_pass("HTTP 200")
        
        data = response.json()
        print(f"\nResponse preview:")
        print(json.dumps(data, indent=2)[:800])
        print("...\n")
        
        # Assertion 1: ok === true
        if data.get('ok') == True:
            result.add_pass("ok === true")
        else:
            result.add_fail("ok === true", f"Got {data.get('ok')}")
        
        # B1 ASSERTIONS: newlineCheck
        print("\n[B1: Newline Fix Verification]")
        newline_check = data.get('newlineCheck', {})
        
        # Assertion 2: leakingKeyCount === 0
        leaking_count = newline_check.get('leakingKeyCount', -1)
        if leaking_count == 0:
            result.add_pass("newlineCheck.leakingKeyCount === 0 (no literal \\n leaks)")
        else:
            result.add_fail("newlineCheck.leakingKeyCount === 0", f"Got {leaking_count}")
        
        samples = newline_check.get('samples', {})
        
        # Assertion 3: cp_41 (Select Call Mode)
        cp_41 = samples.get('cp_41', {})
        cp_41_literal = cp_41.get('literalBackslashN', -1)
        cp_41_real = cp_41.get('realNewlines', -1)
        if cp_41_literal == 0 and cp_41_real > 0:
            result.add_pass(f"cp_41.literalBackslashN === 0 AND realNewlines > 0 (literal={cp_41_literal}, real={cp_41_real})")
        else:
            result.add_fail("cp_41 newline check", f"literal={cp_41_literal}, real={cp_41_real}")
        
        # Assertion 4: wlt_9 (Transaction History)
        wlt_9 = samples.get('wlt_9', {})
        wlt_9_literal = wlt_9.get('literalBackslashN', -1)
        if wlt_9_literal == 0:
            result.add_pass(f"wlt_9.literalBackslashN === 0 (actual={wlt_9_literal})")
        else:
            result.add_fail("wlt_9.literalBackslashN === 0", f"Got {wlt_9_literal}")
        
        # Assertion 5: cp_76 (trial OTP)
        cp_76 = samples.get('cp_76', {})
        cp_76_literal = cp_76.get('literalBackslashN', -1)
        if cp_76_literal == 0:
            result.add_pass(f"cp_76.literalBackslashN === 0 (actual={cp_76_literal})")
        else:
            result.add_fail("cp_76.literalBackslashN === 0", f"Got {cp_76_literal}")
        
        # T4 ASSERTIONS: Quick IVR label
        print("\n[T4: Quick IVR Label Fix Verification]")
        
        # Assertion 6: t4Ok === true
        t4_ok = data.get('t4Ok')
        if t4_ok == True:
            result.add_pass("t4Ok === true")
        else:
            result.add_fail("t4Ok === true", f"Got {t4_ok}")
        
        quick_ivr_labels = data.get('quickIvrLabels', {})
        en_label = quick_ivr_labels.get('en', {})
        
        # Assertion 7: overPromises === false
        over_promises = en_label.get('overPromises')
        if over_promises == False:
            result.add_pass("quickIvrLabels.en.overPromises === false")
        else:
            result.add_fail("quickIvrLabels.en.overPromises === false", f"Got {over_promises}")
        
        # Assertion 8: label does NOT contain "1 Free"
        label_text = en_label.get('label', '')
        if '1 Free' not in label_text:
            result.add_pass(f"quickIvrLabels.en.label does NOT contain '1 Free' (label: '{label_text}')")
        else:
            result.add_fail("label does NOT contain '1 Free'", f"Found in: '{label_text}'")
        
        # T5 ASSERTIONS: Plan marketing consistency
        print("\n[T5: Plan Marketing Consistency Guard Verification]")
        
        # Assertion 9: planMarketingAudit.mismatchCount === 0
        plan_marketing = data.get('planMarketingAudit', {})
        mismatch_count = plan_marketing.get('mismatchCount', -1)
        if mismatch_count == 0:
            result.add_pass("planMarketingAudit.mismatchCount === 0 (advertised == enforced)")
        else:
            result.add_fail("planMarketingAudit.mismatchCount === 0", f"Got {mismatch_count}")
            # Show mismatches if any
            mismatches = plan_marketing.get('mismatches', [])
            if mismatches:
                print(f"\n  Mismatches found:")
                for m in mismatches[:3]:  # Show first 3
                    print(f"    - {m}")
        
    except requests.exceptions.RequestException as e:
        result.add_fail("Request", f"Error: {e}")
    except Exception as e:
        result.add_fail("Test execution", f"Error: {e}")


def test_otp_regression(result: TestResult):
    """
    TEST 2: Regression check - OTP plan gate fix must still hold
    """
    print("\n" + "="*80)
    print("TEST 2: OTP Plan Gate Regression Check")
    print("="*80)
    
    url = f"{BACKEND_URL}/api/dev/otp-plan-gate-check"
    print(f"\nGET {url}\n")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            result.add_fail("HTTP 200", f"Got {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return
        
        result.add_pass("HTTP 200")
        
        data = response.json()
        print(f"\nResponse preview:")
        print(json.dumps(data, indent=2)[:600])
        print("...\n")
        
        # Assertion 10: matrix.pro.otpCollection === true
        matrix = data.get('matrix', {})
        pro = matrix.get('pro', {})
        pro_otp = pro.get('otpCollection')
        if pro_otp == True:
            result.add_pass("matrix.pro.otpCollection === true")
        else:
            result.add_fail("matrix.pro.otpCollection === true", f"Got {pro_otp}")
        
        # Assertion 11: gateDecisions.pro.allowed === true
        gate_decisions = data.get('gateDecisions', {})
        pro_decision = gate_decisions.get('pro', {})
        pro_allowed = pro_decision.get('allowed')
        if pro_allowed == True:
            result.add_pass("gateDecisions.pro.allowed === true")
        else:
            result.add_fail("gateDecisions.pro.allowed === true", f"Got {pro_allowed}")
        
    except requests.exceptions.RequestException as e:
        result.add_fail("Request", f"Error: {e}")
    except Exception as e:
        result.add_fail("Test execution", f"Error: {e}")


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("NOMADLY TELEGRAM-BOT UX/TEXT FIX BATCH VERIFICATION")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Architecture: Node.js Express (port 5000) behind FastAPI proxy (port 8001)")
    print(f"BOT_ENVIRONMENT: development (dev routes live, no auth key needed)")
    print("\nFixes to verify:")
    print("  B1: ~100 language strings fixed (literal \\n → real newlines)")
    print("  T4: Quick IVR button '— 1 Free' promise removed")
    print("  T5: Plan marketing consistency guard added")
    print("  Regression: OTP plan gate fix must still hold")
    print("="*80)
    
    result = TestResult()
    
    # Run tests
    test_ux_fixes_audit(result)
    test_otp_regression(result)
    
    # Summary
    success = result.summary()
    
    if success:
        print("\n✅ ALL TESTS PASSED")
        print("\nVerified fixes:")
        print("  ✓ B1: No literal \\n leaks (cp_41, wlt_9, cp_76 all clean)")
        print("  ✓ T4: Quick IVR label no longer over-promises '1 Free'")
        print("  ✓ T5: Plan marketing consistency (advertised == enforced)")
        print("  ✓ Regression: OTP plan gate fix still holds")
        sys.exit(0)
    else:
        print("\n❌ SOME TESTS FAILED")
        sys.exit(1)


if __name__ == "__main__":
    main()
