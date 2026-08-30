/* global describe, test, expect, beforeAll, afterEach */
/**
 * Unit tests for the "broken user-level cPanel auth" recovery in
 * js/cpanel-proxy.js (the WHM-root impersonation fallback + login-page-HTML
 * detection). All cPanel/WHM HTTP is mocked with nock — NOTHING touches the
 * live production WHM box or any real customer account.
 *
 * Verifies (mirrors the task "must pass" list at the proxy layer):
 *   1. HTTP 200 whose body is the cPanel login page → normalized to
 *      CPANEL_AUTH_FAILURE (uapi + api2), NOT treated as valid data.
 *   2. Subdomain / addon create+delete recover via WHM-root when auth is
 *      broken (login-page HTML OR 401/403) — result.via === 'whm-fallback'.
 *   3. A HEALTHY account never touches the WHM fallback (via unset, WHM
 *      endpoint not called).
 *   4. A genuine non-auth error ("already exists") is surfaced, NOT swallowed
 *      and NOT retried via WHM.
 *   5. createSubdomain uses the corrected docroot default (public_html/<sub>,
 *      not public_html/<sub>.<root>).
 */

// Env MUST be set before requiring the proxy — it captures WHM_HOST /
// CPANEL_API_URL into module-level consts at load time.
process.env.WHM_HOST = '10.0.0.9'
process.env.WHM_API_URL = 'https://whm-api.test'
process.env.CPANEL_API_URL = 'https://cpanel-api.test'
process.env.WHM_TOKEN = 'testtoken'
process.env.WHM_USERNAME = 'root'
delete process.env.CF_ACCESS_CLIENT_ID
delete process.env.CF_ACCESS_CLIENT_SECRET

const nock = require('nock')
const cpProxy = require('../js/cpanel-proxy')

const CPANEL = 'https://cpanel-api.test'
const WHM = 'https://whm-api.test'
const LOGIN_HTML = '<!DOCTYPE html><html><head><title>cPanel Login</title></head><body>Please log in</body></html>'

beforeAll(() => { nock.disableNetConnect() })
afterEach(() => { nock.cleanAll() })

describe('login-page-HTML (HTTP 200) detection', () => {
  test('uapi get_file_content returns CPANEL_AUTH_FAILURE instead of raw HTML', async () => {
    nock(CPANEL).get('/execute/Fileman/get_file_content').query(true).reply(200, LOGIN_HTML)
    const r = await cpProxy.getFileContent('u1', 'pw', '/home/u1/public_html', 'index.php')
    expect(r.status).toBe(0)
    expect(r.code).toBe('CPANEL_AUTH_FAILURE')
    expect(String(r.data || '')).not.toMatch(/<!DOCTYPE html>/i)
  })

  test('api2 (createDirectory) returns CPANEL_AUTH_FAILURE on login-page HTML', async () => {
    nock(CPANEL).get('/json-api/cpanel').query(true).reply(200, LOGIN_HTML)
    const r = await cpProxy.createDirectory('u1', 'pw', 'public_html', 'newfolder')
    expect(r.status).toBe(0)
    expect(r.code).toBe('CPANEL_AUTH_FAILURE')
  })
})

