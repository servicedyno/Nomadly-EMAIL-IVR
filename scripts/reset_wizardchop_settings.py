#!/usr/bin/env python3
"""
Reset @wizardchop's (chatId 1167900472) Cloud IVR settings on +15162719167 to factory
defaults so he can configure forwarding from a clean slate.

What gets wiped:
  - features.callForwarding  → enabled=false, mode='disabled', forwardTo=null
  - features.voicemail       → enabled=false, default greeting
  - features.ivr             → enabled=false (greeting + audio refs cleared)
  - features.recording       → false
  - features.smsForwarding   → toTelegram=true (default), toEmail=null, webhookUrl=null
  - features.sms             → true (kept — it's the SMS capability flag, not a routing rule)

What is preserved (intentionally):
  - num.sipUsername / num.telnyxSipUsername / num.sipPassword — SIP device credentials
    (these are infrastructure, not user-set routing rules; deleting would break his softphone)
  - num.plan / num.status / num.minutesUsed / num.smsUsed — billing state
  - num.ivrAudioStore docs — left in MongoDB for safety; orphaned but not user-visible

After the reset the bot's Manage screen will show every feature toggle in the OFF state
and the call-flow preview will read: "🧭 Currently: No features enabled — callers hear
'number unavailable'." Then he can re-enable just the forwarding (Always-Forward) and
calls will work as expected.
"""

import os, sys, json, requests
from datetime import datetime, timezone

PROD_MONGO = "mongodb://mongo:UCPkknTGVOBzrnOiXoIYyVhampeslSIR@roundhouse.proxy.rlwy.net:52715"
TARGET_CHAT_ID = "1167900472"
TARGET_NUMBER = "+15162719167"

# Canonical default schema, sourced from js/_index.js:27381-27383 (number-creation path).
DEFAULT_FEATURES = {
    "sms": True,
    "callForwarding": {
        "enabled": False,
        "mode": "disabled",
        "forwardTo": None,
        "ringTimeout": 25,
        "holdMusic": False,
    },
    "voicemail": {
        "enabled": False,
        "greetingType": "default",
        "customGreetingUrl": None,
        "forwardToTelegram": True,
        "forwardToEmail": None,
        "ringTimeout": 25,
    },
    "smsForwarding": {
        "toTelegram": True,
        "toEmail": None,
        "webhookUrl": None,
    },
    "recording": False,
    "ivr": {"enabled": False},
}

def main():
    from pymongo import MongoClient
    c = MongoClient(PROD_MONGO, serverSelectionTimeoutMS=10000)
    db = c["test"]

    doc = db.phoneNumbersOf.find_one({"_id": TARGET_CHAT_ID})
    if not doc:
        print(f"❌ User {TARGET_CHAT_ID} not found in phoneNumbersOf")
        sys.exit(1)

    nums = doc.get("val", {}).get("numbers", [])
    target_idx = None
    for i, n in enumerate(nums):
        if n.get("phoneNumber") == TARGET_NUMBER:
            target_idx = i
            break

    if target_idx is None:
        print(f"❌ Number {TARGET_NUMBER} not found on user {TARGET_CHAT_ID}")
        sys.exit(1)

    target = nums[target_idx]
    print("─" * 60)
    print(f"BEFORE — features on {TARGET_NUMBER}:")
    print("─" * 60)
    for k, v in (target.get("features") or {}).items():
        snippet = json.dumps(v, default=str)
        if len(snippet) > 200: snippet = snippet[:197] + "..."
        print(f"  {k}: {snippet}")
    print()

    # Atomic positional $set — only touches features map + updatedAt + an audit log.
    # Mirrors `updatePhoneNumberFeature` semantics in js/_index.js.
    now = datetime.now(timezone.utc).isoformat()
    audit_entry = {
        "at": now,
        "by": "agent_reset_for_wizardchop_callforwarding_bug",
        "previousFeatures": target.get("features") or {},
        "reason": "User reported call-forwarding bug; admin reset to defaults so user can reconfigure cleanly. Bug fixed in voice-service.js priority order.",
    }
    res = db.phoneNumbersOf.update_one(
        {"_id": TARGET_CHAT_ID, "val.numbers.phoneNumber": TARGET_NUMBER},
        {
            "$set": {
                "val.numbers.$.features": DEFAULT_FEATURES,
                "val.numbers.$.updatedAt": now,
            },
            "$push": {"val.numbers.$.featuresResetLog": audit_entry},
        },
    )
    print(f"Mongo update — matched={res.matched_count} modified={res.modified_count}")

    if res.modified_count == 0:
        print("⚠️ No document modified — aborting before notification.")
        sys.exit(1)

    # Verify
    doc2 = db.phoneNumbersOf.find_one({"_id": TARGET_CHAT_ID})
    nums2 = doc2.get("val", {}).get("numbers", [])
    target2 = next(n for n in nums2 if n.get("phoneNumber") == TARGET_NUMBER)
    print()
    print("─" * 60)
    print(f"AFTER — features on {TARGET_NUMBER}:")
    print("─" * 60)
    for k, v in (target2.get("features") or {}).items():
        print(f"  {k}: {json.dumps(v, default=str)}")
    print()
    print(f"sipUsername preserved: {bool(target2.get('sipUsername'))}")
    print(f"plan preserved: {target2.get('plan')}")
    print(f"status preserved: {target2.get('status')}")
    print(f"updatedAt: {target2.get('updatedAt')}")
    print(f"featuresResetLog entries: {len(target2.get('featuresResetLog', []))}")

    # ── Telegram notification to @wizardchop ──
    bot_token = None
    with open("/app/.env") as f:
        for line in f:
            if line.startswith("TELEGRAM_BOT_TOKEN_PROD="):
                bot_token = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
    if not bot_token:
        print("⚠️ No TELEGRAM_BOT_TOKEN_PROD in .env — skipping user notification")
        return

    msg = (
        "🔧 <b>Cloud IVR Settings Reset</b>\n\n"
        f"Your number <b>+1 (516) 271-9167</b> has been reset to factory defaults so you can configure call forwarding cleanly.\n\n"
        "<b>What was wiped:</b>\n"
        "• Call Forwarding\n"
        "• IVR Auto-Attendant\n"
        "• Voicemail\n"
        "• Call Recording\n"
        "• SMS Forwarding\n\n"
        "<b>What was preserved:</b>\n"
        "• Your SIP credentials\n"
        "• Your plan & remaining minutes\n"
        "• Your phone number\n\n"
        "<b>Next steps:</b>\n"
        "1. Open <b>📞 My Numbers</b> → tap <b>+1 (516) 271-9167</b>\n"
        "2. Tap <b>📲 Call Forwarding</b> → <b>Always Forward</b>\n"
        "3. Enter the number to forward to.\n\n"
        "✅ The forwarding bug that caused calls to drop into voicemail has been fixed — calls will now forward as expected.\n\n"
        "If anything seems off, reply here and we'll take a look."
    )
    r = requests.post(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        json={"chat_id": int(TARGET_CHAT_ID), "text": msg, "parse_mode": "HTML"},
        timeout=15,
    )
    print()
    print(f"Telegram notification: HTTP {r.status_code} — {r.text[:300]}")

if __name__ == "__main__":
    main()
