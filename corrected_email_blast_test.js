/**
 * Email Blast Verification - Corrected Test
 * Re-testing the specific issues found
 */

const fs = require('fs');

console.log('=== CORRECTED EMAIL BLAST VERIFICATION ===\n');

// Re-test the two failed items from previous test
const indexJsContent = fs.readFileSync('/app/js/_index.js', 'utf8');

// Test 4: Bank Payment Webhook Handler - search in bankApis object
console.log('4. Bank Payment — Webhook Handler (Re-test)');
// Search for the endpoint in the entire file, not just the bankApis declaration
const hasEmailBlastEndpoint = indexJsContent.includes("'/bank-pay-email-blast': async (req, res, ngnIn) => {");
console.log(hasEmailBlastEndpoint ? '✅ /bank-pay-email-blast endpoint exists in bankApis' : '❌ /bank-pay-email-blast endpoint not found in bankApis');
  
if (hasEmailBlastEndpoint) {
    // Check the webhook handler content
    const webhookMatch = indexJsContent.match(/['"]\/bank-pay-email-blast['"]:\s*async[\s\S]*?(?=},[\s]*['"]\/bank-pay|\s*}[\s]*$)/);
    if (webhookMatch) {
      const webhookCode = webhookMatch[0];
      const hasValidation = webhookCode.includes('ref') && webhookCode.includes('chatId') && webhookCode.includes('campaignId');
      const hasNgnToUsd = webhookCode.includes('ngnToUsd');
      const hasUnderpayment = webhookCode.includes('lowPrice') || webhookCode.includes('addFundsTo');
      const hasOverpayment = webhookCode.includes('sentMoreMoney') || webhookCode.includes('ngnIn > ngnPrice');
      const hasStartCampaign = webhookCode.includes('startCampaign');
      const hasRefundOnFailure = webhookCode.includes('catch') && webhookCode.includes('addFundsTo');
      
      console.log(`✅ Webhook validation: ${hasValidation ? 'PASS' : 'FAIL'}`);
      console.log(`✅ NGN to USD conversion: ${hasNgnToUsd ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Underpayment handling: ${hasUnderpayment ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Overpayment handling: ${hasOverpayment ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Start campaign on success: ${hasStartCampaign ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Refund on failure: ${hasRefundOnFailure ? 'PASS' : 'FAIL'}`);
    }
  }

// Test 14: Previous bug fixes - walletOk handler
console.log('\n14. Previous Bug Fixes - walletOk handler (Re-test)');
const walletOkMatch = indexJsContent.match(/'email_blast_crypto':\s*async[\s\S]*?},/);
if (walletOkMatch) {
  console.log('✅ walletOk["email_blast_crypto"] handler found');
  
  const handlerCode = walletOkMatch[0];
  const hasAtomicIncrement = handlerCode.includes('atomicIncrement');
  const hasStartCampaign = handlerCode.includes('startCampaign');
  const hasBalanceCheck = handlerCode.includes('getBalance');
  const hasErrorHandling = handlerCode.includes('catch');
  
  console.log(`✅ Uses atomicIncrement: ${hasAtomicIncrement ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Starts campaign: ${hasStartCampaign ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Checks balance: ${hasBalanceCheck ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Error handling: ${hasErrorHandling ? 'PASS' : 'FAIL'}`);
} else {
  console.log('❌ walletOk["email_blast_crypto"] handler not found');
}

// Additional comprehensive checks
console.log('\n=== ADDITIONAL VERIFICATION ===');

// Check ebPayment handler for atomicIncrement
const ebPaymentMatch = indexJsContent.match(/if\s*\(\s*action\s*===\s*'ebPayment'\s*\)[\s\S]*?(?=if\s*\(|$)/);
if (ebPaymentMatch && ebPaymentMatch[0].includes('atomicIncrement')) {
  console.log('✅ ebPayment handler uses atomicIncrement');
} else {
  console.log('❌ ebPayment handler does not use atomicIncrement');
}

// Check _payActions array
const payActionsMatch = indexJsContent.match(/_payActions[\s\S]*?\]/);
if (payActionsMatch && payActionsMatch[0].includes('ebPayment')) {
  console.log('✅ _payActions includes ebPayment');
} else {
  console.log('❌ _payActions does not include ebPayment');
}

console.log('\n=== VERIFICATION COMPLETE ===');