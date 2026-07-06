#!/usr/bin/env node
/**
 * Behavioral test for marketplace OLD-seller defense-in-depth gates (2026-07-06)
 * Tests all 11 scenarios via webhook simulation + MongoDB assertions
 */

const { MongoClient } = require('mongodb');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Load env
require('dotenv').config({ path: '/app/backend/.env' });

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'test';
const WEBHOOK_URL = 'http://127.0.0.1:5000/telegram/webhook';

// Test chatIds in safe range
const SELLER_CHAT_ID = 888800001;
const SELLER_CHAT_ID_S = String(SELLER_CHAT_ID);
const BUYER_CHAT_ID = 888800002;
const BUYER_CHAT_ID_S = String(BUYER_CHAT_ID);

let client, db, state, marketplaceProducts, marketplaceConversations, marketplaceMessages, marketplaceAccess;

async function setup() {
  client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
  state = db.collection('state');
  marketplaceProducts = db.collection('marketplaceProducts');
  marketplaceConversations = db.collection('marketplaceConversations');
  marketplaceMessages = db.collection('marketplaceMessages');
  marketplaceAccess = db.collection('marketplaceAccess');
  
  console.log('✅ Connected to MongoDB');
}

async function cleanup() {
  // Clean up all test data (handle both numeric and string IDs)
  await state.deleteMany({ _id: { $in: [SELLER_CHAT_ID, SELLER_CHAT_ID_S, BUYER_CHAT_ID, BUYER_CHAT_ID_S] } });
  await marketplaceProducts.deleteMany({ sellerId: { $in: [SELLER_CHAT_ID, SELLER_CHAT_ID_S, BUYER_CHAT_ID, BUYER_CHAT_ID_S] } });
  await marketplaceConversations.deleteMany({ $or: [
    { sellerId: { $in: [SELLER_CHAT_ID, SELLER_CHAT_ID_S] } },
    { buyerId: { $in: [BUYER_CHAT_ID, BUYER_CHAT_ID_S] } }
  ]});
  await marketplaceMessages.deleteMany({ senderId: { $in: [SELLER_CHAT_ID, SELLER_CHAT_ID_S, BUYER_CHAT_ID, BUYER_CHAT_ID_S] } });
  await marketplaceAccess.deleteMany({ _id: { $in: [SELLER_CHAT_ID, SELLER_CHAT_ID_S, BUYER_CHAT_ID, BUYER_CHAT_ID_S] } });
  
  if (client) await client.close();
  console.log('✅ Cleaned up test data');
}

async function sendWebhook(update) {
  try {
    const response = await axios.post(WEBHOOK_URL, update, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });
    return { success: true, status: response.status };
  } catch (err) {
    // Telegram "chat not found" errors are expected for fake chatIds
    if (err.response?.status === 400 && err.response?.data?.description?.includes('chat not found')) {
      return { success: true, status: 400, expected: true };
    }
    return { success: false, error: err.message };
  }
}

async function setState(chatId, stateObj) {
  const chatIdS = String(chatId);
  await state.updateOne(
    { _id: chatIdS },
    {
      $set: {
        _id: chatIdS,
        userLanguage: 'en',
        isNewUser: false,
        adminTakeover: false,
        ...stateObj
      }
    },
    { upsert: true }
  );
}

async function getState(chatId) {
  const chatIdS = String(chatId);
  return await state.findOne({ _id: chatIdS });
}

function createTextUpdate(chatId, text, messageId = 1) {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: messageId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, is_bot: false, first_name: 'Test' },
      text: text
    }
  };
}

function createPhotoUpdate(chatId, messageId = 1) {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: messageId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, is_bot: false, first_name: 'Test' },
      photo: [
        { file_id: 'AgACAgQAAxkTEST', file_unique_id: 'testfid', width: 100, height: 100 }
      ]
    }
  };
}

async function grantPaidAccess(chatId) {
  const chatIdS = String(chatId);
  await marketplaceAccess.updateOne(
    { _id: chatIdS },
    {
      $set: {
        _id: chatIdS,
        paid: true,
        paidAt: new Date(),
        amountUsd: 50,
        mode: 'wallet'
      }
    },
    { upsert: true }
  );
}

async function createTestProduct(sellerId) {
  const productId = uuidv4();
  const sellerIdS = String(sellerId);
  await marketplaceProducts.insertOne({
    _id: productId,
    sellerId: sellerIdS,
    price: 100,
    status: 'active',
    title: 'Test Product',
    category: '💻 Digital Goods',
    description: 'Test description',
    currency: 'USD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    views: 0,
    inquiries: 0,
    escrowsStarted: 0
  });
  return productId;
}

