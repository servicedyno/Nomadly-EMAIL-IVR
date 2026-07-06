#!/usr/bin/env python3
"""One-off: deliver @davion419's new Azure RDP credentials via the PRODUCTION Telegram bot."""
import json, urllib.request, urllib.parse

env = {}
for line in open('/app/backend/.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        env[k] = v.strip().strip('"').strip("'")

PROD_TOKEN = env['TELEGRAM_BOT_TOKEN_PROD']   # explicitly the PROD bot
CHAT = '404562920'                            # @davion419
SUPPORT = env.get('SUPPORT_USERNAME', '@onarrival1')

msg = (
    "🖥️ <b>Your Windows RDP is ready</b> ✅\n\n"
    "Good news — we've resolved the RDP that was stuck on <i>\"pending payment\"</i>. "
    "Your new Windows RDP is live and ready to use.\n\n"
    "🔑 <b>RDP Login Details</b>\n"
    "• IP Address: <code>20.125.117.70</code>\n"
    "• Username: <code>nomadly</code>\n"
    "• Password: <code>9_dsauo=6ZGtDGN3thcf</code>\n"
    "• Port: <code>3389</code>\n\n"
    "<b>How to connect</b>\n"
    "1. Open <b>Remote Desktop Connection</b> (Windows) or any RDP app (Mac/iOS/Android).\n"
    "2. Enter the IP above, then sign in with the username &amp; password.\n\n"
    "🛠 You can <b>manage this RDP anytime from the bot</b> → <b>VPS</b> → <b>View / Manage VPS</b> "
    "(Start, Stop, Reset Password, Reinstall Windows).\n\n"
    "🔒 For security, please change the password after your first login (or use <b>Reset Password</b> in the bot).\n\n"
    "Sorry for the wait — thanks for your patience! 🙏\n"
    f"Need help? Contact support: {SUPPORT}"
)

data = urllib.parse.urlencode({
    'chat_id': CHAT,
    'text': msg,
    'parse_mode': 'HTML',
    'disable_web_page_preview': 'true',
}).encode()

req = urllib.request.Request(
    f"https://api.telegram.org/bot{PROD_TOKEN}/sendMessage",
    data=data,
)
try:
    resp = json.loads(urllib.request.urlopen(req, timeout=25).read())
    print("ok:", resp.get('ok'))
    if resp.get('ok'):
        r = resp['result']
        print("message_id:", r.get('message_id'))
        print("to chat:", r.get('chat', {}).get('id'),
              "| username:", r.get('chat', {}).get('username'),
              "| name:", r.get('chat', {}).get('first_name'))
        print("date:", r.get('date'))
    else:
        print(json.dumps(resp, indent=2))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:500])
except Exception as e:
    print("ERR", e)
