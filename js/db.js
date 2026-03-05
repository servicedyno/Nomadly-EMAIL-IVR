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
      const count = (await get(c, key))?.[val] || 0
      await set(c, key, val, Number(count) + Number(valueInside))
      return
    }

    const count = (await get(c, key)) || 0
    await set(c, key, count + val)
  } catch (error) {
    console.error(`Error increment: ${key} from ${c.collectionName}:`, error)
    return null
  }
}

// Atomic increment using MongoDB $inc — safe for concurrent wallet operations
const atomicIncrement = async (c, key, field, amount) => {
  try {
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
    const count = (await get(c, key)) || 0
    await set(c, key, count - 1)
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
    // return the full document (handles state collection with action, userLanguage, etc.)
    const keys = Object.keys(result)
    const hasExtraFields = keys.some(k => k !== '_id' && k !== 'val')
    if (hasExtraFields && (result.val === null || result.val === undefined)) {
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
  del,
  getAll,
  assignPackageToUser,
  insert,
  removeKeysFromDocumentById
}
