// Regression test for AI Support domain-roster context injection.
//
// Reproduces the @7513061815 / @Night_ismine bad-rated sessions:
//   • User has primary domain teustbnk.de hosting their cPanel
//   • Addon domain tuestbnk.org attached under the same plan
//   • User asks "where is my other domain?"
//   • BEFORE fix: AI hallucinated "it may not be registered through Nomadly"
//   • AFTER fix: getUserContext MUST inject a per-domain roster showing the
//     addon as ADDON ✅ registered, AND a DOMAIN-VISIBILITY RULE telling the
//     AI not to say "may not be registered" when the roster contradicts that.

const assert = require('assert')
const path = require('path')

// In-memory MongoDB mock with $or, $in, $ne, projection support — minimal
// surface needed by ai-support.getUserContext.
function makeMockDb(seed) {
  const data = seed || {}
  function matchDoc(doc, filter) {
    if (!filter) return true
    if (filter.$or) {
      return filter.$or.some(sub => matchDoc(doc, sub))
    }
    for (const [k, v] of Object.entries(filter)) {
      if (k === '$or') continue
      const dv = k.includes('.') ? k.split('.').reduce((a, p) => a && a[p], doc) : doc[k]
      if (v && typeof v === 'object') {
        if ('$ne' in v && dv === v.$ne) return false
        else if ('$in' in v && !v.$in.includes(dv)) return false
        else if ('$gt' in v && !(dv > v.$gt)) return false
        else if (!('$ne' in v) && !('$in' in v) && !('$gt' in v)) {
          if (dv !== v) return false
        }
      } else if (dv !== v) return false
    }
    return true
  }
  function col(name) {
    const docs = data[name] || []
    return {
      findOne: async (filter) => {
        for (const d of docs) if (matchDoc(d, filter)) return d
        return null
      },
      find: (filter) => {
        const matched = docs.filter(d => matchDoc(d, filter))
        const builder = {
          _matched: matched,
          sort: () => builder,
          limit: () => builder,
          project: () => builder,
          toArray: async () => builder._matched,
        }
        return builder
      },
      createIndex: async () => {},
    }
  }
  return { collection: col }
}

