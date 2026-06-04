#!/usr/bin/env node
/**
 * Smoke test: verify the new domain-roster context builds correctly against
 * the live MongoDB, for the actual affected users from AI support tickets.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

;(async () => {
  const cli = await new MongoClient(process.env.MONGO_URL).connect()
  const db = cli.db(process.env.DB_NAME || 'test')

  // Reload ai-support fresh so it picks up our changes
  delete require.cache[require.resolve('/app/js/ai-support.js')]
  const aiSupport = require('/app/js/ai-support.js')
  aiSupport.initAiSupport(db)

  let captured = null
  aiSupport.__setOpenAIForTest({
    chat: {
      completions: {
        create: async ({ messages }) => {
          captured = messages.find(m => m.role === 'system')?.content || ''
          return { choices: [{ message: { content: 'ok' } }] }
        }
      }
    }
  })

  // Three real chatIds from production AI support tickets
  const cases = [
    { chatId: '7513061815', msg: 'I want to renew and the other domain I bought is not showing' },
    { chatId: '7394693056', msg: 'Switch to Cloudflare NS button is missing' },
    { chatId: '7520972603', msg: 'my domains are gone' },
  ]

  for (const c of cases) {
    captured = null
    await aiSupport.getAiResponse(c.chatId, c.msg, 'en')
    console.log('\n========================================')
    console.log(`chatId: ${c.chatId} — "${c.msg}"`)
    console.log('========================================')
    const rosterStart = captured.indexOf('📂 USER DOMAIN ROSTER')
    if (rosterStart === -1) {
      console.log('NO ROSTER injected (user has no domains?)')
      continue
    }
    const rosterEnd = captured.indexOf('\n\n', rosterStart)
    console.log(captured.slice(rosterStart, rosterEnd === -1 ? rosterStart + 1500 : rosterEnd))
    // Also print the visibility rule
    const ruleStart = captured.indexOf('DOMAIN-VISIBILITY RULE')
    if (ruleStart !== -1) {
      const ruleEnd = captured.indexOf('\n\n', ruleStart)
      console.log('\n-- RULE --')
      console.log(captured.slice(ruleStart, ruleEnd === -1 ? ruleStart + 800 : ruleEnd))
    }
  }
  await cli.close()
})().catch(e => { console.error('FATAL', e); process.exit(1) })
