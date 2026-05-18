#!/usr/bin/env bash
# Health watchdog — checks all Vision infrastructure services.
# Run via cron every 5 minutes on VPS 1:
#   */5 * * * * /home/max/index/scripts/health-watchdog.sh >> /home/max/index/logs/watchdog.log 2>&1
#
# Writes structured health report to stdout (captured by cron → log file).
# Exits 0 if healthy, 1 if any critical service is down.
#
# History — why this script keeps producing false alerts and what we fixed:
#   - data-node moved to native systemd (data-node-shadow.service). The old
#     testnet-data-node container check would always report "missing → CRITICAL".
#   - The oracle Docker HEALTHCHECK probes /ready, which is a deployment-ceremony
#     gate (returns 503 when registry_sync isn't fully caught up — by design).
#     Runtime health lives at /health. We now trust the API probe and only
#     escalate Docker's unhealthy verdict to a soft WARN.

# No `set -e` — every check must run, even if a probe fails. We track failures
# explicitly via add_alert/add_warn. `set -u` is also a footgun for variable
# composition; leave it off and validate inputs directly.
set -o pipefail

REPORT_FILE="/home/max/index/logs/health-report.json"
ALERT_FILE="/home/max/index/logs/health-alert.txt"
LOG_DIR="/home/max/index/logs"
mkdir -p "$LOG_DIR"

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CRITICAL=0
WARN=0
ALERTS=""

add_alert() {
    ALERTS="${ALERTS}CRITICAL: ${1}"$'\n'
    CRITICAL=$((CRITICAL + 1))
}
add_warn() {
    ALERTS="${ALERTS}WARN: ${1}"$'\n'
    WARN=$((WARN + 1))
}

is_int() {
    case "$1" in
        ''|*[!0-9]*) return 1 ;;
        *) return 0 ;;
    esac
}

check_container() {
    local name="$1"
    local critical="${2:-true}"
    local trust_healthcheck="${3:-true}"

    local status health restarts oom
    status=$(docker inspect "$name" --format '{{.State.Status}}' 2>/dev/null) || status="missing"
    health=$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' 2>/dev/null) || health="unknown"
    restarts=$(docker inspect "$name" --format '{{.RestartCount}}' 2>/dev/null) || restarts="?"
    oom=$(docker inspect "$name" --format '{{.State.OOMKilled}}' 2>/dev/null) || oom="?"

    printf '  %-28s status=%s health=%s restarts=%s oom=%s\n' "$name" "$status" "$health" "$restarts" "$oom"

    if [ "$status" != "running" ]; then
        if [ "$critical" = "true" ]; then
            add_alert "$name is $status (not running)"
        else
            add_warn "$name is $status (not running)"
        fi
        return
    fi
    if [ "$oom" = "true" ]; then
        add_alert "$name was OOM-killed"
    fi
    if is_int "$restarts" && [ "$restarts" -gt 3 ]; then
        add_warn "$name has $restarts restarts"
    fi
    # Docker healthcheck is advisory. Oracles use /ready, which is a deploy-time
    # gate and stays 503 in steady state. Only warn — never CRITICAL.
    if [ "$health" = "unhealthy" ] && [ "$trust_healthcheck" = "true" ]; then
        add_warn "$name docker healthcheck reports unhealthy"
    fi
}

check_systemd_unit() {
    local unit="$1"
    local critical="${2:-true}"
    local state
    state=$(systemctl is-active "$unit" 2>/dev/null) || state="unknown"

    local since=""
    if [ "$state" = "active" ]; then
        since=$(systemctl show "$unit" --property=ActiveEnterTimestamp --value 2>/dev/null)
    fi
    printf '  %-28s state=%s since="%s"\n' "$unit" "$state" "$since"

    if [ "$state" != "active" ]; then
        if [ "$critical" = "true" ]; then
            add_alert "systemd unit $unit is $state"
        else
            add_warn "systemd unit $unit is $state"
        fi
    fi
}

