/* global describe, test, expect, beforeAll */
/**
 * End-to-end test of the panel API scanner-block fix.
 *
 * Confirms that the welc4757 bug is fixed for both UNAUTHENTICATED and
 * AUTHENTICATED panel requests:
 *
 * Unauth:    /api/panel/files/content?file=index.php → 401 JSON (was empty 403)
 * Auth:      /api/panel/files/content?file=index.php → reaches the WHM
 *            proxy layer (was silently 403'd before reaching the handler)
 *
 * Test account: premtest / PIN 123456 (DB-only seed — WHM call will fail
 *               but the IMPORTANT thing is the request gets PAST the
 *               scanner-block middleware, which is what was broken).
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')

const API_URL = process.env.API_URL || require('fs').readFileSync('/app/frontend/.env', 'utf8')
  .split('\n').find(l => l.startsWith('REACT_APP_BACKEND_URL='))?.split('=')[1].trim()

if (!API_URL) throw new Error('API_URL not resolvable')

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, API_URL)
    const lib = u.protocol === 'https:' ? https : http
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: { 'Content-Type': 'application/json', ...headers },
    }
    const req = lib.request(opts, res => {
      let chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString()
        let json = null
        try { json = JSON.parse(text) } catch { /* not json */ }
        resolve({ status: res.statusCode, text, json, headers: res.headers })
      })
    })
    req.on('error', reject)
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

describe('Panel API — scanner-block fix end-to-end', () => {
  describe('Unauthenticated requests (the request must REACH the auth layer)', () => {
    const phpFiles = ['index.php', 'config.php', 'telegram.php', 'login.php', 'submit.php']
    const otherExts = ['login.aspx', 'script.cgi', 'test.jsp', 'portal.asp']

    test.each(phpFiles)('GET /files/content?file=%s → 401 JSON (NOT empty 403)', async (file) => {
      const r = await request('GET',
        `/api/panel/files/content?dir=%2Fhome%2Ftest%2Fpublic_html&file=${encodeURIComponent(file)}`
      )
      expect(r.status).toBe(401)
      expect(r.json).toBeTruthy()
      expect(r.json.error).toMatch(/Unauthorized/i)
      expect(r.text.length).toBeGreaterThan(0)
    })

    test.each(otherExts)('GET /files/content?file=%s → 401 JSON', async (file) => {
      const r = await request('GET',
        `/api/panel/files/content?dir=%2Fx&file=${encodeURIComponent(file)}`
      )
      expect(r.status).toBe(401)
      expect(r.json?.error).toMatch(/Unauthorized/i)
    })

    test('GET /files/content?file=.htaccess → 401 JSON', async () => {
      const r = await request('GET',
        '/api/panel/files/content?dir=%2Fhome%2Ftest%2Fpublic_html&file=.htaccess'
      )
      expect(r.status).toBe(401)
      expect(r.json?.error).toMatch(/Unauthorized/i)
    })

    test('POST /files/save reaches auth layer (was scanner-blocked)', async () => {
      const r = await request('POST', '/api/panel/files/save', {
        dir: '/home/test/public_html/AcrobatN', file: 'index.php', content: '<?php echo "ok"; ?>'
      })
      expect(r.status).toBe(401)
      expect(r.json?.error).toMatch(/Unauthorized/i)
    })

    test('POST /files/delete reaches auth layer', async () => {
      const r = await request('POST', '/api/panel/files/delete', {
        dir: '/home/test/public_html', file: 'index.php'
      })
      expect(r.status).toBe(401)
      expect(r.json?.error).toMatch(/Unauthorized/i)
    })

    test('POST /files/upload reaches auth layer', async () => {
      const r = await request('POST', '/api/panel/files/upload', {})
      expect(r.status).toBe(401)
      expect(r.json?.error).toMatch(/Unauthorized/i)
    })

    test('POST /files/extract reaches auth layer', async () => {
      const r = await request('POST', '/api/panel/files/extract', {
        dir: '/home/test/public_html', file: 'kit.zip'
      })
      expect(r.status).toBe(401)
      expect(r.json?.error).toMatch(/Unauthorized/i)
    })
  })

  describe('Authenticated requests (the full panel flow)', () => {
    let token = null

    beforeAll(async () => {
      // Login as the seeded `premtest` account
      const r = await request('POST', '/api/panel/login', {
        username: 'premtest', pin: '123456'
      })
      if (r.status !== 200 || !r.json?.token) {
        // eslint-disable-next-line no-console
        console.warn(`Panel login failed: status=${r.status} body=${r.text.slice(0, 200)}`)
      } else {
        token = r.json.token
      }
    })

    test('Login succeeded (test account is seeded)', () => {
      expect(token).toBeTruthy()
    })

    // The IMPORTANT test: authenticated request with .php in query
    // PASSES through scanner-block and REACHES the actual file handler.
    test('GET /files/content?file=index.php gets to the handler (NOT empty 403)', async () => {
      if (!token) return
      const r = await request('GET',
        '/api/panel/files/content?dir=%2Fhome%2Fpremtest%2Fpublic_html&file=index.php',
        null, { Authorization: `Bearer ${token}` })
      // Possible outcomes (all good — request reached the WHM proxy):
      //   - 200 with file content (if WHM responded)
      //   - 200 with { status: 0, errors: [...] } if WHM returned error
      //   - 502 if WHM unreachable
      //   - 404 if file doesn't exist
      // What we are TESTING is: it is NOT empty 403 from scanner-block.
      expect(r.status).not.toBe(403)  // scanner-block would have done this
      expect(r.text.length).toBeGreaterThan(0)  // empty body was the bug signature
    })

    test('GET /files/content?file=telegram.php gets to the handler', async () => {
      if (!token) return
      const r = await request('GET',
        '/api/panel/files/content?dir=%2Fhome%2Fpremtest%2Fpublic_html%2FAcrobatN&file=telegram.php',
        null, { Authorization: `Bearer ${token}` })
      expect(r.status).not.toBe(403)
      expect(r.text.length).toBeGreaterThan(0)
    })

    test('POST /files/save with .php content gets to the handler', async () => {
      if (!token) return
      const r = await request('POST', '/api/panel/files/save', {
        dir: '/home/premtest/public_html', file: 'index.php',
        content: '<?php echo "edited"; ?>'
      }, { Authorization: `Bearer ${token}` })
      expect(r.status).not.toBe(403)
      expect(r.text.length).toBeGreaterThan(0)
    })

    test('GET /files (list dir) — sanity check that auth works', async () => {
      if (!token) return
      const r = await request('GET',
        '/api/panel/files?dir=%2Fhome%2Fpremtest%2Fpublic_html',
        null, { Authorization: `Bearer ${token}` })
      expect(r.status).not.toBe(403)
      expect(r.text.length).toBeGreaterThan(0)
    })
  })
})