async function createTestConversation(productId, sellerId, buyerId) {
  const convId = uuidv4();
  const sellerIdS = String(sellerId);
  const buyerIdS = String(buyerId);
  await marketplaceConversations.insertOne({
    _id: convId,
    productId: productId,
    productTitle: 'Test Product',
    originalPrice: 100,
    agreedPrice: 100,
    buyerId: buyerIdS,
    sellerId: sellerIdS,
    status: 'active',
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    messageCount: 0,
    escrowStartedAt: null
  });
  return convId;
}

async function test1_textRelayGateUnpaid() {
  console.log('\n━━━ TEST 1: TEXT-RELAY GATE FOR UNPAID SELLER ━━━');
  
  // Setup
  const productId = await createTestProduct(SELLER_CHAT_ID);
  const convId = await createTestConversation(productId, SELLER_CHAT_ID, BUYER_CHAT_ID);
  
  await setState(SELLER_CHAT_ID, {
    action: 'mpChat',
    mpActiveConversation: convId
  });
  
  const msgCountBefore = await marketplaceMessages.countDocuments({ conversationId: convId, senderId: SELLER_CHAT_ID_S });
  
  // Send text message
  const result = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, 'hi buyer, still interested?'));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Assert
  const sellerState = await getState(SELLER_CHAT_ID);
  const msgCountAfter = await marketplaceMessages.countDocuments({ conversationId: convId, senderId: SELLER_CHAT_ID_S });
  
  const pass1 = sellerState?.action === 'mpSellerPaywall';
  const pass2 = sellerState?.mpPaywallIntent === 'reply';
  const pass3 = sellerState?.mpPaywallConvId === convId;
  const pass4 = msgCountAfter === msgCountBefore;
  
  console.log(`  Webhook: ${result.success ? '✅' : '❌'} (status ${result.status})`);
  console.log(`  Seller action: ${pass1 ? '✅' : '❌'} (${sellerState?.action})`);
  console.log(`  Paywall intent: ${pass2 ? '✅' : '❌'} (${sellerState?.mpPaywallIntent})`);
  console.log(`  Paywall convId: ${pass3 ? '✅' : '❌'} (${sellerState?.mpPaywallConvId})`);
  console.log(`  Message NOT relayed: ${pass4 ? '✅' : '❌'} (before=${msgCountBefore}, after=${msgCountAfter})`);
  
  return pass1 && pass2 && pass3 && pass4;
}

async function test2_textRelayAllowedPaid() {
  console.log('\n━━━ TEST 2: TEXT-RELAY ALLOWED FOR PAID SELLER ━━━');
  
  // Setup
  const productId = await createTestProduct(SELLER_CHAT_ID);
  const convId = await createTestConversation(productId, SELLER_CHAT_ID, BUYER_CHAT_ID);
  
  await grantPaidAccess(SELLER_CHAT_ID);
  
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpChat',
        mpActiveConversation: convId,
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  const msgCountBefore = await marketplaceMessages.countDocuments({ conversationId: convId, senderId: SELLER_CHAT_ID });
  const convBefore = await marketplaceConversations.findOne({ _id: convId });
  
  // Send text message
  const result = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, 'hi buyer, still interested?'));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Assert
  const sellerState = await state.findOne({ _id: SELLER_CHAT_ID });
  const msgCountAfter = await marketplaceMessages.countDocuments({ conversationId: convId, senderId: SELLER_CHAT_ID });
  const convAfter = await marketplaceConversations.findOne({ _id: convId });
  const newMsg = await marketplaceMessages.findOne({ conversationId: convId, senderId: SELLER_CHAT_ID });
  
  const pass1 = msgCountAfter === msgCountBefore + 1;
  const pass2 = newMsg?.type === 'text';
  const pass3 = sellerState?.action === 'mpChat';
  const pass4 = convAfter?.messageCount === (convBefore?.messageCount || 0) + 1;
  
  console.log(`  Webhook: ${result.success ? '✅' : '❌'} (status ${result.status})`);
  console.log(`  Message created: ${pass1 ? '✅' : '❌'} (before=${msgCountBefore}, after=${msgCountAfter})`);
  console.log(`  Message type=text: ${pass2 ? '✅' : '❌'} (${newMsg?.type})`);
  console.log(`  Seller still in mpChat: ${pass3 ? '✅' : '❌'} (${sellerState?.action})`);
  console.log(`  Conversation messageCount incremented: ${pass4 ? '✅' : '❌'} (${convAfter?.messageCount})`);
  
  return pass1 && pass2 && pass3 && pass4;
}

