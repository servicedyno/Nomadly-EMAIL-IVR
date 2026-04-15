#!/usr/bin/env python3
"""
Nomadly i18n Apply Script v3
Properly handles nested template literals by skipping complex cases.
"""
import re
import json
import subprocess

with open('/app/js/_index.js', 'r') as f:
    content = f.read()
    lines = content.split('\n')

with open('/tmp/i18n_entries.json', 'r') as f:
    data = json.load(f)

def find_template_literal_end(text, start):
    """Find the end of a template literal starting at position `start` (the opening backtick).
    Properly handles nested ${} and nested template literals."""
    i = start + 1
    depth = 0  # depth of ${} nesting
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
                # Nested template literal inside ${}
                nested_end = find_template_literal_end(text, i)
                if nested_end is not None:
                    i = nested_end + 1
                    continue
                else:
                    return None  # Malformed
            elif c == "'" or c == '"':
                # Skip string literals inside ${}
                quote = c
                i += 1
                while i < len(text) and text[i] != quote:
                    if text[i] == '\\':
                        i += 1
                    i += 1
        i += 1
    return None

def has_nested_template(template_str):
    """Check if a template literal contains nested template literals (backticks inside ${})"""
    depth = 0
    i = 1  # skip opening backtick
    while i < len(template_str) - 1:  # skip closing backtick
        c = template_str[i]
        if c == '\\':
            i += 2
            continue
        if c == '$' and i + 1 < len(template_str) and template_str[i + 1] == '{':
            depth += 1
            i += 2
            continue
        if depth > 0 and c == '`':
            return True  # Found nested template!
        if c == '{' and depth > 0:
            depth += 1
        elif c == '}' and depth > 0:
            depth -= 1
        i += 1
    return False

def extract_top_level_vars(template_str):
    """Extract only TOP-LEVEL ${} variable expressions (not those inside nested templates)."""
    vars_found = []
    i = 1  # skip opening backtick
    while i < len(template_str) - 1:
        c = template_str[i]
        if c == '\\':
            i += 2
            continue
        if c == '$' and i + 1 < len(template_str) and template_str[i + 1] == '{':
            # Found ${, now find the matching }
            brace_depth = 1
            j = i + 2
            while j < len(template_str) and brace_depth > 0:
                ch = template_str[j]
                if ch == '\\':
                    j += 2
                    continue
                if ch == '{':
                    brace_depth += 1
                elif ch == '}':
                    brace_depth -= 1
                elif ch == '`':
                    # Skip nested template
                    end = find_template_literal_end(template_str, j)
                    if end:
                        j = end + 1
                        continue
                elif ch in ("'", '"'):
                    # Skip string in expression
                    q = ch
                    j += 1
                    while j < len(template_str) and template_str[j] != q:
                        if template_str[j] == '\\':
                            j += 1
                        j += 1
                j += 1
            
            if brace_depth == 0:
                expr = template_str[i + 2:j - 1]
                vars_found.append(expr)
                i = j
                continue
        i += 1
    return vars_found

def find_string_arg_in_send(line):
    """Find the string argument in a send(chatId, ...) or sendMessage(chatId, ...) call."""
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
                return (after_comma, end + 1, True, line[after_comma:end + 1])
        elif char == "'":
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
        replacements[line_num] = {
            'key': f't.{key}',
            'has_vars': has_vars,
        }

# Apply replacements  
modified = list(lines)
success = 0
skipped_nested = 0
skipped_parse = 0
skipped_other = 0

for line_num, repl in sorted(replacements.items()):
    idx = line_num - 1
    if idx >= len(modified):
        skipped_other += 1
        continue
    
    original_line = modified[idx]
    result = find_string_arg_in_send(original_line)
    
    if result is None:
        skipped_parse += 1
        continue
    
    start, end, is_template, matched_str = result
    
    if is_template and has_nested_template(matched_str):
        # Skip lines with nested template literals - too complex for safe replacement
        skipped_nested += 1
        continue
    
    if repl['has_vars'] and is_template:
        actual_vars = extract_top_level_vars(matched_str)
        if actual_vars:
            args = ', '.join(actual_vars)
            trans_call = f"trans('{repl['key']}', {args})"
        else:
            trans_call = f"trans('{repl['key']}')"
    else:
        trans_call = f"trans('{repl['key']}')"
    
    new_line = original_line[:start] + trans_call + original_line[end:]
    modified[idx] = new_line
    success += 1

print(f"Applied: {success}/{len(replacements)}")
print(f"Skipped (nested templates): {skipped_nested}")
print(f"Skipped (parse failed): {skipped_parse}")
print(f"Skipped (other): {skipped_other}")

# Write modified file
with open('/app/js/_index.js', 'w') as f:
    f.write('\n'.join(modified))

# Verify syntax
result = subprocess.run(['node', '-c', '/app/js/_index.js'], capture_output=True, text=True)
if result.returncode == 0:
    print("\n✅ Syntax check PASSED")
else:
    print(f"\n❌ Syntax error detected:")
    print(result.stderr[:500])
    # Revert
    subprocess.run(['git', 'checkout', '--', 'js/_index.js'], cwd='/app')
    print("⚠️ Reverted to original file")
