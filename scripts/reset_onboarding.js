#!/usr/bin/env node
/**
 * Reset Onboarding Script
 * Usage: node reset_onboarding.js <chatId_or_username>
 */

require('dotenv').config({ path: '/app/backend/.env' })
const { MongoClient } = require('mongodb')

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'nomadly'

async function resetOnboarding(identifier) {
  const client = new MongoClient(MONGO_URL)
  
  try {
    await client.connect()
    const db = client.db(DB_NAME)
    
    let chatId = identifier
    
    // If identifier is not a number, try to find chatId by username
    if (isNaN(identifier)) {
      const nameDoc = await db.collection('nameOf').findOne({ val: identifier })
      if (!nameDoc) {
        console.log(`❌ User not found: ${identifier}`)
        return
      }
      chatId = nameDoc._id
      console.log(`Found user: ${identifier} with chatId: ${chatId}`)
    } else {
      chatId = parseFloat(identifier)
    }
    
    // Reset onboarding in users collection
    const result = await db.collection('users').updateOne(
      { _id: chatId },
      { 
        $unset: { 
          hasCompletedOnboarding: "",
          onboardingCompletedAt: ""
        } 
      }
    )
    
    // Also reset action state to 'none' so /start triggers properly
    await db.collection('state').updateOne(
      { _id: chatId },
      { $set: { action: 'none' } }
    )
    
    console.log(`✅ Onboarding reset for chatId: ${chatId}`)
    console.log(`   Modified ${result.modifiedCount} document(s)`)
    console.log(`\n💡 User can now send /start to see the welcome message again`)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await client.close()
  }
}

// Get identifier from command line
const identifier = process.argv[2]

if (!identifier) {
  console.log('Usage: node reset_onboarding.js <chatId_or_username>')
  console.log('Example: node reset_onboarding.js hostbay_support')
  console.log('Example: node reset_onboarding.js 123456789')
  process.exit(1)
}

resetOnboarding(identifier)
