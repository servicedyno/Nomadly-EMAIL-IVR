#!/usr/bin/env python3
"""
Node.js Hosting Plan Addon Domain Limits Implementation Test
Verifies the 5 specific requirements for tiered hosting plans.
"""

import os
import json
import time
import requests
from typing import Dict, Any, List, Optional, Tuple

class HostingPlanTestValidator:
    def __init__(self):
        self.base_url = "http://localhost:5000"
        self.results = {
            "health_check": {"passed": False, "details": {}},
            "whm_service_config": {"passed": False, "details": {}},
            "cpanel_routes_limits": {"passed": False, "details": {}},
            "language_config": {"passed": False, "details": {}},
            "index_upgrade_flow": {"passed": False, "details": {}}
        }
        
    def test_1_health_endpoint(self) -> bool:
        """Test 1: GET /health returns 200 and nodejs.err.log is empty"""
        try:
            print("🔍 Testing 1: Health endpoint and error logs...")
            
            # Test health endpoint
            response = requests.get(f"{self.base_url}/health", timeout=10)
            health_passed = response.status_code == 200
            health_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            
            # Check error log is empty
            error_log_size = 0
            try:
                if os.path.exists('/var/log/supervisor/nodejs.err.log'):
                    error_log_size = os.path.getsize('/var/log/supervisor/nodejs.err.log')
            except Exception as e:
                print(f"   ⚠️ Could not check error log: {e}")
            
            log_passed = error_log_size == 0
            
            self.results["health_check"]["passed"] = health_passed and log_passed
            self.results["health_check"]["details"] = {
                "status_code": response.status_code,
                "response": health_data,
                "error_log_bytes": error_log_size,
                "error_log_empty": log_passed
            }
            
            if health_passed and log_passed:
                print("   ✅ Health endpoint OK (200) and error log is empty")
                return True
            else:
                print(f"   ❌ Health failed: status={response.status_code}, error_log_size={error_log_size}")
                return False
                
        except Exception as e:
            print(f"   ❌ Health check failed: {e}")
            self.results["health_check"]["details"]["error"] = str(e)
            return False

    def test_2_whm_service_config(self) -> bool:
        """Test 2: Verify PLAN_ADDON_LIMITS in whm-service.js"""
        try:
            print("🔍 Testing 2: WHM service configuration...")
            
            whm_service_path = "/app/js/whm-service.js"
            if not os.path.exists(whm_service_path):
                print(f"   ❌ File not found: {whm_service_path}")
                return False
            
            with open(whm_service_path, 'r') as f:
                content = f.read()
            
            # Check PLAN_ADDON_LIMITS exists and has correct values
            config_found = "PLAN_ADDON_LIMITS" in content
            weekly_limit = "'Premium-Anti-Red-1-Week': 1" in content
            premium_limit = "'Premium-Anti-Red-HostPanel-1-Month': 5" in content
            golden_unlimited = "'Golden-Anti-Red-HostPanel-1-Month': -1" in content
            
            # Check createAccount uses PLAN_ADDON_LIMITS (not hardcoded unlimited)
            create_account_uses_limits = "PLAN_ADDON_LIMITS[pkg] === -1 ? 'unlimited' : PLAN_ADDON_LIMITS[pkg]" in content
            
            # Check getAddonLimit function is exported
            get_addon_limit_exported = "getAddonLimit," in content
            
            all_checks = config_found and weekly_limit and premium_limit and golden_unlimited and create_account_uses_limits and get_addon_limit_exported
            
            self.results["whm_service_config"]["passed"] = all_checks
            self.results["whm_service_config"]["details"] = {
                "PLAN_ADDON_LIMITS_found": config_found,
                "weekly_1_addon": weekly_limit,
                "premium_5_addons": premium_limit,
                "golden_unlimited": golden_unlimited,
                "createAccount_uses_limits": create_account_uses_limits,
                "getAddonLimit_exported": get_addon_limit_exported
            }
            
            if all_checks:
                print("   ✅ WHM service config correct: limits defined and used properly")
                return True
            else:
                print(f"   ❌ WHM service config issues found")
                return False
                
        except Exception as e:
            print(f"   ❌ WHM service config test failed: {e}")
            self.results["whm_service_config"]["details"]["error"] = str(e)
            return False

    def test_3_cpanel_routes_enforcement(self) -> bool:
        """Test 3: Verify addon domain limit enforcement in cpanel-routes.js"""
        try:
            print("🔍 Testing 3: cPanel routes addon domain limit enforcement...")
            
            cpanel_routes_path = "/app/js/cpanel-routes.js"
            if not os.path.exists(cpanel_routes_path):
                print(f"   ❌ File not found: {cpanel_routes_path}")
                return False
            
            with open(cpanel_routes_path, 'r') as f:
                content = f.read()
            
            # Check /domains/add route has limit enforcement
            add_route_has_limits = "getAddonLimit" in content and "router.post('/domains/add'" in content
            limit_check_code = "currentAddons >= limit" in content
            returns_403 = "res.status(403)" in content
            upgrade_message = "Upgrade to a monthly plan for more domains" in content or "use the Upgrade Plan button" in content
            
            # Check /domains/add-enhanced also has the same enforcement
            enhanced_route_limits = "router.post('/domains/add-enhanced'" in content and content.count("getAddonLimit") >= 2
            
            all_checks = add_route_has_limits and limit_check_code and returns_403 and upgrade_message and enhanced_route_limits
            
            self.results["cpanel_routes_limits"]["passed"] = all_checks
            self.results["cpanel_routes_limits"]["details"] = {
                "add_route_has_getAddonLimit": add_route_has_limits,
                "limit_check_logic": limit_check_code,
                "returns_403_status": returns_403,
                "upgrade_message_present": upgrade_message,
                "enhanced_route_also_enforces": enhanced_route_limits
            }
            
            if all_checks:
                print("   ✅ cPanel routes properly enforce addon domain limits")
                return True
            else:
                print(f"   ❌ cPanel routes limit enforcement issues found")
                return False
                
        except Exception as e:
            print(f"   ❌ cPanel routes test failed: {e}")
            self.results["cpanel_routes_limits"]["details"]["error"] = str(e)
            return False

    def test_4_language_configuration(self) -> bool:
        """Test 4: Verify language configuration for domain descriptions"""
        try:
            print("🔍 Testing 4: Language configuration for hosting plans...")
            
            lang_en_path = "/app/js/lang/en.js"
            if not os.path.exists(lang_en_path):
                print(f"   ❌ File not found: {lang_en_path}")
                return False
            
            with open(lang_en_path, 'r') as f:
                content = f.read()
            
            # Check for specific domain descriptions
            weekly_1_domain = "domains: '1 addon domain'" in content
            premium_5_domains = "domains: 'Up to 5 addon domains'" in content  
            golden_unlimited_domains = "domains: 'Unlimited domains'" in content
            upgrade_button = "upgradeHostingPlan: '⬆️ Upgrade Plan'" in content
            
            all_checks = weekly_1_domain and premium_5_domains and golden_unlimited_domains and upgrade_button
            
            self.results["language_config"]["passed"] = all_checks
            self.results["language_config"]["details"] = {
                "premiumWeekly_1_addon": weekly_1_domain,
                "premiumCpanel_5_addons": premium_5_domains,
                "goldenCpanel_unlimited": golden_unlimited_domains,
                "upgradeHostingPlan_button": upgrade_button
            }
            
            if all_checks:
                print("   ✅ Language config correct: proper domain descriptions and upgrade button")
                return True
            else:
                print(f"   ❌ Language configuration issues found")
                return False
                
        except Exception as e:
            print(f"   ❌ Language config test failed: {e}")
            self.results["language_config"]["details"]["error"] = str(e)
            return False

    def test_5_upgrade_flow_implementation(self) -> bool:
        """Test 5: Verify hosting plan upgrade flow in _index.js"""
        try:
            print("🔍 Testing 5: Hosting plan upgrade flow implementation...")
            
            index_path = "/app/js/_index.js"
            if not os.path.exists(index_path):
                print(f"   ❌ File not found: {index_path}")
                return False
            
            with open(index_path, 'r') as f:
                content = f.read()
            
            # Check viewHostingPlanDetails has upgrade button for weekly plans
            view_function_exists = "viewHostingPlanDetails: async (domain)" in content
            weekly_upgrade_button = "if (isWeekly) buttons.push([user.upgradeHostingPlan])" in content
            
            # Check confirmUpgradeHosting action constant
            confirm_action_constant = "confirmUpgradeHosting: 'confirmUpgradeHosting'" in content
            
            # Check upgrade flow has wallet charge
            upgrade_wallet_charge = "if (action === a.confirmUpgradeHosting)" in content
            whm_change_package = "changePackage" in content and "whm." in content
            cpanel_accounts_update = content.count("cpanelAccounts") > 0
            auto_refund_logic = "refund" in content.lower() and "atomicIncrement" in content
            
            all_checks = (view_function_exists and weekly_upgrade_button and 
                         confirm_action_constant and upgrade_wallet_charge and 
                         whm_change_package and cpanel_accounts_update and auto_refund_logic)
            
            self.results["index_upgrade_flow"]["passed"] = all_checks
            self.results["index_upgrade_flow"]["details"] = {
                "viewHostingPlanDetails_exists": view_function_exists,
                "weekly_shows_upgrade_button": weekly_upgrade_button,
                "confirmUpgradeHosting_action": confirm_action_constant,
                "upgrade_wallet_charge": upgrade_wallet_charge,
                "whm_changePackage_call": whm_change_package,
                "cpanelAccounts_update": cpanel_accounts_update,
                "auto_refund_on_failure": auto_refund_logic
            }
            
            if all_checks:
                print("   ✅ Upgrade flow properly implemented with wallet + WHM + auto-refund")
                return True
            else:
                print(f"   ❌ Upgrade flow implementation issues found")
                return False
                
        except Exception as e:
            print(f"   ❌ Upgrade flow test failed: {e}")
            self.results["index_upgrade_flow"]["details"]["error"] = str(e)
            return False

    def run_all_tests(self) -> dict:
        """Run all 5 tests and return comprehensive results"""
        print("🚀 Starting Hosting Plan Addon Domain Limits Verification...")
        print("=" * 70)
        
        test_methods = [
            self.test_1_health_endpoint,
            self.test_2_whm_service_config, 
            self.test_3_cpanel_routes_enforcement,
            self.test_4_language_configuration,
            self.test_5_upgrade_flow_implementation
        ]
        
        passed_count = 0
        total_count = len(test_methods)
        
        for i, test_method in enumerate(test_methods, 1):
            try:
                result = test_method()
                if result:
                    passed_count += 1
                print()  # Add spacing between tests
            except Exception as e:
                print(f"   ❌ Test {i} failed with exception: {e}")
                print()
        
        print("=" * 70)
        print(f"🎯 SUMMARY: {passed_count}/{total_count} tests passed")
        
        if passed_count == total_count:
            print("✅ ALL TESTS PASSED - Hosting plan addon domain limits properly implemented!")
        else:
            print("❌ SOME TESTS FAILED - Issues found in implementation")
        
        return {
            "summary": {
                "total_tests": total_count,
                "passed_tests": passed_count,
                "success_rate": f"{(passed_count/total_count)*100:.1f}%",
                "overall_status": "PASS" if passed_count == total_count else "FAIL"
            },
            "detailed_results": self.results
        }

def main():
    """Main test execution"""
    validator = HostingPlanTestValidator()
    results = validator.run_all_tests()
    
    # Write results to file for reference
    try:
        with open('/app/hosting_plan_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n📄 Detailed results saved to: /app/hosting_plan_test_results.json")
    except Exception as e:
        print(f"⚠️ Could not save results file: {e}")
    
    # Exit with appropriate code
    exit_code = 0 if results["summary"]["overall_status"] == "PASS" else 1
    return exit_code

if __name__ == "__main__":
    exit(main())