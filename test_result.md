#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================
# Communication Protocol: main agent delegates testing to testing_agent. Read this file before
# invoking any testing agent. Testing agent updates this file after running.
# IMPORTANT: Test the BACKEND first using `deep_testing_backend_v2` before testing frontend.
#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



user_problem_statement: |
  PROD bug: existing users could not MANAGE their Contabo VPS, and @davion419 (chatId 404562920)
  paid for a Windows RDP that never provisioned. RCA: the Contabo account (hosting@dyno.pt) was
  reset during the 2026-06 vendor-block, so 10 of 15 Contabo VPS records now 404 (instances gone).
  Remediation chosen by operator: re-provision @davion419 ONE Windows RDP on Azure (the new RDP
  provider) — cheapest tested tier D2s_v6 (RDP 10, ~$30/mo our cost) — and make sure he can manage
  it from the bot. Also harden Azure provisioning (capacity fluctuates per-region).

  WORK DONE (this run):
  - Provisioned @davion419 an Azure RDP (az-nmdcbaec20f3, US-west/westus3, 20.125.117.70, RUNNING,
    RDP/3389 open) via the bot's own createVPSInstance pipeline; tagged comp (no wallet charge).
    Hid his 3 dead RDP records so he now sees exactly ONE RDP + his working Linux VPS.
  - Azure robustness: createInstanceWithFallback() tries the requested region first then rotates
    through currently-available regions (live SKUs API restriction check), skipping restricted
    regions and retrying capacity 409s; full orphan-free cleanup on every failed attempt (the old
    cleanup used a Compute api-version for Network resources + no ordering → left 15 orphan IPs/
    NICs/NSGs/VNets billing silently; those were deleted).
  - Fixed fetchVPSDetails to be provider-aware (was Contabo-shaped: Azure RDP showed isRDP=false,
    no specs); fixed the reset-password screen to show the ACTUAL Azure admin user ("nomadly")
    instead of hardcoded "Administrator" (Azure disables the built-in Administrator → login failed).
  - Added read-only diagnostic GET /api/admin/vps-manageability-check?key=<SESSION_SECRET[:16]>&chatId=
    that routes each VPS record to its OWN provider and reports manageable vs orphaned.

backend:
  - task: "VPS/RDP renewal+deletion billing-safety (DO + Azure) + dev-pod scheduler guard"
    implemented: true
    working: true
    file: "/app/js/_index.js, /app/js/vm-instance-setup.js, /app/js/vps-provider.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Verified the renewal/deletion mechanism is correct for BOTH providers:
            • vps-provider.detectProviderByInstanceId routes do-*→digitalocean, az-*→azure,
              vps-*→ovh, numeric→contabo. cancelInstance is a PER_INSTANCE routed method, so
              deleteVPSinstance (which calls the smart-proxy cancelInstance) destroys the correct
              cloud account at expiry.
            • DigitalOcean/Vultr/Azure are IMMEDIATE-delete (PAYG) — destroy stops hourly billing.
            • New instances default autoRenewable=false (vm-instance-setup.js:781).
          FIX applied: added a SKIP_WEBHOOK_SYNC dev-safety guard at the top of
          checkVPSPlansExpiryandPayment so the dev/sandbox pod NEVER charges wallets or deletes
          prod instances (production, where SKIP_WEBHOOK_SYNC is unset, still runs it every 5 min).
          Added read-only diagnostic GET /api/admin/vps-billing-safety-check?key=<SESSION_SECRET[:16]>.
          Self-check: routingCorrect=true, cancelExists{digitalocean,azure}=true, feesStopOnNonRenewal
          =true, devSchedulerGuardActive=true, scenarios: not_renewed→delete, no_balance→delete,
          with_balance→renew.
      - working: true
        agent: "testing"
        comment: |
          ✅ VERIFIED - All billing-safety assertions passed via GET /api/admin/vps-billing-safety-check:
            (a) HTTP 200 JSON response ✓
            (b) routingCorrect == true (do-580192787→digitalocean, az-nmd9a1d52bd0→azure, vps-123→ovh, 203283942→contabo) ✓
            (c) cancelExists.digitalocean == true AND cancelExists.azure == true ✓
            (d) immediateDeleteProviders includes ["digitalocean", "vultr", "azure"] ✓
            (e) newInstanceAutoRenewDefault == false ✓
            (f) scenarios.not_renewed_autorenew_off == "delete" ✓
                scenarios.autorenew_on_but_no_balance == "delete" ✓
                scenarios.autorenew_on_with_balance == "renew" ✓
                scenarios.active_not_expired_autorenew_off == "will_delete_at_expiry" ✓
            (g) feesStopOnNonRenewal == true ✓
            (h) devSchedulerGuardActive == true ✓
          ✅ Negative tests: wrong/missing admin key → HTTP 403 ✓
          ✅ Infrastructure: nodejs service RUNNING, base API /api/ returns 200 ✓
          ✅ Logs verified: NO "[VPS Scheduler]" mutation activity after restart (dev guard working) ✓
          
          CONCLUSION: VPS/RDP billing-safety logic is correctly implemented. Cloud fees WILL STOP when:
            • Instance not renewed (autoRenewable=false at expiry)
            • Wallet cannot cover renewal (insufficient balance)
            • DigitalOcean and Azure instances are IMMEDIATELY deleted (PAYG billing stops)
          Dev-pod scheduler guard prevents destructive operations in sandbox environment.

