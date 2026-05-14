/**
 * End-to-end shortener test using the LIVE Node service.
 *
 * Reproduces the bot's random-slug code path (post-fix):
 *   1. nanoid() generates a 5-char slug.
 *   2. _shortUrl = `${SELF_URL}/${slug}` (Shortit-branded — the fix)
 *   3. Storage key shortUrl = _shortUrl.replaceAll('.', '@').replace('https://', '')
 *   4. fullUrlOf[shortUrl] = originalUrl
 *   5. maskOf[shortUrl] = _shortUrl
 *
 * Then curls _shortUrl and asserts a 302 → original URL.
 */

require('dotenv').config({ path: '/app/backend/.env' });
const { MongoClient } = require('mongodb');
const { customAlphabet } = require('nanoid');

const SELF_URL = process.env.SELF_URL;
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME;
const ORIGINAL_URL = process.argv[2] || 'https://cnn.com';

if (!SELF_URL || !MONGO_URL || !DB_NAME) {
  console.error('Missing SELF_URL / MONGO_URL / DB_NAME in env');
  process.exit(1);
}

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 5);

(async () => {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const fullUrlOf = db.collection('fullUrlOf');
  const maskOf = db.collection('maskOf');

  // ── Replicate the post-fix flow ──
  const slug = nanoid();
  const _shortUrl = `${SELF_URL}/${slug}`;
  // Storage key matches what the Express click handler at app.get('/:id') builds:
  //   selfUrlPath = SELF_URL without https://quick-setup-82.preview.emergentagent.com/api"
  //   selfKey = `${selfUrlPath}/${slug}`.replaceAll('.', '@')
  const shortUrl = _shortUrl.replaceAll('.', '@').replace('https://', '');

  await fullUrlOf.updateOne({ _id: shortUrl }, { $set: { val: ORIGINAL_URL } }, { upsert: true });
  await maskOf.updateOne({ _id: shortUrl }, { $set: { val: _shortUrl } }, { upsert: true });

  console.log('=== Shortener test ===');
  console.log('  original :', ORIGINAL_URL);
  console.log('  slug     :', slug);
  console.log('  short URL:', _shortUrl);
  console.log('  storage  :', shortUrl);

  // ── Curl the short URL via the Express click handler ──
  // Use local routing so we don't depend on the public ingress for this test.
  // The Node service is on port 5000; FastAPI proxies /api/* → :5000.
  // We hit Node directly to verify the click handler.
  const { spawnSync } = require('child_process');
  // Build the path the handler expects: /api/<slug> (since SELF_URL ends with /api)
  const localPath = SELF_URL.replace(/^https?:\/\/[^/]+/, '') + '/' + slug;
  console.log('\n  testing  :', `http://localhost:5000${localPath}`);
  const r = spawnSync('curl', ['-sI', '--max-time', '5', `http://localhost:5000${localPath}`], { encoding: 'utf8' });
  console.log('\n--- response headers ---');
  console.log(r.stdout);

  // Parse the Location header
  const locationLine = (r.stdout || '').split('\n').find(l => /^location:/i.test(l));
  const location = locationLine ? locationLine.split(/:\s+/, 2)[1].trim() : null;

  console.log('--- assertions ---');
  const status = (r.stdout.match(/HTTP\/[\d.]+ (\d+)/) || [])[1];
  console.log(`  HTTP status: ${status}`);
  console.log(`  Location  : ${location}`);
  const ok = status === '302' && (location || '').startsWith(ORIGINAL_URL.split('?')[0]);
  console.log(ok ? '✅ PASS — short URL 302-redirects to original' : '❌ FAIL');

  // Also test through the PUBLIC ingress (proves end-to-end works)
  const publicUrl = _shortUrl;
  console.log(`\n  public URL test: ${publicUrl}`);
  const r2 = spawnSync('curl', ['-sI', '--max-time', '10', publicUrl], { encoding: 'utf8' });
  console.log(r2.stdout);

  await client.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('ERR:', e); process.exit(1); });
