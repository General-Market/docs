#!/usr/bin/env bash
# stop.sh - Gracefully shut down Index dual-chain local development environment
#
# Stops both L3 Anvil (port 8545) and Arbitrum Anvil (port 8546),
# plus all issuers, AP, and data-node services.
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

# Ports to check for orphan processes (8545=L3 Anvil, 8546=Arb Anvil, 8200=data-node, 9001-9020=issuers, 9100=AP)
PORTS_TO_CHECK="3000 8545 8546 8200 9100"
for i in $(seq 1 20); do
    PORTS_TO_CHECK="$PORTS_TO_CHECK $((9000 + i))"
done

echo -e "${BLUE}Stopping Index dual-chain local environment (L3 + Arbitrum)...${NC}"
echo ""

# Check if PIDs file exists
if [ ! -f .pids ]; then
    echo -e "${YELLOW}No .pids file found. Checking for orphan processes...${NC}"
else
    # Read PIDs and send SIGTERM
    echo -e "${YELLOW}Sending SIGTERM to all processes...${NC}"

    PIDS_SENT=""
    while read -r PID; do
        if [ -n "$PID" ] && kill -0 $PID 2>/dev/null; then
            # Try to get name from info file
            NAME="unknown"
            if [ -f .pids.info ]; then
                NAME=$(grep ":$PID$" .pids.info 2>/dev/null | cut -d: -f1 || echo "unknown")
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

    # Clean up PID files
    rm -f .pids .pids.info
    echo -e "  ${GREEN}PID files cleaned up${NC}"

    # Clean data-node DB of stale deployment data
    echo -e "${YELLOW}Cleaning data-node DB...${NC}"
    PSQL_BIN=$(command -v psql 2>/dev/null || find /opt/homebrew /usr/local -name "psql" -type f 2>/dev/null | head -1)
    if [ -n "$PSQL_BIN" ]; then
        $PSQL_BIN index_prices -c "TRUNCATE itp_snapshots;" 2>/dev/null && \
            echo -e "  ${GREEN}ITP snapshots cleaned${NC}" || \
            echo -e "  ${YELLOW}Skipped (DB not available)${NC}"
        $PSQL_BIN index_prices -c "DELETE FROM price_history;" 2>/dev/null && \
            echo -e "  ${GREEN}Price history cleaned${NC}" || true
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
echo -e "${GREEN}║               LOCAL ENVIRONMENT STOPPED                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