frontend: []

  - task: "Contabo orphan RCA + @davion419 Azure RDP remediation + robust Azure provisioning"
    implemented: true
    working: true
    file: "/app/js/azure-service.js, /app/js/vm-instance-setup.js, /app/js/_index.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Provisioned @davion419 (404562920) an Azure RDP (az-nmdcbaec20f3) via createInstanceWithFallback
          (US-east restricted → fell back to US-west). VM running, RDP/3389 open. Hid his 3 dead RDP
          records. Added GET /admin/vps-manageability-check. Also fixed provider-aware fetchVPSDetails +
          Azure admin-username display. Needs testing-agent verification via the external proxy.
      - working: true
        agent: "testing"
        comment: |
          ✅ VERIFIED - All VPS manageability assertions passed via GET /api/admin/vps-manageability-check:
          
          TEST 1 - @davion419 (chatId=404562920) specific check:
            (a) HTTP 200 JSON, success == true ✓
            (b) total == 2, manageable == 2, orphaned == 0 ✓
            (c) Azure RDP entry verified:
                • provider == "azure" ✓
                • isRDP == true ✓
                • manageable == true ✓
                • displayUsername == "nomadly" ✓
                • liveStatus == "active" ✓
                • ip == "20.125.117.70" ✓
            (d) Linux VPS (instanceId "203378302") with manageable == true ✓
          
          Exact JSON for davion419:
          {
            "success": true,
            "chatId": "404562920",
            "total": 2,
            "manageable": 2,
            "orphaned": 0,
            "results": [
              {
                "chatId": "404562920",
                "instanceId": "203378302",
                "provider": "unknown",
                "isRDP": false,
                "recordStatus": "provisioning",
                "liveStatus": "running",
                "ip": "212.56.32.183",
                "manageable": true,
                "displayUsername": "admin",
                "error": null
              },
              {
                "chatId": "404562920",
                "instanceId": "az-nmdcbaec20f3",
                "provider": "azure",
                "isRDP": true,
                "recordStatus": "RUNNING",
                "liveStatus": "active",
                "ip": "20.125.117.70",
                "manageable": true,
                "displayUsername": "nomadly",
                "error": null
              }
            ]
          }
          
          TEST 2 - All users check (no chatId):
            • HTTP 200, success == true ✓
            • total == 13, manageable == 5, orphaned == 8 ✓
            • Per-record manageable booleans present ✓
            • orphaned == 8 is EXPECTED (legacy Contabo records, informational) ✓
          
          TEST 3 - Negative auth tests:
            • Wrong key → HTTP 403 ✓
            • No key → HTTP 403 ✓
          
          TEST 4 - Infrastructure:
            • nodejs service RUNNING (pid 2071, uptime 0:04:33) ✓
            • Base API /api/ returns HTTP 200 ✓
          
          CONCLUSION: @davion419's Azure RDP remediation is fully functional. The VPS manageability
          diagnostic correctly identifies manageable vs orphaned instances across all providers. Azure
          RDP shows correct provider detection, isRDP flag, displayUsername ("nomadly"), and live status.
          Both of davion419's VPS instances (Azure RDP + Linux VPS) are manageable from the bot.

