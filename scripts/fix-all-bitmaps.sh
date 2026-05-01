#!/usr/bin/env bash
set -euo pipefail

# Fix null bitmap hashes for all bots across all 47 batches.
# Reads bot keys from swarm.env, checks each position's bitmapHash,
# and calls updateBitmap + submits to oracles when null.

CAST=~/.foundry/bin/cast
VISION="0xd5ec37ffa8c40b5dbaf7ffe9d9878c3a387ad47a"
RPC="http://159.195.79.153/"
SWARM_ENV="/home/max/index/docker/testnet/vision-swarm/swarm.env"
NULL_HASH="c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
ORACLE_PORTS=(10001 10002 10003)

# Config hashes per batch (0-46), extracted from vision-batches.json
declare -a CONFIG_HASHES=(
  "0xbdb8ad2871c37ad2f9880a986165c0e5799637546aed5d32b45152b4969d9476"  # 0  defi
  "0xed5f6f718e654a76bc5faca5ac4585fe4c2b8a3753adb3e41c844a6f0154d3f8"  # 1  rates
  "0xf8a8a4416eca594423821205870b9db07cc66a55a6093234ba1cae73dd475ad3"  # 2  bls
  "0xee78d7a856dc7bb2978706a39c85a4e0985a73ccdd13d8d0d46781655f58879a"  # 3  worldbank
  "0xcf77e7f27c174e9a7956fab7ab59fc144ecf75fbf4be5e6721929fbb4a230bcf"  # 4  eia
  "0x287060346fd181f933c1eeca0ab2bcacbccfa6eb66d2fc27f13d63c1214751c0"  # 5  ecb
  "0x6a35b6524f767b3e64cf0c9c737d8d29324fd9f33f5ab29845edee0d595060cd"  # 6  weather
  "0xd5c0a148802cb3f05fb1758c3d06f9f66b3be4104b6e5ac91c8367c2f3a7d6d1"  # 7  sec_13f
  "0x6e7f4043bdddf388fe9e3a9a81a54863496c374b514c493e492a93d768774072"  # 8  finra_short_vol
  "0xfc437b48c01088c73338187d5a6e08f768443c0ad51ab7e9a29baee2d9a1bb2b"  # 9  congress
  "0xb3a0e724c9ced0ae3767fcd242860333c7a3dc4935caf165db2ed6e0abeb2cdf"  # 10 bchain
  "0xabc34e4ed7e73ab9a0a63d54bf9db78f52942f2136e7545cd542631476bb19a9"  # 11 bonds
  "0xb776ced6f12c94c48b2341839ff4d4f63d9de5df83c2ebd61824751ed896e1fb"  # 12 anilist
  "0x50df87669c08aeb22ed00e8b360887c89b0a4cf0f679740f085cff3d572512f3"  # 13 backpacktf
  "0xddd915af6b7c2a3b235174cc178e3b29b49badc35f2d0d3e872c91508ed8d3f3"  # 14 cloudflare
  "0x3eba9a54885626fe2ae4447518a49fa412047ad88f0648c59d0c2e3c855481e2"  # 15 fourchan
  "0xbc48591f83366f706401afff6615902711b7a296319efe915fa4727166794ea4"  # 16 hackernews
  "0xbc832988b4867fa31a458c3df70338401ba5ea441873052b0dbf668561193e0d"  # 17 polymarket
  "0x01dd053200710e4bc79c6e080189c33c96bce2acba9f78393030db7ef7a11566"  # 18 steam
  "0xfd29023c5dbd8633d08c4a9508e016fd8441c2144f33fd8a1cee9a24d7829977"  # 19 twitch
  "0xb2ffe0b93702a09549404e58c20028748770366767c5d8ee82a9cfcc96e11cc8"  # 20 zillow
  "0xce96b45683b5579b84bc887eb74bd1f7f3a7449142e3257e0aef93fe1df9c926"  # 21 earthquake
  "0x71b305181c167e80896aea2cea8c473122b608a80dea438fdba60376b4f7e6e9"  # 22 spaceweather
  "0x5725822928e967cb116abd1ee59d39f7dffde4ddd7d8fe7735033495ebf85e69"  # 23 wildfire
  "0xa67e87333e9712834b8f7be7a9b8e100e8b10c77080da52b2ed9758aed88a447"  # 24 mil_aircraft
  "0x8568eb3b5ab73e2fea967b1710007988a67cb48a09a0cc18a9c522b06b08b2b9"  # 25 sports
  "0x865b4d7fd491ac96f12cb5c59a2976c68a3522c2353690b1a0b1fff340c4b691"  # 26 iss
  "0x22e61084aa4249a1cb49f5047ab520c9a6f9bcefe3b0aa480d55672139f3acbe"  # 27 weather_alerts
  "0xe2e9d2fd8aa78a1084e81924cd1151a2978e9834a37f1105494c9708c6df86e0"  # 28 animals
  "0xae7e62ec5c047fb8d2b2ee51c3c381f9f6a17fa41ab92e7c46394bbce3c258f1"  # 29 gtfs_transit
  "0xd5b9bfb79d79d32c2efd4c096d68defac3186ce3f7e7f6e511f48da42b5d4f3e"  # 30 usa_spending
  "0x7ca8dd1ce99ed8b5651c883e20a8a42377d2b59ed83d1e7f072aeeb0e04ba397"  # 31 pumpfun
  "0xa7df9599bbdd6835fbefdba683e512d8930cc1cfd7a7986d41983d773eabb9cf"  # 32 usgs_water
  "0x99738c534f942aa1d12155ba7bbdc48e3b50a7552f9221abd93ec021ff241cf9"  # 33 chaturbate
  "0x0dc66f1bf3de6c0b30c277e3b81900a358ed88aafbc76eb22379d9d1d47a1cd2"  # 34 noaa_tides
  "0x53b645e6e67ef3321187bf826a6d2b200be4ebbc7de25c6241eaebe6607bfbd2"  # 35 citybikes
  "0x77e771b33f71bc42ef4c1b1ac82529bfbb8bc6a4e93caed7af28b99be6ff9356"  # 36 ndbc
  "0x81284a33629563680aa8a0310c4b71fc42841b64bd1d1248d1245bad44759346"  # 37 noaa_met
  "0x0e8df1cd35e23bd3f0d5f77bbd6dce44c644bc9c7df0c4e0bc3de44baed98928"  # 38 nwps
  "0x42a65994befc29ce2fb80af3635012bfebc20ad339e420a74b662c445c5af4a9"  # 39 airnow
  "0x059376d6d93f58524e16379494db14274762bffa8302ad6e823d6338823628ef"  # 40 crossref
  "0xa40cb9cb409ba5f2a83384adcf2e64976dc1a3eb1dc03705590c3aa15f8f548d"  # 41 pubmed
  "0x4c4950dd5e1093315f71b43d41ac547b3f4891537e3792122829f62fe2c6d908"  # 42 parking
  "0x6ab09e58b1ed330208234bf131db6a6387d1e780e82f96737071d56e52c71f5c"  # 43 bestbuy
  "0x513c3bf20ead38ad455cd943b6e49c77155946c63e5a11c92a67c70211dad4e7"  # 44 adzuna
  "0x155763cd2069ffd3d84d6d65a692da10344ab02337acc83f053f17cb61eee765"  # 45 queue_times
  "0x32f6ae549d62f34082a680773ae10dbc49817c9169753558bafce37e958fb687"  # 46 mta_subway
)

