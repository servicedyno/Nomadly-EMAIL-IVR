#!/usr/bin/env python3
"""
Nomadly i18n Apply Script v2
Uses proper template literal parsing to avoid syntax errors.
"""
import re
import json

with open('/app/js/_index.js', 'r') as f:
    content = f.read()
    lines = content.split('\n')

with open('/tmp/i18n_entries.json', 'r') as f:
    data = json.load(f)

def find_template_literal_end(text, start):
    """Find the end of a template literal starting at `start` (which is the opening backtick)."""
    i = start + 1  # skip opening backtick
    depth = 0
    while i < len(text):
        c = text[i]
        if c == '\\':
            i += 2  # skip escaped char
            continue
        if depth == 0 and c == '`':
            return i  # found closing backtick
        if c == '$' and i + 1 < len(text) and text[i + 1] == '{':
            depth += 1
            i += 2
            continue
        if c == '}' and depth > 0:
            depth -= 1
            i += 1
            continue
        # Handle nested template literals inside ${}
        if depth > 0 and c == '`':
            nested_end = find_template_literal_end(text, i)
            if nested_end is not None:
                i = nested_end + 1
                continue
        i += 1
    return None

def find_string_arg_in_send(line, func='send'):
    """Find the string argument in a send(chatId, ...) or sendMessage(chatId, ...) call.
    Returns (start_of_string, end_of_string, is_template, full_match) or None.
    """
    # Find the function call
    pattern = f'{func}(chatId,'
    idx = line.find(pattern)
    if idx == -1:
        return None
    
    # Skip past 'send(chatId, ' to find the string start
    after_comma = idx + len(pattern)
    # Skip whitespace
    while after_comma < len(line) and line[after_comma] in ' \t':
        after_comma += 1
    
    if after_comma >= len(line):
        return None
    
    char = line[after_comma]
    
    if char == '`':
        # Template literal
        end = find_template_literal_end(line, after_comma)
        if end is not None:
            return (after_comma, end + 1, True, line[after_comma:end + 1])
    elif char == "'":
        # Single-quoted string
        i = after_comma + 1
        while i < len(line):
            if line[i] == '\\':
                i += 2
                continue
            if line[i] == "'":
                return (after_comma, i + 1, False, line[after_comma:i + 1])
            i += 1
    
    return None

# Build replacement targets
replacements = {}
for prefix, section_data in data.items():
    for entry in section_data['entries']:
        line_num = entry['line']
        key = entry['key']
        has_vars = entry['has_vars']
        text = entry['text']
        
        if has_vars:
            vars_list = re.findall(r'\$\{([^}]+)\}', text)
            replacements[line_num] = {
                'key': f't.{key}',
                'has_vars': True,
                'var_expressions': vars_list,
            }
        else:
            replacements[line_num] = {
                'key': f't.{key}',
                'has_vars': False,
                'var_expressions': [],
            }

# Apply replacements
modified = list(lines)
success = 0
skipped = 0
errors = []

for line_num, repl in sorted(replacements.items()):
    idx = line_num - 1
    if idx >= len(modified):
        skipped += 1
        continue
    
    original_line = modified[idx]
    
    # Try both send and sendMessage
    result = find_string_arg_in_send(original_line, 'send')
    if result is None:
        result = find_string_arg_in_send(original_line, 'sendMessage')
    
    if result is None:
        skipped += 1
        errors.append(f"L{line_num}: Could not parse string arg")
        continue
    
    start, end, is_template, matched_str = result
    
    # Build the replacement trans() call
    if repl['has_vars']:
        # Need to extract the ACTUAL variable expressions from the matched string
        actual_vars = re.findall(r'\$\{([^}]+)\}', matched_str)
        if actual_vars:
            args = ', '.join(actual_vars)
            trans_call = f"trans('{repl['key']}', {args})"
        else:
            trans_call = f"trans('{repl['key']}')"
    else:
        trans_call = f"trans('{repl['key']}')"
    
    # Replace: keep everything before the string and after the string
    new_line = original_line[:start] + trans_call + original_line[end:]
    modified[idx] = new_line
    success += 1

print(f"Applied: {success}/{len(replacements)}")
print(f"Skipped: {skipped}")
if errors:
    print(f"\nFirst 10 errors:")
    for e in errors[:10]:
        print(f"  {e}")

# Write modified file
with open('/app/js/_index.js', 'w') as f:
    f.write('\n'.join(modified))

# Verify syntax
import subprocess
result = subprocess.run(['node', '-c', '/app/js/_index.js'], capture_output=True, text=True)
if result.returncode == 0:
    print("\n✅ Syntax check PASSED")
else:
    print(f"\n❌ Syntax error detected:")
    print(result.stderr[:500])
    # Revert
    subprocess.run(['git', 'checkout', '--', 'js/_index.js'], cwd='/app')
    print("⚠️ Reverted to original file")
