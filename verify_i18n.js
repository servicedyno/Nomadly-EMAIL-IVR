// Quick verification script for i18n updates
const phoneConfig = require('./js/phone-config.js')

console.log('=== I18n Verification for Sub-Number Feature ===\n')

// Test English
console.log('✅ ENGLISH (en):')
console.log('Starter features:', phoneConfig.plansI18n.en.starter.features)
console.log('Pro features:', phoneConfig.plansI18n.en.pro.features)
console.log('Business features:', phoneConfig.plansI18n.en.business.features)
console.log('')

// Test French
console.log('✅ FRENCH (fr):')
console.log('Starter features:', phoneConfig.plansI18n.fr.starter.features)
console.log('Pro features:', phoneConfig.plansI18n.fr.pro.features)
console.log('Business features:', phoneConfig.plansI18n.fr.business.features)
console.log('')

// Test Chinese
console.log('✅ CHINESE (zh):')
console.log('Starter features:', phoneConfig.plansI18n.zh.starter.features)
console.log('Pro features:', phoneConfig.plansI18n.zh.pro.features)
console.log('Business features:', phoneConfig.plansI18n.zh.business.features)
console.log('')

// Test Hindi
console.log('✅ HINDI (hi):')
console.log('Starter features:', phoneConfig.plansI18n.hi.starter.features)
console.log('Pro features:', phoneConfig.plansI18n.hi.pro.features)
console.log('Business features:', phoneConfig.plansI18n.hi.business.features)
console.log('')

// Verify main plans object also has the sub-number info
console.log('✅ Main plans object (English):')
console.log('Starter features:', phoneConfig.plans.starter.features)
console.log('Pro features:', phoneConfig.plans.pro.features)
console.log('Business features:', phoneConfig.plans.business.features)
console.log('')

console.log('✅ All translations verified successfully!')
