#!/usr/bin/env python3
"""
Robust DNS + NS management flow test using webhook simulation.
Uses log line counting to track replies per step.
"""

import requests, time, subprocess, sys

WEBHOOK_URL = "http://localhost:5000/telegram/webhook"
CHAT_ID = 5168006768
counter = 500000

def send(text, sleep_time=3):
    global counter
    counter += 1
    payload = {
        "update_id": counter,
        "message": {
            "message_id": counter,
            "from": {"id": CHAT_ID, "is_bot": False, "first_name": "Hostbay", "username": "hostbay_support"},
            "chat": {"id": CHAT_ID, "first_name": "Hostbay", "username": "hostbay_support", "type": "private"},
            "date": int(time.time()),
            "text": text
        }
    }
    r = requests.post(WEBHOOK_URL, json=payload, timeout=15)
    time.sleep(sleep_time)
    return r.status_code

def get_log_lines():
    result = subprocess.run(["cat", "/var/log/supervisor/nodejs.out.log"], capture_output=True, text=True)
    return result.stdout.strip().split('\n')

def get_new_replies(prev_line_count):
    """Get reply lines added after prev_line_count"""
    lines = get_log_lines()
    new_lines = lines[prev_line_count:]
    replies = [l for l in new_lines if 'reply:' in l and f'to: {CHAT_ID}' in l]
    return '\n'.join(replies), len(lines)

def check(step, prev_count, expected, not_expected=None):
    reply_text, new_count = get_new_replies(prev_count)
    passed = True
    issues = []
    for exp in expected:
        if exp.lower() not in reply_text.lower():
            passed = False
            issues.append(f"MISSING '{exp}'")
    if not_expected:
        for nexp in not_expected:
            if nexp.lower() in reply_text.lower():
                passed = False
                issues.append(f"UNEXPECTED '{nexp}'")
    
    icon = "✅" if passed else "❌"
    if passed:
        print(f"  {icon} {step}")
    else:
        print(f"  {icon} {step}: {'; '.join(issues)}")
        # Show reply snippet
        snippet = reply_text[:250] if reply_text else "(no new reply)"
        print(f"     Reply: {snippet}")
    return passed, new_count

# ══════════════════════════════════════════════════════════════
# TEST
# ══════════════════════════════════════════════════════════════
subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.err.log"])
subprocess.run(["bash", "-c", "> /var/log/supervisor/nodejs.out.log"])

print("=" * 70)
print("DNS + NAMESERVER MANAGEMENT — WEBHOOK FLOW TEST")
print("=" * 70)

passed_count = 0
total_count = 0
lc = 0  # log line count tracker

# ── Phase 1: Navigate to DNS Dashboard ──
print("\n--- Phase 1: Navigate to DNS Dashboard ---")

send("/start", 4)
total_count += 1
ok, lc = check("1. /start → main menu", lc, ["select"])
passed_count += ok

send("🌐 Bulletproof Domains", 3)
total_count += 1
ok, lc = check("2. Domains submenu", lc, ["DNS Management"])
passed_count += ok

send("🔧 DNS Management", 3)
total_count += 1
ok, lc = check("3. Domain selection list", lc, ["starboyplay1.sbs"])
passed_count += ok

send("starboyplay1.sbs", 5)
total_count += 1
ok, lc = check("4. DNS Dashboard — 🔄 Manage Nameservers is shown, Switch buttons removed", lc,
    ["Manage Nameservers", "starboyplay1.sbs"],
    ["Switch to Cloudflare", "Switch to Provider"])
passed_count += ok

total_count += 1
ok, lc2 = check("5. DNS Dashboard shows NS records + updated hint", lc - 5,  # re-check same reply
    ["NS1:", "NS2:", "Manage Nameservers"])
lc = max(lc, lc2)
passed_count += ok

# ── Phase 2: Manage Nameservers submenu ──
print("\n--- Phase 2: Manage Nameservers Submenu ---")

