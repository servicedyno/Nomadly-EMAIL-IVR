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
 * Build user notification (provider-neutral — no mention of Twilio/Telnyx)
 */
function buildUserMessage(phoneNumber) {
  return (
    `⚠️ <b>Caller ID Flagged</b>\n\n` +
    `Your caller ID <b>${phoneNumber}</b> has been flagged and suspended by the carrier.\n\n` +
    `This number can no longer be used for outbound calls or campaigns.\n\n` +
    `👉 Please purchase a new number from the <b>Cloud IVR + SIP</b> menu to continue making calls.\n\n` +
    `If you have any questions, contact support.`
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

  console.log(`[PhoneMonitor] === Health check complete: ${totalChecked} checked, ${totalSuspended} newly suspended ===`);
  return { checked: totalChecked, suspended: totalSuspended };
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
        await bot.telegram.sendMessage(chatIdStr, buildUserMessage(phoneNumber), { parse_mode: 'HTML' });
        updates.notifiedUser = true;
        console.log(`[PhoneMonitor] Retry: user notification succeeded for ${phoneNumber}`);
      } catch (err) {
        console.error(`[PhoneMonitor] Retry: user notification failed for ${phoneNumber}:`, err.message);
      }
    }

    if (!existing.notifiedAdmin && ADMIN_CHAT_ID) {
      try {
        const adminMsg = buildAdminMessage(chatId, phoneNumber, provider, detailId, friendlyName, updates.notifiedUser || existing.notifiedUser);
        await bot.telegram.sendMessage(ADMIN_CHAT_ID, adminMsg, { parse_mode: 'HTML' });
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
    await bot.telegram.sendMessage(chatIdStr, buildUserMessage(phoneNumber), { parse_mode: 'HTML' });
    userNotified = true;
    console.log(`[PhoneMonitor] User ${chatIdStr} notified about ${phoneNumber}`);
  } catch (err) {
    console.error(`[PhoneMonitor] User notification failed for ${chatIdStr}:`, err.message);
  }

  // Notify admin (with internal provider details)
  let adminNotified = false;
  if (ADMIN_CHAT_ID) {
    try {
      await bot.telegram.sendMessage(ADMIN_CHAT_ID, buildAdminMessage(chatId, phoneNumber, provider, detailId, friendlyName, userNotified), { parse_mode: 'HTML' });
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
