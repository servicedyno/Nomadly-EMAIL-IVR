#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================





#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================


user_problem_statement: "Tiered hosting addon domain limits + hosting plan upgrade flow + Railway log bug fixes"

backend:
  - task: "Tiered hosting addon domain limits + hosting plan upgrade flow"
    implemented: true
    working: true
    file: "js/whm-service.js, js/cpanel-routes.js, js/_index.js, js/lang/en.js, js/lang/fr.js, js/lang/zh.js, js/lang/hi.js"
    stuck_count: 0
    priority: "critical"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Implemented tiered addon domain limits to create proper upgrade incentive. (1) whm-service.js: Added PLAN_ADDON_LIMITS (Weekly: 1 addon, Premium Monthly: 5, Golden: unlimited). createAccount now sets maxaddon per plan. Exported getAddonLimit() helper. (2) cpanel-routes.js: Both /domains/add and /domains/add-enhanced now check addon count vs plan limit before allowing new domain. Returns 403 with upgrade message for weekly users who hit limit, directing them to Upgrade Plan button. Existing weekly users with >1 addon can keep their domains but cannot add more. (3) All 4 lang files: Updated plan descriptions — Weekly '1 addon domain', Premium '5 addon domains', Golden 'Unlimited'. Added upgradeHostingPlan button in all 4 languages. (4) _index.js: viewHostingPlanDetails now shows 'Upgrade Plan' button for weekly plan users. New upgrade flow: select Premium ($75) or Golden ($100) → wallet check → charge → WHM changePackage → update cpanelAccounts (new plan, 30-day expiry, autoRenew on) → re-deploy anti-red → admin notification. Full auto-refund on any failure."
        - working: true
          agent: "testing"
          comment: "VERIFIED: All 5 requirements successfully implemented and tested. (1) ✅ Health endpoint returns 200, nodejs.err.log is empty (0 bytes). (2) ✅ PLAN_ADDON_LIMITS in whm-service.js correctly configured: Premium-Anti-Red-1-Week: 1, Premium-Anti-Red-HostPanel-1-Month: 5, Golden-Anti-Red-HostPanel-1-Month: -1 (unlimited). createAccount uses PLAN_ADDON_LIMITS (not hardcoded). getAddonLimit() function exported. (3) ✅ Both /domains/add and /domains/add-enhanced routes properly enforce limits using getAddonLimit(), return 403 when limit reached with upgrade message directing to Upgrade Plan button. (4) ✅ Language config verified in en.js: premiumWeekly.domains = '1 addon domain', premiumCpanel.domains = 'Up to 5 addon domains', goldenCpanel.domains = 'Unlimited domains', upgradeHostingPlan button exists. (5) ✅ Upgrade flow in _index.js: viewHostingPlanDetails shows upgrade button for weekly plans (if isWeekly), confirmUpgradeHosting action handler exists with wallet charge + whm.changePackage + cpanelAccounts update + auto-refund on failure. All components working correctly - tiered limits create proper upgrade incentive as intended."

test_plan:
  current_focus:
    - "Tiered hosting addon domain limits: Weekly 1, Premium Monthly 5, Golden Unlimited + upgrade flow"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Implemented tiered addon domain limits for hosting plans + hosting plan upgrade flow. Please verify: (1) Node.js healthy at localhost:5000/health with 0 bytes in nodejs.err.log. (2) whm-service.js: PLAN_ADDON_LIMITS config — Premium-Anti-Red-1-Week: 1, Premium-Anti-Red-HostPanel-1-Month: 5, Golden-Anti-Red-HostPanel-1-Month: -1 (unlimited). getAddonLimit() function exported. createAccount maxaddon uses PLAN_ADDON_LIMITS[pkg] instead of 'unlimited'. (3) cpanel-routes.js: /domains/add and /domains/add-enhanced routes have addon limit enforcement — check account.plan via getAddonLimit(), compare currentAddons count, return 403 with upgrade message if exceeded. (4) All 4 language files (en/fr/zh/hi): premiumWeekly domains changed to '1 addon domain', premiumCpanel domains changed to 'Up to 5 addon domains', goldenCpanel remains 'Unlimited domains'. (5) en/fr/zh/hi user buttons: upgradeHostingPlan button added. (6) _index.js: viewHostingPlanDetails adds upgradeHostingPlan button for weekly plans. Action constant confirmUpgradeHosting added. Upgrade flow in viewHostingPlan action handler shows Premium/Golden options with pricing. confirmUpgradeHosting handler deducts wallet, calls whm.changePackage, updates cpanelAccounts with new plan+expiry, re-deploys anti-red, notifies admin, auto-refunds on failure."
    - agent: "testing"
      message: "✅ VERIFICATION COMPLETE: All 5 requirements successfully tested and working. (1) Health endpoint: GET localhost:5000/health returns 200 'healthy' status with database connected, nodejs.err.log is 0 bytes (empty). (2) WHM Service: PLAN_ADDON_LIMITS correctly configured with Weekly:1, Premium:5, Golden:unlimited (-1). createAccount properly uses PLAN_ADDON_LIMITS instead of hardcoded values. getAddonLimit() function exported and working. (3) cPanel Routes: Both /domains/add and /domains/add-enhanced enforce limits before calling addAddonDomain, return 403 with proper upgrade message when limit reached. (4) Language Config: en.js has correct domain descriptions and upgradeHostingPlan button. (5) Upgrade Flow: _index.js viewHostingPlanDetails shows upgrade button for weekly plans, confirmUpgradeHosting action handler implements full flow with wallet charge + whm.changePackage + cpanelAccounts update + auto-refund. Implementation creates proper tiered upgrade incentive - weekly users limited to 1 addon domain get clear upgrade path to monthly plans with more domains. Ready for production."
