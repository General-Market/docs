#!/usr/bin/env bash
# End-to-end verification of the waitlist gate.
#
# Usage:
#   BASE_URL=https://generalmarket.io \
#   CODE=AAAA-BBBB-CCCC-DDDD \
#   ./scripts/verify-waitlist.sh
#
# What it tests:
#   1. status(wallet) → false (fresh wallet, not whitelisted)
#   2. faucet(wallet) → 403 WAITLIST_REQUIRED
#   3. redeem(wallet, BAD-CODE) × 6 → 400 invalid, then 429 once over wallet limit
#   4. redeem(fresh wallet, GOOD-CODE) → 200 ok, whitelisted=true
#   5. status(fresh wallet) → true
#   6. faucet(fresh wallet) → no longer 403
#
# Exits 0 if all expectations met, non-zero otherwise.

set -uo pipefail

BASE_URL="${BASE_URL:-https://generalmarket.io}"
CODE="${CODE:?CODE env var required — pick one from waitlist-codes.txt}"

# Two random fresh wallets, generated with openssl so they're never reused.
gen_wallet() { printf "0x%s\n" "$(openssl rand -hex 20)"; }
W_BAD=$(gen_wallet)
W_GOOD=$(gen_wallet)

pass=0
fail=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf '  ✓ %-40s [%s]\n' "$label" "$actual"
    pass=$((pass+1))
  else
    printf '  ✗ %-40s expected=%s got=%s\n' "$label" "$expected" "$actual"
    fail=$((fail+1))
  fi
}

post() {
  local path="$1" body="$2"
  curl -s -o /tmp/wl.body -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -X POST "$BASE_URL$path" -d "$body"
}

get() {
  local path="$1"
  curl -s -o /tmp/wl.body -w '%{http_code}' "$BASE_URL$path"
}

echo
echo "Verifying waitlist gate at $BASE_URL"
echo "  fresh wallet (rejection arc): $W_BAD"
echo "  fresh wallet (success arc):   $W_GOOD"
echo "  good code: $CODE"
echo

echo "Step 1 — status(W_BAD) should be false"
http=$(get "/api/waitlist/status?wallet=$W_BAD")
body=$(cat /tmp/wl.body)
check "status http=200"           "200"   "$http"
check "status whitelisted=false"  "false" "$(echo "$body" | jq -r 'if has("whitelisted") then .whitelisted | tostring else "missing" end')"

echo
echo "Step 2 — faucet(W_BAD) should 403 WAITLIST_REQUIRED"
http=$(post "/api/faucet" "{\"address\":\"$W_BAD\",\"amount\":\"100\"}")
body=$(cat /tmp/wl.body)
check "faucet http=403"           "403"               "$http"
check "faucet error=WAITLIST_REQUIRED" "WAITLIST_REQUIRED" "$(echo "$body" | jq -r '.error // empty')"
check "faucet returns waitlistUrl"     "true"              "$(echo "$body" | jq -r 'if .waitlistUrl then "true" else "false" end')"

echo
echo "Step 3 — bot faucet(W_BAD) should also 403"
http=$(post "/api/bot/faucet" "{\"address\":\"$W_BAD\"}")
body=$(cat /tmp/wl.body)
check "bot-faucet http=403"            "403"               "$http"
check "bot-faucet error=WAITLIST_REQUIRED" "WAITLIST_REQUIRED" "$(echo "$body" | jq -r '.error // empty')"

echo
echo "Step 4 — bad codes against W_BAD: 5 ok-but-rejected, 6th hits 429"
for i in 1 2 3 4 5; do
  http=$(post "/api/waitlist/redeem" "{\"address\":\"$W_BAD\",\"code\":\"FAKE-$(openssl rand -hex 4 | tr '[:lower:]' '[:upper:]')\"}")
  body=$(cat /tmp/wl.body)
  check "bad-code attempt $i http=400"  "400"     "$http"
  check "bad-code attempt $i reason=invalid" "invalid" "$(echo "$body" | jq -r '.reason // empty')"
done
http=$(post "/api/waitlist/redeem" "{\"address\":\"$W_BAD\",\"code\":\"FAKE-LATE\"}")
body=$(cat /tmp/wl.body)
check "bad-code attempt 6 http=429"   "429"          "$http"
check "bad-code attempt 6 error=rate_limited" "rate_limited" "$(echo "$body" | jq -r '.error // empty')"

echo
echo "Step 5 — redeem GOOD code with W_GOOD (clean wallet, no rate-limit hit yet)"
http=$(post "/api/waitlist/redeem" "{\"address\":\"$W_GOOD\",\"code\":\"$CODE\"}")
body=$(cat /tmp/wl.body)
check "redeem http=200"           "200"  "$http"
check "redeem ok=true"            "true" "$(echo "$body" | jq -r '.ok // empty')"
check "redeem whitelisted=true"   "true" "$(echo "$body" | jq -r 'if has("whitelisted") then .whitelisted | tostring else "missing" end')"

echo
echo "Step 6 — status(W_GOOD) should now be true"
http=$(get "/api/waitlist/status?wallet=$W_GOOD")
body=$(cat /tmp/wl.body)
check "status http=200"           "200"  "$http"
check "status whitelisted=true"   "true" "$(echo "$body" | jq -r 'if has("whitelisted") then .whitelisted | tostring else "missing" end')"

echo
echo "Step 7 — faucet(W_GOOD) no longer returns 403"
http=$(post "/api/faucet" "{\"address\":\"$W_GOOD\",\"amount\":\"100\"}")
body=$(cat /tmp/wl.body)
if [ "$http" = "403" ]; then
  check "faucet http != 403"  "not-403" "$http"
else
  check "faucet http != 403"  "not-403" "not-403"
  echo "    (faucet response: $http — actual mint outcome depends on chain state)"
fi

echo
echo "Step 8 — re-redeeming GOOD code with the SAME wallet returns alreadyWhitelisted"
http=$(post "/api/waitlist/redeem" "{\"address\":\"$W_GOOD\",\"code\":\"$CODE\"}")
body=$(cat /tmp/wl.body)
check "re-redeem http=200"        "200"  "$http"
check "re-redeem alreadyWhitelisted=true" "true" "$(echo "$body" | jq -r '.alreadyWhitelisted // empty')"

echo
echo "Step 9 — same code on a third wallet should be exhausted (single-use)"
W_THIRD=$(gen_wallet)
http=$(post "/api/waitlist/redeem" "{\"address\":\"$W_THIRD\",\"code\":\"$CODE\"}")
body=$(cat /tmp/wl.body)
check "third-wallet http=400"          "400"        "$http"
check "third-wallet reason=exhausted"  "exhausted"  "$(echo "$body" | jq -r '.reason // empty')"

echo
echo "── Summary ──────────────────────────────"
echo "  passed: $pass"
echo "  failed: $fail"
echo "  test wallets: $W_GOOD (whitelisted), $W_THIRD (rejected), $W_BAD (rate-limited)"
echo "  consumed code: $CODE"
echo

[ "$fail" -eq 0 ]
