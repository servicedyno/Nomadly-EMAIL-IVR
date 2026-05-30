/**
 * One-shot retro-credit for firstDepositBonus.
 *
 * Why this script exists
 *   Until 2026-05-30, `awardFirstDepositBonus` in `js/new-user-conversion.js`
 *   was effectively broken — the post-check on a mongo-driver-v5 wrapper field
 *   always returned `null` ("already awarded") even for new deposits. As a
 *   result, NO user ever received the $5 first-deposit bonus despite the
 *   feature being advertised in the welcome flow.
 *
 *   This one-shot scans `transactions` for completed wallet top-ups of
 *   $20 or more, finds users whose `userConversion.firstDepositBonusAwarded`
 *   is not true, and retro-credits them.
 *
 * Usage
 *   Dry run (default — prints what would change but writes nothing):
 *     railway run --service Nomadly-EMAIL-IVR --environment production -- node retro_first_deposit_bonus.js
 *
 *   Apply for real (writes credits + DMs users):
 *     railway run --service Nomadly-EMAIL-IVR --environment production -- node retro_first_deposit_bonus.js --apply
 *
 *   Apply silently (writes credits but does NOT DM users):
 *     railway run --service Nomadly-EMAIL-IVR --environment production -- node retro_first_deposit_bonus.js --apply --silent
 *
 *   Limit to N users (for staged rollout):
 *     railway run --service Nomadly-EMAIL-IVR --environment production -- node retro_first_deposit_bonus.js --apply --limit=50
 *
 * Idempotency
 *   Safe to re-run — once a user has `firstDepositBonusAwarded=true` they
 *   are skipped. The script also writes a `transactions` audit row of type
 *   `first-deposit-bonus-retro` so the credit is traceable.
 */

const { MongoClient } = require('mongodb')
const TelegramBot = require('node-telegram-bot-api')

const FIRST_DEPOSIT_BONUS_USD = 5
const FIRST_DEPOSIT_MIN_USD = 20

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const SILENT = args.includes('--silent')
const LIMIT = (() => {
  const a = args.find(x => x.startsWith('--limit='))
  return a ? parseInt(a.split('=')[1], 10) : 0
})()

const BONUS_MSG = {
  en: `🎁 <b>Surprise First-Deposit Bonus!</b>\n\nWe found a small issue with our first-deposit bonus and you didn't receive your <b>$${FIRST_DEPOSIT_BONUS_USD}</b> when you topped up — sorry about that!\n\nYour bonus has just been added to your wallet. Thanks for being with us.\n\n💡 /start to continue`,
  fr: `🎁 <b>Bonus de premier dépôt surprise !</b>\n\nNous avons trouvé un problème avec notre bonus de premier dépôt — vous n'avez pas reçu vos <b>$${FIRST_DEPOSIT_BONUS_USD}</b> lors de votre recharge. Désolé !\n\nLe bonus vient d'être ajouté à votre portefeuille. Merci !\n\n💡 /start pour continuer`,
  zh: `🎁 <b>意外的首充奖励！</b>\n\n我们发现首充奖励出了点问题，您首次充值时没有收到 <b>$${FIRST_DEPOSIT_BONUS_USD}</b>，非常抱歉！\n\n奖励已添加到您的钱包。感谢您的支持。\n\n💡 /start 继续`,
  hi: `🎁 <b>आश्चर्यजनक पहली जमा बोनस!</b>\n\nहमारे पहले डिपॉज़िट बोनस में एक छोटी समस्या थी — आपको टॉप-अप पर <b>$${FIRST_DEPOSIT_BONUS_USD}</b> नहीं मिले थे। हमें खेद है!\n\nआपका बोनस आपके वॉलेट में जोड़ दिया गया है। धन्यवाद!\n\n💡 जारी रखने के लिए /start`,
}

