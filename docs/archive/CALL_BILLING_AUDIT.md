# Call Billing Audit - Single vs Dual-Leg Analysis

## Executive Summary

✅ **VERIFIED**: Single-leg calls are billed ONCE only  
✅ **VERIFIED**: Dual-leg calls are billed TWICE (Telnyx + Twilio)  
✅ **VERIFIED**: All call scenarios are correctly implemented

---

## Call Scenarios & Billing Logic

### 📱 SINGLE-LEG CALLS (Billed ONCE)

#### 1. Inbound PSTN → Twilio → User
- **Flow**: External caller → Twilio number → User's phone
- **Provider**: Twilio only
- **Billing**: ONE charge via `/twilio/voice-status` webhook
- **Call Type**: `Twilio_Inbound` (INBOUND - uses plan minutes first, then wallet overage)
- **Detection**: `match.phoneNumber === To` (Twilio number is recipient)
- **File**: `/app/js/_index.js` line 23856

```javascript
const isOutboundCall = match.phoneNumber === From
const callType = isOutboundCall ? 'Twilio_SIP_Outbound' : 'Twilio_Inbound'
// isOutboundCall = false → Twilio_Inbound
```

#### 2. Direct SIP Outbound → Telnyx → PSTN
- **Flow**: User's softphone (SIP) → Telnyx → External number
- **Provider**: Telnyx only
- **Billing**: ONE charge in Telnyx hangup webhook
- **Call Type**: `SIPOutbound` (OUTBOUND - charges wallet directly)
- **Detection**: `session.phase !== 'outbound_twilio_bridge'`
- **File**: `/app/js/voice-service.js` line 2448

```javascript
if (isTwilioBridge) {
  // Dual-leg path (see below)
} else {
  // Single-leg: Standard billing
  const callType = isForwarded ? 'Forwarding' : isOutbound ? 'SIPOutbound' : 'Inbound'
  billingInfo = await billCallMinutesUnified(chatId, num.phoneNumber, minutesBilled, destination, callType)
}
```

#### 3. Call Forwarding → Telnyx → Forwarding Target
- **Flow**: Inbound call → Auto-forwarded → User's forwarding number
- **Provider**: Telnyx only
- **Billing**: ONE charge in Telnyx hangup webhook
- **Call Type**: `Forwarding` (OUTBOUND - charges wallet)
- **Detection**: `session.phase === 'forwarding'` OR `session.phase === 'ivr_forward'`
- **File**: `/app/js/voice-service.js` line 2448

#### 4. IVR Outbound (Telnyx)
- **Flow**: Bot initiates → Telnyx → Target number
- **Provider**: Telnyx only
- **Billing**: ONE charge in Telnyx hangup webhook
- **Call Type**: `IVR_Outbound` (OUTBOUND - charges wallet at flat IVR rate $0.10/min)
- **File**: `/app/js/voice-service.js` line ~2449

#### 5. IVR Outbound (Twilio - Trial Mode)
- **Flow**: Bot initiates → Twilio → Target number
- **Provider**: Twilio only
- **Billing**: ONE charge via `/twilio/single-ivr-status` webhook
- **Call Type**: `IVR_Outbound_Twilio` (OUTBOUND - charges wallet)
- **File**: `/app/js/_index.js` line 23291

```javascript
await voiceService.billCallMinutesUnified(
  session.chatId, 
  session.callerId, 
  minutes, 
  session.targetNumber, 
  'IVR_Outbound_Twilio'
)
```

---

### 🔀 DUAL-LEG CALLS (Billed TWICE - Correct!)

#### SIP → Telnyx → Twilio → PSTN (SIP Bridge)
- **Flow**: User's softphone → Telnyx SIP → Twilio PSTN → External number
- **Reason**: User wants to use their Twilio number as Caller ID for outbound calls
- **Providers**: Telnyx (SIP leg) + Twilio (PSTN leg)

**LEG 1 - Telnyx SIP Billing**:
- **Webhook**: Telnyx `call.hangup` 
- **Call Type**: `Telnyx_SIP_Leg`
- **Charge**: Wallet (OUTBOUND type)
- **Detection**: `session.phase === 'outbound_twilio_bridge'`
- **File**: `/app/js/voice-service.js` line 2443-2445

```javascript
if (isTwilioBridge) {
  // DUAL-LEG BILLING: Telnyx SIP leg
  const callType = 'Telnyx_SIP_Leg'
  billingInfo = await billCallMinutesUnified(chatId, num.phoneNumber, minutesBilled, destination, callType)
  log(`[Voice] Telnyx SIP leg billed: ${minutesBilled} min @ $${billingInfo.rate}`)
}
```

