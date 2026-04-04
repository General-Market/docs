#!/usr/bin/env bash
# Health watchdog — checks all Vision infrastructure services.
# Run via cron every 5 minutes on VPS 1:
#   */5 * * * * /home/max/index/scripts/health-watchdog.sh >> /home/max/index/logs/watchdog.log 2>&1
#
# Writes structured health report to stdout (captured by cron → log file).
# Exits 0 if healthy, 1 if any critical service is down.

set -euo pipefail

REPORT_FILE="/home/max/index/logs/health-report.json"
ALERT_FILE="/home/max/index/logs/health-alert.txt"
LOG_DIR="/home/max/index/logs"
mkdir -p "$LOG_DIR"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
HEALTHY=true
ALERTS=""

add_alert() {
    ALERTS="${ALERTS}${1}\n"
    HEALTHY=false
}

# ── VPS 1 containers ──────────────────────────────────────────

check_container() {
    local name="$1"
    local critical="${2:-true}"
    local status
    status=$(docker inspect "$name" --format '{{.State.Status}}' 2>/dev/null || echo "missing")
    local health
    health=$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' 2>/dev/null || echo "unknown")
    local restarts
    restarts=$(docker inspect "$name" --format '{{.RestartCount}}' 2>/dev/null || echo "?")
    local oom
    oom=$(docker inspect "$name" --format '{{.State.OOMKilled}}' 2>/dev/null || echo "?")

    echo "  $name: status=$status health=$health restarts=$restarts oom=$oom"

    if [ "$status" != "running" ] && [ "$critical" = "true" ]; then
        add_alert "CRITICAL: $name is $status (not running)"
    fi
    if [ "$health" = "unhealthy" ]; then
        add_alert "WARN: $name is unhealthy"
    fi
    if [ "$oom" = "true" ]; then
        add_alert "CRITICAL: $name was OOM-killed"
    fi
    if [ "$restarts" != "?" ] && [ "$restarts" -gt 3 ] 2>/dev/null; then
        add_alert "WARN: $name has $restarts restarts"
    fi
}

echo "[$TS] Health check starting..."
echo "VPS 1 containers:"
for svc in testnet-oracle-1 testnet-oracle-2 testnet-oracle-3 testnet-data-node fund-manager testnet-curator testnet-sonic-proxy; do
    check_container "$svc" true
done

# ── API health probes ─────────────────────────────────────────

echo "API probes:"

# Oracle API
ORACLE_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:10001/vision/leaderboard" 2>/dev/null || echo "000")
echo "  oracle-api: $ORACLE_STATUS"
[ "$ORACLE_STATUS" = "000" ] && add_alert "CRITICAL: Oracle API unreachable (port 10001)"

# Data-node API
DN_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:8200/health" 2>/dev/null || echo "000")
echo "  data-node-api: $DN_STATUS"
[ "$DN_STATUS" = "000" ] && add_alert "CRITICAL: Data-node API unreachable (port 8200)"

# ── Fund-manager heartbeat ────────────────────────────────────

HEARTBEAT="/home/max/index/docker/testnet/fund-manager/pnl-data/heartbeat.json"
if [ -f "$HEARTBEAT" ]; then
    HB_AGE=$(python3 -c "
import json, time
try:
    d = json.load(open('$HEARTBEAT'))
    age = time.time() - d['ts']
    print(f'age={int(age)}s cycle={d[\"cycle\"]} joined={d[\"joined\"]} match={d[\"source_match\"]}')
    if age > 300:
        print('STALE')
    elif not d.get('source_match', False) and d['cycle'] > 3:
        print('NO_MATCH')
    else:
        print('OK')
except Exception as e:
    print(f'ERROR: {e}')
    print('ERROR')
" 2>/dev/null)
    echo "  fund-manager-heartbeat: $HB_AGE"
    case "$HB_AGE" in
        *STALE*) add_alert "CRITICAL: Fund-manager heartbeat stale (>5 min)" ;;
        *NO_MATCH*) add_alert "CRITICAL: Fund-manager has no source matches — joining nothing" ;;
        *ERROR*) add_alert "WARN: Fund-manager heartbeat unreadable" ;;
    esac
else
    echo "  fund-manager-heartbeat: missing"
    # Only alert if container is running (might just be starting up)
    FM_UP=$(docker inspect fund-manager --format '{{.State.Status}}' 2>/dev/null || echo "missing")
    [ "$FM_UP" = "running" ] && add_alert "WARN: Fund-manager running but no heartbeat file"
fi

# ── Oracle consensus health ───────────────────────────────────

# Check if oracles are making progress (recent settlements)
RECENT_SETTLEMENTS=$(docker logs testnet-oracle-1 --since 10m 2>&1 | grep -c "Round settled" || echo "0")
echo "  oracle-settlements-10m: $RECENT_SETTLEMENTS"

# Check for consensus failures
CONSENSUS_FAILS=$(docker logs testnet-oracle-1 --since 10m 2>&1 | grep -c "payouts_hash.*mismatch\|co-sign.*fail\|equivocation" || echo "0")
echo "  oracle-consensus-fails-10m: $CONSENSUS_FAILS"
[ "$CONSENSUS_FAILS" -gt 10 ] 2>/dev/null && add_alert "WARN: $CONSENSUS_FAILS oracle consensus failures in last 10 min"

# ── Memory / Disk ─────────────────────────────────────────────

MEM_AVAIL=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo "?")
echo "  memory-available-mb: $MEM_AVAIL"
[ "$MEM_AVAIL" != "?" ] && [ "$MEM_AVAIL" -lt 1024 ] 2>/dev/null && add_alert "WARN: Low memory (${MEM_AVAIL}MB available)"

DISK_PCT=$(df / --output=pcent 2>/dev/null | tail -1 | tr -d ' %' || echo "?")
echo "  disk-used-pct: $DISK_PCT%"
[ "$DISK_PCT" != "?" ] && [ "$DISK_PCT" -gt 85 ] 2>/dev/null && add_alert "WARN: Disk usage at ${DISK_PCT}%"

SWAP_TOTAL=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo "?")
echo "  swap-total-mb: $SWAP_TOTAL"
[ "$SWAP_TOTAL" != "?" ] && [ "$SWAP_TOTAL" -lt 100 ] 2>/dev/null && add_alert "WARN: No swap configured — OOM kills possible"

# ── Report ────────────────────────────────────────────────────

echo ""
if [ "$HEALTHY" = true ]; then
    echo "STATUS: HEALTHY"
    # Clear alert file when healthy
    rm -f "$ALERT_FILE"
else
    echo "STATUS: DEGRADED"
    echo ""
    echo "ALERTS:"
    echo -e "$ALERTS"
    # Write alerts to file for external pickup
    echo -e "[$TS]\n$ALERTS" > "$ALERT_FILE"
fi

# Write machine-readable report
python3 -c "
import json
json.dump({
    'ts': '$TS',
    'healthy': $( [ '$HEALTHY' = true ] && echo 'true' || echo 'false' ),
    'alerts': '''$(echo -e "$ALERTS")'''.strip().split('\n') if '''$(echo -e "$ALERTS")'''.strip() else [],
}, open('$REPORT_FILE', 'w'), indent=2)
" 2>/dev/null || true

echo ""
echo "[$TS] Health check complete."

$HEALTHY
