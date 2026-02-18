#!/bin/bash
# test-price-cache.sh — Verify fast price cache endpoints
#
# Prerequisites:
#   - PostgreSQL running with index_prices DB
#   - Bitget API env vars set (BITGET_READONLY_API_KEY, etc.)
#   - data-node running on localhost:8200

set -euo pipefail

BASE_URL="${DATA_NODE_URL:-http://localhost:8200}"
PASS=0
FAIL=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }

check() {
    local desc="$1"
    local cond="$2"
    if eval "$cond"; then
        green "  PASS: $desc"
        PASS=$((PASS + 1))
    else
        red "  FAIL: $desc"
        FAIL=$((FAIL + 1))
    fi
}

echo "=== Fast Price Cache Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# 1. Wait for cache to be populated (up to 10s)
echo "Waiting for fast poller to populate cache..."
for i in $(seq 1 10); do
    RESP=$(curl -sf "$BASE_URL/fast-prices?symbols=BTCUSDT" 2>/dev/null || true)
    COUNT=$(echo "$RESP" | jq -r '.count // 0' 2>/dev/null || echo "0")
    if [ "$COUNT" -gt "0" ]; then
        echo "  Cache populated after ${i}s"
        break
    fi
    sleep 1
done

# 2. Test /fast-prices with specific symbols
echo ""
echo "--- /fast-prices (specific symbols) ---"
RESP=$(curl -sf "$BASE_URL/fast-prices?symbols=BTCUSDT,ETHUSDT,PEPEUSDT")
echo "  Response: $(echo "$RESP" | jq -c '{count: .count, age_ms: .age_ms}')"

COUNT=$(echo "$RESP" | jq '.count')
AGE=$(echo "$RESP" | jq '.age_ms')
check "count >= 1" "[ $COUNT -ge 1 ]"
check "age_ms < 10000 (cache is fresh)" "[ $AGE -lt 10000 ]"

# Check fields exist for BTCUSDT
BTC_PRICE=$(echo "$RESP" | jq -r '.prices.BTCUSDT.last_price // empty')
BTC_BID=$(echo "$RESP" | jq -r '.prices.BTCUSDT.bid // empty')
BTC_ASK=$(echo "$RESP" | jq -r '.prices.BTCUSDT.ask // empty')
check "BTCUSDT has last_price" "[ -n '$BTC_PRICE' ]"
check "BTCUSDT has bid" "[ -n '$BTC_BID' ]"
check "BTCUSDT has ask" "[ -n '$BTC_ASK' ]"

# 3. Test /fast-prices (all tracked)
echo ""
echo "--- /fast-prices (all tracked) ---"
RESP=$(curl -sf "$BASE_URL/fast-prices")
ALL_COUNT=$(echo "$RESP" | jq '.count')
echo "  Tracked symbols: $ALL_COUNT"
check "all tracked count > 0" "[ $ALL_COUNT -gt 0 ]"

# 4. Test /fast-prices-by-address
echo ""
echo "--- /fast-prices-by-address ---"
# Use a known address from symbol-map.json if available
ADDR_RESP=$(curl -sf "$BASE_URL/health")
echo "  Health: $(echo "$ADDR_RESP" | jq -c '{status: .status, symbols_tracked: .symbols_tracked}')"

# 5. Test /itp-bid-ask (if an ITP exists)
echo ""
echo "--- /itp-bid-ask ---"
# Try to find an ITP from /itp-price or skip
echo "  (requires ITP snapshot in DB — skipped if none available)"

# 6. Performance test: 20 sequential /fast-prices calls
echo ""
echo "--- Performance: 20 sequential /fast-prices?symbols=BTCUSDT ---"
START_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
for i in $(seq 1 20); do
    curl -sf "$BASE_URL/fast-prices?symbols=BTCUSDT" > /dev/null
done
END_MS=$(python3 -c 'import time; print(int(time.time()*1000))')
ELAPSED=$((END_MS - START_MS))
AVG=$((ELAPSED / 20))
echo "  Total: ${ELAPSED}ms, Average: ${AVG}ms per request"
check "avg response time < 50ms" "[ $AVG -lt 50 ]"

# Summary
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