async function test3_textRelayAllowedBuyer() {
  console.log('\n━━━ TEST 3: TEXT-RELAY ALLOWED FOR BUYER (never gated) ━━━');
  
  // Setup
  const productId = await createTestProduct(SELLER_CHAT_ID);
  const convId = await createTestConversation(productId, SELLER_CHAT_ID, BUYER_CHAT_ID);
  
  // Buyer has NO paid access
  await state.updateOne(
    { _id: BUYER_CHAT_ID },
    {
      $set: {
        action: 'mpChat',
        mpActiveConversation: convId,
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  const msgCountBefore = await marketplaceMessages.countDocuments({ conversationId: convId, senderId: BUYER_CHAT_ID });
  
  // Send text message from buyer
  const result = await sendWebhook(createTextUpdate(BUYER_CHAT_ID, 'hey seller'));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Assert
  const buyerState = await state.findOne({ _id: BUYER_CHAT_ID });
  const msgCountAfter = await marketplaceMessages.countDocuments({ conversationId: convId, senderId: BUYER_CHAT_ID });
  const newMsg = await marketplaceMessages.findOne({ conversationId: convId, senderId: BUYER_CHAT_ID });
  
  const pass1 = msgCountAfter === msgCountBefore + 1;
  const pass2 = newMsg?.type === 'text';
  const pass3 = buyerState?.action === 'mpChat';
  
  console.log(`  Webhook: ${result.success ? '✅' : '❌'} (status ${result.status})`);
  console.log(`  Message created: ${pass1 ? '✅' : '❌'} (before=${msgCountBefore}, after=${msgCountAfter})`);
  console.log(`  Message type=text: ${pass2 ? '✅' : '❌'} (${newMsg?.type})`);
  console.log(`  Buyer still in mpChat: ${pass3 ? '✅' : '❌'} (${buyerState?.action})`);
  
  return pass1 && pass2 && pass3;
}

async function test4_escapeHatchesWork() {
  console.log('\n━━━ TEST 4: ESCAPE HATCHES /done + ↩️ Back ALWAYS WORK ━━━');
  
  // Setup
  const productId = await createTestProduct(SELLER_CHAT_ID);
  const convId = await createTestConversation(productId, SELLER_CHAT_ID, BUYER_CHAT_ID);
  
  // Remove paid access
  await marketplaceAccess.deleteOne({ _id: SELLER_CHAT_ID });
  
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpChat',
        mpActiveConversation: convId,
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  // Test /done
  const result1 = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, '/done'));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const conv1 = await marketplaceConversations.findOne({ _id: convId });
  const state1 = await state.findOne({ _id: SELLER_CHAT_ID });
  
  const pass1 = conv1?.status === 'closed';
  const pass2 = state1?.action === 'mpHome';
  
  console.log(`  /done webhook: ${result1.success ? '✅' : '❌'} (status ${result1.status})`);
  console.log(`  Conversation closed: ${pass1 ? '✅' : '❌'} (${conv1?.status})`);
  console.log(`  Seller action=mpHome: ${pass2 ? '✅' : '❌'} (${state1?.action})`);
  
  // Re-create conversation for ↩️ Back test
  const convId2 = await createTestConversation(productId, SELLER_CHAT_ID, BUYER_CHAT_ID);
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpChat',
        mpActiveConversation: convId2,
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  // Test ↩️ Back
  const result2 = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, '↩️ Back'));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const conv2 = await marketplaceConversations.findOne({ _id: convId2 });
  const state2 = await state.findOne({ _id: SELLER_CHAT_ID });
  
  const pass3 = conv2?.status === 'closed';
  const pass4 = state2?.action === 'mpHome';
  
  console.log(`  ↩️ Back webhook: ${result2.success ? '✅' : '❌'} (status ${result2.status})`);
  console.log(`  Conversation closed: ${pass3 ? '✅' : '❌'} (${conv2?.status})`);
  console.log(`  Seller action=mpHome: ${pass4 ? '✅' : '❌'} (${state2?.action})`);
  
  return pass1 && pass2 && pass3 && pass4;
}

