#!/usr/bin/env bash
# stop.sh - Gracefully shut down Index blockchain local development environment
#
# Stops both L3 Anvil (port 8545) and Arbitrum Anvil (port 8546),
# plus all issuers, AP, and vision bots.
# Does NOT stop: data-node, frontend.
# Sends SIGTERM to all processes, waits for graceful shutdown, then SIGKILL if needed.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ports to check for orphan processes (8545=L3 Anvil, 8546=Arb Anvil, 9001-9020=issuers, 9100=AP)
# NOTE: data-node (8200) and frontend (3000) are intentionally NOT stopped
PORTS_TO_CHECK="8545 8546 9100"
for i in $(seq 1 20); do
    PORTS_TO_CHECK="$PORTS_TO_CHECK $((9000 + i))"
done

echo -e "${BLUE}Stopping Index blockchain services (L3 + Arbitrum + issuers + AP)...${NC}"
echo ""

# Check if PIDs file exists
if [ ! -f .pids ]; then
    echo -e "${YELLOW}No .pids file found. Checking for orphan processes...${NC}"
else
    # Read PIDs and send SIGTERM
    echo -e "${YELLOW}Sending SIGTERM to all processes...${NC}"

    # Processes to keep running (not blockchain-related)
    KEEP_PROCS="data-node frontend"

    PIDS_SENT=""
    PIDS_KEPT=""
    while read -r PID; do
        if [ -n "$PID" ] && kill -0 $PID 2>/dev/null; then
            # Try to get name from info file
            NAME="unknown"
            if [ -f .pids.info ]; then
                NAME=$(grep ":$PID$" .pids.info 2>/dev/null | cut -d: -f1 || echo "unknown")
            fi

            # Skip processes we want to keep running
            SKIP=false
            for KEEP in $KEEP_PROCS; do
                if [ "$NAME" = "$KEEP" ]; then
                    SKIP=true
                    break
                fi
            done
            if $SKIP; then
                echo -e "  ${GREEN}Keeping $NAME (PID: $PID)${NC}"
                PIDS_KEPT="$PIDS_KEPT $PID"
                continue
            fi

            echo -e "  Stopping $NAME (PID: $PID)"
            kill -TERM $PID 2>/dev/null || true
            PIDS_SENT="$PIDS_SENT $PID"
        fi
    done < .pids

    # Wait up to 5 seconds for graceful shutdown
    if [ -n "$PIDS_SENT" ]; then
        echo -e "${YELLOW}Waiting for graceful shutdown (5 seconds max)...${NC}"

        for i in $(seq 1 10); do
            ALL_STOPPED=true
            for PID in $PIDS_SENT; do
                if kill -0 $PID 2>/dev/null; then
                    ALL_STOPPED=false
                    break
                fi
            done

            if $ALL_STOPPED; then
                echo -e "  ${GREEN}All processes stopped gracefully${NC}"
                break
            fi

            sleep 0.5
        done

        # Force kill any remaining processes
        for PID in $PIDS_SENT; do
            if kill -0 $PID 2>/dev/null; then
                echo -e "  ${YELLOW}Force killing PID $PID${NC}"
                kill -9 $PID 2>/dev/null || true
            fi
        done
    fi

    # Rewrite PID files with only kept processes
    if [ -n "$PIDS_KEPT" ]; then
        > .pids.new
        > .pids.info.new
        for PID in $PIDS_KEPT; do
            echo "$PID" >> .pids.new
            grep ":$PID$" .pids.info >> .pids.info.new 2>/dev/null || true
        done
        mv .pids.new .pids
        mv .pids.info.new .pids.info
        echo -e "  ${GREEN}PID files updated (kept running processes)${NC}"
    else
        rm -f .pids .pids.info
        echo -e "  ${GREEN}PID files cleaned up${NC}"
    fi

    # Clean session-only on-chain data (preserve prices, klines, coingecko data)
    echo -e "${YELLOW}Cleaning session data (preserving price/market data)...${NC}"
    PSQL_BIN=$(command -v psql 2>/dev/null || find /opt/homebrew /usr/local -name "psql" -type f 2>/dev/null | head -1)
    if [ -n "$PSQL_BIN" ]; then
        $PSQL_BIN index_prices -c "TRUNCATE itp_snapshots, trades;" 2>/dev/null && \
            echo -e "  ${GREEN}ITP snapshots + trades cleaned${NC}" || \
            echo -e "  ${YELLOW}Skipped ITP tables (DB not available)${NC}"

        # Flush all vision batch data (positions, bitmaps, ticks, etc.)
        # CASCADE handles FK constraints (vision_positions, vision_tick_results -> vision_batches)
        $PSQL_BIN index_prices -c "
            TRUNCATE vision_tick_results, vision_positions, vision_bitmaps,
                     vision_reference_prices, vision_last_resolved, vision_kv_store CASCADE;
            TRUNCATE vision_batches CASCADE;
            TRUNCATE batch_configs, batch_settlements, signed_batch_configs CASCADE;
        " 2>/dev/null && \
            echo -e "  ${GREEN}Vision batch data flushed (batches, positions, bitmaps, ticks)${NC}" || \
            echo -e "  ${YELLOW}Skipped vision flush (tables may not exist)${NC}"

        echo -e "  ${GREEN}Preserved: market_prices, market_assets, market_prices_latest, klines, coingecko${NC}"
    else
        echo -e "  ${YELLOW}Skipped (psql not found)${NC}"
    fi
fi

# Check for orphan processes on known ports
echo ""
echo -e "${YELLOW}Checking for orphan processes on ports...${NC}"

ORPHANS_FOUND=false
for PORT in $PORTS_TO_CHECK; do
    PID=$(lsof -ti :$PORT 2>/dev/null || true)
    if [ -n "$PID" ]; then
        ORPHANS_FOUND=true
        echo -e "  ${RED}Found process on port $PORT (PID: $PID)${NC}"

        # Get process name
        PROC_NAME=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
        echo -e "    Process: $PROC_NAME"

        # Kill it
        echo -e "    Killing..."
        kill -TERM $PID 2>/dev/null || true
        sleep 0.5
        if kill -0 $PID 2>/dev/null; then
            kill -9 $PID 2>/dev/null || true
        fi
        echo -e "    ${GREEN}Killed${NC}"
    fi
done

if ! $ORPHANS_FOUND; then
    echo -e "  ${GREEN}No orphan processes found${NC}"
fi

# Final verification
echo ""
echo -e "${YELLOW}Final verification...${NC}"

CLEAN=true
for PORT in $PORTS_TO_CHECK; do
    if lsof -ti :$PORT > /dev/null 2>&1; then
        echo -e "  ${RED}Warning: Port $PORT still in use${NC}"
        CLEAN=false
    fi
done

if $CLEAN; then
    echo -e "  ${GREEN}All ports are free${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          BLOCKCHAIN SERVICES STOPPED                         ║${NC}"
echo -e "${GREEN}║          (data-node + frontend still running)                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
