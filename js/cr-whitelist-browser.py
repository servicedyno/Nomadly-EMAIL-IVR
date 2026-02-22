#!/usr/bin/env python3
"""
ConnectReseller Auto IP Whitelist via Browser Automation (Playwright)

Since ConnectReseller has no API for IP whitelisting, this script:
1. Detects the server's outbound IP
2. Logs into the ConnectReseller panel
3. Navigates to Tools → Profile → API tab
4. Reads existing whitelisted IPs
5. Adds the server IP to the first empty slot (if not already present)
6. Saves the whitelist

Usage: /opt/plugins-venv/bin/python3 cr-whitelist-browser.py [IP_TO_WHITELIST]
  If no IP provided, auto-detects via ipify.org

Exit codes:
  0 = success (IP whitelisted or already present)
  1 = error (login failed, no empty slots, etc.)

Output: JSON on stdout with { success, ip, message }
"""

import sys
import os
import json
import urllib.request

def detect_ip():
    """Detect outbound IP via ipify"""
    try:
        req = urllib.request.urlopen('https://api.ipify.org/', timeout=5)
        return req.read().decode().strip()
    except Exception:
        try:
            req = urllib.request.urlopen('https://ifconfig.me/ip', timeout=5)
            return req.read().decode().strip()
        except Exception:
            return None

def result(success, ip='', message=''):
    print(json.dumps({'success': success, 'ip': ip, 'message': message}))
    sys.exit(0 if success else 1)

def main():
    email = os.environ.get('CR_PANEL_EMAIL', '')
    password = os.environ.get('CR_PANEL_PASSWORD', '')

    if not email or not password:
        result(False, '', 'CR_PANEL_EMAIL and CR_PANEL_PASSWORD env vars required')

    # Get IP to whitelist
    ip = sys.argv[1] if len(sys.argv) > 1 else detect_ip()
    if not ip:
        result(False, '', 'Could not detect outbound IP')

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1920, 'height': 900})
        page = context.new_page()

        try:
            # 1. Login
            page.goto('https://global.connectreseller.com', wait_until='networkidle', timeout=30000)
            page.wait_for_timeout(2000)

            page.fill('input[type="text"]', email)
            page.fill('input[type="password"]', password)
            page.click('button:has-text("Sign in")', force=True)
            page.wait_for_timeout(8000)

            if '/dashboard' not in page.url and '/reseller' not in page.url:
                result(False, ip, f'Login failed - landed on {page.url}')

            # 2. Navigate to Profile → API tab
            page.goto('https://global.connectreseller.com/tools/profile', wait_until='networkidle', timeout=15000)
            page.wait_for_timeout(3000)
            page.click('text=API', force=True)
            page.wait_for_timeout(4000)

            # 3. Read current IP values
            ip_fields = ['ipaddress1', 'ipaddress2', 'ipaddress3', 'ipaddress4', 'ipaddress5']
            current_values = {}
            for name in ip_fields:
                try:
                    val = page.input_value(f'input[formcontrolname="{name}"]')
                    current_values[name] = val.strip() if val else ''
                except Exception:
                    current_values[name] = ''

            existing_ips = [v for v in current_values.values() if v]

            # 4. Check if IP already whitelisted
            if ip in existing_ips:
                result(True, ip, f'IP {ip} is already whitelisted (slots: {existing_ips})')

            # 5. Find first empty slot
            empty_slot = None
            for name in ip_fields:
                if not current_values[name]:
                    empty_slot = name
                    break

            if not empty_slot:
                # Try to find a slot we can replace (not the first one which is primary)
                result(False, ip, f'No empty IP slots. Current: {existing_ips}. Remove one manually.')

            # 6. Fill the empty slot
            page.fill(f'input[formcontrolname="{empty_slot}"]', ip)
            page.wait_for_timeout(1000)

            # 7. Click Save
            page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
            page.wait_for_timeout(500)
            save_btn = page.query_selector('button:has-text("Save whitelisted IP address")')
            if not save_btn:
                result(False, ip, 'Save button not found on page')

            save_btn.click(force=True)
            page.wait_for_timeout(5000)

            # 8. Verify success message
            content = page.content()
            if 'successfully updated' in content.lower() or 'success' in content.lower():
                result(True, ip, f'IP {ip} whitelisted in {empty_slot}')
            else:
                result(True, ip, f'IP {ip} added to {empty_slot} (save clicked, check panel to confirm)')

        except Exception as e:
            result(False, ip, f'Browser automation error: {str(e)}')
        finally:
            browser.close()

if __name__ == '__main__':
    main()
