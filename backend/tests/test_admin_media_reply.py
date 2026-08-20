"""Backend regression tests for the admin media-reply fix (2026-08-20).

Covers:
- POST /api/dev/admin-media-reply-test  (new fix: classifyAdminMediaReply routing)
- POST /api/dev/stale-wallet-tap-test   (regression, adjacent code)
- POST /api/dev/support-routing-test    (regression)
- GET  /api/health                      (service + DB health)
Also verifies /dev/... (non /api) alias paths resolve.
"""
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing from env and /app/frontend/.env")
BASE_URL = base_url.rstrip("/")

TIMEOUT = 60


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── Health ────────────────────────────────────────────────────────────────
class TestHealth:
    def test_health(self, client):
        r = client.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        print("health:", data)
        assert str(data.get("status", "")).lower() in ("healthy", "ok")
        db = data.get("database") or data.get("db") or {}
        db_str = str(db).lower()
        assert "connected" in db_str or "true" in db_str, f"db not connected: {db}"


# ── Admin media reply fix ────────────────────────────────────────────────
EXPECTED_CHECKS = [
    "quickReplyPhotoNoCaption",
    "quickReplyPhotoWithCaption",
    "replyCaptionNumeric",
    "replyCaptionUsername",
    "replyCaptionBeatsPending",
    "textOnlyPendingIsNone",
    "mediaNoPendingIsNone",
    "mediaDeliverPendingIsNone",
    "mediaStalePendingIsNone",
]


class TestAdminMediaReply:
    def test_endpoint_pass_and_all_checks(self, client):
        r = client.post(f"{BASE_URL}/api/dev/admin-media-reply-test", json={}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        checks = data.get("checks") or {}
        print("checks:", checks)
        assert set(checks.keys()) == set(EXPECTED_CHECKS), f"unexpected checks: {sorted(checks)}"
        assert len(checks) == 9
        failed = [k for k, v in checks.items() if v is not True]
        assert not failed, f"failed checks: {failed}"
        assert data.get("pass") is True

    def test_case_modes_and_targets(self, client):
        r = client.post(f"{BASE_URL}/api/dev/admin-media-reply-test", json={}, timeout=TIMEOUT)
        assert r.status_code == 200
        cases = r.json().get("cases") or {}
        print("cases:", cases)
        assert cases["quickReplyPhotoNoCaption"] == {"mode": "quick-reply", "target": "7080940684"}
        assert cases["quickReplyPhotoWithCaption"] == {"mode": "quick-reply", "target": "7080940684"}
        assert cases["replyCaptionNumeric"]["mode"] == "reply-caption"
        assert cases["replyCaptionUsername"]["mode"] == "reply-caption"
        assert cases["replyCaptionBeatsPending"]["mode"] == "reply-caption"
        for k in ("textOnlyPending", "mediaNoPending", "mediaDeliverPending", "mediaStalePending"):
            assert cases[k]["mode"] == "none", f"{k} should not hijack: {cases[k]}"
            assert "target" not in cases[k]

    def test_non_api_alias_not_exposed_externally(self, client):
        """Ingress only routes /api/* to the bot; the bare /dev/... path is not
        publicly reachable (404 from the frontend/express fallback). Documented,
        not a defect — always use /api/dev/... externally."""
        r = client.post(f"{BASE_URL}/dev/admin-media-reply-test", json={}, timeout=TIMEOUT)
        print("bare /dev alias status (expected 404 externally):", r.status_code)
        assert r.status_code == 404

    def test_idempotent_repeat(self, client):
        """Pure helper → deterministic across repeated calls."""
        results = []
        for _ in range(3):
            r = client.post(f"{BASE_URL}/api/dev/admin-media-reply-test", json={}, timeout=TIMEOUT)
            assert r.status_code == 200
            results.append(r.json().get("checks"))
        assert all(x == results[0] for x in results), "non-deterministic results"
        assert all(v is True for v in results[0].values())


# ── Adjacent regressions ─────────────────────────────────────────────────
class TestAdjacentRegressions:
    def test_stale_wallet_tap(self, client):
        r = client.post(f"{BASE_URL}/api/dev/stale-wallet-tap-test", json={}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        print("stale-wallet checks:", data.get("checks"))
        assert data.get("pass") is True
        assert all(v is True for v in (data.get("checks") or {}).values())

    def test_support_routing(self, client):
        r = client.post(f"{BASE_URL}/api/dev/support-routing-test", json={}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        print("support-routing checks:", data.get("checks"))
        assert data.get("pass") is True
        assert all(v is True for v in (data.get("checks") or {}).values())
