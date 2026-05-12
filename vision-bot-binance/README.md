# vision-bot-binance

One shared runner. Twelve strategy modules. One container per vault — twelve
containers per data source family. The bot calls `VisionVault.joinBatch` on
the General Market L3 every time the data-node opens a new batch.

## Layout

```
vision-bot-binance/
  runner.py                 # shared loop: poll → strategy → encode → joinBatch
  vision_vault_abi.json     # minimal VisionVault ABI
  strategies/
    _common.py              # fetch_history(market_id, limit)
    spot_mom_5.py spot_rev_5.py spot_mom_20.py spot_rev_20.py
    fund_mom.py fund_rev.py fund_flip.py fund_extreme.py
    opt_mom_all.py opt_rev_all.py opt_mom_calls.py opt_mom_puts.py
  Dockerfile
  requirements.txt
```

Each strategy module exports exactly one function:

```python
def generate_bets(market_ids: list[str]) -> list[bool]: ...
```

`True` = UP, `False` = DOWN. The list MUST be the same length as
`market_ids` and in the same order — silently reordering the list silently
inverts bets. The runner asserts this before signing.

## Configuration

All via environment variables. The runner crashes loudly if any required
variable is missing.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `STRATEGY` | yes | — | Strategy module name, e.g. `spot_mom_5`. |
| `SOURCE_ID` | yes | — | Data source id, e.g. `binance_spot`, `binance_futures`, `binance_options`. |
| `VAULT_ADDRESS` | yes | — | VisionVault address on the L3. |
| `MANAGER_PRIVATE_KEY` | yes | — | Key that holds the `manager` role on the vault. |
| `L3_RPC_URL` | yes | — | `https://rpc.generalmarket.io/` in prod. |
| `DEPOSIT_BPS` | no | `500` | Per-batch deposit as bps of `totalAssets()`. |
| `POLL_SECS` | no | `30` | Polling interval. |
| `DATA_NODE_BASE` | no | `https://api.generalmarket.io` | Data-node origin. |
| `DRY_RUN` | no | `0` | `1` → log only, no tx. |

## Bitmap encoding

Big-endian within each byte. Market 0 → MSB of byte 0. `bitmapHash =
keccak256(bitmap)`. Matches `examples/vision-bitmap-encoder/encode.py`.
Do not invent a different encoding — the Vision oracle reveals bitmaps
using exactly this layout when it scores batches.

## Local run

```bash
pip install -r requirements.txt
STRATEGY=spot_mom_5 \
SOURCE_ID=binance_spot \
VAULT_ADDRESS=0x... \
MANAGER_PRIVATE_KEY=0x... \
L3_RPC_URL=https://rpc.generalmarket.io/ \
DRY_RUN=1 \
python runner.py
```

## Container

```bash
docker build -t vision-bot-binance .
docker run --rm \
  -e STRATEGY=spot_mom_5 \
  -e SOURCE_ID=binance_spot \
  -e VAULT_ADDRESS=0x... \
  -e MANAGER_PRIVATE_KEY=0x... \
  -e L3_RPC_URL=https://rpc.generalmarket.io/ \
  vision-bot-binance
```

Twelve vaults, twelve containers, one image. The image carries every
strategy; `STRATEGY` decides which one runs.
