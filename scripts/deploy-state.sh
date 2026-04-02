#!/bin/bash
# deploy-state.sh — Deploy state machine for testnet.sh
#
# Tracks each deployment stage in deployments/deploy-state.json so that:
#   - Completed stages are skipped on re-run (idempotent deploys)
#   - Failed stages resume from the point of failure
#   - Every stage records: status, addresses, nonce before/after, timestamp
#
# Usage (sourced by testnet.sh):
#   source scripts/deploy-state.sh
#   init_deploy_state
#   run_stage "core" "deploy_core_contracts"
#   run_stage "sonic" "deploy_sonic_contracts"
#   ...
#
# The state file is a flat JSON: { "stages": { "<name>": { ... } }, "startedAt": ..., "deploySeed": ... }

DEPLOY_STATE_FILE="${DEPLOY_STATE_DIR:-deployments}/deploy-state.json"

# Resolve python3 path once at source-time. Zsh hash table can lose track of
# python3 inside functions (command not found despite being in PATH).
_PYTHON3="$(command -v python3 2>/dev/null || echo /usr/bin/python3)"

# Resolve script directory at source-time (zsh doesn't support BASH_SOURCE reliably)
_DEPLOY_STATE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-${(%):-%x}}")" 2>/dev/null && pwd || echo "scripts")"

# All stages in execution order. Each stage runs exactly once per deploy cycle.
DEPLOY_STAGES=(
    core
    sonic
    bls-registration
    gas-funding
    morpho
    vision
    tokens
    itp-create
    itp-vaults
    batch-markets
    sync
    frontend
)

# ── JSON helpers ($_PYTHON3, no dependencies) ────────────────

_ds_read() {
    # Read a field from deploy-state.json. Args: jq-style dotpath (e.g. .stages.core.status)
    local path="$1"
    "$_PYTHON3" -c "
import json
d = json.load(open('$DEPLOY_STATE_FILE'))
keys = [k for k in '$path'.split('.') if k]
for k in keys:
    d = d.get(k, {}) if isinstance(d, dict) else {}
print(d if isinstance(d, str) else json.dumps(d))
" 2>/dev/null || echo ""
}

_ds_write() {
    # Set a field in deploy-state.json. Args: dotpath, value (string or JSON)
    local path="$1" value="$2"
    "$_PYTHON3" -c "
import json
d = json.load(open('$DEPLOY_STATE_FILE'))
keys = [k for k in '$path'.split('.') if k]
obj = d
for k in keys[:-1]:
    if k not in obj or not isinstance(obj[k], dict):
        obj[k] = {}
    obj = obj[k]
obj[keys[-1]] = '$value'
json.dump(d, open('$DEPLOY_STATE_FILE', 'w'), indent=2)
" 2>/dev/null
}

_ds_write_json() {
    # Set a field to a JSON value (dict/list). Args: dotpath, json_string
    # Passes the JSON via stdin to avoid quoting hell.
    local path="$1" json_val="$2"
    echo "$json_val" | "$_PYTHON3" -c "
import json, sys
d = json.load(open('$DEPLOY_STATE_FILE'))
keys = [k for k in '$path'.split('.') if k]
obj = d
for k in keys[:-1]:
    if k not in obj or not isinstance(obj[k], dict):
        obj[k] = {}
    obj = obj[k]
obj[keys[-1]] = json.load(sys.stdin)
json.dump(d, open('$DEPLOY_STATE_FILE', 'w'), indent=2)
" 2>/dev/null
}

# ── Public API ───────────────────────────────────────────────

init_deploy_state() {
    # Initialize a fresh deploy-state.json. Preserves existing file if stages are
    # still in progress (allows resume). Pass --force to start clean.
    local force=false
    [[ "${1:-}" == "--force" ]] && force=true

    mkdir -p "$(dirname "$DEPLOY_STATE_FILE")"

    if [ -f "$DEPLOY_STATE_FILE" ] && [ "$force" = false ]; then
        # Check if any stage is running (crashed mid-deploy) — mark it failed
        for stage in "${DEPLOY_STAGES[@]}"; do
            local st
            st=$(_ds_read ".stages.$stage.status")
            if [ "$st" = "running" ]; then
                echo -e "  ${YELLOW:-}Stage '$stage' was running (previous crash) — marking failed${NC:-}"
                _ds_write ".stages.$stage.status" "failed"
                _ds_write ".stages.$stage.failedAt" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
            fi
        done
        echo -e "  Resuming deploy from existing state file"
        return 0
    fi

    # Build fresh state
    "$_PYTHON3" -c "
import json, time
stage_names = [
    'core', 'sonic', 'bls-registration', 'gas-funding', 'morpho',
    'vision', 'tokens', 'itp-create', 'itp-vaults', 'batch-markets',
    'sync', 'frontend'
]
stages = {}
for name in stage_names:
    stages[name] = {
        'status': 'pending',
        'addresses': {},
        'nonceBefore': None,
        'nonceAfter': None,
        'startedAt': None,
        'completedAt': None,
        'txCount': 0,
        'error': None
    }
state = {
    'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'deploySeed': int(time.time()),
    'chainId': $CHAIN_ID,
    'deployer': '$DEPLOYER_ADDRESS',
    'stages': stages
}
json.dump(state, open('$DEPLOY_STATE_FILE', 'w'), indent=2)
" 2>/dev/null
    echo -e "  ${GREEN:-}Deploy state initialized at $DEPLOY_STATE_FILE${NC:-}"
}

