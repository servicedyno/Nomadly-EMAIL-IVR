/**
 * E2E reproduction of the @user_uu0 (chatId 6277663071) incident, in a local
 * sandbox sshd — no customer server is touched.
 *
 * We rebuild the EXACT conditions found on droplet 591819943:
 *   • Ubuntu-style /etc/ssh/sshd_config.d/60-cloudimg-settings.conf shipping
 *     `PasswordAuthentication no` (this is what DigitalOcean's image ships)
 *   • an RSA PKCS#8 key in root's authorized_keys (what the bot generates and
 *     injects at create time, and what DO re-injects on every rebuild)
 *   • a root password that is set, yet still rejected at the login prompt
 *
 * Then we run the REAL production code path — applyPasswordOverSSH(), the same
 * function digitalocean-service.resetPassword() now calls — and assert that the
 * password the bot would show the customer actually works afterwards.
 *
 * root's original shadow hash is saved and restored, so the pod is left clean.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const crypto = require('crypto')
const { applyPasswordOverSSH, verifyPasswordLogin } = require('/app/js/vps-ssh-password.js')

const USER = 'root'                 // production shape: reset runs as root
const PORT = 2222
const HOST = '127.0.0.1'
const OLD_PASSWORD = 'OldPass_ThatWorks_1'
const DROPIN = '/etc/ssh/sshd_config.d/60-cloudimg-settings.conf'

const sh = c => execSync(c, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
const quiet = c => { try { return sh(c) } catch (_) { return '' } }

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '  OK  ' : ' FAIL '} ${name}${detail ? ` -> ${detail}` : ''}`)
}

let savedRootHash = null

async function main() {
  // ── Arrange: make this container look like a fresh DO droplet ──────────
  savedRootHash = quiet("getent shadow root | cut -d: -f2")
  sh(`echo 'root:${OLD_PASSWORD}' | chpasswd`)

  const kp = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, // exactly what generateNewSSHkey() emits
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  fs.writeFileSync('/tmp/e2e_key.pem', kp.privateKey)
  fs.chmodSync('/tmp/e2e_key.pem', 0o600)
  sh('ssh-keygen -y -f /tmp/e2e_key.pem > /tmp/e2e_key.pub')
  sh('mkdir -p /root/.ssh && cp /root/.ssh/authorized_keys /tmp/e2e_ak_backup 2>/dev/null || true')
  sh('cat /tmp/e2e_key.pub > /root/.ssh/authorized_keys && chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys')

  fs.mkdirSync('/etc/ssh/sshd_config.d', { recursive: true })
  fs.writeFileSync(DROPIN, 'PasswordAuthentication no\nPermitRootLogin prohibit-password\n')
  const cfg = fs.readFileSync('/etc/ssh/sshd_config', 'utf8')
  fs.writeFileSync('/tmp/e2e_sshd_config_backup', cfg)
  if (!cfg.includes('sshd_config.d')) {
    fs.writeFileSync('/etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\n' + cfg)
  }

  quiet('pkill -x sshd')
  await new Promise(r => setTimeout(r, 800))
  sh(`mkdir -p /run/sshd && /usr/sbin/sshd -p ${PORT}`)
  await new Promise(r => setTimeout(r, 1500))
  console.log(`sandbox sshd listening on ${HOST}:${PORT}, login user = ${USER}\n`)

  const effBefore = quiet(`sshd -T -C user=${USER} 2>/dev/null | grep -i '^passwordauthentication'`)
  check('REPRO: sandbox ships password auth disabled, like a DO droplet',
    effBefore.includes('no'), effBefore || 'n/a')

  // ── REPRO: the customer's exact symptom ───────────────────────────────
  const oldWorks = await verifyPasswordLogin({ host: HOST, port: PORT, username: USER, password: OLD_PASSWORD })
  check('REPRO: a CORRECT password is still rejected ("Permission denied")',
    oldWorks === false, `valid password => ${oldWorks ? 'accepted' : 'denied'}`)

  const keyWorks = await (async () => {
    try {
      const { execOverSSH } = require('/app/js/vps-ssh-password.js')
      const r = await execOverSSH({ host: HOST, port: PORT, username: USER, privateKey: kp.privateKey, script: 'echo KEYOK' })
      return r.stdout.includes('KEYOK')
    } catch (_) { return false }
  })()
  check('REPRO: the injected SSH key still works (our way back in)', keyWorks === true, `key login => ${keyWorks}`)

  // ── Act: run the REAL production reset path ───────────────────────────
  const newPassword = 'BrandNewPass' + Date.now().toString(36)
  const res = await applyPasswordOverSSH({
    host: HOST,
    port: PORT,
    username: USER,
    newPassword,
    privateKeys: [{ privateKey: kp.privateKey, sshKeyName: 'e2e-key' }], // PKCS#8, like the bot's
    currentPassword: null,
    verify: true,
  })

  check('FIX: reset authenticated with the stored PKCS#8 SSH key',
    res.ok && String(res.method).startsWith('ssh-key'),
    `method=${res.method} err=${res.error || ''}`)
  check('FIX: new password VERIFIED by logging back in',
    res.verified === true, `verified=${res.verified}`)

  const effAfter = quiet(`sshd -T -C user=${USER} 2>/dev/null | grep -i '^passwordauthentication'`)
  check('FIX: the drop-in that blocked password auth was corrected',
    effAfter.includes('yes'), effAfter || 'n/a')

  const newWorks = await verifyPasswordLogin({ host: HOST, port: PORT, username: USER, password: newPassword })
  check('FIX: the password the bot SHOWS the customer actually works',
    newWorks === true, `new password => ${newWorks ? 'accepted' : 'denied'}`)

  const oldStillWorks = await verifyPasswordLogin({ host: HOST, port: PORT, username: USER, password: OLD_PASSWORD })
  check('FIX: the previous password stopped working (it really changed)',
    oldStillWorks === false, `old password => ${oldStillWorks ? 'still accepted' : 'rejected'}`)
}

function cleanup() {
  quiet('pkill -x sshd')
  if (savedRootHash) quiet(`usermod -p '${savedRootHash}' root`)
  quiet(`rm -f ${DROPIN} /tmp/e2e_key.pem /tmp/e2e_key.pub`)
  quiet('cp /tmp/e2e_sshd_config_backup /etc/ssh/sshd_config 2>/dev/null')
  quiet('cp /tmp/e2e_ak_backup /root/.ssh/authorized_keys 2>/dev/null || rm -f /root/.ssh/authorized_keys')
  quiet('rm -f /tmp/e2e_sshd_config_backup /tmp/e2e_ak_backup')
}

main()
  .then(() => {
    cleanup()
    const failed = results.filter(r => !r.pass)
    console.log(`\n${failed.length === 0 ? 'ALL E2E CHECKS PASSED' : `${failed.length} E2E CHECK(S) FAILED`} (${results.length - failed.length}/${results.length})`)
    process.exit(failed.length === 0 ? 0 : 1)
  })
  .catch(e => { cleanup(); console.error('E2E ERROR:', e); process.exit(1) })