probe_http() {
    local label="$1" url="$2" critical="${3:-true}"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null) || code="000"
    printf '  %-28s code=%s url=%s\n' "$label" "$code" "$url"
    if [ "$code" != "200" ]; then
        if [ "$critical" = "true" ]; then
            add_alert "$label unreachable or unhealthy (HTTP $code)"
        else
            add_warn "$label unreachable or unhealthy (HTTP $code)"
        fi
        return 1
    fi
    return 0
}

echo "[$TS] Health check starting..."

# ── VPS 1 containers ──────────────────────────────────────────
# data-node is NOT a container any more — moved to native systemd post-Netcup.
# testnet-itp-bot lives here; vision-swarm and bot-bot-* are non-critical.
echo "Docker containers:"
for svc in testnet-oracle-1 testnet-oracle-2 testnet-oracle-3; do
    # Oracle container healthcheck hits /ready which is wrong for runtime.
    # Trust the API probe below instead; treat Docker verdict as advisory.
    check_container "$svc" true false
done
for svc in testnet-itp-bot testnet-curator testnet-sonic-proxy fund-manager; do
    check_container "$svc" true true
done

# ── Native systemd services ──────────────────────────────────
echo "Systemd units:"
check_systemd_unit data-node-shadow true
check_systemd_unit vision-keeper false

# ── API health probes (authoritative) ─────────────────────────
echo "API probes:"
probe_http "oracle-1-health" "http://127.0.0.1:10001/health"
probe_http "oracle-2-health" "http://127.0.0.1:10002/health"
probe_http "oracle-3-health" "http://127.0.0.1:10003/health"
probe_http "data-node-health" "http://127.0.0.1:8200/health"
probe_http "oracle-leaderboard" "http://127.0.0.1:10001/vision/leaderboard"

# ── Fund-manager heartbeat ────────────────────────────────────

HEARTBEAT="/home/max/index/docker/testnet/fund-manager/pnl-data/heartbeat.json"
if [ -f "$HEARTBEAT" ]; then
    HB_AGE=$(python3 - "$HEARTBEAT" <<'PY' 2>/dev/null || echo "ERROR"
import json, sys, time
try:
    d = json.load(open(sys.argv[1]))
    age = int(time.time() - d['ts'])
    cycle = d.get('cycle', 0)
    joined = d.get('joined', 0)
    match = bool(d.get('source_match', False))
    print(f"age={age}s cycle={cycle} joined={joined} match={match}")
    if age > 300:
        print("STALE")
    elif not match and cycle > 3:
        print("NO_MATCH")
    else:
        print("OK")
except Exception as e:
    print(f"ERROR: {e}")
    print("ERROR")
PY
)
    printf '  %-28s %s\n' "fund-manager-heartbeat" "$(printf '%s' "$HB_AGE" | tr '\n' ' ')"
    case "$HB_AGE" in
        *STALE*)    add_alert "Fund-manager heartbeat stale (>5 min)" ;;
        *NO_MATCH*) add_alert "Fund-manager has no source matches — joining nothing" ;;
        *ERROR*)    add_warn  "Fund-manager heartbeat unreadable" ;;
    esac
else
    printf '  %-28s missing\n' "fund-manager-heartbeat"
    fm_up=$(docker inspect fund-manager --format '{{.State.Status}}' 2>/dev/null) || fm_up="missing"
    [ "$fm_up" = "running" ] && add_warn "Fund-manager running but no heartbeat file"
fi

