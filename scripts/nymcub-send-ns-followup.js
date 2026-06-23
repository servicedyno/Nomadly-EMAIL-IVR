/**
 * Send a follow-up DM to @fvk_poverty clarifying that we already updated
 * nameservers at the registrar for them (since nymcub.com is in our OP
 * account), so they don't need to do anything manually.
 */
process.env.BOT_ENVIRONMENT = 'production'
require('dotenv').config({ path: '/app/backend/.env' })
require('../js/config-setup')
const TelegramBot = require('node-telegram-bot-api')

const CHAT_ID = '928068276'
const DOMAIN = 'nymcub.com'

;(async () => {
  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { webHook: false, polling: false })
  const msg =
    `✅ <b>Update — nameservers already taken care of</b>\n\n`
    + `Good news: we've automatically updated the nameservers at the registrar for <b>${DOMAIN}</b>. `
    + `You don't need to do anything manually.\n\n`
    + `Registry has confirmed the change. Your site should be live within the next few minutes as DNS propagates.\n\n`
    + `Disregard the earlier "Action Required" message about updating nameservers — it's been handled for you. 🚀`
  await bot.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML', disable_web_page_preview: true })
  console.log('[Followup] Clarification DM sent to', CHAT_ID)
  setTimeout(() => process.exit(0), 1000)
})().catch(e => { console.error(e); process.exit(1) })
