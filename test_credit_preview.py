#!/usr/bin/env python3
"""
Test the /api/dev/credit-preview endpoint with the 6 scenarios from the review request.
"""
import requests
import json
import os

# Read REACT_APP_BACKEND_URL from frontend/.env
backend_url = None
with open('/app/frontend/.env', 'r') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL='):
            backend_url = line.strip().split('=', 1)[1]
            break

if not backend_url:
    print("❌ Could not find REACT_APP_BACKEND_URL in /app/frontend/.env")
    exit(1)

print(f"Backend URL: {backend_url}")
endpoint = f"{backend_url}/api/dev/credit-preview"

# Test scenarios from the review request
scenarios = [
    {
        "name": "(a) 3R9ly hosting exploit",
        "payload": {"invoiceUsd": 105, "convertedValue": 58.94, "feePayer": "company"},
        "expected_creditUsd": 58.94,
        "expected_mode": "major-underpayment"
    },
    {
        "name": "(b) sAoKK marketplace exploit",
        "payload": {"invoiceUsd": 50, "convertedValue": 4.23, "feePayer": "company"},
        "expected_creditUsd": 4.23,
        "expected_mode": "major-underpayment"
    },
    {
        "name": "(c) Spirits wallet exploit",
        "payload": {"invoiceUsd": 100, "convertedValue": 5.85, "feePayer": "company"},
        "expected_creditUsd": 5.85,
        "expected_mode": "major-underpayment"
    },
    {
        "name": "(d) Exact payment",
        "payload": {"invoiceUsd": 105, "convertedValue": 105, "feePayer": "company"},
        "expected_creditUsd": 105,
        "expected_mode": None  # Not specified in review, but should be overpayment or exact
    },
    {
        "name": "(e) Overpayment",
        "payload": {"invoiceUsd": 105, "convertedValue": 130, "feePayer": "company"},
        "expected_creditUsd": 130,
        "expected_mode": "overpayment"
    },
    {
        "name": "(f) Minor underpayment (fee-shave goodwill)",
        "payload": {"invoiceUsd": 105, "convertedValue": 100, "feePayer": "company"},
        "expected_creditUsd": 105,
        "expected_mode": "minor-underpayment"
    }
]

print(f"\nTesting {len(scenarios)} scenarios...\n")

all_passed = True
for i, scenario in enumerate(scenarios, 1):
    print(f"Test {i}: {scenario['name']}")
    print(f"  Payload: {json.dumps(scenario['payload'])}")
    
    try:
        response = requests.post(
            endpoint,
            json=scenario['payload'],
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"  ❌ HTTP {response.status_code}: {response.text}")
            all_passed = False
            continue
        
        result = response.json()
        creditUsd = result.get('creditUsd')
        mode = result.get('mode')
        
        # Check creditUsd
        if abs(creditUsd - scenario['expected_creditUsd']) < 0.01:
            print(f"  ✅ creditUsd: {creditUsd} (expected {scenario['expected_creditUsd']})")
        else:
            print(f"  ❌ creditUsd: {creditUsd} (expected {scenario['expected_creditUsd']})")
            all_passed = False
        
        # Check mode (if specified)
        if scenario['expected_mode'] is not None:
            if mode == scenario['expected_mode']:
                print(f"  ✅ mode: {mode}")
            else:
                print(f"  ❌ mode: {mode} (expected {scenario['expected_mode']})")
                all_passed = False
        else:
            print(f"  ℹ️  mode: {mode}")
        
    except Exception as e:
        print(f"  ❌ Error: {e}")
        all_passed = False
    
    print()

if all_passed:
    print("✅ All 6 scenarios PASSED")
    exit(0)
else:
    print("❌ Some scenarios FAILED")
    exit(1)
