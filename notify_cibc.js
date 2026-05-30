/**
 * Notify user 8414700715 that the HostPanel error is resolved.
 */
const TelegramBot = require('node-telegram-bot-api')

;(async () => {
  const token = process.env.BOT_TOKEN_NOMADLY || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
  if (!token) { console.log('NO BOT TOKEN'); process.exit(1) }
  const bot = new TelegramBot(token, { polling: false })
  const chatId = '8414700715'
  const msg = (
    `✅ <b>Hosting panel restored</b>\n\n` +
    `We just resolved a temporary issue with the hosting server that was causing the <i>"Request failed with status code 530"</i> error in your File Manager.\n\n` +
    `Please open <b>HostPanel</b> again and try uploading your files to <code>public_html</code>. ` +
    `Everything (your primary domain + 6 addon domains) should now load normally.\n\n` +
    `Sorry for the inconvenience. If you still see any error, just type <b>💬 Support</b> and we'll jump right back in.`
  )
  try {
    const r = await bot.sendMessage(chatId, msg, { parse_mode: 'HTML' })
    console.log('Sent message_id', r.message_id)
  } catch (e) {
    console.log('send error:', e.message)
  }
})()
