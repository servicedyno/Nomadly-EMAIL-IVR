// test_admin_unmasked_notify.js
//
// Regression for: Admin bot must receive UNMASKED @username + exact deposit
// amounts while public groups continue to receive the masked broadcast.
//
// We don't import _index.js (it boots a full Express + MongoDB + Telegram bot
// app). Instead we replicate the exact `notifyGroup`, `maskName`, `adminUserTag`
// and `adminDomainTag` logic and run it in isolation against an in-memory bot.
//
// Assertions:
// 1. Public group receives the MASKED message (no @username, no domain leak)
// 2. Admin chat receives the UNMASKED admin variant when adminMessage is given
// 3. Admin chat receives the SAME (masked) message when adminMessage is null
// 4. Wallet top-up admin variant carries deposited amount + ticker

const assert = require('assert')

// ── Replicate the helpers from /app/js/_index.js exactly ─────────────────
const CHAT_BOT_NAME = 'TestBot'
const TELEGRAM_NOTIFY_GROUP_ID = '1001'
const TELEGRAM_ADMIN_CHAT_ID = '2002'

const maskName = name => {
  if (!name || typeof name !== 'string') return 'User***'
  return name.length <= 2 ? name + '***' : name.slice(0, 2) + '***'
}

const maskDomain = domain => {
  if (!domain || typeof domain !== 'string') return '***.*'
  const dotIdx = domain.indexOf('.')
  if (dotIdx < 0) return domain.slice(0, 3) + '***'
  const name = domain.slice(0, dotIdx)
  const tld = domain.slice(dotIdx)
  const visible = Math.min(3, name.length)
  return name.slice(0, visible) + '***' + tld
}

const adminUserTag = (name, chatId) => {
  const cid = chatId != null ? String(chatId) : ''
  if (name && typeof name === 'string') return `@${name}${cid ? ' (' + cid + ')' : ''}`
  return cid ? `User ${cid}` : 'User'
}

const adminDomainTag = domain =>
  (domain && typeof domain === 'string') ? domain : '***'

// In-memory bot capturing every send
const sent = [] // { chatId, text }
const bot = {
  sendMessage: (chatId, text /*, opts */) => {
    sent.push({ chatId: String(chatId), text })
    // Mimic the .then().catch() chain used in the real notifyGroup
    return Promise.resolve({ then: cb => { cb(); return { catch: () => {} } }, catch: () => {} })
  },
}

// Simplified notifyGroup — same routing semantics as the production one.
async function notifyGroup(message, adminMessage = null) {
  const taggedMessage = message + `\n— <b>${CHAT_BOT_NAME}</b>`
  const taggedAdminMessage = adminMessage != null
    ? adminMessage + `\n— <b>${CHAT_BOT_NAME}</b>`
    : taggedMessage
  const sentTo = new Set()
  if (TELEGRAM_NOTIFY_GROUP_ID) {
    const gid = Number(TELEGRAM_NOTIFY_GROUP_ID)
    sentTo.add(String(gid))
    await bot.sendMessage(gid, taggedMessage)
  }
  if (TELEGRAM_ADMIN_CHAT_ID && !sentTo.has(String(TELEGRAM_ADMIN_CHAT_ID))) {
    sentTo.add(String(TELEGRAM_ADMIN_CHAT_ID))
    await bot.sendMessage(TELEGRAM_ADMIN_CHAT_ID, taggedAdminMessage)
  }
}

