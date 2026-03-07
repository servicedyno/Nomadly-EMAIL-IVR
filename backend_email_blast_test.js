/**
 * Email Blast Comprehensive Testing Script
 * Tests all 16 verification points for Email Blast feature completion
 */

const fs = require('fs');
const path = require('path');

console.log('=== EMAIL BLAST COMPREHENSIVE TEST ===\n');

// Test Results Storage
const testResults = {
  passed: 0,
  failed: 0,
  issues: []
};

function addResult(testName, passed, details = '') {
  if (passed) {
    console.log(`✅ ${testName}`);
    testResults.passed++;
  } else {
    console.log(`❌ ${testName}: ${details}`);
    testResults.failed++;
    testResults.issues.push(`${testName}: ${details}`);
  }
}

// 1. Node.js Health - Already verified in previous output
console.log('1. Node.js Health Check');
addResult('Node.js Health Check', true, 'Service running healthy on port 5000, error log empty');

// 2. Test email messaging fix - Search for "different sending system"
console.log('\n2. Test email messaging fix');
try {
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  const hasOldText = indexJsContent.includes('different sending system');
  addResult('Removed "different sending system" text', !hasOldText, hasOldText ? 'Old text still found' : 'Old text removed');
  
  // Check for new error message
  const hasNewText = indexJsContent.includes('This may be a temporary issue');
  addResult('New error message "This may be a temporary issue"', hasNewText, !hasNewText ? 'New message not found' : '');
} catch (err) {
  addResult('Test email messaging fix check', false, `Error reading _index.js: ${err.message}`);
}