# ── Load bot keys from swarm.env ──
if [[ ! -f "$SWARM_ENV" ]]; then
  echo "FATAL: $SWARM_ENV not found"
  exit 1
fi

declare -a BOT_KEYS=()
for i in $(seq 0 9); do
  KEY=$(grep "^SWARM_BOT_${i}_KEY=" "$SWARM_ENV" | cut -d'=' -f2)
  if [[ -z "$KEY" ]]; then
    echo "FATAL: SWARM_BOT_${i}_KEY not found in $SWARM_ENV"
    exit 1
  fi
  BOT_KEYS+=("$KEY")
done

echo "Loaded ${#BOT_KEYS[@]} bot keys"

# ── Derive addresses from keys ──
declare -a BOT_ADDRS=()
for i in $(seq 0 9); do
  ADDR=$($CAST wallet address --private-key "${BOT_KEYS[$i]}")
  BOT_ADDRS+=("$ADDR")
  echo "Bot $i: $ADDR"
done

# ── Counters ──
FIXED=0
SKIPPED=0
ERRORS=0
NO_POSITION=0

# ── Process each bot × batch ──
for BOT_IDX in $(seq 0 9); do
  BOT_KEY="${BOT_KEYS[$BOT_IDX]}"
  BOT_ADDR="${BOT_ADDRS[$BOT_IDX]}"
  echo ""
  echo "════════════════════════════════════════"
  echo "Bot $BOT_IDX: $BOT_ADDR"
  echo "════════════════════════════════════════"

  for BATCH_ID in $(seq 0 46); do
    CONFIG_HASH="${CONFIG_HASHES[$BATCH_ID]}"

    # Read position: returns (bitmapHash, configHash, stakedAmount, claimedTick, ...)
    POSITION=$($CAST call "$VISION" \
      "getPosition(uint256,address)(bytes32,bytes32,uint256,uint256,uint256,uint256,uint256,uint256,uint256)" \
      "$BATCH_ID" "$BOT_ADDR" \
      --rpc-url "$RPC" 2>&1) || true

    # Extract bitmapHash (first word of output)
    BITMAP_HASH=$(echo "$POSITION" | head -1 | tr -d '[:space:]')

    # Skip if position doesn't exist (stakedAmount = 0 means no position)
    STAKED=$(echo "$POSITION" | sed -n '3p' | tr -d '[:space:]')
    if [[ "$STAKED" == "0" || -z "$STAKED" ]]; then
      continue
    fi

    # Remove 0x prefix for comparison
    BITMAP_HASH_BARE="${BITMAP_HASH#0x}"

    if [[ "$BITMAP_HASH_BARE" == "$NULL_HASH" ]]; then
      echo "  Batch $BATCH_ID: NULL bitmap — fixing..."

      # Generate bitmap bytes, then compute hash deterministically
      BITMAP_HEX=$(openssl rand -hex 3)
      NEW_HASH=$($CAST keccak "0x${BITMAP_HEX}")

      echo "    bitmap=0x${BITMAP_HEX} hash=${NEW_HASH}"

      # Call updateBitmap on-chain
      TX=$($CAST send "$VISION" \
        "updateBitmap(uint256,bytes32,bytes32)" \
        "$BATCH_ID" "$CONFIG_HASH" "$NEW_HASH" \
        --private-key "$BOT_KEY" \
        --rpc-url "$RPC" 2>&1) || {
        echo "    ERROR: updateBitmap tx failed: $TX"
        ERRORS=$((ERRORS + 1))
        continue
      }

      echo "    on-chain: OK"

      # Submit bitmap to all 3 oracles
      for PORT in "${ORACLE_PORTS[@]}"; do
        RESP=$(curl -s -X POST "http://localhost:${PORT}/vision/bitmap" \
          -H "Content-Type: application/json" \
          -d "{\"player\":\"${BOT_ADDR}\",\"batch_id\":${BATCH_ID},\"bitmap_hex\":\"0x${BITMAP_HEX}\",\"expected_hash\":\"${NEW_HASH}\"}" 2>&1) || true
        echo "    oracle:${PORT}: ${RESP:0:80}"
      done

      FIXED=$((FIXED + 1))
    else
      SKIPPED=$((SKIPPED + 1))
    fi
  done
done

echo ""
echo "════════════════════════════════════════"
echo "DONE: fixed=$FIXED skipped=$SKIPPED errors=$ERRORS"
echo "════════════════════════════════════════"
