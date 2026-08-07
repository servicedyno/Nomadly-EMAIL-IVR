"""Backend tests for Widen Reconciler + Bulk Transfer Parity + regressions."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_health(session):
    r = session.get(f"{API}/health", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "healthy"
    assert data.get("database") == "connected"


def test_reconciler_widen(session):
    r = session.post(f"{API}/dev/reconciler-widen-test", json={}, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    print("RECONCILER_WIDEN:", data)
    assert data.get("pass") is True, data
    checks = data.get("checks", {})
    required = [
        "wired_twilio_sip_bridge",
        "wired_twilio_sip_outbound",
        "wired_telnyx_bridge",
        "sip_legs_reconciled",
        "telnyx_leak_detected",
        "telnyx_not_auto_settled",
        "dryrun_left_telnyx_pending",
    ]
    for k in required:
        assert checks.get(k) is True, f"check {k} failed: {checks}"
    summary = data.get("summary", {})
    assert summary.get("scanned") == 3, summary
    assert summary.get("reconciledByWebhook") == 2, summary
    assert summary.get("leaksFound", 0) >= 1, summary
    assert summary.get("needsReview", 0) >= 1, summary
    assert summary.get("settled") == 0, summary
    assert summary.get("dryRun") is True, summary


def test_bulk_transfer_billing(session):
    r = session.post(f"{API}/dev/bulk-transfer-billing-test", json={}, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    print("BULK_TRANSFER:", data)
    assert data.get("pass") is True, data
    checks = data.get("checks", {})
    required = [
        "transfer_status_200",
        "transfer_leg_billed_once",
        "charged_flat_ivr_rate",
        "not_charged_intl_rate",
        "idempotent_no_double_charge",
        "no_answer_not_billed",
    ]
    for k in required:
        assert checks.get(k) is True, f"check {k} failed: {checks}"
    assert data.get("expectedCharge") == 0.3, data
    assert data.get("observedCharge") == 0.3, data


def test_regression_call_reconciler(session):
    r = session.post(f"{API}/dev/call-reconciler-test", json={}, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("pass") is True, data


def test_regression_ivr_transfer_billing(session):
    r = session.post(f"{API}/dev/twilio-ivr-transfer-billing-test", json={}, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("pass") is True, data