async function test_addonDomainShowsAsActive() {
  // Seed mirroring @7513061815 in production
  const chatId = '7513061815'
  const futureExpiry = new Date(Date.now() + 7 * 86400000).toISOString()
  const db = makeMockDb({
    walletOf: [{ _id: chatId, usdIn: 10, usdOut: 0 }],
    domainsOf: [{ _id: chatId, 'teustbnk@de': true, 'tuestbnk@org': true }],
    cpanelAccounts: [{
      _id: 'cp1', chatId,
      domain: 'teustbnk.de',
      plan: 'Premium Anti-Red (1-Week)',
      expiryDate: futureExpiry,
      suspended: false,
      addonDomains: ['tuestbnk.org'],
    }],
    registeredDomains: [
      { _id: 'teustbnk.de', val: { registrar: 'OpenProvider', nameserverType: 'cloudflare' } },
      { _id: 'tuestbnk.org', val: { chatId, nameserverType: 'cloudflare' } },
    ],
  })

  const aiSupportPath = path.resolve(__dirname, '../ai-support.js')
  delete require.cache[aiSupportPath]
  const aiSupport = require(aiSupportPath)
  aiSupport.initAiSupport(db)

  let capturedPrompt = null
  aiSupport.__setOpenAIForTest({
    chat: { completions: { create: async ({ messages }) => {
      capturedPrompt = messages.find(m => m.role === 'system')?.content || ''
      return { choices: [{ message: { content: 'ack' } }] }
    } } },
  })

  await aiSupport.getAiResponse(chatId, 'My other domain is not showing in my hosting plans', 'en')

  assert.ok(capturedPrompt, 'system prompt captured')

  // Roster header present
  assert.ok(/USER DOMAIN ROSTER \(2 domain/i.test(capturedPrompt),
    'roster header lists both domains (got: ' + capturedPrompt.slice(0, 2000) + ')')

  // Primary listed with PRIMARY hosting + plan
  assert.ok(/teustbnk\.de.*registered ✅.*PRIMARY hosting plan.*Premium Anti-Red/i.test(capturedPrompt),
    'primary domain marked as registered + PRIMARY hosting')

  // Addon listed as ADDON under the primary
  assert.ok(/tuestbnk\.org.*registered ✅.*ADDON under teustbnk\.de/i.test(capturedPrompt),
    'addon domain explicitly tagged ADDON under its primary')

  // Anti-hallucination rule injected
  assert.ok(/DOMAIN-VISIBILITY RULE/.test(capturedPrompt),
    'visibility rule injected')
  assert.ok(/DO NOT tell the user it isn't registered|do not tell the user it.*registered/i.test(capturedPrompt) ||
            /Do NOT tell the user it isn't registered/.test(capturedPrompt),
    'explicit "do NOT tell user it isn\'t registered" rule')
  assert.ok(/📂 My Domain Names/.test(capturedPrompt),
    'rule points user to My Domain Names')

  console.log('  ✓ Addon domain context surfaces ADDON tag + anti-hallucination rule')
}

async function test_noDomainsAtAll_noRoster() {
  const chatId = '7520972603'
  const db = makeMockDb({
    walletOf: [{ _id: chatId, usdIn: 5, usdOut: 0 }],
    // no domainsOf, no cpanelAccounts, no registeredDomains
  })
  const aiSupportPath = path.resolve(__dirname, '../ai-support.js')
  delete require.cache[aiSupportPath]
  const aiSupport = require(aiSupportPath)
  aiSupport.initAiSupport(db)
  let capturedPrompt = null
  aiSupport.__setOpenAIForTest({
    chat: { completions: { create: async ({ messages }) => {
      capturedPrompt = messages.find(m => m.role === 'system')?.content || ''
      return { choices: [{ message: { content: 'ack' } }] }
    } } },
  })
  await aiSupport.getAiResponse(chatId, 'my domains are gone', 'en')
  assert.ok(capturedPrompt, 'prompt captured')
  assert.ok(!/USER DOMAIN ROSTER/.test(capturedPrompt),
    'roster absent when user has zero domains (avoids prompt pollution for new users)')
  console.log('  ✓ Domain roster absent for users with no domains')
}

async function test_dnsContextSchemaTolerant() {
  // @Night_ismine scenario: registeredDomains has NO chatId field (legacy schema),
  // so the old AI lookup found 0 docs. Verify the fallback via domainsOf works.
  const chatId = '7394693056'
  const db = makeMockDb({
    walletOf: [{ _id: chatId, usdIn: 30, usdOut: 0 }],
    domainsOf: [{ _id: chatId, 'verify-navy@com': true, 'homepage-navyfed@com': true }],
    cpanelAccounts: [{
      _id: 'cp2', chatId,
      domain: 'verify-navy.com',
      plan: 'Golden Anti-Red HostPanel (30 Days)',
      expiryDate: new Date(Date.now() + 25 * 86400000).toISOString(),
      addonDomains: ['homepage-navyfed.com'],
    }],
    // Legacy schema: NO chatId / ownerChatId on registeredDomains
    registeredDomains: [
      { _id: 'verify-navy.com', val: { cfZoneId: 'abc', nameserverType: 'cloudflare', nameservers: ['anderson.ns.cloudflare.com'] } },
      { _id: 'homepage-navyfed.com', val: { cfZoneId: 'def', nameserverType: 'cloudflare', nameservers: ['anderson.ns.cloudflare.com'] } },
    ],
  })
  const aiSupportPath = path.resolve(__dirname, '../ai-support.js')
  delete require.cache[aiSupportPath]
  const aiSupport = require(aiSupportPath)
  aiSupport.initAiSupport(db)
  let capturedPrompt = null
  aiSupport.__setOpenAIForTest({
    chat: { completions: { create: async ({ messages }) => {
      capturedPrompt = messages.find(m => m.role === 'system')?.content || ''
      return { choices: [{ message: { content: 'ack' } }] }
    } } },
  })
  // Triggers BOTH the always-on roster AND the DNS-specific context branch.
  await aiSupport.getAiResponse(chatId, 'the switch to cloudflare button is missing for my nameserver', 'en')
  assert.ok(capturedPrompt, 'prompt captured')
  // Roster path: domain present with PRIMARY/ADDON tags
  assert.ok(/verify-navy\.com.*PRIMARY hosting plan.*Golden Anti-Red/i.test(capturedPrompt),
    'verify-navy.com tagged PRIMARY with Golden plan')
  assert.ok(/homepage-navyfed\.com.*ADDON under verify-navy\.com/i.test(capturedPrompt),
    'homepage-navyfed.com tagged ADDON under verify-navy.com')
  // DNS-context fallback path: should reach userDomains via domainsOf when registeredDomains.chatId is empty
  assert.ok(/User has \d+ registered domain.*verify-navy\.com|User has \d+ registered domain.*homepage-navyfed\.com/i.test(capturedPrompt),
    'DNS context fallback locates user domains via domainsOf when registeredDomains.chatId is missing')
  console.log('  ✓ Schema-tolerant DNS lookup + always-on roster work for legacy registeredDomains schema')
}

;(async () => {
  const tests = [
    ['test_addonDomainShowsAsActive', test_addonDomainShowsAsActive],
    ['test_noDomainsAtAll_noRoster', test_noDomainsAtAll_noRoster],
    ['test_dnsContextSchemaTolerant', test_dnsContextSchemaTolerant],
  ]
  for (const [name, fn] of tests) {
    try {
      console.log(`▶ ${name}`)
      await fn()
    } catch (e) {
      console.error(`  ✗ ${name} FAILED:`, e.message)
      console.error(e.stack)
      process.exit(1)
    }
  }
  console.log('\n✅ ALL DOMAIN-ROSTER TESTS PASSED')
})()
