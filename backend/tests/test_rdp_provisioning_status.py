"""Backend tests for RDP provisioning status block, credentials IP fix, docs, admin alerts wiring."""
import os
import json
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # Read from frontend .env directly
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

API = f"{BASE}/api"
KEY = "nmdly_e2e_51573577f5db956c5c0cb039"
HEAD = {"X-API-Key": KEY}
ADMIN_KEY = "o%2FQb8ArGahlquhCQ"

ORDER_IDS = [
    "008dfaca-f744-42eb-bed6-51feaa532639",
    "47b00ccf-0ae2-4751-a312-adc4dbf4cfa9",
    "bb1e635e-61e0-4acc-a3fe-4e966ae664cc",
]

REQUIRED_PROV_KEYS = {
    "status", "stage", "stage_label", "message", "progress", "fast_deploy",
    "os", "eta_minutes", "eta_seconds", "eta_at", "elapsed_seconds",
    "time_to_active_s", "credentials_ready", "password_confirmed", "steps", "logs",
}


def _parse(r):
    # FastAPI proxy may re-serialize; ensure JSON parse
    try:
        return r.json()
    except Exception:
        return json.loads(r.text)


@pytest.mark.parametrize("oid", ORDER_IDS)
def test_get_rdp_provisioning_shape(oid):
    r = requests.get(f"{API}/reseller/v1/rdp/{oid}", headers=HEAD, timeout=30)
    assert r.status_code == 200, r.text
    body = _parse(r)
    assert "provisioning" in body, f"no provisioning key: {list(body.keys())}"
    prov = body["provisioning"]
    missing = REQUIRED_PROV_KEYS - set(prov.keys())
    assert not missing, f"missing provisioning keys: {missing}"

    # types / values
    assert prov["fast_deploy"] is True
    assert prov["os"] == "ws2019"
    assert prov["eta_minutes"] == 3
    assert isinstance(prov["elapsed_seconds"], (int, float))
    assert isinstance(prov["time_to_active_s"], (int, float))
    assert isinstance(prov["credentials_ready"], bool)
    # steps
    steps = prov["steps"]
    assert isinstance(steps, list) and len(steps) == 4, f"steps len {len(steps)}"
    keys_order = [s.get("key") for s in steps]
    assert keys_order == ["creating", "booting", "installing", "rdp_ready"], keys_order
    for s in steps:
        assert set(["key", "label", "done", "current"]).issubset(s.keys())
    # logs
    logs = prov["logs"]
    assert isinstance(logs, list) and len(logs) <= 10
    for L in logs:
        assert set(["ts", "stage", "message"]).issubset(L.keys())

    # top-level mirrors
    assert "credentials_ready" in body
    assert "credentials_url" in body
    if body["credentials_ready"]:
        assert isinstance(body["credentials_url"], str) and oid in body["credentials_url"]
    else:
        assert body["credentials_url"] is None
    assert "live" in body and "provisioning" in body["live"]


def test_first_order_terminal_state():
    oid = ORDER_IDS[0]
    r = requests.get(f"{API}/reseller/v1/rdp/{oid}", headers=HEAD, timeout=30)
    body = _parse(r)
    prov = body["provisioning"]
    # terminal (destroyed) => eta_seconds == 0, eta_at null, credentials_ready False
    assert prov["eta_seconds"] == 0, prov["eta_seconds"]
    assert prov["eta_at"] is None
    assert prov["credentials_ready"] is False
    assert body["credentials_url"] is None
    # ip top-level: null or 104.131.68.132
    assert body.get("ip") in (None, "104.131.68.132"), body.get("ip")


def test_get_rdp_not_found():
    r = requests.get(f"{API}/reseller/v1/rdp/does-not-exist", headers=HEAD, timeout=30)
    assert r.status_code == 404
    body = _parse(r)
    assert body.get("error") == "not_found", body


def test_get_rdp_unauth():
    r = requests.get(f"{API}/reseller/v1/rdp/{ORDER_IDS[0]}", timeout=30)
    assert r.status_code in (401, 403), r.status_code


def test_credentials_ip_fix():
    oid = ORDER_IDS[0]
    r = requests.get(f"{API}/reseller/v1/rdp/{oid}/credentials", headers=HEAD, timeout=30)
    assert r.status_code == 200, r.text
    body = _parse(r)
    assert body.get("username") == "Administrator", body
    assert body.get("mode") == "dry_run", body
    assert body.get("ip") == "104.131.68.132", body.get("ip")


def test_list_rdp_contains_ids():
    r = requests.get(f"{API}/reseller/v1/rdp", headers=HEAD, timeout=30)
    assert r.status_code == 200
    body = _parse(r)
    assert "rdp" in body
    ids = {x.get("id"): x for x in body["rdp"]}
    for oid in ORDER_IDS:
        assert oid in ids, f"missing {oid}"
        assert ids[oid].get("os_id") == "ws2019", ids[oid].get("os_id")


def test_api_docs_page():
    # Docs live at /api/apidoc (not /reseller/docs)
    r = requests.get(f"{API}/apidoc", timeout=30)
    assert r.status_code == 200
    html = r.text
    for needle in ("provisioning", "credentials_ready", "eta_seconds", "stage_label"):
        assert needle in html, f"missing '{needle}' in docs"


def test_admin_rdp_golden_status():
    r = requests.get(f"{API}/admin/rdp-golden/status?key={ADMIN_KEY}", timeout=30)
    assert r.status_code == 200, r.text
    body = _parse(r)
    # find ws2019 entry
    ws = None
    if isinstance(body, dict):
        for e in body.get("os_options", []) or []:
            if e.get("id") == "ws2019" or e.get("os_id") == "ws2019":
                ws = e; break
    assert ws is not None, f"ws2019 entry not found in {list(body.keys()) if isinstance(body, dict) else type(body)}"
    status = ws.get("golden_status") or ws.get("status")
    assert status == "available", status
    regions = ws.get("golden_regions") or ws.get("regions") or []
    if isinstance(regions, dict):
        regions = list(regions.keys())
    expected = {"nyc3","sfo3","tor1","lon1","fra1","ams3","blr1","sgp1","syd1"}
    assert expected.issubset(set(regions)), f"missing regions: {expected - set(regions)}"
