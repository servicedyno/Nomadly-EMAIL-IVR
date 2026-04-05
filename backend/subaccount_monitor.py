"""
Twilio Subaccount Health Monitor
- Runs every 30 minutes
- Checks all active Twilio subaccounts via the Twilio API
- If a subaccount is suspended: marks the number in MongoDB + notifies user via Telegram
- Tracks notified suspensions to avoid duplicate alerts
"""

import os
import logging
import httpx
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger("subaccount_monitor")

TWILIO_API_BASE = "https://api.twilio.com/2010-04-01/Accounts"


def _get_twilio_creds():
    """Lazy load Twilio credentials (after dotenv is loaded)."""
    return os.environ.get("TWILIO_ACCOUNT_SID", ""), os.environ.get("TWILIO_AUTH_TOKEN", "")


def _get_telegram_config():
    """Lazy load Telegram config (after dotenv is loaded)."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN_PROD", "")
    admin_id = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")
    return token, admin_id


async def check_twilio_subaccount_status(http_client: httpx.AsyncClient, subaccount_sid: str) -> dict:
    """Check a single Twilio subaccount's status via the REST API."""
    sid, token = _get_twilio_creds()
    url = f"{TWILIO_API_BASE}/{subaccount_sid}.json"
    try:
        response = await http_client.get(
            url,
            auth=(sid, token),
            timeout=15.0,
        )
        if response.status_code == 200:
            data = response.json()
            return {
                "sid": data.get("sid"),
                "friendly_name": data.get("friendly_name"),
                "status": data.get("status"),
                "date_created": data.get("date_created"),
                "date_updated": data.get("date_updated"),
            }
        else:
            logger.error(f"Twilio API returned {response.status_code} for {subaccount_sid}: {response.text[:200]}")
            return {"sid": subaccount_sid, "status": "error", "error": response.text[:200]}
    except Exception as e:
        logger.error(f"Error checking subaccount {subaccount_sid}: {e}")
        return {"sid": subaccount_sid, "status": "error", "error": str(e)}


async def send_telegram_message(http_client: httpx.AsyncClient, chat_id: str, message: str) -> bool:
    """Send a message to a Telegram user via Bot API."""
    token, _ = _get_telegram_config()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
    }
    try:
        response = await http_client.post(url, json=payload, timeout=15.0)
        if response.status_code == 200:
            logger.info(f"Telegram notification sent to {chat_id}")
            return True
        else:
            logger.error(f"Telegram API error for {chat_id}: {response.status_code} {response.text[:200]}")
            return False
    except Exception as e:
        logger.error(f"Failed to send Telegram message to {chat_id}: {e}")
        return False


async def notify_admin(http_client: httpx.AsyncClient, message: str) -> bool:
    """Send alert to admin Telegram chat."""
    _, admin_chat_id = _get_telegram_config()
    if admin_chat_id:
        return await send_telegram_message(http_client, admin_chat_id, message)
    return False


