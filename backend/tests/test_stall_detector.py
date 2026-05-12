"""
Regression test for the silent-stall detector + stall-resolved alert in
/app/js/lead-job-persistence.js.

Verifies the JS test suite passes (5 cases):
  1. onStall fires once when results.length stops growing > STALL_THRESHOLD_MS.
  2. No stall fired while progress is healthy.
  3. Stall re-arms after recovery + onRecover fires exactly once per stall.
  4. onStall / onRecover callbacks are optional (no crash when omitted).
  5. onRecover does NOT fire if no prior stall occurred.
"""
import subprocess
from pathlib import Path

SCRIPT = Path("/app/scripts/test_stall_detector.js")


def test_script_exists():
    assert SCRIPT.exists()


def test_stall_detector_all_cases_pass():
    result = subprocess.run(
        ["node", str(SCRIPT)],
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert result.returncode == 0, (
        f"stall-detector tests failed.\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
    assert "5 pass, 0 fail" in result.stdout, (
        f"Expected 5 pass / 0 fail.\nSTDOUT:\n{result.stdout}"
    )
    # Sanity: ensure both alert paths are exercised
    assert "STALL DETECTED" in result.stdout
    assert "STALL RESOLVED" in result.stdout


def test_stall_threshold_and_save_interval_env_overridable():
    src = Path("/app/js/lead-job-persistence.js").read_text()
    assert "LEAD_JOB_STALL_THRESHOLD_MS" in src
    assert "LEAD_JOB_SAVE_INTERVAL_MS" in src
    # Stall + recovery logic must be present
    assert "STALL DETECTED" in src
    assert "STALL RESOLVED" in src
    assert "stallAlerted" in src
    assert "onRecover" in src


def test_validatePhoneBulk_wires_onRecover():
    src = Path("/app/js/validatePhoneBulk.js").read_text()
    assert "STALL RESOLVED" in src
    assert "onRecover" in src
