/**
 * One-shot: send the firstDepositBonus retro DMs to the 30 users who were
 * credited by the apply run earlier. Wallet was credited but DM didn't fire
 * because the script was looking for BOT_TOKEN_NOMADLY which doesn't exist
 * on prod (the env var is TELEGRAM_BOT_TOKEN_PROD).
 *
 * Idempotency: tracks sent DMs via `userConversion.firstDepositBonusDmSentAt`,
 * so re-runs skip users who've already been DM'd.
 */
const { MongoClient } = require('mongodb')
const TelegramBot = require('node-telegram-bot-api')

const BONUS_USD = 5
const APPLY = process.argv.includes('--apply')

const BONUS_MSG = {
  en: `🎁 <b>Surprise First-Deposit Bonus!</b>\n\nWe found a small issue with our first-deposit bonus and you didn't receive your <b>$${BONUS_USD}</b> when you topped up — sorry about that!\n\nYour bonus has just been added to your wallet. Thanks for being with us.\n\n💡 /start to continue`,
  fr: `🎁 <b>Bonus de premier dépôt surprise !</b>\n\nNous avons trouvé un problème avec notre bonus de premier dépôt — vous n'avez pas reçu vos <b>$${BONUS_USD}</b> lors de votre recharge. Désolé !\n\nLe bonus vient d'être ajouté à votre portefeuille. Merci !\n\n💡 /start pour continuer`,
  zh: `🎁 <b>意外的首充奖励！</b>\n\n我们发现首充奖励出了点问题，您首次充值时没有收到 <b>$${BONUS_USD}</b>，非常抱歉！\n\n奖励已添加到您的钱包。感谢您的支持。\n\n💡 /start 继续`,
  hi: `🎁 <b>आश्चर्यजनक पहली जमा बोनस!</b>\n\nहमारे पहले डिपॉज़िट बोनस में एक छोटी समस्या थी — आपको टॉप-अप पर <b>$${BONUS_USD}</b> नहीं मिले थे। हमें खेद है!\n\nआपका बोनस आपके वॉलेट में जोड़ दिया गया है। धन्यवाद!\n\n💡 जारी रखने के लिए /start`,
}

;(async () => {
  const token = process.env.BOT_ENVIRONMENT === 'development'
    ? process.env.TELEGRAM_BOT_TOKEN_DEV
    : process.env.TELEGRAM_BOT_TOKEN_PROD
  if (!token) { console.error('NO BOT TOKEN (env=' + process.env.BOT_ENVIRONMENT + ')'); process.exit(1) }
  console.log(`Using BOT_ENVIRONMENT=${process.env.BOT_ENVIRONMENT} (token len=${token.length})`)
  const bot = new TelegramBot(token, { polling: false })

  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db()

  // Pull list from the retro audit rows we just inserted
  const retroTxns = await db.collection('transactions').find({
    type: 'first-deposit-bonus-retro',
  }).toArray()
  console.log(`Found ${retroTxns.length} retro-credit audit rows\n`)

  if (!APPLY) {
    for (const t of retroTxns.slice(0, 35)) console.log(`  chatId=${t.chatId}  credited=$${t.amount}  at=${t.createdAt.toISOString()}`)
    console.log('\nRe-run with --apply to send DMs.')
    await client.close()
    return
  }

  let sent = 0, alreadySent = 0, failed = 0
  for (const t of retroTxns) {
    const cid = t.chatId
    // Idempotency check
    const u = await db.collection('userConversion').findOne({ chatId: cid }, { projection: { firstDepositBonusDmSentAt: 1, userLanguage: 1 } })
    if (u?.firstDepositBonusDmSentAt) { alreadySent++; continue }

    // Pull lang from state collection (preferred) or fallback
    const st = await db.collection('state').findOne({ _id: cid }, { projection: { userLanguage: 1 } })
    const lang = st?.userLanguage || u?.userLanguage || 'en'
    const msg = BONUS_MSG[lang] || BONUS_MSG.en

    try {
      await bot.sendMessage(cid, msg, { parse_mode: 'HTML' })
      await db.collection('userConversion').updateOne(
        { chatId: cid },
        { $set: { firstDepositBonusDmSentAt: new Date(), firstDepositBonusDmLang: lang } },
        { upsert: true }
      )
      sent++
      console.log(`  ✓ ${cid} (${lang})`)
      await new Promise(r => setTimeout(r, 120))
    } catch (e) {
      failed++
      if (/403|chat not found|blocked|deactivated/i.test(e.message)) {
        // Mark as DM-failed so we don't keep retrying
        await db.collection('userConversion').updateOne(
          { chatId: cid },
          { $set: { firstDepositBonusDmFailedAt: new Date(), firstDepositBonusDmFailedReason: e.message.slice(0, 200) } },
          { upsert: true }
        )
        console.log(`  ⊘ ${cid}: ${e.message.slice(0, 80)} (marked failed, won't retry)`)
      } else {
        console.log(`  ✗ ${cid}: ${e.message.slice(0, 100)}`)
      }
    }
  }

  console.log(`\n──── SUMMARY ────`)
  console.log(`Sent          : ${sent}`)
  console.log(`Already sent  : ${alreadySent}`)
  console.log(`Failed        : ${failed}`)
  await client.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