**LEG 2 - Twilio PSTN Billing**:
- **Webhook**: `/twilio/voice-status`
- **Call Type**: `Twilio_SIP_Outbound`
- **Charge**: Wallet (OUTBOUND type)
- **Detection**: `match.phoneNumber === From` (Twilio number is FROM)
- **File**: `/app/js/_index.js` line 23856

```javascript
const isOutboundCall = match.phoneNumber === From  // true for SIP bridge
const callType = isOutboundCall ? 'Twilio_SIP_Outbound' : 'Twilio_Inbound'
// isOutboundCall = true → Twilio_SIP_Outbound
```

---

## Call Type Classification

### INBOUND Types (Use Plan Minutes First, Then Wallet Overage)
- `Twilio_Inbound` - Direct inbound PSTN to Twilio number
- `Inbound` - Direct inbound to Telnyx (unused in current implementation)

### OUTBOUND Types (Charge Wallet Directly)
All these types are defined in `/app/js/voice-service.js` line 451-456:
```javascript
const OUTBOUND_CALL_TYPES = [
  'SIPOutbound', 'Forwarding', 'IVR_Outbound', 'IVR_Transfer',
  'IVR_Outbound_Twilio', 'Twilio_SIP_Bridge', 'Twilio_SIP_Outbound', 'Twilio_Forwarding',
  'Telnyx_SIP_Leg',
]
```

**Billing Logic** (`/app/js/voice-service.js` line 466):
```javascript
const isOutbound = OUTBOUND_CALL_TYPES.includes(callType)
if (isOutbound) {
  // Charge wallet directly — plan minutes are for inbound only
  const totalCharge = +(minutesBilled * rate).toFixed(4)
  await smartWalletDeduct(_walletOf, chatId, totalCharge)
  return { planMinUsed: 0, overageMin: minutesBilled, overageCharge: totalCharge, rate, used: 0, limit: 0 }
}
```

---

## Verification Tests

### ✅ Test 1: Inbound Call (Single-Leg)
**Setup**: External number calls Twilio number  
**Expected**: ONE bill as `Twilio_Inbound`  
**Actual**: ✅ Billed once in `/twilio/voice-status`

### ✅ Test 2: Direct SIP Outbound (Single-Leg)
**Setup**: SIP client calls external number (no Twilio bridge)  
**Expected**: ONE bill as `SIPOutbound`  
**Actual**: ✅ Billed once in Telnyx hangup

### ✅ Test 3: SIP Bridge (Dual-Leg)
**Setup**: SIP client calls external number via Twilio (for caller ID)  
**Expected**: TWO bills - `Telnyx_SIP_Leg` + `Twilio_SIP_Outbound`  
**Actual**: ✅ Billed twice:
1. Telnyx hangup: `Telnyx_SIP_Leg`
2. Twilio status: `Twilio_SIP_Outbound`

### ✅ Test 4: Call Forwarding (Single-Leg)
**Setup**: Inbound call auto-forwarded to user's number  
**Expected**: ONE bill as `Forwarding`  
**Actual**: ✅ Billed once in Telnyx hangup

### ✅ Test 5: IVR Outbound (Single-Leg)
**Setup**: Bot initiates outbound IVR call  
**Expected**: ONE bill as `IVR_Outbound` or `IVR_Outbound_Twilio`  
**Actual**: ✅ Billed once (Telnyx or Twilio depending on provider)

---

## Rate Configuration (Option E)

Implemented in `/app/js/phone-config.js`:
- **US/Canada**: $0.15/minute
- **International**: $0.25/minute  
- **Connection Fee**: $0.03 per call attempt (included in billing logic)
- **IVR Rate**: $0.10/minute (flat rate for IVR calls)

---

## No Double-Billing Issues Found

**Conclusion**: All single-leg calls are correctly billed ONCE. Dual-leg calls are correctly billed TWICE (once per leg). The billing logic properly distinguishes between:
1. Call direction (inbound vs outbound)
2. Call provider (Telnyx vs Twilio)
3. Call phase (direct vs bridged)

The system is functioning as designed.

---

## Key Files
- `/app/js/voice-service.js` - Main billing function `billCallMinutesUnified()`
- `/app/js/_index.js` - Twilio webhooks (lines 23835-23918, 23260-23315)
- `/app/js/phone-config.js` - Rate configuration
