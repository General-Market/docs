#!/usr/bin/env python3
"""Upload the 7 multi-step SVGs to the General board, single-column vertical layout."""
import os, json, pathlib, time, urllib.parse, requests

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BOARD_ID = "uXjVOkYo-do="
BOARD_ENC = urllib.parse.quote(BOARD_ID, safe="")
BASE = f"https://api.miro.com/v2/boards/{BOARD_ENC}"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

SVG_DIR = pathlib.Path("/Users/maxguillabert/Downloads/index/docs/predator-anatomy/diagrams/multi")

# Each SVG is 1068 wide × 1100 tall. Render at native size on Miro.
WIDTH = 1068
GAP = 200  # vertical breathing room between cards

NAMES = [
    "01-toxic-flow",
    "02-stop-hunting",
    "03-cross-venue",
    "04-latency",
    "05-information",
    "06-spoofing",
    "07-pfof",
]

# Center column at x=0. First card centred at y=0 + 550 (so top is at 0). Each card adds 1100 + GAP = 1300.
START_Y = 0
PITCH = 1100 + GAP

for i, name in enumerate(NAMES):
    y_centre = START_Y + 550 + i * PITCH   # 550 = half of 1100 — first card top sits at START_Y
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

print(f"\nView: https://miro.com/app/board/{BOARD_ID}")
