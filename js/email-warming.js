/**
 * IP Warming Scheduler — Automated warm-up for new sending IPs
 * Enforces daily/hourly limits, auto-graduates IPs, monitors bounce rates
 */

let _db = null;
let _ipWarmingCol = null;
let _bot = null;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

// 8-stage warming schedule
const WARMING_STAGES = [
  { name: 'seed',       dayStart: 1,  dayEnd: 3,   dailyLimit: 20,    hourlyLimit: 5,    emoji: '\u{1F7E1}' },
  { name: 'foundation', dayStart: 4,  dayEnd: 7,   dailyLimit: 50,    hourlyLimit: 10,   emoji: '\u{1F7E1}' },
  { name: 'rampup',     dayStart: 8,  dayEnd: 14,  dailyLimit: 100,   hourlyLimit: 20,   emoji: '\u{1F7E0}' },
  { name: 'building',   dayStart: 15, dayEnd: 21,  dailyLimit: 300,   hourlyLimit: 50,   emoji: '\u{1F7E0}' },
  { name: 'scaling',    dayStart: 22, dayEnd: 30,  dailyLimit: 800,   hourlyLimit: 120,  emoji: '\u{1F535}' },
  { name: 'maturing',   dayStart: 31, dayEnd: 45,  dailyLimit: 2000,  hourlyLimit: 300,  emoji: '\u{1F535}' },
  { name: 'warm',       dayStart: 46, dayEnd: 60,  dailyLimit: 5000,  hourlyLimit: 750,  emoji: '\u{1F7E2}' },
  { name: 'full',       dayStart: 61, dayEnd: 9999, dailyLimit: 10000, hourlyLimit: 1500, emoji: '\u{1F7E2}' }
];

function getStage(day) {
  for (const s of WARMING_STAGES) {
    if (day >= s.dayStart && day <= s.dayEnd) return s;
  }
  return WARMING_STAGES[WARMING_STAGES.length - 1];
}

/**
 * Initialize the warming service
 */
function initWarming(db, bot) {
  _db = db;
  _ipWarmingCol = db.collection('emailIpWarming');
  _bot = bot;

  // Reset hourly counters every hour
  setInterval(resetHourlyCounts, 60 * 60 * 1000);

  // Advance day counters at midnight UTC
  setInterval(advanceDays, 60 * 60 * 1000); // check every hour

  console.log('[EmailWarming] Initialized with 8-stage schedule');
}

/**
 * Start warming a new IP
 */
async function startWarming(ip, domain) {
  const existing = await _ipWarmingCol.findOne({ ip });
  if (existing) {
    return { success: false, error: 'IP already in warming schedule' };
  }

  const stage = WARMING_STAGES[0];
  const doc = {
    ip,
    domain,
    startDate: new Date(),
    currentDay: 1,
    stage: stage.name,
    dailyLimit: stage.dailyLimit,
    hourlyLimit: stage.hourlyLimit,
    dailySent: 0,
    hourlySent: 0,
    hourlyResetAt: new Date(),
    totalSent: 0,
    totalBounced: 0,
    bounceRate: 0,
    isWarm: false,
    isPaused: false,
    graduatedAt: null,
    history: []
  };

  await _ipWarmingCol.insertOne(doc);
  return { success: true, stage: stage.name, dailyLimit: stage.dailyLimit };
}

/**
 * Get current warming status for an IP
 */
async function getWarmingStatus(ip) {
  return _ipWarmingCol.findOne({ ip });
}

/**
 * Get all warming entries
 */
async function getAllWarming() {
  return _ipWarmingCol.find({}).toArray();
}

/**
 * Check if an IP can send more emails right now
 * Returns { canSend: bool, dailyRemaining, hourlyRemaining, reason }
 */
async function canSend(ip) {
  const w = await _ipWarmingCol.findOne({ ip });
  if (!w) {
    // IP not in warming = no limits (assume fully warm or not tracked)
    return { canSend: true, dailyRemaining: 99999, hourlyRemaining: 99999 };
  }

  if (w.isPaused) {
    return { canSend: false, dailyRemaining: 0, hourlyRemaining: 0, reason: 'IP warming paused' };
  }

  if (w.isWarm) {
    // Warm IPs still have high limits but not unlimited
    const stage = WARMING_STAGES[WARMING_STAGES.length - 1];
    const dailyRem = stage.dailyLimit - w.dailySent;
    const hourlyRem = stage.hourlyLimit - w.hourlySent;
    if (dailyRem <= 0) return { canSend: false, dailyRemaining: 0, hourlyRemaining: hourlyRem, reason: 'Daily limit reached' };
    if (hourlyRem <= 0) return { canSend: false, dailyRemaining: dailyRem, hourlyRemaining: 0, reason: 'Hourly limit reached' };
    return { canSend: true, dailyRemaining: dailyRem, hourlyRemaining: hourlyRem };
  }

  const dailyRem = w.dailyLimit - w.dailySent;
  const hourlyRem = w.hourlyLimit - w.hourlySent;

  if (dailyRem <= 0) return { canSend: false, dailyRemaining: 0, hourlyRemaining: hourlyRem, reason: 'Daily warming limit reached' };
  if (hourlyRem <= 0) return { canSend: false, dailyRemaining: dailyRem, hourlyRemaining: 0, reason: 'Hourly warming limit reached' };

  return { canSend: true, dailyRemaining: dailyRem, hourlyRemaining: hourlyRem };
}

/**
 * Record that emails were sent from this IP
 */