async def run_subaccount_health_check(db, http_client: httpx.AsyncClient):
    """
    Main health check routine:
    1. Query MongoDB for all active Twilio phone numbers with subaccount SIDs
    2. Check each subaccount's status via Twilio API
    3. If suspended: mark in DB, notify user, notify admin
    """
    logger.info("=== Subaccount health check started ===")

    suspension_events_coll = db["suspensionEvents"]
    phone_numbers_coll = db["phoneNumbersOf"]

    # 1. Gather all Twilio numbers with subaccount SIDs (include suspended for retry)
    all_twilio_numbers = []
    async for doc in phone_numbers_coll.find({}):
        owner_chat_id = doc.get("_id")
        numbers = doc.get("val", {}).get("numbers", [])
        for num in numbers:
            if (
                num.get("provider") == "twilio"
                and num.get("twilioSubAccountSid")
            ):
                all_twilio_numbers.append({
                    "chatId": owner_chat_id,
                    "phoneNumber": num.get("phoneNumber"),
                    "subAccountSid": num.get("twilioSubAccountSid"),
                    "plan": num.get("plan"),
                    "dbStatus": num.get("status"),
                })

    logger.info(f"Found {len(all_twilio_numbers)} Twilio subaccounts to check")

    if not all_twilio_numbers:
        logger.info("No subaccounts to check. Done.")
        return {"checked": 0, "suspended": 0}

    suspended_count = 0

    for entry in all_twilio_numbers:
        sid = entry["subAccountSid"]
        chat_id = entry["chatId"]
        phone_number = entry["phoneNumber"]

        # Check if there's an existing unresolved suspension event
        existing = await suspension_events_coll.find_one({
            "subAccountSid": sid,
            "status": "suspended",
            "resolved": False,
        })

        # If already fully notified (user + admin), skip Twilio API call entirely
        if existing and existing.get("notifiedUser") and existing.get("notifiedAdmin"):
            logger.info(f"Already fully notified for {sid}, skipping")
            continue

        # 2. Check status via Twilio API
        status_info = await check_twilio_subaccount_status(http_client, sid)

        if status_info.get("status") == "suspended":
            logger.warning(f"SUSPENDED: {sid} | {phone_number} | chatId={chat_id}")

            if existing:
                # Retry failed notifications only
                chat_id_str = str(int(chat_id)) if isinstance(chat_id, float) else str(chat_id)
                updates = {}

                if not existing.get("notifiedUser"):
                    user_message = (
                        f"\u26a0\ufe0f <b>Caller ID Flagged</b>\n\n"
                        f"Your caller ID <b>{phone_number}</b> has been flagged and suspended by the carrier.\n\n"
                        f"This number can no longer be used for outbound calls or campaigns.\n\n"
                        f"\U0001f449 Please purchase a new number from the <b>Cloud IVR + SIP</b> menu to continue making calls.\n\n"
                        f"If you have any questions, contact support."
                    )
                    user_notified = await send_telegram_message(http_client, chat_id_str, user_message)
                    if user_notified:
                        updates["notifiedUser"] = True
                        logger.info(f"Retry: user notification succeeded for {sid}")

                if not existing.get("notifiedAdmin"):
                    user_notif_status = "\u2705" if updates.get("notifiedUser", existing.get("notifiedUser")) else "\u274c (retry pending)"
                    admin_message = (
                        f"\U0001f534 <b>Subaccount Suspended</b>\n\n"
                        f"SID: <code>{sid}</code>\n"
                        f"User: {chat_id} ({existing.get('friendlyName', 'N/A')})\n"
                        f"Number: {phone_number}\n"
                        f"Detected: {existing.get('detectedAt', 'N/A')}\n"
                        f"User notified: {user_notif_status}"
                    )
                    admin_notified = await notify_admin(http_client, admin_message)
                    if admin_notified:
                        updates["notifiedAdmin"] = True

                if updates:
                    await suspension_events_coll.update_one(
                        {"_id": existing["_id"]},
                        {"$set": updates},
                    )
                continue

            # NEW suspension — first detection

            # 3b. Mark the phone number as suspended in MongoDB
            await phone_numbers_coll.update_one(
                {"_id": chat_id, "val.numbers.twilioSubAccountSid": sid},
                {"$set": {"val.numbers.$.status": "suspended"}},
            )
            logger.info(f"Marked {phone_number} as suspended in DB")

            # 3c. Record the suspension event
            event = {
                "subAccountSid": sid,
                "chatId": chat_id,
                "phoneNumber": phone_number,
                "plan": entry.get("plan"),
                "status": "suspended",
                "friendlyName": status_info.get("friendly_name", ""),
                "detectedAt": datetime.now(timezone.utc),
                "notifiedUser": False,
                "notifiedAdmin": False,
                "resolved": False,
            }
            await suspension_events_coll.insert_one(event)

            # 3d. Notify the user via Telegram (one-time, retried if failed)
            user_message = (
                f"\u26a0\ufe0f <b>Caller ID Flagged</b>\n\n"
                f"Your caller ID <b>{phone_number}</b> has been flagged and suspended by the carrier.\n\n"
                f"This number can no longer be used for outbound calls or campaigns.\n\n"
                f"\U0001f449 Please purchase a new number from the <b>Cloud IVR + SIP</b> menu to continue making calls.\n\n"
                f"If you have any questions, contact support."
            )

            chat_id_str = str(int(chat_id)) if isinstance(chat_id, float) else str(chat_id)
            user_notified = await send_telegram_message(http_client, chat_id_str, user_message)

            # 3e. Notify admin
            user_notif_icon = "\u2705" if user_notified else "\u274c (will retry)"
            admin_message = (
                f"\U0001f534 <b>Subaccount Suspended</b>\n\n"
                f"SID: <code>{sid}</code>\n"
                f"User: {chat_id} ({status_info.get('friendly_name', 'N/A')})\n"
                f"Number: {phone_number}\n"
                f"Detected: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n"
                f"User notified: {user_notif_icon}"
            )
            admin_notified = await notify_admin(http_client, admin_message)

            # Update notification status
            await suspension_events_coll.update_one(
                {"subAccountSid": sid, "resolved": False},
                {"$set": {
                    "notifiedUser": user_notified,
                    "notifiedAdmin": admin_notified,
                }},
            )

            suspended_count += 1

        elif status_info.get("status") == "active":
            # Check if this was previously suspended and is now reactivated
            existing = await suspension_events_coll.find_one({
                "subAccountSid": sid,
                "status": "suspended",
                "resolved": False,
            })
            if existing:
                logger.info(f"Subaccount {sid} reactivated — resolving suspension event")
                await suspension_events_coll.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "resolved": True,
                        "resolvedAt": datetime.now(timezone.utc),
                    }},
                )
                # Reactivate the phone number in DB
                await phone_numbers_coll.update_one(
                    {"_id": chat_id, "val.numbers.twilioSubAccountSid": sid},
                    {"$set": {"val.numbers.$.status": "active"}},
                )

        elif status_info.get("status") == "error":
            logger.error(f"Could not check {sid}: {status_info.get('error')}")

    logger.info(f"=== Health check complete: {len(all_twilio_numbers)} checked, {suspended_count} newly suspended ===")
    return {"checked": len(all_twilio_numbers), "suspended": suspended_count}
