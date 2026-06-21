/**
 * Phone Number Health Monitor
 * - Runs every 30 minutes via setInterval
 * - Checks all active phone number accounts/statuses via provider APIs
 * - If a number is flagged/suspended: marks in MongoDB + notifies user via Telegram
 * - One-time notification with retry until delivered
 * 
 * USAGE: Import and call initPhoneMonitor(bot, db) during bot startup
 * 
 * Dependencies: axios (already in your project)
 */

const axios = require('axios');
const { translation } = require('./translation');

// Config from environment
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check a Twilio subaccount's status
 */
async function checkTwilioSubaccount(subAccountSid) {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${subAccountSid}.json`;
    const resp = await axios.get(url, {
      auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
      timeout: 15000,
    });
    return {
      sid: resp.data.sid,
      friendlyName: resp.data.friendly_name,
      status: resp.data.status,
    };
  } catch (err) {
    // HTTP 401 on a sub-account means Twilio is refusing parent-auth against it —
    // typically because Twilio CLOSED/SUSPENDED that sub-account.  Surface it as
    // 'auth_failed' so the suspension flow kicks in instead of looping forever
    // (this matters for paid customers — see /app/UX_ANOMALY_REPORT.md).
    if (err.response?.status === 401) {
      console.error(`[PhoneMonitor] AUTH_FAILED (likely sub-account suspended by provider): ${subAccountSid}`);
      return { sid: subAccountSid, status: 'auth_failed', error: '401 Unauthorized' };
    }
    console.error(`[PhoneMonitor] Error checking subaccount ${subAccountSid}:`, err.message);
    return { sid: subAccountSid, status: 'error', error: err.message };
  }
}

/**
 * Check a Telnyx number's status
 */
async function checkTelnyxNumber(phoneNumber) {
  try {
    const resp = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, Accept: 'application/json' },
      params: { 'filter[phone_number]': phoneNumber },
      timeout: 15000,
    });
    const numbers = resp.data?.data || [];
    if (numbers.length > 0) {
      return {
        id: numbers[0].id,
        phoneNumber: numbers[0].phone_number,
        status: numbers[0].status,
        connectionName: numbers[0].connection_name,
      };
    }
    // Number not found — removed/released from provider
    return { phoneNumber, status: 'removed' };
  } catch (err) {
    console.error(`[PhoneMonitor] Error checking number ${phoneNumber}:`, err.message);
    return { phoneNumber, status: 'error', error: err.message };
  }
}

/**
 * Build user notification (provider-neutral — no mention of Twilio/Telnyx).
 * Localised — pass user's preferred language ('en'|'fr'|'zh'|'hi').
 */
function buildUserMessage(phoneNumber, lang = 'en') {
  return (
    translation('t.phoneCallerIdFlaggedTitle', lang)
    + '\n\n'
    + translation('t.phoneCallerIdFlaggedBody', lang, phoneNumber)
  );
}

/**
 * Build admin notification (internal — includes provider details)
 */
function buildAdminMessage(chatId, phoneNumber, provider, detailId, friendlyName, userNotified) {
  const icon = userNotified ? '✅' : '❌ (will retry)';
  return (
    `🔴 <b>Number Suspended</b>\n\n` +
    `Provider: ${provider}\n` +
    `ID: <code>${detailId}</code>\n` +
    `User: ${chatId} (${friendlyName})\n` +
    `Number: ${phoneNumber}\n` +
    `Detected: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC\n` +
    `User notified: ${icon}`
  );
}

/**
 * Main health check routine
 */
async function runHealthCheck(bot, db) {
  console.log('[PhoneMonitor] === Health check started ===');

  const suspensionEvents = db.collection('suspensionEvents');
  const phoneNumbersOf = db.collection('phoneNumbersOf');

  let totalChecked = 0;
  let totalSuspended = 0;
  const authFailedSubs = [];  // sub-accounts returning 401 on parent-auth — needs admin investigation

  // Get all phone number records
  const allDocs = await phoneNumbersOf.find({}).toArray();

  // ----------------------------------------------------------
  // TWILIO: Check subaccount statuses
  // ----------------------------------------------------------
  const twilioNumbers = [];
  for (const doc of allDocs) {
    const numbers = doc.val?.numbers || [];
    for (const num of numbers) {
      if (num.provider === 'twilio' && num.twilioSubAccountSid) {
        twilioNumbers.push({
          chatId: doc._id,
          phoneNumber: num.phoneNumber,
          subAccountSid: num.twilioSubAccountSid,
          plan: num.plan,
        });
      }
    }
  }

  console.log(`[PhoneMonitor] Checking ${twilioNumbers.length} Twilio subaccounts`);

  for (const entry of twilioNumbers) {
    const { subAccountSid: sid, chatId, phoneNumber } = entry;

    // Skip if already fully notified
    const fullyNotified = await suspensionEvents.findOne({
      phoneNumber, provider: 'twilio', status: 'suspended',
      resolved: false, notifiedUser: true, notifiedAdmin: true,
    });
    if (fullyNotified) { totalChecked++; continue; }

    const statusInfo = await checkTwilioSubaccount(sid);
    totalChecked++;

    if (statusInfo.status === 'suspended') {
      console.log(`[PhoneMonitor] SUSPENDED: ${phoneNumber} | chatId=${chatId}`);
      const isNew = await handleSuspension(
        bot, db, suspensionEvents, phoneNumbersOf,
        chatId, phoneNumber, 'twilio', sid,
        statusInfo.friendlyName || '',
        { _id: chatId, 'val.numbers.twilioSubAccountSid': sid },
        'val.numbers.$.status',
      );
      if (isNew) totalSuspended++;
    } else if (statusInfo.status === 'auth_failed') {
      // 401 on the sub-account fetch — DO NOT alarm the user (number may still work
      // for live traffic; this could be a credentials / Twilio-side issue we need
      // to investigate first).  Track once + alert admin.
      authFailedSubs.push({ subAccountSid: sid, chatId, phoneNumber });
    } else if (statusInfo.status === 'active') {
      await handleReactivation(
        suspensionEvents, phoneNumbersOf, phoneNumber, 'twilio', chatId,
        { _id: chatId, 'val.numbers.twilioSubAccountSid': sid },
        'val.numbers.$.status',
      );
    }
  }

  // ----------------------------------------------------------
  // TELNYX: Check number statuses
  // ----------------------------------------------------------
  const telnyxNumbers = [];
  for (const doc of allDocs) {
    const numbers = doc.val?.numbers || [];
    for (const num of numbers) {
      if (num.provider === 'telnyx' && num.phoneNumber &&
          !['released', 'expired', 'cancelled'].includes(num.status)) {
        telnyxNumbers.push({
          chatId: doc._id,
          phoneNumber: num.phoneNumber,
          connectionId: num.connectionId || '',
          plan: num.plan,
        });
      }
    }
  }

  console.log(`[PhoneMonitor] Checking ${telnyxNumbers.length} Telnyx numbers`);

  for (const entry of telnyxNumbers) {
    const { chatId, phoneNumber } = entry;

    const fullyNotified = await suspensionEvents.findOne({
      phoneNumber, provider: 'telnyx', status: 'suspended',
      resolved: false, notifiedUser: true, notifiedAdmin: true,
    });
    if (fullyNotified) { totalChecked++; continue; }

    const statusInfo = await checkTelnyxNumber(phoneNumber);
    totalChecked++;

    if (['removed', 'inactive', 'port_pending', 'deleted'].includes(statusInfo.status)) {
      console.log(`[PhoneMonitor] FLAGGED (${statusInfo.status}): ${phoneNumber} | chatId=${chatId}`);
      const isNew = await handleSuspension(
        bot, db, suspensionEvents, phoneNumbersOf,
        chatId, phoneNumber, 'telnyx', String(statusInfo.id || phoneNumber),
        statusInfo.connectionName || '',
        { _id: chatId, 'val.numbers.phoneNumber': phoneNumber },
        'val.numbers.$.status',
      );
      if (isNew) totalSuspended++;
    } else if (statusInfo.status === 'active') {
      await handleReactivation(
        suspensionEvents, phoneNumbersOf, phoneNumber, 'telnyx', chatId,
        { _id: chatId, 'val.numbers.phoneNumber': phoneNumber },
        'val.numbers.$.status',
      );
    }
  }

  console.log(`[PhoneMonitor] === Health check complete: ${totalChecked} checked, ${totalSuspended} newly suspended, ${authFailedSubs.length} auth-failed ===`);

  // Send a once-per-day admin digest about auth-failed sub-accounts (deduped per sub).
  // These are paid customers' lines we can no longer poll; admin needs to rotate
  // the sub-account auth token in Twilio console or open a ticket with Twilio.
  if (authFailedSubs.length > 0 && ADMIN_CHAT_ID) {
    try {
      const authFailedEvents = db.collection('phoneMonitorAuthFailed');
      const today = new Date().toISOString().slice(0, 10);
      const fresh = [];
      for (const entry of authFailedSubs) {
        const key = `${today}:${entry.subAccountSid}`;
        const existing = await authFailedEvents.findOne({ _id: key });
        if (existing) continue;
        await authFailedEvents.insertOne({
          _id: key,
          subAccountSid: entry.subAccountSid,
          chatId: entry.chatId,
          phoneNumber: entry.phoneNumber,
          notifiedAt: new Date(),
        });
        fresh.push(entry);
      }
      if (fresh.length > 0) {
        const lines = fresh.map(e => `• <code>${e.subAccountSid}</code>  →  ${e.phoneNumber}  (chat ${e.chatId})`);
        const msg =
          `🔧 <b>Twilio sub-account auth check failed (401)</b>\n\n` +
          `${fresh.length} sub-account(s) returning <b>401 Unauthorized</b> against parent-auth poll.\n` +
          `These are <i>paid customer lines</i> we cannot manage via API right now.\n\n` +
          lines.join('\n') +
          `\n\n<b>Action:</b> rotate each sub-account's auth token in the Twilio console, or open a Twilio support ticket for the closed sub-accounts.`;
        await bot.sendMessage(ADMIN_CHAT_ID, msg, { parse_mode: 'HTML', disable_web_page_preview: true });
        console.log(`[PhoneMonitor] Admin digest sent for ${fresh.length} auth-failed sub-account(s)`);
      }
    } catch (err) {
      console.error(`[PhoneMonitor] Auth-failed admin digest error:`, err.message);
    }
  }

  return { checked: totalChecked, suspended: totalSuspended, authFailed: authFailedSubs.length };
}

