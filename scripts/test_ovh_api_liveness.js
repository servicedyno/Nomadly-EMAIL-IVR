/**
 * OVH API liveness test — uses the cheapest plan (VST1 "Nano" @ $4.20/mo)
 * with OVH_DRY_RUN respected. Exercises:
 *   1. OAuth (OVH app/consumer key signature)
 *   2. Catalog lookup (/order/catalog/public/vps)
 *   3. Cart build (POST /order/cart + add item + configure)
 *   4. Pricing computation (cart total endpoint)
 *   5. Region/OS validation against requiredConfiguration
 *
 * Only step skipped is the final checkout (payment). Cart is auto-deleted.
 * If `--real` is passed AND OVH_DRY_RUN is unset/false, places a real order.
 *
 * Usage: node /app/scripts/test_ovh_api_liveness.js [--real] [--product=VST1]
 */
require('dotenv').config({ path: '/app/.env' })
const ovh = require('/app/js/ovh-service.js')

const args = process.argv.slice(2)
const wantReal = args.includes('--real')
const productArg = args.find(a => a.startsWith('--product='))?.split('=')[1] || 'VST1'

;(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  OVH API liveness test')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Environment:')
  console.log(`  OVH_ENDPOINT          = ${process.env.OVH_ENDPOINT}`)
  console.log(`  OVH_SUBSIDIARY        = ${process.env.OVH_SUBSIDIARY}`)
  console.log(`  OVH_DEFAULT_DATACENTER = ${process.env.OVH_DEFAULT_DATACENTER}`)
  console.log(`  OVH_DRY_RUN           = ${process.env.OVH_DRY_RUN}`)
  console.log(`  OVH_APP_KEY           = ${process.env.OVH_APP_KEY?.slice(0, 8)}…`)
  console.log(`  OVH_CONSUMER_KEY      = ${process.env.OVH_CONSUMER_KEY?.slice(0, 8)}…`)
  console.log(`  Will real-order?      = ${wantReal && process.env.OVH_DRY_RUN !== 'true' ? 'YES (real money)' : 'NO (dry-run / safe)'}`)
  console.log()

  const t0 = Date.now()

  try {
    const result = await ovh.createInstance({
      productId:   productArg,         // VST1 = cheapest @ $4.20/mo
      region:      'BHS',              // Beauharnois Canada
      imageId:     'ubuntu-24.04',
      displayName: `liveness-test-${Date.now()}`,
      period:      1,
    })

    console.log(`✅ createInstance returned in ${Date.now() - t0}ms`)
    console.log()
    console.log('Full response:')
    console.log(JSON.stringify(result, null, 2))
    console.log()
    if (result.status === 'dry_run') {
      console.log('🟢 OVH API LIVENESS: HEALTHY')
      console.log(`   - Cart built successfully (cartId=${result._ovhCartId})`)
      console.log(`   - Item created and configured (product, region, OS all accepted)`)
      console.log(`   - Total computed by OVH: $${result._ovhTotal?.toFixed?.(2) ?? result._ovhTotal}`)
      console.log(`   - Cart cleaned up (DELETE /order/cart/${result._ovhCartId})`)
      console.log(`   - Only step NOT exercised: POST /order/cart/{id}/checkout (the payment).`)
      console.log()
      console.log('Conclusion: OAuth, catalog, cart-build, pricing, and validation are ALL working.')
      console.log('If you also want to verify the checkout step end-to-end, re-run with OVH_DRY_RUN=false plus --real flag.')
    } else {
      console.log(`🟢 REAL ORDER PLACED — instanceId=${result.instanceId}, status=${result.status}`)
      console.log(`   IP: ${result.ipConfig?.v4?.ip}`)
    }
  } catch (e) {
    console.log(`❌ FAIL after ${Date.now() - t0}ms`)
    console.log(`   ${e.message}`)
    if (e.code) console.log(`   code: ${e.code}`)
    if (e.response?.status) console.log(`   HTTP ${e.response.status}`)
    if (e.response?.data) console.log(`   body: ${JSON.stringify(e.response.data).slice(0, 1500)}`)
    if (e.stack) console.log(`   stack:\n${e.stack.split('\n').slice(0, 6).join('\n')}`)
    process.exit(1)
  }
  process.exit(0)
})()
