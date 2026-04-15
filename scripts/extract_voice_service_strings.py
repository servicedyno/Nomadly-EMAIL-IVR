#!/usr/bin/env python3
"""
Extract hardcoded user-facing strings from voice-service.js
Focuses on:
- sendMessage calls with hardcoded strings
- Template literals with user-facing messages
- notifyUser, logEvent calls with string literals
"""

import re
import json

def extract_strings_from_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    strings = []
    line_num = 1
    
    # Split by lines to track line numbers
    lines = content.split('\n')
    
    # Pattern 1: sendMessage with template literals or strings
    # Looking for sendMessage(chatId, `...` or "..."
    for i, line in enumerate(lines, 1):
        # Skip comments
        if line.strip().startswith('//'):
            continue
            
        # Look for sendMessage patterns
        if 'sendMessage' in line or 'notifyUser' in line:
            # Store this line for analysis
            strings.append({
                'line': i,
                'content': line.strip(),
                'type': 'message_call'
            })
    
    return strings

if __name__ == '__main__':
    filepath = '/app/js/voice-service.js'
    strings = extract_strings_from_file(filepath)
    
    print(f"Found {len(strings)} potential hardcoded string locations:")
    print("=" * 80)
    
    for s in strings:
        print(f"Line {s['line']}: {s['content'][:120]}")
    
    # Save to JSON for further processing
    with open('/app/scripts/voice_service_strings.json', 'w') as f:
        json.dump(strings, f, indent=2)
    
    print(f"\n✅ Saved to /app/scripts/voice_service_strings.json")
