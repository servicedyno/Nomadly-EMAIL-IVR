// ═══ Geo-Fencing - Implementation Guide ═══

/**
 * CONCEPT: Control access based on visitor's geographic location
 * 
 * Use cases:
 * 1. Block high-risk countries (known for scanner/bot traffic)
 * 2. Allow only specific regions (e.g., US-only site)
 * 3. Show different content per region (localization + cloaking)
 * 4. Block data center IPs (bots often run from AWS/GCP/Azure)
 */

// ─── Approach 1: Cloudflare Worker with Geo Headers ───
// Cloudflare automatically provides geo data in request headers

addEventListener('fetch', event => {
  event.respondWith(handleWithGeoFencing(event.request));
});

async function handleWithGeoFencing(request) {
  // Cloudflare provides these headers automatically:
  const country = request.headers.get('CF-IPCountry');       // US, CN, RU, etc.
  const city = request.headers.get('CF-IPCity');             // New York, London
  const continent = request.headers.get('CF-IPContinent');   // NA, EU, AS
  const timezone = request.headers.get('CF-Timezone');       // America/New_York
  const latitude = request.headers.get('CF-IPLatitude');     // 40.7128
  const longitude = request.headers.get('CF-IPLongitude');   // -74.0060
  const region = request.headers.get('CF-Region');           // CA, NY, TX
  const metroCode = request.headers.get('CF-MetroCode');     // DMA code
  
  // ─── Strategy 1: Block High-Risk Countries ───
  const HIGH_RISK_COUNTRIES = [
    'CN', // China (lots of bots)
    'RU', // Russia (lots of bots)
    'KP', // North Korea
    'IR', // Iran
    'VN', // Vietnam (click farms)
    'BD', // Bangladesh (click farms)
    'PK', // Pakistan (lots of scanners)
  ];
  
  if (HIGH_RISK_COUNTRIES.includes(country)) {
    // Option A: Block completely (403)
    return new Response('Access denied from this region', { 
      status: 403,
      headers: { 'X-Geo-Block': country }
    });
    
    // Option B: Show cloaked placeholder (better - no 403 signals)
    return cloakedResponse();
    
    // Option C: Extra strong challenge
    return strengthenedChallenge();
  }
  
  // ─── Strategy 2: Whitelist Specific Countries ───
  const ALLOWED_COUNTRIES = ['US', 'CA', 'GB', 'AU', 'NZ'];
  
  if (!ALLOWED_COUNTRIES.includes(country)) {
    return cloakedResponse(); // Non-allowed countries see placeholder
  }
  
  // ─── Strategy 3: Block Data Center IPs ───
  // Bots often run from cloud providers (AWS, GCP, Azure, DigitalOcean)
  const asn = request.cf?.asn || 0; // Cloudflare provides ASN
  const asnOrg = request.cf?.asOrganization || '';
  
  const DATA_CENTER_ASNS = [
    16509, // Amazon AWS
    15169, // Google Cloud
    8075,  // Microsoft Azure
    14061, // DigitalOcean
    20473, // Choopa/Vultr
    24940, // Hetzner
  ];
  
  if (DATA_CENTER_ASNS.includes(asn)) {
    console.log(`Blocked data center IP: ASN ${asn} (${asnOrg})`);
    return cloakedResponse();
  }
  
  if (/amazon|google|microsoft|azure|digitalocean|linode|ovh/i.test(asnOrg)) {
    console.log(`Blocked hosting provider: ${asnOrg}`);
    return cloakedResponse();
  }
  
  // ─── Strategy 4: Time-Based Geo Rules ───
  // Block countries during their night hours (bots don't sleep!)
  const hour = new Date().getHours();
  const localHour = convertToLocalHour(hour, timezone);
  
  if (localHour >= 2 && localHour <= 6) {
    // Suspicious: Accessing site at 2-6 AM local time
    return strengthenedChallenge();
  }
  
  // ─── Strategy 5: Distance-Based Anomaly Detection ───
  // If user jumps between distant locations quickly = VPN/bot
  const lastLocation = await getLastKnownLocation(request);
  if (lastLocation) {
    const distance = calculateDistance(
      lastLocation.lat, lastLocation.lon,
      latitude, longitude
    );
    const timeDiff = Date.now() - lastLocation.timestamp;
    
    // Impossible travel speed (e.g., 5000 km in 5 minutes)
    if (distance > 1000 && timeDiff < 600000) { // 10 minutes
      console.log(`Impossible travel: ${distance}km in ${timeDiff}ms`);
      return cloakedResponse();
    }
  }
  
  // Passed all geo checks → continue
  return fetch(request);
}

// ─── Helper Functions ───

