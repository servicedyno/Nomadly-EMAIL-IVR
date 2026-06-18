/* global process */
/**
 * Get Cloudflare zone NS for inviolivepaperless.com (does NOT mutate anything).
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const cfService = require('../cf-service')
const opService = require('../op-service')

;(async () => {
  const domain = 'inviolivepaperless.com'

  console.log('=== Cloudflare zone for ' + domain + ' ===')
  const zone = await cfService.getZoneByName(domain)
  console.log(JSON.stringify(zone, null, 2))

  console.log('\n=== OpenProvider domain info for ' + domain + ' ===')
  const opInfo = await opService.getDomainInfo(domain)
  console.log(JSON.stringify(opInfo, null, 2))
})().catch(e => { console.error(e); process.exit(1) })
