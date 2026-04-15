#!/usr/bin/env python3
"""
Extract FULL hardcoded strings (no truncation) from the original _index.js.
Uses proper template literal parsing.
"""
import re
import json

with open('/tmp/original_index.js', 'r') as f:
    original_content = f.read()
    original_lines = original_content.split('\n')

# Also read the MODIFIED _index.js to know which lines have trans() calls
with open('/app/js/_index.js', 'r') as f:
    modified_content = f.read()
    modified_lines = modified_content.split('\n')

def find_template_literal_end(text, start):
    """Find the end of a template literal."""
    i = start + 1
    depth = 0
    while i < len(text):
        c = text[i]
        if c == '\\':
            i += 2
            continue
        if depth == 0 and c == '`':
            return i
        if c == '$' and i + 1 < len(text) and text[i + 1] == '{':
            depth += 1
            i += 2
            continue
        if depth > 0:
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            elif c == '`':
                nested_end = find_template_literal_end(text, i)
                if nested_end is not None:
                    i = nested_end + 1
                    continue
                else:
                    return None
            elif c in ("'", '"'):
                quote = c
                i += 1
                while i < len(text) and text[i] != quote:
                    if text[i] == '\\':
                        i += 1
                    i += 1
        i += 1
    return None

def find_string_arg_in_send(line):
    """Find the string argument in a send(chatId, ...) call. Returns full matched string."""
    for func in ['sendMessage(chatId,', 'send(chatId,']:
        idx = line.find(func)
        if idx == -1:
            continue
        
        after_comma = idx + len(func)
        while after_comma < len(line) and line[after_comma] in ' \t':
            after_comma += 1
        
        if after_comma >= len(line):
            continue
        
        char = line[after_comma]
        
        if char == '`':
            end = find_template_literal_end(line, after_comma)
            if end is not None:
                return line[after_comma + 1:end]  # Return content without backticks
        elif char == "'":
            i = after_comma + 1
            while i < len(line):
                if line[i] == '\\':
                    i += 2
                    continue
                if line[i] == "'":
                    return line[after_comma + 1:i]  # Return content without quotes
                i += 1
    
    return None

def has_nested_template(text):
    """Check if text contains nested template literals"""
    depth = 0
    i = 0
    while i < len(text):
        c = text[i]
        if c == '\\':
            i += 2
            continue
        if c == '$' and i + 1 < len(text) and text[i + 1] == '{':
            depth += 1
            i += 2
            continue
        if depth > 0 and c == '`':
            return True
        if c == '{' and depth > 0:
            depth += 1
        elif c == '}' and depth > 0:
            depth -= 1
        i += 1
    return False

def extract_top_level_vars(text):
    """Extract only TOP-LEVEL ${} expressions."""
    vars_found = []
    i = 0
    while i < len(text):
        c = text[i]
        if c == '\\':
            i += 2
            continue
        if c == '$' and i + 1 < len(text) and text[i + 1] == '{':
            brace_depth = 1
            j = i + 2
            while j < len(text) and brace_depth > 0:
                ch = text[j]
                if ch == '\\':
                    j += 2
                    continue
                if ch == '{':
                    brace_depth += 1
                elif ch == '}':
                    brace_depth -= 1
                elif ch == '`':
                    end = find_template_literal_end(text, j)
                    if end:
                        j = end + 1
                        continue
                elif ch in ("'", '"'):
                    q = ch
                    j += 1
                    while j < len(text) and text[j] != q:
                        if text[j] == '\\':
                            j += 1
                        j += 1
                j += 1
            if brace_depth == 0:
                expr = text[i + 2:j - 1]
                vars_found.append(expr)
                i = j
                continue
        i += 1
    return vars_found

# Find all lines in modified file that have trans() calls
trans_line_keys = {}  # line_number -> key
for i, line in enumerate(modified_lines):
    m = re.search(r"trans\('t\.(\w+)'", line)
    if m:
        trans_line_keys[i + 1] = m.group(1)