get_stage_status() {
    # Returns: pending, running, done, failed
    local stage="$1"
    _ds_read ".stages.$stage.status"
}

update_stage() {
    # Update arbitrary fields on a stage. Args: stage key value [key value ...]
    local stage="$1"; shift
    while [ $# -ge 2 ]; do
        _ds_write ".stages.$stage.$1" "$2"
        shift 2
    done
}

get_stage_address() {
    # Get a deployed address from a stage. Args: stage, contract_name
    local stage="$1" name="$2"
    "$_PYTHON3" -c "
import json
d = json.load(open('$DEPLOY_STATE_FILE'))
addrs = d.get('stages', {}).get('$stage', {}).get('addresses', {})
print(addrs.get('$name', ''))
" 2>/dev/null || echo ""
}

get_deploy_seed() {
    _ds_read ".deploySeed"
}

set_stage_addresses() {
    # Bulk-set addresses on a stage from a JSON object. Args: stage, json_string
    local stage="$1" addresses_json="$2"
    _ds_write_json ".stages.$stage.addresses" "$addresses_json"
}

# ── The Machine ──────────────────────────────────────────────

run_stage() {
    # Execute a deploy stage with full lifecycle management.
    #
    # Args:
    #   $1 — stage name (must be in DEPLOY_STAGES)
    #   $2 — function name to execute
    #   $3 — (optional) "force" to re-run even if done
    #
    # The function receives no arguments. It should:
    #   - Do its work (forge deploy, cast send, etc.)
    #   - Call set_stage_addresses if it produces contract addresses
    #   - Return 0 on success, non-zero on failure
    #
    # run_stage handles: skip-if-done, mark running, capture nonce, mark done/failed.

    local stage="$1"
    local func="$2"
    local force="${3:-}"

    # Validate stage name
    local valid=false
    for s in "${DEPLOY_STAGES[@]}"; do
        [[ "$s" == "$stage" ]] && valid=true
    done
    if [ "$valid" = false ]; then
        echo -e "  ${RED:-}Unknown stage: $stage${NC:-}"
        return 1
    fi

    # Check current status
    local stage_status
    stage_status=$(get_stage_status "$stage")

    if [ "$stage_status" = "done" ] && [ "$force" != "force" ]; then
        local addr_count
        addr_count=$("$_PYTHON3" -c "
import json
d = json.load(open('$DEPLOY_STATE_FILE'))
print(len(d.get('stages',{}).get('$stage',{}).get('addresses',{})))
" 2>/dev/null || echo "0")
        echo -e "  ${GREEN:-}Stage '$stage' already done ($addr_count addresses) — skipping${NC:-}"
        return 0
    fi

    # Capture nonce before
    local nonce_before
    nonce_before=$(cast nonce --rpc-url "$RPC_URL" "$DEPLOYER_ADDRESS" 2>/dev/null || echo "?")

    # Mark running
    update_stage "$stage" \
        "status" "running" \
        "startedAt" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        "nonceBefore" "$nonce_before" \
        "error" ""

    echo -e "  ${BLUE:-}[$stage] Running (nonce: $nonce_before)...${NC:-}"

    # Execute
    local exit_code=0
    "$func" || exit_code=$?

    # Capture nonce after
    local nonce_after
    nonce_after=$(cast nonce --rpc-url "$RPC_URL" "$DEPLOYER_ADDRESS" 2>/dev/null || echo "?")
    _ds_write ".stages.$stage.nonceAfter" "$nonce_after"

    # Count transactions
    if [ "$nonce_before" != "?" ] && [ "$nonce_after" != "?" ]; then
        local tx_count=$((nonce_after - nonce_before))
        _ds_write ".stages.$stage.txCount" "$tx_count"
    fi

    if [ "$exit_code" -eq 0 ]; then
        update_stage "$stage" \
            "status" "done" \
            "completedAt" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo -e "  ${GREEN:-}[$stage] Done (nonce: $nonce_before -> $nonce_after)${NC:-}"
    else
        update_stage "$stage" \
            "status" "failed" \
            "error" "exit code $exit_code"
        echo -e "  ${RED:-}[$stage] Failed (exit $exit_code, nonce: $nonce_before -> $nonce_after)${NC:-}"
    fi

    return $exit_code
}

# ── Verification helper ──────────────────────────────────────

verify_stage_addresses() {
    # Verify that all addresses recorded for a stage have code on-chain.
    # Args: stage name, rpc_url (optional, defaults to $RPC_URL)
    local stage="$1"
    local rpc="${2:-$RPC_URL}"
    local failed=0

    local addresses_json
    addresses_json=$("$_PYTHON3" -c "
import json
d = json.load(open('$DEPLOY_STATE_FILE'))
addrs = d.get('stages',{}).get('$stage',{}).get('addresses',{})
for name, addr in addrs.items():
    if addr and addr != '0x0000000000000000000000000000000000000000':
        print(f'{name}={addr}')
" 2>/dev/null)

    if [ -z "$addresses_json" ]; then
        echo -e "  ${YELLOW:-}No addresses to verify for stage '$stage'${NC:-}"
        return 0
    fi

    while IFS='=' read -r name addr; do
        local code_len
        code_len=$(cast code --rpc-url "$rpc" "$addr" 2>/dev/null | wc -c | tr -d ' ')
        if [ "$code_len" -lt 10 ]; then
            echo -e "  ${RED:-}$name ($addr) — no code on-chain${NC:-}"
            failed=$((failed + 1))
        fi
    done <<< "$addresses_json"

    if [ "$failed" -gt 0 ]; then
        echo -e "  ${RED:-}$failed address(es) failed verification for stage '$stage'${NC:-}"
        return 1
    fi
    return 0
}

# ── Extract addresses from broadcast receipts ────────────────

extract_broadcast_addresses() {
    # Extract contract addresses from a forge broadcast JSON and store them
    # in the stage's addresses field.
    #
    # Args:
    #   $1 — stage name
    #   $2 — path to broadcast run-latest.json
    #
    # Uses the companion Python script for heavy lifting.

    local stage="$1"
    local broadcast_json="$2"

    if [ ! -f "$broadcast_json" ]; then
        echo -e "  ${YELLOW:-}No broadcast file at $broadcast_json${NC:-}"
        return 1
    fi

    local addresses_json
    addresses_json=$("$_PYTHON3" "$_DEPLOY_STATE_SCRIPT_DIR/extract-broadcast-addresses.py" "$broadcast_json" 2>/dev/null)

    if [ -z "$addresses_json" ] || [ "$addresses_json" = "{}" ]; then
        echo -e "  ${YELLOW:-}No addresses extracted from $broadcast_json${NC:-}"
        return 1
    fi

    set_stage_addresses "$stage" "$addresses_json"

    local count
    count=$(echo "$addresses_json" | "$_PYTHON3" -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
    echo -e "  ${GREEN:-}Extracted $count addresses from broadcast into stage '$stage'${NC:-}"
    return 0
}

# ── Summary ──────────────────────────────────────────────────

print_deploy_summary() {
    # Uses a double-quoted heredoc so $DEPLOY_STATE_FILE expands naturally.
    # Python variable syntax ($-less) doesn't conflict with shell expansion.
    "$_PYTHON3" -c "
import json, sys

try:
    d = json.load(open('$DEPLOY_STATE_FILE'))
except Exception:
    print('  No deploy state file found.')
    sys.exit(0)

print()
print(f\"  Deploy started: {d.get('startedAt', '?')}\")
print(f\"  Chain: {d.get('chainId', '?')}  Deployer: {d.get('deployer', '?')[:12]}...\")
print(f\"  Seed: {d.get('deploySeed', '?')}\")
print()

stages = d.get('stages', {})
order = [
    'core', 'sonic', 'bls-registration', 'gas-funding', 'morpho',
    'vision', 'tokens', 'itp-create', 'itp-vaults', 'batch-markets',
    'sync', 'frontend'
]

icons = {'done': '+', 'failed': 'X', 'running': '>', 'pending': '-'}

for name in order:
    s = stages.get(name, {})
    status = s.get('status', 'pending')
    icon = icons.get(status, '?')
    addr_count = len(s.get('addresses', {}))
    nonce_b = s.get('nonceBefore', '')
    nonce_a = s.get('nonceAfter', '')
    tx = s.get('txCount', 0)

    nonce_str = f'nonce {nonce_b}->{nonce_a}' if nonce_b and nonce_a else ''
    addr_str = f'{addr_count} addr' if addr_count else ''
    tx_str = f'{tx} tx' if tx else ''
    detail = ', '.join(filter(None, [tx_str, addr_str, nonce_str]))

    err = s.get('error', '')
    if err and status == 'failed':
        detail += f' ({err})' if detail else str(err)

    print(f'  [{icon}] {name:20s} {status:8s} {detail}')
" 2>/dev/null
}

# ── Reset ────────────────────────────────────────────────────

reset_deploy_state() {
    # Reset a single stage (or all stages) to pending.
    # Args: stage_name | --all
    local target="${1:---all}"
    if [ "$target" = "--all" ]; then
        init_deploy_state --force
    else
        update_stage "$target" \
            "status" "pending" \
            "startedAt" "" \
            "completedAt" "" \
            "error" ""
        _ds_write_json ".stages.$target.addresses" "{}"
        echo -e "  ${GREEN:-}Stage '$target' reset to pending${NC:-}"
    fi
}
