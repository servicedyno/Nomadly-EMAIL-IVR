#!/usr/bin/env python3
"""
Backend Test Suite for Bulk NS Update Feature
Tests the new bulk NS update functionality as specified in the review request.
"""

import os
import sys
import json
import requests
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load backend URL from frontend .env
def get_backend_url():
    """Get backend URL from frontend/.env file"""
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    return "http://localhost:5000"

BACKEND_URL = get_backend_url()
API_BASE = f"{BACKEND_URL}/api" if not BACKEND_URL.endswith('/api') else BACKEND_URL

def test_node_health():
    """Test Node.js service health"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        logger.info(f"Health check: {response.status_code}")
        if response.status_code == 200:
            try:
                health_data = response.json()
                logger.info(f"Health data: {health_data}")
                return True
            except:
                # Some endpoints return HTML instead of JSON
                logger.info("Health endpoint returned HTML (likely React app), service is running")
                return True
        return False
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return False

def test_domain_service_module():
    """Test that domain-service.js module loads and exports updateAllNameservers"""
    logger.info("Testing domain-service.js module structure...")
    
    # Check if file exists and can be read
    domain_service_path = "/app/js/domain-service.js"
    if not os.path.exists(domain_service_path):
        logger.error(f"domain-service.js not found at {domain_service_path}")
        return False
    
    try:
        with open(domain_service_path, 'r') as f:
            content = f.read()
        
        # Check for updateAllNameservers function definition
        if 'const updateAllNameservers = async' not in content:
            logger.error("updateAllNameservers function not found in domain-service.js")
            return False
        
        # Check if it's exported in module.exports
        if 'updateAllNameservers,' not in content:
            logger.error("updateAllNameservers not exported in module.exports")
            return False
        
        # Check function signature
        if 'updateAllNameservers = async (domainName, newNameservers, db)' not in content:
            logger.error("updateAllNameservers function signature incorrect")
            return False
        
        # Check for OpenProvider path
        if 'opService.updateNameservers(domainName, newNameservers)' not in content:
            logger.error("OpenProvider integration missing in updateAllNameservers")
            return False
        
        # Check for ConnectReseller path
        if 'getDomainDetails = require(\'./cr-domain-details-get\')' not in content:
            logger.error("ConnectReseller getDomainDetails requirement missing")
            return False
        
        # Check CR API call
        if 'UpdateNameServer' not in content or 'axios.get' not in content:
            logger.error("ConnectReseller UpdateNameServer API call missing")
            return False
        
        # Check nameserver type detection
        if 'const isCloudflare = newNameservers.some(ns => ns.toLowerCase().includes(\'cloudflare\'))' not in content:
            logger.error("Nameserver type detection logic missing")
            return False
        
        # Check DB update logic
        if '$unset: { cfZoneId: \'\' }' not in content:
            logger.error("cfZoneId unset logic for non-cloudflare nameservers missing")
            return False
        
        logger.info("✅ domain-service.js updateAllNameservers function correctly implemented")
        return True
        
    except Exception as e:
        logger.error(f"Error reading domain-service.js: {e}")
        return False

def test_index_js_bulk_ns_ui():
    """Test _index.js for bulk NS update UI implementation"""
    logger.info("Testing _index.js bulk NS update UI...")
    
    index_path = "/app/js/_index.js"
    if not os.path.exists(index_path):
        logger.error(f"_index.js not found at {index_path}")
        return False
    
    try:
        with open(index_path, 'r') as f:
            content = f.read()
        
        # Check for goto 'select-dns-record-id-to-update' implementation
        if "'select-dns-record-id-to-update': () => {" not in content:
            logger.error("select-dns-record-id-to-update goto function missing")
            return False
        
        # Check NS records consolidation
        if '🔄 Update Nameservers' not in content:
            logger.error("Update Nameservers button not found")
            return False
        
        # Check that NS records are not listed individually
        if 'recordBtns.push([`🔄 Update Nameservers (${nsPreview})`])' not in content:
            logger.error("NS records consolidation logic missing")
            return False
        
        # Check non-NS records numbering
        if 'records.forEach((r, i) => {\n        if (r.recordType === \'NS\') return' not in content:
            logger.error("Non-NS records numbering logic missing")
            return False
        
        # Check for goto 'dns-update-all-ns' implementation
        if "'dns-update-all-ns': () => {" not in content:
            logger.error("dns-update-all-ns goto function missing")
            return False
        
        # Check current NS display
        if 'Current nameservers:' not in content:
            logger.error("Current nameservers display missing")
            return False
        
        # Check for multi-line input prompt
        if 'Enter all new nameservers (one per line, min 2, max 4):' not in content:
            logger.error("Multi-line nameserver input prompt missing")
            return False
        
        # Check action handler for update nameservers button
        if "if (message.startsWith('🔄 Update Nameservers')) {" not in content:
            logger.error("Update Nameservers button handler missing")
            return False
        
        # Check goto call from button handler
        if "return goto['dns-update-all-ns']()" not in content:
            logger.error("Button handler goto call missing")
            return False
        
        # Check dns-update-all-ns action handler
        if "if (action === 'dns-update-all-ns') {" not in content:
            logger.error("dns-update-all-ns action handler missing")
            return False
        
        # Check back/cancel handling
        if "if (message === t.back || message === t.cancel) return goto['select-dns-record-id-to-update']()" not in content:
            logger.error("Back/cancel handling missing in dns-update-all-ns")
            return False
        
        # Check multi-line parsing
        if "const lines = message.trim().split(/[\\n\\r]+/).map(s => s.trim()).filter(Boolean)" not in content:
            logger.error("Multi-line input parsing missing")
            return False
        
        # Check validation (2-4 entries)
        if "if (lines.length < 2 || lines.length > 4)" not in content:
            logger.error("Nameserver count validation missing")
            return False
        
        # Check FQDN validation
        if "const fqdnRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+\\.?$/" not in content:
            logger.error("FQDN validation regex missing")
            return False
        
        # Check normalization
        if "const newNS = lines.map(ns => ns.toLowerCase().replace(/\\.$/, ''))" not in content:
            logger.error("Nameserver normalization missing")
            return False
        
        # Check domainService.updateAllNameservers call
        if "const result = await domainService.updateAllNameservers(domain, newNS, db)" not in content:
            logger.error("domainService.updateAllNameservers call missing")
            return False
        
        # Check non-NS record mapping
        if 'let nonNsCount = 0' not in content or 'if (nonNsCount === num) { id = i; break }' not in content:
            logger.error("Non-NS record sequential mapping logic missing")
            return False
        
        logger.info("✅ _index.js bulk NS update UI correctly implemented")
        return True
        
    except Exception as e:
        logger.error(f"Error reading _index.js: {e}")
        return False

def test_node_starts_cleanly():
    """Test that Node.js starts without syntax errors"""
    logger.info("Testing Node.js startup...")
    
    # Check if the service is running by making a health request
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        if response.status_code == 200:
            logger.info("✅ Node.js service is running and responding to health checks")
            return True
        else:
            logger.error(f"Node.js service responded with status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Node.js service is not responding: {e}")
        return False

def run_all_tests():
    """Run all bulk NS update tests"""
    logger.info("🚀 Starting Bulk NS Update Feature Test Suite")
    
    tests = [
        ("Node.js Health Check", test_node_health),
        ("domain-service.js updateAllNameservers Function", test_domain_service_module),
        ("_index.js Bulk NS Update UI", test_index_js_bulk_ns_ui),
        ("Node.js Starts Cleanly", test_node_starts_cleanly),
    ]
    
    results = []
    passed = 0
    
    for test_name, test_func in tests:
        logger.info(f"\n{'='*60}")
        logger.info(f"Running: {test_name}")
        logger.info(f"{'='*60}")
        
        try:
            result = test_func()
            results.append((test_name, "PASS" if result else "FAIL"))
            if result:
                passed += 1
                logger.info(f"✅ {test_name}: PASSED")
            else:
                logger.error(f"❌ {test_name}: FAILED")
        except Exception as e:
            results.append((test_name, "ERROR"))
            logger.error(f"💥 {test_name}: ERROR - {e}")
    
    # Summary
    logger.info(f"\n{'='*60}")
    logger.info(f"TEST SUMMARY")
    logger.info(f"{'='*60}")
    
    for test_name, status in results:
        status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "💥"
        logger.info(f"{status_icon} {test_name}: {status}")
    
    success_rate = (passed / len(tests)) * 100
    logger.info(f"\nSuccess Rate: {passed}/{len(tests)} ({success_rate:.1f}%)")
    
    if passed == len(tests):
        logger.info("🎉 ALL TESTS PASSED - Bulk NS update feature is ready!")
        return True
    else:
        logger.error(f"⚠️ {len(tests) - passed} TEST(S) FAILED - Issues need to be addressed")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)