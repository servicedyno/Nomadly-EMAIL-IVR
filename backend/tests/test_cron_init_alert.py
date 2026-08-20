"""Tests for startup cron init guard + admin alerting (js/_index.js safeInitCron).

Covers:
- POST /api/dev/cron-init-alert-test (12 checks)
- Regression: other dev endpoints still pass
- GET /api/health
"""
import os

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


# ── Feature: cron init alert guard ─────────────────────────────────────────
EXPECTED_CHECKS = [
    "goodInitReturnsTrue",
    "badInitReturnsFalse",
    "badRecorded",
    "failuresIncrementedByOne",
    "sinkCalledOnlyForBad",
    "sinkNotCalledForGood",
    "alertHasHeading",
    "alertHasName",
    "alertHasError",
    "alertEscapesHtml",
    "dedupFirstTrue",
    "dedupSecondFalse",
]


def test_cron_init_alert_test_endpoint(client):
    r = client.post(f"{BASE_URL}/api/dev/cron-init-alert-test", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:500]
    data = r.json()
    checks = data.get("checks", {})
    failed = [k for k in EXPECTED_CHECKS if checks.get(k) is not True]
    assert not failed, f"failed checks: {failed} full={checks}"
    assert len(checks) == 12, f"expected 12 checks, got {len(checks)}: {list(checks)}"
    assert data.get("pass") is True

    # injected sink captured only the failing init → no real Telegram send
    captured = data.get("captured", [])
    assert len(captured) == 1
    assert captured[0]["name"] == "unit_bad"
    assert "Cannot find module" in captured[0]["error"]

    text = data.get("alertText", "")
    assert "Startup cron failed to load" in text
    assert "unit_bad" in text
    assert "&lt;detail&gt;" in text and "&amp;" in text
    assert "<detail>" not in text


def test_cron_init_alert_idempotent(client):
    """Second call must still pass (failuresIncrementedByOne uses a delta)."""
    r = client.post(f"{BASE_URL}/api/dev/cron-init-alert-test", json={}, timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json().get("pass") is True


# ── Regression: other dev endpoints + health ──────────────────────────────
@pytest.mark.parametrize("path", [
    "/api/dev/admin-media-confirm-test",
    "/api/dev/escalation-alert-plan-test",
    "/api/dev/promo-cadence-test",
    "/api/dev/admin-media-reply-test",
])
def test_regression_dev_endpoints(client, path):
    r = client.post(f"{BASE_URL}{path}", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:500]
    body = r.json()
    assert body.get("pass") is True, f"{path} checks={body.get('checks')}"


def test_health(client):
    r = client.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d.get("status") == "healthy", d
    assert d.get("database") == "connected", d
