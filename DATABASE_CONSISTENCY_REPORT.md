# Database Consistency Analysis Report
**Date:** April 10, 2026  
**Database:** MongoDB (test)  
**Analysis Type:** Schema Consistency & Service Alignment

---

## 📊 Executive Summary

**Total Collections:** 91  
**Known/Mapped Collections:** 26  
**Orphaned/Undocumented Collections:** 65  
**Critical Issues Found:** 3  
**Recommendations:** 5

---

## ✅ Core Service Collections Status

### 🖥️ VPS/RDP Service
| Collection | Status | Documents | Issues |
|------------|--------|-----------|--------|
| `vpsPlansOf` | ✅ Active | 2 | ⚠️ Schema inconsistency (50% missing new RDP fields) |
| `vpsTransactions` | ✅ Active | 6 | ✅ Clean |

**Schema Analysis:**
- **Core fields (100% coverage):** chatId, name, label, vpsId, start_time, end_time, plan, planPrice, status, timestamp
- **RDP fields (50% coverage):** rootPasswordSecretId, lastPasswordReset, lastReinstall, isRDP, osType, contaboInstanceId, host, productId, region
- **Missing fields in 1/2 records:** Indicates old records created before RDP management features

**Data Integrity:**
- ✅ All records have vpsId or contaboInstanceId
- ✅ All records have status field
- ⚠️ 1 record missing rootPasswordSecretId or sshKeys (old record)

---

### 🌐 Domain Service
| Collection | Status | Documents | Issues |
|------------|--------|-----------|--------|
| `domainsOf` | ✅ Active | 108 | ✅ Clean |
| `freeDomainNamesAvailableFor` | ✅ Active | 97 | ✅ Clean |
| `registeredDomains` | ⚠️ Orphaned | 74 | ⚠️ Not documented in code |
| `domainDnsCache` | ⚠️ Orphaned | 66 | ⚠️ Not documented |
| `dnsRecords` | ⚠️ Orphaned | 6 | ⚠️ Not documented |
| `blockedDomains` | ⚠️ Orphaned | 1 | ⚠️ Not documented |
| `emailDomains` | ⚠️ Orphaned | 2 | ⚠️ Not documented |

**Concern:** Multiple domain-related collections exist but are not mapped in main codebase initialization.

---

### 🏠 Hosting Service
| Collection | Status | Documents | Issues |
|------------|--------|-----------|--------|
| `hostingTransactions` | ✅ Active | 87 | ✅ Clean |
| `cpanelAccounts` | ⚠️ Orphaned | 20 | ⚠️ Not documented |

**Gap:** No `hostingPlans` or `hosting` collection found for active hosting instances.

---

### 📞 Phone/Lead Service
| Collection | Status | Documents | Issues |
|------------|--------|-----------|--------|
| `phoneNumbersOf` | ✅ Active | 8 | ✅ Clean |
| `phoneTransactions` | ✅ Active | 12 | ✅ Clean |
| `phoneLogs` | ✅ Active | 1,622 | ✅ Clean |
| `cnamCache` | ✅ Active | 27,565 | ✅ Clean (large cache) |
| `ivrAnalytics` | ❌ Missing | 0 | ❌ Declared but not created |
| `freeValidationsAvailableFor` | ❌ Missing | 0 | ❌ Declared but not created |
| `leadRequests` | ⚠️ Orphaned | 23 | ⚠️ Not documented |
| `leadJobs` | ⚠️ Orphaned | 17 | ⚠️ Not documented |
| `ivrAudioFiles` | ⚠️ Orphaned | 26 | ⚠️ Not documented |
| `phoneReviews` | ⚠️ Orphaned | 2 | ⚠️ Not documented |

**Issues:**
- 2 collections declared in code but never initialized
- 4 collections exist but not documented in code

---

### 👤 User & Wallet Service
| Collection | Status | Documents | Issues |
|------------|--------|-----------|--------|
| `walletOf` | ✅ Active | 3,963 | ✅ Clean (atomic operations) |
| `state` | ✅ Active | 3,665 | ✅ Clean |
| `loginCountOf` | ✅ Active | 331 | ✅ Clean |
| `chatIdBlocked` | ✅ Active | 7 | ✅ Clean |
| `canLogin` | ❌ Missing | 0 | ❌ Declared but not created |
| `nameOf` | ⚠️ Orphaned | 3,960 | ⚠️ Not documented |
| `chatIdOf` | ⚠️ Orphaned | 3,923 | ⚠️ Not documented (likely user mapping) |
| `welcomeBonuses` | ⚠️ Orphaned | 3,945 | ⚠️ Active feature but not documented |
| `balanceNotifyHistory` | ⚠️ Orphaned | 3,906 | ⚠️ Not documented |

