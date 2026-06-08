#!/usr/bin/env python3
"""Comprehensive user activity report from Nomadly bot logs since last Friday."""
import json, re, sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

SRC = "/app/logs_prod/nomadly_since_friday.jsonl"
OUT = "/app/USER_ACTIVITY_SINCE_FRIDAY.md"

# Load
logs = []
with open(SRC) as f:
    for line in f:
        logs.append(json.loads(line))
logs.sort(key=lambda x: x.get("timestamp") or "")

ANSI = re.compile(r"\x1b\[[0-9;]*m")
def clean(s): return ANSI.sub("", s or "")

# Patterns for parsing log lines
FROM_RE     = re.compile(r"\bfrom:\s*(\d{6,})(?:\s+([A-Za-z0-9_]+))?")
TO_RE       = re.compile(r"\bto:\s*(\d{6,})")
MSG_RE      = re.compile(r"^(message|callback|cmd|reply_callback):\s*(.+?)(?:\s*\tfrom:\s*(\d+)(?:\s+(\S+))?)?\s*$")

def parse_inbound(msg):
    """Returns (kind, action_text, chatId, username) or None."""
    m = MSG_RE.match(msg)
    if not m: return None
    kind, action, cid, uname = m.group(1), m.group(2).strip(), m.group(3), m.group(4)
    return (kind, action, cid, uname)

# Categorize inbound actions into business activities
def categorize(action):
    a = action.lower()
    if a.startswith('/start') or 'start' == a: return ('cmd', 'Open bot (/start)')
    if a.startswith('/done'): return ('cmd', 'Exit support (/done)')
    if a.startswith('/help'): return ('cmd', 'Help (/help)')
    if a.startswith('/admin'): return ('cmd', 'Admin panel (/admin)')
    if a.startswith('/testsip'): return ('cmd', 'SIP test (/testsip)')
    if a.startswith('/sipguide'): return ('cmd', 'SIP guide (/sipguide)')
    if a.startswith('/yes') or a == '✅ yes' or a == 'yes': return ('confirm', 'Confirmed yes')
    if a.startswith('/no')  or a == '❌ no'  or a == 'no':  return ('confirm', 'Replied no')
    if 'cloud ivr' in a or 'sip' in a:                     return ('ivr', 'Cloud IVR / SIP menu')
    if 'bulk ivr' in a:                                     return ('ivr', 'Bulk IVR Campaign')
    if 'quick ivr' in a or 'try free ivr' in a:             return ('ivr', 'Quick / Free IVR call')
    if 'use ivr template' in a or 'ivr template' in a:      return ('ivr', 'Selected IVR template')
    if 'launch campaign' in a:                              return ('ivr', 'Launch IVR campaign')
    if 'show status' in a:                                  return ('ivr', 'View campaign status')
    if 'transfer + report' in a or 'transfer mode' in a:    return ('ivr', 'IVR transfer mode')
    if 'normal (1.0x)' in a or 'fast' in a or 'slow' in a:  return ('ivr', 'Adjusted IVR speed')
    if 'openai' in a or 'alloy' in a or 'voice' in a:       return ('ivr', 'Selected IVR voice')
    if 'use this audio' in a:                               return ('ivr', 'Confirmed IVR audio')
    if 'marketplace' in a:                                  return ('marketplace', 'Browse marketplace')
    if 'browse deals' in a:                                 return ('marketplace', 'Browse deals')
    if 'choose a plan' in a or 'choisir un forfait' in a:   return ('purchase', 'Choose a plan')
    if 'wallet' in a or '👛' in a:                          return ('wallet', 'Open wallet')
    if 'bulletproof domain' in a or 'buy domain' in a:      return ('domain', 'Browse domains')
    if 'anti-red hosting' in a or 'hosting' in a:           return ('hosting', 'Hosting menu')
    if 'vps' in a:                                          return ('vps', 'VPS menu')
    if 'virtual card' in a or 'virtual phone' in a:         return ('product', 'Virtual product menu')
    if 'bnk logs' in a or 'bank log' in a:                  return ('marketplace', 'Bank logs menu')
    if 'support' in a or '💬' in a:                         return ('support', 'Opened support')
    if 'back' in a or 'retour' in a or 'cancel' in a:       return ('nav', 'Back / Cancel')
    if 'english' in a or 'french' in a or 'español' in a or '🇬🇧' in a or '🇫🇷' in a or '🇪🇸' in a:
                                                            return ('lang', 'Set language')
    if 'account security' in a or 'fraud' in a or 'verify' in a or 'card' in a.split() or 'bank' in a:
                                                            return ('ivr', 'IVR script content (security/fraud)')
    if 'new device login' in a or 'login' in a:             return ('ivr', 'IVR script: device login')
    if 'member' in a:                                       return ('ivr', 'IVR script: member')
    if re.match(r'^\+?\d{8,}', a):                          return ('ivr', 'Entered phone number')
    if re.match(r'^case-?\d', a) or re.match(r'^🔖', a):    return ('ivr', 'IVR script: case ID')
    if 'plan' in a or '$' in a or '€' in a or 'mois' in a:  return ('purchase', 'Plan / pricing selection')
    if any(k in a for k in ('email','smtp','sendgrid')):    return ('email', 'Email service')
    if 'sms' in a:                                          return ('sms', 'SMS service')
    return ('other', action[:60])

