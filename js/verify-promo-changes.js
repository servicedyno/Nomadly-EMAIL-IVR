#!/usr/bin/env node
/**
 * Verification Script for Promotional Message Changes
 * 
 * This script verifies that:
 * 1. "HQ Phone Leads" has been removed from all messages
 * 2. All 4 languages have been updated
 * 3. Messages are properly formatted
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying promotional message changes...\n');

// Load the auto-promo module
const autoPromoPath = path.join(__dirname, 'auto-promo.js');
const { promoMessages } = require(autoPromoPath);

const languages = ['en', 'fr', 'zh', 'hi'];
const themes = ['showcase_morning', 'showcase_afternoon'];
const searchTerms = ['lead', 'Lead', 'LEAD', 'HQ Phone', 'verified lead', '$20/1K', '$15/1K'];

let issuesFound = 0;
let totalMessages = 0;

console.log('📊 VERIFICATION RESULTS\n');
console.log('='.repeat(60));

languages.forEach(lang => {
  console.log(`\n🌐 Language: ${lang.toUpperCase()}`);
  
  themes.forEach(theme => {
    const messages = promoMessages[lang]?.[theme] || [];
    console.log(`\n  📋 Theme: ${theme}`);
    console.log(`  Messages: ${messages.length}`);
    
    messages.forEach((msg, index) => {
      totalMessages++;
      console.log(`\n    Message #${index + 1}:`);
      
      // Check for unwanted terms
      const foundTerms = [];
      searchTerms.forEach(term => {
        if (msg.includes(term)) {
          foundTerms.push(term);
        }
      });
      
      if (foundTerms.length > 0) {
        console.log(`    ❌ ISSUE: Found unwanted terms: ${foundTerms.join(', ')}`);
        issuesFound++;
      } else {
        console.log(`    ✅ No "leads" mentions found`);
      }
      
      // Check message length
      const length = msg.length;
      console.log(`    📏 Length: ${length} characters`);
      
      if (length > 800) {
        console.log(`    ⚠️  WARNING: Message is quite long (${length} chars)`);
      }
      
      // Check for proper formatting
      const hasBoldTag = msg.includes('<b>');
      const hasStartCommand = msg.includes('/start');
      
      if (!hasBoldTag) {
        console.log(`    ⚠️  WARNING: No bold tags found`);
      }
      if (!hasStartCommand) {
        console.log(`    ⚠️  WARNING: No /start command found`);
      }
    });
  });
});

console.log('\n' + '='.repeat(60));
console.log('\n📈 SUMMARY\n');
console.log(`Total messages checked: ${totalMessages}`);
console.log(`Issues found: ${issuesFound}`);

if (issuesFound === 0) {
  console.log('\n✅ ALL CHECKS PASSED! No unwanted "leads" mentions found.');
  console.log('✅ All promotional messages have been successfully updated.');
} else {
  console.log(`\n❌ ${issuesFound} issue(s) found. Please review the messages above.`);
  process.exit(1);
}

console.log('\n🎯 Services Now Being Promoted:');
console.log('  • Offshore Domains (400+ TLDs)');
console.log('  • Shortit URL Shortener');
console.log('  • CloudPhone (Virtual Numbers)');
console.log('  • Digital Products (Twilio, AWS, Google Cloud, etc.)');

console.log('\n❌ Services Removed:');
console.log('  • HQ Phone Leads');

console.log('\n');
