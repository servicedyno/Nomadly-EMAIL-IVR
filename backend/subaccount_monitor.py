"""
Phone Number Health Monitor
- Runs every 30 minutes
- Checks all active phone number accounts/statuses via provider APIs
- If a number is flagged/suspended: marks in MongoDB + notifies user via Telegram
- Tracks notified events to avoid duplicate alerts
- Retries failed user notifications until successful (one-time delivery)
"""

import os
import logging
import httpx
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger("phone_monitor")

TWILIO_API_BASE = "https://api.twilio.com/2010-04-01/Accounts"
TELNYX_API_BASE = "https://api.telnyx.com/v2"


def _get_twilio_creds():
    """Lazy load Twilio credentials (after dotenv is loaded)."""
    return os.environ.get("TWILIO_ACCOUNT_SID", ""), os.environ.get("TWILIO_AUTH_TOKEN", "")


def _get_telnyx_key():
    """Lazy load Telnyx API key (after dotenv is loaded)."""
    return os.environ.get("TELNYX_API_KEY", "")


def _get_telegram_config():
    """Lazy load Telegram config (after dotenv is loaded)."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN_PROD", "")
    admin_id = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "")
    return token, admin_id


# ============================================================
# PROVIDER API CHECKS
# ============================================================

async def check_twilio_subaccount_status(http_client: httpx.AsyncClient, subaccount_sid: str) -> dict:
    """Check a single Twilio subaccount's status via the REST API."""
    sid, token = _get_twilio_creds()
    url = f"{TWILIO_API_BASE}/{subaccount_sid}.json"
    try:
        response = await http_client.get(url, auth=(sid, token), timeout=15.0)
        if response.status_code == 200:
            data = response.json()
            return {
                "sid": data.get("sid"),
                "friendly_name": data.get("friendly_name"),
                "status": data.get("status"),
                "date_updated": data.get("date_updated"),
            }
        else:
            logger.error(f"Provider API returned {response.status_code} for subaccount {subaccount_sid}")
            return {"sid": subaccount_sid, "status": "error", "error": response.text[:200]}
    except Exception as e:
        logger.error(f"Error checking subaccount {subaccount_sid}: {e}")
        return {"sid": subaccount_sid, "status": "error", "error": str(e)}


async def check_telnyx_number_status(http_client: httpx.AsyncClient, phone_number: str) -> dict:
    """Check a Telnyx phone number's status via the API."""
    api_key = _get_telnyx_key()
    url = f"{TELNYX_API_BASE}/phone_numbers"
    params = {"filter[phone_number]": phone_number}
    try:
        response = await http_client.get(
            url, params=params,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
            timeout=15.0,
        )
        if response.status_code == 200:
            data = response.json()
            numbers = data.get("data", [])
            if numbers:
                num = numbers[0]
                return {
                    "id": num.get("id"),
                    "phone_number": num.get("phone_number"),
                    "status": num.get("status"),
                    "connection_name": num.get("connection_name"),
                    "updated_at": num.get("updated_at"),
                }
            else:
                # Number not found on account — it was removed/released
                return {"phone_number": phone_number, "status": "removed"}
        else:
            logger.error(f"Provider API returned {response.status_code} for number {phone_number}")
            return {"phone_number": phone_number, "status": "error", "error": response.text[:200]}
    except Exception as e:
        logger.error(f"Error checking number {phone_number}: {e}")
        return {"phone_number": phone_number, "status": "error", "error": str(e)}


# ============================================================
# TELEGRAM NOTIFICATIONS (provider-neutral)
# ============================================================

async def send_telegram_message(http_client: httpx.AsyncClient, chat_id: str, message: str) -> bool:
    """Send a message to a Telegram user via Bot API."""
    token, _ = _get_telegram_config()
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": message, "parse_mode": "HTML"}
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


def build_user_notification(phone_number: str) -> str:
    """Build a provider-neutral user notification message."""
    return (
        f"\u26a0\ufe0f <b>Caller ID Flagged</b>\n\n"
        f"Your caller ID <b>{phone_number}</b> has been flagged and suspended by the carrier.\n\n"
        f"This number can no longer be used for outbound calls or campaigns.\n\n"
        f"\U0001f449 Please purchase a new number from the "
        f"<b>Cloud IVR + SIP</b> menu to continue making calls.\n\n"
        f"If you have any questions, contact support."
    )


def build_admin_notification(chat_id, phone_number: str, provider: str, detail_id: str,
                             friendly_name: str, detected_at, user_notified: bool) -> str:
    """Build an admin notification with internal details."""
    notif_icon = "\u2705" if user_notified else "\u274c (will retry)"
    return (
        f"\U0001f534 <b>Number Suspended</b>\n\n"
        f"Provider: {provider}\n"
        f"ID: <code>{detail_id}</code>\n"
        f"User: {chat_id} ({friendly_name})\n"
        f"Number: {phone_number}\n"
        f"Detected: {detected_at}\n"
        f"User notified: {notif_icon}"
    )