# Walk logs
user_actions = defaultdict(list)   # chatId -> list of (ts, kind, action_text, category, label)
user_username = {}                 # chatId -> last-seen username
inbound_count = 0
outbound_to = Counter()            # chatId -> outbound msgs to this user
category_total = Counter()
category_users = defaultdict(set)
hourly = defaultdict(lambda: Counter())
daily_users = defaultdict(set)
daily_inbound = Counter()

for l in logs:
    msg = clean(l.get("message",""))
    ts = l.get("timestamp","")
    day = ts[:10]
    hour = ts[:13]

    # Inbound (real user actions)
    parsed = parse_inbound(msg)
    if parsed:
        kind, action, cid, uname = parsed
        if cid:
            if uname: user_username[cid] = uname
            cat, label = categorize(action)
            user_actions[cid].append((ts, kind, action, cat, label))
            inbound_count += 1
            category_total[cat] += 1
            category_users[cat].add(cid)
            hourly[hour][cat] += 1
            daily_users[day].add(cid)
            daily_inbound[day] += 1
        continue

    # Outbound to: <id>
    m = TO_RE.search(msg)
    if m:
        outbound_to[m.group(1)] += 1

# Also detect "NEW USER" / welcome bonus / first-time joins
new_users = set()
for l in logs:
    msg = clean(l.get("message",""))
    if 'welcome bonus' in msg.lower() or 'NEW USER' in msg:
        m = re.search(r"(\d{8,12})", msg)
        if m: new_users.add(m.group(1))

# Detect successful payments (Fincra/BlockBee/etc webhook confirmations)
PAID_RE = re.compile(r"(payment.*(confirmed|paid|completed|succeeded)|wallet.*credited|deposit.*confirmed|✅.*pay)", re.I)
paid_events = []
for l in logs:
    msg = clean(l.get("message",""))
    if PAID_RE.search(msg):
        # try to extract chatId
        m = re.search(r"(?:chatId|user|for)\s*[=:]?\s*(\d{8,12})|to:\s*(\d{8,12})|\b(\d{8,12})\b", msg)
        cid = next((g for g in (m.groups() if m else ()) if g), None) if m else None
        paid_events.append((l.get("timestamp",""), cid, msg[:240]))

# Detect VPS provisions
VPS_PROV_RE = re.compile(r"(VPS PROVISIONED|VPS Activated|nomadly-\d+-\d+ created|provisionVPS.*success|✅ VPS|VPS purchase complete)", re.I)
vps_provisions = []
for l in logs:
    msg = clean(l.get("message",""))
    if VPS_PROV_RE.search(msg):
        m = re.search(r"(\d{8,12})", msg)
        cid = m.group(1) if m else None
        vps_provisions.append((l.get("timestamp",""), cid, msg[:240]))

