"""
Regression test for the tinyurl.com brand-leak fix in /app/js/_index.js
(2026-05-12).

Background:
  - 2026-05-02 commit a3e68f31 switched the random-slug shortener from
    `url-shortener57.p.rapidapi.com` to `tiny-url-shortner.p.rapidapi.com`.
    Production users (e.g. @Dprincecharles 6368783336) began seeing short URLs
    on the foreign `https://tinyurl.com/...` domain instead of the platform's
    own Shortit-branded domain.
  - This test fix-pins the new default behaviour:
      • Default flow returns SELF_URL/${slug} (Shortit-branded, click-tracked).
      • RapidAPI path still exists as an env-flag escape valve
        (`SHORTLINK_PROVIDER=rapidapi`) for emergency fallback.

We inspect the source to verify the structural change — running the full bot
inside a test is too heavy. The key assertions:
  1. The default code path no longer hard-codes `createShortUrlApi(url)`.
  2. There is a feature flag check on `SHORTLINK_PROVIDER`.
  3. The `_shortUrl = __shortUrl` default assignment is present.
  4. The custom-alias path (lines ~15672+) was already correct — still uses SELF_URL.
"""

from pathlib import Path
import re

SRC_PATH = Path("/app/js/_index.js")


def _src() -> str:
    return SRC_PATH.read_text()


def test_default_random_slug_uses_self_url():
    src = _src()
    # The fix block — exact comment marker — must be present
    assert "2026-05-12 fix: stop routing through RapidAPI's tinyurl.com white-label" in src
    # Default _shortUrl assignment
    assert "let _shortUrl = __shortUrl" in src


def test_feature_flag_guard_exists():
    src = _src()
    # Must gate RapidAPI behind env var
    assert "process.env.SHORTLINK_PROVIDER === 'rapidapi'" in src


def test_rapidapi_call_is_no_longer_unconditional():
    """createShortUrlApi must NOT be the very first action in the random-slug try block."""
    src = _src()
    # Locate the random-slug fix region (between the dedup check and the
    # notifyGroup that emits "Short Link Created").
    start = src.index("U6 dedup: returning existing link")
    end = src.index("notifyGroup(\n        `🔗 <b>Short Link Created!</b>\\nUser ${maskName(name)} just shortened", start)
    region = src[start:end]
    # In the new code, the first _shortUrl assignment is the SELF_URL fallback,
    # and createShortUrlApi only runs inside the rapidapi-branch.
    first_assignment_idx = region.index("let _shortUrl")
    rapidapi_branch_idx = region.index("SHORTLINK_PROVIDER === 'rapidapi'")
    api_call_idx = region.index("await createShortUrlApi(url)")
    assert first_assignment_idx < rapidapi_branch_idx < api_call_idx, (
        "createShortUrlApi must only run inside the feature-flag branch"
    )


def test_custom_alias_path_still_returns_self_url():
    """The custom-alias path (separate from the random-slug bug) should be untouched."""
    src = _src()
    # Find the custom-alias section near "Use the user's alias AS the slug"
    custom_section = src[src.index("Use the user's alias AS the slug"):]
    # Within the next 80 lines, _shortUrl must equal __shortUrl (SELF_URL/alias)
    head = custom_section[:6000]
    assert "const _shortUrl = __shortUrl" in head, (
        "Custom-alias flow should keep returning SELF_URL/alias"
    )


def test_no_default_to_tinyurl_in_main_flow():
    """No live code path should hard-code tinyurl as the user-visible result."""
    src = _src()
    # Strip JS line/block comments before checking — our fix comment legitimately
    # mentions "tinyurl.com" to document why we moved away from it.
    src_no_line_comments = re.sub(r"//[^\n]*", "", src)
    src_no_comments = re.sub(r"/\*.*?\*/", "", src_no_line_comments, flags=re.DOTALL)
    assert "tinyurl.com" not in src_no_comments.lower(), (
        "Direct code reference to tinyurl.com is a brand leak — remove or gate it"
    )