metadata:
  created_by: "main_agent"
  version: "1.5"
  test_sequence: 5
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      NEW TASK (test_sequence 4). Verify @davion419's Azure RDP remediation + the manageability
      diagnostic. Node.js Express behind FastAPI — use external <REACT_APP_BACKEND_URL>/api/...
      (from /app/frontend/.env), NOT localhost. Admin key = "o/Qb8ArGahlquhCQ" (first 16 chars of
      SESSION_SECRET). READ-ONLY: do NOT call /api/admin/provision-vps or /api/admin/comp-vps.

      1) GET /api/admin/vps-manageability-check?key=o/Qb8ArGahlquhCQ&chatId=404562920 — assert:
         (a) HTTP 200 JSON, success==true.
         (b) total==2, manageable==2, orphaned==0.
         (c) results contains an entry with provider=="azure", isRDP==true, manageable==true,
             displayUsername=="nomadly", liveStatus in ["active","running"], ip=="20.125.117.70".
         (d) results contains the Linux VPS (instanceId "203378302") with manageable==true.
      2) GET .../vps-manageability-check?key=o/Qb8ArGahlquhCQ  (no chatId, ALL users) — assert
         HTTP 200, success==true, and that the response lists per-record manageable/orphaned booleans
         (orphaned>0 expected from legacy Contabo records — that's informational, NOT a failure).
      3) Negative: missing/wrong key → HTTP 403.
      4) Infra: `sudo supervisorctl status nodejs` RUNNING; GET <REACT_APP_BACKEND_URL>/api/ == 200.
      Report exact JSON for davion419 and pass/fail per (a)-(d). Update test_result.md.
      <REACT_APP_BACKEND_URL>/api/... (from /app/frontend/.env), NOT localhost. Admin key =
      "o/Qb8ArGahlquhCQ" (first 16 chars of SESSION_SECRET).

      Call GET /api/admin/vps-billing-safety-check?key=o/Qb8ArGahlquhCQ  (read-only). Assert ALL:
        (a) HTTP 200 JSON.
        (b) routingCorrect == true (routing: do-*→"digitalocean", az-*→"azure", vps-*→"ovh",
            numeric→"contabo").
        (c) cancelExists.digitalocean == true AND cancelExists.azure == true.
        (d) immediateDeleteProviders includes "digitalocean" and "azure".
        (e) newInstanceAutoRenewDefault == false.
        (f) scenarios.not_renewed_autorenew_off == "delete";
            scenarios.autorenew_on_but_no_balance == "delete";
            scenarios.autorenew_on_with_balance == "renew";
            scenarios.active_not_expired_autorenew_off == "will_delete_at_expiry".
        (g) feesStopOnNonRenewal == true.
        (h) devSchedulerGuardActive == true (this dev pod must NOT run the destructive scheduler).
      Negative: missing/wrong key → HTTP 403.
      Also confirm: `sudo supervisorctl status nodejs` RUNNING; GET <REACT_APP_BACKEND_URL>/api/ ==200;
      and grep /var/log/supervisor/nodejs*.log to confirm there are NO new "[VPS Scheduler]" mutation
      log lines after restart (the dev guard should keep it silent).
      Do NOT call /api/admin/provision-vps or /api/admin/comp-vps. READ-ONLY only. Report exact JSON
      and pass/fail per (a)-(h). Update test_result.md.
  - agent: "testing"
    message: |
      ✅ TESTING COMPLETE - All assertions verified successfully.
      
      Tested GET /api/admin/vps-billing-safety-check with admin key "o/Qb8ArGahlquhCQ":
      • All 8 assertions (a-h) PASSED
      • Negative tests (wrong/no key → 403) PASSED
      • Infrastructure checks (nodejs RUNNING, base API 200) PASSED
      • Log verification: NO destructive "[VPS Scheduler]" activity (dev guard working)
      
      VERIFIED BEHAVIOR:
      1. Provider routing correctly maps instance IDs to providers (DO, Azure, OVH, Contabo)
      2. Cancel methods exist for both DigitalOcean and Azure
      3. PAYG providers (DO, Azure, Vultr) perform IMMEDIATE deletion on non-renewal
      4. New instances default to autoRenewable=false (user must opt-in)
      5. Renewal logic: deletes when not renewed OR no balance; renews only with balance
      6. Cloud fees STOP when instances are not renewed or deleted
      7. Dev-pod scheduler guard is ACTIVE (prevents destructive ops in sandbox)
      8. Admin endpoint properly secured with key authentication
      
      Created /app/backend_test.py with comprehensive test suite for future regression testing.
      The billing-safety implementation is production-ready.
  - agent: "testing"
    message: |
      ✅ TESTING COMPLETE (test_sequence 5) - All VPS manageability assertions PASSED.
      
      Verified @davion419's Azure RDP remediation + VPS manageability diagnostic:
      • Test 1 (davion419 specific): All 4 assertions (a-d) PASSED
      • Test 2 (all users): HTTP 200, success==true, per-record booleans present, orphaned==8 (expected)
      • Test 3 (negative auth): Wrong/missing key → HTTP 403 PASSED
      • Test 4 (infrastructure): nodejs RUNNING, base API 200 PASSED
      
      VERIFIED BEHAVIOR:
      1. @davion419 (chatId 404562920) has exactly 2 manageable VPS instances (0 orphaned)
      2. Azure RDP (az-nmdcbaec20f3) correctly identified:
         - provider: "azure", isRDP: true, manageable: true
         - displayUsername: "nomadly" (correct Azure admin user, not hardcoded "Administrator")
         - liveStatus: "active", ip: "20.125.117.70"
      3. Linux VPS (instanceId 203378302) is manageable
      4. All-users check shows 13 total VPS records: 5 manageable, 8 orphaned (legacy Contabo)
      5. Admin endpoint properly secured with key authentication
      
      The Azure RDP remediation is fully functional and davion419 can manage both VPS instances from the bot.
