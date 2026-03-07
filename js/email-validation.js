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
// Load disposable domains from external file (708+ domains)
const path = require('path');
let _disposableList;
try {
  _disposableList = require(path.join(__dirname, 'disposable-domains.json'));
} catch (e) {
  console.log('[EmailValidation] Warning: Could not load disposable-domains.json, using fallback');
  _disposableList = [];
}
const DISPOSABLE_DOMAINS = new Set(_disposableList);

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
