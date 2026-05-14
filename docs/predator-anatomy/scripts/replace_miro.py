#!/usr/bin/env python3
"""Wipe the General board, then upload the new 7 multi-step SVGs (1500x1300)."""
import os, json, pathlib, time, urllib.parse, requests

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BID = "uXjVOkYo-do="
ENC = BID.replace("=", "%3D")
BASE = f"https://api.miro.com/v2/boards/{ENC}"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
SVG_DIR = pathlib.Path("/Users/maxguillabert/Downloads/index/docs/predator-anatomy/diagrams/multi")

# 1) wipe
print("Wiping…")
cursor = None
items = []
while True:
    url = f"{BASE}/items?limit=50"
    if cursor: url += f"&cursor={cursor}"
    r = requests.get(url, headers=HEADERS).json()
    for i in r.get("data", []):
        items.append((i.get("id"), i.get("type")))
    cursor = r.get("cursor")
    if not cursor: break
ep_map = {"text": "texts", "image": "images", "shape": "shapes", "frame": "frames"}
deleted = 0
for iid, t in items:
    ep = ep_map.get(t, "items")
    r = requests.delete(f"{BASE}/{ep}/{iid}", headers=HEADERS)
    if r.status_code in (200, 204):
        deleted += 1
    time.sleep(0.04)
print(f"  deleted {deleted}/{len(items)}")

# 2) upload new
WIDTH = 1500
GAP = 200
PITCH = 2050 + GAP  # canvas height + gap
NAMES = ["01-toxic-flow","02-stop-hunting","03-cross-venue","04-latency","05-information","06-spoofing","07-pfof"]

print("Uploading…")
for i, name in enumerate(NAMES):
    y_centre = 1050 + i * PITCH
    svg = SVG_DIR / f"{name}.svg"
    data = {
        "title": name,
        "position": {"x": 0, "y": y_centre, "origin": "center"},
        "geometry": {"width": WIDTH},
    }
    with open(svg, "rb") as f:
        r = requests.post(
            f"{BASE}/images",
            headers=HEADERS,
            files={
                "resource": (svg.name, f, "image/svg+xml"),
                "data": (None, json.dumps(data), "application/json"),
            },
        )
    if r.ok:
        print(f"  uploaded {name} @ y={y_centre}")
    else:
        print(f"  ERR {name}: {r.status_code} {r.text[:200]}")
    time.sleep(0.25)

print(f"\nView: https://miro.com/app/board/{BID}")
