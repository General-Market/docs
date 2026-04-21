import argparse
import os
import sys
import time
from dotenv import load_dotenv

from bitmap import encode_bitmap, hash_bitmap
from strategy import pick
from vision_bot import VisionBot


L3_USDC_DECIMALS = 18


def env(name: str, default: str | None = None) -> str:
    v = os.getenv(name, default)
    if v is None:
        print(f"error: missing env var {name}", file=sys.stderr)
        sys.exit(2)
    return v


def build_bot(dry_run: bool) -> VisionBot:
    load_dotenv()
    pk = os.getenv("PRIVATE_KEY", "")
    if not dry_run and not pk:
        print("error: PRIVATE_KEY required unless --dry-run", file=sys.stderr)
        sys.exit(2)
    oracles = [env("ORACLE_1"), env("ORACLE_2"), env("ORACLE_3")]
    return VisionBot(
        rpc_url=env("VISION_RPC"),
        vision_address=env("VISION_ADDRESS"),
        usdc_address=env("L3_USDC_ADDRESS"),
        private_key=pk,
        data_node_url=env("DATA_NODE"),
        oracles=oracles,
        dry_run=dry_run,
    )


def cmd_trade(args):
    bot = build_bot(args.dry_run)
    print(f"bot: {bot.bot_addr}")
    info = bot.get_batch(args.batch)
    print(f"batch {args.batch}:")
    for k, v in info.items():
        print(f"  {k} = {v.hex() if isinstance(v, (bytes, bytearray)) else v}")
    if info["paused"] or info["settled"]:
        print("batch is paused or already settled; nothing to do.")
        return

    config_hash = info["config_hash"]
    markets = bot.fetch_markets(config_hash)
    n = len(markets)
    print(f"markets: {n}")
    if n == 0:
        print("no markets in batch; bailing.")
        return

    picks = pick(markets, mode=args.strategy)
    bitmap = encode_bitmap(picks, n)
    bhash = hash_bitmap(bitmap)
    print(f"bitmap: {len(bitmap)}B, hash=0x{bhash.hex()}")

    deposit = int(args.deposit * (10 ** L3_USDC_DECIMALS))
    print(f"deposit: {args.deposit} USDC = {deposit} wei (18-dec)")

    if not args.dry_run:
        bal = bot.usdc_balance()
        print(f"usdc balance: {bal / 10**18:.6f}")
        if bal < deposit:
            print("insufficient USDC; top up the wallet.")
            sys.exit(1)

    print("approve …")
    bot.approve_usdc(deposit)

    print("join …")
    tx = bot.join_batch(args.batch, config_hash, deposit, bhash)
    print(f"join tx: 0x{tx.hex() if isinstance(tx, bytes) else tx}")

    print("reveal bitmap to oracles …")
    accepted = bot.submit_bitmap(args.batch, bitmap, bhash)
    print(f"oracles accepted: {accepted}/{len(bot.oracles)}")

    if args.dry_run:
        print("dry-run complete.")
        return

    print("waiting for settlement …")
    while True:
        payout = bot.get_payout(args.batch)
        if payout > 0:
            pnl = (payout - deposit) / 10**18
            print(f"settled. payout={payout / 10**18:.6f} USDC, pnl={pnl:+.6f}")
            return
        time.sleep(15)


def cmd_probe(args):
    bot = build_bot(dry_run=True)
    print(f"rpc block = {bot.w3.eth.block_number}")
    print(f"chain id  = {bot.w3.eth.chain_id}")
    try:
        info = bot.get_batch(args.batch)
        print(f"batch {args.batch}:")
        for k, v in info.items():
            print(f"  {k} = {v.hex() if isinstance(v, (bytes, bytearray)) else v}")
        config_hash = info["config_hash"]
    except Exception as e:
        print(f"getBatch failed: {e!r}")
        return
    try:
        markets = bot.fetch_markets(config_hash)
        print(f"data-node returned {len(markets)} markets")
        if markets:
            print(f"first market sample: {markets[0]}")
    except Exception as e:
        print(f"data-node fetch failed: {e!r}")


def main():
    p = argparse.ArgumentParser(prog="vision-twitch-bot")
    sub = p.add_subparsers(dest="cmd", required=True)

    pt = sub.add_parser("trade", help="join batch and submit bitmap")
    pt.add_argument("--batch", type=int, required=True)
    pt.add_argument("--deposit", type=float, required=True, help="USDC (L3, 18-dec)")
    pt.add_argument("--strategy", default="all_yes", choices=["all_yes", "all_no"])
    pt.add_argument("--dry-run", action="store_true")
    pt.set_defaults(func=cmd_trade)

    pp = sub.add_parser("probe", help="read-only smoke test against testnet")
    pp.add_argument("--batch", type=int, required=True)
    pp.set_defaults(func=cmd_probe)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
