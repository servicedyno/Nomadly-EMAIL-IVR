/**
 * Regression test for the silent-stall detector in lead-job-persistence.js.
 *
 * Verifies:
 *  1. onStall fires when results.length stops growing for STALL_THRESHOLD_MS.
 *  2. onStall fires only ONCE per stall (not on every tick).
 *  3. Stall re-arms when progress resumes (next stall fires again).
 *  4. onStall is NOT fired while progress is healthy.
 *
 * We use a 1-second threshold and 200ms save interval for fast tests. The
 * SAVE_INTERVAL_MS constant is internal to the module, so we monkey-patch
 * setInterval / Date.now to run synchronously? No — simplest is to use a
 * short LEAD_JOB_STALL_THRESHOLD_MS env var and real timers.
 */

process.env.LEAD_JOB_STALL_THRESHOLD_MS = '800'; // 0.8 s for fast tests
process.env.LEAD_JOB_SAVE_INTERVAL_MS = '200';   // 200 ms tick for fast tests

const assert = require('assert');

// Use a fake _db so saveProgress is a no-op (we don't actually need persistence here).
const fastPersistence = require('../js/lead-job-persistence');
fastPersistence.initLeadJobPersistence({
  collection: () => ({
    createIndex: async () => {},
    updateOne: async () => {},
    insertOne: async () => {},
    find: () => ({ toArray: async () => [] }),
  }),
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let pass = 0;
  let fail = 0;

  // Test 1: stall fires when progress stops
  {
    const results = [];
    let realNameCount = 0;
    const stalls = [];
    const jobId = 'test-stall-1';

    // Seed with some results so currentCount > 0 (more realistic)
    results.push('x', 'y');

    fastPersistence.startPeriodicSave(
      jobId,
      () => ({ results, realNameCount }),
      (info) => stalls.push(info),
      { chatId: 999, target: 'TestTarget', targetCount: 100 },
    );

    // No progress for ~1.2s → should trigger one stall alert (threshold 800ms)
    await sleep(1400);
    fastPersistence.stopPeriodicSave(jobId);

    try {
      assert.strictEqual(stalls.length, 1, `Expected exactly 1 stall alert, got ${stalls.length}`);
      assert.strictEqual(stalls[0].currentCount, 2);
      assert.strictEqual(stalls[0].targetCount, 100);
      assert.strictEqual(stalls[0].chatId, 999);
      assert.strictEqual(stalls[0].target, 'TestTarget');
      assert.ok(stalls[0].stalledForSec >= 0, 'stalledForSec should be reported');
      console.log('✓ Test 1 PASS: stall fires once when progress stops');
      pass++;
    } catch (e) {
      console.error('✗ Test 1 FAIL:', e.message);
      fail++;
    }
  }

  // Test 2: no stall while progress is healthy
  {
    const results = [];
    let realNameCount = 0;
    const stalls = [];
    const jobId = 'test-healthy';

    fastPersistence.startPeriodicSave(
      jobId,
      () => ({ results, realNameCount }),
      (info) => stalls.push(info),
      { chatId: 999, target: 'Healthy', targetCount: 100 },
    );

    // Add a result every 150ms for 1500ms — never stalls > 800ms
    const grower = setInterval(() => results.push('z'), 150);
    await sleep(1500);
    clearInterval(grower);
    fastPersistence.stopPeriodicSave(jobId);

    try {
      assert.strictEqual(stalls.length, 0, `Expected 0 stalls during healthy run, got ${stalls.length}`);
      console.log('✓ Test 2 PASS: no stall while progress is healthy');
      pass++;
    } catch (e) {
      console.error('✗ Test 2 FAIL:', e.message);
      fail++;
    }
  }

  // Test 3: stall re-arms after progress resumes
  {
    const results = ['a'];
    let realNameCount = 0;
    const stalls = [];
    const jobId = 'test-rearm';

    fastPersistence.startPeriodicSave(
      jobId,
      () => ({ results, realNameCount }),
      (info) => stalls.push(info),
      { chatId: 999, target: 'Rearm', targetCount: 100 },
    );

    // Phase 1: stall for ~1s
    await sleep(1100);
    // Phase 2: progress resumes — 3 new entries quickly
    results.push('b', 'c', 'd');
    await sleep(400);
    // Phase 3: stall again
    await sleep(1100);
    fastPersistence.stopPeriodicSave(jobId);

    try {
      assert.strictEqual(stalls.length, 2, `Expected 2 stalls (re-arm), got ${stalls.length}`);
      assert.strictEqual(stalls[0].currentCount, 1);
      assert.strictEqual(stalls[1].currentCount, 4);
      console.log('✓ Test 3 PASS: stall re-arms after progress resumes');
      pass++;
    } catch (e) {
      console.error('✗ Test 3 FAIL:', e.message);
      fail++;
    }
  }

  // Test 4: onStall is optional (no callback = no crash)
  {
    const results = [];
    let realNameCount = 0;
    const jobId = 'test-no-callback';
    fastPersistence.startPeriodicSave(
      jobId,
      () => ({ results, realNameCount }),
      // no onStall callback
    );
    await sleep(1100);
    fastPersistence.stopPeriodicSave(jobId);
    console.log('✓ Test 4 PASS: optional onStall does not crash');
    pass++;
  }

  console.log(`\nResult: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})();
