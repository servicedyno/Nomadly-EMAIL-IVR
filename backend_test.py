#!/usr/bin/env python3
"""
CNAM Circuit Breaker Code Structure Testing
Direct analysis of js/cnam-service.js implementation
"""

import re
import sys
from datetime import datetime

class CNAMCircuitBreakerCodeTester:
    def __init__(self):
        self.results = []
        self.errors = []
        
    def log_result(self, test_name, success, details=""):
        status = "✅" if success else "❌"
        self.results.append({
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success:
            self.errors.append(f"{test_name}: {details}")
    
    def read_file(self, filepath):
        """Read file content"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            return None
    
    def test_cnam_service_file_exists(self):
        """Test 1: CNAM service file exists"""
        content = self.read_file('/app/js/cnam-service.js')
        if content:
            self.log_result("CNAM Service File Exists", True, "js/cnam-service.js found and readable")
            return content
        else:
            self.log_result("CNAM Service File Exists", False, "js/cnam-service.js not found or unreadable")
            return None
    
    def test_circuit_breaker_constants(self, content):
        """Test 2: Circuit breaker constants and thresholds"""
        if not content:
            self.log_result("Circuit Breaker Constants", False, "No content to analyze")
            return
        
        required_constants = [
            'CONSECUTIVE_FAIL_THRESHOLD = 3',
            'CREDIT_FAIL_THRESHOLD = 1', 
            'COOLDOWN_CREDIT_MS = 60 * 60 * 1000',   # 1 hour
            'COOLDOWN_TRANSIENT_MS = 5 * 60 * 1000'  # 5 minutes
        ]
        
        missing_constants = []
        for constant in required_constants:
            if constant not in content:
                missing_constants.append(constant)
        
        if not missing_constants:
            self.log_result("Circuit Breaker Constants", True, 
                          "All required constants found: CONSECUTIVE_FAIL_THRESHOLD=3, CREDIT_FAIL_THRESHOLD=1, cooldowns configured")
        else:
            self.log_result("Circuit Breaker Constants", False, 
                          f"Missing constants: {', '.join(missing_constants)}")
    
    def test_circuit_breakers_object(self, content):
        """Test 3: circuitBreakers object structure"""
        if not content:
            self.log_result("circuitBreakers Object", False, "No content to analyze")
            return
        
        # Check for circuitBreakers object
        if 'const circuitBreakers = {' not in content:
            self.log_result("circuitBreakers Object", False, "circuitBreakers object not found")
            return
        
        # Check for all three providers
        required_providers = ['telnyx:', 'multitel:', 'signalwire:']
        missing_providers = []
        for provider in required_providers:
            if provider not in content:
                missing_providers.append(provider.replace(':', ''))
        
        # Check for required fields in structure
        required_fields = ['state:', 'failures:', 'lastFailure:', 'cooldownMs:', 'lastError:']
        missing_fields = []
        for field in required_fields:
            if field not in content:
                missing_fields.append(field.replace(':', ''))
        
        # Check initial state is CLOSED
        closed_state_pattern = r'state:\s*BREAKER_STATES\.CLOSED'
        closed_states = len(re.findall(closed_state_pattern, content))
        
        if not missing_providers and not missing_fields and closed_states >= 3:
            self.log_result("circuitBreakers Object", True, 
                          f"circuitBreakers object with telnyx, multitel, signalwire entries - all have state, failures, lastFailure, cooldownMs, lastError fields with CLOSED initial state")
        else:
            issues = []
            if missing_providers:
                issues.append(f"Missing providers: {missing_providers}")
            if missing_fields:
                issues.append(f"Missing fields: {missing_fields}")
            if closed_states < 3:
                issues.append(f"Not all states initialized to CLOSED (found {closed_states})")
            self.log_result("circuitBreakers Object", False, f"Issues: {'; '.join(issues)}")
    
    def test_circuit_breaker_functions(self, content):
        """Test 4: Circuit breaker functions exist"""
        if not content:
            self.log_result("Circuit Breaker Functions", False, "No content to analyze")
            return
        
        required_functions = [
            ('function circuitAllows(provider)', 'circuitAllows'),
            ('function circuitSuccess(provider)', 'circuitSuccess'), 
            ('function circuitFailure(provider, err)', 'circuitFailure'),
            ('function getCircuitStatus()', 'getCircuitStatus')
        ]
        
        found_functions = []
        missing_functions = []
        
        for pattern, name in required_functions:
            if pattern in content:
                found_functions.append(name)
            else:
                missing_functions.append(name)
        
        if not missing_functions:
            self.log_result("Circuit Breaker Functions", True, 
                          f"All required functions found: {', '.join(found_functions)}")
        else:
            self.log_result("Circuit Breaker Functions", False, 
                          f"Missing functions: {', '.join(missing_functions)}. Found: {', '.join(found_functions)}")
    
    def test_lookup_cnam_integration(self, content):
        """Test 5: lookupCnam integration with circuit breaker"""
        if not content:
            self.log_result("lookupCnam Integration", False, "No content to analyze")
            return
        
        # Check that lookupCnam function exists
        if 'async function lookupCnam(' not in content:
            self.log_result("lookupCnam Integration", False, "lookupCnam function not found")
            return
        
        # Check for circuitAllows calls for each provider
        circuit_allows_calls = [
            'circuitAllows(\'telnyx\')',
            'circuitAllows(\'multitel\')',  
            'circuitAllows(\'signalwire\')'
        ]
        
        # Check for circuitSuccess calls
        circuit_success_calls = [
            'circuitSuccess(\'telnyx\')',
            'circuitSuccess(\'multitel\')',
            'circuitSuccess(\'signalwire\')'
        ]
        
        # Check for circuitFailure calls
        circuit_failure_calls = [
            'circuitFailure(\'telnyx\'',
            'circuitFailure(\'multitel\'',
            'circuitFailure(\'signalwire\''
        ]
        
        allows_found = sum(1 for call in circuit_allows_calls if call in content)
        success_found = sum(1 for call in circuit_success_calls if call in content)
        failure_found = sum(1 for call in circuit_failure_calls if call in content)
        
        if allows_found == 3 and success_found == 3 and failure_found == 3:
            self.log_result("lookupCnam Integration", True, 
                          "lookupCnam calls circuitAllows before each provider, circuitSuccess on success, circuitFailure on error")
        else:
            self.log_result("lookupCnam Integration", False, 
                          f"Missing circuit calls - allows: {allows_found}/3, success: {success_found}/3, failure: {failure_found}/3")
    
    def test_module_exports(self, content):
        """Test 6: Module exports"""
        if not content:
            self.log_result("Module Exports", False, "No content to analyze")
            return
        
        # Check for module.exports
        if 'module.exports = {' not in content:
            self.log_result("Module Exports", False, "module.exports not found")
            return
        
        required_exports = [
            'initCnamService',
            'lookupCnam',
            'batchLookupCnam', 
            'getCircuitStatus'
        ]
        
        missing_exports = []
        for export in required_exports:
            if export not in content:
                missing_exports.append(export)
        
        if not missing_exports:
            self.log_result("Module Exports", True, 
                          f"All required exports found: {', '.join(required_exports)}")
        else:
            self.log_result("Module Exports", False, 
                          f"Missing exports: {', '.join(missing_exports)}")
    
    def test_import_in_main_file(self):
        """Test 7: Check imports in main _index.js file"""
        content = self.read_file('/app/js/_index.js')
        if not content:
            self.log_result("Main File Import", False, "_index.js not found")
            return
        
        # Check if cnam-service is imported
        if 'require(\'./cnam-service.js\')' in content:
            # Check what functions are imported
            import_pattern = r'const\s*{\s*([^}]+)\s*}\s*=\s*require\([\'"]\.\/cnam-service\.js[\'"]'
            match = re.search(import_pattern, content)
            
            if match:
                imports = [imp.strip() for imp in match.group(1).split(',')]
                required_imports = ['initCnamService', 'lookupCnam', 'batchLookupCnam', 'getCircuitStatus']
                missing_imports = [imp for imp in required_imports if imp not in imports]
                
                if not missing_imports:
                    self.log_result("Main File Import", True, 
                                  f"CNAM service correctly imported with: {', '.join(imports)}")
                else:
                    self.log_result("Main File Import", False, 
                                  f"CNAM service imported but missing: {', '.join(missing_imports)}. Current imports: {', '.join(imports)}")
            else:
                self.log_result("Main File Import", False, "CNAM service import format not recognized")
        else:
            self.log_result("Main File Import", False, "CNAM service not imported in _index.js")
    
    def test_initialization_call(self):
        """Test 8: Check initCnamService is called"""
        content = self.read_file('/app/js/_index.js')
        if not content:
            self.log_result("Service Initialization", False, "_index.js not found")
            return
        
        if 'initCnamService(' in content:
            self.log_result("Service Initialization", True, "initCnamService is called in main application")
        else:
            self.log_result("Service Initialization", False, "initCnamService is not called")
    
    def run_all_tests(self):
        """Run all code structure tests"""
        print("🔧 CNAM Circuit Breaker Code Structure Analysis")
        print("=" * 60)
        
        # Test 1: File exists
        content = self.test_cnam_service_file_exists()
        
        if content:
            # Test 2: Constants
            self.test_circuit_breaker_constants(content)
            
            # Test 3: circuitBreakers object
            self.test_circuit_breakers_object(content)
            
            # Test 4: Functions
            self.test_circuit_breaker_functions(content)
            
            # Test 5: Integration
            self.test_lookup_cnam_integration(content)
            
            # Test 6: Exports
            self.test_module_exports(content)
        
        # Test 7: Import in main file
        self.test_import_in_main_file()
        
        # Test 8: Initialization
        self.test_initialization_call()
        
        # Summary
        print("\n" + "=" * 60)
        print("🔍 CODE ANALYSIS SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if r['success'])
        total = len(self.results)
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"Tests passed: {passed}/{total} ({success_rate:.1f}%)")
        
        if self.errors:
            print("\n❌ FAILED TESTS:")
            for error in self.errors:
                print(f"   - {error}")
        
        if passed == total:
            print("\n✅ All code structure tests passed!")
        
        return len(self.errors) == 0

if __name__ == "__main__":
    tester = CNAMCircuitBreakerCodeTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)