;(async () => {
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db()

  const txns = db.collection('transactions')
  const walletOf = db.collection('walletOf')
  const conversionCol = db.collection('userConversion')
  const state = db.collection('state')

  console.log(`#### firstDepositBonus retro-credit  (apply=${APPLY}  silent=${SILENT}  limit=${LIMIT || 'none'}) ####\n`)

  // 1) Find all completed wallet-topups ≥ MIN, grouped by chatId, earliest first per user
  const pipeline = [
    {
      $match: {
        type: 'wallet-topup',
        status: 'completed',
        amount: { $gte: FIRST_DEPOSIT_MIN_USD },
      },
    },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: '$chatId',
        firstAt: { $first: '$createdAt' },
        firstAmount: { $first: '$amount' },
        firstTxnId: { $first: '$_id' },
        topUpCount: { $sum: 1 },
        totalUsd: { $sum: '$amount' },
      },
    },
    { $sort: { firstAt: 1 } },
  ]

  if (LIMIT > 0) pipeline.push({ $limit: LIMIT * 4 })

  const candidates = await txns.aggregate(pipeline).toArray()
  console.log(`Found ${candidates.length} users with at least one $${FIRST_DEPOSIT_MIN_USD}+ top-up\n`)

  let alreadyCredited = 0
  let toCredit = []

  // CRITICAL: Cannot trust `userConversion.firstDepositBonusAwarded` flag alone.
  // The pre-fix buggy code DID set that flag (via $set inside the buggy findOneAndUpdate)
  // but never actually credited the wallet (the post-check on the wrapper rejected the
  // award, so the caller returned null and skipped the credit). Production audit confirmed
  // 29 users have the flag set yet zero of them have a `first-deposit-bonus` transaction.
  //
  // So we determine "actually credited" by checking for a real transaction row, NOT the flag.
  for (const c of candidates) {
    const cid = String(c._id)
    const existingCreditTxn = await txns.findOne({
      chatId: cid,
      type: { $in: ['first-deposit-bonus', 'first-deposit-bonus-retro'] },
    })
    if (existingCreditTxn) {
      alreadyCredited++
      continue
    }
    toCredit.push({ chatId: cid, firstAt: c.firstAt, firstAmount: c.firstAmount, firstTxnId: c.firstTxnId, topUpCount: c.topUpCount })
  }

  if (LIMIT > 0) toCredit = toCredit.slice(0, LIMIT)

  console.log(`  ✓ already credited (real txn): ${alreadyCredited}`)
  console.log(`  ✗ never credited            : ${toCredit.length}\n`)

  let totalUsd = 0
  for (const c of toCredit) totalUsd += FIRST_DEPOSIT_BONUS_USD
  console.log(`Total bonus to credit : $${totalUsd}\n`)

  if (!APPLY) {
    console.log('--- DRY RUN — would credit these users (showing first 30): ---')
    for (const c of toCredit.slice(0, 30)) {
      console.log(`  chatId=${c.chatId.padEnd(12)}  firstTopup=$${c.firstAmount}  at=${new Date(c.firstAt).toISOString().slice(0, 10)}  totalTopUps=${c.topUpCount}`)
    }
    if (toCredit.length > 30) console.log(`  ... and ${toCredit.length - 30} more`)
    console.log('\nRe-run with --apply to execute.')
    await client.close()
    return
  }

  // ── APPLY ──
  if (!toCredit.length) {
    console.log('Nothing to credit — exiting.')
    await client.close()
    return
  }

  let bot = null
  if (!SILENT) {
    const botToken = process.env.BOT_TOKEN_NOMADLY || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    if (botToken) bot = new TelegramBot(botToken, { polling: false })
  }

  const { atomicIncrement } = require('/app/js/db')

  let creditedCount = 0
  let failedCount = 0
  let dmSent = 0
  let dmFailed = 0

  for (const c of toCredit) {
    const cid = c.chatId
    try {
      // Atomic audit-row claim — re-run safety + concurrent safety.
      // We use the `transactions` collection (not `userConversion`) as the
      // canonical "this user got credited" source, because the flag in
      // `userConversion` was poisoned by the pre-2026-05-30 buggy code
      // (set to true without crediting). Insert with a deterministic _id
      // so a duplicate-key catch is the idempotency guard.
      const txnId = `TXN-RETRO-FDB-${cid}`
      try {
        await txns.insertOne({
          _id: txnId,
          chatId: cid,
          type: 'first-deposit-bonus-retro',
          amount: FIRST_DEPOSIT_BONUS_USD,
          currency: 'USD',
          status: 'completed',
          createdAt: new Date(),
          metadata: {
            source: 'retro_first_deposit_bonus.js (2026-05-30)',
            originalTopupTxnId: c.firstTxnId,
            originalTopupAmount: c.firstAmount,
            originalTopupAt: c.firstAt,
            reason: 'firstDepositBonus was non-functional due to mongo v5 wrapper bug — pre-fix the flag was set but wallet was never credited',
          },
        })
      } catch (e) {
        if (e.code === 11000) {
          console.log(`  ⊘ ${cid}: already credited by another concurrent run, skipping`)
          continue
        }
        throw e
      }

      // Now safe to credit (audit row is our exclusive claim)
      await atomicIncrement(walletOf, cid, 'usdIn', FIRST_DEPOSIT_BONUS_USD)

      // Update userConversion timestamp for completeness (flag may already be true)
      await conversionCol.updateOne(
        { chatId: cid },
        {
          $set: {
            firstDepositBonusAwarded: true,
            firstDepositBonusRetroAt: new Date(),
            firstDepositBonusRetroTxnId: c.firstTxnId,
          },
          $setOnInsert: {
            chatId: cid,
            firstDepositAt: new Date(c.firstAt),
            firstDepositAmount: c.firstAmount,
          },
        },
        { upsert: true }
      )

      creditedCount++
      console.log(`  ✓ ${cid}: credited $${FIRST_DEPOSIT_BONUS_USD}`)

      // Optional DM
      if (bot) {
        try {
          const st = await state.findOne({ _id: cid }, { projection: { userLanguage: 1 } })
          const lang = st?.userLanguage || 'en'
          await bot.sendMessage(cid, BONUS_MSG[lang] || BONUS_MSG.en, { parse_mode: 'HTML' })
          dmSent++
          // Telegram rate-limit: ~30 msgs/sec. Stay polite with a small gap.
          await new Promise(r => setTimeout(r, 100))
        } catch (e) {
          dmFailed++
          // Common: user blocked the bot, deleted account, etc. Non-fatal.
          if (!/403|chat not found|blocked/i.test(e.message)) {
            console.log(`     DM failed: ${e.message}`)
          }
        }
      }
    } catch (e) {
      failedCount++
      console.log(`  ✗ ${cid}: ${e.message}`)
    }
  }

  console.log(`\n──── SUMMARY ────`)
  console.log(`Credited        : ${creditedCount} × $${FIRST_DEPOSIT_BONUS_USD} = $${creditedCount * FIRST_DEPOSIT_BONUS_USD}`)
  console.log(`Failed          : ${failedCount}`)
  if (bot) {
    console.log(`DM sent         : ${dmSent}`)
    console.log(`DM failed       : ${dmFailed}  (mostly blocked/deleted accounts — benign)`)
  } else {
    console.log(`DM sent         : (silent mode)`)
  }

  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
