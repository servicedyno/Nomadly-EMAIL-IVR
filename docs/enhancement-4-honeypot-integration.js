// ═══ Honeypot Integration - Implementation Guide ═══

/**
 * CONCEPT: Deploy invisible traps that only bots interact with
 * 
 * Honeypots work because:
 * 1. Bots follow ALL links (even hidden ones)
 * 2. Bots fill ALL forms (even invisible ones)
 * 3. Bots trigger ALL events (even fake ones)
 * 4. Humans never interact with invisible elements
 * 
 * When triggered → 100% confidence it's a bot → instant ban
 */

// ─── Type 1: Invisible Link Honeypots ───
// Hidden links that bots click but humans never see

function injectLinkHoneypots(html) {
  const honeypots = `
    <!-- Honeypot links (invisible to humans) -->
    <a href="/__honeypot/admin-login" style="display:none">Admin Login</a>
    <a href="/__honeypot/wp-admin" style="opacity:0;position:absolute;left:-9999px">WordPress Admin</a>
    <a href="/__honeypot/private/api-keys.txt" style="visibility:hidden">API Keys</a>
    <a href="/__honeypot/robots.txt.bak" style="width:0;height:0;overflow:hidden">Backup</a>
    
    <!-- Extra tempting for scrapers -->
    <div style="display:none">
      <h2>Exclusive Content</h2>
      <a href="/__honeypot/exclusive-download">Download Premium Content</a>
    </div>
    
    <!-- robots.txt honeypot -->
    <!--
    User-agent: *
    Disallow: /__honeypot/secret-data/
    -->
  `;
  
  // Inject before </body>
  return html.replace('</body>', honeypots + '</body>');
}

// Worker handler for honeypot routes
async function handleHoneypotTrigger(request, path) {
  const ip = request.headers.get('CF-Connecting-IP');
  const ua = request.headers.get('User-Agent');
  const country = request.headers.get('CF-IPCountry');
  
  console.log(`🍯 HONEYPOT TRIGGERED: ${path} | IP: ${ip} | UA: ${ua} | Country: ${country}`);
  
  // 1. Ban the IP immediately
  await banIP(ip, 'honeypot_trigger', path);
  
  // 2. Log to analytics/SIEM
  await logSecurityEvent({
    type: 'honeypot_trigger',
    ip, ua, country, path,
    timestamp: Date.now()
  });
  
  // 3. Return fake content (keep bot engaged, waste its time)
  return fakeContentResponse(path);
}

async function banIP(ip, reason, details) {
  // Store in KV with 24h TTL
  await BANNED_IPS_KV.put(ip, JSON.stringify({
    reason,
    details,
    bannedAt: Date.now(),
    expiresAt: Date.now() + 86400000
  }), { expirationTtl: 86400 });
  
  // Also add to Cloudflare firewall (permanent ban)
  await addToCloudflareBlockList(ip);
}

