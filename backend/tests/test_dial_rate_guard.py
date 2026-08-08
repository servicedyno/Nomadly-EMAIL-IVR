"""Backend regression tests for dial rate guard + IVR/transfer/reconciler dev endpoints."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to reading from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


def _post(path, payload=None):
    r = requests.post(f"{API}{path}", json=payload or {}, timeout=60)
    return r


def test_health():
    r = requests.get(f"{API}/health", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "healthy"
    assert data.get("database") == "connected"


def test_dial_rate_guard():
    r = _post("/dev/dial-rate-guard-test")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("pass") is True, data
    checks = data.get("checks", {})
    expected_keys = [
        "satellite_882_blocked", "satellite_870_blocked", "uk_premium_blocked",
        "cuba_surcharged", "falklands_surcharged", "uk_mobile_surcharged",
        "uk_landline_standard", "nl_standard_intl", "us_standard",
        "getCallRate_cuba", "getCallRate_nl_intl", "getCallRate_us",
        "getCallRate_satellite_recovery",
        "getIvrCallRate_cuba_surcharged", "getIvrCallRate_us_flat",
        "billing_cuba_surcharge_applied",
    ]
    for k in expected_keys:
        assert checks.get(k) is True, f"check {k} failed: {checks.get(k)} full={data}"

    classify = data.get("classify", {})
    assert classify.get("sat") == "blocked"
    assert classify.get("inm") == "blocked"
    assert classify.get("ukPrem") == "blocked"
    assert float(classify.get("cuba")) == 1.53
    assert float(classify.get("falk")) == 4.95
    assert float(classify.get("ukMob")) == 4.25
    assert float(classify.get("ukLand")) == 0.5
    assert float(classify.get("nl")) == 0.5
    assert float(classify.get("us")) == 0.15


def test_ivr_rate_policy():
    r = _post("/dev/ivr-rate-policy-test")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("pass") is True, data
    rates = data.get("rates", {})
    assert float(rates.get("ivr_outbound_intl")) == 0.5
    assert float(rates.get("ivr_transfer_intl")) == 0.5
    assert float(rates.get("ivr_outbound_usca")) == 0.15
    assert float(rates.get("ivr_transfer_usca")) == 0.15
    assert float(rates.get("sip_outbound_intl")) == 0.5
    assert float(rates.get("sip_outbound_usca")) == 0.15


def test_twilio_ivr_transfer_billing():
    r = _post("/dev/twilio-ivr-transfer-billing-test")
    assert r.status_code == 200, r.text
    assert r.json().get("pass") is True, r.json()


def test_bulk_transfer_billing():
    r = _post("/dev/bulk-transfer-billing-test")
    assert r.status_code == 200, r.text
    assert r.json().get("pass") is True, r.json()


def test_reconciler_widen():
    r = _post("/dev/reconciler-widen-test")
    assert r.status_code == 200, r.text
    assert r.json().get("pass") is True, r.json()


def test_call_reconciler():
    r = _post("/dev/call-reconciler-test")
    assert r.status_code == 200, r.text
    assert r.json().get("pass") is True, r.json()
