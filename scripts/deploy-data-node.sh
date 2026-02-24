#!/usr/bin/env bash
# deploy-data-node.sh — Zero-downtime deploy of data-node binary to prod-be VPS
#
# Usage:
#   ./scripts/deploy-data-node.sh              # full deploy
#   ./scripts/deploy-data-node.sh --dry-run    # show what would happen
#   ./scripts/deploy-data-node.sh --build-only # build but don't swap
#   ./scripts/deploy-data-node.sh --swap-only  # swap binary only (already built)

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────
VPS_SSH="index-maker/prod/be"
VPS_DEST="max@116.203.156.98"
RSYNC_SSH="ssh -p 3189 -o ProxyJump=max@65.109.10.32:3189"
BUILD_DIR="index-data-node-build"
WORK_DIR="index-dn-work"
BINARY_NAME="index-data-node"
LOG_FILE="index-data-node.log"
HEALTH_URL="http://localhost:8200/health"
HEALTH_TIMEOUT=30

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.data-node"

# ── Parse args ──────────────────────────────────────────────────────────
DRY_RUN=false
BUILD_ONLY=false
SWAP_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --dry-run)    DRY_RUN=true ;;
        --build-only) BUILD_ONLY=true ;;
        --swap-only)  SWAP_ONLY=true ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--build-only] [--swap-only]"
            exit 0
            ;;
        *) echo "Unknown arg: $arg"; exit 1 ;;
    esac
done

