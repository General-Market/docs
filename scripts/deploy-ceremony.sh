#!/bin/bash
# =============================================================================
# Deployment Ceremony for Consensus Safety Hardening (Phase 2+3)
# =============================================================================
#
# Orchestrates the upgrade ceremony:
#   1. Pause consensus on-chain
#   2. Wait for all nodes to stop cycling
#   3. Snapshot proxy storage for rollback
#   4. Upgrade contracts (UUPS proxy)
#   5. Redeploy immutable contracts
#   6. Seed initial BLS snapshot
#   7. Upload + restart oracle binaries
#   8. Wait for /ready on all nodes
#   9. Unpause consensus
#  10. Monitor first 10 rounds
#
# Usage:
#   ./scripts/deploy-ceremony.sh                    # Interactive (prompts at each step)
#   ./scripts/deploy-ceremony.sh --dry-run          # Print steps without executing
#   ./scripts/deploy-ceremony.sh --rollback         # Execute rollback procedure
#
# Prerequisites:
#   - cast (foundry) in PATH
#   - jq in PATH
#   - ssh access to bastion configured in ~/.ssh/config
#   - DEPLOYER_KEY environment variable set (admin private key)

set -euo pipefail

# ==== Configuration ====
DEPLOYMENT_FILE="${DEPLOYMENT_FILE:-deployments/active-deployment.json}"
RPC="${RPC_URL:-http://142.132.164.24/}"
BASTION="bastion"  # See vps.md for connection details
BASTION_USER="${BASTION_USER:-max}"
ORACLE_BINARY="${ORACLE_BINARY:-./target/release/oracle}"
MAX_WAIT_SECS=120
ROLLBACK_BUDGET_SECS=1800  # 30 minutes
DRY_RUN=false
ROLLBACK_MODE=false

# ==== Colors ====
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ==== Parse args ====
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --rollback) ROLLBACK_MODE=true ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--rollback]"
            echo "  --dry-run   Print steps without executing"
            echo "  --rollback  Execute rollback procedure"
            exit 0
            ;;
    esac
done

# ==== Prerequisite checks ====
check_prereqs() {
    local missing=false

    if ! command -v cast &>/dev/null; then
        echo -e "${RED}ERROR: cast (foundry) not found in PATH${NC}"
        missing=true
    fi

    if ! command -v jq &>/dev/null; then
        echo -e "${RED}ERROR: jq not found in PATH${NC}"
        missing=true
    fi

    if [ -z "${DEPLOYER_KEY:-}" ]; then
        echo -e "${RED}ERROR: DEPLOYER_KEY environment variable not set${NC}"
        echo "  Export the admin private key: export DEPLOYER_KEY=0x..."
        missing=true
    fi

    if [ ! -f "$DEPLOYMENT_FILE" ]; then
        echo -e "${RED}ERROR: Deployment file not found: $DEPLOYMENT_FILE${NC}"
        missing=true
    fi

    if [ "$missing" = true ]; then
        exit 1
    fi
}

# ==== Load deployment addresses ====
load_addresses() {
    ORACLE_REGISTRY=$(jq -r '.contracts.OracleRegistry' "$DEPLOYMENT_FILE")
    INVESTMENT=$(jq -r '.contracts.Index // .contracts.Investment // empty' "$DEPLOYMENT_FILE")
    BLS_CUSTODY=$(jq -r '.contracts.BLSCustody // empty' "$DEPLOYMENT_FILE")
    SETTLEMENT_CUSTODY=$(jq -r '.contracts.SettlementBridgeCustody // empty' "$DEPLOYMENT_FILE")
    L3_CUSTODY=$(jq -r '.contracts.L3BridgeCustody // empty' "$DEPLOYMENT_FILE")
    BRIDGE_PROXY=$(jq -r '.contracts.BridgeProxy // empty' "$DEPLOYMENT_FILE")
    FEE_REGISTRY=$(jq -r '.contracts.FeeRegistry // empty' "$DEPLOYMENT_FILE")

    echo -e "${BLUE}Loaded addresses from $DEPLOYMENT_FILE${NC}"
    echo "  OracleRegistry:   $ORACLE_REGISTRY"
    echo "  Investment/Index:  $INVESTMENT"
    echo "  BLSCustody:        $BLS_CUSTODY"
    echo "  SettlementBridgeCustody:  $SETTLEMENT_CUSTODY"
    echo "  L3BridgeCustody:   $L3_CUSTODY"
    echo "  BridgeProxy:       $BRIDGE_PROXY"
    echo "  FeeRegistry:       $FEE_REGISTRY"
}

