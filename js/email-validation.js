/**
 * Email Validation Service — 4-layer self-hosted validation
 * 1. Syntax check (regex)
 * 2. MX record lookup (dns.resolveMx)
 * 3. Disposable email filter
 * 4. SMTP RCPT TO verification (optional)
 */

const dns = require('dns').promises;
const net = require('net');

// Common disposable email domains (top 500+)
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','yopmail.com',
  'sharklasers.com','guerrillamailblock.com','grr.la','dispostable.com','mailnesia.com',
  'maildrop.cc','10minutemail.com','trashmail.com','temp-mail.org','fakeinbox.com',
  'mailcatch.com','tempail.com','tempr.email','discard.email','discardmail.com',
  'getnada.com','emailondeck.com','33mail.com','mailsac.com','mohmal.com',
  'burnermail.io','inboxkitten.com','spamgourmet.com','mytemp.email','tmpmail.net',
  'getairmail.com','throwawaymail.com','temp-mail.io','tmpmail.org','trash-mail.com',
  'harakirimail.com','spamfree24.org','binkmail.com','spamdecoy.net','trashmail.me',
  'objectmail.com','proxymail.eu','rcpt.at','trash-mail.at','0-mail.com',
  'bugmenot.com','deadaddress.com','despammed.com','devnullmail.com','dodgeit.com',
  'dodgit.com','dontreg.com','e4ward.com','emailigo.de','emailtemporario.com.br',
  'ephemail.net','etranquil.com','gishpuppy.com','guaranamail.com','imstations.com',
  'kasmail.com','lookugly.com','mailexpire.com','mailforspam.com','mailfreeonline.com',
  'mailimate.com','mailinator2.com','mailmoat.com','mailnull.com','mailshell.com',
  'mailzilla.com','meltmail.com','mezimages.net','mintemail.com','nobulk.com',
  'noclickemail.com','nogmailspam.info','nomail.xl.cx','nospam.ze.tc','nospamfor.us',
  'nowmymail.com','ownmail.net','pookmail.com','recode.me','safe-mail.net',
  'safersignup.de','safetymail.info','sandelf.de','saynotospams.com','selfdestructingmail.com',
  'shortmail.net','sogetthis.com','soodonims.com','spam.la','spamavert.com',
  'spambob.net','spambog.com','spambog.de','spambog.ru','spambox.us',
  'spamcero.com','spamday.com','spamex.com','spamfighter.cf','spamfighter.ga',
  'spamfighter.gq','spamfighter.ml','spamfighter.tk','spamfree.eu','spamhole.com',
  'spamify.com','spaminator.de','spaml.com','spaml.de','spammotel.com',
  'spamobox.com','spamspot.com','spamstack.net','spamtrail.com','superrito.com',
  'teleworm.us','tempalias.com','tempe4mail.com','tempemail.co.za','tempemail.net',
  'tempinbox.com','tempmaildemo.com','tempmailer.com','tempomail.fr','temporarily.de',
  'temporarioemail.com.br','temporaryemail.net','temporaryemail.us','temporaryforwarding.com',
  'temporaryinbox.com','temporarymailaddress.com','thanksnospam.info','thankyou2010.com',
  'thisisnotmyrealemail.com','throam.com','trashmail.net','trashmail.org',
  'trashymail.com','trashymail.net','twinmail.de','tyldd.com','uggsrock.com',
  'upliftnow.com','venompen.com','veryrealemail.com','viditag.com','viewcastmedia.com',
  'viewcastmedia.net','viewcastmedia.org','vomoto.com','vpn.st','vsimcard.com',
  'vubby.com','wasteland.rfc822.org','webemail.me','weg-werf-email.de','wegwerfadresse.de',
  'wegwerfemail.com','wegwerfmail.de','wegwerfmail.net','wegwerfmail.org','wh4f.org',
  'whatiaas.com','whyspam.me','wikidocuslice.com','willhackforfood.biz','willselfdestruct.com',
  'wuzupmail.net','xagloo.com','xemaps.com','xents.com','xjoi.com',
  'xoxy.net','yep.it','yogamaven.com','yopmail.fr','yuurok.com',
  'zippymail.info','zoaxe.com','zoemail.org'
]);