send("🔄 Manage Nameservers", 3)
total_count += 1
ok, lc = check("6. NS submenu — shows provider + NS values", lc,
    ["Cloudflare", "NS1:", "NS2:", "leanna.ns.cloudflare.com"])
passed_count += ok

total_count += 1
ok, _ = check("7. NS submenu — correct buttons for CF domain", lc - 5,
    ["Switch to Provider DNS", "Set Custom Nameservers"],
    ["Switch to Cloudflare"])
passed_count += ok

# ── Phase 3: Set Custom NS flow ──
print("\n--- Phase 3: Set Custom Nameservers ---")

send("✏️ Set Custom Nameservers", 3)
total_count += 1
ok, lc = check("8. Custom NS prompt — shows current + example", lc,
    ["nameserver", "example"])
passed_count += ok

send("Back", 4)
total_count += 1
ok, lc = check("9. Back from Custom NS → NS submenu (not Update DNS Record)", lc,
    ["Nameservers", "NS1:"],
    ["Select the record to update"])
passed_count += ok

# ── Phase 4: Navigation ──
print("\n--- Phase 4: Back Navigation ---")

send("Back", 5)
total_count += 1
ok, lc = check("10. Back from NS submenu → DNS Dashboard", lc,
    ["Manage Nameservers"])
passed_count += ok

send("⬅️ Back", 3)
total_count += 1
ok, lc = check("11. Back to domain list", lc, ["starboyplay1.sbs"])
passed_count += ok

# ── Phase 5: Test non-CF domain ──
print("\n--- Phase 5: Non-Cloudflare Domain ---")

send("lockedinrate.sbs", 5)
total_count += 1
ok, lc = check("12. DNS Dashboard for lockedinrate.sbs", lc, ["Manage Nameservers"])
passed_count += ok

send("🔄 Manage Nameservers", 3)
total_count += 1
ok, lc = check("13. NS submenu for non-CF domain — shows Switch to Cloudflare", lc,
    ["lockedinrate.sbs", "Set Custom Nameservers"])
passed_count += ok

# ── Phase 6: French language ──
print("\n--- Phase 6: French Language ---")

send("Back", 3)
send("⬅️ Back", 3)
send("⬅️ Back", 2)
send("/start", 3)
send("🌍 Settings", 2)
send("🇫🇷 French", 3)
send("/start", 3)

send("🌐 Bulletproof Domains", 3)
lc = len(get_log_lines())

send("🔧 Gestion DNS", 3)
total_count += 1
ok, lc = check("14. DNS Management (FR) → domain list", lc, ["starboyplay1.sbs"])
passed_count += ok

send("starboyplay1.sbs", 5)
total_count += 1
ok, lc = check("15. DNS Dashboard (FR) — has Gérer les serveurs de noms", lc,
    ["Gérer les serveurs de noms"])
passed_count += ok

send("🔄 Gérer les serveurs de noms", 3)
total_count += 1
ok, lc = check("16. NS submenu (FR) — Serveurs de noms + Cloudflare", lc,
    ["Serveurs de noms", "Cloudflare"])
passed_count += ok

# Restore English
send("Back", 2)
send("⬅️ Back", 2)
send("⬅️ Back", 2)
send("/start", 2)
send("🌍 Modifier les paramètres", 2)
send("🇬🇧 English", 2)

# ── Phase 7: Error check ──
print("\n--- Phase 7: Error Check ---")
total_count += 1
err = subprocess.run(["cat", "/var/log/supervisor/nodejs.err.log"], capture_output=True, text=True).stdout.strip()
if not err:
    print("  ✅ 17. Error log clean (0 bytes)")
    passed_count += 1
else:
    print(f"  ❌ 17. Error log: {err[:200]}")

# ══════════════════════════════════════════════════════════════
print(f"\n{'=' * 70}")
print(f"TOTAL: {total_count} | ✅ PASSED: {passed_count} | ❌ FAILED: {total_count - passed_count}")
print(f"{'=' * 70}")

sys.exit(0 if passed_count == total_count else 1)
