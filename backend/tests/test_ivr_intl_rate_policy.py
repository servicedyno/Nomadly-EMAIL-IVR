"""Backend tests for International IVR rate policy + regressions.
Covers: /api/dev/ivr-rate-policy-test, /api/dev/twilio-ivr-transfer-billing-test,
/api/dev/bulk-transfer-billing-test, /api/dev/reconciler-widen-test,
/api/dev/call-reconciler-test, /api/health
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0]
BASE_URL = BASE_URL.rstrip("/")

TIMEOUT = 120


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def test_health(s):
    r = s.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("status") == "healthy"
    assert d.get("database") == "connected"


def test_ivr_rate_policy(s):
    r = s.post(f"{BASE_URL}/api/dev/ivr-rate-policy-test", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("pass") is True, d
    rates = d.get("rates", d)
    assert rates.get("ivr_outbound_intl") == 0.5, rates
    assert rates.get("ivr_transfer_intl") == 0.5, rates
    assert rates.get("ivr_outbound_usca") == 0.15, rates
    assert rates.get("ivr_transfer_usca") == 0.15, rates
    assert rates.get("sip_outbound_intl") == 0.5, rates
    assert rates.get("sip_outbound_usca") == 0.15, rates


def test_twilio_ivr_transfer_billing(s):
    r = s.post(f"{BASE_URL}/api/dev/twilio-ivr-transfer-billing-test", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("pass") is True, d
    checks = d.get("checks", {})
    for k in [
        "charged_intl_rate",
        "not_charged_flat_ivr_rate",
        "usca_charged_flat_ivr_rate",
        "idempotent_no_double_charge",
        "no_answer_not_billed",
        "gather_has_transfer_action",
        "gather_dials_destination",
        "transfer_leg_billed_once",
    ]:
        assert checks.get(k) is True, f"check {k} failed: {checks}"
    assert d.get("expectedCharge") == 1, d
    assert d.get("observedCharge") == 1, d


def test_bulk_transfer_billing(s):
    r = s.post(f"{BASE_URL}/api/dev/bulk-transfer-billing-test", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("pass") is True, d
    checks = d.get("checks", {})
    for k in [
        "charged_intl_rate",
        "not_charged_flat_ivr_rate",
        "usca_charged_flat_ivr_rate",
        "idempotent_no_double_charge",
        "no_answer_not_billed",
        "transfer_leg_billed_once",
    ]:
        assert checks.get(k) is True, f"check {k} failed: {checks}"
    assert d.get("expectedCharge") == 1, d


def test_reconciler_widen(s):
    r = s.post(f"{BASE_URL}/api/dev/reconciler-widen-test", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("pass") is True, d
    summary = d.get("summary", {})
    assert summary.get("scanned") == 3, summary
    assert summary.get("reconciledByWebhook") == 2, summary
    assert summary.get("needsReview", 0) >= 1, summary
    assert summary.get("settled") == 0, summary
    assert summary.get("dryRun") is True, summary


def test_call_reconciler(s):
    r = s.post(f"{BASE_URL}/api/dev/call-reconciler-test", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("pass") is True, d
