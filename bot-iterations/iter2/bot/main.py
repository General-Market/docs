import argparse
import json
import os
import sys
import time

import requests
from eth_account import Account
from web3 import Web3

from bitmap import encode_bitmap, hash_bitmap
from vision_bot import VisionBot

RPC_URL = os.getenv("RPC_URL", "http://142.132.164.24/")
VISION = os.getenv("VISION_ADDRESS", "0x94d540bb45975bd5a0c7ba9a15a0d34e378f6c61")
DATA_NODE = os.getenv("DATA_NODE_URL", "http://116.203.156.98/data-node")
ORACLES = os.getenv(
    "ORACLE_URLS",
    "http://116.203.156.98/oracle1,http://116.203.156.98/oracle2,http://116.203.156.98/oracle3",
).split(",")
PRIVATE_KEY = os.getenv("BOT_PRIVATE_KEY")


def _require_key(allow_fabricate: bool) -> str:
    if PRIVATE_KEY:
        return PRIVATE_KEY
    if not allow_fabricate:
        print("ERROR: BOT_PRIVATE_KEY not set", file=sys.stderr)
        sys.exit(2)
    k = Account.create().key.hex()
    if not k.startswith("0x"):
        k = "0x" + k
    print(f"[info] No BOT_PRIVATE_KEY set — fabricating ephemeral key for dryrun only")
    return k


def _oracle_health(url: str) -> str:
    try:
        r = requests.get(url + "/", timeout=8)
        return f"{r.status_code}"
    except requests.RequestException as e:
        return f"ERR {e}"


def cmd_probe(_args):
    key = _require_key(allow_fabricate=True)
    bot = VisionBot(RPC_URL, VISION, key, DATA_NODE, ORACLES)
    w3 = bot.w3
    code = w3.eth.get_code(Web3.to_checksum_address(VISION))
    min_dep = bot.vision.functions.MIN_DEPOSIT().call()
    next_batch = bot.vision.functions.nextBatchId().call()

    print(f"chain_id           : {w3.eth.chain_id}")
    print(f"vision_address     : {VISION}")
    print(f"vision_code_bytes  : {len(code)}")
    print(f"MIN_DEPOSIT (wei)  : {min_dep}")
    print(f"USDC discovered    : {bot.usdc_address}")
    print(f"nextBatchId        : {next_batch}")
    print(f"bot_address        : {bot.bot_addr}")

    try:
        r = requests.get(DATA_NODE + "/health", timeout=8)
        print(f"data-node /health  : {r.status_code} {r.text[:200]}")
    except requests.RequestException as e:
        print(f"data-node /health  : ERR {e}")

    for u in ORACLES:
        print(f"oracle {u} : {_oracle_health(u)}")


def cmd_dryrun(args):
    key = _require_key(allow_fabricate=True)
    bot = VisionBot(RPC_URL, VISION, key, DATA_NODE, ORACLES)

    info = bot.get_batch(args.batch)
    print(f"batch_id       : {args.batch}")
    print(f"creator        : {info['creator']}")
    print(f"source_id      : 0x{info['source_id'].hex()}")
    print(f"config_hash    : 0x{info['config_hash'].hex()}")
    print(f"tick_duration  : {info['tick_duration']}")
    print(f"lock_offset    : {info['lock_offset']}")
    print(f"paused         : {info['paused']}")
    print(f"settled        : {info['settled']}")

    try:
        markets = bot.fetch_markets(info["config_hash"])
    except RuntimeError as e:
        print(f"data-node error: {e}")
        sys.exit(2)

    n = len(markets)
    print(f"market_count   : {n}")
    print(f"markets[0..3]  : {json.dumps(markets[:3], indent=2, default=str)}")

    picks = ["UP"] * n
    bitmap = encode_bitmap(picks, n)
    bmhash = hash_bitmap(bitmap)
    deposit_wei = int(args.deposit * 10**18)

    print(f"bitmap_hash    : 0x{bmhash.hex()}")
    print(f"deposit_wei    : {deposit_wei}")

    tx = bot.build_dryrun_tx(args.batch, info["config_hash"], deposit_wei, bmhash)
    printable = {k: (v.hex() if isinstance(v, (bytes, bytearray)) else v) for k, v in tx.items()}
    print("dryrun tx      :")
    print(json.dumps(printable, indent=2, default=str))


def cmd_trade(args):
    if not PRIVATE_KEY:
        print("ERROR: BOT_PRIVATE_KEY required for trade", file=sys.stderr)
        sys.exit(2)
    bot = VisionBot(RPC_URL, VISION, PRIVATE_KEY, DATA_NODE, ORACLES)
    info = bot.get_batch(args.batch)
    markets = bot.fetch_markets(info["config_hash"])
    n = len(markets)
    picks = ["UP"] * n
    bitmap = encode_bitmap(picks, n)
    bmhash = hash_bitmap(bitmap)
    deposit_wei = int(args.deposit * 10**18)

    print(f"approving USDC {deposit_wei} wei...")
    ah = bot.approve_usdc(deposit_wei)
    print(f"approve tx: 0x{ah.hex()}")

    print(f"joining batch {args.batch}...")
    jh = bot.join_batch(args.batch, info["config_hash"], deposit_wei, bmhash)
    print(f"join tx: 0x{jh.hex()}")

    print("submitting bitmap to oracles...")
    accepted = bot.submit_bitmap(args.batch, bitmap, bmhash)
    print(f"accepted: {accepted}/{len(ORACLES)}")

    print("polling for settlement...")
    deadline = time.time() + info["tick_duration"] * 10 + 300
    while time.time() < deadline:
        payout = bot.get_payout(args.batch)
        if payout > 0:
            print(f"settled. payout={payout} wei. pnl={payout - deposit_wei} wei")
            return
        time.sleep(15)
    print("timeout waiting for settlement")
    sys.exit(3)


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("probe").set_defaults(func=cmd_probe)

    d = sub.add_parser("dryrun")
    d.add_argument("--batch", type=int, required=True)
    d.add_argument("--deposit", type=float, required=True)
    d.set_defaults(func=cmd_dryrun)

    t = sub.add_parser("trade")
    t.add_argument("--batch", type=int, required=True)
    t.add_argument("--deposit", type=float, required=True)
    t.add_argument("--submit", action="store_true")
    t.set_defaults(func=cmd_trade)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