# ============================================================
# NOTIFICATION HANDLER (shared by both providers)
# ============================================================

async def handle_suspension(
    db, http_client: httpx.AsyncClient,
    suspension_events_coll, phone_numbers_coll,
    chat_id, phone_number: str, provider: str,
    detail_id: str, friendly_name: str,
    db_query_filter: dict, db_status_path: str,
):
    """
    Handle a detected suspension — shared logic for both providers.
    Returns True if this was a new suspension, False if existing (retry only).
    """
    # Check for existing unresolved event
    existing = await suspension_events_coll.find_one({
        "phoneNumber": phone_number,
        "provider": provider,
        "status": "suspended",
        "resolved": False,
    })

    chat_id_str = str(int(chat_id)) if isinstance(chat_id, float) else str(chat_id)

    if existing:
        # Already detected — retry failed notifications only
        if existing.get("notifiedUser") and existing.get("notifiedAdmin"):
            return False  # fully notified, skip

        updates = {}

        if not existing.get("notifiedUser"):
            user_msg = build_user_notification(phone_number)
            if await send_telegram_message(http_client, chat_id_str, user_msg):
                updates["notifiedUser"] = True
                logger.info(f"Retry: user notification succeeded for {phone_number}")

        if not existing.get("notifiedAdmin"):
            admin_msg = build_admin_notification(
                chat_id, phone_number, provider, detail_id,
                existing.get("friendlyName", friendly_name),
                existing.get("detectedAt", "N/A"), updates.get("notifiedUser", False),
            )
            if await notify_admin(http_client, admin_msg):
                updates["notifiedAdmin"] = True

        if updates:
            await suspension_events_coll.update_one({"_id": existing["_id"]}, {"$set": updates})

        return False

    # NEW suspension — first detection

    # Mark the phone number as suspended in MongoDB
    await phone_numbers_coll.update_one(db_query_filter, {"$set": {db_status_path: "suspended"}})
    logger.info(f"Marked {phone_number} as suspended in DB")

    # Record the suspension event
    now = datetime.now(timezone.utc)
    event = {
        "provider": provider,
        "detailId": detail_id,
        "chatId": chat_id,
        "phoneNumber": phone_number,
        "plan": "",
        "status": "suspended",
        "friendlyName": friendly_name,
        "detectedAt": now,
        "notifiedUser": False,
        "notifiedAdmin": False,
        "resolved": False,
    }
    await suspension_events_coll.insert_one(event)

    # Notify user
    user_msg = build_user_notification(phone_number)
    user_notified = await send_telegram_message(http_client, chat_id_str, user_msg)

    # Notify admin (with internal provider details)
    admin_msg = build_admin_notification(
        chat_id, phone_number, provider, detail_id,
        friendly_name, now.strftime("%Y-%m-%d %H:%M UTC"), user_notified,
    )
    admin_notified = await notify_admin(http_client, admin_msg)

    # Update notification status
    await suspension_events_coll.update_one(
        {"phoneNumber": phone_number, "provider": provider, "resolved": False},
        {"$set": {"notifiedUser": user_notified, "notifiedAdmin": admin_notified}},
    )

    return True


async def handle_reactivation(
    db, suspension_events_coll, phone_numbers_coll,
    phone_number: str, provider: str,
    chat_id, db_query_filter: dict, db_status_path: str,
):
    """Handle a number that was previously suspended but is now active again."""
    existing = await suspension_events_coll.find_one({
        "phoneNumber": phone_number,
        "provider": provider,
        "status": "suspended",
        "resolved": False,
    })
    if existing:
        logger.info(f"Number {phone_number} reactivated — resolving suspension event")
        await suspension_events_coll.update_one(
            {"_id": existing["_id"]},
            {"$set": {"resolved": True, "resolvedAt": datetime.now(timezone.utc)}},
        )
        await phone_numbers_coll.update_one(db_query_filter, {"$set": {db_status_path: "active"}})


# ============================================================
# MAIN HEALTH CHECK
# ============================================================