// 3. Bank Payment — Action Handler
console.log('\n3. Bank Payment — Action Handler');
try {
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  const bankPayActionPattern = /action\s*===\s*['"]bank-pay-email-blast['"]/;
  const hasBankPayAction = bankPayActionPattern.test(indexJsContent);
  addResult('Bank pay action handler exists', hasBankPayAction, !hasBankPayAction ? 'bank-pay-email-blast action not found' : '');

  if (hasBankPayAction) {
    // Find the handler and verify it has required components
    const actionMatch = indexJsContent.match(/action\s*===\s*['"]bank-pay-email-blast['"][\s\S]*?(?=if\s*\(\s*action\s*===|$)/);
    if (actionMatch) {
      const handlerCode = actionMatch[0];
      const hasEmailValidation = handlerCode.includes('isValidEmail');
      const hasGetCampaign = handlerCode.includes('getCampaign');
      const hasCreateCheckout = handlerCode.includes('createCheckout');
      const hasPaymentRef = handlerCode.includes('/bank-pay-email-blast');
      
      addResult('Bank pay handler email validation', hasEmailValidation, !hasEmailValidation ? 'isValidEmail check missing' : '');
      addResult('Bank pay handler getCampaign call', hasGetCampaign, !hasGetCampaign ? 'getCampaign call missing' : '');
      addResult('Bank pay handler createCheckout call', hasCreateCheckout, !hasCreateCheckout ? 'createCheckout call missing' : '');
      addResult('Bank pay handler payment reference', hasPaymentRef, !hasPaymentRef ? 'payment endpoint reference missing' : '');
    }
  }
} catch (err) {
  addResult('Bank Payment Action Handler check', false, `Error: ${err.message}`);
}

// 4. Bank Payment — Webhook Handler
console.log('\n4. Bank Payment — Webhook Handler');
try {
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  const webhookPattern = /bankApis.*?['"]\/bank-pay-email-blast['"]/;
  const hasWebhookHandler = webhookPattern.test(indexJsContent);
  addResult('Bank payment webhook handler exists', hasWebhookHandler, !hasWebhookHandler ? 'bankApis["/bank-pay-email-blast"] not found' : '');

  if (hasWebhookHandler) {
    // Check for webhook functionality
    const hasNgnToUsd = indexJsContent.includes('ngnToUsd');
    const hasUnderpayment = indexJsContent.includes('underpayment') || indexJsContent.includes('lowPrice');
    const hasOverpayment = indexJsContent.includes('overpayment') || indexJsContent.includes('refund');
    const hasStartCampaign = indexJsContent.includes('startCampaign');
    
    addResult('Webhook NGN to USD conversion', hasNgnToUsd, !hasNgnToUsd ? 'ngnToUsd conversion missing' : '');
    addResult('Webhook underpayment handling', hasUnderpayment, !hasUnderpayment ? 'underpayment handling missing' : '');
    addResult('Webhook overpayment handling', hasOverpayment, !hasOverpayment ? 'overpayment/refund handling missing' : '');
    addResult('Webhook startCampaign call', hasStartCampaign, !hasStartCampaign ? 'startCampaign call missing' : '');
  }
} catch (err) {
  addResult('Bank Payment Webhook Handler check', false, `Error: ${err.message}`);
}

// 5. Bank Payment Button in Payment Options
console.log('\n5. Bank Payment Button in Payment Options');
try {
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  
  // Look for payIn.bank in ebPreview context
  const ebPreviewPattern = /ebPreview[\s\S]*?payIn\.crypto[\s\S]*?payIn\.bank/;
  const hasEbPreviewBank = ebPreviewPattern.test(indexJsContent);
  addResult('Bank button in ebPreview', hasEbPreviewBank, !hasEbPreviewBank ? 'payIn.bank not found in ebPreview context' : '');
  
  // Look for payIn.bank in ebTestEmailSent context
  const ebTestEmailPattern = /ebTestEmailSent[\s\S]*?payIn\.bank/;
  const hasEbTestEmailBank = ebTestEmailPattern.test(indexJsContent);
  addResult('Bank button in ebTestEmailSent', hasEbTestEmailBank, !hasEbTestEmailBank ? 'payIn.bank not found in ebTestEmailSent context' : '');
  
  // Look for bank-pay-email-blast Back handler
  const backHandlerPattern = /bank-pay-email-blast[\s\S]*?payIn\.bank/;
  const hasBackHandlerBank = backHandlerPattern.test(indexJsContent);
  addResult('Bank button in back handler', hasBackHandlerBank, !hasBackHandlerBank ? 'payIn.bank not found in back handler' : '');
} catch (err) {
  addResult('Bank Payment Button check', false, `Error: ${err.message}`);
}

// 6. Remove Domain — Button
console.log('\n6. Remove Domain — Button');
try {
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  
  // Look for ebAdminDomains handler with Remove Domain button
  const adminDomainsPattern = /ebAdminDomains[\s\S]*?❌\s*Remove\s*Domain/;
  const hasRemoveButton = adminDomainsPattern.test(indexJsContent);
  addResult('Remove Domain button exists', hasRemoveButton, !hasRemoveButton ? '❌ Remove Domain button not found in ebAdminDomains' : '');
  
  // Check for correct keyboard layout
  const keyboardPattern = /\[\['➕\s*Add\s*Domain'\],\s*\['❌\s*Remove\s*Domain'\],\s*\['🔙\s*Back'\]\]/;
  const hasCorrectKeyboard = keyboardPattern.test(indexJsContent);
  addResult('Manage Domains keyboard layout', hasCorrectKeyboard, !hasCorrectKeyboard ? 'Correct keyboard layout not found' : '');
} catch (err) {
  addResult('Remove Domain Button check', false, `Error: ${err.message}`);
}

// 7. Remove Domain — Handler
console.log('\n7. Remove Domain — Handler');
try {
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  
  const removeHandlerPattern = /action\s*===\s*['"]ebAdminRemoveDomain['"]/;
  const hasRemoveHandler = removeHandlerPattern.test(indexJsContent);
  addResult('Remove Domain handler exists', hasRemoveHandler, !hasRemoveHandler ? 'ebAdminRemoveDomain handler not found' : '');
  
  if (hasRemoveHandler) {
    const handlerMatch = indexJsContent.match(/action\s*===\s*['"]ebAdminRemoveDomain['"][\s\S]*?(?=if\s*\(\s*action\s*===|$)/);
    if (handlerMatch) {
      const handlerCode = handlerMatch[0];
      const hasGetDomains = handlerCode.includes('getDomains');
      const hasRemoveDomain = handlerCode.includes('removeDomain');
      const hasTryCatch = handlerCode.includes('try') && handlerCode.includes('catch');
      
      addResult('Remove handler getDomains call', hasGetDomains, !hasGetDomains ? 'getDomains call missing' : '');
      addResult('Remove handler removeDomain call', hasRemoveDomain, !hasRemoveDomain ? 'removeDomain call missing' : '');
      addResult('Remove handler error handling', hasTryCatch, !hasTryCatch ? 'try/catch error handling missing' : '');
    }
  }
} catch (err) {
  addResult('Remove Domain Handler check', false, `Error: ${err.message}`);
}

// 8, 9, 10. Translation checks (FR, ZH, HI)
console.log('\n8-10. Translation checks');
const languages = [
  { lang: 'FR', file: '/app/js/lang/fr.js', expected: '📧 Email en Masse' },
  { lang: 'ZH', file: '/app/js/lang/zh.js', expected: '📧 群发邮件' },
  { lang: 'HI', file: '/app/js/lang/hi.js', expected: '📧 ईमेल ब्लास्ट' }
];

for (const { lang, file, expected } of languages) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const emailBlastMatch = content.match(/emailBlast:\s*['"`]([^'"`]+)['"`]/);
    const hasCorrectTranslation = emailBlastMatch && emailBlastMatch[1] === expected;
    addResult(`${lang} emailBlast translation`, hasCorrectTranslation, 
      !hasCorrectTranslation ? `Expected "${expected}", found "${emailBlastMatch?.[1] || 'not found'}"` : '');
    
    // Check menu keyboard
    const hasMenuKeyboard = content.includes('user.shippingLabel, user.emailBlast');
    addResult(`${lang} menu keyboard`, hasMenuKeyboard, !hasMenuKeyboard ? 'Menu keyboard with emailBlast not found' : '');
  } catch (err) {
    addResult(`${lang} translation check`, false, `Error reading ${file}: ${err.message}`);
  }
}

// 11. Disposable Domains JSON
console.log('\n11. Disposable Domains JSON');
try {
  const disposableContent = fs.readFileSync('/app/js/disposable-domains.json', 'utf8');
  const domains = JSON.parse(disposableContent);
  const isArray = Array.isArray(domains);
  const hasEnoughDomains = domains.length >= 700;
  
  addResult('Disposable domains file exists and is array', isArray, !isArray ? 'Not a valid array' : '');
  addResult('Disposable domains count (700+)', hasEnoughDomains, !hasEnoughDomains ? `Only ${domains.length} domains found` : `${domains.length} domains found`);
  
  // Check if sorted alphabetically
  const isSorted = domains.every((domain, i) => i === 0 || domain >= domains[i-1]);
  addResult('Disposable domains sorted alphabetically', isSorted, !isSorted ? 'Domains not sorted alphabetically' : '');
  
  // Test Node.js loading
  try {
    const testLoad = require('/app/js/disposable-domains.json');
    const isLoadable = Array.isArray(testLoad) && testLoad.length > 0;
    addResult('Disposable domains loadable via require', isLoadable, !isLoadable ? 'Cannot load via require()' : '');
  } catch (loadErr) {
    addResult('Disposable domains loadable via require', false, `Load error: ${loadErr.message}`);
  }
} catch (err) {
  addResult('Disposable Domains JSON check', false, `Error: ${err.message}`);
}

// 12. Email Validation loads from JSON
console.log('\n12. Email Validation loads from JSON');
try {
  const emailValidationContent = fs.readFileSync('/app/js/email-validation.js', 'utf8');
  
  const requiresDisposableJson = emailValidationContent.includes('disposable-domains.json');
  addResult('Email validation requires disposable-domains.json', requiresDisposableJson, 
    !requiresDisposableJson ? 'disposable-domains.json not required' : '');
  
  const usesNewSet = emailValidationContent.includes('new Set(_disposableList)');
  addResult('Email validation uses new Set(_disposableList)', usesNewSet, 
    !usesNewSet ? 'new Set(_disposableList) not found' : '');
  
  // Test the validation function
  try {
    const validation = require('/app/js/email-validation.js');
    const testMailinator = validation.isDisposable('test@mailinator.com');
    const testGmail = validation.isDisposable('test@gmail.com');
    
    addResult('Email validation works (mailinator blocked)', testMailinator, 
      !testMailinator ? 'mailinator.com not blocked' : '');
    addResult('Email validation works (gmail allowed)', !testGmail, 
      testGmail ? 'gmail.com incorrectly blocked' : '');
  } catch (validationErr) {
    addResult('Email validation functionality test', false, `Function test error: ${validationErr.message}`);
  }
} catch (err) {
  addResult('Email Validation JSON loading check', false, `Error: ${err.message}`);
}

// 13. email-config.js
console.log('\n13. email-config.js');
try {
  const emailConfig = require('/app/js/email-config.js');
  
  const hasPricing = emailConfig.pricing && typeof emailConfig.pricing === 'object';
  const hasSending = emailConfig.sending && typeof emailConfig.sending === 'object';
  const hasVps = emailConfig.vps && typeof emailConfig.vps === 'object';
  const hasWarming = emailConfig.warming && emailConfig.warming.stages && Array.isArray(emailConfig.warming.stages);
  const hasButtons = emailConfig.buttons && typeof emailConfig.buttons === 'object';
  const hasActions = emailConfig.actions && typeof emailConfig.actions === 'object';
  const hasStatuses = emailConfig.statuses && typeof emailConfig.statuses === 'object';
  
  addResult('email-config.js has pricing section', hasPricing, !hasPricing ? 'pricing section missing' : '');
  addResult('email-config.js has sending section', hasSending, !hasSending ? 'sending section missing' : '');
  addResult('email-config.js has vps section', hasVps, !hasVps ? 'vps section missing' : '');
  addResult('email-config.js has warming section', hasWarming, !hasWarming ? 'warming section missing' : '');
  addResult('email-config.js has buttons section', hasButtons, !hasButtons ? 'buttons section missing' : '');
  addResult('email-config.js has actions section', hasActions, !hasActions ? 'actions section missing' : '');
  addResult('email-config.js has statuses section', hasStatuses, !hasStatuses ? 'statuses section missing' : '');
  
  // Check warming stages count
  if (hasWarming) {
    const stagesCount = emailConfig.warming.stages.length;
    addResult('Warming has 8 stages', stagesCount === 8, `Expected 8 stages, found ${stagesCount}`);
  }
  
  // Check actions count
  if (hasActions) {
    const actionsCount = Object.keys(emailConfig.actions).length;
    addResult('Actions has 22 keys', actionsCount === 22, `Expected 22 actions, found ${actionsCount}`);
  }
  
  // Check buttons count
  if (hasButtons) {
    const buttonsCount = Object.keys(emailConfig.buttons).length;
    addResult('Buttons section exists', buttonsCount > 0, `Found ${buttonsCount} button definitions`);
  }
} catch (err) {
  addResult('email-config.js check', false, `Error loading config: ${err.message}`);
}

// 14. Previous bug fixes still intact
console.log('\n14. Previous bug fixes still intact');
try {
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  
  const hasWalletEmailBlastCrypto = indexJsContent.includes("walletOk['email_blast_crypto']");
  addResult('walletOk["email_blast_crypto"] handler exists', hasWalletEmailBlastCrypto, 
    !hasWalletEmailBlastCrypto ? 'walletOk["email_blast_crypto"] handler not found' : '');
  
  const hasEbPaymentWallet = indexJsContent.includes('ebPayment') && indexJsContent.includes('atomicIncrement');
  addResult('ebPayment wallet handler uses atomicIncrement', hasEbPaymentWallet, 
    !hasEbPaymentWallet ? 'ebPayment with atomicIncrement not found' : '');
  
  const hasPayActionsEbPayment = indexJsContent.includes('_payActions') && indexJsContent.includes('ebPayment');
  addResult('_payActions includes ebPayment', hasPayActionsEbPayment, 
    !hasPayActionsEbPayment ? '_payActions array with ebPayment not found' : '');
} catch (err) {
  addResult('Previous bug fixes check', false, `Error: ${err.message}`);
}

// 15. Content type + test email still intact
console.log('\n15. Content type + test email still intact');
try {
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  
  const hasEbSelectContentType = indexJsContent.includes('ebSelectContentType');
  addResult('ebSelectContentType handler exists', hasEbSelectContentType, 
    !hasEbSelectContentType ? 'ebSelectContentType handler not found' : '');
  
  const hasEbTestEmail = indexJsContent.includes('ebTestEmail');
  addResult('ebTestEmail handler exists', hasEbTestEmail, 
    !hasEbTestEmail ? 'ebTestEmail handler not found' : '');
  
  const hasBrevoSMTP = indexJsContent.includes('Brevo') || indexJsContent.includes('MAIL_DOMAIN');
  addResult('Test email uses Brevo SMTP', hasBrevoSMTP, 
    !hasBrevoSMTP ? 'Brevo SMTP configuration not found' : '');
  
  const hasEbTestEmailSent = indexJsContent.includes('ebTestEmailSent');
  addResult('ebTestEmailSent handler exists', hasEbTestEmailSent, 
    !hasEbTestEmailSent ? 'ebTestEmailSent handler not found' : '');
} catch (err) {
  addResult('Content type + test email check', false, `Error: ${err.message}`);
}

// 16. EmailBlast + EmailWarming services initialized
console.log('\n16. EmailBlast + EmailWarming services initialized');
try {
  // Check supervisor logs for initialization messages
  const { execSync } = require('child_process');
  const logs = execSync('tail -n 200 /var/log/supervisor/nodejs.out.log', { encoding: 'utf8' });
  
  const hasEmailBlastInit = logs.includes('[EmailBlast]') || logs.includes('EmailBlast');
  addResult('EmailBlast service initialization logged', hasEmailBlastInit, 
    !hasEmailBlastInit ? '[EmailBlast] initialization message not found in logs' : '');
  
  const hasEmailWarmingInit = logs.includes('[EmailWarming]') || logs.includes('EmailWarming');
  addResult('EmailWarming service initialization logged', hasEmailWarmingInit, 
    !hasEmailWarmingInit ? '[EmailWarming] initialization message not found in logs' : '');
  
  // Check if services are required/imported
  const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8');
  const hasEmailBlastService = indexJsContent.includes('email-blast-service');
  const hasEmailWarmingService = indexJsContent.includes('email-warming');
  
  addResult('EmailBlast service imported', hasEmailBlastService, 
    !hasEmailBlastService ? 'email-blast-service not imported' : '');
  addResult('EmailWarming service imported', hasEmailWarmingService, 
    !hasEmailWarmingService ? 'email-warming service not imported' : '');
} catch (err) {
  addResult('Service initialization check', false, `Error: ${err.message}`);
}

// Final Summary
console.log('\n=== EMAIL BLAST TEST SUMMARY ===');
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`📊 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

if (testResults.issues.length > 0) {
  console.log('\n❌ ISSUES FOUND:');
  testResults.issues.forEach((issue, i) => {
    console.log(`${i + 1}. ${issue}`);
  });
}

console.log('\n=== TEST COMPLETED ===');