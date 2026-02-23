import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const SIP_DOMAIN = 'sip.speechcue.com';
const MAX_CALL_DURATION = 60;
const TELEGRAM_BOT_URL = 'https://t.me/Nomadlybot';

const PhoneTestPage = () => {
  const [activeTab, setActiveTab] = useState('test');
  const [status, setStatus] = useState('disconnected');
  const [callStatus, setCallStatus] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [destination, setDestination] = useState('');
  const [logs, setLogs] = useState([]);

  // OTP state
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  // Test creds (after OTP verified)
  const [testUsername, setTestUsername] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testCallsRemaining, setTestCallsRemaining] = useState(0);
  const [callerNumber, setCallerNumber] = useState('');
  const [credsReady, setCredsReady] = useState(false);

  // Own creds
  const [ownUsername, setOwnUsername] = useState('');
  const [ownPassword, setOwnPassword] = useState('');

  const clientRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const callStartRef = useRef(null);
  const audioRef = useRef(null);

  // Incoming call state
  const [incomingCall, setIncomingCall] = useState(null);
  const [incomingCaller, setIncomingCaller] = useState('');
  const [incomingCallerName, setIncomingCallerName] = useState('');
  const [incomingCallerLocation, setIncomingCallerLocation] = useState('');

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
    setIncomingCall(null);
    setIncomingCaller('');
    setIncomingCallerName('');
    setIncomingCallerLocation('');
    stopCallTimer();
    addLog('Call ended');
  }, [addLog, stopCallTimer]);

  const answerIncoming = useCallback(() => {
    if (incomingCall) {
      addLog('Answering incoming call...');
      incomingCall.answer();
    }
  }, [incomingCall, addLog]);

  const rejectIncoming = useCallback(() => {
    if (incomingCall) {
      addLog('Rejecting incoming call');
      incomingCall.hangup();
    }
    setIncomingCall(null);
    setIncomingCaller('');
    setIncomingCallerName('');
    setIncomingCallerLocation('');
    callRef.current = null;
  }, [incomingCall, addLog]);

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
          const direction = call.direction;

          // Inbound call handling
          if (direction === 'inbound') {
            if (state === 'ringing' || state === 'requesting') {
              const caller = call.options?.remoteCallerNumber || call.options?.callerNumber || 'Unknown';
              addLog(`Incoming call from ${caller}`);
              setIncomingCall(call);
              setIncomingCaller(caller);
              setIncomingCallerName('');
              setIncomingCallerLocation('');
              callRef.current = call;
              // Fetch caller info (CNAM + location) in background
              if (caller && caller !== 'Unknown') {
                fetch(`${BACKEND_URL}/api/phone/test/caller-info`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ number: caller }),
                }).then(r => r.json()).then(info => {
                  if (info.name) setIncomingCallerName(info.name);
                  if (info.location) setIncomingCallerLocation(info.location);
                }).catch(() => {});
              }
              return;
            }
            if (state === 'active') {
              addLog('Inbound call connected');
              setIncomingCall(null);
              setCallStatus('active');
              startCallTimer();
              if (audioRef.current && call.remoteStream) {
                audioRef.current.srcObject = call.remoteStream;
                audioRef.current.play().catch(() => {});
              }
              return;
            }
            if (state === 'hangup' || state === 'destroy' || state === 'purge') {
              addLog(`Inbound call ended: ${call.cause || 'ended'}`);
              setIncomingCall(null);
              setIncomingCaller('');
              setIncomingCallerName('');
              setIncomingCallerLocation('');
              setCallStatus('idle');
              stopCallTimer();
              callRef.current = null;
              return;
            }
          }

          // Outbound call handling
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
            addLog(`Call ended: ${call.cause || 'ended'}`);
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

  const makeCall = useCallback(async () => {
    const dest = destination.replace(/[^+\d]/g, '');
    if (!dest) { addLog('Enter a phone number', 'error'); return; }
    if (!clientRef.current || status !== 'connected') { addLog('Not connected', 'error'); return; }
    if (isTestMode && testCallsRemaining <= 0) {
      addLog('Test calls exhausted. Purchase a plan to continue.', 'error');
      return;
    }

    // Pre-dial: update SIP ANI override to caller's phone number
    if (callerNumber) {
      addLog('Preparing call...');
      try {
        await fetch(`${BACKEND_URL}/api/phone/test/prepare-call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callerNumber }),
        });
      } catch (_) { /* non-blocking — ANI may already be correct */ }
    }

    addLog(`Calling ${dest}...`);
    setCallStatus('calling');

    try {
      const call = clientRef.current.newCall({
        destinationNumber: dest,
        callerNumber: callerNumber || '',
        audio: true,
        video: false,
      });
      callRef.current = call;
    } catch (e) {
      addLog(`Call failed: ${e.message}`, 'error');
      setCallStatus('idle');
    }
  }, [destination, status, isTestMode, testCallsRemaining, callerNumber, addLog]);

  const verifyOtp = async () => {
    if (!otpValue || otpValue.length !== 6) {
      setOtpError('Please enter a valid 6-digit code.');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    addLog('Verifying code...', 'info');

    try {
      const resp = await fetch(`${BACKEND_URL}/api/phone/test/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otpValue }),
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text }; }

      if (!resp.ok || data.error) {
        const errorMsg = data.message || data.error || 'Invalid code';
        setOtpError(errorMsg);
        addLog(`Error: ${errorMsg}`, 'error');
        setOtpLoading(false);
        return;
      }

      setTestUsername(data.sipUsername);
      setTestPassword(data.sipPassword);
      setTestCallsRemaining(data.callsRemaining);
      setCallerNumber(data.callerNumber || '');
      setCredsReady(true);
      addLog(`Credentials ready (${data.callsRemaining} calls remaining)`);
    } catch (e) {
      setOtpError('Verification failed. Send /testsip in the bot for a new code.');
      addLog(`Verification failed: ${e.message}`, 'error');
    }
    setOtpLoading(false);
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
            {!credsReady ? (
              <>
                {/* Instructions */}
                <div className="bg-gradient-to-br from-green-950/40 to-[#0a0a0a] border border-green-900/50 rounded-xl p-4 mb-4 text-center">
                  <h3 className="text-green-400 text-sm font-semibold mb-1.5">Try Before You Buy</h3>
                  <p className="text-neutral-500 text-xs leading-relaxed mb-3">
                    Get a one-time code from our Telegram bot to unlock your free SIP test credentials.
                  </p>
                  <div className="text-neutral-400 text-[11px] pt-2 border-t border-neutral-800">
                    2 test calls &middot; 1 minute max per call
                  </div>
                </div>

                {/* Step 1: Get code from bot */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                    <div>
                      <div className="text-sm font-medium text-white mb-1">Get your code</div>
                      <p className="text-xs text-neutral-500 mb-3">
                        Send <span className="font-mono text-green-400">/testsip</span> to our Telegram bot to receive a 6-digit code.
                      </p>
                      <a
                        href={TELEGRAM_BOT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#2AABEE] text-white hover:bg-[#229ED9] transition-colors"
                        data-testid="telegram-bot-link"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                        Open @Nomadlybot
                      </a>
                    </div>
                  </div>
                </div>

                {/* Step 2: Enter code */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white mb-2">Enter your code</div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={otpValue}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setOtpValue(v);
                            setOtpError('');
                          }}
                          placeholder="6-digit code"
                          maxLength={6}
                          className="flex-1 bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-white text-center tracking-[0.3em] placeholder-neutral-600 focus:border-green-500 outline-none transition-colors"
                          data-testid="otp-input"
                        />
                        <button
                          onClick={verifyOtp}
                          disabled={otpLoading || otpValue.length !== 6}
                          className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-500 text-black hover:bg-green-600 disabled:opacity-50 transition-all"
                          data-testid="btn-verify-otp"
                        >
                          {otpLoading ? 'Verifying...' : 'Verify'}
                        </button>
                      </div>
                      {otpError && (
                        <p className="text-red-400 text-xs mt-2" data-testid="otp-error">{otpError}</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Credentials ready */
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4" data-testid="test-credentials-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Test Credentials</div>
                  <span className="text-[11px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                    {testCallsRemaining} call{testCallsRemaining !== 1 ? 's' : ''} left
                  </span>
                </div>
                <div className="mb-3">
                  <label className="text-[11px] text-neutral-500 block mb-1">Username</label>
                  <input
                    type="text" value={testUsername} readOnly
                    className="w-full bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-white"
                    data-testid="test-username-input"
                  />
                </div>
                <div className="mb-3">
                  <label className="text-[11px] text-neutral-500 block mb-1">Password</label>
                  <input
                    type="text" value={testPassword} readOnly
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
                type="text" value={ownUsername} onChange={(e) => setOwnUsername(e.target.value)}
                placeholder="Enter your SIP username"
                className="w-full bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-600 focus:border-green-500 outline-none transition-colors"
                disabled={status === 'connected'}
                data-testid="own-username-input"
              />
            </div>
            <div className="mb-3">
              <label className="text-[11px] text-neutral-500 block mb-1">SIP Password</label>
              <input
                type="password" value={ownPassword} onChange={(e) => setOwnPassword(e.target.value)}
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

        {/* Incoming Call Overlay — full-screen modal, impossible to miss */}
        {incomingCall && callStatus !== 'active' && (
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-end justify-center" data-testid="incoming-call-overlay">
            <div className="w-full max-w-[480px] bg-[#111] border-t border-neutral-700 rounded-t-3xl shadow-2xl shadow-black/80 pb-8 pt-2">
              {/* Drag handle */}
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-neutral-600" />
              </div>
              {/* Pulsing ring indicator */}
              <div className="flex flex-col items-center px-6">
                <div className="relative mb-5">
                  <div className="absolute inset-0 w-20 h-20 rounded-full bg-green-500/20 animate-ping" />
                  <div className="relative w-20 h-20 rounded-full bg-neutral-800 border-2 border-green-500/50 flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <div className="text-green-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">Incoming Call</div>
                {incomingCallerName && (
                  <div className="text-white font-bold text-xl mb-1" data-testid="incoming-caller-name">{incomingCallerName}</div>
                )}
                <div className={`font-mono ${incomingCallerName ? 'text-base text-neutral-400' : 'text-white font-bold text-xl'} mb-1`} data-testid="incoming-caller-number">
                  {incomingCaller || 'Unknown Number'}
                </div>
                {incomingCallerLocation && (
                  <div className="text-sm text-neutral-500 flex items-center gap-1.5 mb-2" data-testid="incoming-caller-location">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {incomingCallerLocation}
                  </div>
                )}
              </div>
              {/* Action buttons */}
              <div className="flex justify-center gap-8 mt-8 px-6">
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={rejectIncoming}
                    className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-red-500/40"
                    data-testid="btn-reject-incoming"
                  >
                    <svg className="w-7 h-7 rotate-[135deg]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>
                  <span className="text-xs text-red-400 font-medium">Decline</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={answerIncoming}
                    className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 text-black flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-green-500/40 animate-pulse"
                    data-testid="btn-answer-incoming"
                  >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>
                  <span className="text-xs text-green-400 font-medium">Answer</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dialer */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mt-4" data-testid="dialer-card">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Make a Call</div>
          <div className="flex gap-2">
            <input
              type="tel" value={destination} onChange={(e) => setDestination(e.target.value)}
              placeholder="+1 (234) 567-8900"
              className="flex-1 bg-[#0a0a0a] border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-neutral-600 focus:border-green-500 outline-none transition-colors"
              disabled={status !== 'connected' || callStatus !== 'idle'}
              data-testid="destination-input"
            />
            {callStatus === 'idle' ? (
              <button
                onClick={makeCall} disabled={status !== 'connected'}
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
                <div className="text-sm text-green-300 capitalize">
                  {callStatus === 'calling' ? 'Calling...' : callStatus === 'ringing' ? 'Ringing...' : callStatus === 'connecting' ? 'Connecting...' : 'Connected'}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {incomingCaller ? `Inbound: ${incomingCaller}` : destination}
                </div>
              </div>
              <div className="font-mono text-xl font-bold text-green-500" data-testid="call-timer">
                {formatDuration(callDuration)}
              </div>
            </div>
          )}
        </div>

        {/* Audio */}
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