/**
 * Handle a detected suspension — shared logic for both providers
 */
async function handleSuspension(
  bot, db, suspensionEvents, phoneNumbersOf,
  chatId, phoneNumber, provider, detailId, friendlyName,
  dbQueryFilter, dbStatusPath,
) {
  const chatIdStr = String(typeof chatId === 'number' ? Math.floor(chatId) : chatId);

  // Resolve user language for localised notification
  let userLang = 'en';
  try {
    const userState = await db.collection('state').findOne({ _id: chatIdStr });
    userLang = userState?.userLanguage || 'en';
  } catch (_) { /* fallback to en */ }

  // Check for existing unresolved event
  const existing = await suspensionEvents.findOne({
    phoneNumber, provider, status: 'suspended', resolved: false,
  });

  if (existing) {
    // Retry failed notifications only
    if (existing.notifiedUser && existing.notifiedAdmin) return false;

    const updates = {};

    if (!existing.notifiedUser) {
      try {
        await bot.sendMessage(chatIdStr, buildUserMessage(phoneNumber, userLang), { parse_mode: 'HTML' });
        updates.notifiedUser = true;
        console.log(`[PhoneMonitor] Retry: user notification succeeded for ${phoneNumber}`);
      } catch (err) {
        console.error(`[PhoneMonitor] Retry: user notification failed for ${phoneNumber}:`, err.message);
      }
    }

    if (!existing.notifiedAdmin && ADMIN_CHAT_ID) {
      try {
        const adminMsg = buildAdminMessage(chatId, phoneNumber, provider, detailId, friendlyName, updates.notifiedUser || existing.notifiedUser);
        await bot.sendMessage(ADMIN_CHAT_ID, adminMsg, { parse_mode: 'HTML' });
        updates.notifiedAdmin = true;
      } catch (err) {
        console.error(`[PhoneMonitor] Admin notification failed:`, err.message);
      }
    }

    if (Object.keys(updates).length > 0) {
      await suspensionEvents.updateOne({ _id: existing._id }, { $set: updates });
    }
    return false;
  }

  // NEW suspension — first detection

  // Mark number as suspended in DB
  await phoneNumbersOf.updateOne(dbQueryFilter, { $set: { [dbStatusPath]: 'suspended' } });
  console.log(`[PhoneMonitor] Marked ${phoneNumber} as suspended in DB`);

  // Record suspension event
  const event = {
    provider,
    detailId,
    chatId,
    phoneNumber,
    status: 'suspended',
    friendlyName,
    detectedAt: new Date(),
    notifiedUser: false,
    notifiedAdmin: false,
    resolved: false,
  };
  await suspensionEvents.insertOne(event);

  // Notify user (provider-neutral message)
  let userNotified = false;
  try {
    await bot.sendMessage(chatIdStr, buildUserMessage(phoneNumber, userLang), { parse_mode: 'HTML' });
    userNotified = true;
    console.log(`[PhoneMonitor] User ${chatIdStr} notified about ${phoneNumber}`);
  } catch (err) {
    console.error(`[PhoneMonitor] User notification failed for ${chatIdStr}:`, err.message);
  }

  // Notify admin (with internal provider details)
  let adminNotified = false;
  if (ADMIN_CHAT_ID) {
    try {
      await bot.sendMessage(ADMIN_CHAT_ID, buildAdminMessage(chatId, phoneNumber, provider, detailId, friendlyName, userNotified), { parse_mode: 'HTML' });
      adminNotified = true;
    } catch (err) {
      console.error(`[PhoneMonitor] Admin notification failed:`, err.message);
    }
  }

  // Update notification flags
  await suspensionEvents.updateOne(
    { phoneNumber, provider, resolved: false },
    { $set: { notifiedUser: userNotified, notifiedAdmin: adminNotified } },
  );

  return true;
}

