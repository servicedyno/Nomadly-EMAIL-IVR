const WebSocket = require('/app/node_modules/ws')

const HOST = 'wss://rtc.telnyx.com'
const creds = [
  ['161ab41a (gencred1lwe4hOV — user current)', 'gencred1lwe4hOVZZJzunVSeh95RTkLYZsRAn9fjC8YOLlZV1', '5d0b93c3727b41f3aa5ea8eb656a40be'],
]

function testLogin(label, login, passwd) {
  return new Promise((resolve) => {
    console.log(`\n######## ${label} ########`)
    const ws = new WebSocket(HOST, { handshakeTimeout: 10000 })
    let done = false
    const finish = (verdict) => { if (done) return; done = true; try { ws.close() } catch (_) {}; console.log('VERDICT:', verdict); resolve(verdict) }
    const to = setTimeout(() => finish('TIMEOUT (no auth response in 12s)'), 12000)
    ws.on('open', () => {
      console.log('[open] WSS connected to', HOST)
      const msg = {
        jsonrpc: '2.0', id: 'login-1', method: 'login',
        params: { login, passwd, login_token: undefined, userVariables: {}, loginParams: {} }
      }
      ws.send(JSON.stringify(msg))
      console.log('[sent] login request for', login.slice(0, 16) + '...')
    })
    ws.on('message', (data) => {
      const s = data.toString()
      console.log('[recv]', s.slice(0, 400))
      try {
        const j = JSON.parse(s)
        if (j.error) { clearTimeout(to); finish(`AUTH FAILURE → code ${j.error.code} ${j.error.message || ''}`) }
        else if (j.result) { clearTimeout(to); finish(`AUTH OK → ${JSON.stringify(j.result).slice(0,120)}`) }
      } catch (_) {}
    })
    ws.on('error', (e) => { clearTimeout(to); finish(`WS ERROR: ${e.message}`) })
    ws.on('close', (code, reason) => { console.log(`[close] code=${code} reason=${reason}`); })
  })
}

(async () => {
  for (const [label, login, passwd] of creds) {
    await testLogin(label, login, passwd)
  }
  process.exit(0)
})()
