#!/usr/bin/env python3
"""Check zero-sum invariant from issuer balance update logs."""
import sys

per_tick = {}
per_player = {}

for line in sys.stdin:
    parts = line.split()
    try:
        batch_id = int([p for p in parts if p.startswith("batch_id=")][0].split("=")[1])
        tick_id = int([p for p in parts if p.startswith("tick_id=")][0].split("=")[1])
        player = [p for p in parts if p.startswith("player=")][0].split("=")[1]
        delta_str = [p for p in parts if p.startswith("delta=")][0].split("=")[1]
        delta = int(delta_str)
    except (IndexError, ValueError):
        continue

    key = (batch_id, tick_id)
    per_tick[key] = per_tick.get(key, 0) + delta
    per_player[player] = per_player.get(player, 0) + delta

violations = [(k, v) for k, v in per_tick.items() if v != 0]
print(f"Total tick-pairs: {len(per_tick)}")
print(f"Zero-sum violations: {len(violations)}")
if violations:
    for (bid, tid), v in sorted(violations)[:20]:
        print(f"  batch={bid} tick={tid} sum={v}")
else:
    print("All ticks zero-sum")

print(f"\nPer-player total delta:")
for player, total in sorted(per_player.items()):
    print(f"  {player}: {total:+d} ({total/1e6:+.2f} USDC)")

grand = sum(per_tick.values())
print(f"\nGrand total: {grand:+d} ({grand/1e6:+.2f} USDC)")
