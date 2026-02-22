// Daily Coupon System — auto-generates 5% and 10% coupons daily
// Each coupon is single-use per user, expires at UTC midnight

const schedule = require('node-schedule')
const { customAlphabet } = require('nanoid')
const { log } = require('console')

const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

function initDailyCoupons(db, bot, nameOfCol, stateCol) {
  const dailyCouponsCol = db.collection('dailyCoupons')
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

  // Generate today's coupons
  async function generateDailyCoupons() {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    // Check if already generated today
    const existing = await dailyCouponsCol.findOne({ date: today })
    if (existing) {
      log(`[DailyCoupon] Coupons already exist for ${today}`)
      return existing
    }

    const code5 = `NMD5${generateCode()}`
    const code10 = `NMD10${generateCode()}`

    const coupons = {
      _id: today,
      date: today,
      codes: {
        [code5]: { discount: 5, usedBy: [] },
        [code10]: { discount: 10, usedBy: [] },
      },
      createdAt: new Date(),
    }

    await dailyCouponsCol.insertOne(coupons)
    log(`[DailyCoupon] Generated: ${code5} (5%) and ${code10} (10%) for ${today}`)

    if (adminChatId) {
      bot.sendMessage(adminChatId, `<b>Daily Coupons Generated</b>\n\n<code>${code5}</code> — 5% off\n<code>${code10}</code> — 10% off\n\nValid today only. Single use per customer.`, { parse_mode: 'HTML' }).catch(() => {})
    }

    return coupons
  }

  // Validate a coupon code — returns discount % or null
  async function validateDailyCoupon(code, chatId) {
    const today = new Date().toISOString().slice(0, 10)
    const record = await dailyCouponsCol.findOne({ date: today })
    if (!record?.codes?.[code]) return null

    const coupon = record.codes[code]
    if (coupon.usedBy.includes(chatId)) return { error: 'already_used' }

    return { discount: coupon.discount }
  }

  // Mark coupon as used by a user
  async function markCouponUsed(code, chatId) {
    const today = new Date().toISOString().slice(0, 10)
    await dailyCouponsCol.updateOne(
      { date: today },
      { $push: { [`codes.${code}.usedBy`]: chatId } }
    )
    log(`[DailyCoupon] ${code} used by ${chatId}`)
  }

  // Get today's coupon codes for broadcasting
  async function getTodayCoupons() {
    const today = new Date().toISOString().slice(0, 10)
    let record = await dailyCouponsCol.findOne({ date: today })
    if (!record) {
      record = await generateDailyCoupons()
    }
    return record?.codes || {}
  }

  // Schedule daily generation at 00:05 UTC
  schedule.scheduleJob('5 0 * * *', async () => {
    try {
      await generateDailyCoupons()
    } catch (err) {
      log(`[DailyCoupon] Generation error: ${err.message}`)
    }
  })

  // Generate on startup if none exist for today
  generateDailyCoupons().catch(err => {
    log(`[DailyCoupon] Startup generation error: ${err.message}`)
  })

  log('[DailyCoupon] System initialized')

  return {
    generateDailyCoupons,
    validateDailyCoupon,
    markCouponUsed,
    getTodayCoupons,
  }
}

module.exports = { initDailyCoupons }
