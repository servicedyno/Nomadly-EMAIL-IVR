// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MongoDB Data Access Layer with Retry Logic
// Handles transient connection drops from Railway proxy
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 800

// Retryable MongoDB error codes and names
const isRetryable = (error) => {
  if (!error) return false
  const msg = error.message || ''
  const name = error.name || ''
  return (
    name === 'MongoServerSelectionError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoNetworkTimeoutError' ||
    msg.includes('timed out') ||
    msg.includes('connection') && msg.includes('closed') ||
    msg.includes('pool was cleared') ||
    msg.includes('topology was destroyed') ||
    error.code === 11600 || // interrupted
    error.code === 11602 // interrupted due to repl state change
  )
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const withRetry = async (fn, label) => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt < MAX_RETRIES && isRetryable(error)) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      // Final attempt or non-retryable — let caller handle
      throw error
    }
  }
}

const increment = async (c, key, val = 1, valueInside) => {
  try {
    if (valueInside) {
      // Atomic increment for nested fields using MongoDB $inc
      return await withRetry(() =>
        c.updateOne(
          { _id: key },
          { $inc: { [val]: Number(valueInside) } },
          { upsert: true }
        ),
        `increment(${c.collectionName}, ${key}, ${val})`
      )
    }

    // Atomic increment for simple val field using MongoDB $inc
    return await withRetry(() =>
      c.updateOne(
        { _id: key },
        { $inc: { val: val } },
        { upsert: true }
      ),
      `increment(${c.collectionName}, ${key})`
    )
  } catch (error) {
    console.error(`Error increment: ${key} from ${c.collectionName}:`, error)
    return null
  }
}

// Atomic increment using MongoDB $inc — safe for concurrent wallet operations
const atomicIncrement = async (c, key, field, amount) => {
  try {
    // ━━━ WALLET-SAFE DEDUCTIONS ━━━
    // When deducting from wallet (usdOut/ngnOut), use atomic balance check
    // to prevent overdrafts and negative balances.
    // This fixes 42+ non-atomic deduction points across the codebase.
    if (c.collectionName === 'walletOf' && (field === 'usdOut' || field === 'ngnOut')) {
      const inField = field === 'usdOut' ? 'usdIn' : 'ngnIn'
      const result = await c.findOneAndUpdate(
        {
          _id: key,
          $expr: { $gte: [{ $subtract: [{ $ifNull: [`$${inField}`, 0] }, { $ifNull: [`$${field}`, 0] }] }, amount] }
        },
        { $inc: { [field]: amount } },
        { returnDocument: 'after', includeResultMetadata: false }
      )
      if (!result) {
        // Balance insufficient — block the deduction (result is null when $expr filter doesn't match)
        const wallet = await c.findOne({ _id: key })
        const bal = ((wallet?.[inField] || 0) - (wallet?.[field] || 0)).toFixed(2)
        console.log(`[atomicIncrement] ⛔ Wallet deduction BLOCKED: chatId=${key} ${field} += ${amount} — balance $${bal} insufficient`)
        return false
      }
      return true
    }

    // ━━━ NORMAL INCREMENT (non-wallet) ━━━
    return await withRetry(() =>
      c.updateOne(
        { _id: key },
        { $inc: { [field]: amount } },
        { upsert: true }
      ).then(() => true),
      `atomicIncrement(${c.collectionName}, ${key}, ${field})`
    )
  } catch (error) {
    console.error(`Error atomicIncrement: ${key}.${field} by ${amount} in ${c.collectionName}:`, error)
    return false
  }
}

const decrement = async (c, key) => {
  try {
    // Atomic decrement using MongoDB $inc with negative value
    return await withRetry(() =>
      c.updateOne(
        { _id: key },
        { $inc: { val: -1 } },
        { upsert: true }
      ),
      `decrement(${c.collectionName}, ${key})`
    )
  } catch (error) {
    console.error(`Error db decrement ${key} from ${c.collectionName}:`, error)
    return null
  }
}

async function get(c, key) {
  try {
    const result = await withRetry(() =>
      c.findOne({ _id: key }),
      `get(${c.collectionName}, ${key})`
    )
    if (!result) return undefined

    // If document has meaningful top-level fields beyond _id and val,
    // ALWAYS return the full document (handles state collection with action, userLanguage, etc.)
    // BUG FIX: Previously only returned full doc when val was null/undefined.
    // If val was truthy (e.g. stale { minutesUsed } or string "action"), get() returned val
    // instead of the full document, losing action/userLanguage → all multi-step flows broke.
    const keys = Object.keys(result)
    const hasExtraFields = keys.some(k => k !== '_id' && k !== 'val')
    if (hasExtraFields) {
      return result
    }

    if (result?.val === 0) return 0
    if (result?.val === false) return false
    if (result?.val === null) return null

    return result?.val || result || undefined
  } catch (error) {
    console.error(`Error get: ${key} from ${c.collectionName}:`, error)
    return null
  }
}

async function getAll(c) {
  try {
    const result = await withRetry(() =>
      c.find({}).toArray(),
      `getAll(${c.collectionName})`
    )
    return result
  } catch (error) {
    console.error(`Error getAll: ${c}:`, error)
    return null
  }
}

