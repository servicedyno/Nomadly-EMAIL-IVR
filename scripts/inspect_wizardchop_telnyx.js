// Query Telnyx API to check the connection type and webhook config for +15162719167
const axios = require('axios');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || 'KEY019C6BA186C4398776B47C2918A9B52F_W2SrHDP0MVevNq6HtXG4N4';
const NUMBER = '+15162719167';
const CONNECTION_ID = '2898118323872990714';

const tx = axios.create({
  baseURL: 'https://api.telnyx.com/v2',
  headers: { Authorization: `Bearer ${TELNYX_API_KEY}` },
});

(async () => {
  try {
    // 1. Get the phone number details — what connection is it assigned to?
    console.log('=== 1. Phone Number details for', NUMBER, '===');
    const numbers = await tx.get('/phone_numbers', { params: { 'filter[phone_number]': NUMBER } });
    const n = numbers.data?.data?.[0];
    if (!n) {
      console.log('Number NOT found in Telnyx account!');
    } else {
      console.log('  id:', n.id);
      console.log('  status:', n.status);
      console.log('  connection_id:', n.connection_id);
      console.log('  connection_name:', n.connection_name);
      console.log('  voice_settings:', JSON.stringify(n.voice_settings || {}));
      console.log('  messaging_profile_id:', n.messaging_profile_id);
      console.log('  tags:', n.tags);
    }

    // 2. Get the connection details — is it Call Control / SIP Connection / etc?
    console.log('\n=== 2. Connection details for', CONNECTION_ID, '===');
    try {
      const cc = await tx.get(`/call_control_applications/${CONNECTION_ID}`);
      const app = cc.data?.data;
      console.log('  TYPE: Call Control Application');
      console.log('  application_name:', app.application_name);
      console.log('  webhook_event_url:', app.webhook_event_url);
      console.log('  webhook_event_failover_url:', app.webhook_event_failover_url);
      console.log('  active:', app.active);
    } catch (e) {
      console.log('  NOT a Call Control App:', e.response?.status || e.message);
    }

    try {
      const sip = await tx.get(`/credential_connections/${CONNECTION_ID}`);
      const conn = sip.data?.data;
      console.log('\n  TYPE: Credential Connection (SIP)');
      console.log('  connection_name:', conn.connection_name);
      console.log('  active:', conn.active);
      console.log('  webhook_event_url:', conn.webhook_event_url);
      console.log('  inbound:', JSON.stringify(conn.inbound || {}).slice(0, 300));
      console.log('  outbound:', JSON.stringify(conn.outbound || {}).slice(0, 300));
    } catch (e) {
      console.log('\n  NOT a Credential Connection:', e.response?.status || e.message);
    }

    try {
      const fqdn = await tx.get(`/fqdn_connections/${CONNECTION_ID}`);
      console.log('\n  TYPE: FQDN Connection — webhook_event_url:', fqdn.data?.data?.webhook_event_url);
    } catch (e) {
      // skip
    }

    // 3. Recent call events for this number
    console.log('\n=== 3. Recent calls to/from', NUMBER, '===');
    try {
      const calls = await tx.get('/call_events', {
        params: {
          'filter[to]': NUMBER,
          'page[size]': 10,
        }
      });
      const ev = calls.data?.data || [];
      console.log(`Recent inbound call events: ${ev.length}`);
      for (const e of ev) {
        console.log(`  [${e.created_at}] ${e.event_type} from=${e.from} to=${e.to}`);
      }
    } catch (e) {
      console.log('Could not fetch call events:', e.response?.status, e.response?.data?.errors?.[0]?.detail || e.message);
    }
  } catch (e) {
    console.error('FATAL', e.response?.status, e.response?.data || e.message);
  }
})();