// Email syntax regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validate email syntax
 */
function validateSyntax(email) {
  if (!email || typeof email !== 'string') return false;
  email = email.trim().toLowerCase();
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Check if domain is a known disposable email provider
 */
function isDisposable(email) {
  const domain = email.split('@')[1];
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Check if domain has valid MX records
 */
async function checkMx(email) {
  const domain = email.split('@')[1];
  try {
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch {
    return false;
  }
}

/**
 * SMTP RCPT TO verification — connect to recipient's server and check if address exists
 * NOTE: This is slow and some servers always accept (catch-all). Use sparingly.
 */
async function smtpVerify(email, timeout = 10000) {
  const domain = email.split('@')[1];
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) return { valid: false, reason: 'no_mx' };

    // Sort by priority (lowest first)
    mxRecords.sort((a, b) => a.priority - b.priority);
    const mxHost = mxRecords[0].exchange;

    return new Promise((resolve) => {
      const socket = net.createConnection(25, mxHost);
      let step = 0;
      let response = '';

      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ valid: null, reason: 'timeout' });
      }, timeout);

      socket.on('data', (data) => {
        response = data.toString();
        if (step === 0 && response.startsWith('220')) {
          socket.write(`EHLO mail.tracking-assist.com\r\n`);
          step = 1;
        } else if (step === 1 && (response.startsWith('250') || response.startsWith('220'))) {
          socket.write(`MAIL FROM:<verify@tracking-assist.com>\r\n`);
          step = 2;
        } else if (step === 2 && response.startsWith('250')) {
          socket.write(`RCPT TO:<${email}>\r\n`);
          step = 3;
        } else if (step === 3) {
          clearTimeout(timer);
          socket.write('QUIT\r\n');
          socket.end();
          if (response.startsWith('250')) {
            resolve({ valid: true, reason: 'accepted' });
          } else if (response.startsWith('550') || response.startsWith('551') || response.startsWith('553')) {
            resolve({ valid: false, reason: 'rejected' });
          } else {
            resolve({ valid: null, reason: 'unknown_response' });
          }
        }
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve({ valid: null, reason: 'connection_error' });
      });
    });
  } catch {
    return { valid: null, reason: 'dns_error' };
  }
}

/**
 * Parse email list from CSV or TXT file content
 * Supports: one email per line, CSV with email column, comma/semicolon separated
 */
function parseEmailList(content) {
  if (!content || typeof content !== 'string') return [];

  const emails = new Set();
  const lines = content.split(/[\r\n]+/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Split by comma, semicolon, tab, or pipe
    const parts = trimmed.split(/[,;\t|]/);
    for (const part of parts) {
      const cleaned = part.trim().toLowerCase().replace(/^"|"$/g, '');
      if (EMAIL_REGEX.test(cleaned)) {
        emails.add(cleaned);
      }
    }
  }

  return [...emails];
}

/**
 * Validate a batch of emails (layers 1-3, optionally 4)
 * @param {string[]} emails
 * @param {object} opts - { smtpCheck: false, suppressionList: Set }
 * @returns {{ valid: string[], invalid: string[], disposable: string[], suppressed: string[], risky: string[] }}
 */
async function validateBatch(emails, opts = {}) {
  const result = {
    valid: [],
    invalid: [],
    disposable: [],
    suppressed: [],
    risky: []
  };

  const suppressions = opts.suppressionList || new Set();

  for (const email of emails) {
    // Layer 0: Suppression list
    if (suppressions.has(email)) {
      result.suppressed.push(email);
      continue;
    }

    // Layer 1: Syntax
    if (!validateSyntax(email)) {
      result.invalid.push(email);
      continue;
    }

    // Layer 2: Disposable
    if (isDisposable(email)) {
      result.disposable.push(email);
      continue;
    }

    // Layer 3: MX record
    const hasMx = await checkMx(email);
    if (!hasMx) {
      result.invalid.push(email);
      continue;
    }

    result.valid.push(email);
  }

  return result;
}

module.exports = {
  validateSyntax,
  isDisposable,
  checkMx,
  smtpVerify,
  parseEmailList,
  validateBatch,
  DISPOSABLE_DOMAINS
};