async function recordSent(ip, count, bounced = 0) {
  await _ipWarmingCol.updateOne({ ip }, {
    $inc: {
      dailySent: count,
      hourlySent: count,
      totalSent: count,
      totalBounced: bounced
    }
  });

  // Recalculate bounce rate
  const w = await _ipWarmingCol.findOne({ ip });
  if (w && w.totalSent > 0) {
    const br = ((w.totalBounced / w.totalSent) * 100).toFixed(2);
    await _ipWarmingCol.updateOne({ ip }, { $set: { bounceRate: parseFloat(br) } });

    // Auto-pause if bounce rate > 5%
    if (parseFloat(br) > 5 && w.totalSent > 50) {
      await pauseWarming(ip);
      if (_bot && ADMIN_CHAT_ID) {
        _bot.sendMessage(ADMIN_CHAT_ID,
          `\u26A0\uFE0F <b>[Email Warming] IP ${ip} AUTO-PAUSED</b>\nBounce rate: ${br}% (threshold: 5%)\nTotal sent: ${w.totalSent}, Bounced: ${w.totalBounced}`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }
  }
}

/**
 * Pause warming for an IP
 */
async function pauseWarming(ip) {
  await _ipWarmingCol.updateOne({ ip }, { $set: { isPaused: true } });
}

/**
 * Resume warming for an IP
 */
async function resumeWarming(ip) {
  await _ipWarmingCol.updateOne({ ip }, { $set: { isPaused: false } });
}

/**
 * Remove an IP from warming
 */
async function removeWarming(ip) {
  await _ipWarmingCol.deleteOne({ ip });
}

/**
 * Reset hourly counters for all IPs
 */
async function resetHourlyCounts() {
  if (!_ipWarmingCol) return;
  await _ipWarmingCol.updateMany({}, { $set: { hourlySent: 0, hourlyResetAt: new Date() } });
}

/**
 * Advance day counters and update stages
 * Should be called periodically (every hour, checks if new day)
 */
async function advanceDays() {
  if (!_ipWarmingCol) return;

  const allIps = await _ipWarmingCol.find({ isWarm: false, isPaused: false }).toArray();
  const now = new Date();

  for (const w of allIps) {
    const daysSinceStart = Math.floor((now - new Date(w.startDate)) / (1000 * 60 * 60 * 24)) + 1;

    if (daysSinceStart !== w.currentDay) {
      // New day — save history, reset daily counter, advance stage
      const todayHistory = {
        date: new Date().toISOString().split('T')[0],
        sent: w.dailySent,
        bounced: w.totalBounced - (w.history.reduce((s, h) => s + (h.bounced || 0), 0))
      };

      const newStage = getStage(daysSinceStart);
      const isNowWarm = daysSinceStart > 60 && w.bounceRate < 2;

      await _ipWarmingCol.updateOne({ ip: w.ip }, {
        $set: {
          currentDay: daysSinceStart,
          stage: newStage.name,
          dailyLimit: newStage.dailyLimit,
          hourlyLimit: newStage.hourlyLimit,
          dailySent: 0,
          isWarm: isNowWarm,
          graduatedAt: isNowWarm ? now : null
        },
        $push: { history: todayHistory }
      });

      // Notify admin on graduation
      if (isNowWarm && _bot && ADMIN_CHAT_ID) {
        _bot.sendMessage(ADMIN_CHAT_ID,
          `\u{1F389} <b>[Email Warming] IP ${w.ip} is now WARM!</b>\nDomain: ${w.domain}\nDays: ${daysSinceStart}\nBounce rate: ${w.bounceRate}%\nTotal sent: ${w.totalSent}`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }

      // Notify admin on stage change
      if (newStage.name !== w.stage && _bot && ADMIN_CHAT_ID) {
        _bot.sendMessage(ADMIN_CHAT_ID,
          `${newStage.emoji} <b>[Email Warming] IP ${w.ip}</b>\nStage: ${w.stage} → ${newStage.name}\nNew daily limit: ${newStage.dailyLimit}\nDay ${daysSinceStart}/60`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }
  }
}

/**
 * Get total available capacity across all IPs right now
 */
async function getTotalCapacity() {
  const allIps = await _ipWarmingCol.find({ isPaused: false }).toArray();
  let totalDaily = 0;
  let totalHourly = 0;

  for (const w of allIps) {
    const stage = w.isWarm ? WARMING_STAGES[WARMING_STAGES.length - 1] : getStage(w.currentDay);
    totalDaily += Math.max(0, stage.dailyLimit - w.dailySent);
    totalHourly += Math.max(0, stage.hourlyLimit - w.hourlySent);
  }

  return { totalDaily, totalHourly, ipCount: allIps.length };
}

/**
 * Pick the best IP to send from (most capacity, respects warming)
 */
async function pickBestIp() {
  const allIps = await _ipWarmingCol.find({ isPaused: false }).toArray();
  if (allIps.length === 0) return null;

  let best = null;
  let bestCapacity = -1;

  for (const w of allIps) {
    const check = await canSend(w.ip);
    if (check.canSend && check.dailyRemaining > bestCapacity) {
      bestCapacity = check.dailyRemaining;
      best = w;
    }
  }

  return best;
}

module.exports = {
  initWarming,
  startWarming,
  getWarmingStatus,
  getAllWarming,
  canSend,
  recordSent,
  pauseWarming,
  resumeWarming,
  removeWarming,
  getTotalCapacity,
  pickBestIp,
  WARMING_STAGES,
  getStage
};
