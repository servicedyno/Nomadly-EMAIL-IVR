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
  Verify that the existing VPS (DigitalOcean) and RDP (Azure) renewal + deletion logic correctly
  STOPS cloud fees when an instance is NOT renewed, or when there's no wallet balance for renewal.

  FINDINGS (code review of checkVPSPlansExpiryandPayment in _index.js + vps-provider routing):
  - The renewal/expiry scheduler runs every 5 min and is provider-agnostic. At 24h pre-expiry it
    auto-renews (smartWalletDeduct) only if autoRenewable=true AND wallet covers it; otherwise the
    record is marked PENDING_CANCELLATION. At end_time, PENDING_CANCELLATION records are destroyed
    via deleteVPSinstance → vpsProvider smart-proxy → the owning provider's cancelInstance (an
    IMMEDIATE destroy for DO/Vultr/Azure PAYG hourly billing) → fees stop. New PAYG instances
    default to autoRenewable=false, so they are deleted at expiry unless the user opts in + funds.
  - CRITICAL dev-safety gap found: the scheduler had NO SKIP_WEBHOOK_SYNC guard, so the dev pod
    (which shares the production MONGO_URL) was running it every 5 min and could charge real
    customer wallets and delete real customers' VPS/RDP. (Same class of bug as the prior
    protection-heartbeat issue.)

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

metadata:
  created_by: "main_agent"
  version: "1.3"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "VPS/RDP renewal+deletion billing-safety (DO + Azure) + dev-pod scheduler guard"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Verify the VPS/RDP billing-safety logic. Node.js Express behind FastAPI; use external
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
