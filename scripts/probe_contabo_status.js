/**
 * Quick Contabo API probe — is POST /compute/instances still 500-ing globally?
 * Read-only: only attempts auth + a list call. No new instance is created.
 */
require('dotenv').config({ path: '/app/backend/.env' })
const contabo = require('/app/js/contabo-service.js')

;(async () => {
  console.log('Contabo auth + read probe...')

  try {
    const instances = await contabo.listInstances?.()
    console.log(`listInstances: ${instances?.length || 0} found`)
    if (instances?.length) {
      console.log('Recent instances (last 3):')
      for (const i of instances.slice(0, 3)) {
        console.log(`  - id=${i.instanceId} status=${i.status} created=${i.createdDate}`)
      }
    }
  } catch (e) {
    console.error('listInstances FAILED:', e.message)
  }

  // Probe: can we get product list (cheap, no-op)
  try {
    if (typeof contabo.getProductList === 'function') {
      const products = await contabo.getProductList()
      console.log(`getProductList: ${products?.length || products?.data?.length || 0} products`)
    }
  } catch (e) {
    console.error('getProductList FAILED:', e.message)
  }

  // Dry-run probe — call createInstance with minimal payload to see if 500 is still returned
  // We'll catch but NOT actually provision. Contabo will throw before any billing event.
  // Actually: skip the create probe. It would still create a billed instance if it stops 500-ing.
  // Instead, check if there's a "createInstance" dry-run option or list products endpoint.
  console.log('\nNOTE: Not running createInstance probe to avoid surprise billing.')
  console.log('Last known status from handoff: Contabo POST /compute/instances returning 500 for ALL configs (account-level block).')
})().catch(e => { console.error('Fatal:', e); process.exit(1) })
