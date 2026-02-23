/**
 * Speechcue Cloud Phone — SIP Test Page Routes
 * Serves the white-labeled SIP test page and manages test credentials
 */

const { MongoClient } = require('mongodb')

const SIP_DOMAIN = process.env.SIP_DOMAIN || 'sip.speechcue.com'
const MAX_TEST_CALLS = 2
const MAX_CALL_DURATION_SEC = 60

let _db = null
let _telnyxApi = null
let _sipConnectionId = null

function initPhoneTestRoutes(app, db, telnyxApi, sipConnectionId) {
  _db = db
  _telnyxApi = telnyxApi
  _sipConnectionId = sipConnectionId

  // Ensure index for test credentials
  db.collection('testCredentials').createIndex({ ip: 1 }).catch(() => {})
  db.collection('testCredentials').createIndex({ sipUsername: 1 }).catch(() => {})
  db.collection('testCredentials').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }).catch(() => {})

  // ── Serve the SIP test page ──
  app.get('/phone/test', (req, res) => {
    res.send(getTestPageHTML())
  })

  // ── Generate test credentials ──
  app.post('/phone/test/credentials', async (req, res) => {
    try {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown'

      // Check if this IP already exhausted test calls
      const existing = await db.collection('testCredentials').find({ ip }).toArray()
      const totalCalls = existing.reduce((sum, c) => sum + (c.callsMade || 0), 0)

      if (totalCalls >= MAX_TEST_CALLS) {
        return res.status(429).json({
          error: 'Test limit reached',
          message: `You've already used your ${MAX_TEST_CALLS} free test calls. Purchase a plan to continue.`
        })
      }

      // Check if there's an active (unexpired) credential for this IP
      const active = existing.find(c => !c.expired && c.callsMade < MAX_TEST_CALLS)
      if (active) {
        return res.json({
          sipUsername: active.sipUsername,
          sipPassword: active.sipPassword,
          sipDomain: SIP_DOMAIN,
          callsRemaining: MAX_TEST_CALLS - totalCalls,
          maxDuration: MAX_CALL_DURATION_SEC
        })
      }

      // Generate new test credential
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
      let username = 'test_'
      for (let i = 0; i < 8; i++) username += chars[Math.floor(Math.random() * chars.length)]

      const passChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let password = ''
      for (let i = 0; i < 16; i++) password += passChars[Math.floor(Math.random() * passChars.length)]

      // Create SIP credential via Telnyx API
      if (!_sipConnectionId) {
        return res.status(500).json({ error: 'SIP connection not configured' })
      }

      const credential = await _telnyxApi.createSIPCredential(_sipConnectionId, username, password)
      if (!credential) {
        return res.status(500).json({ error: 'Failed to create test credential' })
      }

      // Store in DB
      await db.collection('testCredentials').insertOne({
        ip,
        sipUsername: username,
        sipPassword: password,
        credentialId: credential.id || credential.sip_username,
        callsMade: 0,
        maxCalls: MAX_TEST_CALLS,
        expired: false,
        createdAt: new Date()
      })

      console.log(`[PhoneTest] Created test credential for IP ${ip}: ${username}`)

      res.json({
        sipUsername: username,
        sipPassword: password,
        sipDomain: SIP_DOMAIN,
        callsRemaining: MAX_TEST_CALLS - totalCalls,
        maxDuration: MAX_CALL_DURATION_SEC
      })
    } catch (e) {
      console.error('[PhoneTest] Error creating credentials:', e.message)
      res.status(500).json({ error: 'Internal error' })
    }
  })

  console.log('[PhoneTest] Routes initialized: /phone/test')
}

/**
 * Called from voice-service on call.initiated to track test calls
 * Returns { isTestCall, maxDuration } if the caller is a test credential
 */
