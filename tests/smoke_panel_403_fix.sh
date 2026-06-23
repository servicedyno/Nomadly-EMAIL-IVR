#!/usr/bin/env bash
# End-to-end smoke test of the panel API after the scanner-block fix.
# Confirms that requests with `.php` / `.cgi` / `.aspx` / `.jsp` in the
# query string are NO LONGER intercepted by the early scanner-block
# middleware in js/_index.js.
#
# Pass criteria:
#   - Panel API requests with .php (etc) in query → HTTP 401 (auth required)
#     and a JSON body containing "Unauthorized".  NOT an empty 403.
#   - Direct scanner traffic (e.g. /con5dldbuy.php, /wp-admin/upload.php) →
#     still HTTP 403 with empty body.
#
# These are negative tests against the BUG, not real auth flows.  The dev
# pod doesn't have a real WHM account behind the seed users, but the
# scanner-block fires BEFORE auth — so this is the correct layer to test.

set -uo pipefail

API_URL="${API_URL:-$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)}"
echo "API_URL: $API_URL"
echo ""

PASS=0
FAIL=0
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'

check() {
  local label="$1"; local url="$2"; local method="${3:-GET}"
  local expect_pattern="$4"  # regex for expected outcome
  local actual_status actual_body
  local tmp_body=$(mktemp)
  if [ "$method" = "POST" ]; then
    actual_status=$(curl -s -o "$tmp_body" -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$url")
  else
    actual_status=$(curl -s -o "$tmp_body" -w "%{http_code}" "$url")
  fi
  actual_body=$(head -c 120 "$tmp_body")
  rm -f "$tmp_body"
  local summary="HTTP=$actual_status body=<${actual_body:0:80}>"
  if echo "$summary" | grep -qE "$expect_pattern"; then
    printf "  ${GREEN}PASS${NC}  %s\n     %s\n" "$label" "$summary"
    PASS=$((PASS+1))
  else
    printf "  ${RED}FAIL${NC}  %s\n     expected: %s\n     actual:   %s\n" "$label" "$expect_pattern" "$summary"
    FAIL=$((FAIL+1))
  fi
}

echo "── Group 1: Panel API endpoints with .php in query (the welc4757 bug) ──"
echo "  Expectation: 401 with JSON body (auth required) — NOT empty 403"
echo ""

check "GET  /files/content?file=index.php" \
  "$API_URL/api/panel/files/content?dir=%2Fhome%2Ftest%2Fpublic_html&file=index.php" \
  GET "HTTP=401.*Unauthorized"

check "GET  /files/content?file=config.php (welc4757 was blocked 22x on this)" \
  "$API_URL/api/panel/files/content?dir=%2Fhome%2Ftest%2Faccounts.google&file=config.php" \
  GET "HTTP=401.*Unauthorized"

check "GET  /files/content?file=telegram.php (welc4757 was blocked 13x on this)" \
  "$API_URL/api/panel/files/content?dir=%2Fhome%2Ftest%2FAcrobatN&file=telegram.php" \
  GET "HTTP=401.*Unauthorized"

check "GET  /files/content?file=login.aspx" \
  "$API_URL/api/panel/files/content?dir=%2Fx&file=login.aspx" \
  GET "HTTP=401.*Unauthorized"

check "GET  /files/content?file=script.cgi" \
  "$API_URL/api/panel/files/content?dir=%2Fx&file=script.cgi" \
  GET "HTTP=401.*Unauthorized"

check "GET  /files/content?file=test.jsp" \
  "$API_URL/api/panel/files/content?dir=%2Fx&file=test.jsp" \
  GET "HTTP=401.*Unauthorized"

check "GET  /files/content?file=portal.asp" \
  "$API_URL/api/panel/files/content?dir=%2Fx&file=portal.asp" \
  GET "HTTP=401.*Unauthorized"

check "GET  /files/content?file=.htaccess" \
  "$API_URL/api/panel/files/content?dir=%2Fhome%2Ftest%2Fpublic_html&file=.htaccess" \
  GET "HTTP=401.*Unauthorized"

check "POST /files/save (the actual file edit endpoint)" \
  "$API_URL/api/panel/files/save" \
  POST "HTTP=401.*Unauthorized"

check "POST /files/delete" \
  "$API_URL/api/panel/files/delete" \
  POST "HTTP=401.*Unauthorized"

check "POST /files/upload (basic — no multipart on this auth check)" \
  "$API_URL/api/panel/files/upload" \
  POST "HTTP=401.*Unauthorized"

check "POST /files/extract" \
  "$API_URL/api/panel/files/extract" \
  POST "HTTP=401.*Unauthorized"

check "POST /files/mkdir" \
  "$API_URL/api/panel/files/mkdir" \
  POST "HTTP=401.*Unauthorized"

check "POST /files/move" \
  "$API_URL/api/panel/files/move" \
  POST "HTTP=401.*Unauthorized"

echo ""
echo "── Group 2: Direct scanner attacks (must STILL be 403-blocked) ──"
echo ""

check "GET  /con5dldbuy.php (the original scanner pattern)" \
  "$API_URL/con5dldbuy.php?goods/123" \
  GET "HTTP=(403|404)"

check "GET  /wp-admin/upload.php" \
  "$API_URL/wp-admin/upload.php" \
  GET "HTTP=(403|404)"

check "GET  /phpmyadmin/index.php" \
  "$API_URL/phpmyadmin/index.php" \
  GET "HTTP=(403|404)"

check "GET  /wordpress/wp-login.php" \
  "$API_URL/wordpress/wp-login.php" \
  GET "HTTP=(403|404)"

check "GET  /.env (data-leak probe)" \
  "$API_URL/.env" \
  GET "HTTP=(403|404)"

check "GET  /.git/config" \
  "$API_URL/.git/config" \
  GET "HTTP=(403|404)"

check "GET  /shell.php (direct PHP at root)" \
  "$API_URL/shell.php" \
  GET "HTTP=(403|404)"

echo ""
echo "── Group 3: Non-scanner, non-API traffic should still work ──"
echo ""

check "GET  /api/sms-app/download/info (real public endpoint)" \
  "$API_URL/api/sms-app/download/info" \
  GET "HTTP=200"

echo ""
echo "════════════════════════════════════════════════"
echo "  Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "════════════════════════════════════════════════"
exit $FAIL
