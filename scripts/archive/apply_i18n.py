#!/usr/bin/env python3
"""
Nomadly i18n Apply Script
1. Adds new translation keys to all 4 language files
2. Replaces hardcoded strings in _index.js with translation() calls
3. Replaces hardcoded strings in service files
"""
import re
import json
import copy

# Read the source file
with open('/app/js/_index.js', 'r') as f:
    lines = f.readlines()

# Read the entries data
with open('/tmp/i18n_entries.json', 'r') as f:
    data = json.load(f)

##############################################################################
# STEP 1: Build replacement map from extracted entries
##############################################################################

replacements = {}  # line_number -> (key, original_pattern, replacement_pattern)

for prefix, section_data in data.items():
    for entry in section_data['entries']:
        line_num = entry['line']
        text = entry['text']
        key = entry['key']
        has_vars = entry['has_vars']
        full_line = entry['full_line']
        
        if has_vars:
            # Extract the full template literal from the actual line
            # We need to find the original ${...} expressions
            vars_in_text = re.findall(r'\$\{([^}]+)\}', text)
            if vars_in_text:
                args = ', '.join(vars_in_text)
                replacements[line_num] = {
                    'key': f't.{key}',
                    'has_vars': True,
                    'args': args,
                    'var_count': len(vars_in_text),
                }
        else:
            replacements[line_num] = {
                'key': f't.{key}',
                'has_vars': False,
                'args': '',
                'var_count': 0,
            }

##############################################################################
# STEP 2: Apply replacements to _index.js
##############################################################################

modified_lines = list(lines)  # Copy
changes_made = 0

for line_num, repl in sorted(replacements.items()):
    idx = line_num - 1
    if idx >= len(modified_lines):
        continue
    
    original = modified_lines[idx]
    
    # Determine if this line uses send() or sendMessage()
    is_send_message = 'sendMessage(chatId,' in original
    func_name = 'sendMessage' if is_send_message else 'send'
    
    # Find the send/sendMessage pattern and replace the string argument with trans()
    # Pattern: send(chatId, `...` or send(chatId, '...'
    # We need to replace the string with trans('t.key', arg1, arg2, ...)
    
    if repl['has_vars']:
        # For dynamic strings with variables: trans('t.key', var1, var2, ...)
        trans_call = f"trans('{repl['key']}', {repl['args']})"
    else:
        # For simple strings: trans('t.key')
        trans_call = f"trans('{repl['key']}')"
    
    # Try to replace the string argument in the send call
    # Match: send(chatId, `...`) or send(chatId, '...')
    # We need to be careful with the rest of the line (options argument, etc.)
    
    # Strategy: Find the start of the string arg, replace just that part
    # This is complex because template literals can span the line
    
    # Simple approach: if the line has a complete string, replace it
    # For backtick strings
    m = re.match(r'^(\s*(?:return\s+)?(?:send|sendMessage)\(chatId,\s*)`([^`]*)`(.*)$', original)
    if m:
        prefix_part = m.group(1)
        # rest includes the closing paren and options
        rest = m.group(3)
        new_line = f"{prefix_part}{trans_call}{rest}\n"
        modified_lines[idx] = new_line
        changes_made += 1
        continue
    
    # For single-quote strings
    m = re.match(r"^(\s*(?:return\s+)?(?:send|sendMessage)\(chatId,\s*)'([^']*)'(.*)$", original)
    if m:
        prefix_part = m.group(1)
        rest = m.group(3)
        new_line = f"{prefix_part}{trans_call}{rest}\n"
        modified_lines[idx] = new_line
        changes_made += 1
        continue
    
    # Skip complex multi-line patterns for now

print(f"Applied {changes_made} replacements out of {len(replacements)} planned")
print(f"Skipped {len(replacements) - changes_made} (multi-line or complex patterns)")

# Write the modified file
with open('/app/js/_index.js', 'w') as f:
    f.writelines(modified_lines)

print("Updated /app/js/_index.js")

##############################################################################
# STEP 3: Generate translation key blocks for language files
##############################################################################

def generate_en_keys(data):
    """Generate EN translation key entries"""
    blocks = []
    for prefix, section_data in data.items():
        section_name = section_data['name']
        entries = section_data['entries']
        if not entries:
            continue
        
        blocks.append(f'\n // === {section_name} ===')
        for entry in entries:
            key = entry['key']
            text = entry['text']
            has_vars = entry['has_vars']
            
            if has_vars:
                vars_list = re.findall(r'\$\{([^}]+)\}', text)
                # Create param names
                param_names = []
                seen = set()
                for v in vars_list:
                    pname = v.split('.')[-1].split('[')[0].split('(')[0].split('|')[0].split('?')[0].strip()
                    pname = re.sub(r'[^\w]', '', pname)
                    if not pname or pname in seen:
                        pname = f'v{len(param_names)}'
                    seen.add(pname)
                    param_names.append(pname)
                
                params = ', '.join(param_names)
                # Replace original vars with param names
                en_text = text
                for v, p in zip(vars_list, param_names):
                    en_text = en_text.replace('${' + v + '}', '${' + p + '}', 1)
                
                blocks.append(f' {key}: ({params}) => `{en_text}`,')
            else:
                # Escape single quotes
                safe_text = text.replace("'", "\\'")
                blocks.append(f" {key}: '{safe_text}',")
    
    return '\n'.join(blocks)

en_block = generate_en_keys(data)

# Save the key blocks
with open('/tmp/i18n_en_block.js', 'w') as f:
    f.write(en_block)

print(f"\nGenerated EN key block ({len(en_block)} chars)")
print("Saved to /tmp/i18n_en_block.js")
print("\nDone! Now need to insert key blocks into language files.")