async function checkTestCredentialCall(sipUsername, fromPhone) {
  if (!_db) return { isTestCall: false }

  try {
    // Check by SIP username
    const cred = await _db.collection('testCredentials').findOne({
      sipUsername: sipUsername,
      expired: false
    })

    if (!cred) {
      // Also try matching by phone number in from (for connection_id based detection)
      // Test credentials don't have assigned phone numbers, so skip
      return { isTestCall: false }
    }

    // Increment call count
    const newCount = (cred.callsMade || 0) + 1
    await _db.collection('testCredentials').updateOne(
      { _id: cred._id },
      { $set: { callsMade: newCount, lastCallAt: new Date() } }
    )

    // Expire if max calls reached
    if (newCount >= cred.maxCalls) {
      await _db.collection('testCredentials').updateOne(
        { _id: cred._id },
        { $set: { expired: true } }
      )
      console.log(`[PhoneTest] Test credential ${sipUsername} expired after ${newCount} calls`)
    }

    console.log(`[PhoneTest] Test call #${newCount}/${cred.maxCalls} by ${sipUsername} (IP: ${cred.ip})`)

    return {
      isTestCall: true,
      maxDuration: MAX_CALL_DURATION_SEC,
      callsRemaining: cred.maxCalls - newCount
    }
  } catch (e) {
    console.error('[PhoneTest] Error checking test credential:', e.message)
    return { isTestCall: false }
  }
}


function getTestPageHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Speechcue Cloud Phone — Test Your SIP Connection</title>
  <script src="https://unpkg.com/@telnyx/webrtc@2/lib/bundle.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; }
    .container { max-width: 480px; margin: 0 auto; padding: 24px 16px; }
    .logo { text-align: center; margin-bottom: 32px; }
    .logo h1 { font-size: 24px; font-weight: 700; color: #fff; }
    .logo h1 span { color: #22c55e; }
    .logo p { font-size: 13px; color: #737373; margin-top: 4px; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .card-title { font-size: 14px; font-weight: 600; color: #a3a3a3; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    label { display: block; font-size: 12px; color: #737373; margin-bottom: 4px; }
    input { width: 100%; background: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 10px 12px; color: #fff; font-size: 14px; font-family: 'SF Mono', Monaco, monospace; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #22c55e; }
    input:disabled { opacity: 0.5; cursor: not-allowed; }
    .input-group { margin-bottom: 12px; }
    .domain-display { background: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 10px 12px; color: #22c55e; font-size: 14px; font-family: 'SF Mono', Monaco, monospace; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; width: 100%; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-green { background: #22c55e; color: #000; }
    .btn-green:hover:not(:disabled) { background: #16a34a; }
    .btn-red { background: #ef4444; color: #fff; }
    .btn-red:hover:not(:disabled) { background: #dc2626; }
    .btn-outline { background: transparent; color: #22c55e; border: 1px solid #22c55e; }
    .btn-outline:hover:not(:disabled) { background: #22c55e15; }
    .btn-sm { padding: 8px 14px; font-size: 13px; width: auto; }
    .status-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
    .status-bar.disconnected { background: #1c1c1c; color: #737373; }
    .status-bar.connecting { background: #422006; color: #f59e0b; }
    .status-bar.connected { background: #052e16; color: #22c55e; }
    .status-bar.error { background: #450a0a; color: #ef4444; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .disconnected .dot { background: #525252; }
    .connecting .dot { background: #f59e0b; animation: pulse 1.5s infinite; }
    .connected .dot { background: #22c55e; }
    .error .dot { background: #ef4444; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .dialer { display: flex; gap: 8px; }
    .dialer input { flex: 1; }
    .call-info { display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #052e16; border: 1px solid #166534; border-radius: 8px; margin-top: 12px; }
    .call-timer { font-family: 'SF Mono', Monaco, monospace; font-size: 20px; color: #22c55e; font-weight: 700; }
    .call-state { font-size: 13px; color: #86efac; }
    .logs { background: #0a0a0a; border: 1px solid #262626; border-radius: 8px; padding: 12px; height: 180px; overflow-y: auto; font-family: 'SF Mono', Monaco, monospace; font-size: 11px; color: #4ade80; }
    .logs .error { color: #f87171; }
    .logs .info { color: #737373; }
    .test-banner { background: linear-gradient(135deg, #052e16, #0a0a0a); border: 1px solid #166534; border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: center; }
    .test-banner h3 { color: #22c55e; font-size: 15px; margin-bottom: 6px; }
    .test-banner p { color: #737373; font-size: 12px; line-height: 1.5; }
    .test-banner .limits { color: #a3a3a3; font-size: 11px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #262626; }
    .separator { text-align: center; color: #525252; font-size: 12px; margin: 16px 0; position: relative; }
    .separator::before, .separator::after { content: ''; position: absolute; top: 50%; width: 40%; height: 1px; background: #262626; }
    .separator::before { left: 0; }
    .separator::after { right: 0; }
    .tab-bar { display: flex; gap: 0; margin-bottom: 16px; background: #171717; border: 1px solid #262626; border-radius: 10px; overflow: hidden; }
    .tab { flex: 1; padding: 10px; text-align: center; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; color: #737373; }
    .tab.active { background: #22c55e; color: #000; }
    .tab:hover:not(.active) { color: #a3a3a3; }
    .hidden { display: none !important; }
    .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #525252; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1><span>Speechcue</span> Cloud Phone</h1>
      <p>Test your SIP connection</p>
    </div>

    <!-- Tab Bar -->
    <div class="tab-bar">
      <div class="tab active" onclick="switchTab('test')">Free Test</div>
      <div class="tab" onclick="switchTab('own')">My Credentials</div>
    </div>

    <!-- Test Credentials Tab -->
    <div id="tab-test">
      <div class="test-banner">
        <h3>Try Before You Buy</h3>
        <p>Get free test credentials to verify your SIP setup works before purchasing a plan.</p>
        <div class="limits">2 test calls · 1 minute max per call</div>
      </div>
      <button class="btn btn-outline" id="btn-get-creds" onclick="getTestCredentials()">
        Get Test Credentials
      </button>
      <div id="test-creds-info" class="hidden" style="margin-top: 12px;">
        <div class="card" style="margin-bottom: 0;">
          <div class="input-group">
            <label>Test Username</label>
            <input type="text" id="test-username" readonly>
          </div>
          <div class="input-group">
            <label>Test Password</label>
            <input type="text" id="test-password" readonly>
          </div>
          <div class="input-group" style="margin-bottom: 0;">
            <label>SIP Domain</label>
            <div class="domain-display">${SIP_DOMAIN}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Own Credentials Tab -->
    <div id="tab-own" class="hidden">
      <div class="card">
        <div class="card-title">SIP Credentials</div>
        <div class="input-group">
          <label>SIP Username</label>
          <input type="text" id="sip-username" placeholder="Enter your SIP username" />
        </div>
        <div class="input-group">
          <label>SIP Password</label>
          <input type="password" id="sip-password" placeholder="Enter your SIP password" />
        </div>
        <div class="input-group" style="margin-bottom: 0;">
          <label>SIP Domain</label>
          <div class="domain-display">${SIP_DOMAIN}</div>
        </div>
      </div>
    </div>

    <!-- Status -->
    <div class="status-bar disconnected" id="status-bar" style="margin-top: 16px;">
      <div class="dot"></div>
      <span id="status-text">Disconnected</span>
    </div>

    <!-- Connect / Disconnect -->
    <div style="margin-bottom: 16px;">
      <button class="btn btn-green" id="btn-connect" onclick="connect()">Connect</button>
      <button class="btn btn-red hidden" id="btn-disconnect" onclick="disconnect()">Disconnect</button>
    </div>

    <!-- Dialer -->
    <div class="card">
      <div class="card-title">Make a Call</div>
      <div class="dialer">
        <input type="tel" id="destination" placeholder="+1 (234) 567-8900" />
        <button class="btn btn-green btn-sm" id="btn-call" onclick="makeCall()" disabled>Call</button>
        <button class="btn btn-red btn-sm hidden" id="btn-hangup" onclick="hangup()">End</button>
      </div>
      <div id="call-info" class="call-info hidden">
        <div>
          <div class="call-state" id="call-state">Calling...</div>
          <div style="font-size: 12px; color: #525252; margin-top: 2px;" id="call-dest"></div>
        </div>
        <div class="call-timer" id="call-timer">0:00</div>
      </div>
    </div>

    <!-- Logs -->
    <div class="card">
      <div class="card-title">Connection Log</div>
      <div class="logs" id="logs">
        <div class="info">Ready to connect...</div>
      </div>
    </div>

    <div class="footer">
      Speechcue Cloud Phone &middot; Powered by Speechcue
    </div>
  </div>

  <audio id="remote-audio" autoplay></audio>

  <script>
    const SIP_DOMAIN = '${SIP_DOMAIN}';
    const MAX_CALL_DURATION = ${MAX_CALL_DURATION_SEC};
    let client = null;
    let currentCall = null;
    let callTimer = null;
    let callStartTime = null;
    let isTestMode = true;
    let testCallsRemaining = 0;

    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.getElementById('tab-test').classList.add('hidden');
      document.getElementById('tab-own').classList.add('hidden');

      if (tab === 'test') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('tab-test').classList.remove('hidden');
        isTestMode = true;
      } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('tab-own').classList.remove('hidden');
        isTestMode = false;
      }

      // Disconnect if switching tabs
      if (client) disconnect();
    }

    function log(msg, type) {
      const el = document.getElementById('logs');
      const ts = new Date().toLocaleTimeString();
      const cls = type === 'error' ? 'error' : type === 'info' ? 'info' : '';
      el.innerHTML = '<div class="' + cls + '">[' + ts + '] ' + msg + '</div>' + el.innerHTML;
    }

    function setStatus(status, text) {
      const bar = document.getElementById('status-bar');
      bar.className = 'status-bar ' + status;
      document.getElementById('status-text').textContent = text;
    }

    async function getTestCredentials() {
      const btn = document.getElementById('btn-get-creds');
      btn.disabled = true;
      btn.textContent = 'Generating...';
      log('Requesting test credentials...', 'info');

      try {
        const resp = await fetch(window.location.pathname + '/credentials', { method: 'POST' });
        const data = await resp.json();

        if (data.error) {
          log('Error: ' + data.message, 'error');
          btn.textContent = data.message || 'Limit reached';
          return;
        }

        document.getElementById('test-username').value = data.sipUsername;
        document.getElementById('test-password').value = data.sipPassword;
        document.getElementById('test-creds-info').classList.remove('hidden');
        testCallsRemaining = data.callsRemaining;

        log('Test credentials ready (' + data.callsRemaining + ' calls remaining)');
        btn.textContent = 'Credentials Ready';
      } catch (e) {
        log('Failed to get credentials: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Get Test Credentials';
      }
    }

    function getCredentials() {
      if (isTestMode) {
        return {
          username: document.getElementById('test-username').value,
          password: document.getElementById('test-password').value
        };
      }
      return {
        username: document.getElementById('sip-username').value,
        password: document.getElementById('sip-password').value
      };
    }

    function connect() {
      const creds = getCredentials();
      if (!creds.username || !creds.password) {
        log('Enter SIP credentials first', 'error');
        return;
      }

      setStatus('connecting', 'Connecting...');
      log('Connecting as ' + creds.username.substring(0, 12) + '...');

      try {
        client = new TelnyxRTC({
          login: creds.username,
          password: creds.password
        });

        client.on('telnyx.ready', () => {
          setStatus('connected', 'Connected');
          log('Registered with Speechcue SIP');
          document.getElementById('btn-connect').classList.add('hidden');
          document.getElementById('btn-disconnect').classList.remove('hidden');
          document.getElementById('btn-call').disabled = false;
        });

        client.on('telnyx.error', (err) => {
          log('Connection error: ' + (err.message || 'Unknown'), 'error');
          setStatus('error', 'Error');
        });

        client.on('telnyx.socket.error', () => {
          log('Socket error — check credentials', 'error');
          setStatus('error', 'Connection Failed');
        });

        client.on('telnyx.socket.close', () => {
          setStatus('disconnected', 'Disconnected');
          document.getElementById('btn-connect').classList.remove('hidden');
          document.getElementById('btn-disconnect').classList.add('hidden');
          document.getElementById('btn-call').disabled = true;
        });

        client.on('telnyx.notification', (notif) => {
          const call = notif.call;
          if (!call) return;

          if (notif.type === 'callUpdate') {
            const state = call.state;

            if (state === 'trying' || state === 'ringing') {
              showCallUI('Ringing...');
            } else if (state === 'early') {
              showCallUI('Connecting...');
            } else if (state === 'active') {
              showCallUI('Connected');
              startCallTimer();
              if (document.getElementById('remote-audio') && call.remoteStream) {
                document.getElementById('remote-audio').srcObject = call.remoteStream;
              }
            } else if (state === 'hangup' || state === 'destroy' || state === 'purge') {
              const cause = call.cause || 'ended';
              log('Call ended: ' + cause);
              hideCallUI();
              currentCall = null;
            }
          }
        });

        client.connect();
      } catch (e) {
        log('Error: ' + e.message, 'error');
        setStatus('error', 'Error');
      }
    }

    function disconnect() {
      if (currentCall) hangup();
      if (client) { client.disconnect(); client = null; }
      setStatus('disconnected', 'Disconnected');
      document.getElementById('btn-connect').classList.remove('hidden');
      document.getElementById('btn-disconnect').classList.add('hidden');
      document.getElementById('btn-call').disabled = true;
      log('Disconnected', 'info');
    }

    function makeCall() {
      const dest = document.getElementById('destination').value.replace(/[^+\\d]/g, '');
      if (!dest) { log('Enter a phone number', 'error'); return; }
      if (!client) { log('Not connected', 'error'); return; }

      if (isTestMode && testCallsRemaining <= 0) {
        log('Test calls exhausted. Purchase a plan to continue.', 'error');
        return;
      }

      log('Calling ' + dest + '...');
      document.getElementById('call-dest').textContent = dest;

      try {
        currentCall = client.newCall({
          destinationNumber: dest,
          callerNumber: '',
          audio: true,
          video: false
        });
        showCallUI('Calling...');
      } catch (e) {
        log('Call failed: ' + e.message, 'error');
      }
    }

    function hangup() {
      if (currentCall) {
        currentCall.hangup();
        currentCall = null;
      }
      hideCallUI();
      log('Call ended');
    }

    function showCallUI(state) {
      document.getElementById('call-info').classList.remove('hidden');
      document.getElementById('call-state').textContent = state;
      document.getElementById('btn-call').classList.add('hidden');
      document.getElementById('btn-hangup').classList.remove('hidden');
    }

    function hideCallUI() {
      document.getElementById('call-info').classList.add('hidden');
      document.getElementById('btn-call').classList.remove('hidden');
      document.getElementById('btn-hangup').classList.add('hidden');
      stopCallTimer();
    }

    function startCallTimer() {
      callStartTime = Date.now();
      callTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        document.getElementById('call-timer').textContent = m + ':' + (s < 10 ? '0' : '') + s;

        // Auto-hangup at max duration (test mode)
        if (isTestMode && elapsed >= MAX_CALL_DURATION) {
          log('Test call time limit reached (' + MAX_CALL_DURATION + 's)', 'info');
          hangup();
        }
      }, 1000);
    }

    function stopCallTimer() {
      if (callTimer) { clearInterval(callTimer); callTimer = null; }
      document.getElementById('call-timer').textContent = '0:00';
      callStartTime = null;
    }
  <\/script>
</body>
</html>`;
}

module.exports = { initPhoneTestRoutes, checkTestCredentialCall }
