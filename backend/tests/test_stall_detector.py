"""
Regression test for the silent-stall detector in /app/js/lead-job-persistence.js.

Verifies the JS test suite passes (4 cases):
  1. onStall fires once when results.length stops growing > STALL_THRESHOLD_MS.
  2. No stall fired while progress is healthy.
  3. Stall re-arms after progress resumes (next stall fires again).
  4. onStall callback is optional (no crash when omitted).
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
    assert "4 pass, 0 fail" in result.stdout, (
        f"Expected 4 pass / 0 fail.\nSTDOUT:\n{result.stdout}"
    )


def test_stall_threshold_and_save_interval_env_overridable():
    src = Path("/app/js/lead-job-persistence.js").read_text()
    assert "LEAD_JOB_STALL_THRESHOLD_MS" in src
    assert "LEAD_JOB_SAVE_INTERVAL_MS" in src
    # Stall logic must be present
    assert "STALL DETECTED" in src
    assert "stallAlerted" in src
