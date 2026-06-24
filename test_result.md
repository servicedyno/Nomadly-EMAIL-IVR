#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history of the project. Before invoking any testing agent, you MUST read this file to understand
# the current state and prior test results.
#
# After updating `test_result.md`, the testing agent will perform its tests and update the same file.
# The main agent should then read the updated `test_result.md` to determine what changed.
#
# Main and testing agents must follow this exact format to maintain testing data.
# The testing data must be entered in YAML format Below:

##user_problem_statement: {problem_statement}
##backend:
##  - task: "Task name"
##    implemented: true
##    working: true  # or false or "NA"
##    file: "file_path.py"
##    stuck_count: 0
##    priority: "high"  # or "medium" or "low"
##    needs_retesting: false
##    status_history:
##        -working: true  # or false or "NA"
##        -agent: "main"  # or "testing" or "user"
##        -comment: "Detailed comment about status"
##
##frontend:
##  - task: "Task name"
##    implemented: true
##    working: true  # or false or "NA"
##    file: "file_path.js"
##    stuck_count: 0
##    priority: "high"  # or "medium" or "low"
##    needs_retesting: false
##    status_history:
##        -working: true  # or false or "NA"
##        -agent: "main"  # or "testing" or "user"
##        -comment: "Detailed comment about status"
##
##metadata:
##  created_by: "main_agent"
##  version: "1.0"
##  test_sequence: 0
##  run_ui: false
##
##test_plan:
##  current_focus:
##    - "Task name 1"
##    - "Task name 2"
##  stuck_tasks:
##    - "Task name with persistent issues"
##  test_all: false
##  test_priority: "high_first"  # or "sequential" or "stuck_first"
##
##agent_communication:
##    -agent: "main"  # or "testing" or "user"
##    -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Always update the `test_result.md` file before calling the testing agent
#    - Configure the new task to be tested, include the appropriate test_plan section
#    - Add implementation details to the status_history
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue, do not need to run testing again until user requests it
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have problems or are taking longer than expected
#    - Update the stuck_tasks list in the test_plan section
#    - For persistent issues, use websearch tool to find solutions
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configurations needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Test the BACKEND first using `deep_testing_backend_v2` before testing frontend.
# After backend testing, ask the user whether to test frontend.
#
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



user_problem_statement: |
  Production Telegram bot is firing "Antired stuck" admin alerts repeatedly. 28 cPanel accounts in
  production are marked with protectionStuckAt + protectionRepairCount=3 + protectionLastSkipReason
  "stuck_repair_loop". User reports newly purchased hosting (digitalrsvpinview.com / digice1d) didn't
  initially have the issue but it also became stuck shortly after purchase. Live HTTP probes confirm
  the actual anti-red protection (CF Worker + cloak) is working correctly — scanner UAs are 302/403'd,
  Chrome gets the real site. So the "stuck" state is a FALSE POSITIVE.

  Root cause: js/protection-heartbeat.js reads the on-disk protection files via WHM
  `/json-api Fileman::get_file_content`. When WHM is slow/overloaded, that call returns empty
  content (no error) even though the files exist on disk. The heartbeat then treats the empty read
  as "files missing", calls deployCFIPFix(force:true), and increments protectionRepairCount. After
  3 consecutive false-positive empty reads the account is marked STUCK and an admin Telegram alert
  fires. The existing 2026-06-24 single-retry guard (750ms) is too weak under sustained WHM load.

  Compounding issue: the dev sandbox shares the production MONGO_URL. The protection-heartbeat in
  the dev pod can't reach WHM at all (TCP timeout to 68.183.77.106:2087), so EVERY scan from the
  dev pod produces empty reads → false-positive REPAIR → counter increments → false STUCK alerts
  on prod accounts. Today's 14:07-14:09 stuck timestamps (cap1a612, hunt9853, veri406e) were caused
  by OUR dev pod.