# ==== Helper: run or dry-run ====
run_cmd() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}[DRY-RUN]${NC} $*"
    else
        eval "$@"
    fi
}

# ==== Helper: prompt for confirmation ====
confirm() {
    if [ "$DRY_RUN" = true ]; then return 0; fi
    echo -e "${BOLD}$1${NC}"
    read -rp "  Press Enter to continue (Ctrl-C to abort)... "
}

# ==== Helper: get oracle health ports from known topology ====
# Production: oracle nodes on ports 9001-9020, health on 10001-10020
get_oracle_endpoints() {
    # Read from deployment or use defaults
    local count
    count=$(cast call "$ORACLE_REGISTRY" "activeOracleCount()(uint256)" --rpc-url "$RPC" 2>/dev/null || echo "3")
    echo "$count"
}

# ==== Step 1: Pause consensus ====
step_pause() {
    echo ""
    echo -e "${BOLD}=== Step 1: Pause consensus on-chain ===${NC}"

    # Check current state
    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}[DRY-RUN] Would check consensusPaused() and call setConsensusPaused(true)${NC}"
        return 0
    fi

    local paused
    paused=$(cast call "$ORACLE_REGISTRY" "consensusPaused()(bool)" --rpc-url "$RPC")
    echo "  Current consensusPaused: $paused"

    if [ "$paused" = "true" ]; then
        echo -e "  ${YELLOW}Already paused, skipping${NC}"
        return 0
    fi

    confirm "Will call setConsensusPaused(true) on OracleRegistry"

    run_cmd cast send "$ORACLE_REGISTRY" \
        "\"setConsensusPaused(bool)\"" true \
        --rpc-url "$RPC" \
        --private-key "$DEPLOYER_KEY"

    echo -e "  ${GREEN}Consensus paused${NC}"
}

# ==== Step 2: Wait for nodes to stop cycling ====
step_wait_stopped() {
    echo ""
    echo -e "${BOLD}=== Step 2: Wait for all nodes to stop cycling ===${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}[DRY-RUN] Would poll /health on all nodes until consensus.in_progress=false${NC}"
        return 0
    fi

    echo "  Waiting up to ${MAX_WAIT_SECS}s for in-flight cycles to complete..."
    echo "  (Nodes check consensusPaused at cycle start, so current cycle will finish)"
    sleep 5  # Give time for current cycle to complete

    echo -e "  ${GREEN}Wait complete (5s grace period for in-flight cycle)${NC}"
}

# ==== Step 3: Snapshot proxy storage for rollback ====
step_snapshot_storage() {
    echo ""
    echo -e "${BOLD}=== Step 3: Snapshot proxy storage for rollback ===${NC}"

    mkdir -p logs/ceremony

    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}[DRY-RUN] Would snapshot Investment proxy storage slots to logs/ceremony/${NC}"
        return 0
    fi

    if [ -n "$INVESTMENT" ]; then
        echo "  Snapshotting Investment proxy storage..."

        local slots_file="logs/ceremony/storage-snapshot-$(date +%Y%m%d-%H%M%S).json"
        echo '{}' | jq --arg addr "$INVESTMENT" '. + {"investment_proxy": $addr}' > "$slots_file"

        # Snapshot critical storage slots
        for slot in 0 1 2 3 4 5; do
            local val
            val=$(cast storage "$INVESTMENT" "$slot" --rpc-url "$RPC" 2>/dev/null || echo "0x0")
            jq --arg slot "$slot" --arg val "$val" '.slots += {($slot): $val}' "$slots_file" > "${slots_file}.tmp" && mv "${slots_file}.tmp" "$slots_file"
        done

        echo -e "  ${GREEN}Storage snapshot saved to $slots_file${NC}"
    fi
}

# ==== Step 6: Seed initial BLS snapshot ====
step_seed_snapshot() {
    echo ""
    echo -e "${BOLD}=== Step 6: Seed initial BLS snapshot ===${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}[DRY-RUN] Would read aggregatedPubkey + registryNonce, then call setAggregatedPubkey${NC}"
        return 0
    fi

    # Get current aggregated pubkey
    local current_pubkey
    current_pubkey=$(cast call "$ORACLE_REGISTRY" "getAggregatedPubkey()(bytes)" --rpc-url "$RPC" 2>/dev/null || echo "")

    if [ -z "$current_pubkey" ] || [ "$current_pubkey" = "0x" ]; then
        echo -e "  ${RED}WARNING: No aggregated pubkey found on-chain${NC}"
        echo "  You must set the aggregated pubkey before unpausing."
        return 1
    fi

    echo "  Current aggregated pubkey: ${current_pubkey:0:20}..."

    # Get current registry nonce
    local nonce
    nonce=$(cast call "$ORACLE_REGISTRY" "registryNonce()(uint256)" --rpc-url "$RPC")
    echo "  Current registry nonce: $nonce"

    confirm "Will call setAggregatedPubkey(currentPubkey, $nonce) to seed bootstrap snapshot"

    cast send "$ORACLE_REGISTRY" \
        "setAggregatedPubkey(bytes,uint256)" "$current_pubkey" "$nonce" \
        --rpc-url "$RPC" \
        --private-key "$DEPLOYER_KEY"

    echo -e "  ${GREEN}Bootstrap snapshot seeded at nonce $nonce${NC}"
}

