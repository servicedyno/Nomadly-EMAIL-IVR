#!/usr/bin/env python3
"""Focused SEC-004 backend verification against dev endpoints."""

import json
import re
import sys
import urllib.request


BASE = "http://localhost:5000"
RAW_HOSTILE = 'Sales <script>alert("x")</script> & "Support"'
ALLOWED_TAG_RE = re.compile(r"</?(?:b|i)>|</?code>")


def post_json(path):
    req = urllib.request.Request(f"{BASE}{path}", method="POST")
    with urllib.request.urlopen(req, timeout=90) as resp:
        body = resp.read().decode("utf-8")
    return json.loads(body)


def raw_lt_outside_allowed_tags(text):
    """Return raw '<...' occurrences not part of intentional Telegram HTML tags."""
    offenders = []
    i = 0
    while i < len(text):
        if text[i] != "<":
            i += 1
            continue
        m = ALLOWED_TAG_RE.match(text, i)
        if m:
            i = m.end()
            continue
        offenders.append(text[i : i + 40])
        i += 1
    return offenders


def assert_true(condition, message, failures):
    if not condition:
        failures.append(message)


def main():
    failures = []
    result = {"base": BASE, "raw_hostile": RAW_HOSTILE, "checks": {}}

    multilayer = post_json("/dev/ivr-multilayer-test")
    result["multilayer"] = multilayer
    assert_true(multilayer.get("pass") is True, "ivr-multilayer-test pass was not true", failures)
    checks = multilayer.get("checks", {})
    for step in ["step10_label_in_menu", "step11_label_in_analytics", "step12_escape_helper"]:
        assert_true(checks.get(step, {}).get("ok") is True, f"{step} was not ok", failures)

    for step in ["step10_label_in_menu", "step11_label_in_analytics"]:
        snippet = checks.get(step, {}).get("snippet", "")
        step_failures = []
        assert_true("&lt;script&gt;" in snippet, f"{step} missing &lt;script&gt;", step_failures)
        assert_true("&amp;" in snippet, f"{step} missing &amp;", step_failures)
        assert_true("&quot;" in snippet, f"{step} missing &quot;", step_failures)
        assert_true("<script>" not in snippet, f"{step} contains raw <script>", step_failures)
        assert_true(RAW_HOSTILE not in snippet, f"{step} contains full raw hostile label", step_failures)
        offenders = raw_lt_outside_allowed_tags(snippet)
        assert_true(not offenders, f"{step} has raw '<' outside allowed Telegram tags: {offenders}", step_failures)
        result["checks"][step] = {
            "ok": not step_failures,
            "snippet_line_1": snippet.splitlines()[0] if snippet.splitlines() else "",
            "snippet_line_2": snippet.splitlines()[1] if len(snippet.splitlines()) > 1 else "",
            "failures": step_failures,
        }
        failures.extend(step_failures)

    expected_escape = "&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;"
    actual_escape = checks.get("step12_escape_helper", {}).get("escaped")
    assert_true(actual_escape == expected_escape, f"escape helper mismatch: {actual_escape}", failures)
    result["checks"]["step12_escape_helper"] = {"actual": actual_escape, "expected": expected_escape, "ok": actual_escape == expected_escape}

    library = post_json("/dev/ivr-audio-library-integrity")
    preview = post_json("/dev/ivr-audio-preview-rename")
    result["audio_library_integrity_pass"] = library.get("pass") is True
    result["audio_preview_rename_pass"] = preview.get("pass") is True
    assert_true(library.get("pass") is True, "ivr-audio-library-integrity pass was not true", failures)
    assert_true(preview.get("pass") is True, "ivr-audio-preview-rename pass was not true", failures)

    result["pass"] = not failures
    result["failures"] = failures
    with open("/app/test_reports/sec004_api_results.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(json.dumps({"pass": result["pass"], "failures": failures, "api_results": "/app/test_reports/sec004_api_results.json"}, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())