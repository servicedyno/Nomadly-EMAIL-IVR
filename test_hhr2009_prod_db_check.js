// Prod-DB safety check (READ-ONLY) — verify parked job state
require('dotenv').config()
const { MongoClient, ObjectId } = require('mongodb')

async function checkParkedJob() {
  console.log('[Prod-DB Safety Check] Connecting to database...')
  
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME || 'test')
  
  try {
    const job = await db.collection('cpanelPendingJobs').findOne({ 
      _id: new ObjectId('6a4ba537b21ac863b51a06c6') 
    })
    
    if (!job) {
      console.log('⚠️  Job 6a4ba537b21ac863b51a06c6 not found in cpanelPendingJobs')
      console.log('    (This is expected if running in a dev/test environment)')
      await client.close()
      return
    }
    
    console.log('\n[Job Found]')
    console.log(`  _id: ${job._id}`)
    console.log(`  status: ${job.status}`)
    console.log(`  escalated: ${job.escalated}`)
    console.log(`  lastError: ${job.lastError?.substring(0, 100)}...`)
    
    // Verify expectations
    const checks = []
    
    if (job.status === 'failed') {
      console.log('  ✅ status === "failed"')
      checks.push(true)
    } else {
      console.log(`  ❌ status !== "failed" (got: ${job.status})`)
      checks.push(false)
    }
    
    if (job.escalated === true) {
      console.log('  ✅ escalated === true')
      checks.push(true)
    } else {
      console.log(`  ❌ escalated !== true (got: ${job.escalated})`)
      checks.push(false)
    }
    
    if (job.lastError && job.lastError.startsWith('PAUSED_MANUAL_RECOVERY')) {
      console.log('  ✅ lastError starts with "PAUSED_MANUAL_RECOVERY"')
      checks.push(true)
    } else {
      console.log(`  ❌ lastError does not start with "PAUSED_MANUAL_RECOVERY"`)
      checks.push(false)
    }
    
    if (checks.every(c => c)) {
      console.log('\n✅ Prod-DB parked job state is preserved correctly')
      console.log('   Old prod code will NOT fire false "delivered" messages')
    } else {
      console.log('\n⚠️  Prod-DB parked job state does not match expectations')
    }
    
  } catch (err) {
    console.error(`❌ Error checking job: ${err.message}`)
  } finally {
    await client.close()
  }
}

checkParkedJob().catch(err => {
  console.error(`Fatal error: ${err.message}`)
  process.exit(1)
})