function convertToLocalHour(utcHour, timezone) {
  // Convert UTC hour to local timezone hour
  const timezoneOffset = {
    'America/New_York': -5,
    'America/Los_Angeles': -8,
    'Europe/London': 0,
    'Asia/Tokyo': 9,
    // ... map all timezones
  };
  
  const offset = timezoneOffset[timezone] || 0;
  return (utcHour + offset + 24) % 24;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula for great-circle distance
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function getLastKnownLocation(request) {
  // Store user's last location in KV or cookie
  const sessionId = request.headers.get('Cookie')?.match(/session=([^;]+)/)?.[1];
  if (!sessionId) return null;
  
  const cached = await LOCATIONS_KV.get(sessionId);
  return cached ? JSON.parse(cached) : null;
}

// ─── Approach 2: Advanced Rules via Cloudflare Firewall ───

// Create sophisticated geo rules via Cloudflare API

async function createGeoFirewallRules(zoneId) {
  const CF_EMAIL = process.env.CLOUDFLARE_EMAIL;
  const CF_KEY = process.env.CLOUDFLARE_API_KEY;
  
  const rules = [
    {
      description: 'Block high-risk countries',
      expression: '(ip.geoip.country in {"CN" "RU" "KP" "IR"})',
      action: 'block'
    },
    {
      description: 'Challenge data center IPs',
      expression: '(ip.geoip.asnum in {16509 15169 8075 14061})',
      action: 'challenge'
    },
    {
      description: 'Block VPN providers',
      expression: '(ip.geoip.is_in_european_union and cf.threat_score > 30)',
      action: 'js_challenge'
    },
    {
      description: 'Rate limit from specific countries',
      expression: '(ip.geoip.country eq "VN" and cf.threat_score > 10)',
      action: 'challenge'
    }
  ];
  
  for (const rule of rules) {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules`, {
      method: 'POST',
      headers: {
        'X-Auth-Email': CF_EMAIL,
        'X-Auth-Key': CF_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: rule.action,
        filter: { expression: rule.expression },
        description: rule.description
      })
    });
  }
  
  return { success: true };
}

// ─── Approach 3: Dynamic Country Reputation ───

// Maintain a reputation score per country based on historical data

class CountryReputationSystem {
  constructor() {
    this.scores = {}; // { 'US': 95, 'CN': 20, 'RU': 15 }
  }
  
  async updateScore(country, event) {
    const current = this.scores[country] || 50; // Start at neutral
    
    // Adjust based on event
    if (event === 'bot_detected') {
      this.scores[country] = Math.max(0, current - 5);
    } else if (event === 'legitimate_visit') {
      this.scores[country] = Math.min(100, current + 1);
    } else if (event === 'attack_attempt') {
      this.scores[country] = Math.max(0, current - 20);
    }
    
    // Store in KV
    await COUNTRY_SCORES_KV.put(country, this.scores[country].toString());
  }
  
  async getScore(country) {
    const stored = await COUNTRY_SCORES_KV.get(country);
    return stored ? parseInt(stored) : 50;
  }
  
  shouldBlock(country) {
    const score = this.scores[country] || 50;
    return score < 30; // Block countries with reputation < 30
  }
  
  shouldChallenge(country) {
    const score = this.scores[country] || 50;
    return score < 60; // Challenge countries with reputation < 60
  }
}

// ─── Approach 4: User-Friendly Geo Blocking ───

// Instead of hard blocking, show a friendly message

function geoBlockedResponse(country, reason) {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Region Not Supported</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 50px; }
        h1 { color: #e74c3c; }
        p { color: #555; line-height: 1.6; }
      </style>
    </head>
    <body>
      <h1>🌍 Access Restricted</h1>
      <p>We're sorry, but our service is not currently available in your region.</p>
      <p><strong>Detected location:</strong> ${country}</p>
      <p>${reason}</p>
      <p>If you believe this is an error, please contact support.</p>
    </body>
    </html>
  `, {
    status: 451, // HTTP 451: Unavailable For Legal Reasons
    headers: { 
      'Content-Type': 'text/html',
      'X-Geo-Block': country
    }
  });
}

// ═══ Configuration Examples ═══

const GEO_POLICIES = {
  // Policy 1: US-only site
  us_only: {
    allowedCountries: ['US'],
    action: 'block',
    message: 'This service is only available in the United States.'
  },
  
  // Policy 2: Block high-risk + data centers
  strict: {
    blockedCountries: ['CN', 'RU', 'KP', 'IR'],
    blockDataCenters: true,
    challengeVPNs: true
  },
  
  // Policy 3: Graduated response by threat level
  adaptive: {
    highRisk: { countries: ['CN', 'RU'], action: 'cloak' },
    mediumRisk: { countries: ['VN', 'BD', 'PK'], action: 'challenge' },
    lowRisk: { countries: ['*'], action: 'allow' }
  }
};

// ═══ Benefits ═══
// 1. Drastically reduces bot traffic (80-90% of bots come from specific countries)
// 2. Blocks data center IPs (cloud-based scanners)
// 3. Detects impossible travel (VPN hopping)
// 4. Time-based anomaly detection
// 5. Dynamic reputation scoring

// ═══ Trade-offs ═══
// 1. Legitimate users behind VPNs may be blocked
// 2. May reduce global reach (blocking entire countries)
// 3. Can appear discriminatory (need clear communication)
// 4. VPNs can bypass country-based blocking
// 5. Need to balance security vs accessibility

// ═══ Implementation Complexity ═══
// Low to Medium (2-4 hours):
// - Basic country blocking: 30 minutes
// - ASN/data center blocking: 1 hour
// - Impossible travel detection: 2 hours
// - Dynamic reputation: 3-4 hours
// - Testing: 2-3 hours

// ═══ Best Practices ═══
// 1. Start with high-risk countries only (don't over-block)
// 2. Use "challenge" instead of "block" when possible
// 3. Provide clear error messages
// 4. Monitor false positive rate
// 5. Combine with other signals (don't rely solely on geo)

module.exports = {
  handleWithGeoFencing,
  createGeoFirewallRules,
  CountryReputationSystem,
  GEO_POLICIES
};
