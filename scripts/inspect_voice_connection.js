// Check the Voice Connection 2898117434361775526
const axios = require('axios');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || 'KEY019C6BA186C4398776B47C2918A9B52F_W2SrHDP0MVevNq6HtXG4N4';
const VOICE_CONN = '2898117434361775526';

const tx = axios.create({
  baseURL: 'https://api.telnyx.com/v2',
  headers: { Authorization: `Bearer ${TELNYX_API_KEY}` },
});

(async () => {
  try {
    console.log('=== Investigate Voice Connection', VOICE_CONN, '===');

    // Try Call Control App first
    try {
      const r = await tx.get(`/call_control_applications/${VOICE_CONN}`);
      console.log('\nTYPE: Call Control Application');
      console.log(JSON.stringify(r.data?.data, null, 2));
    } catch (e) {
      console.log('NOT a Call Control App:', e.response?.status);
    }

    // Try Credential Connection (SIP)
    try {
      const r = await tx.get(`/credential_connections/${VOICE_CONN}`);
      console.log('\nTYPE: Credential Connection (SIP)');
      console.log(JSON.stringify(r.data?.data, null, 2));
    } catch (e) {
      console.log('NOT a Credential Connection:', e.response?.status);
    }

    // Try FQDN Connection
    try {
      const r = await tx.get(`/fqdn_connections/${VOICE_CONN}`);
      console.log('\nTYPE: FQDN Connection');
      console.log(JSON.stringify(r.data?.data, null, 2));
    } catch (e) {
      console.log('NOT an FQDN Connection:', e.response?.status);
    }

    // List ALL phone numbers assigned to this connection
    console.log('\n=== Phone numbers on connection', VOICE_CONN, '===');
    const r = await tx.get('/phone_numbers', { params: { 'filter[connection_id]': VOICE_CONN, 'page[size]': 50 } });
    const nums = r.data?.data || [];
    console.log('Total numbers:', nums.length);
    for (const n of nums) {
      console.log(`  ${n.phone_number} (${n.tags?.join(',') || 'no-tags'}) status=${n.status}`);
    }
  } catch (e) {
    console.error('FATAL', e.response?.status, e.response?.data || e.message);
  }
})();