# ── Oracle progress + consensus ───────────────────────────────
# `docker logs --since` is expensive — only run if oracle-1 is running.
oracle_state=$(docker inspect testnet-oracle-1 --format '{{.State.Status}}' 2>/dev/null) || oracle_state="missing"
if [ "$oracle_state" = "running" ]; then
    SETTLED=$(docker logs testnet-oracle-1 --since 10m 2>&1 | grep -c "Round settled" 2>/dev/null)
    CONSENSUS_FAILS=$(docker logs testnet-oracle-1 --since 10m 2>&1 | grep -c -E "payouts_hash.*mismatch|co-sign.*fail|equivocation" 2>/dev/null)
    is_int "$SETTLED" || SETTLED=0
    is_int "$CONSENSUS_FAILS" || CONSENSUS_FAILS=0
    printf '  %-28s rounds-settled-10m=%s consensus-fails-10m=%s\n' "oracle-progress" "$SETTLED" "$CONSENSUS_FAILS"
    [ "$CONSENSUS_FAILS" -gt 10 ] && add_warn "$CONSENSUS_FAILS oracle consensus failures in last 10 min"
fi

# ── Host resources ────────────────────────────────────────────
MEM_AVAIL=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo 2>/dev/null)
DISK_PCT=$(df / --output=pcent 2>/dev/null | tail -1 | tr -d ' %')
SWAP_FREE=$(awk '/SwapFree/ {print int($2/1024)}' /proc/meminfo 2>/dev/null)
LOAD1=$(awk '{print $1}' /proc/loadavg 2>/dev/null)
NCPU=$(nproc 2>/dev/null || echo 1)

printf '  %-28s mem_mb=%s disk_pct=%s swap_free_mb=%s load1=%s ncpu=%s\n' \
    "host-resources" "$MEM_AVAIL" "$DISK_PCT" "$SWAP_FREE" "$LOAD1" "$NCPU"

is_int "$MEM_AVAIL" && [ "$MEM_AVAIL" -lt 1024 ] && add_warn "Low memory (${MEM_AVAIL}MB available)"
is_int "$DISK_PCT"  && [ "$DISK_PCT"  -gt 85   ] && add_warn "Disk usage at ${DISK_PCT}%"
is_int "$SWAP_FREE" && [ "$SWAP_FREE" -lt 256  ] && add_warn "Swap nearly exhausted (${SWAP_FREE}MB free)"

# load1 / ncpu > 4 means sustained heavy oversubscription.
if [ -n "$LOAD1" ] && is_int "$NCPU"; then
    load_ratio=$(awk -v l="$LOAD1" -v n="$NCPU" 'BEGIN { printf "%.0f", (l / n) * 100 }')
    if is_int "$load_ratio" && [ "$load_ratio" -gt 400 ]; then
        add_warn "load1 ${LOAD1} is ${load_ratio}% of ${NCPU} CPUs"
    fi
fi

# ── Report ────────────────────────────────────────────────────
echo ""
if [ "$CRITICAL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
    STATUS="HEALTHY"
    rm -f "$ALERT_FILE"
elif [ "$CRITICAL" -eq 0 ]; then
    STATUS="DEGRADED"
else
    STATUS="CRITICAL"
fi

echo "STATUS: $STATUS"
if [ -n "$ALERTS" ]; then
    echo ""
    echo "ALERTS:"
    printf '%s' "$ALERTS"
    {
        echo "[$TS]"
        printf '%s' "$ALERTS"
    } > "$ALERT_FILE"
fi

# Machine-readable report. Write atomically to avoid partial reads.
python3 - "$REPORT_FILE" "$TS" "$STATUS" "$CRITICAL" "$WARN" <<PY 2>/dev/null
import json, os, sys
path, ts, status, critical, warn = sys.argv[1:6]
alerts = """$ALERTS""".strip().splitlines()
tmp = path + ".tmp"
with open(tmp, "w") as f:
    json.dump({
        "ts": ts,
        "status": status,
        "critical_count": int(critical),
        "warn_count": int(warn),
        "alerts": alerts,
    }, f, indent=2)
os.replace(tmp, path)
PY

echo ""
echo "[$TS] Health check complete."
[ "$CRITICAL" -eq 0 ]
