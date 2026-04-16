/**
 * ConnectReseller Auto IP Whitelist via Browser Automation (Puppeteer)
 *
 * Since ConnectReseller has no API for IP whitelisting, this script:
 * 1. Logs into the ConnectReseller panel
 * 2. Navigates to Tools → Profile → API tab
 * 3. Reads existing whitelisted IPs
 * 4. Adds the server IP to the first empty slot (if not already present)
 * 5. Saves the whitelist
 *
 * Usage: node cr-whitelist-browser.js <IP_TO_WHITELIST>
 * Output: JSON on stdout with { success, ip, message }
 *
 * Configuration:
 * - Set BROWSER_WS_ENDPOINT env var to use external browser service (e.g., Browserless.io)
 * - For local dev without external service, it will attempt local browser launch (requires full puppeteer)
 */

const puppeteer = require('puppeteer-core')
const fs = require('fs')

const IP_FIELDS = ['ipaddress1', 'ipaddress2', 'ipaddress3', 'ipaddress4', 'ipaddress5']

/**
 * Find a working Chromium binary for local development.
 * - On preview pods (aarch64): Playwright-installed Chromium at /pw-browsers/
 * - Fallback to system Chrome/Chromium
 */
function findChromePath() {
  const pwPaths = [
    '/pw-browsers/chromium-1208/chrome-linux/chrome',
    '/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell',
  ]
  for (const p of pwPaths) {
    if (fs.existsSync(p)) return p
  }
  // Common system paths
  const systemPaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ]
  for (const p of systemPaths) {
    if (fs.existsSync(p)) return p
  }
  return undefined
}

function output(success, ip, message) {
  console.log(JSON.stringify({ success, ip, message }))
  process.exit(success ? 0 : 1)
}

async function main() {
  const email = process.env.CR_PANEL_EMAIL || ''
  const password = process.env.CR_PANEL_PASSWORD || ''
  const ip = process.argv[2] || ''

  if (!email || !password) {
    return output(false, ip, 'CR_PANEL_EMAIL and CR_PANEL_PASSWORD env vars required')
  }
  if (!ip) {
    return output(false, '', 'IP address argument required')
  }

  let browser
  try {
    // Use external browser service if BROWSER_WS_ENDPOINT is set (production/Railway)
    const browserWsEndpoint = process.env.BROWSER_WS_ENDPOINT
    
    if (browserWsEndpoint) {
      // Connect to external browser service (Browserless, etc.)
      browser = await puppeteer.connect({
        browserWSEndpoint: browserWsEndpoint,
      })
    } else {
      // Local development fallback - launch local browser
      const chromePath = findChromePath()
      if (!chromePath) {
        return output(false, ip, 'No BROWSER_WS_ENDPOINT set and no local Chrome found. Set BROWSER_WS_ENDPOINT to use external browser service.')
      }
      browser = await puppeteer.launch({
        headless: true,
        executablePath: chromePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
    }
    
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 900 })

    // 1. Login
    await page.goto('https://global.connectreseller.com', { waitUntil: 'networkidle2', timeout: 30000 })
    await new Promise(r => setTimeout(r, 2000))

    // Clear fields first, then type credentials
    const emailField = await page.$('input[type="text"]')
    const passField = await page.$('input[type="password"]')
    if (emailField) {
      await emailField.click({ clickCount: 3 })
      await emailField.type(email, { delay: 20 })
    }
    if (passField) {
      await passField.click({ clickCount: 3 })
      await passField.type(password, { delay: 20 })
    }

    // Click Sign in button specifically
    const signInBtn = await page.evaluateHandle(() => {
      const btns = [...document.querySelectorAll('button')]
      return btns.find(b => b.textContent.toLowerCase().includes('sign in'))
    })
    if (signInBtn && await signInBtn.asElement()) {
      await signInBtn.click()
    } else {
      // Fallback: submit the form
      await page.keyboard.press('Enter')
    }
    await new Promise(r => setTimeout(r, 10000))

    const url = page.url()
    if (!url.includes('/dashboard') && !url.includes('/reseller')) {
      return output(false, ip, `Login failed - landed on ${url}`)
    }

    // 2. Navigate to Profile → API tab
    await page.goto('https://global.connectreseller.com/tools/profile', { waitUntil: 'networkidle2', timeout: 15000 })
    await new Promise(r => setTimeout(r, 3000))

    // Click API tab
    const apiTab = await page.evaluateHandle(() => {
      const els = [...document.querySelectorAll('a, button, span, div, li')]
      return els.find(el => el.textContent.trim() === 'API')
    })
    if (apiTab) await apiTab.click()
    await new Promise(r => setTimeout(r, 4000))

    // 3. Read current IP values
    const currentValues = {}
    for (const name of IP_FIELDS) {
      try {
        const val = await page.$eval(
          `input[formcontrolname="${name}"]`,
          el => el.value
        )
        currentValues[name] = (val || '').trim()
      } catch {
        currentValues[name] = ''
      }
    }

    const existingIps = Object.values(currentValues).filter(Boolean)

    // 4. Check if IP already whitelisted
    if (existingIps.includes(ip)) {
      return output(true, ip, `IP ${ip} is already whitelisted (slots: ${existingIps.join(', ')})`)
    }

    // 5. Find first empty slot
    let emptySlot = null
    for (const name of IP_FIELDS) {
      if (!currentValues[name]) {
        emptySlot = name
        break
      }
    }

    if (!emptySlot) {
      return output(false, ip, `No empty IP slots. Current: ${existingIps.join(', ')}. Remove one manually.`)
    }

    // 6. Fill the empty slot
    const field = await page.$(`input[formcontrolname="${emptySlot}"]`)
    await field.click({ clickCount: 3 }) // select all existing text
    await field.type(ip)
    await new Promise(r => setTimeout(r, 1000))

    // 7. Click Save
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await new Promise(r => setTimeout(r, 500))

    const saveBtn = await page.evaluateHandle(() => {
      const btns = [...document.querySelectorAll('button')]
      return btns.find(b => b.textContent.toLowerCase().includes('save whitelisted ip'))
    })
    if (!saveBtn || !(await saveBtn.asElement())) {
      return output(false, ip, 'Save button not found on page')
    }

    await saveBtn.click()
    await new Promise(r => setTimeout(r, 5000))

    // 8. Verify success
    const content = await page.content()
    const lower = content.toLowerCase()
    if (lower.includes('successfully updated') || lower.includes('success')) {
      return output(true, ip, `IP ${ip} whitelisted in ${emptySlot}`)
    } else {
      return output(true, ip, `IP ${ip} added to ${emptySlot} (save clicked, check panel to confirm)`)
    }
  } catch (e) {
    return output(false, ip, `Browser automation error: ${e.message}`)
  } finally {
    if (browser) await browser.close()
  }
}

main()
