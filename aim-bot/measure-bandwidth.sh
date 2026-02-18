#!/bin/bash
# Bandwidth measurement wrapper using vnstat
# Usage:
#   measure-bandwidth.sh start           → record baseline counters
#   measure-bandwidth.sh stop [phase]    → compute delta and report
#   measure-bandwidth.sh rate [seconds]  → live traffic rate snapshot

STATE_FILE="/tmp/bw-measure-state.json"

get_counters() {
  # Always use /sys/class/net for reliable per-session delta measurement
  local iface=$(ip route | grep default | awk '{print $5}' | head -1)
  local rx=$(cat /sys/class/net/"$iface"/statistics/rx_bytes 2>/dev/null || echo 0)
  local tx=$(cat /sys/class/net/"$iface"/statistics/tx_bytes 2>/dev/null || echo 0)
  echo "{\"iface\":\"$iface\",\"rx\":$rx,\"tx\":$tx,\"ts\":$(date +%s)}"
}

case "$1" in
  start)
    counters=$(get_counters)
    echo "$counters" > "$STATE_FILE"
    echo "$counters"
    ;;
  stop)
    phase="${2:-unknown}"
    if [ ! -f "$STATE_FILE" ]; then
      echo '{"error":"No start state found. Run: measure-bandwidth.sh start"}'
      exit 1
    fi
    start_data=$(cat "$STATE_FILE")
    end_data=$(get_counters)

    start_rx=$(echo "$start_data" | python3 -c "import sys,json; print(json.load(sys.stdin)['rx'])")
    start_tx=$(echo "$start_data" | python3 -c "import sys,json; print(json.load(sys.stdin)['tx'])")
    start_ts=$(echo "$start_data" | python3 -c "import sys,json; print(json.load(sys.stdin)['ts'])")

    end_rx=$(echo "$end_data" | python3 -c "import sys,json; print(json.load(sys.stdin)['rx'])")
    end_tx=$(echo "$end_data" | python3 -c "import sys,json; print(json.load(sys.stdin)['tx'])")
    end_ts=$(echo "$end_data" | python3 -c "import sys,json; print(json.load(sys.stdin)['ts'])")

    delta_rx=$((end_rx - start_rx))
    delta_tx=$((end_tx - start_tx))
    delta_total=$((delta_rx + delta_tx))
    duration=$((end_ts - start_ts))

    # Human-readable sizes
    rx_mb=$(python3 -c "print(f'{$delta_rx / 1048576:.2f}')")
    tx_mb=$(python3 -c "print(f'{$delta_tx / 1048576:.2f}')")
    total_mb=$(python3 -c "print(f'{$delta_total / 1048576:.2f}')")

    echo "{\"phase\":\"$phase\",\"duration_s\":$duration,\"rx_bytes\":$delta_rx,\"tx_bytes\":$delta_tx,\"total_bytes\":$delta_total,\"rx_mb\":$rx_mb,\"tx_mb\":$tx_mb,\"total_mb\":$total_mb}"

    # Update start state for next phase
    echo "$end_data" > "$STATE_FILE"
    ;;
  rate)
    secs="${2:-10}"
    iface=$(ip route | grep default | awk '{print $5}' | head -1)
    vnstat -tr "$secs" -i "$iface" 2>/dev/null || echo '{"error":"vnstat not available, using /proc fallback"}'
    ;;
  *)
    echo "Usage: measure-bandwidth.sh [start|stop [phase]|rate [seconds]]"
    exit 1
    ;;
esac
