#!/usr/bin/env python3
"""Re-deliver @davion419's CURRENT RDP credentials (password was refreshed during final checks)."""
import json, urllib.request, urllib.parse

env = {}
for line in open('/app/backend/.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env[k] = v.strip().strip('"').strip("'")

PROD_TOKEN = env['TELEGRAM_BOT_TOKEN_PROD']
CHAT = '404562920'
SUPPORT = env.get('SUPPORT_USERNAME', '@onarrival1')

msg = (
    "🔄 <b>Updated RDP login (password refreshed)</b>\n\n"
    "We just ran a final systems check on your RDP and refreshed the password. "
    "Please use these <b>current</b> details (the earlier password no longer works):\n\n"
    "• IP Address: <code>20.125.117.70</code>\n"
    "• Username: <code>nomadly</code>\n"
    "• Password: <code>kp!rc3PATR-_@dxGcr=7</code>\n"
    "• Port: <code>3389</code>\n\n"
    "Everything is tested and working — Start, Stop, Restart, Reset Password and Reinstall are all "
    "available from the bot → <b>VPS</b> → <b>View / Manage VPS</b>. You can change this password "
    "anytime with <b>Reset Password</b>.\n\n"
    f"Thanks again for your patience! 🙏 Support: {SUPPORT}"
)

data = urllib.parse.urlencode({
    'chat_id': CHAT, 'text': msg, 'parse_mode': 'HTML', 'disable_web_page_preview': 'true',
}).encode()
try:
    resp = json.loads(urllib.request.urlopen(
        urllib.request.Request(f"https://api.telegram.org/bot{PROD_TOKEN}/sendMessage", data=data), timeout=25).read())
    print("ok:", resp.get('ok'), "| message_id:", resp.get('result', {}).get('message_id'),
          "| to:", resp.get('result', {}).get('chat', {}).get('username'))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:400])