describe('createSubdomain — WHM-root fallback + docroot fix', () => {
  test('login-page HTML → recovers via WHM root, sends corrected docroot', async () => {
    let cpanelQuery = null
    let whmQuery = null
    nock(CPANEL).get('/json-api/cpanel').query(q => { cpanelQuery = q; return true }).reply(200, LOGIN_HTML)
    nock(WHM).get('/json-api/cpanel').query(q => { whmQuery = q; return true })
      .reply(200, { cpanelresult: { data: [{ result: 1 }] } })

    const r = await cpProxy.createSubdomain('user1', 'pw', 'api', 'example.com', null)
    expect(r.status).toBe(1)
    expect(r.via).toBe('whm-fallback')
    // docroot fix: public_html/api  (NOT public_html/api.example.com)
    expect(cpanelQuery.dir).toBe('public_html/api')
    // WHM impersonation shape
    expect(whmQuery.cpanel_jsonapi_user).toBe('user1')
    expect(whmQuery.cpanel_jsonapi_func).toBe('addsubdomain')
    expect(whmQuery.dir).toBe('public_html/api')
  })

  test('HEALTHY account → success WITHOUT touching WHM fallback', async () => {
    nock(CPANEL).get('/json-api/cpanel').query(true).reply(200, { cpanelresult: { data: [{ result: 1 }] } })
    const whmScope = nock(WHM).get('/json-api/cpanel').query(true).reply(200, { cpanelresult: { data: [{ result: 1 }] } })
    const r = await cpProxy.createSubdomain('user1', 'pw', 'blog', 'example.com', null)
    expect(r.status).toBe(1)
    expect(r.via).toBeUndefined()
    expect(whmScope.isDone()).toBe(false) // WHM was NOT called
  })

  test('non-auth error ("already exists") is surfaced, NOT retried via WHM', async () => {
    nock(CPANEL).get('/json-api/cpanel').query(true)
      .reply(200, { cpanelresult: { data: [{ result: 0, reason: 'subdomain already exists' }] } })
    const whmScope = nock(WHM).get('/json-api/cpanel').query(true).reply(200, { cpanelresult: { data: [{ result: 1 }] } })
    const r = await cpProxy.createSubdomain('user1', 'pw', 'blog', 'example.com', null)
    expect(r.status).toBe(0)
    expect(r.errors[0]).toMatch(/already exists/i)
    expect(r.via).toBeUndefined()
    expect(whmScope.isDone()).toBe(false)
  })
})

describe('deleteSubdomain / addon domain — WHM-root fallback', () => {
  test('deleteSubdomain recovers via WHM root on login-page HTML', async () => {
    nock(CPANEL).get('/json-api/cpanel').query(true).reply(200, LOGIN_HTML)
    nock(WHM).get('/json-api/cpanel').query(true).reply(200, { cpanelresult: { data: [{ result: 1 }] } })
    const r = await cpProxy.deleteSubdomain('user1', 'pw', 'api.example.com')
    expect(r.status).toBe(1)
    expect(r.via).toBe('whm-fallback')
  })

  test('addAddonDomain recovers via WHM root on HTTP 403', async () => {
    nock(CPANEL).get('/json-api/cpanel').query(true).reply(403, { cpanelresult: { error: 'Access denied' } })
    nock(WHM).get('/json-api/cpanel').query(true).reply(200, { cpanelresult: { data: [{ result: 1 }] } })
    const r = await cpProxy.addAddonDomain('user1', 'pw', 'newdom.com', null, null)
    expect(r.status).toBe(1)
    expect(r.via).toBe('whm-fallback')
  })

  test('removeAddonDomain recovers via WHM root on login-page HTML', async () => {
    nock(CPANEL).get('/json-api/cpanel').query(true).reply(200, LOGIN_HTML)
    nock(WHM).get('/json-api/cpanel').query(true).reply(200, { cpanelresult: { data: [{ result: 1 }] } })
    const r = await cpProxy.removeAddonDomain('user1', 'pw', 'newdom.com', null, 'example.com')
    expect(r.status).toBe(1)
    expect(r.via).toBe('whm-fallback')
  })

  test('WHM fallback failure surfaces a real reason (not a false success)', async () => {
    nock(CPANEL).get('/json-api/cpanel').query(true).reply(200, LOGIN_HTML)
    nock(WHM).get('/json-api/cpanel').query(true)
      .reply(200, { cpanelresult: { data: [{ result: 0, reason: 'domain not found' }] } })
    const r = await cpProxy.deleteSubdomain('user1', 'pw', 'ghost.example.com')
    expect(r.status).toBe(0)
    expect(r.via).toBe('whm-fallback-failed')
    expect(r.errors[0]).toMatch(/not found/i)
  })
})