async function test5_photoRelayGate() {
  console.log('\n━━━ TEST 5: PHOTO-RELAY GATE ━━━');
  
  // Setup
  const productId = await createTestProduct(SELLER_CHAT_ID);
  const convId = await createTestConversation(productId, SELLER_CHAT_ID, BUYER_CHAT_ID);
  
  // Remove paid access
  await marketplaceAccess.deleteOne({ _id: SELLER_CHAT_ID });
  
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpChat',
        mpActiveConversation: convId,
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  const msgCountBefore = await marketplaceMessages.countDocuments({ conversationId: convId, senderId: SELLER_CHAT_ID, type: 'photo' });
  
  // Send photo
  const result = await sendWebhook(createPhotoUpdate(SELLER_CHAT_ID));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Assert
  const sellerState = await state.findOne({ _id: SELLER_CHAT_ID });
  const msgCountAfter = await marketplaceMessages.countDocuments({ conversationId: convId, senderId: SELLER_CHAT_ID, type: 'photo' });
  
  const pass1 = sellerState?.action === 'mpSellerPaywall';
  const pass2 = sellerState?.mpPaywallIntent === 'reply';
  const pass3 = sellerState?.mpPaywallConvId === convId;
  const pass4 = msgCountAfter === msgCountBefore;
  
  console.log(`  Webhook: ${result.success ? '✅' : '❌'} (status ${result.status})`);
  console.log(`  Seller action: ${pass1 ? '✅' : '❌'} (${sellerState?.action})`);
  console.log(`  Paywall intent: ${pass2 ? '✅' : '❌'} (${sellerState?.mpPaywallIntent})`);
  console.log(`  Paywall convId: ${pass3 ? '✅' : '❌'} (${sellerState?.mpPaywallConvId})`);
  console.log(`  Photo NOT relayed: ${pass4 ? '✅' : '❌'} (before=${msgCountBefore}, after=${msgCountAfter})`);
  
  return pass1 && pass2 && pass3 && pass4;
}

async function test6_resumeConversationGate() {
  console.log('\n━━━ TEST 6: RESUME-CONVERSATION GATE (mpConversations) ━━━');
  
  // Setup
  const productId = await createTestProduct(SELLER_CHAT_ID);
  const convId = await createTestConversation(productId, SELLER_CHAT_ID, BUYER_CHAT_ID);
  
  // Remove paid access
  await marketplaceAccess.deleteOne({ _id: SELLER_CHAT_ID });
  
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpConversations',
        mpConvList: [{
          id: convId,
          title: 'Test Product',
          buyerId: BUYER_CHAT_ID,
          sellerId: SELLER_CHAT_ID
        }],
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  // Send conversation selection (format: "💬 <title> — Seller")
  const result = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, '💬 Test Product — Seller'));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Assert
  const sellerState = await state.findOne({ _id: SELLER_CHAT_ID });
  
  const pass1 = sellerState?.action === 'mpSellerPaywall';
  const pass2 = sellerState?.mpPaywallIntent === 'reply';
  const pass3 = sellerState?.mpPaywallConvId === convId;
  
  console.log(`  Webhook: ${result.success ? '✅' : '❌'} (status ${result.status})`);
  console.log(`  Seller action: ${pass1 ? '✅' : '❌'} (${sellerState?.action})`);
  console.log(`  Paywall intent: ${pass2 ? '✅' : '❌'} (${sellerState?.mpPaywallIntent})`);
  console.log(`  Paywall convId: ${pass3 ? '✅' : '❌'} (${sellerState?.mpPaywallConvId})`);
  
  return pass1 && pass2 && pass3;
}

async function test7_manageListingGate() {
  console.log('\n━━━ TEST 7: MANAGE-LISTING EDIT GATE + REMOVE-STILL-FREE ━━━');
  
  // Setup
  const productId = await createTestProduct(SELLER_CHAT_ID);
  
  // Remove paid access
  await marketplaceAccess.deleteOne({ _id: SELLER_CHAT_ID });
  
  // Test EDIT (should be gated)
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpManageListing',
        mpActiveProduct: productId,
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  const result1 = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, '✏️ Edit'));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const state1 = await state.findOne({ _id: SELLER_CHAT_ID });
  
  const pass1 = state1?.action === 'mpSellerPaywall';
  const pass2 = state1?.mpPaywallIntent === 'list';
  
  console.log(`  EDIT webhook: ${result1.success ? '✅' : '❌'} (status ${result1.status})`);
  console.log(`  Seller action=mpSellerPaywall: ${pass1 ? '✅' : '❌'} (${state1?.action})`);
  console.log(`  Paywall intent=list: ${pass2 ? '✅' : '❌'} (${state1?.mpPaywallIntent})`);
  
  // Test REMOVE (should be FREE)
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpManageListing',
        mpActiveProduct: productId,
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  const result2 = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, '❌ Remove Listing'));
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const product = await marketplaceProducts.findOne({ _id: productId });
  const state2 = await state.findOne({ _id: SELLER_CHAT_ID });
  
  const pass3 = product?.status === 'removed';
  const pass4 = state2?.action === 'mpHome';
  
  console.log(`  REMOVE webhook: ${result2.success ? '✅' : '❌'} (status ${result2.status})`);
  console.log(`  Product status=removed: ${pass3 ? '✅' : '❌'} (${product?.status})`);
  console.log(`  Seller action=mpHome: ${pass4 ? '✅' : '❌'} (${state2?.action})`);
  
  return pass1 && pass2 && pass3 && pass4;
}