# Detect hosting provisions
HOST_PROV_RE = re.compile(r"(Hosting Activated|cpanel.*created|hosting.*provision.*success|✅ Hosting)", re.I)
hosting_provisions = []
for l in logs:
    msg = clean(l.get("message",""))
    if HOST_PROV_RE.search(msg):
        m = re.search(r"(\d{8,12})", msg)
        cid = m.group(1) if m else None
        hosting_provisions.append((l.get("timestamp",""), cid, msg[:240]))

# Detect domain registrations
DOMAIN_REG_RE = re.compile(r"(domain.*registered|registerDomain.*success|✅ Domain|Domain Purchase Complete)", re.I)
domain_registrations = []
for l in logs:
    msg = clean(l.get("message",""))
    if DOMAIN_REG_RE.search(msg):
        m = re.search(r"(\d{8,12})", msg)
        cid = m.group(1) if m else None
        domain_registrations.append((l.get("timestamp",""), cid, msg[:240]))

# Print summary
print(f"loaded {len(logs):,} log lines")
print(f"inbound user actions: {inbound_count:,}")
print(f"unique active users:  {len(user_actions)}")
print(f"new users (welcome bonus): {len(new_users)}")
print()

# Top users
print("Top 15 most active users:")
top_users = sorted(user_actions.items(), key=lambda x: -len(x[1]))[:15]
for uid, actions in top_users:
    uname = user_username.get(uid, '-')
    cats = Counter(a[3] for a in actions)
    print(f"  {uid:<12} @{uname:<20} {len(actions):>4} actions  top: {dict(cats.most_common(3))}")

# Daily
print(f"\nDaily breakdown:")
for day in sorted(daily_users):
    print(f"  {day}: {len(daily_users[day]):>3} unique users, {daily_inbound[day]:>4} inbound actions")

# Categories
print(f"\nActivity by category:")
for cat, n in category_total.most_common():
    print(f"  {cat:<12} {n:>5}  ({len(category_users[cat])} users)")

print(f"\nNotable conversions:")
print(f"  Payments confirmed: {len(paid_events)} events")
print(f"  VPS provisioned:    {len(vps_provisions)} events")
print(f"  Hosting activated:  {len(hosting_provisions)} events")
print(f"  Domains registered: {len(domain_registrations)} events")

# ─── Now produce markdown report ─────────────────────────────────────────
md = []
md.append(f"# User Activity Report — Nomadly Bot (Production)")
md.append(f"**Window:** Friday 2026-06-05 00:00 → Monday 2026-06-08 07:20 UTC ({(datetime.fromisoformat(logs[-1]['timestamp'].replace('Z','+00:00')) - datetime.fromisoformat(logs[0]['timestamp'].replace('Z','+00:00'))).total_seconds()/3600:.1f} hours)")
md.append(f"**Source:** Railway `deploymentLogs` for `Nomadly-EMAIL-IVR` (deployment `54ae8489…`)")
md.append("")
md.append("## Headline numbers")
md.append("")
md.append(f"- **{len(logs):,}** total log lines pulled")
md.append(f"- **{inbound_count:,}** inbound user actions (commands, button taps, form fields)")
md.append(f"- **{len(user_actions)}** unique active users")
md.append(f"- **{len(new_users)}** brand-new users (received welcome bonus)")
md.append(f"- **{len(paid_events)}** payment-confirmation events")
md.append(f"- **{len(vps_provisions)}** VPS provisioned, **{len(hosting_provisions)}** hosting accounts created, **{len(domain_registrations)}** domains registered")
md.append("")

md.append("## Daily breakdown")
md.append("")
md.append("| Day | Unique users | Inbound actions |")
md.append("|-----|-------------:|----------------:|")
for day in sorted(daily_users):
    md.append(f"| {day} ({datetime.strptime(day,'%Y-%m-%d').strftime('%a')}) | {len(daily_users[day])} | {daily_inbound[day]} |")
md.append("")

