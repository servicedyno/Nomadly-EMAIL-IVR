# Domain Validation Test Cases

## Test Scenarios to Verify

### ✅ Test Case 1: Missing TLD (Extension)
**Input**: `servicedptx` (no `.com`, `.net`, etc.)  
**Expected Error**: 
```
Missing domain extension. Please add .com, .net, .org, or another extension.

Example: yourname.com
```

---

### ✅ Test Case 2: Domain Too Short
**Input**: `ab.com` (only 2 characters before dot)  
**Expected Error**:
```
Domain name is too short. Must be at least 3 characters before the dot.

Example: abc.com
```

---

### ✅ Test Case 3: Invalid Characters
**Input**: `my_site.com` (underscore not allowed)  
**Input**: `my@domain.com` (@ symbol not allowed)  
**Expected Error**:
```
Domain contains invalid characters. Use only letters, numbers, and hyphens.

Example: my-site.com
```

---

### ✅ Test Case 4: Domain Starts/Ends with Hyphen
**Input**: `-mysite.com` (starts with hyphen)  
**Input**: `mysite-.com` (ends with hyphen)  
**Expected Error**:
```
Domain cannot start or end with a hyphen.

Example: mysite.com (not -mysite.com or mysite-.com)
```

---

### ✅ Test Case 5: Valid Domain
**Input**: `mydomain.com`  
**Expected**: No validation error → Proceed to availability check  
**Response**: `🔍 Searching availability for mydomain.com ...`

---

### ✅ Test Case 6: Domain Search Timeout
**Scenario**: Domain availability API takes >20 seconds  
**Expected Response**:
```
⏱️ Domain search for mydomain.com is taking longer than expected.

Please try again in a moment or contact support if this persists.
```

---

## Manual Testing Instructions

1. Start a chat with the Telegram bot
2. Navigate to: **🌐 Bulletproof Domains** → **🛒 Buy Domain Names**
3. Test each input above and verify error messages match

## Automated Testing (Future)
- [ ] Unit tests for domain validation regex
- [ ] Integration tests for timeout handling
- [ ] E2E tests via testing agent

---

**Created**: April 16, 2026  
**Status**: Ready for testing