/**
 * Handle reactivation of a previously suspended number
 */
async function handleReactivation(
  suspensionEvents, phoneNumbersOf, phoneNumber, provider, chatId,
  dbQueryFilter, dbStatusPath,
) {
  const existing = await suspensionEvents.findOne({
    phoneNumber, provider, status: 'suspended', resolved: false,
  });
  if (existing) {
    console.log(`[PhoneMonitor] ${phoneNumber} reactivated — resolving suspension event`);
    await suspensionEvents.updateOne(
      { _id: existing._id },
      { $set: { resolved: true, resolvedAt: new Date() } },
    );
    await phoneNumbersOf.updateOne(dbQueryFilter, { $set: { [dbStatusPath]: 'active' } });
  }
}

/**
 * Initialize the phone monitor — call this during bot startup
 * 
 * @param {Object} bot - Telegraf bot instance
 * @param {Object} db - MongoDB database instance
 */
function initPhoneMonitor(bot, db) {
  console.log('[PhoneMonitor] Initialized — checking every 30 minutes');

  // Run immediately on startup
  setTimeout(() => {
    runHealthCheck(bot, db).catch(err => {
      console.error('[PhoneMonitor] Startup check failed:', err.message);
    });
  }, 10000); // 10s delay to let other services initialize

  // Schedule recurring checks every 30 minutes
  setInterval(() => {
    runHealthCheck(bot, db).catch(err => {
      console.error('[PhoneMonitor] Scheduled check failed:', err.message);
    });
  }, CHECK_INTERVAL_MS);
}

module.exports = { initPhoneMonitor, runHealthCheck };
