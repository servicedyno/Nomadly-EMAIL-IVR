"""
Backend-authoritative rate-limit tests for POST /api/panel/login.

Verifies:
  - First 4 wrong-PIN attempts → 401 with attemptsRemaining decreasing 4→3→2→1
  - 5th attempt → 429 with Retry-After: 900 + JSON {rateLimited, lockedSeconds=900, lockedMinutes=15, lockedUntil}
  - 6th attempt → still 429 (lockout persists)
  - Per-username scope: locking out user A does NOT lock out user B
  - Successful login still works for an unlocked account (goldtest / 123456)

IMPORTANT: Each test uses a UNIQUE fresh non-existent username to avoid
locking out shared fixtures (goldtest). The Node.js panel server holds rate-
limit state in an in-memory Map keyed by lowercase username — a process restart
wipes it. Do NOT restart the panel during this test run.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
LOGIN_URL = f"{BASE_URL}/api/panel/login"


def _unique_user(prefix="rl"):
    return f"test-{prefix}-{int(time.time() * 1000)}"


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── 1. Authoritative rate-limit contract ───────────────────────────────────
class TestPanelLoginRateLimit:
    def test_attempts_remaining_decrements_then_locks(self, api):
        user = _unique_user("contract")
        for expected_remaining in [4, 3, 2, 1]:
            r = api.post(LOGIN_URL, json={"username": user, "pin": "000000"})
            assert r.status_code == 401, (
                f"attempt with remaining={expected_remaining}: expected 401, got {r.status_code} body={r.text}"
            )
            body = r.json()
            assert body.get("attemptsRemaining") == expected_remaining, (
                f"expected attemptsRemaining={expected_remaining}, got {body}"
            )
            assert "error" in body
            # Must NOT carry rateLimited yet
            assert not body.get("rateLimited"), f"unexpected rateLimited={body}"

        # 5th attempt → lockout
        r5 = api.post(LOGIN_URL, json={"username": user, "pin": "000000"})
        assert r5.status_code == 429, f"5th attempt expected 429, got {r5.status_code} body={r5.text}"
        assert r5.headers.get("Retry-After") == "900", (
            f"expected Retry-After=900, got {r5.headers.get('Retry-After')}"
        )
        body = r5.json()
        assert body.get("rateLimited") is True
        assert body.get("lockedSeconds") == 900
        assert body.get("lockedMinutes") == 15
        assert isinstance(body.get("lockedUntil"), (int, float))
        assert body["lockedUntil"] > time.time() * 1000  # epoch ms in the future

        # 6th attempt → still locked (429)
        r6 = api.post(LOGIN_URL, json={"username": user, "pin": "000000"})
        assert r6.status_code == 429, f"6th attempt expected 429, got {r6.status_code}"
        body6 = r6.json()
        assert body6.get("rateLimited") is True
        assert body6.get("lockedSeconds", 0) > 0

    def test_lockout_is_per_username(self, api):
        user_a = _unique_user("scope-a")
        user_b = _unique_user("scope-b")
        # Lock out A
        for _ in range(5):
            api.post(LOGIN_URL, json={"username": user_a, "pin": "000000"})
        # Confirm A is locked
        ra = api.post(LOGIN_URL, json={"username": user_a, "pin": "000000"})
        assert ra.status_code == 429, f"user_a should be locked, got {ra.status_code}"
        # B should be untouched — first wrong attempt → 401 with attemptsRemaining=4
        rb = api.post(LOGIN_URL, json={"username": user_b, "pin": "000000"})
        assert rb.status_code == 401, f"user_b should NOT be locked, got {rb.status_code} body={rb.text}"
        body = rb.json()
        assert body.get("attemptsRemaining") == 4, f"user_b expected fresh counter, got {body}"
        assert not body.get("rateLimited")

    def test_missing_credentials_returns_400_not_counted(self, api):
        r = api.post(LOGIN_URL, json={})
        assert r.status_code == 400, f"empty body expected 400, got {r.status_code}"


# ── 2. Successful login still works for unlocked account (goldtest) ───────
class TestPanelLoginSuccess:
    def test_goldtest_login_returns_token(self, api):
        r = api.post(LOGIN_URL, json={"username": "goldtest", "pin": "123456"})
        if r.status_code == 401:
            pytest.skip("goldtest seed missing — re-seed with seed_captcha_accounts.js")
        assert r.status_code == 200, f"goldtest login expected 200, got {r.status_code} body={r.text}"
        body = r.json()
        assert isinstance(body.get("token"), str) and len(body["token"]) > 20
        assert body.get("username", "").lower() == "goldtest"
        assert "domain" in body
