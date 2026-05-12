"""
Regression test for the cuttly.js provider revert (2026-05-12).

Background:
  - 2026-05-02 swap from url-shortener57 → tiny-url-shortner caused tinyurl.com
    URLs to surface in production. User feedback ("It should be through
    RapidAPI") indicated the RapidAPI hop is fine — just NOT the tinyurl
    provider. We reverted the provider, kept the RapidAPI flow intact.
  - Defaults now: url-shortener57.p.rapidapi.com, /shorten, result_url.
  - Provider overridable at runtime via RAPIDAPI_SHORTENER_HOST /
    RAPIDAPI_SHORTENER_PATH / RAPIDAPI_SHORTENER_FIELD env vars.
"""

from pathlib import Path
import re

SRC = Path("/app/js/cuttly.js")
INDEX = Path("/app/js/_index.js")


def test_default_provider_is_not_tinyurl():
    src = SRC.read_text()
    # Strip comments before checking — our revert note legitimately mentions tinyurl.
    src_no_comments = re.sub(r"//[^\n]*", "", src)
    src_no_comments = re.sub(r"/\*.*?\*/", "", src_no_comments, flags=re.DOTALL)
    assert "tiny-url-shortner" not in src_no_comments.lower()
    assert "tinyurl.com" not in src_no_comments.lower()


def test_default_provider_is_srtn_me():
    src = SRC.read_text()
    assert "srtn-me-url-shortener.p.rapidapi.com" in src
    # Endpoint + result field must match the provider's contract
    assert "'/api/shorten'" in src
    assert "PROVIDER_RESULT_FIELD || 'url'" in src or "FIELD || 'url'" in src
    # Description field must be sent (required by provider)
    assert "description" in src


def test_provider_overridable_via_env():
    src = SRC.read_text()
    for v in ("RAPIDAPI_SHORTENER_HOST", "RAPIDAPI_SHORTENER_PATH", "RAPIDAPI_SHORTENER_FIELD"):
        assert v in src, f"Env override variable {v} missing"


def test_index_js_random_slug_uses_rapidapi_again():
    """The random-slug flow must call createShortUrlApi unconditionally."""
    src = INDEX.read_text()
    # Find the block that handles the random-slug short URL flow.
    region_start = src.index("Always route through SELF_URL key")
    region = src[region_start:region_start + 2500]
    # Hard-coded RapidAPI call — no feature flag gate
    assert "await createShortUrlApi(url)" in region
    assert "process.env.SHORTLINK_PROVIDER" not in region

