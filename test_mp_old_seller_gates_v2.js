#!/usr/bin/env node
/**
 * Behavioral test for marketplace OLD-seller defense-in-depth gates (2026-07-06)
 * Tests all 11 scenarios via webhook simulation + MongoDB assertions
 * Follows the pattern from _mp_sanity.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
const http = require('http');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const SELLER = 888800010;
const SELLER_S = String(SELLER);
const BUYER = 888800011;
const BUYER_S = String(BUYER);
const WEBHOOK = 'http://127.0.0.1:5000/telegram/webhook';

function post(update) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(update);
    const req = http.request(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

let uid = 2000;
const msgUpdate = (chatId, text) => ({ update_id: ++uid, message: { message_id: uid, from: { id: chatId, is_bot: false, first_name: 'Test', username: 'test_user' }, chat: { id: chatId, type: 'private' }, date: Math.floor(Date.now()/1000), text } });
const photoUpdate = (chatId) => ({ update_id: ++uid, message: { message_id: uid, from: { id: chatId, is_bot: false, first_name: 'Test' }, chat: { id: chatId, type: 'private' }, date: Math.floor(Date.now()/1000), photo: [{ file_id: 'AgACAgQAAxkTEST', file_unique_id: 'testfid', width: 100, height: 100 }] } });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const state = db.collection('state');
  const access = db.collection('marketplaceAccess');
  const products = db.collection('marketplaceProducts');
  const conversations = db.collection('marketplaceConversations');
  const messages = db.collection('marketplaceMessages');
  
  let pass = 0, fail = 0;
  const check = (label, cond, extra='') => { console.log(`${cond?'✅':'❌'} ${label}${extra?'  '+extra:''}`); cond?pass++:fail++; };
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Marketplace OLD-seller defense-in-depth gates (2026-07-06)');
  console.log('  Behavioral tests via webhook simulation + MongoDB assertions');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // ── TEST 1: TEXT-RELAY GATE FOR UNPAID SELLER ──
    console.log('━━━ TEST 1: TEXT-RELAY GATE FOR UNPAID SELLER ━━━');
    const pid1 = uuidv4();
    const cid1 = uuidv4();
    await products.insertOne({ _id: pid1, sellerId: SELLER_S, price: 100, status: 'active', title: 'Test1', category: '💻 Digital Goods', description: 'd', currency: 'USD', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), views: 0, inquiries: 0, escrowsStarted: 0 });
    await conversations.insertOne({ _id: cid1, productId: pid1, productTitle: 'Test1', originalPrice: 100, agreedPrice: 100, buyerId: BUYER_S, sellerId: SELLER_S, status: 'active', lastMessageAt: new Date().toISOString(), createdAt: new Date().toISOString(), messageCount: 0, escrowStartedAt: null });
    await state.updateOne({ _id: SELLER_S }, { $set: { _id: SELLER_S, userLanguage: 'en', action: 'mpChat', mpActiveConversation: cid1, isNewUser: false, adminTakeover: false } }, { upsert: true });
    await access.deleteMany({ _id: { $in: [SELLER, SELLER_S] } });
    
    const msgBefore1 = await messages.countDocuments({ conversationId: cid1, senderId: SELLER_S });
    await post(msgUpdate(SELLER, 'hi buyer, still interested?')); await sleep(1500);
    const s1 = await state.findOne({ _id: SELLER_S });
    const msgAfter1 = await messages.countDocuments({ conversationId: cid1, senderId: SELLER_S });
    
    check('T1: Seller action → mpSellerPaywall', s1?.action === 'mpSellerPaywall', `got ${s1?.action}`);
    check('T1: Paywall intent → reply', s1?.mpPaywallIntent === 'reply', `got ${s1?.mpPaywallIntent}`);
    check('T1: Paywall convId set', s1?.mpPaywallConvId === cid1);
    check('T1: Message NOT relayed', msgAfter1 === msgBefore1, `before=${msgBefore1}, after=${msgAfter1}`);
    
    // ── TEST 2: TEXT-RELAY ALLOWED FOR PAID SELLER ──
    console.log('\n━━━ TEST 2: TEXT-RELAY ALLOWED FOR PAID SELLER ━━━');
    const pid2 = uuidv4();
    const cid2 = uuidv4();
    await products.insertOne({ _id: pid2, sellerId: SELLER_S, price: 100, status: 'active', title: 'Test2', category: '💻 Digital Goods', description: 'd', currency: 'USD', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), views: 0, inquiries: 0, escrowsStarted: 0 });
    await conversations.insertOne({ _id: cid2, productId: pid2, productTitle: 'Test2', originalPrice: 100, agreedPrice: 100, buyerId: BUYER_S, sellerId: SELLER_S, status: 'active', lastMessageAt: new Date().toISOString(), createdAt: new Date().toISOString(), messageCount: 0, escrowStartedAt: null });
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpChat', mpActiveConversation: cid2 } });
    await access.updateOne({ _id: SELLER_S }, { $set: { _id: SELLER_S, paid: true, paidAt: new Date(), amountUsd: 50, mode: 'wallet' } }, { upsert: true });
    
    const msgBefore2 = await messages.countDocuments({ conversationId: cid2, senderId: SELLER_S });
    const convBefore2 = await conversations.findOne({ _id: cid2 });
    await post(msgUpdate(SELLER, 'hi buyer, still interested?')); await sleep(1500);
    const s2 = await state.findOne({ _id: SELLER_S });
    const msgAfter2 = await messages.countDocuments({ conversationId: cid2, senderId: SELLER_S });
    const convAfter2 = await conversations.findOne({ _id: cid2 });
    const newMsg2 = await messages.findOne({ conversationId: cid2, senderId: SELLER_S });
    
    check('T2: Message created', msgAfter2 === msgBefore2 + 1, `before=${msgBefore2}, after=${msgAfter2}`);
    check('T2: Message type=text', newMsg2?.type === 'text', `got ${newMsg2?.type}`);
    check('T2: Seller still in mpChat', s2?.action === 'mpChat', `got ${s2?.action}`);
    check('T2: Conversation messageCount incremented', convAfter2?.messageCount === (convBefore2?.messageCount || 0) + 1);
    
    // ── TEST 3: TEXT-RELAY ALLOWED FOR BUYER (never gated) ──
    console.log('\n━━━ TEST 3: TEXT-RELAY ALLOWED FOR BUYER (never gated) ━━━');
    const pid3 = uuidv4();
    const cid3 = uuidv4();
    await products.insertOne({ _id: pid3, sellerId: SELLER_S, price: 100, status: 'active', title: 'Test3', category: '💻 Digital Goods', description: 'd', currency: 'USD', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), views: 0, inquiries: 0, escrowsStarted: 0 });
    await conversations.insertOne({ _id: cid3, productId: pid3, productTitle: 'Test3', originalPrice: 100, agreedPrice: 100, buyerId: BUYER_S, sellerId: SELLER_S, status: 'active', lastMessageAt: new Date().toISOString(), createdAt: new Date().toISOString(), messageCount: 0, escrowStartedAt: null });
    await state.updateOne({ _id: BUYER_S }, { $set: { _id: BUYER_S, userLanguage: 'en', action: 'mpChat', mpActiveConversation: cid3, isNewUser: false, adminTakeover: false } }, { upsert: true });
    
    const msgBefore3 = await messages.countDocuments({ conversationId: cid3, senderId: BUYER_S });
    await post(msgUpdate(BUYER, 'hey seller')); await sleep(1500);
    const s3 = await state.findOne({ _id: BUYER_S });
    const msgAfter3 = await messages.countDocuments({ conversationId: cid3, senderId: BUYER_S });
    const newMsg3 = await messages.findOne({ conversationId: cid3, senderId: BUYER_S });
    
    check('T3: Message created', msgAfter3 === msgBefore3 + 1, `before=${msgBefore3}, after=${msgAfter3}`);
    check('T3: Message type=text', newMsg3?.type === 'text', `got ${newMsg3?.type}`);
    check('T3: Buyer still in mpChat', s3?.action === 'mpChat', `got ${s3?.action}`);
    
    // ── TEST 4: ESCAPE HATCHES /done + ↩️ Back ALWAYS WORK ──
    console.log('\n━━━ TEST 4: ESCAPE HATCHES /done + ↩️ Back ALWAYS WORK ━━━');
    const pid4 = uuidv4();
    const cid4a = uuidv4();
    await products.insertOne({ _id: pid4, sellerId: SELLER_S, price: 100, status: 'active', title: 'Test4', category: '💻 Digital Goods', description: 'd', currency: 'USD', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), views: 0, inquiries: 0, escrowsStarted: 0 });
    await conversations.insertOne({ _id: cid4a, productId: pid4, productTitle: 'Test4', originalPrice: 100, agreedPrice: 100, buyerId: BUYER_S, sellerId: SELLER_S, status: 'active', lastMessageAt: new Date().toISOString(), createdAt: new Date().toISOString(), messageCount: 0, escrowStartedAt: null });
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpChat', mpActiveConversation: cid4a } });
    await access.deleteMany({ _id: { $in: [SELLER, SELLER_S] } });
    
    await post(msgUpdate(SELLER, '/done')); await sleep(1500);
    const conv4a = await conversations.findOne({ _id: cid4a });
    const s4a = await state.findOne({ _id: SELLER_S });
    
    check('T4: /done closes conversation', conv4a?.status === 'closed', `got ${conv4a?.status}`);
    check('T4: /done → action=mpHome', s4a?.action === 'mpHome', `got ${s4a?.action}`);
    
    const cid4b = uuidv4();
    await conversations.insertOne({ _id: cid4b, productId: pid4, productTitle: 'Test4b', originalPrice: 100, agreedPrice: 100, buyerId: BUYER_S, sellerId: SELLER_S, status: 'active', lastMessageAt: new Date().toISOString(), createdAt: new Date().toISOString(), messageCount: 0, escrowStartedAt: null });
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpChat', mpActiveConversation: cid4b } });
    
    await post(msgUpdate(SELLER, '↩️ Back')); await sleep(1500);
    const conv4b = await conversations.findOne({ _id: cid4b });
    const s4b = await state.findOne({ _id: SELLER_S });
    
    check('T4: ↩️ Back closes conversation', conv4b?.status === 'closed', `got ${conv4b?.status}`);
    check('T4: ↩️ Back → action=mpHome', s4b?.action === 'mpHome', `got ${s4b?.action}`);
    
    // ── TEST 5: PHOTO-RELAY GATE ──
    console.log('\n━━━ TEST 5: PHOTO-RELAY GATE ━━━');
    const pid5 = uuidv4();
    const cid5 = uuidv4();
    await products.insertOne({ _id: pid5, sellerId: SELLER_S, price: 100, status: 'active', title: 'Test5', category: '💻 Digital Goods', description: 'd', currency: 'USD', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), views: 0, inquiries: 0, escrowsStarted: 0 });
    await conversations.insertOne({ _id: cid5, productId: pid5, productTitle: 'Test5', originalPrice: 100, agreedPrice: 100, buyerId: BUYER_S, sellerId: SELLER_S, status: 'active', lastMessageAt: new Date().toISOString(), createdAt: new Date().toISOString(), messageCount: 0, escrowStartedAt: null });
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpChat', mpActiveConversation: cid5 } });
    await access.deleteMany({ _id: { $in: [SELLER, SELLER_S] } });
    
    const photoBefore5 = await messages.countDocuments({ conversationId: cid5, senderId: SELLER_S, type: 'photo' });
    await post(photoUpdate(SELLER)); await sleep(1500);
    const s5 = await state.findOne({ _id: SELLER_S });
    const photoAfter5 = await messages.countDocuments({ conversationId: cid5, senderId: SELLER_S, type: 'photo' });
    
    check('T5: Seller action → mpSellerPaywall', s5?.action === 'mpSellerPaywall', `got ${s5?.action}`);
    check('T5: Paywall intent → reply', s5?.mpPaywallIntent === 'reply', `got ${s5?.mpPaywallIntent}`);
    check('T5: Paywall convId set', s5?.mpPaywallConvId === cid5);
    check('T5: Photo NOT relayed', photoAfter5 === photoBefore5, `before=${photoBefore5}, after=${photoAfter5}`);
    
    // ── TEST 6: RESUME-CONVERSATION GATE (mpConversations) ──
    console.log('\n━━━ TEST 6: RESUME-CONVERSATION GATE (mpConversations) ━━━');
    const pid6 = uuidv4();
    const cid6 = uuidv4();
    await products.insertOne({ _id: pid6, sellerId: SELLER_S, price: 100, status: 'active', title: 'Test6', category: '💻 Digital Goods', description: 'd', currency: 'USD', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), views: 0, inquiries: 0, escrowsStarted: 0 });
    await conversations.insertOne({ _id: cid6, productId: pid6, productTitle: 'Test6', originalPrice: 100, agreedPrice: 100, buyerId: BUYER_S, sellerId: SELLER_S, status: 'active', lastMessageAt: new Date().toISOString(), createdAt: new Date().toISOString(), messageCount: 0, escrowStartedAt: null });
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpConversations', mpConvList: [{ id: cid6, title: 'Test6', buyerId: BUYER_S, sellerId: SELLER_S }] } });
    await access.deleteMany({ _id: { $in: [SELLER, SELLER_S] } });
    
    await post(msgUpdate(SELLER, '💬 Test6 — Seller')); await sleep(1500);
    const s6 = await state.findOne({ _id: SELLER_S });
    
    check('T6: Seller action → mpSellerPaywall', s6?.action === 'mpSellerPaywall', `got ${s6?.action}`);
    check('T6: Paywall intent → reply', s6?.mpPaywallIntent === 'reply', `got ${s6?.mpPaywallIntent}`);
    check('T6: Paywall convId set', s6?.mpPaywallConvId === cid6);
    
    // ── TEST 7: MANAGE-LISTING EDIT GATE + REMOVE-STILL-FREE ──
    console.log('\n━━━ TEST 7: MANAGE-LISTING EDIT GATE + REMOVE-STILL-FREE ━━━');
    const pid7 = uuidv4();
    await products.insertOne({ _id: pid7, sellerId: SELLER_S, price: 100, status: 'active', title: 'Test7', category: '💻 Digital Goods', description: 'd', currency: 'USD', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), views: 0, inquiries: 0, escrowsStarted: 0 });
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpManageListing', mpActiveProduct: pid7 } });
    await access.deleteMany({ _id: { $in: [SELLER, SELLER_S] } });
    
    await post(msgUpdate(SELLER, '✏️ Edit')); await sleep(1500);
    const s7a = await state.findOne({ _id: SELLER_S });
    
    check('T7: EDIT → mpSellerPaywall', s7a?.action === 'mpSellerPaywall', `got ${s7a?.action}`);
    check('T7: EDIT paywall intent=list', s7a?.mpPaywallIntent === 'list', `got ${s7a?.mpPaywallIntent}`);
    
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpManageListing', mpActiveProduct: pid7 } });
    await post(msgUpdate(SELLER, '❌ Remove Listing')); await sleep(1500);
    const prod7 = await products.findOne({ _id: pid7 });
    const s7b = await state.findOne({ _id: SELLER_S });
    
    check('T7: REMOVE → product status=removed', prod7?.status === 'removed', `got ${prod7?.status}`);
    check('T7: REMOVE → action=mpHome', s7b?.action === 'mpHome', `got ${s7b?.action}`);
    
    // ── TEST 8: EDIT-PRICE HANDLER GATE ──
    console.log('\n━━━ TEST 8: EDIT-PRICE HANDLER GATE ━━━');
    const pid8 = uuidv4();
    await products.insertOne({ _id: pid8, sellerId: SELLER_S, price: 100, status: 'active', title: 'Test8', category: '💻 Digital Goods', description: 'd', currency: 'USD', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), views: 0, inquiries: 0, escrowsStarted: 0 });
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpEditPrice', mpActiveProduct: pid8 } });
    await access.deleteMany({ _id: { $in: [SELLER, SELLER_S] } });
    
    await post(msgUpdate(SELLER, '150')); await sleep(1500);
    const s8 = await state.findOne({ _id: SELLER_S });
    const prod8 = await products.findOne({ _id: pid8 });
    
    check('T8: Seller action → mpSellerPaywall', s8?.action === 'mpSellerPaywall', `got ${s8?.action}`);
    check('T8: Paywall intent=list', s8?.mpPaywallIntent === 'list', `got ${s8?.mpPaywallIntent}`);
    check('T8: Price unchanged', prod8?.price === 100, `got ${prod8?.price}`);
    
    // ── TEST 9: PUBLISH-NEW-LISTING GATE (mpNewConfirm) ──
    console.log('\n━━━ TEST 9: PUBLISH-NEW-LISTING GATE (mpNewConfirm) ━━━');
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpNewConfirm', mpTitle: 'PublishBlockTest', mpDesc: 'd', mpPrice: 50, mpCategory: '💻 Digital Goods', mpImages: [{ fileId: 'x', uniqueId: 'y' }] } });
    await access.deleteMany({ _id: { $in: [SELLER, SELLER_S] } });
    
    const countBefore9 = await products.countDocuments({ sellerId: SELLER_S, title: 'PublishBlockTest' });
    await post(msgUpdate(SELLER, '✅ Publish')); await sleep(1500);
    const s9 = await state.findOne({ _id: SELLER_S });
    const countAfter9 = await products.countDocuments({ sellerId: SELLER_S, title: 'PublishBlockTest' });
    
    check('T9: Seller action → mpSellerPaywall', s9?.action === 'mpSellerPaywall', `got ${s9?.action}`);
    check('T9: Paywall intent=list', s9?.mpPaywallIntent === 'list', `got ${s9?.mpPaywallIntent}`);
    check('T9: Product NOT created', countAfter9 === countBefore9, `before=${countBefore9}, after=${countAfter9}`);
    
    // ── TEST 10: REGRESSION — PAID SELLER STILL PUBLISHES ──
    console.log('\n━━━ TEST 10: REGRESSION — PAID SELLER STILL PUBLISHES ━━━');
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpNewConfirm', mpTitle: 'PublishAllowTest', mpDesc: 'd', mpPrice: 50, mpCategory: '💻 Digital Goods', mpImages: [{ fileId: 'x', uniqueId: 'y' }] } });
    await access.updateOne({ _id: SELLER_S }, { $set: { _id: SELLER_S, paid: true, paidAt: new Date(), amountUsd: 50, mode: 'wallet' } }, { upsert: true });
    
    const countBefore10 = await products.countDocuments({ sellerId: SELLER_S, title: 'PublishAllowTest' });
    await post(msgUpdate(SELLER, '✅ Publish')); await sleep(1800);
    const s10 = await state.findOne({ _id: SELLER_S });
    const countAfter10 = await products.countDocuments({ sellerId: SELLER_S, title: 'PublishAllowTest' });
    const newProd10 = await products.findOne({ sellerId: SELLER_S, title: 'PublishAllowTest' });
    
    check('T10: Product created', countAfter10 === countBefore10 + 1, `before=${countBefore10}, after=${countAfter10}`);
    check('T10: Product status=active', newProd10?.status === 'active', `got ${newProd10?.status}`);
    check('T10: Seller action=mpHome', s10?.action === 'mpHome', `got ${s10?.action}`);
    
    // ── TEST 11: EXISTING ENTRY-GATE STILL WORKS (regression) ──
    console.log('\n━━━ TEST 11: EXISTING ENTRY-GATE STILL WORKS (regression) ━━━');
    await state.updateOne({ _id: SELLER_S }, { $set: { action: 'mpHome' } });
    await access.deleteMany({ _id: { $in: [SELLER, SELLER_S] } });
    
    await post(msgUpdate(SELLER, '💰 Start Selling')); await sleep(1500);
    const s11 = await state.findOne({ _id: SELLER_S });
    
    check('T11: Seller action → mpSellerPaywall', s11?.action === 'mpSellerPaywall', `got ${s11?.action}`);
    check('T11: Paywall intent=list', s11?.mpPaywallIntent === 'list', `got ${s11?.mpPaywallIntent}`);
    
  } finally {
    // ── Cleanup ──
    await state.deleteMany({ _id: { $in: [SELLER_S, BUYER_S] } });
    await products.deleteMany({ sellerId: { $in: [SELLER_S, BUYER_S] } });
    await conversations.deleteMany({ $or: [{ sellerId: SELLER_S }, { buyerId: BUYER_S }] });
    await messages.deleteMany({ senderId: { $in: [SELLER_S, BUYER_S] } });
    await access.deleteMany({ _id: { $in: [SELLER, SELLER_S, BUYER, BUYER_S] } });
    
    console.log(`\n═══ ${pass} passed, ${fail} failed ═══\n`);
    await client.close();
    process.exit(fail === 0 ? 0 : 1);
  }
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });
