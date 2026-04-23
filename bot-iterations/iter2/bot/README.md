# Vision testnet bot

Minimal Python bot that joins a Vision batch on Index L3 testnet.

## Install

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Environment

Copy `.env.example` to `.env` and set `BOT_PRIVATE_KEY`. Defaults match the live testnet:

- `RPC_URL=http://142.132.164.24/`
- `VISION_ADDRESS=0x94d540bb45975bd5a0c7ba9a15a0d34e378f6c61`
- `DATA_NODE_URL=http://116.203.156.98/data-node`
- `ORACLE_URLS=http://116.203.156.98/oracle1,.../oracle2,.../oracle3`

USDC is self-discovered from `Vision.USDC()`. Do not hardcode it.

## Commands

```bash
# sanity check
.venv/bin/python main.py probe

# build an all-YES join tx for batch 19, 0.1 USDC — no signing
.venv/bin/python main.py dryrun --batch 19 --deposit 0.1

# full flow: approve + join + submit bitmap + poll settlement
BOT_PRIVATE_KEY=0x... .venv/bin/python main.py trade --batch 19 --deposit 0.1 --submit
```

Probe and dryrun fabricate an ephemeral key if `BOT_PRIVATE_KEY` is unset. Trade refuses to proceed without one.

## Mechanics in one paragraph

`getBatch(id)` returns `config_hash`. Fetch authoritative market list from `data-node/batches/config/0x{hash}`. Encode picks as a **1024-byte** bitmap (MSB-first per byte, 1 = UP, 0 = DOWN), always padded to 1024 regardless of market count. Commit `keccak256(bitmap)` on chain via `joinBatchDirect`. Then POST the raw bytes to each oracle at `/vision/bitmap` — need ≥ `ceil(2/3 * N)` acceptances. Settlement emits `PlayerSettled(batchId, player, payout, fee)`.
