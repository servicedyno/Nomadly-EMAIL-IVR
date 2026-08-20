"""Tests for the 4 approved enhancements (A deactivated-user guard, B escalation coverage,
C promo cadence, D admin media confirm) plus regressions, via /api/dev/* endpoints."""
import os
import json
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

TIMEOUT = 90


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _post(client, path, expected_checks):
    r = client.post(f"{BASE_URL}{path}", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text[:500]}"
    data = r.json()
    print(f"\n{path} =>\n{json.dumps(data, indent=2)[:3000]}")
    checks = data.get("checks") or {}
    failed = {k: v for k, v in checks.items() if v is not True}
    assert not failed, f"{path} failed checks: {failed}"
    if expected_checks is not None:
        assert len(checks) == expected_checks, f"{path} expected {expected_checks} checks, got {len(checks)}: {list(checks)}"
    assert data.get("pass") is True, f"{path} pass!=true: {data}"
    return data


# --- Health ---
def test_health(client):
    r = client.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d.get("status") == "healthy"
    assert d.get("database") == "connected"


# --- Regression: original admin image-send routing (9 checks) ---
def test_admin_media_reply(client):
    _post(client, "/api/dev/admin-media-reply-test", 9)


# --- (D) confirm-preview builder + (A) permanent send-error classifier (10 checks) ---
def test_admin_media_confirm(client):
    data = _post(client, "/api/dev/admin-media-confirm-test", 10)
    blob = json.dumps(data)
    assert "Confirm media reply" in blob or "confirm" in blob.lower()


# --- (B) escalation alert plan (6 checks) ---
def test_escalation_alert_plan(client):
    _post(client, "/api/dev/escalation-alert-plan-test", 6)


# --- (C) promo cadence back-off + block-rate report (10 checks) ---
def test_promo_cadence(client):
    _post(client, "/api/dev/promo-cadence-test", 10)


# --- Regressions near the edited code ---
def test_stale_wallet_tap(client):
    _post(client, "/api/dev/stale-wallet-tap-test", None)


def test_support_routing(client):
    _post(client, "/api/dev/support-routing-test", None)
