#!/usr/bin/env python3
"""
Generate voice service translation keys with proper naming
"""

import json
import re

# Load extracted strings
with open('/app/scripts/voice_service_extracted.json', 'r') as f:
    strings = json.load(f)

# Create properly named keys for voice service
vs_keys = {}

key_mapping = {}

for i, item in enumerate(strings, 1):
    content = item['content']
    line = item['line']
    
    # Create semantic keys based on content analysis
    if 'Call Disconnected' in content and 'auto-routed' in content:
        key = 'callDisconnectedAutoRouted'
    elif 'Call Disconnected' in content and 'Wallet insufficient' in content:
        key = 'callDisconnectedWalletInsufficient'
    elif 'Call Disconnected' in content and 'exhausted' in content:
        key = 'callDisconnectedWalletExhausted'
    elif 'Outbound Call Failed' in content and 'routing failed' in content:
        key = 'outboundCallFailedRouting'
    elif 'Outbound Call Failed' in content and 'temporarily unavailable' in content:
        key = 'outboundCallFailedTempUnavailable'
    elif 'Outbound Call Failed' in content:
        key = 'outboundCallFailed'
    elif 'Plan Minutes Exhausted' in content:
        key = 'planMinutesExhausted'
    elif 'Overage Active' in content:
        key = 'overageActive'
    elif 'Overage</b>:' in content:
        key = 'overageCharge'
    elif '${callType}</b>:' in content:
        key = 'callTypeCharge'
    elif 'Transfer Ended' in content:
        key = 'transferEnded'
    elif 'Transfer Failed' in content:
        key = 'transferFailed'
    elif 'Transfer Timeout' in content:
        key = 'transferTimeout'
    elif 'Transfer Connected' in content:
        key = 'transferConnected'
    elif 'Orphaned Number Alert' in content:
        key = 'orphanedNumberAlert'
    elif 'Incoming Call Blocked' in content:
        key = 'incomingCallBlockedWalletEmpty'
    elif 'Call Ended' in content and 'Plan minutes' in content:
        key = 'callEndedPlanWalletExhausted'
    elif 'Incoming Call' in content:
        key = 'incomingCall'
    elif 'Outbound Calling Locked' in content:
        key = 'outboundCallingLocked'
    elif 'Test Calls Expired' in content:
        key = 'testCallsExpired'
    elif 'Outbound Call Blocked' in content:
        key = 'outboundCallBlocked'
    elif 'SIP Call Blocked' in content:
        key = 'sipCallBlocked'
    elif 'Free SIP Test Call' in content:
        key = 'freeSipTestCall'
    elif 'SIP Outbound Call' in content and 'Rate:' in content:
        key = 'sipOutboundCallWithRate'
    elif 'SIP Outbound Call' in content:
        key = 'sipOutboundCall'
    elif 'Low Balance' in content and 'fwd' in content and 'IVR' in content:
        key = 'lowBalanceIvrForward'
    elif 'Low Balance' in content and 'fwd' in content:
        key = 'lowBalanceForward'
    elif 'Forwarding Blocked' in content:
        key = 'forwardingBlocked'
    elif 'IVR Forward Blocked' in content:
        key = 'ivrForwardBlocked'
    elif 'SIP Call Ended' in content and 'auto-routed' in content:
        key = 'sipCallEndedAutoRouted'
    elif 'IVR Call Ended' in content:
        key = 'ivrCallEndedWalletExhausted'
    elif 'Call not connected' in content:
        key = 'callNotConnected'
    else:
        # Fallback: create from suggestion
        key = 'msg' + str(i)
    
    vs_keys[key] = content
    key_mapping[line] = key

# Print the JavaScript object format
print("// Voice Service (vs) translation keys")
print("const vs = {")

for key, value in vs_keys.items():
    # Format the value as a template literal function
    # Identify all ${...} placeholders
    placeholders = re.findall(r'\$\{([^}]+)\}', value)
    
    if placeholders:
        # Create function parameters from placeholders
        # Remove duplicates while preserving order
        seen = set()
        unique_params = []
        for p in placeholders:
            if p not in seen:
                seen.add(p)
                unique_params.append(p)
        
        params = ', '.join(unique_params)
        print(f"  {key}: ({params}) => `{value}`,")
    else:
        # No placeholders, just a string
        print(f"  {key}: `{value}`,")

print("}")

print("\n\n// ===== KEY MAPPING (line -> key) =====")
print(json.dumps(key_mapping, indent=2))

# Save mapping for replacement script
with open('/app/scripts/vs_key_mapping.json', 'w') as f:
    json.dump(key_mapping, f, indent=2)

with open('/app/scripts/vs_keys.json', 'w') as f:
    json.dump(vs_keys, f, indent=2, ensure_ascii=False)

print("\n✅ Saved key mapping to /app/scripts/vs_key_mapping.json")
print("✅ Saved vs keys to /app/scripts/vs_keys.json")
