#!/usr/bin/env bash
set -euo pipefail

# Bridge Integration Test Runner
# Runs BridgeIntegrationTest (L3 <-> Arbitrum two-phase bridge tests)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$SCRIPT_DIR/../contracts"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo " Bridge Integration Test (L3 <-> Arbitrum)"
echo "========================================="
echo ""

cd "$CONTRACTS_DIR"

# Parse arguments
FORK_URL=""
VERBOSITY="-vvv"

while [[ $# -gt 0 ]]; do
    case $1 in
        --fork-url)
            FORK_URL="$2"
            shift 2
            ;;
        -v|-vv|-vvv|-vvvv)
            VERBOSITY="$1"
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Usage: $0 [--fork-url <RPC_URL>] [-v|-vv|-vvv|-vvvv]"
            exit 1
            ;;
    esac
done

# Build command as array to handle glob patterns correctly
CMD=(forge test --match-contract BridgeIntegrationTest --match-path 'test/integration/*' "$VERBOSITY")

if [ -n "$FORK_URL" ]; then
    echo -e "${YELLOW}Running with forked Arbitrum: $FORK_URL${NC}"
    CMD+=(--fork-url "$FORK_URL")
else
    echo "Running with local simulation (no fork)"
fi

echo ""
echo "Command: ${CMD[*]}"
echo ""

# Run tests
if "${CMD[@]}"; then
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN} All bridge integration tests PASSED${NC}"
    echo -e "${GREEN}=========================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}=========================================${NC}"
    echo -e "${RED} Bridge integration tests FAILED${NC}"
    echo -e "${RED}=========================================${NC}"
    exit 1
fi
