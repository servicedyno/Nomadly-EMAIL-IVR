import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1].rstrip("/")


def _post(path):
    return requests.post(f"{BASE_URL}{path}", json={}, timeout=60)


def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "healthy"
    assert body.get("database") == "connected"


def test_rate_deck_sync():
    r = _post("/api/dev/rate-deck-sync-test")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("pass") is True, body
    checks = body.get("checks", {})
    expected = [
        "parser_keeps_only_valid",
        "merge_twilio_stored",
        "guard_reflects_twilio",
        "merge_max_cost_wins",
        "merge_tracks_both_providers",
        "guard_reflects_merged_max",
        "lower_provider_keeps_max",
    ]
    for k in expected:
        assert checks.get(k) is True, f"{k} failed: {body}"
    # parsed field
    parsed = body.get("parsed")
    assert parsed == [{"prefix": "99990", "cost": 1}], parsed


@pytest.mark.parametrize("endpoint", [
    "/api/dev/dial-rate-guard-test",
    "/api/dev/ivr-rate-policy-test",
    "/api/dev/twilio-ivr-transfer-billing-test",
    "/api/dev/bulk-transfer-billing-test",
    "/api/dev/reconciler-widen-test",
    "/api/dev/call-reconciler-test",
])
def test_regressions(endpoint):
    r = _post(endpoint)
    assert r.status_code == 200, f"{endpoint}: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("pass") is True, f"{endpoint} did not pass: {body}"