md.append("## Activity by category")
md.append("")
md.append("| Category | Actions | Unique users | What it means |")
md.append("|----------|--------:|-------------:|---------------|")
CAT_DESC = {
    'cmd': 'Slash commands like `/start`, `/done`, `/help`',
    'nav': 'Back / Cancel button navigation',
    'ivr': 'Cloud-IVR flow: voice selection, templates, target numbers, campaign launch',
    'marketplace': 'Marketplace / deals / bank-log browsing',
    'support': 'Live support sessions',
    'wallet': 'Wallet (top-up, balance, history)',
    'domain': 'Bulletproof-domain shopping/registration',
    'hosting': 'Anti-red hosting menu / purchases',
    'vps': 'VPS browse / manage / purchase',
    'lang': 'Language selection',
    'confirm': '/yes /no confirmation prompts',
    'purchase': 'Plan / pricing selection',
    'product': 'Virtual phone / virtual card menus',
    'email': 'Email-blast service',
    'sms': 'SMS service',
    'other': 'Free-text answers (e.g., entered phone numbers, names, amounts)',
}
for cat, n in category_total.most_common():
    md.append(f"| {cat} | {n} | {len(category_users[cat])} | {CAT_DESC.get(cat,'')} |")
md.append("")

md.append("## Top 20 most active users")
md.append("")
md.append("| chatId | username | actions | top categories |")
md.append("|--------|----------|--------:|----------------|")
for uid, actions in sorted(user_actions.items(), key=lambda x: -len(x[1]))[:20]:
    uname = user_username.get(uid, '—')
    cats = Counter(a[3] for a in actions)
    top = ", ".join(f"{k}×{v}" for k,v in cats.most_common(4))
    md.append(f"| `{uid}` | @{uname} | {len(actions)} | {top} |")
md.append("")

md.append("## New users (received welcome bonus)")
md.append("")
if new_users:
    md.append("| chatId | actions in window |")
    md.append("|--------|------------------:|")
    for uid in sorted(new_users)[:30]:
        n = len(user_actions.get(uid, []))
        md.append(f"| `{uid}` | {n} |")
else:
    md.append("_None detected (welcome-bonus log line may have a different format)_")
md.append("")

md.append("## Conversion events (provisions & payments)")
md.append("")
md.append(f"### Payments confirmed: {len(paid_events)}")
for ts, cid, msg in paid_events[:25]:
    md.append(f"- `{ts[:19]}` `{cid or '?'}` — {msg}")
md.append("")
md.append(f"### VPS provisioned: {len(vps_provisions)}")
for ts, cid, msg in vps_provisions[:25]:
    md.append(f"- `{ts[:19]}` `{cid or '?'}` — {msg}")
md.append("")
md.append(f"### Hosting accounts activated: {len(hosting_provisions)}")
for ts, cid, msg in hosting_provisions[:25]:
    md.append(f"- `{ts[:19]}` `{cid or '?'}` — {msg}")
md.append("")
md.append(f"### Domains registered: {len(domain_registrations)}")
for ts, cid, msg in domain_registrations[:25]:
    md.append(f"- `{ts[:19]}` `{cid or '?'}` — {msg}")
md.append("")

# Top user deep-dives (top 5)
md.append("## Deep-dive: top 5 users — chronological activity")
md.append("")
for uid, actions in sorted(user_actions.items(), key=lambda x: -len(x[1]))[:5]:
    uname = user_username.get(uid, '—')
    md.append(f"### `{uid}` (@{uname}) — {len(actions)} actions")
    md.append("")
    # show every distinct first-of-the-hour action
    seen_hours = set()
    md.append("| Timestamp (UTC) | Category | Action |")
    md.append("|-----------------|----------|--------|")
    for ts, kind, action, cat, label in actions[:60]:
        safe = action[:80].replace("|", "\\|")
        md.append(f"| `{ts[:19]}` | {cat} | {safe} |")
    md.append("")

with open(OUT, "w") as f:
    f.write("\n".join(md))
print(f"\nFull report → {OUT}")
