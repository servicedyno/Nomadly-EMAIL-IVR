#!/usr/bin/env python3
"""
Extract ALL hardcoded strings from voice-service.js for i18n
"""

import re
import json

def extract_message_strings(filepath):
    """Extract hardcoded template literal strings from sendMessage calls"""
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    strings_to_translate = []
    
    # Pattern: Find all template literals in sendMessage calls
    # Match: sendMessage(chatId, `...`, ...)
    pattern = r'(?:_bot\??\.)?sendMessage\([^,]+,\s*`([^`]+)`'
    
    matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)
    
    for match in matches:
        msg_content = match.group(1).strip()
        
        # Skip if it's already using translation or contains only variables
        if 'trans(' in msg_content or '_trans(' in msg_content:
            continue
        if msg_content.startswith('${') and msg_content.endswith('}'):
            continue
            
        # Find the line number
        line_num = content[:match.start()].count('\n') + 1
        
        # Create a safe key name from the content
        # Take first few words, remove HTML tags, emojis, special chars
        key_preview = re.sub(r'<[^>]+>', '', msg_content)[:50]
        key_preview = re.sub(r'[^\w\s]', '', key_preview).strip()
        key_preview = '_'.join(key_preview.split()[:5]).lower()
        
        strings_to_translate.append({
            'line': line_num,
            'content': msg_content,
            'key_suggestion': key_preview,
            'full_match': match.group(0)[:100]
        })
    
    return strings_to_translate

if __name__ == '__main__':
    filepath = '/app/js/voice-service.js'
    strings = extract_message_strings(filepath)
    
    # Deduplicate by content
    seen = set()
    unique_strings = []
    for s in strings:
        if s['content'] not in seen:
            seen.add(s['content'])
            unique_strings.append(s)
    
    print(f"Found {len(unique_strings)} unique hardcoded message strings:")
    print("=" * 80)
    
    for i, s in enumerate(unique_strings, 1):
        print(f"\n{i}. Line {s['line']}")
        print(f"   Content: {s['content'][:80]}...")
        print(f"   Suggested key: vs.{s['key_suggestion']}")
    
    # Save to JSON
    with open('/app/scripts/voice_service_extracted.json', 'w') as f:
        json.dump(unique_strings, f, indent=2, ensure_ascii=False)
    
    print(f"\n\n✅ Saved {len(unique_strings)} unique strings to /app/scripts/voice_service_extracted.json")
