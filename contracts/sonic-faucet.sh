#!/bin/bash
# Sonic Testnet Faucet Claim Script
# Usage: PRIVATE_KEY=0x... ./sonic-faucet.sh [address] [num_claims]
#
# Claims 10 S tokens per call. The faucet allows ~5 claims per hour per IP.
# Default: claims 3 times (30 S total) with 5-second delays between claims.
#
# API discovered by reverse-engineering https://testnet.soniclabs.com/account:
#   GraphQL endpoint: https://api.testnet.soniclabs.com/
#   Flow: requestTokens -> sign challenge -> claimTokens

set -e

ADDRESS="${1:-0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4}"
NUM_CLAIMS="${2:-3}"
API="https://api.testnet.soniclabs.com/"
RPC="https://rpc.testnet.soniclabs.com/"

if [ -z "$PRIVATE_KEY" ]; then
    echo "Error: PRIVATE_KEY env var not set"
    echo "Usage: PRIVATE_KEY=0x... $0 [address] [num_claims]"
    echo ""
    echo "  address    - wallet address (default: 0xC0d3ca67...)"
    echo "  num_claims - number of claims to make (default: 3, max ~5/hour)"
    exit 1
fi

# Verify cast is available
if ! command -v cast &> /dev/null; then
    echo "Error: 'cast' (Foundry) not found. Install: curl -L https://foundry.paradigm.xyz | bash"
    exit 1
fi

# Verify the private key matches the address
DERIVED_ADDR=$(cast wallet address --private-key "$PRIVATE_KEY" 2>/dev/null || true)
if [ -z "$DERIVED_ADDR" ]; then
    echo "Error: Invalid private key"
    exit 1
fi
if [ "$(echo "$DERIVED_ADDR" | tr '[:upper:]' '[:lower:]')" != "$(echo "$ADDRESS" | tr '[:upper:]' '[:lower:]')" ]; then
    echo "Warning: Private key derives address $DERIVED_ADDR, not $ADDRESS"
    echo "Using derived address instead."
    ADDRESS="$DERIVED_ADDR"
fi

get_balance() {
    local addr="$1"
    local hex
    hex=$(curl -s -X POST "$RPC" \
        -H 'Content-Type: application/json' \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$addr\",\"latest\"],\"id\":1}" \
        | python3 -c "import sys,json; print(json.load(sys.stdin)['result'])")
    python3 -c "print(f'{int(\"$hex\", 16) / 1e18:.4f}')"
}

echo "=== Sonic Testnet Faucet ==="
echo "Address: $ADDRESS"
echo "Claims:  $NUM_CLAIMS x 10 S"
echo ""

START_BAL=$(get_balance "$ADDRESS")
echo "Starting balance: $START_BAL S"
echo ""

SUCCESS_COUNT=0
for i in $(seq 1 "$NUM_CLAIMS"); do
    echo "--- Claim $i/$NUM_CLAIMS ---"

    # Step 1: Request challenge
    echo "[1/3] Requesting challenge..."
    CHALLENGE_RESPONSE=$(curl -s -X POST "$API" \
        -H 'Content-Type: application/json' \
        -d '{"query":"mutation { requestTokens }"}')

    # Check for errors
    HAS_ERROR=$(echo "$CHALLENGE_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'errors' in d:
    print(d['errors'][0]['message'])
else:
    print('')
")
    if [ -n "$HAS_ERROR" ]; then
        echo "Error: $HAS_ERROR"
        if echo "$HAS_ERROR" | grep -qi "rate\|limit\|wait\|hour"; then
            echo "Rate limited. Stopping."
            break
        fi
        continue
    fi

    # Save challenge to temp file (avoids shell quoting issues with newlines)
    CHALLENGE_FILE=$(mktemp)
    echo "$CHALLENGE_RESPONSE" | python3 -c "
import sys, json
challenge = json.load(sys.stdin)['data']['requestTokens']
print(challenge, end='')
" > "$CHALLENGE_FILE"

    CHALLENGE_LEN=$(wc -c < "$CHALLENGE_FILE" | tr -d ' ')
    echo "Challenge received ($CHALLENGE_LEN bytes)"

    # Step 2: Sign the challenge with cast (EIP-191 personal_sign)
    echo "[2/3] Signing challenge..."
    CHALLENGE_TEXT=$(cat "$CHALLENGE_FILE")
    SIGNATURE=$(cast wallet sign --private-key "$PRIVATE_KEY" "$CHALLENGE_TEXT")
    echo "Signature: ${SIGNATURE:0:20}..."

    # Step 3: Claim tokens using python to build proper JSON
    echo "[3/3] Claiming tokens..."
    CLAIM_BODY=$(python3 -c "
import json, sys

with open('$CHALLENGE_FILE', 'r') as f:
    challenge = f.read()

body = {
    'query': '''mutation ClaimTokens(\$address: Address!, \$challenge: String!, \$signature: String!) {
    claimTokens(address: \$address, challenge: \$challenge, signature: \$signature)
}''',
    'variables': {
        'address': '$ADDRESS',
        'challenge': challenge,
        'signature': '$SIGNATURE'
    }
}
print(json.dumps(body))
")

    CLAIM_RESPONSE=$(curl -s -X POST "$API" \
        -H 'Content-Type: application/json' \
        -d "$CLAIM_BODY")

    rm -f "$CHALLENGE_FILE"

    # Check result
    CLAIM_RESULT=$(echo "$CLAIM_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'errors' in d:
    print('ERROR: ' + d['errors'][0]['message'])
elif d.get('data', {}).get('claimTokens'):
    print('OK: ' + str(d['data']['claimTokens']))
else:
    print('UNKNOWN: ' + json.dumps(d))
")

    echo "Result: $CLAIM_RESULT"

    if echo "$CLAIM_RESULT" | grep -q "^OK:"; then
        echo "Claim $i SUCCEEDED!"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "Claim $i FAILED."
    fi

    echo ""

    # Delay between claims (except last)
    if [ "$i" -lt "$NUM_CLAIMS" ]; then
        echo "Waiting 5 seconds..."
        sleep 5
    fi
done

# Show final balance
echo "=== Results ==="
echo "Successful claims: $SUCCESS_COUNT/$NUM_CLAIMS"
FINAL_BAL=$(get_balance "$ADDRESS")
echo "Final balance: $FINAL_BAL S (was $START_BAL S)"
