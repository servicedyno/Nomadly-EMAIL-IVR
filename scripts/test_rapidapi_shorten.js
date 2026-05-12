// Live invocation of createShortUrlApi against https://cnn.com — verifies the
// reverted url-shortener57.p.rapidapi.com provider returns a Shortit-friendly
// non-tinyurl URL.
require('dotenv').config({ path: '/app/backend/.env' });
const { createShortUrlApi } = require('/app/js/cuttly.js');

const url = process.argv[2] || 'https://cnn.com';

(async () => {
  console.log(`\nCalling RapidAPI provider for: ${url}\n`);
  try {
    const short = await createShortUrlApi(url);
    console.log('Short URL :', short);
    console.log('Host      :', new URL(short).host);
    console.log('Is tinyurl?', new URL(short).host.includes('tinyurl'));
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  }
})();