// ─────────────────────────────── Tests ───────────────────────────────────
async function run() {
  let passed = 0
  let failed = 0
  const t = async (name, fn) => {
    sent.length = 0
    try {
      await fn()
      console.log(`  ✅ ${name}`)
      passed++
    } catch (e) {
      console.log(`  ❌ ${name}\n     ${e.message}`)
      failed++
    }
  }

  console.log('\n=== Admin Unmasked Notify Tests ===')

  // (1) Wallet top-up: deposited amount + @username only to admin
  await t('Wallet top-up — admin sees @username + exact amount, group sees masked', async () => {
    const name = 'pirateloot'
    const chatId = '999111'
    const usdIn = 42.5
    const value = '0.0021'
    const coin = 'BTC'
    const ref = 'r123'
    const txnId = 'TX001'

    await notifyGroup(
      `💰 <b>Wallet Top-Up!</b>\nUser ${maskName(name)} just topped up via <b>💎 Crypto</b>\nFund yours in seconds — /start`,
      `💰 <b>Wallet Top-Up (DynoPay)</b>\n👤 User: ${adminUserTag(name, chatId)}\n💵 Credited: <b>$${usdIn}</b> USD\n🪙 Received: <b>${value} ${coin}</b>\n🔖 Ref: <code>${ref}</code>\n🆔 Txn: <code>${txnId}</code>`
    )

    const groupMsg = sent.find(s => s.chatId === '1001').text
    const adminMsg = sent.find(s => s.chatId === '2002').text

    assert(groupMsg.includes('pi***'), 'group should see masked')
    assert(!groupMsg.includes('@pirateloot'), 'group must not see @username')
    assert(!groupMsg.includes('$42.5'), 'group must not see deposit amount')

    assert(adminMsg.includes('@pirateloot (999111)'), 'admin must see @username + chatId')
    assert(adminMsg.includes('$42.5'), 'admin must see exact USD amount')
    assert(adminMsg.includes('0.0021 BTC'), 'admin must see crypto amount + ticker')
    assert(adminMsg.includes(ref), 'admin must see ref')
    assert(adminMsg.includes(txnId), 'admin must see txn id')
  })

  // (2) New Member Join: admin sees full Telegram name + chatId + username
  await t('New member join — admin sees full identity, group sees masked', async () => {
    const username = 'satoshi'
    const chatId = '4242'
    const displayName = 'Satoshi N.'
    const tgUsername = '@satoshi'
    const validLanguage = 'en'

    await notifyGroup(
      `🎉 <b>New Member!</b>\nUser ${maskName(username)} just joined ${CHAT_BOT_NAME}.`,
      `👋 <b>New Member Joined!</b>\n\n👤 Name: <b>${displayName}</b>\n🆔 Chat ID: <code>${chatId}</code>\n📎 Username: ${tgUsername}\n🌐 Language: ${validLanguage}\n\n💬 /reply ${chatId} hi`
    )

    const groupMsg = sent.find(s => s.chatId === '1001').text
    const adminMsg = sent.find(s => s.chatId === '2002').text

    assert(groupMsg.includes('sa***'), 'group should mask username')
    assert(!groupMsg.includes('@satoshi'), 'group must not see @username')
    assert(!groupMsg.includes('Satoshi N.'), 'group must not see display name')

    assert(adminMsg.includes('@satoshi'), 'admin must see @username')
    assert(adminMsg.includes('Satoshi N.'), 'admin must see display name')
    assert(adminMsg.includes('<code>4242</code>'), 'admin must see chatId')
  })

  // (3) Domain registration: admin sees full domain, group sees masked
  await t('Domain registered — admin sees full domain, group sees masked', async () => {
    const name = 'goldtest'
    const chatId = '7777'
    const domain = 'goldtest.com'

    await notifyGroup(
      `🌐 <b>Domain Registered!</b>\nUser ${maskName(name)} just claimed <b>${maskDomain(domain)}</b>.`,
      `🌐 <b>Domain Registered (Wallet)</b>\n👤 User: ${adminUserTag(name, chatId)}\n🌍 Domain: <b>${adminDomainTag(domain)}</b>`
    )

    const groupMsg = sent.find(s => s.chatId === '1001').text
    const adminMsg = sent.find(s => s.chatId === '2002').text

    assert(groupMsg.includes('go***'), 'group should mask username')
    assert(groupMsg.includes('gol***.com'), 'group should mask domain')
    assert(!groupMsg.includes('goldtest.com'), 'group must not see full domain')

    assert(adminMsg.includes('@goldtest (7777)'), 'admin must see @username + chatId')
    assert(adminMsg.includes('goldtest.com'), 'admin must see full domain')
  })

  // (4) Backward-compat: legacy 1-arg call sends same message to both
  await t('Legacy 1-arg call — admin and group receive same message', async () => {
    await notifyGroup('🎉 plain message')
    const groupMsg = sent.find(s => s.chatId === '1001').text
    const adminMsg = sent.find(s => s.chatId === '2002').text
    assert.strictEqual(groupMsg, adminMsg, '1-arg legacy mode should send identical message to both')
  })

  // (5) adminUserTag handles missing username
  await t('adminUserTag falls back to chatId when no username', () => {
    assert.strictEqual(adminUserTag('alice', '123'), '@alice (123)')
    assert.strictEqual(adminUserTag('', '123'), 'User 123')
    assert.strictEqual(adminUserTag(null, '123'), 'User 123')
    assert.strictEqual(adminUserTag(undefined, '123'), 'User 123')
    assert.strictEqual(adminUserTag('bob', null), '@bob')
  })

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
  process.exit(failed === 0 ? 0 : 1)
}

run()
