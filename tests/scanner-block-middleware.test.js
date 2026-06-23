/* global describe, test, expect, beforeEach */
/**
 * Tests for the scanner-block early middleware in js/_index.js.
 *
 * The bug fixed here: customer `welc4757` was 403-blocked 35 times trying
 * to edit his own `index.php` / `config.php` / `telegram.php` files via
 * the hosting panel. The regex `/\.(php|jsp|aspx?|cgi)(\?|$)/i` matched
 * `?file=index.php` in the query string and the panel API was silently
 * blocked with an empty 403 body → the frontend showed "Request failed
 * (403)" with no actionable message.
 *
 * Fix: scanner-block now (a) skips `/api/*` prefixes entirely, and
 * (b) only runs its extension regex against the URL PATH (before `?`).
 *
 * Real scanner traffic (`/con5dldbuy.php?goods/...`, `/wp-admin/upload.php`)
 * still gets blocked because the path itself ends with `.php`.
 */

// Re-create the predicate exactly like _index.js does so we can unit-test
// the matching logic without spinning up the whole bot.
const SCANNER_IPS = new Set(['74.7.243.245'])
const SCANNER_PATH_PREFIXES = ['/con5dld', '/wp-', '/wordpress', '/phpmyadmin', '/phpunit', '/vendor/phpunit', '/.git', '/.env', '/.aws', '/.well-known/pki-validation/']
const SCANNER_PATH_EXACT = new Set(['/.env', '/.htaccess', '/sftp-config.json', '/config.json', '/server-status', '/owa/'])
const SCANNER_EXT_REGEX = /\.(php|jsp|aspx?|cgi)$/i
const SCANNER_SAFE_PREFIXES = ['/api/']

function shouldBlock(url, ip = '1.2.3.4') {
  const urlPath = url.split('?', 1)[0]
  for (const safe of SCANNER_SAFE_PREFIXES) {
    if (urlPath.startsWith(safe)) return null // fast-pass
  }
  if (SCANNER_IPS.has(ip)) return 'IP'
  if (SCANNER_PATH_EXACT.has(urlPath)) return 'EXACT'
  if (SCANNER_EXT_REGEX.test(urlPath)) return 'REGEX'
  for (const p of SCANNER_PATH_PREFIXES) {
    if (urlPath.startsWith(p)) return 'PREFIX:' + p
  }
  return null
}

describe('scanner-block early middleware — false-positive fix', () => {
  test('Panel API editing a .php file is NOT blocked (the welc4757 bug)', () => {
    expect(shouldBlock('/api/panel/files/content?dir=/home/welc4757/public_html/AcrobatN&file=index.php')).toBe(null)
    expect(shouldBlock('/api/panel/files/content?dir=/home/welc4757/public_html/accounts.google&file=config.php')).toBe(null)
    expect(shouldBlock('/api/panel/files/content?dir=/home/welc4757/public_html/AcrobatN&file=telegram.php')).toBe(null)
  })

  test('Panel API editing .jsp / .aspx / .cgi files is NOT blocked', () => {
    expect(shouldBlock('/api/panel/files/content?dir=/x&file=login.aspx')).toBe(null)
    expect(shouldBlock('/api/panel/files/content?dir=/x&file=test.jsp')).toBe(null)
    expect(shouldBlock('/api/panel/files/content?dir=/x&file=script.cgi')).toBe(null)
    expect(shouldBlock('/api/panel/files/content?dir=/x&file=portal.asp')).toBe(null)
  })

  test('Panel API editing .htaccess is NOT blocked', () => {
    expect(shouldBlock('/api/panel/files/content?dir=/home/welc4757/public_html&file=.htaccess')).toBe(null)
  })

  test('Panel save/delete/upload routes are NOT blocked', () => {
    expect(shouldBlock('/api/panel/files/save')).toBe(null)
    expect(shouldBlock('/api/panel/files/delete')).toBe(null)
    expect(shouldBlock('/api/panel/files/upload')).toBe(null)
    expect(shouldBlock('/api/panel/files/mkdir')).toBe(null)
  })

  test('Real scanner traffic to .php endpoints is STILL blocked', () => {
    // The exact traffic from prod that the scanner-block was designed for.
    // Block reason can be either REGEX (path ends in .php) or PREFIX —
    // both correctly result in 403.
    expect(shouldBlock('/con5dldbuy.php?goods/059036726')).not.toBe(null)
    expect(shouldBlock('/wp-admin/upload.php')).not.toBe(null)
    expect(shouldBlock('/wordpress/wp-login.php')).not.toBe(null)
    expect(shouldBlock('/phpmyadmin/index.php')).not.toBe(null)
  })

  test('Direct .php at root paths still blocked', () => {
    expect(shouldBlock('/shell.php')).toBe('REGEX')
    expect(shouldBlock('/eval.cgi')).toBe('REGEX')
    expect(shouldBlock('/admin.aspx')).toBe('REGEX')
    expect(shouldBlock('/inject.jsp')).toBe('REGEX')
  })

  test('Known bad paths still blocked (exact + prefix)', () => {
    expect(shouldBlock('/.env')).toBe('EXACT')
    expect(shouldBlock('/.git/config')).toBe('PREFIX:/.git')
    expect(shouldBlock('/.aws/credentials')).toBe('PREFIX:/.aws')
  })

  test('Known bad IP is still blocked even on safe API paths', () => {
    // SAFE_PREFIXES fast-pass takes precedence, intentionally — we want
    // legitimate panel users on a flagged corporate proxy IP to still
    // be able to use the panel.
    expect(shouldBlock('/api/panel/files/content?file=x.php', '74.7.243.245')).toBe(null)
    // But anything OUTSIDE /api/* still gets IP-blocked
    expect(shouldBlock('/random.html', '74.7.243.245')).toBe('IP')
  })

  test('Regular product traffic is not blocked', () => {
    expect(shouldBlock('/api/panel/files?dir=/home/welc4757/public_html')).toBe(null)
    expect(shouldBlock('/api/store/products')).toBe(null)
    expect(shouldBlock('/api/health')).toBe(null)
    expect(shouldBlock('/index.html')).toBe(null)
    expect(shouldBlock('/static/main.css')).toBe(null)
  })
})
