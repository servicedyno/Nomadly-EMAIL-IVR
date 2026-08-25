"""Production verification tests for SMADAV storefront (panel.smadavhost.com).

Covers:
- BUG FIX 1: /api/store/config must return botUsername 'smadavv_bot' (no Nomadly leak)
- BUG FIX 2: /api/store/guest/checkout must return a Dynopay crypto address (DYNO_PAY_BASE_URL fix)
- SANITY: /api/store/plans (3 plans) and /api/store/health (coins incl BTC, USDT-TRC20)

SAFETY: read-only calls + one unpaid guest order. No payment settlement, no webhooks.
"""
import os
import requests

BASE_URL = os.environ.get("SMADAV_PROD_URL", "https://panel.smadavhost.com").rstrip("/")
TIMEOUT = 60


# --- BUG FIX 1: bot username leak ---
def test_store_config_bot_username():
    r = requests.get(f"{BASE_URL}/api/store/config", timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data.get("botUsername") == "smadavv_bot", f"leaked bot username: {data}"
    assert data.get("botUsername") != "NomadlyBot"


# --- SANITY: plans ---
def test_store_plans():
    r = requests.get(f"{BASE_URL}/api/store/plans", timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    plans = r.json()["plans"]
    assert len(plans) == 3
    priced = {p["id"]: p["priceUsd"] for p in plans}
    assert priced == {
        "premium-weekly": 30,
        "premium-monthly": 75,
        "golden-monthly": 100,
    }, priced


# --- SANITY: health ---
def test_store_health():
    r = requests.get(f"{BASE_URL}/api/store/health", timeout=TIMEOUT)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    assert data.get("ok") is True
    coins = data.get("coins") or []
    assert "BTC" in coins and "USDT-TRC20" in coins, coins


# --- BUG FIX 2: Dynopay crypto checkout ---
def test_guest_checkout_returns_crypto_address():
    payload = {
        "email": "qa-verify@smadavhost.com",
        "planId": "premium-weekly",
        "domain": "smadav-qa-verify-02.com",
        "domainMode": "byo",
        "coin": "BTC",
    }
    r = requests.post(
        f"{BASE_URL}/api/store/guest/checkout", json=payload, timeout=TIMEOUT
    )
    assert r.status_code == 200, f"checkout failed {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert data.get("address"), f"empty crypto address: {data}"
    assert data.get("amountUsd") == 30, data
    assert data.get("coin") == "BTC"
    order_id = data["orderId"]

    # unpaid order must persist as pending with same address
    o = requests.get(f"{BASE_URL}/api/store/order/{order_id}", timeout=TIMEOUT)
    assert o.status_code == 200, o.text[:300]
    od = o.json()
    assert od["status"] == "pending"
    assert od["address"] == data["address"]
    assert od["amountUsd"] == 30
