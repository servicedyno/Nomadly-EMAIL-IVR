import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const SIP_DOMAIN = 'sip.speechcue.com';
const MAX_CALL_DURATION = 60;

const PhoneTestPage = () => {
  const [activeTab, setActiveTab] = useState('test');
  const [status, setStatus] = useState('disconnected');
  const [callStatus, setCallStatus] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [destination, setDestination] = useState('');
  const [logs, setLogs] = useState([]);

  // Test mode creds
  const [testUsername, setTestUsername] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testCallsRemaining, setTestCallsRemaining] = useState(0);
  const [credsLoading, setCredsLoading] = useState(false);
  const [credsReady, setCredsReady] = useState(false);
  const [credsError, setCredsError] = useState('');

  // Own creds
  const [ownUsername, setOwnUsername] = useState('');
  const [ownPassword, setOwnPassword] = useState('');

  const clientRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const callStartRef = useRef(null);
  const audioRef = useRef(null);

  const isTestMode = activeTab === 'test';

  const addLog = useCallback((msg, type = '') => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [{ ts, msg, type }, ...prev].slice(0, 100));
  }, []);

  const getCredentials = useCallback(() => {
    if (isTestMode) return { username: testUsername, password: testPassword };
    return { username: ownUsername, password: ownPassword };
  }, [isTestMode, testUsername, testPassword, ownUsername, ownPassword]);

  const stopCallTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCallDuration(0);
    callStartRef.current = null;
  }, []);

  const hangup = useCallback(() => {
    if (callRef.current) {
      callRef.current.hangup();
      callRef.current = null;
    }
    setCallStatus('idle');
    stopCallTimer();
    addLog('Call ended');
  }, [addLog, stopCallTimer]);

  const startCallTimer = useCallback(() => {
    callStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartRef.current) / 1000);
      setCallDuration(elapsed);
      if (isTestMode && elapsed >= MAX_CALL_DURATION) {
        addLog(`Test call time limit reached (${MAX_CALL_DURATION}s)`, 'info');
        hangup();
      }
    }, 1000);
  }, [isTestMode, addLog, hangup]);

  const disconnect = useCallback(() => {
    if (callRef.current) hangup();
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setStatus('disconnected');
    addLog('Disconnected', 'info');
  }, [addLog, hangup]);

  const connect = useCallback(() => {
    const creds = getCredentials();
    if (!creds.username || !creds.password) {
      addLog('Enter SIP credentials first', 'error');
      return;
    }

    setStatus('connecting');
    addLog(`Connecting as ${creds.username.substring(0, 12)}...`);

    try {
      const client = new TelnyxRTC({
        login: creds.username,
        password: creds.password,
      });

      client.on('telnyx.ready', () => {
        setStatus('connected');
        addLog('Registered with Speechcue SIP');
      });

      client.on('telnyx.error', (err) => {
        addLog(`Connection error: ${err.message || 'Unknown'}`, 'error');
        setStatus('error');
      });

      client.on('telnyx.socket.error', () => {
        addLog('Socket error — check credentials', 'error');
        setStatus('error');
      });

      client.on('telnyx.socket.close', () => {
        setStatus('disconnected');
      });

      client.on('telnyx.notification', (notif) => {
        const call = notif.call;
        if (!call) return;

        if (notif.type === 'callUpdate') {
          const state = call.state;

          if (state === 'trying' || state === 'ringing') {
            setCallStatus('ringing');
          } else if (state === 'early') {
            setCallStatus('connecting');
          } else if (state === 'active') {
            setCallStatus('active');
            startCallTimer();
            if (audioRef.current && call.remoteStream) {
              audioRef.current.srcObject = call.remoteStream;
              audioRef.current.play().catch(() => {});
            }
          } else if (state === 'hangup' || state === 'destroy' || state === 'purge') {
            const cause = call.cause || 'ended';
            addLog(`Call ended: ${cause}`);
            setCallStatus('idle');
            stopCallTimer();
            callRef.current = null;
          }
        }
      });

      client.connect();
      clientRef.current = client;
    } catch (e) {
      addLog(`Error: ${e.message}`, 'error');
      setStatus('error');
    }
  }, [getCredentials, addLog, startCallTimer, stopCallTimer]);

  const makeCall = useCallback(() => {
    const dest = destination.replace(/[^+\d]/g, '');
    if (!dest) { addLog('Enter a phone number', 'error'); return; }
    if (!clientRef.current || status !== 'connected') { addLog('Not connected', 'error'); return; }
    if (isTestMode && testCallsRemaining <= 0) {
      addLog('Test calls exhausted. Purchase a plan to continue.', 'error');
      return;
    }

    addLog(`Calling ${dest}...`);
    setCallStatus('calling');

    try {
      const call = clientRef.current.newCall({
        destinationNumber: dest,
        callerNumber: '',
        audio: true,
        video: false,
      });
      callRef.current = call;
    } catch (e) {
      addLog(`Call failed: ${e.message}`, 'error');
      setCallStatus('idle');
    }
  }, [destination, status, isTestMode, testCallsRemaining, addLog]);

  const getTestCredentials = async () => {
    setCredsLoading(true);
    setCredsError('');
    addLog('Requesting test credentials...', 'info');

    try {
      const resp = await fetch(`${BACKEND_URL}/api/phone/test/credentials`, { method: 'POST' });
      const data = await resp.json();

      if (data.error) {
        setCredsError(data.message || data.error);
        addLog(`Error: ${data.message || data.error}`, 'error');
        setCredsLoading(false);
        return;
      }

      setTestUsername(data.sipUsername);
      setTestPassword(data.sipPassword);
      setTestCallsRemaining(data.callsRemaining);
      setCredsReady(true);
      addLog(`Test credentials ready (${data.callsRemaining} calls remaining)`);
    } catch (e) {
      setCredsError('Failed to get credentials');
      addLog(`Failed to get credentials: ${e.message}`, 'error');
    }
    setCredsLoading(false);
  };

  const switchTab = (tab) => {
    if (clientRef.current) disconnect();
    setActiveTab(tab);
  };

  useEffect(() => {
    return () => {
      if (clientRef.current) clientRef.current.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const statusConfig = {
    disconnected: { bg: 'bg-neutral-800', text: 'text-neutral-400', dot: 'bg-neutral-500', label: 'Disconnected' },
    connecting: { bg: 'bg-amber-950/50', text: 'text-amber-400', dot: 'bg-amber-500 animate-pulse', label: 'Connecting...' },
    connected: { bg: 'bg-green-950/50', text: 'text-green-400', dot: 'bg-green-500', label: 'Connected' },
    error: { bg: 'bg-red-950/50', text: 'text-red-400', dot: 'bg-red-500', label: 'Error' },
  };
  const sc = statusConfig[status];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200" data-testid="phone-test-page">
      <div className="max-w-[480px] mx-auto px-4 py-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white" data-testid="page-title">
            <span className="text-green-500">Speechcue</span> Cloud Phone
          </h1>
          <p className="text-xs text-neutral-500 mt-1">Test your SIP connection</p>
        </div>

        {/* Tab Bar */}
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden mb-4" data-testid="tab-bar">
          <button
            className={`flex-1 py-2.5 text-center text-sm font-semibold transition-all ${activeTab === 'test' ? 'bg-green-500 text-black' : 'text-neutral-500 hover:text-neutral-300'}`}
            onClick={() => switchTab('test')}
            data-testid="tab-free-test"
          >
            Free Test
          </button>
          <button
            className={`flex-1 py-2.5 text-center text-sm font-semibold transition-all ${activeTab === 'own' ? 'bg-green-500 text-black' : 'text-neutral-500 hover:text-neutral-300'}`}
            onClick={() => switchTab('own')}
            data-testid="tab-my-credentials"
          >
            My Credentials
          </button>
        </div>

        {/* Test Credentials Tab */}
        {activeTab === 'test' && (
          <div data-testid="tab-test-content">
            <div className="bg-gradient-to-br from-green-950/40 to-[#0a0a0a] border border-green-900/50 rounded-xl p-4 mb-4 text-center">
              <h3 className="text-green-400 text-sm font-semibold mb-1.5">Try Before You Buy</h3>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Get free test credentials to verify your SIP setup works before purchasing a plan.
              </p>
              <div className="text-neutral-400 text-[11px] mt-2 pt-2 border-t border-neutral-800">
                2 test calls &middot; 1 minute max per call
              </div>
            </div>

            {!credsReady && (
              <button
                className="w-full py-2.5 rounded-lg text-sm font-semibold border border-green-500 text-green-500 hover:bg-green-500/10 disabled:opacity-50 transition-all"
                onClick={getTestCredentials}
                disabled={credsLoading}
                data-testid="btn-get-test-creds"
              >
                {credsLoading ? 'Generating...' : credsError || 'Get Test Credentials'}
              </button>
            )}

            {credsReady && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mt-3" data-testid="test-credentials-card">
                <div className="mb-3">
                  <label className="text-[11px] text-neutral-500 block mb-1">Test Username</label>
                  <input
                    type="text"
                    value={testUsername}
                    readOnly
                    className="w-full bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-white"
                    data-testid="test-username-input"
                  />
                </div>
                <div className="mb-3">
                  <label className="text-[11px] text-neutral-500 block mb-1">Test Password</label>
                  <input
                    type="text"
                    value={testPassword}
                    readOnly
                    className="w-full bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-white"
                    data-testid="test-password-input"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-500 block mb-1">SIP Domain</label>
                  <div className="bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-green-500" data-testid="sip-domain-display">
                    {SIP_DOMAIN}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Own Credentials Tab */}
        {activeTab === 'own' && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4" data-testid="tab-own-content">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">SIP Credentials</div>
            <div className="mb-3">
              <label className="text-[11px] text-neutral-500 block mb-1">SIP Username</label>
              <input
                type="text"
                value={ownUsername}
                onChange={(e) => setOwnUsername(e.target.value)}
                placeholder="Enter your SIP username"
                className="w-full bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-600 focus:border-green-500 outline-none transition-colors"
                disabled={status === 'connected'}
                data-testid="own-username-input"
              />
            </div>
            <div className="mb-3">
              <label className="text-[11px] text-neutral-500 block mb-1">SIP Password</label>
              <input
                type="password"
                value={ownPassword}
                onChange={(e) => setOwnPassword(e.target.value)}
                placeholder="Enter your SIP password"
                className="w-full bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-600 focus:border-green-500 outline-none transition-colors"
                disabled={status === 'connected'}
                data-testid="own-password-input"
              />
            </div>
            <div>
              <label className="text-[11px] text-neutral-500 block mb-1">SIP Domain</label>
              <div className="bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-green-500">
                {SIP_DOMAIN}
              </div>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className={`flex items-center gap-2 ${sc.bg} ${sc.text} rounded-lg px-3 py-2 mt-4 text-sm`} data-testid="status-bar">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
          <span>{sc.label}</span>
        </div>

        {/* Connect / Disconnect */}
        <div className="mt-4">
          {status !== 'connected' ? (
            <button
              onClick={connect}
              disabled={status === 'connecting'}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-green-500 text-black hover:bg-green-600 disabled:opacity-50 transition-all"
              data-testid="btn-connect"
            >
              {status === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all"
              data-testid="btn-disconnect"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Dialer */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mt-4" data-testid="dialer-card">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Make a Call</div>
          <div className="flex gap-2">
            <input
              type="tel"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="+1 (234) 567-8900"
              className="flex-1 bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-600 focus:border-green-500 outline-none transition-colors"
              disabled={status !== 'connected' || callStatus !== 'idle'}
              data-testid="destination-input"
            />
            {callStatus === 'idle' ? (
              <button
                onClick={makeCall}
                disabled={status !== 'connected'}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-green-500 text-black hover:bg-green-600 disabled:opacity-50 transition-all"
                data-testid="btn-call"
              >
                Call
              </button>
            ) : (
              <button
                onClick={hangup}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all"
                data-testid="btn-hangup"
              >
                End
              </button>
            )}
          </div>

          {callStatus !== 'idle' && (
            <div className="flex items-center justify-between bg-green-950/50 border border-green-900/50 rounded-lg p-3 mt-3" data-testid="call-info">
              <div>
                <div className="text-sm text-green-300 capitalize">{callStatus === 'calling' ? 'Calling...' : callStatus === 'ringing' ? 'Ringing...' : callStatus === 'connecting' ? 'Connecting...' : 'Connected'}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{destination}</div>
              </div>
              <div className="font-mono text-xl font-bold text-green-500" data-testid="call-timer">
                {formatDuration(callDuration)}
              </div>
            </div>
          )}
        </div>

        {/* Audio element */}
        <audio ref={audioRef} autoPlay />

        {/* Logs */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mt-4" data-testid="logs-card">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Connection Log</div>
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-3 h-44 overflow-y-auto font-mono text-[11px] text-green-400" data-testid="logs-container">
            {logs.length === 0 ? (
              <div className="text-neutral-600">Ready to connect...</div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={log.type === 'error' ? 'text-red-400' : log.type === 'info' ? 'text-neutral-500' : ''}>
                  [{log.ts}] {log.msg}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-[11px] text-neutral-600">
          Speechcue Cloud Phone &middot; Powered by Speechcue
        </div>
      </div>
    </div>
  );
};

export default PhoneTestPage;
