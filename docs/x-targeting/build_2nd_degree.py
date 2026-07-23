#!/usr/bin/env python3
"""Build 2nd-degree consensus from Tier 2 followings.

For each Tier 2 handle, load cached followings, count occurrences across
unique users, exclude Tier 1/Tier 2/already-audited. Output sorted TSV.
"""
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path("/Users/maxguillabert/Downloads/index/docs/x-targeting")
FOLLOWERS_DIR = ROOT / "cache" / "raw_searches" / "followers"

TIER1 = {"ThalexGlobal", "RoboNetHQ", "NeutraFinance", "quantymacro",
         "0xLoris", "chameleon_jeff", "rf_extended"}
TIER2 = {"DrDavidSimic", "bookdepth", "annanay", "ArturSepp", "Quantaraum",
         "gametheorizing", "anthdm", "GrantStenger", "mikevanrossum",
         "cardosofede", "DrJStrategy", "extendedapp"}
EXCLUDE = {h.lower() for h in (TIER1 | TIER2)}

# Already audited (case-insensitive)
audited = set()
with open("/tmp/audited.txt") as f:
    for line in f:
        h = line.strip()
        if h and h != "--help":
            audited.add(h.lower())

# Build map: handle -> set of Tier 2 that follow them, plus profile snapshot
follow_map = defaultdict(set)
profiles = {}

for f in sorted(FOLLOWERS_DIR.glob("*_following.json")):
    owner = f.stem.replace("_following", "")
    if owner not in TIER2:
        continue
    data = json.loads(f.read_text())
    for u in data:
        un = u.get("userName") or u.get("screen_name") or ""
        if not un:
            continue
        unl = un.lower()
        if unl in EXCLUDE:
            continue
        follow_map[un].add(owner)
        if un not in profiles:
            profiles[un] = {
                "followers": u.get("followers") or u.get("followersCount") or 0,
                "following": u.get("following") or u.get("followingsCount") or 0,
                "desc": (u.get("description") or "").replace("\n", " ")[:200],
                "name": u.get("name") or "",
                "verified": u.get("isBlueVerified") or False,
            }

# Frequency table
freq = [(h, len(owners), owners) for h, owners in follow_map.items()]
freq.sort(key=lambda x: (-x[1], -profiles[x[0]]["followers"]))

# Stats
total_unique = len(freq)
geq3 = [x for x in freq if x[1] >= 3]
geq2 = [x for x in freq if x[1] >= 2]
geq3_unaudited = [x for x in geq3 if x[0].lower() not in audited]

print(f"Total unique 2nd-degree candidates: {total_unique}")
print(f"Followed by >= 2 of Tier 2: {len(geq2)}")
print(f"Followed by >= 3 of Tier 2: {len(geq3)}")
print(f"  of those NOT in audited set: {len(geq3_unaudited)}")
print()
print("Top 30 by frequency (>=3, unaudited):")
print("freq\tfollowers\thandle\tname\tdesc")
for h, n, owners in geq3_unaudited[:30]:
    p = profiles[h]
    print(f"{n}\t{p['followers']}\t@{h}\t{p['name']}\t{p['desc'][:120]}")

# Write TSV for downstream use
out_tsv = ROOT / "intersection_a1b.tsv"
with out_tsv.open("w") as f:
    f.write("freq\tfollowers\tfollowing\thandle\tname\tverified\towners\tdesc\n")
    for h, n, owners in freq:
        if n < 2:
            break
        p = profiles[h]
        f.write(f"{n}\t{p['followers']}\t{p['following']}\t{h}\t{p['name']}\t{p['verified']}\t{','.join(sorted(owners))}\t{p['desc']}\n")
print(f"\nWrote {out_tsv}")

# Write audit candidate list (top 10 unaudited, >=3)
to_audit = ROOT / "to_audit_a1b.txt"
with to_audit.open("w") as f:
    for h, n, owners in geq3_unaudited[:10]:
        f.write(h + "\n")
print(f"Wrote audit candidates: {to_audit}")
