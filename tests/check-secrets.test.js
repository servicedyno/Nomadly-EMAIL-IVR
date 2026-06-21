/**
 * Sanity test for /app/scripts/check-secrets.sh — the pre-commit guard
 * we put in place after GitHub push-protection blocked our pushes 3× in
 * one session.
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'check-secrets.sh')
const TMP_DIR = '/tmp/secret-scanner-test'
const TMP_FILE = path.join(TMP_DIR, 'sample.txt')

function run(content) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
  fs.writeFileSync(TMP_FILE, content)
  try {
    // Run the script in --worktree mode against just our temp file
    // by piping the filename to git ls-files alternative: we use a small wrapper
    const wrapper = `cd ${TMP_DIR} && git init -q 2>/dev/null && git add . 2>/dev/null && bash ${SCRIPT} --staged`
    const out = execSync(wrapper, { stdio: 'pipe', encoding: 'utf-8' })
    return { code: 0, out }
  } catch (err) {
    return { code: err.status, out: (err.stdout || '') + (err.stderr || '') }
  }
}

describe('check-secrets.sh', () => {
  afterAll(() => {
    try { fs.rmSync(TMP_DIR, { recursive: true, force: true }) } catch { /* noop */ }
  })

  test('passes on clean content', () => {
    const res = run('Just regular code here.\nconst x = 5\n')
    expect(res.code).toBe(0)
    expect(res.out).toMatch(/clean/)
  })

  test('blocks a fake Twilio Account SID', () => {
    // Build a string that matches /AC[a-f0-9]{32}/ but is obviously fake
    const fake = 'AC' + '0'.repeat(32)
    const res = run(`secret = "${fake}"\n`)
    expect(res.code).not.toBe(0)
    expect(res.out).toMatch(/Possible secret/)
  })

  test('blocks a fake Stripe live key', () => {
    const fake = 'sk_live_' + 'a'.repeat(30)
    const res = run(`STRIPE = "${fake}"\n`)
    expect(res.code).not.toBe(0)
    expect(res.out).toMatch(/Possible secret/)
  })
})