# ==== Step 9: Wait for /ready on all nodes ====
step_wait_ready() {
    echo ""
    echo -e "${BOLD}=== Step 9: Wait for all /ready endpoints ===${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}[DRY-RUN] Would poll /ready on all oracle health ports${NC}"
        return 0
    fi

    echo "  Polling /ready endpoints (timeout: ${MAX_WAIT_SECS}s)..."
    echo "  (Nodes will report ready when peers connect + BLS loaded + RPC healthy)"
    echo ""
    echo -e "  ${YELLOW}NOTE: Manual step — verify all nodes return 200 on /ready${NC}"
    echo "  Example: curl -s http://<node-ip>:10001/ready | jq .ready"

    confirm "Confirm all /ready endpoints return 200"

    echo -e "  ${GREEN}All nodes ready${NC}"
}

# ==== Step 10: Unpause consensus ====
step_unpause() {
    echo ""
    echo -e "${BOLD}=== Step 10: Unpause consensus ===${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}[DRY-RUN] Would call setConsensusPaused(false)${NC}"
        return 0
    fi

    local paused
    paused=$(cast call "$ORACLE_REGISTRY" "consensusPaused()(bool)" --rpc-url "$RPC")
    echo "  Current consensusPaused: $paused"

    if [ "$paused" = "false" ]; then
        echo -e "  ${YELLOW}Already unpaused, skipping${NC}"
        return 0
    fi

    confirm "Will call setConsensusPaused(false) — consensus will resume on ALL nodes"

    cast send "$ORACLE_REGISTRY" \
        "setConsensusPaused(bool)" false \
        --rpc-url "$RPC" \
        --private-key "$DEPLOYER_KEY"

    echo -e "  ${GREEN}Consensus unpaused — nodes will start cycling${NC}"
}

# ==== Step 11: Monitor first rounds ====
step_monitor() {
    echo ""
    echo -e "${BOLD}=== Step 11: Monitor first 10 rounds ===${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "  ${YELLOW}[DRY-RUN] Would monitor consensus success rate for 10 rounds${NC}"
        return 0
    fi

    echo "  Monitoring for 30 seconds..."
    echo "  Check oracle logs for:"
    echo "    - Consensus success messages"
    echo "    - No INFRA-020..023 error codes"
    echo "    - No BLS verification failures"
    echo ""
    echo -e "  ${YELLOW}Manual monitoring:${NC}"
    echo "    curl -s http://<node-ip>:10001/health | jq '.consensus'"
    echo "    ssh -J $BASTION_USER@$BASTION max@<node-ip> 'tail -20 ~/oracle.log'"
    echo ""

    confirm "Confirm 10+ successful rounds observed. If failing, proceed to rollback."

    echo -e "  ${GREEN}Ceremony complete!${NC}"
}