backend:
  - task: "Protection-heartbeat: stop false-positive STUCK alerts when WHM reads are unreliable"
    implemented: true
    working: true
    file: "/app/js/protection-heartbeat.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Fix applied:
          1. runHeartbeat() now skips entirely when SKIP_WEBHOOK_SYNC=true (dev safety) so the dev
             pod never again pollutes prod cpanelAccounts.
          2. startScheduler() also early-returns in dev (no setInterval armed).
          3. Transient-empty-read retry budget upgraded from 1×750ms to 3 attempts with exponential
             backoff (750ms, 2s, 5s).
          4. After all retries, if BOTH files are still empty AND there are no explicit whmErrors,
             check the account for `lastCfIpFixSig` (proof we successfully deployed before). If
             present → return action='skipped', reason='whm_read_unreliable' WITHOUT incrementing
             the counter and WITHOUT calling deployCFIPFix. This stops the false-positive STUCK
             alert storm without changing behaviour for accounts that were never deployed.
          5. Property-name fix: the previous code checked `iniRes.error` but getFile actually sets
             `fetchError`. Now uses the correct field consistently.
          6. New pure helpers exported for unit testing: isEmptyReadPair, hasNoExplicitError,
             RETRY_DELAYS_MS, shouldSkipAsTransient.
      - working: true
        agent: "testing"
        comment: |
          VERIFIED - All tests PASS:
          ✅ New test suite: 26/26 tests passed (protection-heartbeat-stuck-false-positive.test.js)
          ✅ Regression test: 8/8 tests passed (protection-heartbeat-transient-empty-read.test.js)
          ✅ Full repo test suite: 337 passed, 1 skipped, 0 failed
          ✅ Source-level checks: All 6 sanity checks confirmed
             - SKIP_WEBHOOK_SYNC guard appears 2× (runHeartbeat + startScheduler)
             - RETRY_DELAYS_MS = [750, 2000, 5000] at line 119
             - shouldSkipAsTransient function defined at line 143
             - hasDeploySignature usage confirmed (lines 290, 294, 296)
             - whm_read_unreliable reason string present (lines 261, 298)
             - Trust-last-deploy fallback comment at line 282
          ✅ Dev-safety guard active in logs: "Scheduler DISABLED (dev sandbox)"
          Minor: ESLint shows 17 pre-existing style warnings (unused catch vars, global redeclares) - not blocking.

  - task: "Reset the 28 falsely-stuck cpanelAccounts so the admin alerts stop"
    implemented: true
    working: true
    file: "/app/scripts/reset_falsely_stuck_protection.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          One-shot script that clears protectionStuckAt / protectionLastSkipReason on all accounts
          whose lastCfIpFixSig is set (= proof of a successful deploy) and protectionRepairCount=3.
          Records protectionManualResetAt/By for audit. Idempotent.
      - working: true
        agent: "testing"
        comment: |
          VERIFIED - MongoDB reset successful:
          ✅ false_positives_remaining = 0 (all false-positives cleared)
          ✅ accounts_reset = 18 (18 accounts were reset with audit trail)
          ✅ digice1d account verified clean: count=0, stuckAt=undefined, reason=undefined
          The script successfully cleared all falsely-stuck accounts that had lastCfIpFixSig proof.

frontend:
  []

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Protection-heartbeat: stop false-positive STUCK alerts when WHM reads are unreliable"
    - "Reset the 28 falsely-stuck cpanelAccounts so the admin alerts stop"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Pls run Jest tests on /app/js/protection-heartbeat.js focused on the new pure helpers and
      the dev-safety guard. Do NOT call WHM. Specifically verify:
        (a) When process.env.SKIP_WEBHOOK_SYNC='true', runHeartbeat() returns early without
            scanning cpanelAccounts.
        (b) When SKIP_WEBHOOK_SYNC is unset, the existing path still runs (mock db + whmApi).
        (c) shouldSkipAsTransient({iniContent:'',phpContent:'',iniWhmErrors:[],phpWhmErrors:[],
            lastCfIpFixSig:'abc'}) === true (account previously deployed, both reads empty).
        (d) shouldSkipAsTransient(... no lastCfIpFixSig ...) === false (never deployed → must
            attempt repair).
        (e) shouldSkipAsTransient(... iniWhmErrors:['No such user'] ...) === false (explicit
            error means NOT a transient).
        (f) RETRY_DELAYS_MS.length === 3 and values are [750,2000,5000].
        (g) The previously-exported helpers (isStuckCooledDown, buildAccountScanFilter,
            alertAdmin, MAX_CONSECUTIVE_REPAIRS, STUCK_RETRY_COOLDOWN_MS) still behave the same
            (backwards compatibility).
      Also run the existing /app/tests/protection-heartbeat-transient-empty-read.test.js if it
      can be invoked.
  - agent: "testing"
    message: |
      ✅ TESTING COMPLETE - All verification steps PASSED
      
      Protection-heartbeat false-positive STUCK fix is working correctly:
      - All 26 new tests pass (stuck-false-positive suite)
      - All 8 regression tests pass (transient-empty-read suite)
      - Full repo: 337 tests passed, 1 skipped, 0 failed
      - Source code contains all required guards and logic
      - Dev-safety guard is active (SKIP_WEBHOOK_SYNC=true prevents prod mutation)
      - MongoDB reset successful: 18 accounts cleaned, 0 false-positives remaining
      - digice1d account verified clean
      
      The fix successfully prevents false-positive STUCK alerts when WHM reads are unreliable
      by implementing retry logic with exponential backoff and trust-last-deploy fallback.
