#!/usr/bin/env python3
"""Build per-asset visualizer data from oracle Postgres.

Aggregates a player's bets across batches by asset_id. Resolves friendly names
from data-node snapshot + a precomputed source_id keccak map.
"""
import argparse, json, os, re, time, requests
import psycopg2
from psycopg2.extras import RealDictCursor
from concurrent.futures import ThreadPoolExecutor, as_completed

ap = argparse.ArgumentParser()
ap.add_argument("--player", required=True)
ap.add_argument("--limit", type=int, default=20, help="Max batches to consider")
ap.add_argument("--out", default="/tmp/viz")
ap.add_argument("--days", type=int, default=7)
ap.add_argument("--data-node", default="http://localhost:8200")
ap.add_argument("--max-assets", type=int, default=120)
ap.add_argument("--source-map", default="/tmp/viz/source_map.json")
args = ap.parse_args()

SAFE = re.compile(r"[^A-Za-z0-9_.-]+")
def safe(s): return SAFE.sub("_", s)[:120] or "_"

os.makedirs(f"{args.out}/data", exist_ok=True)

# ── Name resolvers ────────────────────────────────────────────────
print("Loading name maps…")
source_map = {}
if os.path.exists(args.source_map):
    source_map = json.load(open(args.source_map))
    print(f"  {len(source_map)} source hashes resolved")

asset_names = {}
try:
    snap = requests.get(f"{args.data_node}/vision/snapshot", timeout=30).json()
    for s in snap.get("snapshots", []):
        aid = s.get("assetId")
        nm = s.get("name") or s.get("symbol") or aid
        if aid:
            asset_names[aid] = nm
    print(f"  {len(asset_names)} asset names from snapshot")
except Exception as e:
    print(f"  snapshot fetch failed: {e}")

def resolve_source_name(source_id_hex):
    rec = source_map.get(source_id_hex)
    if not rec: return source_id_hex[:14] + "…"
    return rec.get("name") or rec.get("slug") or source_id_hex[:14] + "…"

def resolve_asset_name(asset_id):
    name = asset_names.get(asset_id, "")
    if name and name != asset_id and not name.isdigit():
        return name
    if asset_id.startswith("twitch_game_"):
        return f"game {asset_id.removeprefix('twitch_game_')}"
    if asset_id.startswith("twitch_stream_"):
        return asset_id.removeprefix("twitch_stream_")
    if asset_id.startswith("twitch_channel_"):
        return asset_id.removeprefix("twitch_channel_")
    return asset_id

# ── DB queries ────────────────────────────────────────────────────
conn = psycopg2.connect("host=localhost dbname=index_prices user=max", cursor_factory=RealDictCursor)
cur = conn.cursor()
cur.execute("""
    SELECT vb.batch_id, vb.bitmap,
           vbatch.config_hash, vbatch.source_id, vbatch.tick_duration, vbatch.state,
           vrp.deposited::numeric AS deposited, vrp.payout::numeric AS payout,
           vrp.pnl::numeric AS pnl, vrp.correct_count, vrp.total_markets,
           EXTRACT(EPOCH FROM vrp.settled_at)::bigint AS settled_ts
    FROM vision_bitmaps vb
    JOIN vision_batches vbatch ON vbatch.id = vb.batch_id
    LEFT JOIN vision_round_players vrp ON vrp.batch_id = vb.batch_id AND vrp.player = vb.player
    WHERE vb.player = %s
    ORDER BY vb.batch_id DESC
    LIMIT %s
""", (args.player.lower(), args.limit))
rows = cur.fetchall()
print(f"\n{len(rows)} batches with bitmaps for {args.player}")

def assets_for(config_hash):
    if not config_hash: return []
    h = config_hash.removeprefix("0x") if isinstance(config_hash, str) else config_hash.hex()
    c = conn.cursor()
    c.execute("SELECT markets FROM batch_configs WHERE config_hash = decode(%s,'hex') LIMIT 1", (h,))
    r = c.fetchone()
    if r and r.get("markets"):
        return [x.get("assetId") for x in r["markets"] if isinstance(x, dict) and x.get("assetId")]
    return []

