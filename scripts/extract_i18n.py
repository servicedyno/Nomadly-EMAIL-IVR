#!/usr/bin/env python3
"""
Nomadly i18n Gap Fixer - Extracts hardcoded strings and generates translation entries
"""
import re
import json

with open('/app/js/_index.js', 'r') as f:
    content = f.read()
    lines = content.split('\n')

# Define sections
sections = {
    'cp': (14000, 20000, 'Cloud Phone/IVR'),
    'vps': (9000, 13000, 'VPS/RDP'),
    'ev': (8400, 9000, 'Email Validation'),
    'host': (7000, 8400, 'Hosting'),
    'sms': (20000, 21900, 'SMS Campaign'),
    'wlt': (3500, 5000, 'Wallet'),
    'dom': (5300, 7000, 'Domains'),
    'ld': (5000, 5300, 'Leads'),
    'dns': (13000, 14000, 'DNS'),
    'wh': (23500, 28500, 'Webhooks'),
    'util': (21900, 23500, 'Utility'),
    'adm': (3000, 3500, 'Admin'),
}

results = {}
total = 0

for prefix, (start, end, name) in sections.items():
    entries = []
    counter = 0
    for i in range(start - 1, min(end, len(lines))):
        line = lines[i]
        stripped = line.strip()
        
        # Skip comments, translation() calls, console.log, catch blocks
        if stripped.startswith('//') or 'translation(' in line or 'console.' in line:
            continue
        if '.catch(' in line and 'send(' not in line[:line.index('.catch(')]:
            continue
            
        # Match send(chatId, `...`) patterns
        for pattern in [
            r"send\(chatId,\s*`([^`]+)`",
            r"send\(chatId,\s*'([^']+)'",
            r'sendMessage\(chatId,\s*`([^`]+)`',
        ]:
            m = re.search(pattern, line)
            if m and len(m.group(1)) >= 10:
                text = m.group(1)
                has_vars = '${' in text
                counter += 1
                entries.append({
                    'line': i + 1,
                    'text': text[:200],
                    'has_vars': has_vars,
                    'key': f'{prefix}_{counter}',
                    'full_line': line.rstrip(),
                })
    
    results[prefix] = {
        'name': name,
        'count': len(entries),
        'entries': entries,
    }
    total += len(entries)

print(f"Total hardcoded strings extracted: {total}\n")
for prefix, data in results.items():
    simple = sum(1 for e in data['entries'] if not e['has_vars'])
    dynamic = sum(1 for e in data['entries'] if e['has_vars'])
    print(f"{data['name']:25s}: {data['count']:4d} ({simple} simple, {dynamic} dynamic)")

# Save for further processing
with open('/tmp/i18n_entries.json', 'w') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
    
print(f"\nSaved to /tmp/i18n_entries.json")
