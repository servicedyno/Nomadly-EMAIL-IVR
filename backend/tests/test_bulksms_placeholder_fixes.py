"""
Regression tests for the 4 BulkSMS [name]-placeholder fixes
(prod incident: chatId 7080940684 — AI told user CNAM was the issue, which is wrong).

Fix A — Contact parser tolerates space/tab separator and strips stray text from
        the phone field (was: "+12138686239 Steve Edith" → phoneNumber kept the
        whole string and name was empty).
Fix B — [name] substitution accepts {name}, <name>, %name%, $name, $$name in
        addition to canonical [name] (case-insensitive).
Fix C — ai-support.js KB now contains a dedicated entry telling the LLM the
        correct answer and explicitly forbids the CNAM hallucination.
Fix D — Review screen surfaces a warning banner (#rvNameWarning) when the
        template uses a non-canonical variant OR when contacts are missing names.
"""
import subprocess
from pathlib import Path

ROOT = Path("/app")


def _run_node(script: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(script)],
        capture_output=True,
        text=True,
        timeout=20,
    )


def test_placeholder_parser_js_suite():
    """23 unit tests covering parser + substitution + helpers."""
    script = ROOT / "scripts" / "test_bulksms_placeholders.js"
    assert script.exists()
    r = _run_node(script)
    assert r.returncode == 0, (
        f"placeholder test suite failed.\nSTDOUT:\n{r.stdout}\nSTDERR:\n{r.stderr}"
    )
    assert "23 pass, 0 fail" in r.stdout, f"Expected 23 pass / 0 fail.\n{r.stdout}"


def test_ai_support_kb_js_suite():
    """7 checks ensuring the new BulkSMS [name] KB entry is present in ai-support.js."""
    script = ROOT / "scripts" / "test_ai_support_bulksms_kb.js"
    assert script.exists()
    r = _run_node(script)
    assert r.returncode == 0, (
        f"AI-support KB test failed.\nSTDOUT:\n{r.stdout}\nSTDERR:\n{r.stderr}"
    )
    assert "7 pass, 0 fail" in r.stdout


def test_review_screen_has_warning_banner():
    """Fix D — HTML must have the #rvNameWarning placeholder element."""
    html = (ROOT / "sms-app" / "www" / "index.html").read_text()
    assert 'id="rvNameWarning"' in html
    assert 'data-testid="review-name-warning"' in html


def test_review_screen_warning_logic_present():
    """Fix D — populateReview() must call the warning logic."""
    src = (ROOT / "sms-app" / "www" / "js" / "app.js").read_text()
    assert "_templateHasPlaceholder" in src
    assert "_templateHasVariantOnly" in src
    assert "rvNameWarning" in src
    # Must use _substituteName (not the old hard-coded /\[name\]/gi replace)
    assert "_substituteName(firstMsg, sampleName)" in src
    assert "_substituteName(s.content[msgIdx], contact.name)" in src


def test_app_version_bumped():
    pkg = (ROOT / "sms-app" / "package.json").read_text()
    html = (ROOT / "sms-app" / "www" / "index.html").read_text()
    assert '"version": "2.7.6"' in pkg
    assert 'content="2.7.6"' in html


def test_contact_hint_updated():
    """The Step-3 hint should now tell users that space-separator works too."""
    html = (ROOT / "sms-app" / "www" / "index.html").read_text()
    assert "or just a space" in html
