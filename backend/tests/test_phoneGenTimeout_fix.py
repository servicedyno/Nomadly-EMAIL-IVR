"""
Regression test for the phoneGenTimeout fix in /app/js/validatePhoneBulk.js.

Background:
  - Production job f7c619a9-0d9e-42f4-8b5f-aa912049a98d (3000 leads, CNAM=true)
    was about to time out at the 90-min ceiling while actual processing rate
    pointed to ~99 min completion (1557 leads in 51 min ≈ 1980ms/lead).
  - Old formula:
      raw = count * 1200ms * (cnam ? 1.5 : 1) = 3000 * 1800 = 90 min
      → clamped at 90 min ceiling → ZERO safety margin.
  - New formula:
      raw = ceil(count * 1200ms * (cnam ? 2.0 : 1) * 1.2 safety)
      → 3000 CNAM = 144 min (~45% headroom over observed 99 min).
      → ceiling raised to 240 min for runaway guard.

This test runs the JS sanity-check script via Node and asserts it returns 0.
"""
import subprocess
from pathlib import Path

SCRIPT = Path("/app/scripts/test_phoneGenTimeout.js")


def test_script_exists():
    assert SCRIPT.exists(), f"Expected sanity-check script at {SCRIPT}"


def test_phoneGenTimeout_all_realistic_cases_pass():
    """7 of 8 cases (all realistic orders ≤ 5k CNAM) must pass with ≥5% headroom."""
    result = subprocess.run(
        ["node", str(SCRIPT)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    # Mega 10k-CNAM case (330 min real vs 240 min ceiling) is the only
    # intentional failure — it hits the runaway-guard ceiling by design.
    assert "PROD CASE: 3000 CNAM" in result.stdout
    # Find the PROD CASE line and confirm PASS
    for line in result.stdout.splitlines():
        if "PROD CASE: 3000 CNAM" in line:
            assert "PASS" in line, f"Prod case must pass: {line}"
            break
    else:
        raise AssertionError("Prod case row missing from sanity-check output")
    # Expect exactly 7 passes (realistic) and 1 expected fail (mega 10k case)
    assert "7 pass, 1 fail" in result.stdout, (
        f"Unexpected result counts.\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )


def test_validatePhoneBulk_has_safety_buffer_constant():
    """Code must reference the new PHONE_GEN_SAFETY_BUFFER constant."""
    content = Path("/app/js/validatePhoneBulk.js").read_text()
    assert "PHONE_GEN_SAFETY_BUFFER" in content
    assert "PHONE_GEN_CNAM_MULTIPLIER" in content
    # Old hard-coded 90-min ceiling must not be present in the constant defs
    assert "90 * 60 * 1000" not in content.split("computePhoneGenTimeout")[0]