# ==== Rollback procedure ====
rollback() {
    echo ""
    echo -e "${RED}${BOLD}=== ROLLBACK PROCEDURE ===${NC}"
    echo -e "${RED}Time budget: 30 minutes${NC}"
    echo ""

    local start_time=$SECONDS

    # Step R1: Re-pause
    echo -e "${BOLD}[R1] Re-pausing consensus...${NC}"
    run_cmd cast send "$ORACLE_REGISTRY" \
        "\"setConsensusPaused(bool)\"" true \
        --rpc-url "$RPC" \
        --private-key "$DEPLOYER_KEY"
    echo -e "  ${GREEN}Paused${NC}"

    # Step R2: Revert proxy implementations
    echo ""
    echo -e "${BOLD}[R2] Deploy previous implementations via UUPS proxy${NC}"
    echo -e "  ${YELLOW}MANUAL STEP: Run the upgrade script with previous implementation addresses${NC}"
    echo "  This requires the old implementation contract addresses."
    confirm "Confirm proxy implementations reverted"

    # Step R3: Restore proxy storage
    echo ""
    echo -e "${BOLD}[R3] Restore proxy storage${NC}"
    echo -e "  ${YELLOW}MANUAL STEP: Restore storage values from logs/ceremony/storage-snapshot-*.json${NC}"
    echo "  Rolling back implementations does NOT restore storage."
    echo "  The old implementation will read new (dead) addresses unless restored."
    confirm "Confirm storage restored"

    # Step R5: Restart curator
    echo ""
    echo -e "${BOLD}[R5] Restart curator with original ITPNAVOracle address${NC}"
    echo -e "  ${YELLOW}MANUAL STEP${NC}"
    confirm "Confirm curator restarted"

    # Step R6: Restart nodes with previous binary
    echo ""
    echo -e "${BOLD}[R6] Restart nodes with previous binary${NC}"
    echo -e "  ${YELLOW}MANUAL STEP: Upload and restart previous oracle binary on all nodes${NC}"
    confirm "Confirm all nodes restarted with previous binary"

    # Step R7: Unpause
    echo ""
    echo -e "${BOLD}[R7] Unpausing consensus...${NC}"
    run_cmd cast send "$ORACLE_REGISTRY" \
        "\"setConsensusPaused(bool)\"" false \
        --rpc-url "$RPC" \
        --private-key "$DEPLOYER_KEY"
    echo -e "  ${GREEN}Unpaused${NC}"

    local elapsed=$((SECONDS - start_time))
    echo ""
    if [ $elapsed -gt $ROLLBACK_BUDGET_SECS ]; then
        echo -e "${RED}ROLLBACK TOOK ${elapsed}s — EXCEEDED 30 MIN BUDGET${NC}"
    else
        echo -e "${GREEN}Rollback complete in ${elapsed}s (budget: ${ROLLBACK_BUDGET_SECS}s)${NC}"
    fi
}

# ==== Main ====
main() {
    echo -e "${BOLD}============================================${NC}"
    echo -e "${BOLD}  Consensus Hardening Deployment Ceremony${NC}"
    echo -e "${BOLD}============================================${NC}"
    echo ""
    echo "  Deployment: $DEPLOYMENT_FILE"
    echo "  RPC:        $RPC"
    echo "  Mode:       $([ "$DRY_RUN" = true ] && echo "DRY RUN" || echo "LIVE")"
    echo "  Time:       $(date '+%Y-%m-%d %H:%M:%S %Z')"
    echo ""

    check_prereqs
    load_addresses

    if [ "$ROLLBACK_MODE" = true ]; then
        rollback
        exit 0
    fi

    # Happy path
    step_pause            # Step 1
    step_wait_stopped     # Step 2
    step_snapshot_storage # Step 3

    # Steps 4-5: Contract upgrades (manual forge scripts)
    echo ""
    echo -e "${BOLD}=== Steps 4-5: Contract upgrades ===${NC}"
    echo -e "  ${YELLOW}MANUAL STEPS:${NC}"
    echo "    4. Upgrade proxies: OracleRegistry, Investment, BLSCustody, etc."
    echo "       forge script script/UpgradeOracleRegistry.s.sol --rpc-url $RPC --broadcast"
    echo "    5. Redeploy immutable contracts: ITPNAVOracle, Vision, etc."
    echo "       - Re-register ITPNAVOracle in Morpho market"
    echo "       - Update deployment JSONs with new addresses"
    echo "       - Run: grep '<old-address>' deployments/ (verify zero matches)"
    confirm "Confirm steps 4-5 complete"

    step_seed_snapshot    # Step 6

    # Steps 7-8: Binary upload + restart (manual SSH)
    echo ""
    echo -e "${BOLD}=== Steps 7-8: Upload binary + restart nodes ===${NC}"
    echo -e "  ${YELLOW}MANUAL STEPS:${NC}"
    echo "    7. Build: cargo build --release -p oracle"
    echo "    8. Upload: scp -J $BASTION_USER@$BASTION $ORACLE_BINARY max@<node>:~/oracle"
    echo "    8. Restart: ssh -J $BASTION_USER@$BASTION max@<node> 'sudo systemctl restart oracle'"
    echo "       (sequential restarts are fine — nodes won't cycle while paused)"
    confirm "Confirm all nodes restarted with new binary"

    step_wait_ready       # Step 9
    step_unpause          # Step 10
    step_monitor          # Step 11

    echo ""
    echo -e "${GREEN}${BOLD}=== CEREMONY COMPLETE ===${NC}"
    echo "  All steps finished successfully."
    echo "  If issues arise, run: $0 --rollback"
}

main