# ── Helpers ─────────────────────────────────────────────────────────────
info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
err()   { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

remote() {
    if $DRY_RUN; then
        echo -e "\033[0;90m[DRY-RUN] ssh: $*\033[0m"
    else
        ssh "$VPS_SSH" "$@"
    fi
}

do_rsync() {
    if $DRY_RUN; then
        echo -e "\033[0;90m[DRY-RUN] rsync $*\033[0m"
    else
        rsync -avz -e "$RSYNC_SSH" "$@"
    fi
}

# ── Step 1: Sync source to VPS ─────────────────────────────────────────
sync_source() {
    info "Syncing workspace to VPS build dir..."
    # Workspace root files
    do_rsync "$PROJECT_DIR/Cargo.toml" "$PROJECT_DIR/Cargo.lock" \
        "${VPS_DEST}:~/${BUILD_DIR}/"
    # common crate
    do_rsync --delete --exclude target \
        "$PROJECT_DIR/common/" \
        "${VPS_DEST}:~/${BUILD_DIR}/common/"
    # data-node crate
    do_rsync --delete --exclude target --exclude .git \
        "$PROJECT_DIR/data-node/" \
        "${VPS_DEST}:~/${BUILD_DIR}/data-node/"
    ok "Source synced"

    # Trim workspace to only synced crates (avoid missing issuer/ap/curator)
    info "Patching workspace Cargo.toml for data-node-only build..."
    remote "sed -i '/\"issuer\",/d; /\"ap\",/d; /\"curator\",/d' ~/${BUILD_DIR}/Cargo.toml"

    # Config files (preserve directory structure)
    info "Syncing config files..."
    do_rsync "$PROJECT_DIR/assets.json" \
        "${VPS_DEST}:~/${WORK_DIR}/"
    do_rsync "$PROJECT_DIR/data/symbol-map.json" \
        "${VPS_DEST}:~/${WORK_DIR}/data/"
    do_rsync "$PROJECT_DIR/deployments/active-deployment.json" \
        "$PROJECT_DIR/deployments/morpho-e2e.json" \
        "${VPS_DEST}:~/${WORK_DIR}/deployments/"

    # Env file with API keys
    if [ -f "$ENV_FILE" ]; then
        info "Uploading .env.data-node..."
        do_rsync "$ENV_FILE" "${VPS_DEST}:~/${WORK_DIR}/.env.data-node"
        ok "Env file uploaded"
    else
        warn "No .env.data-node found at $ENV_FILE"
    fi
}

# ── Step 2: Build on VPS ───────────────────────────────────────────────
build_remote() {
    info "Building data-node on VPS (this may take a few minutes)..."
    remote "source ~/.cargo/env && cd ~/${BUILD_DIR} && CARGO_TARGET_DIR=/home/max/cargo-target cargo build --release -p data-node 2>&1 | tail -5"
    ok "Build complete"
}

# ── Step 3-6: Swap binary ──────────────────────────────────────────────
swap_binary() {
    info "Backing up old binary..."
    remote "cp ~/${BINARY_NAME} ~/${BINARY_NAME}.bak 2>/dev/null || true"
    ok "Backup created"

    info "Stopping old process (SIGTERM)..."
    remote "pkill -f '${BINARY_NAME}' 2>/dev/null || true"
    sleep 3
    ok "Old process stopped"

    info "Copying new binary..."
    remote "cp /home/max/cargo-target/release/data-node ~/${BINARY_NAME} && chmod +x ~/${BINARY_NAME}"
    ok "New binary in place"

    info "Starting new process with all API keys..."
    remote "cd ~/${WORK_DIR} && bash -c '
        if [ -f .env.data-node ]; then
            set -a && source .env.data-node && set +a
        fi
        nohup ~/${BINARY_NAME} serve \
            --database-url \"postgres://datanode:datanode123@localhost:5432/index_prices\" \
            --assets-file ./assets.json \
            --symbol-map ./data/symbol-map.json \
            --rpc-url \"https://index.rpc.zeeve.net\" \
            --arb-rpc-url \"https://index.rpc.zeeve.net\" \
            --deployment-file ./deployments/active-deployment.json \
            --morpho-deployment-file ./deployments/morpho-e2e.json \
            \${FINNHUB_API_KEY:+--finnhub-api-key \"\$FINNHUB_API_KEY\"} \
            \${COINGECKO_API_KEY:+--coingecko-api-key \"\$COINGECKO_API_KEY\"} \
            \${FRED_API_KEY:+--fred-api-key \"\$FRED_API_KEY\"} \
            \${BLS_API_KEY:+--bls-api-key \"\$BLS_API_KEY\"} \
            \${NASDAQ_API_KEY:+--nasdaq-api-key \"\$NASDAQ_API_KEY\"} \
            \${TWITCH_CLIENT_ID:+--twitch-client-id \"\$TWITCH_CLIENT_ID\"} \
            \${TWITCH_CLIENT_SECRET:+--twitch-client-secret \"\$TWITCH_CLIENT_SECRET\"} \
            \${TMDB_API_KEY:+--tmdb-api-key \"\$TMDB_API_KEY\"} \
            \${BACKPACKTF_API_KEY:+--backpacktf-api-key \"\$BACKPACKTF_API_KEY\"} \
            \${MOVEBANK_USER:+--movebank-user \"\$MOVEBANK_USER\"} \
            \${MOVEBANK_PASSWORD:+--movebank-password \"\$MOVEBANK_PASSWORD\"} \
            \${EBIRD_API_KEY:+--ebird-api-key \"\$EBIRD_API_KEY\"} \
            \${CLOUDFLARE_RADAR_TOKEN:+--cloudflare-radar-token \"\$CLOUDFLARE_RADAR_TOKEN\"} \
            \${TREASURY_API_KEY:+--treasury-api-key \"\$TREASURY_API_KEY\"} \
            \${EIA_API_KEY:+--eia-api-key \"\$EIA_API_KEY\"} \
            \${GITHUB_TOKEN:+--github-token \"\$GITHUB_TOKEN\"} \
            \${NASA_FIRMS_MAP_KEY:+--nasa-firms-key \"\$NASA_FIRMS_MAP_KEY\"} \
            \${AISSTREAM_API_KEY:+--aisstream-api-key \"\$AISSTREAM_API_KEY\"} \
            \${FINRA_CLIENT_ID:+--finra-client-id \"\$FINRA_CLIENT_ID\"} \
            \${FINRA_CLIENT_SECRET:+--finra-client-secret \"\$FINRA_CLIENT_SECRET\"} \
            --ecb-enabled \
            --openmeteo-sync-interval 300 \
            > ~/${LOG_FILE} 2>&1 &
        echo \"PID: \$!\"
    '"
    ok "Process started"
}

# ── Step 7: Health check ───────────────────────────────────────────────
health_check() {
    info "Waiting for health check (${HEALTH_TIMEOUT}s timeout)..."
    if $DRY_RUN; then
        echo -e "\033[0;90m[DRY-RUN] curl ${HEALTH_URL}\033[0m"
        return 0
    fi

    local elapsed=0
    while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
        if remote "curl -sf ${HEALTH_URL}" >/dev/null 2>&1; then
            ok "Health check passed!"
            remote "curl -s ${HEALTH_URL} | python3 -m json.tool 2>/dev/null || curl -s ${HEALTH_URL}"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done

    err "Health check failed after ${HEALTH_TIMEOUT}s!"
    warn "Check logs: ssh ${VPS_SSH} 'tail -50 ~/${LOG_FILE}'"
    return 1
}

# ── Main ────────────────────────────────────────────────────────────────
main() {
    echo "============================================"
    echo "  data-node deploy $(date '+%Y-%m-%d %H:%M')"
    $DRY_RUN && echo "  (DRY RUN — no changes will be made)"
    echo "============================================"
    echo ""

    if $SWAP_ONLY; then
        swap_binary
        health_check
    elif $BUILD_ONLY; then
        sync_source
        build_remote
        ok "Build complete. Run with --swap-only to deploy."
    else
        sync_source
        build_remote
        swap_binary
        health_check
    fi

    echo ""
    ok "Deploy complete!"
}

main
