import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SipTestPage = () => {
  const [sipUsername, setSipUsername] = useState('');
  const [sipPassword, setSipPassword] = useState('');
  const [destination, setDestination] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [callStatus, setCallStatus] = useState('idle');
  const [logs, setLogs] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const clientRef = useRef(null);
  const callRef = useRef(null);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const addLog = useCallback((msg) => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const connect = useCallback(() => {
    if (!sipUsername || !sipPassword) {
      addLog('ERROR: SIP username and password required');
      return;
    }

    setStatus('connecting');
    addLog(`Connecting as ${sipUsername}...`);

    try {
      const client = new TelnyxRTC({
        login: sipUsername,
        password: sipPassword,
      });

      client.on('telnyx.ready', () => {
        setStatus('connected');
        addLog('Connected and registered with Telnyx');
      });

      client.on('telnyx.error', (error) => {
        addLog(`ERROR: ${error.message || JSON.stringify(error)}`);
        setStatus('error');
      });

      client.on('telnyx.socket.error', (error) => {
        addLog(`Socket error: ${error.message || 'Connection failed'}`);
        setStatus('error');
      });

      client.on('telnyx.socket.close', () => {
        addLog('Socket closed');
        setStatus('disconnected');
      });

      client.on('telnyx.notification', (notification) => {
        const call = notification.call;
        if (!call) return;

        addLog(`Call notification: ${notification.type}`);

        if (notification.type === 'callUpdate') {
          const state = call.state;
          addLog(`Call state: ${state}`);

          if (state === 'ringing' || state === 'trying') {
            setCallStatus('ringing');
          } else if (state === 'active' || state === 'early') {
            setCallStatus('active');
            // Start duration timer
            if (!timerRef.current) {
              const start = Date.now();
              timerRef.current = setInterval(() => {
                setCallDuration(Math.floor((Date.now() - start) / 1000));
              }, 1000);
            }
            // Attach remote audio
            if (audioRef.current && call.remoteStream) {
              audioRef.current.srcObject = call.remoteStream;
              audioRef.current.play().catch(() => {});
            }
          } else if (state === 'hangup' || state === 'destroy' || state === 'purge') {
            setCallStatus('idle');
            setCallDuration(0);
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            callRef.current = null;
            addLog(`Call ended: ${call.cause || 'normal'}`);
          }
        }
      });

      client.connect();
      clientRef.current = client;
    } catch (err) {
      addLog(`Connection error: ${err.message}`);
      setStatus('error');
    }
  }, [sipUsername, sipPassword, addLog]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setStatus('disconnected');
    addLog('Disconnected');
  }, [addLog]);

  const makeCall = useCallback(() => {
    if (!clientRef.current || status !== 'connected') {
      addLog('ERROR: Not connected');
      return;
    }
    if (!destination) {
      addLog('ERROR: Destination number required');
      return;
    }

    addLog(`Calling ${destination}...`);
    setCallStatus('calling');

    try {
      const call = clientRef.current.newCall({
        destinationNumber: destination,
        callerNumber: '',
        audio: true,
        video: false,
      });
      callRef.current = call;
    } catch (err) {
      addLog(`Call error: ${err.message}`);
      setCallStatus('idle');
    }
  }, [destination, status, addLog]);

  const hangup = useCallback(() => {
    if (callRef.current) {
      callRef.current.hangup();
      callRef.current = null;
    }
    setCallStatus('idle');
    setCallDuration(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    addLog('Call hung up');
  }, [addLog]);

  // Fetch user SIP credentials from DB
  const loadCredentials = useCallback(async () => {
    addLog('Loading SIP credentials from database...');
    try {
      const resp = await fetch(`${BACKEND_URL}/api/sip-test-credentials`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.sipUsername) {
          setSipUsername(data.sipUsername);
          setSipPassword(data.sipPassword);
          addLog(`Loaded credentials for ${data.phoneNumber} (${data.sipUsername.substring(0, 15)}...)`);
        }
      } else {
        addLog('No credentials found — enter manually');
      }
    } catch (e) {
      addLog('Could not load credentials — enter manually');
    }
  }, [addLog]);

  useEffect(() => {
    loadCredentials();
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

  const statusColors = {
    disconnected: 'bg-gray-500',
    connecting: 'bg-yellow-500 animate-pulse',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">SIP Test Client</h1>
        <p className="text-gray-400 text-sm mb-6">Test outbound SIP calls through Telnyx credential connection</p>

        {/* Status indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
          <span className="text-sm font-medium capitalize">{status}</span>
        </div>

        {/* Credentials */}
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">SIP Credentials</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">SIP Username</label>
              <input
                type="text"
                value={sipUsername}
                onChange={(e) => setSipUsername(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
                placeholder="gencred..."
                disabled={status === 'connected'}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">SIP Password</label>
              <input
                type="password"
                value={sipPassword}
                onChange={(e) => setSipPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
                placeholder="password"
                disabled={status === 'connected'}
              />
            </div>
            <div className="flex gap-2">
              {status !== 'connected' ? (
                <button
                  onClick={connect}
                  disabled={status === 'connecting'}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium"
                >
                  {status === 'connecting' ? 'Connecting...' : 'Connect'}
                </button>
              ) : (
                <button
                  onClick={disconnect}
                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm font-medium"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dialer */}
        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Make a Call</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono"
              placeholder="+1234567890"
              disabled={status !== 'connected' || callStatus !== 'idle'}
            />
            {callStatus === 'idle' ? (
              <button
                onClick={makeCall}
                disabled={status !== 'connected'}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-6 py-2 rounded text-sm font-medium"
              >
                Call
              </button>
            ) : (
              <button
                onClick={hangup}
                className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded text-sm font-medium"
              >
                Hangup
              </button>
            )}
          </div>
          {callStatus !== 'idle' && (
            <div className="mt-3 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${callStatus === 'active' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
              <span className="text-sm capitalize">{callStatus}</span>
              {callStatus === 'active' && (
                <span className="text-sm text-gray-400 ml-2">{formatDuration(callDuration)}</span>
              )}
            </div>
          )}
        </div>

        {/* Audio element for remote stream */}
        <audio ref={audioRef} autoPlay />

        {/* Logs */}
        <div className="bg-gray-900 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Logs</h2>
          <div className="bg-black rounded p-3 h-64 overflow-y-auto font-mono text-xs text-green-400">
            {logs.length === 0 ? (
              <span className="text-gray-600">No logs yet...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={log.includes('ERROR') ? 'text-red-400' : ''}>{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SipTestPage;
