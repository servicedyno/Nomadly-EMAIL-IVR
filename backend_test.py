#!/usr/bin/env python3
"""
Backend test for T4 Quick IVR "1 Free" label dynamic eligibility fix + regression checks.

Tests the corrected implementation where:
- Eligible new users (no active phone number, haven't used free trial) see "📢 Quick IVR Call — 1 Free"
- Subscribers and users who already used the trial see "📢 Quick IVR Call" (neutral, no "1 Free")
"""

import requests
import sys
import os

# Get backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://f06fe503-30a9-4c4e-a049-cc26f354ea86.preview.emergentagent.com')

def test_ux_fixes_audit():
    """
    TEST 1: Verify the corrected T4 Quick IVR label fix (dynamic eligibility-based)
    plus B1 (newline fix) and T5 (plan marketing consistency).
    """
    print("\n" + "="*80)
    print("TEST 1: UX FIXES AUDIT (T4 revised - dynamic eligibility)")
    print("="*80)
    
    url = f"{BACKEND_URL}/api/dev/ux-fixes-audit"
    print(f"\nGET {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected HTTP 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response received (keys: {list(data.keys())})")
        
        # Track all assertions
        assertions = []
        
        # Assert: ok === true
        ok_check = data.get('ok') == True
        assertions.append(('ok === true', ok_check))
        print(f"\n✅ ok === true" if ok_check else f"\n❌ ok === {data.get('ok')}")
        
        # B1: Newline checks
        newline_check = data.get('newlineCheck', {})
        leaking_count = newline_check.get('leakingKeyCount', -1)
        leaking_ok = leaking_count == 0
        assertions.append(('newlineCheck.leakingKeyCount === 0', leaking_ok))
        print(f"✅ newlineCheck.leakingKeyCount === 0" if leaking_ok else f"❌ newlineCheck.leakingKeyCount === {leaking_count}")
        
        # Sample checks
        samples = newline_check.get('samples', {})
        
        cp_41 = samples.get('cp_41', {})
        cp_41_ok = cp_41.get('literalBackslashN', -1) == 0
        assertions.append(('newlineCheck.samples.cp_41.literalBackslashN === 0', cp_41_ok))
        print(f"✅ newlineCheck.samples.cp_41.literalBackslashN === 0" if cp_41_ok else f"❌ cp_41.literalBackslashN === {cp_41.get('literalBackslashN')}")
        
        wlt_9 = samples.get('wlt_9', {})
        wlt_9_ok = wlt_9.get('literalBackslashN', -1) == 0
        assertions.append(('newlineCheck.samples.wlt_9.literalBackslashN === 0', wlt_9_ok))
        print(f"✅ newlineCheck.samples.wlt_9.literalBackslashN === 0" if wlt_9_ok else f"❌ wlt_9.literalBackslashN === {wlt_9.get('literalBackslashN')}")
        
        cp_76 = samples.get('cp_76', {})
        cp_76_ok = cp_76.get('literalBackslashN', -1) == 0
        assertions.append(('newlineCheck.samples.cp_76.literalBackslashN === 0', cp_76_ok))
        print(f"✅ newlineCheck.samples.cp_76.literalBackslashN === 0" if cp_76_ok else f"❌ cp_76.literalBackslashN === {cp_76.get('literalBackslashN')}")
        
        # T4: Quick IVR label checks (REVISED - dynamic eligibility)
        t4_ok = data.get('t4Ok') == True
        assertions.append(('t4Ok === true', t4_ok))
        print(f"\n✅ t4Ok === true" if t4_ok else f"\n❌ t4Ok === {data.get('t4Ok')}")
        
        quick_ivr_labels = data.get('quickIvrLabels', {})
        en_labels = quick_ivr_labels.get('en', {})
        
        # Base label should NOT over-promise (no "1 Free")
        base_over_promises = en_labels.get('baseOverPromises', True)
        base_ok = base_over_promises == False
        assertions.append(('quickIvrLabels.en.baseOverPromises === false', base_ok))
        print(f"✅ quickIvrLabels.en.baseOverPromises === false" if base_ok else f"❌ quickIvrLabels.en.baseOverPromises === {base_over_promises}")
        
        # Trial label SHOULD have the free hook
        trial_has_free_hook = en_labels.get('trialHasFreeHook', False)
        trial_hook_ok = trial_has_free_hook == True
        assertions.append(('quickIvrLabels.en.trialHasFreeHook === true', trial_hook_ok))
        print(f"✅ quickIvrLabels.en.trialHasFreeHook === true" if trial_hook_ok else f"❌ quickIvrLabels.en.trialHasFreeHook === {trial_has_free_hook}")
        
        # Trial label should contain "1 Free"
        trial_label = en_labels.get('trial', '')
        trial_contains_free = '1 Free' in trial_label
        assertions.append(('quickIvrLabels.en.trial contains "1 Free"', trial_contains_free))
        print(f"✅ quickIvrLabels.en.trial contains '1 Free': \"{trial_label}\"" if trial_contains_free else f"❌ quickIvrLabels.en.trial does NOT contain '1 Free': \"{trial_label}\"")
        
        # Base label should NOT contain "1 Free"
        base_label = en_labels.get('base', '')
        base_no_free = '1 Free' not in base_label
        assertions.append(('quickIvrLabels.en.base does NOT contain "1 Free"', base_no_free))
        print(f"✅ quickIvrLabels.en.base does NOT contain '1 Free': \"{base_label}\"" if base_no_free else f"❌ quickIvrLabels.en.base contains '1 Free': \"{base_label}\"")
        
        # Label decisions (dynamic eligibility)
        label_decisions = data.get('labelDecisions', {})
        
        new_user_decision = label_decisions.get('newUser', '')
        new_user_ok = new_user_decision == 'trial'
        assertions.append(('labelDecisions.newUser === "trial"', new_user_ok))
        print(f"\n✅ labelDecisions.newUser === 'trial' (eligible new user sees the '1 Free' hook)" if new_user_ok else f"\n❌ labelDecisions.newUser === '{new_user_decision}'")
        
        used_trial_decision = label_decisions.get('usedTrial', '')
        used_trial_ok = used_trial_decision == 'base'
        assertions.append(('labelDecisions.usedTrial === "base"', used_trial_ok))
        print(f"✅ labelDecisions.usedTrial === 'base'" if used_trial_ok else f"❌ labelDecisions.usedTrial === '{used_trial_decision}'")
        
        subscriber_decision = label_decisions.get('subscriber', '')
        subscriber_ok = subscriber_decision == 'base'
        assertions.append(('labelDecisions.subscriber === "base"', subscriber_ok))
        print(f"✅ labelDecisions.subscriber === 'base'" if subscriber_ok else f"❌ labelDecisions.subscriber === '{subscriber_decision}'")
        
        # T5: Plan marketing consistency
        plan_marketing = data.get('planMarketingAudit', {})
        mismatch_count = plan_marketing.get('mismatchCount', -1)
        plan_ok = mismatch_count == 0
        assertions.append(('planMarketingAudit.mismatchCount === 0', plan_ok))
        print(f"\n✅ planMarketingAudit.mismatchCount === 0 (advertised == enforced)" if plan_ok else f"\n❌ planMarketingAudit.mismatchCount === {mismatch_count}")
        
        # Summary
        passed = sum(1 for _, result in assertions if result)
        total = len(assertions)
        print(f"\n{'='*80}")
        print(f"TEST 1 SUMMARY: {passed}/{total} assertions passed")
        print(f"{'='*80}")
        
        if passed == total:
            print("✅ TEST 1 PASSED - All assertions verified")
            return True
        else:
            print("❌ TEST 1 FAILED - Some assertions failed")
            for assertion, result in assertions:
                if not result:
                    print(f"  ❌ {assertion}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request error: {e}")
        return False
    except Exception as e:
        print(f"❌ FAIL: Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_otp_plan_gate_regression():
    """
    TEST 2: Regression check - verify OTP plan gate fix still holds
    """
    print("\n" + "="*80)
    print("TEST 2: OTP PLAN GATE REGRESSION CHECK")
    print("="*80)
    
    url = f"{BACKEND_URL}/api/dev/otp-plan-gate-check"
    print(f"\nGET {url}")
    
    try:
        response = requests.get(url, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected HTTP 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response received (keys: {list(data.keys())})")
        
        # Track assertions
        assertions = []
        
        # Assert: matrix.pro.otpCollection === true
        matrix = data.get('matrix', {})
        pro = matrix.get('pro', {})
        otp_collection = pro.get('otpCollection', False)
        otp_ok = otp_collection == True
        assertions.append(('matrix.pro.otpCollection === true', otp_ok))
        print(f"\n✅ matrix.pro.otpCollection === true" if otp_ok else f"\n❌ matrix.pro.otpCollection === {otp_collection}")
        
        # Assert: gateDecisions.pro.allowed === true
        gate_decisions = data.get('gateDecisions', {})
        pro_decision = gate_decisions.get('pro', {})
        allowed = pro_decision.get('allowed', False)
        allowed_ok = allowed == True
        assertions.append(('gateDecisions.pro.allowed === true', allowed_ok))
        print(f"✅ gateDecisions.pro.allowed === true" if allowed_ok else f"❌ gateDecisions.pro.allowed === {allowed}")
        
        # Summary
        passed = sum(1 for _, result in assertions if result)
        total = len(assertions)
        print(f"\n{'='*80}")
        print(f"TEST 2 SUMMARY: {passed}/{total} assertions passed")
        print(f"{'='*80}")
        
        if passed == total:
            print("✅ TEST 2 PASSED - Regression check verified")
            return True
        else:
            print("❌ TEST 2 FAILED - Regression check failed")
            for assertion, result in assertions:
                if not result:
                    print(f"  ❌ {assertion}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request error: {e}")
        return False
    except Exception as e:
        print(f"❌ FAIL: Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND TEST: T4 Quick IVR '1 Free' Label - Dynamic Eligibility Fix")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Architecture: Node.js Express bot (port 5000) behind FastAPI proxy (port 8001)")
    print(f"BOT_ENVIRONMENT=development (read-only /dev/* routes are live, no auth key needed)")
    
    results = []
    
    # Run TEST 1: UX fixes audit (T4 revised + B1 + T5)
    test1_passed = test_ux_fixes_audit()
    results.append(('TEST 1: UX Fixes Audit (T4 revised)', test1_passed))
    
    # Run TEST 2: OTP plan gate regression
    test2_passed = test_otp_plan_gate_regression()
    results.append(('TEST 2: OTP Plan Gate Regression', test2_passed))
    
    # Final summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(passed for _, passed in results)
    
    if all_passed:
        print("\n✅ ALL TESTS PASSED")
        print("\nKEY VERIFICATION:")
        print("  • T4 Quick IVR label is now DYNAMIC/eligibility-based:")
        print("    - Eligible new users see '📢 Quick IVR Call — 1 Free'")
        print("    - Subscribers and users who used trial see '📢 Quick IVR Call' (neutral)")
        print("  • B1 newline fix still holds (no literal \\n leaks)")
        print("  • T5 plan marketing consistency still holds (advertised == enforced)")
        print("  • OTP plan gate fix still holds (Pro users can access OTP Collection)")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED")
        return 1


if __name__ == '__main__':
    sys.exit(main())