**Concern:** Many user-related collections exist but aren't properly documented.

---

### 💰 Payment Service
| Collection | Status | Documents | Issues |
|------------|--------|-----------|--------|
| `chatIdOfPayment` | ✅ Active | 21 | ✅ Clean |
| `chatIdOfDynopayPayment` | ✅ Active | 90 | ✅ Clean |
| `paymentIntents` | ✅ Active | 8 | ✅ Clean |
| `payments` | ⚠️ Orphaned | 6,966 | ⚠️ Large collection, not documented |

**Critical:** `payments` collection has 6,966 documents but is not declared in codebase initialization!

---

### 🔗 Link Shortening Service
| Collection | Status | Documents | Issues |
|------------|--------|-----------|--------|
| `linksOf` | ✅ Active | 547 | ✅ Clean |
| `expiryOf` | ✅ Active | 2 | ✅ Clean |
| `maskOf` | ✅ Active | 1,021 | ✅ Clean |
| `fullUrlOf` | ✅ Active | 2,579 | ✅ Clean |
| `totalShortLinks` | ✅ Active | 4 | ✅ Clean |
| `freeShortLinksOf` | ✅ Active | 812 | ✅ Clean |
| `clicksOf` | ⚠️ Orphaned | 706 | ⚠️ Not documented |
| `clicksOn` | ⚠️ Orphaned | 1,256 | ⚠️ Not documented |
| `shortenerActivations` | ⚠️ Orphaned | 11 | ⚠️ Not documented |

---

### 📧 SMS Service
| Collection | Status | Documents | Issues |
|------------|--------|-----------|--------|
| `freeSmsCountOf` | ✅ Active | 185 | ✅ Clean |
| `clicksOfSms` | ✅ Active | 1,216 | ✅ Clean |

---

## ⚠️ Critical Issues Identified

### Issue 1: Missing Declared Collections
**Severity:** MEDIUM  
**Collections Affected:** 3

Collections declared in `/app/js/_index.js` but never created:
- `ivrAnalytics` (line 1306)
- `freeValidationsAvailableFor` (line 1311)
- `canLogin` (line 1289)

**Impact:** Code may attempt to query non-existent collections, causing errors.

**Recommendation:** Either create these collections or remove references from code.

---

### Issue 2: Undocumented Active Collections
**Severity:** HIGH  
**Collections Affected:** 65

Major undocumented collections with significant data:
- `payments` (6,966 docs) - Payment tracking
- `nameOf` (3,960 docs) - User names
- `chatIdOf` (3,923 docs) - User mapping
- `welcomeBonuses` (3,945 docs) - Bonus tracking
- `winbackCampaigns` (4,039 docs) - Marketing
- `promoOptOut` (3,955 docs) - User preferences
- `cnamCache` (27,565 docs) - Phone data cache
- `phoneLogs` (1,622 docs) - Call logs

**Impact:** 
- No centralized documentation
- Difficult to maintain
- Risk of data inconsistency
- No backup strategy visibility

**Recommendation:** Document all active collections in a central schema file.

---

### Issue 3: VPS Schema Inconsistency
**Severity:** MEDIUM  
**Collection:** `vpsPlansOf`

**Problem:** New RDP management fields only present in 50% of records:
- `rootPasswordSecretId`
- `lastPasswordReset`
- `lastReinstall`
- `isRDP`
- `osType`
- `contaboInstanceId`

**Impact:** 
- Old VPS records cannot use new RDP features
- Password reset will fail for old instances
- Windows reinstall will fail for old instances

**Recommendation:** Run migration script to update old records with default values.

---

## 📋 Collection Categories

### Production Collections (Active & Documented)
**26 collections** - Properly initialized in code