def decode_bm(raw, n):
    if not raw: return []
    if isinstance(raw, memoryview): raw = bytes(raw)
    return [("UP" if (raw[i//8] >> (7 - (i%8))) & 1 else "DOWN")
            for i in range(n) if (i // 8) < len(raw)]

_DSN = "host=localhost dbname=index_prices user=max"

def fetch_series(asset_id, days):
    # Per-thread connection: psycopg2 connections are NOT thread-safe; sharing
    # one across the ThreadPoolExecutor serialised every query and made this
    # ~8× slower than necessary.
    tconn = psycopg2.connect(_DSN, cursor_factory=RealDictCursor)
    try:
        c = tconn.cursor()
        c.execute("""
            SELECT EXTRACT(EPOCH FROM fetched_at)::bigint AS ts, value::float8 AS v
            FROM market_prices
            WHERE asset_id = %s AND fetched_at > NOW() - INTERVAL '%s days'
            ORDER BY fetched_at ASC
        """, (asset_id, days))
        return [{"ts": int(r["ts"]), "price": r["v"]} for r in c.fetchall()]
    finally:
        tconn.close()

# ── Aggregate per-asset ───────────────────────────────────────────
# trades[asset_id] = [{batch_id, bet, joined_at, settled, pnl_usdc, deposit_usdc, tick_duration, source_name}]
trades = {}
batch_meta = {}
for r in rows:
    bid = int(r["batch_id"])
    asset_ids = assets_for(r.get("config_hash") or "")
    bets = decode_bm(r.get("bitmap"), len(asset_ids))
    if not bets: continue
    settled = r.get("settled_ts") is not None
    deposit_usdc = float(r["deposited"] or 0) / 1e18
    balance_usdc = float(r["payout"] or 0) / 1e18 if settled else None
    pnl_usdc = (balance_usdc - deposit_usdc) if (settled and balance_usdc is not None) else None
    settled_ts = int(r["settled_ts"] or 0)
    tick_dur = int(r["tick_duration"] or 60)
    # joined_at approximation — no exact field; assume ~5 ticks before settlement
    joined_at = settled_ts - tick_dur * 6 if settled else int(time.time()) - 600
    src_name = resolve_source_name(r.get("source_id") or "")
    batch_meta[bid] = {
        "settled": settled, "deposit_usdc": deposit_usdc,
        "balance_usdc": balance_usdc, "pnl_usdc": pnl_usdc,
        "joined_at": joined_at, "tick_duration": tick_dur,
        "source_name": src_name, "state": r["state"],
        "market_count": int(r["total_markets"] or len(asset_ids)),
    }
    for idx, aid in enumerate(asset_ids):
        if not aid: continue
        bet = bets[idx] if idx < len(bets) else None
        if bet is None: continue
        trades.setdefault(aid, []).append({
            "batch_id": bid, "bet": bet, "joined_at": joined_at,
            "settled": settled, "pnl_usdc": pnl_usdc,
            "deposit_usdc": deposit_usdc, "tick_duration": tick_dur,
            "source_name": src_name,
        })

print(f"\nUnique assets traded: {len(trades)}")

# ── Pull price series in parallel ─────────────────────────────────
asset_ids_sorted = sorted(trades.keys(), key=lambda a: -len(trades[a]))[:args.max_assets]
series_by_id = {}
def pull(aid):
    return aid, fetch_series(aid, args.days)

with ThreadPoolExecutor(max_workers=8) as ex:
    done = 0
    for fut in as_completed([ex.submit(pull, a) for a in asset_ids_sorted]):
        aid, ser = fut.result()
        series_by_id[aid] = ser
        done += 1
        if done % 25 == 0 or done == len(asset_ids_sorted):
            print(f"  series {done}/{len(asset_ids_sorted)}")

# ── Write per-asset files + index ─────────────────────────────────
items = []
for aid in asset_ids_sorted:
    ts_list = trades[aid]
    ts_list.sort(key=lambda t: -t["joined_at"])
    ser = series_by_id.get(aid, [])
    asset_name = resolve_asset_name(aid)
    src_name = ts_list[0]["source_name"] if ts_list else "?"

    settled_trades = [t for t in ts_list if t["settled"]]
    total_pnl = sum(t["pnl_usdc"] or 0 for t in settled_trades) if settled_trades else None
    last_bet = ts_list[0]["bet"] if ts_list else None

    doc = {
        "asset_id": aid, "asset_name": asset_name, "source_name": src_name,
        "history": ser, "trades": ts_list,
    }
    path = f"{args.out}/data/{safe(aid)}.json"
    with open(path, "w") as f:
        json.dump(doc, f, separators=(",", ":"))

    items.append({
        "asset_id": aid, "asset_name": asset_name, "source_name": src_name,
        "trade_count": len(ts_list), "last_bet": last_bet,
        "settled_pnl_usdc": total_pnl, "points": len(ser),
        "last_seen_at": ts_list[0]["joined_at"] if ts_list else 0,
        "file": f"data/{safe(aid)}.json",
    })

# ── Bot-level stats ───────────────────────────────────────────────
all_trades = [t for ts in trades.values() for t in ts]
active_batches = {bid for bid, m in batch_meta.items() if not m["settled"]}
settled_batches = {bid for bid, m in batch_meta.items() if m["settled"]}
total_deposited = sum(m["deposit_usdc"] for m in batch_meta.values())
total_settled_pnl = sum((m["pnl_usdc"] or 0) for m in batch_meta.values() if m["settled"])
sources = sorted({m["source_name"] for m in batch_meta.values()})

stats = {
    "active_batches": len(active_batches),
    "settled_batches": len(settled_batches),
    "total_deposited_usdc": total_deposited,
    "total_settled_pnl_usdc": total_settled_pnl,
    "asset_count": len(trades),
    "trade_count": len(all_trades),
    "first_seen_at": min((m["joined_at"] for m in batch_meta.values()), default=0),
    "last_seen_at": max((m["joined_at"] for m in batch_meta.values()), default=0),
    "sources": sources,
}

# Sort items: most recent activity first, then more trades
items.sort(key=lambda r: (-(r["last_seen_at"] or 0), -r["trade_count"], r["asset_name"] or ""))

doc = {
    "generated_at": int(time.time()),
    "usdc_decimals": 18,
    "player": args.player,
    "stats": stats,
    "items": items,
}
with open(f"{args.out}/index.json", "w") as f:
    json.dump(doc, f, separators=(",", ":"))

print(f"\nDone: {len(items)} assets, {len(all_trades)} trades, {len(active_batches)} active batches")