async def run_health_check(db, http_client: httpx.AsyncClient):
    """
    Main health check routine — checks both Twilio subaccounts and Telnyx numbers.
    """
    logger.info("=== Phone number health check started ===")

    suspension_events_coll = db["suspensionEvents"]
    phone_numbers_coll = db["phoneNumbersOf"]

    total_checked = 0
    total_suspended = 0

    # ----------------------------------------------------------
    # TWILIO: Check subaccount statuses
    # ----------------------------------------------------------
    twilio_numbers = []
    async for doc in phone_numbers_coll.find({}):
        owner_chat_id = doc.get("_id")
        numbers = doc.get("val", {}).get("numbers", [])
        for num in numbers:
            if num.get("provider") == "twilio" and num.get("twilioSubAccountSid"):
                twilio_numbers.append({
                    "chatId": owner_chat_id,
                    "phoneNumber": num.get("phoneNumber"),
                    "subAccountSid": num.get("twilioSubAccountSid"),
                    "plan": num.get("plan"),
                })

    logger.info(f"Checking {len(twilio_numbers)} Twilio subaccounts")

    for entry in twilio_numbers:
        sid = entry["subAccountSid"]
        chat_id = entry["chatId"]
        phone_number = entry["phoneNumber"]

        # Skip if already fully notified
        existing = await suspension_events_coll.find_one({
            "phoneNumber": phone_number, "provider": "twilio",
            "status": "suspended", "resolved": False,
            "notifiedUser": True, "notifiedAdmin": True,
        })
        if existing:
            total_checked += 1
            continue

        status_info = await check_twilio_subaccount_status(http_client, sid)
        total_checked += 1

        if status_info.get("status") == "suspended":
            logger.warning(f"SUSPENDED: {phone_number} | chatId={chat_id}")
            is_new = await handle_suspension(
                db, http_client, suspension_events_coll, phone_numbers_coll,
                chat_id, phone_number, "twilio", sid,
                status_info.get("friendly_name", ""),
                {"_id": chat_id, "val.numbers.twilioSubAccountSid": sid},
                "val.numbers.$.status",
            )
            if is_new:
                total_suspended += 1

        elif status_info.get("status") == "active":
            await handle_reactivation(
                db, suspension_events_coll, phone_numbers_coll,
                phone_number, "twilio", chat_id,
                {"_id": chat_id, "val.numbers.twilioSubAccountSid": sid},
                "val.numbers.$.status",
            )

        elif status_info.get("status") == "error":
            logger.error(f"Could not check subaccount for {phone_number}: {status_info.get('error')}")

    # ----------------------------------------------------------
    # TELNYX: Check number statuses
    # ----------------------------------------------------------
    telnyx_numbers = []
    async for doc in phone_numbers_coll.find({}):
        owner_chat_id = doc.get("_id")
        numbers = doc.get("val", {}).get("numbers", [])
        for num in numbers:
            if (
                num.get("provider") == "telnyx"
                and num.get("phoneNumber")
                and num.get("status") not in ("released", "expired", "cancelled")
            ):
                telnyx_numbers.append({
                    "chatId": owner_chat_id,
                    "phoneNumber": num.get("phoneNumber"),
                    "connectionId": num.get("connectionId", ""),
                    "plan": num.get("plan"),
                })

    logger.info(f"Checking {len(telnyx_numbers)} Telnyx numbers")

    for entry in telnyx_numbers:
        chat_id = entry["chatId"]
        phone_number = entry["phoneNumber"]

        # Skip if already fully notified
        existing = await suspension_events_coll.find_one({
            "phoneNumber": phone_number, "provider": "telnyx",
            "status": "suspended", "resolved": False,
            "notifiedUser": True, "notifiedAdmin": True,
        })
        if existing:
            total_checked += 1
            continue

        status_info = await check_telnyx_number_status(http_client, phone_number)
        total_checked += 1

        telnyx_status = status_info.get("status", "")

        if telnyx_status in ("removed", "inactive", "port_pending", "deleted"):
            # Number is no longer active on the provider
            logger.warning(f"FLAGGED ({telnyx_status}): {phone_number} | chatId={chat_id}")
            detail_id = status_info.get("id", phone_number)
            conn_name = status_info.get("connection_name", "")
            is_new = await handle_suspension(
                db, http_client, suspension_events_coll, phone_numbers_coll,
                chat_id, phone_number, "telnyx", str(detail_id),
                conn_name,
                {"_id": chat_id, "val.numbers.phoneNumber": phone_number},
                "val.numbers.$.status",
            )
            if is_new:
                total_suspended += 1

        elif telnyx_status == "active":
            await handle_reactivation(
                db, suspension_events_coll, phone_numbers_coll,
                phone_number, "telnyx", chat_id,
                {"_id": chat_id, "val.numbers.phoneNumber": phone_number},
                "val.numbers.$.status",
            )

        elif telnyx_status == "error":
            logger.error(f"Could not check number {phone_number}: {status_info.get('error')}")

    logger.info(f"=== Health check complete: {total_checked} checked, {total_suspended} newly suspended ===")
    return {"checked": total_checked, "suspended": total_suspended}
