/* global process */
require('dotenv').config()
const axios = require('axios')
const accessToken = process.env.API_BITLY
const bitlyApiUrl = 'https://api-ssl.bitly.com/v4/shorten'

const createShortBitly = async longUrl => {
  const response = await axios.post(
    bitlyApiUrl,
    {
      long_url: longUrl,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  )

  const shortUrl = response.data.id
  return shortUrl
}

// ── Click tracking via Bitly API ────────────────────────────────────────
// Bitlink format expected: "bit.ly/abc123" (no protocol). We strip protocol
// from inputs like "https://bit.ly/abc123" automatically.
// Cache 5 min to stay under Bitly's free-tier rate limits (1500 calls/hr).

const _clickCache = new Map() // bitlink -> { clicks, expires }
const CACHE_TTL_MS = 5 * 60 * 1000

const getBitlyClicks = async bitlinkOrUrl => {
  if (!bitlinkOrUrl) return 0
  const bitlink = String(bitlinkOrUrl).replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!bitlink) return 0

  const cached = _clickCache.get(bitlink)
  if (cached && cached.expires > Date.now()) return cached.clicks

  try {
    const response = await axios.get(
      `https://api-ssl.bitly.com/v4/bitlinks/${encodeURIComponent(bitlink)}/clicks/summary?units=-1`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 8000,
      },
    )
    const clicks = Number(response.data?.total_clicks) || 0
    _clickCache.set(bitlink, { clicks, expires: Date.now() + CACHE_TTL_MS })
    return clicks
  } catch (err) {
    // 404 = link not found / not a Bitly link; 403 = unauthorized; 429 = rate limited
    // Don't blow up the My Links view — just return 0 and don't cache so we retry later.
    return 0
  }
}

const isBitlyUrl = url => /^(https?:\/\/)?(bit\.ly|j\.mp|bitly\.is)\//i.test(String(url || ''))

module.exports = createShortBitly
module.exports.createShortBitly = createShortBitly
module.exports.getBitlyClicks = getBitlyClicks
module.exports.isBitlyUrl = isBitlyUrl