function fakeContentResponse(path) {
  // Return realistic-looking fake data to waste bot's time
  if (path.includes('admin')) {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Admin Login</title></head>
      <body>
        <h1>Admin Login</h1>
        <form>
          <input type="text" name="username" placeholder="Username">
          <input type="password" name="password" placeholder="Password">
          <button>Login</button>
        </form>
        <!-- Form does nothing, just wastes bot's time -->
      </body>
      </html>
    `, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }
  
  if (path.includes('api-keys')) {
    return new Response(`
      # API Keys (Fake)
      API_KEY=fake_key_12345678abcdefgh
      SECRET=fake_secret_xxxxxxxxxxxxxxxx
      TOKEN=fake_token_yyyyyyyyyyyyyyyy
    `, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  
  return new Response('404 Not Found', { status: 404 });
}

// ─── Type 2: Invisible Form Field Honeypots ───
// Hidden form fields that bots fill but humans don't

function addFormHoneypots() {
  return `
    <!-- Real form -->
    <form id="contact-form" action="/submit" method="POST">
      <input type="text" name="name" placeholder="Your Name" required>
      <input type="email" name="email" placeholder="Your Email" required>
      <textarea name="message" placeholder="Message" required></textarea>
      
      <!-- HONEYPOT: Hidden field that bots will fill -->
      <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off">
      <input type="text" name="phone_number" style="position:absolute;left:-9999px" tabindex="-1">
      
      <!-- Time-based honeypot: Bots submit too fast -->
      <input type="hidden" name="form_loaded_at" value="${Date.now()}">
      
      <button type="submit">Send</button>
    </form>
    
    <script>
    document.getElementById('contact-form').addEventListener('submit', function(e) {
      // Check if honeypot fields were filled
      const website = document.querySelector('input[name="website"]').value;
      const phone = document.querySelector('input[name="phone_number"]').value;
      
      if (website || phone) {
        e.preventDefault();
        console.log('Bot detected: honeypot field filled');
        // Report to server
        fetch('/__honeypot/form-trap', { method: 'POST' });
        return false;
      }
      
      // Check submission speed (bots submit instantly)
      const loadedAt = parseInt(document.querySelector('input[name="form_loaded_at"]').value);
      const timeTaken = Date.now() - loadedAt;
      
      if (timeTaken < 3000) { // Less than 3 seconds = suspicious
        e.preventDefault();
        console.log('Bot detected: too fast submission');
        return false;
      }
    });
    </script>
  `;
}

// Server-side form validation
function validateFormSubmission(formData) {
  const flags = [];
  
  // Check honeypot fields
  if (formData.website || formData.phone_number) {
    flags.push('honeypot_filled');
  }
  
  // Check submission speed
  const loadedAt = parseInt(formData.form_loaded_at);
  const timeTaken = Date.now() - loadedAt;
  if (timeTaken < 3000) {
    flags.push('too_fast');
  }
  
  // Check for bot-like patterns
  if (formData.message?.length > 1000) {
    flags.push('message_too_long');
  }
  
  if (/<script|<iframe|<embed/i.test(formData.message)) {
    flags.push('xss_attempt');
  }
  
  return { isBot: flags.length > 0, flags };
}

// ─── Type 3: Mouse Tracking Honeypots ───
// Detect bots that never move the mouse

class MouseTrackingHoneypot {
  constructor() {
    this.moveCount = 0;
    this.clickCount = 0;
    this.scrollCount = 0;
    this.startTime = Date.now();
  }
  
  init() {
    document.addEventListener('mousemove', () => this.moveCount++);
    document.addEventListener('click', () => this.clickCount++);
    document.addEventListener('scroll', () => this.scrollCount++);
    
    // Check after 10 seconds
    setTimeout(() => this.checkForBot(), 10000);
  }
  
  checkForBot() {
    const timeOnPage = Date.now() - this.startTime;
    
    // Red flags:
    // 1. No mouse movement in 10 seconds
    if (this.moveCount === 0 && timeOnPage > 10000) {
      this.reportBot('no_mouse_movement');
    }
    
    // 2. Scrolled but no mouse movement (headless browser)
    if (this.scrollCount > 5 && this.moveCount === 0) {
      this.reportBot('scroll_without_mouse');
    }
    
    // 3. Perfect click without mouse movement (automated click)
    if (this.clickCount > 0 && this.moveCount < 10) {
      this.reportBot('click_without_mouse');
    }
  }
  
  reportBot(reason) {
    fetch('/__honeypot/mouse-trap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, moveCount: this.moveCount })
    });
  }
}

// ─── Type 4: Cookie Honeypots ───
// Set a "do not touch" cookie that bots will modify

function setCookieHoneypot() {
  return `
    <script>
    // Set a honeypot cookie
    document.cookie = '_bot_trap=initial_value; path=/';
    
    // Check if it was modified (bots often clear/modify all cookies)
    setTimeout(() => {
      const cookies = document.cookie.split(';').map(c => c.trim());
      const honeypot = cookies.find(c => c.startsWith('_bot_trap='));
      
      if (!honeypot) {
        // Cookie was deleted = bot
        fetch('/__honeypot/cookie-trap', { method: 'POST' });
      } else if (!honeypot.includes('initial_value')) {
        // Cookie was modified = bot
        fetch('/__honeypot/cookie-trap', { method: 'POST' });
      }
    }, 2000);
    </script>
  `;
}

// ─── Type 5: JavaScript Honeypots ───
// Fake APIs/functions that bots call but real sites never use

function injectJSHoneypots() {
  return `
    <script>
    // Create fake APIs that bots might look for
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      checkDCE: () => { reportBot('devtools_hook'); }
    };
    
    // Fake Selenium detection bypass (bots try to hide selenium)
    Object.defineProperty(navigator, 'webdriver', {
      get: () => {
        reportBot('webdriver_access');
        return false;
      }
    });
    
    // Fake bot detection bypass function (bots call this)
    window.bypassBotDetection = () => {
      reportBot('bypass_attempt');
    };
    
    // Fake admin API (bots try to exploit)
    window.adminAPI = {
      login: (user, pass) => {
        reportBot('admin_api_call');
        return { error: 'Unauthorized' };
      }
    };
    
    function reportBot(trigger) {
      fetch('/__honeypot/js-trap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger })
      });
    }
    </script>
  `;
}

// ─── Type 6: robots.txt Honeypots ───
// Disallow paths that don't exist (bots often ignore robots.txt)

function generateRobotsTxtWithHoneypots() {
  return `
    User-agent: *
    Allow: /
    
    # Honeypot directories (don't exist, but bots will try to access)
    Disallow: /__honeypot/admin/
    Disallow: /__honeypot/backup/
    Disallow: /__honeypot/private/
    Disallow: /__honeypot/config/
    
    # If a bot accesses these, instant ban
    Crawl-delay: 10
  `;
}

// ─── Integration with Main Worker ───

addEventListener('fetch', event => {
  event.respondWith(handleWithHoneypots(event.request));
});

async function handleWithHoneypots(request) {
  const url = new URL(request.url);
  const ip = request.headers.get('CF-Connecting-IP');
  
  // 1. Check if IP is already banned
  const banned = await BANNED_IPS_KV.get(ip);
  if (banned) {
    console.log(`Blocked banned IP: ${ip}`);
    return new Response('Forbidden', { status: 403 });
  }
  
  // 2. Check if honeypot was triggered
  if (url.pathname.startsWith('/__honeypot/')) {
    return handleHoneypotTrigger(request, url.pathname);
  }
  
  // 3. Inject honeypots into HTML responses
  const response = await fetch(request);
  
  if (response.headers.get('Content-Type')?.includes('text/html')) {
    let html = await response.text();
    
    // Inject all types of honeypots
    html = injectLinkHoneypots(html);
    html = html.replace('</head>', setCookieHoneypot() + '</head>');
    html = html.replace('</body>', injectJSHoneypots() + '</body>');
    html = html.replace('</body>', `<script>new (${MouseTrackingHoneypot.toString()})().init();</script></body>`);
    
    return new Response(html, {
      status: response.status,
      headers: response.headers
    });
  }
  
  return response;
}

// ─── Advanced: Distributed Honeypot Network ───

class HoneypotNetwork {
  constructor() {
    this.sharedBanList = 'https://honeypot-network.example.com/bans';
  }
  
  async reportBotToNetwork(ip, reason) {
    // Share bot IPs with other sites in the network
    await fetch(this.sharedBanList, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, reason, reportedBy: 'yoursite.com' })
    });
  }
  
  async getSharedBanList() {
    // Download ban list from network
    const response = await fetch(this.sharedBanList);
    const bans = await response.json();
    
    // Apply to local KV
    for (const ban of bans) {
      await BANNED_IPS_KV.put(ban.ip, JSON.stringify(ban), { expirationTtl: 86400 });
    }
  }
}

// ═══ Benefits ═══
// 1. 100% accuracy when triggered (invisible elements = guaranteed bot)
// 2. Zero false positives (humans can't interact with hidden elements)
// 3. Instant detection (no waiting for ML model)
// 4. Wastes bot resources (fake content keeps them busy)
// 5. Provides threat intelligence (learn bot behavior)
// 6. Network effect (shared ban lists across sites)

// ═══ Honeypot Types Summary ═══
// 1. Link Honeypots: Hidden links bots click
// 2. Form Honeypots: Hidden fields bots fill
// 3. Mouse Honeypots: Detect no mouse movement
// 4. Cookie Honeypots: Detect cookie manipulation
// 5. JS Honeypots: Fake APIs bots call
// 6. robots.txt Honeypots: Disallowed paths bots access

// ═══ Implementation Complexity ═══
// Low to Medium (4-8 hours):
// - Link honeypots: 1 hour
// - Form honeypots: 1-2 hours
// - Mouse tracking: 2 hours
// - Cookie/JS traps: 1 hour
// - Worker integration: 2 hours
// - Testing: 2 hours

// ═══ Best Practices ═══
// 1. Use multiple honeypot types (layered defense)
// 2. Randomize honeypot names/paths
// 3. Make fake content realistic (waste bot time)
// 4. Share ban lists across your domains
// 5. Set reasonable ban durations (24h, not permanent)
// 6. Log everything for analysis

module.exports = {
  injectLinkHoneypots,
  addFormHoneypots,
  MouseTrackingHoneypot,
  setCookieHoneypot,
  generateRobotsTxtWithHoneypots,
  HoneypotNetwork
};