async function test8_editPriceGate() {
  console.log('\n━━━ TEST 8: EDIT-PRICE HANDLER GATE ━━━');
  
  // Setup
  const productId = await createTestProduct(SELLER_CHAT_ID);
  
  // Remove paid access
  await marketplaceAccess.deleteOne({ _id: SELLER_CHAT_ID });
  
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpEditPrice',
        mpActiveProduct: productId,
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  // Send new price
  const result = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, '150'));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Assert
  const sellerState = await state.findOne({ _id: SELLER_CHAT_ID });
  const product = await marketplaceProducts.findOne({ _id: productId });
  
  const pass1 = sellerState?.action === 'mpSellerPaywall';
  const pass2 = sellerState?.mpPaywallIntent === 'list';
  const pass3 = product?.price === 100; // unchanged
  
  console.log(`  Webhook: ${result.success ? '✅' : '❌'} (status ${result.status})`);
  console.log(`  Seller action: ${pass1 ? '✅' : '❌'} (${sellerState?.action})`);
  console.log(`  Paywall intent: ${pass2 ? '✅' : '❌'} (${sellerState?.mpPaywallIntent})`);
  console.log(`  Price unchanged: ${pass3 ? '✅' : '❌'} (${product?.price})`);
  
  return pass1 && pass2 && pass3;
}

async function test9_publishNewListingGate() {
  console.log('\n━━━ TEST 9: PUBLISH-NEW-LISTING GATE (mpNewConfirm) ━━━');
  
  // Remove paid access
  await marketplaceAccess.deleteOne({ _id: SELLER_CHAT_ID });
  
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpNewConfirm',
        mpTitle: 'PublishBlockTest',
        mpDesc: 'Test description',
        mpPrice: 50,
        mpCategory: '💻 Digital Goods',
        mpImages: [{ fileId: 'x', uniqueId: 'y' }],
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  const countBefore = await marketplaceProducts.countDocuments({ sellerId: SELLER_CHAT_ID, title: 'PublishBlockTest' });
  
  // Send publish
  const result = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, '✅ Publish'));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Assert
  const sellerState = await state.findOne({ _id: SELLER_CHAT_ID });
  const countAfter = await marketplaceProducts.countDocuments({ sellerId: SELLER_CHAT_ID, title: 'PublishBlockTest' });
  
  const pass1 = sellerState?.action === 'mpSellerPaywall';
  const pass2 = sellerState?.mpPaywallIntent === 'list';
  const pass3 = countAfter === countBefore;
  
  console.log(`  Webhook: ${result.success ? '✅' : '❌'} (status ${result.status})`);
  console.log(`  Seller action: ${pass1 ? '✅' : '❌'} (${sellerState?.action})`);
  console.log(`  Paywall intent: ${pass2 ? '✅' : '❌'} (${sellerState?.mpPaywallIntent})`);
  console.log(`  Product NOT created: ${pass3 ? '✅' : '❌'} (before=${countBefore}, after=${countAfter})`);
  
  return pass1 && pass2 && pass3;
}