### Feature Collections (Active but Undocumented)
**35 collections** - Used by features but not in main init
- Marketing: promoResponses, promoStats, promoOptOut, winbackCampaigns, winbackCodes
- Email: emailValidationJobs, emailSettings, emailSuppressions, emailIpWarming
- Marketplace: marketplaceProducts, marketplaceMessages, marketplaceConversations, marketplaceBans
- Analytics: userConversion, browseTracking, referrals, referralClicks
- Support: aiSupportChats, supportSessions
- Scheduling: scheduledEvents, provisioningJobs
- Monitoring: systemMetrics, systemAlerts, honeypotTriggers

### Abandoned/Empty Collections
**30 collections** - Created but empty
- testCredentials, testOtps, testReferrals
- emailCampaigns, broadcastJobs
- webhookLogs, processedWebhooks
- provisioningJobs, idempotencyKeys
- sshKeysOf

---

## 💡 Recommendations

### Recommendation 1: Create Missing Collections
```javascript
// Add to initialization in _index.js
ivrAnalytics = db.collection('ivrAnalytics')
freeValidationsAvailableFor = db.collection('freeValidationsAvailableFor')
canLogin = db.collection('canLogin')
```

### Recommendation 2: Document Orphaned Collections
Create `/app/js/collections-schema.js`:
```javascript
module.exports = {
  // User & Identity
  nameOf: 'User display names',
  chatIdOf: 'Telegram chatId mappings',
  
  // Payments & Transactions
  payments: 'All payment records (6,966 docs)',
  
  // Marketing & Engagement
  welcomeBonuses: 'User welcome bonuses',
  winbackCampaigns: 'Re-engagement campaigns',
  promoOptOut: 'Promo preferences',
  
  // ... etc
}
```

### Recommendation 3: Run VPS Schema Migration
```javascript
// Migrate old VPS records to new schema
const oldRecords = await vpsPlansOf.find({
  rootPasswordSecretId: { $exists: false }
}).toArray()

for (const record of oldRecords) {
  await vpsPlansOf.updateOne(
    { _id: record._id },
    {
      $set: {
        isRDP: false,
        osType: 'Linux',
        // Don't add rootPasswordSecretId for Linux
      }
    }
  )
}
```

### Recommendation 4: Add Collection Indexes
Missing indexes on frequently queried fields:
```javascript
// Performance optimization
await vpsPlansOf.createIndex({ chatId: 1 })
await vpsPlansOf.createIndex({ status: 1 })
await vpsPlansOf.createIndex({ end_time: 1 })
await payments.createIndex({ chatId: 1, createdAt: -1 })
await phoneLogs.createIndex({ chatId: 1, timestamp: -1 })
```

### Recommendation 5: Cleanup Empty Collections
```javascript
// Remove unused collections
const emptyToRemove = [
  'testCredentials', 'testOtps', 'testReferrals',
  'emailCampaigns', 'systemAlerts', 'webhookLogs',
  'idempotencyKeys', 'sshKeysOf'
]

for (const collName of emptyToRemove) {
  await db.collection(collName).drop()
}
```

---

## ✅ Strengths

1. **Atomic Wallet Operations** ✅
   - `walletOf` uses atomic $inc operations
   - Prevents race conditions and overdrafts

2. **Retry Logic** ✅
   - All database operations wrapped in retry logic
   - Handles Railway MongoDB proxy transient failures

3. **Consistent Naming** ✅
   - Most collections follow `<feature>Of` pattern
   - Clear service boundaries

4. **Status Tracking** ✅
   - VPS records have proper status field
   - Enables lifecycle management

---

## 📊 Statistics Summary

| Category | Count |
|----------|-------|
| **Total Collections** | 91 |
| **Documented & Active** | 26 (29%) |
| **Undocumented & Active** | 35 (38%) |
| **Empty/Abandoned** | 30 (33%) |
| **Total Documents** | ~80,000+ |
| **Largest Collection** | cnamCache (27,565 docs) |
| **Most Critical** | payments (6,966 docs) |

---

## 🎯 Priority Actions

1. **IMMEDIATE:** Create missing declared collections (ivrAnalytics, freeValidationsAvailableFor, canLogin)
2. **HIGH:** Document the `payments` collection properly
3. **HIGH:** Run VPS schema migration for old records
4. **MEDIUM:** Create comprehensive schema documentation
5. **LOW:** Cleanup empty collections

---

**Report Complete** ✅  
**Next Steps:** Review recommendations and implement priority actions

---
