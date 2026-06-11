require('dotenv').config({ path: '/app/backend/.env' })
const opService = require('/app/js/op-service.js')
const DOMAIN = 'rsvpeviteopen.de'

;(async () => {
  console.log(`Re-pushing NS for ${DOMAIN}...`)
  const result = await opService.updateNameservers(DOMAIN, [
    'anderson.ns.cloudflare.com',
    'leanna.ns.cloudflare.com',
  ])
  console.log('Result:', JSON.stringify(result, null, 2))
})().catch(e => { console.error('ERR:', e.message); process.exit(1) })