async function test10_paidSellerPublishes() {
  console.log('\n━━━ TEST 10: REGRESSION — PAID SELLER STILL PUBLISHES ━━━');
  
  // Grant paid access
  await grantPaidAccess(SELLER_CHAT_ID);
  
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpNewConfirm',
        mpTitle: 'PublishAllowTest',
        mpDesc: 'Test description',
        mpPrice: 50,
        mpCategory: '💻 Digital Goods',
        mpImages: [{ fileId: 'x', uniqueId: 'y' }],
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  const countBefore = await marketplaceProducts.countDocuments({ sellerId: SELLER_CHAT_ID, title: 'PublishAllowTest' });
  
  // Send publish
  const result = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, '✅ Publish'));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Assert
  const sellerState = await state.findOne({ _id: SELLER_CHAT_ID });
  const countAfter = await marketplaceProducts.countDocuments({ sellerId: SELLER_CHAT_ID, title: 'PublishAllowTest' });
  const newProduct = await marketplaceProducts.findOne({ sellerId: SELLER_CHAT_ID, title: 'PublishAllowTest' });
  
  const pass1 = countAfter === countBefore + 1;
  const pass2 = newProduct?.status === 'active';
  const pass3 = sellerState?.action === 'mpHome';
  
  console.log(`  Webhook: ${result.success ? '✅' : '❌'} (status ${result.status})`);
  console.log(`  Product created: ${pass1 ? '✅' : '❌'} (before=${countBefore}, after=${countAfter})`);
  console.log(`  Product status=active: ${pass2 ? '✅' : '❌'} (${newProduct?.status})`);
  console.log(`  Seller action=mpHome: ${pass3 ? '✅' : '❌'} (${sellerState?.action})`);
  
  return pass1 && pass2 && pass3;
}

async function test11_existingEntryGateRegression() {
  console.log('\n━━━ TEST 11: EXISTING ENTRY-GATE STILL WORKS (regression) ━━━');
  
  // Remove paid access
  await marketplaceAccess.deleteOne({ _id: SELLER_CHAT_ID });
  
  await state.updateOne(
    { _id: SELLER_CHAT_ID },
    {
      $set: {
        action: 'mpHome',
        userLanguage: 'en'
      }
    },
    { upsert: true }
  );
  
  // Send "💰 Start Selling" button
  const result = await sendWebhook(createTextUpdate(SELLER_CHAT_ID, '💰 Start Selling'));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Assert
  const sellerState = await state.findOne({ _id: SELLER_CHAT_ID });
  
  const pass1 = sellerState?.action === 'mpSellerPaywall';
  const pass2 = sellerState?.mpPaywallIntent === 'list';
  
  console.log(`  Webhook: ${result.success ? '✅' : '❌'} (status ${result.status})`);
  console.log(`  Seller action: ${pass1 ? '✅' : '❌'} (${sellerState?.action})`);
  console.log(`  Paywall intent: ${pass2 ? '✅' : '❌'} (${sellerState?.mpPaywallIntent})`);
  
  return pass1 && pass2;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Marketplace OLD-seller defense-in-depth gates (2026-07-06)');
  console.log('  Behavioral tests via webhook simulation + MongoDB assertions');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    await setup();
    
    const results = [];
    
    // Run all tests
    results.push({ name: 'TEST 1: Text relay gate (unpaid)', pass: await test1_textRelayGateUnpaid() });
    await cleanup();
    await setup();
    
    results.push({ name: 'TEST 2: Text relay allowed (paid)', pass: await test2_textRelayAllowedPaid() });
    await cleanup();
    await setup();
    
    results.push({ name: 'TEST 3: Text relay allowed (buyer)', pass: await test3_textRelayAllowedBuyer() });
    await cleanup();
    await setup();
    
    results.push({ name: 'TEST 4: Escape hatches work', pass: await test4_escapeHatchesWork() });
    await cleanup();
    await setup();
    
    results.push({ name: 'TEST 5: Photo relay gate', pass: await test5_photoRelayGate() });
    await cleanup();
    await setup();
    
    results.push({ name: 'TEST 6: Resume conversation gate', pass: await test6_resumeConversationGate() });
    await cleanup();
    await setup();
    
    results.push({ name: 'TEST 7: Manage listing gate', pass: await test7_manageListingGate() });
    await cleanup();
    await setup();
    
    results.push({ name: 'TEST 8: Edit price gate', pass: await test8_editPriceGate() });
    await cleanup();
    await setup();
    
    results.push({ name: 'TEST 9: Publish new listing gate', pass: await test9_publishNewListingGate() });
    await cleanup();
    await setup();
    
    results.push({ name: 'TEST 10: Paid seller publishes', pass: await test10_paidSellerPublishes() });
    await cleanup();
    await setup();
    
    results.push({ name: 'TEST 11: Existing entry gate', pass: await test11_existingEntryGateRegression() });
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    
    results.forEach(r => {
      console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`);
    });
    
    console.log(`\n═══ ${passed}/${results.length} passed, ${failed} failed ═══\n`);
    
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

main();
