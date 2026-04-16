# P1 Issues Fix Plan — AutoPromo & Domain Purchase UX

## Issue 1: AutoPromo High Bot Block Rate (638 users)

### Current Behavior:
- Sends promotional messages to ALL users in database
- No user-facing opt-out mechanism
- 638 users have blocked the bot (high spam perception)
- No activity-based segmentation

### Proposed Fixes:

1. **Add `/stoppromos` Command**
   - Simple command users can send to stop all promotional messages
   - Confirmation message with option to re-enable later via `/startpromos`
   
2. **Add Opt-Out Button in Promo Messages**
   - Every promo message includes inline button: "🔕 Stop Promos"
   - One-click opt-out with confirmation

3. **Activity-Based Segmentation**
   - Skip users who haven't interacted in 30+ days (likely inactive)
   - Reduce frequency for users inactive 7-14 days (send 1x/week instead of daily)

4. **Opt-In Footer Message**
   - Add footer to all promos: "Tap /stoppromos to unsubscribe"
   - Makes opt-out obvious and accessible

---

## Issue 2: Domain Purchase Flow Abandonments

### Current Behavior:
- User clicks "Buy Domain Names"
- Enters domain name
- Sees "🔍 Searching availability..."
- THEN sees price
- Complex multi-step payment selection
- No upfront indication of cost

### Proposed Fixes:

1. **Show Price Range Upfront**
   - Before user enters domain name, show:
     ```
     💰 Domain Pricing:
     • .com, .net: from $12/year
     • Premium TLDs: from $9/year
     • Popular TLDs: $15-30/year
     
     Enter domain name to check availability and exact price
     ```

2. **Instant Price Preview**
   - After domain validation, show price IMMEDIATELY in the "searching..." message
   - Update message: "🔍 Searching availability for mydomain.com ($12/year)..."

3. **Simplified Payment Selection**
   - If wallet has sufficient balance, show "👛 Pay with Wallet ($12)" as PRIMARY option
   - Consolidate crypto options into single "Crypto" button with submenu
   - Reduce from 4-5 payment buttons to 3 max

4. **Add "Why this price?" Info Button**
   - Explains pricing factors (TLD, registrar, demand)
   - Builds trust and reduces abandonment

---

## Implementation Priority:

**Phase 1** (Critical — Immediate):
1. Add `/stoppromos` command handler
2. Add opt-out button to promo messages
3. Add opt-in footer to all promos

**Phase 2** (High — Next):
4. Activity-based user segmentation
5. Show domain price range upfront
6. Instant price preview in search message

**Phase 3** (Medium — After):
7. Simplify payment selection UI
8. Add "Why this price?" info button