async function set(c, key, value, valueInside) {
  try {
    if (!c || !c.updateOne) {
      throw new Error('Invalid collection object provided')
    }

    if (key === undefined || key === null) {
      throw new Error('Key cannot be undefined or null')
    }

    let result
    if (valueInside === undefined) {
      result = await withRetry(() =>
        c.updateOne({ _id: key }, { $set: { val: value } }, { upsert: true }),
        `set(${c.collectionName}, ${key})`
      )
    } else {
      // Track lastUpdated timestamp for action changes (enables stale state cleanup)
      const updateFields = { [value]: valueInside }
      if (value === 'action') {
        updateFields.lastUpdated = new Date()
      }
      result = await withRetry(() =>
        c.updateOne({ _id: key }, { $set: updateFields }, { upsert: true }),
        `set(${c.collectionName}, ${key}, ${value})`
      )
    }

    // Verify the operation succeeded
    if (!result.acknowledged) {
      console.warn(`Set operation not acknowledged for key: ${key} in ${c.collectionName}`)
    }

    return true
  } catch (error) {
    console.error(`Error set: ${key} -> ${JSON.stringify(value)} in ${c.collectionName}:`, error?.message || error)
    
    if (error.code) {
      console.error(`MongoDB error code: ${error.code}`)
    }
    
    return false
  }
}

/**
 * Atomically update specific fields within val without replacing the entire document.
 * Use this to safely update val.numbers (or any sub-field) without clobbering
 * sibling fields like val.twilioSubAccountSid / val.twilioSubAccountToken.
 *
 * @param {Collection} c   - MongoDB collection
 * @param {*}          key - document _id
 * @param {Object}     fields - object of dotted-path fields to set, e.g. { 'val.numbers': [...] }
 */
async function setFields(c, key, fields) {
  try {
    if (!c || !c.updateOne) throw new Error('Invalid collection object provided')
    if (key === undefined || key === null) throw new Error('Key cannot be undefined or null')
    const result = await withRetry(() =>
      c.updateOne({ _id: key }, { $set: fields }, { upsert: true }),
      `setFields(${c.collectionName}, ${key})`
    )
    if (!result.acknowledged) {
      console.warn(`setFields not acknowledged for key: ${key} in ${c.collectionName}`)
    }
    return true
  } catch (error) {
    console.error(`Error setFields: ${key} in ${c.collectionName}:`, error?.message || error)
    return false
  }
}

async function insert(collection, chatId, key, value) {
  try {
    await withRetry(() =>
      collection.insertOne({
        chatId: chatId,
        [key]: value,
        timestamp: new Date()
      }),
      `insert(${collection.collectionName}, ${chatId})`
    )
  } catch (error) {
    console.error(`Error setting: ${key} -> ${JSON.stringify(value)} in ${collection.collectionName}:`, error);
  }
}

async function removeKeyFromDocumentById(collection, chatId, key) {
  try {
    const query = { _id: chatId };
    const update = { $unset: { [key]: "" } };

    const result = await withRetry(() =>
      collection.updateOne(query, update),
      `removeKeyFromDocumentById(${collection.collectionName}, ${chatId}, ${key})`
    )

    if (result.matchedCount === 0) {
      console.log(`No document found with chatId: ${chatId}`);
    } else if (result.modifiedCount > 0) {
      console.log(`Successfully removed key: ${key} from document with chatId: ${chatId}`);
    }
  } catch (error) {
    console.error(`Error removing key: ${key} from document with _id: ${chatId}:`, error);
  }
}

async function removeKeysFromDocumentById(collection, chatId, keys) {
  try {
    for (const key of keys) {
      await removeKeyFromDocumentById(collection, chatId, key);
    }
    console.log(`Successfully removed keys: ${keys.join(", ")} from document with chatId: ${chatId}`);
  } catch (error) {
    console.error(`Error removing keys: ${keys.join(", ")} from document with _id: ${chatId}:`, error);
  }
}

async function assignPackageToUser(c, chatId, packageName) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000)

  const newPackage = {
    name: packageName,
    startDate: now,
    expiresAt: expiresAt,
    isActive: true,
  }

  const newReminders = {
    beforeExpireReminderSent: false,
    expireReminderSent: false,
  }

  try {
    const user = await withRetry(() =>
      c.findOne({ _id: chatId }),
      `assignPackageToUser.find(${chatId})`
    )

    if (user && user.currentPackage) {
      const updatedPreviousPackages = user.previousPackages || []
      updatedPreviousPackages.push({
        name: user.currentPackage.name,
        startDate: user.currentPackage.startDate,
        expireDate: user.currentPackage.expiresAt,
        status: 'expired',
      })

      await withRetry(() =>
        c.updateOne(
          { _id: chatId },
          {
            $set: {
              currentPackage: newPackage,
              reminders: newReminders,
              previousPackages: updatedPreviousPackages,
            },
          },
          { upsert: true },
        ),
        `assignPackageToUser.update(${chatId})`
      )
    } else {
      await withRetry(() =>
        c.updateOne(
          { _id: chatId },
          {
            $set: {
              currentPackage: newPackage,
              reminders: newReminders,
              previousPackages: user?.previousPackages || [],
            },
          },
          { upsert: true },
        ),
        `assignPackageToUser.upsert(${chatId})`
      )
    }

    console.log(`${packageName} package set for user:`, chatId)
  } catch (error) {
    console.error(`Error setting ${packageName} package for ${chatId}:`, error)
  }
}

async function del(c, _id) {
  try {
    const result = await withRetry(() =>
      c.deleteOne({ _id }),
      `del(${c.collectionName}, ${_id})`
    )
    return result.deletedCount === 1
  } catch (error) {
    console.error('Error del:', error)
    return false
  }
}

module.exports = {
  increment,
  atomicIncrement,
  decrement,
  get,
  set,
  setFields,
  del,
  getAll,
  assignPackageToUser,
  insert,
  removeKeysFromDocumentById
}