print(f"Found {len(trans_line_keys)} trans() calls in modified _index.js")

# Now extract the FULL original text for each of those lines
entries = {}  # key -> full_text
for line_num, key in trans_line_keys.items():
    idx = line_num - 1
    if idx >= len(original_lines):
        continue
    
    full_text = find_string_arg_in_send(original_lines[idx])
    if full_text:
        is_dynamic = '${' in full_text
        is_nested = has_nested_template(full_text)
        entries[key] = {
            'text': full_text,
            'has_vars': is_dynamic,
            'has_nested': is_nested,
            'line': line_num,
        }

print(f"Extracted {len(entries)} full texts")
simple = sum(1 for e in entries.values() if not e['has_vars'])
dynamic = sum(1 for e in entries.values() if e['has_vars'] and not e['has_nested'])
nested = sum(1 for e in entries.values() if e['has_nested'])
print(f"  Simple: {simple}, Dynamic: {dynamic}, Nested: {nested}")

# Generate the EN translation block
en_block_lines = []
current_section = None

# Group by prefix
from collections import defaultdict
by_prefix = defaultdict(list)
for key, entry in sorted(entries.items()):
    prefix = key.split('_')[0]
    by_prefix[prefix].append((key, entry))

section_names = {
    'cp': 'Cloud Phone/IVR',
    'vps': 'VPS/RDP',
    'ev': 'Email Validation',
    'host': 'Hosting',
    'sms': 'SMS Campaign',
    'wlt': 'Wallet',
    'dom': 'Domains',
    'ld': 'Leads',
    'dns': 'DNS',
    'wh': 'Webhooks',
    'util': 'Utility',
    'adm': 'Admin',
}

for prefix in ['cp', 'vps', 'ev', 'host', 'sms', 'wlt', 'dom', 'ld', 'dns', 'wh', 'util', 'adm']:
    if prefix not in by_prefix:
        continue
    items = by_prefix[prefix]
    en_block_lines.append(f'\n // === {section_names.get(prefix, prefix)} ===')
    
    for key, entry in items:
        text = entry['text']
        has_vars = entry['has_vars']
        
        if has_vars:
            vars_list = extract_top_level_vars(text)
            param_names = []
            seen = set()
            for v in vars_list:
                pname = v.split('.')[-1].split('[')[0].split('(')[0].split('|')[0].split('?')[0].strip()
                pname = re.sub(r'[^\w]', '', pname)
                if not pname or pname in seen or pname.isdigit() or len(pname) > 30:
                    pname = f'v{len(param_names)}'
                seen.add(pname)
                param_names.append(pname)
            
            params = ', '.join(param_names)
            en_text = text
            for v, p in zip(vars_list, param_names):
                en_text = en_text.replace('${' + v + '}', '${' + p + '}', 1)
            
            en_block_lines.append(f' {key}: ({params}) => `{en_text}`,')
        else:
            safe_text = text.replace("\\", "\\\\").replace("'", "\\'")
            en_block_lines.append(f" {key}: '{safe_text}',")

en_block = '\n'.join(en_block_lines)

with open('/tmp/i18n_en_block_v2.js', 'w') as f:
    f.write(en_block)

# Verify the block is valid JS by wrapping it
test_code = f"const test = {{{en_block}\n}}"
with open('/tmp/test_block.js', 'w') as f:
    f.write(test_code)

import subprocess
result = subprocess.run(['node', '-c', '/tmp/test_block.js'], capture_output=True, text=True)
if result.returncode == 0:
    print("\n✅ EN block syntax OK")
else:
    print(f"\n❌ EN block syntax error: {result.stderr[:300]}")

print(f"\nEN block: {len(en_block_lines)} lines, {len(en_block)} chars")
print("Saved to /tmp/i18n_en_block_v2.js")

# Also save the full entries data for FR/HI/ZH translation
with open('/tmp/i18n_full_entries.json', 'w') as f:
    json.dump(entries, f, indent=2, ensure_ascii=False)
print(f"Saved full entries to /tmp/i18n_full_entries.json")
