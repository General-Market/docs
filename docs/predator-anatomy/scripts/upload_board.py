#!/usr/bin/env python3
"""Wipe the General board and upload the full ICEBERG composition.

Sections (top to bottom):
- HERO (centred, wide)
- 4 THEORY cards in a 2x2 grid
- Divider · THE SEVEN MECHANISMS
- 7 MECHANISM cards (left spine) + VOICES cards (right column)
- Divider · THE PROTOCOL
- A1, A2, A3 product primitives (row of 3)
- B1 timeline (centred)
- Divider · HOW BLOCK TRADING REFUSES EACH ONE
- C1-C7 mechanism-fix cards (4+3 grid)
- FIX closing card (centred bottom)
"""
import os, json, pathlib, time, urllib.parse, requests

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BID = "uXjVOkYo-do="
ENC = BID.replace("=", "%3D")
BASE = f"https://api.miro.com/v2/boards/{ENC}"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

ROOT = pathlib.Path(__file__).resolve().parents[1] / "diagrams"
MECH_DIR = ROOT / "multi"
EXTRAS_DIR = ROOT / "extras"
PRODUCT_DIR = ROOT / "product"


def upload_image(svg_path, x, y, width):
    data = {
        "title": svg_path.stem,
        "position": {"x": x, "y": y, "origin": "center"},
        "geometry": {"width": width},
    }
    with open(svg_path, "rb") as f:
        r = requests.post(
            f"{BASE}/images",
            headers=HEADERS,
            files={
                "resource": (svg_path.name, f, "image/svg+xml"),
                "data": (None, json.dumps(data), "application/json"),
            },
        )
    if not r.ok:
        print(f"  ERR {svg_path.name}: {r.status_code} {r.text[:200]}")
    return r


def wipe():
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
        if r.status_code in (200, 204): deleted += 1
        time.sleep(0.04)
    print(f"Wiped {deleted}/{len(items)} items")


# ===== LAYOUT =====

# Section Y positions
Y_HERO         = 0
Y_THEORY_1     = 1700
Y_THEORY_2     = 3300
Y_DIVIDER_MECH = 4800
Y_MECH_START   = 5900
MECH_PITCH     = 2250

# Card widths (display widths used in Miro upload)
HERO_W = 2400
THEORY_W = 1800
DIVIDER_W = 2400
MECH_W = 1500
VOICES_W = 600
PRODUCT_W = 1600   # bigger than mechanism so type stays readable
FIX_W = 2400

# Horizontal anchors
X_THEORY_OFFSET = 1000   # ±x for the 2x2 theory grid
X_MECH = -450            # mechanism spine slightly left of centre
X_VOICES = 1450          # voices column on the right
# Product primitives row spacing: 3 cards across, gap 100
X_PRODUCT_OFFSET = 1750  # ±x for the outer two of three product cards
# C-grid: 4 cards per row at x=-2625, -875, 875, 2625 (1600 wide + 150 gap)
X_C_OFFSETS = [-2625, -875, 875, 2625]


def main():
    wipe()
    print("\nUploading…\n")

    # HERO
    upload_image(EXTRAS_DIR / "00-hero.svg", 0, Y_HERO, HERO_W)
    print(f"· HERO @ y={Y_HERO}")

    # THEORY 2x2 grid
    upload_image(EXTRAS_DIR / "0A-triangle.svg",  -X_THEORY_OFFSET, Y_THEORY_1, THEORY_W)
    upload_image(EXTRAS_DIR / "0B-limit.svg",      X_THEORY_OFFSET, Y_THEORY_1, THEORY_W)
    upload_image(EXTRAS_DIR / "0C-skandalon.svg", -X_THEORY_OFFSET, Y_THEORY_2, THEORY_W)
    upload_image(EXTRAS_DIR / "0D-pharmakon.svg",  X_THEORY_OFFSET, Y_THEORY_2, THEORY_W)
    print(f"· 4 THEORY cards (2x2 grid)")

    # Divider — MECHANISMS
    upload_image(EXTRAS_DIR / "99-divider.svg", 0, Y_DIVIDER_MECH, DIVIDER_W)
    print(f"· Divider · MECHANISMS @ y={Y_DIVIDER_MECH}")

    # MECHANISMS + VOICES (spine + right column)
    mech_names = ["01-toxic-flow","02-stop-hunting","03-cross-venue","04-latency",
                  "05-information","06-spoofing","07-pfof"]
    for i, name in enumerate(mech_names):
        y = Y_MECH_START + i * MECH_PITCH
        upload_image(MECH_DIR / f"{name}.svg", X_MECH, y, MECH_W)
        upload_image(EXTRAS_DIR / f"voices-{name}.svg", X_VOICES, y, VOICES_W)
        print(f"· Mech {name} + voices @ y={y}")
        time.sleep(0.15)

    # === PRODUCT SECTION ===
    y_protocol_div = Y_MECH_START + len(mech_names) * MECH_PITCH + 200
    upload_image(EXTRAS_DIR / "99-divider-THE-PROTOCOL.svg", 0, y_protocol_div, DIVIDER_W)
    print(f"\n· Divider · PROTOCOL @ y={y_protocol_div}")

    # A1, A2, A3 in a row + B1 in a second row
    y_a_row = y_protocol_div + 900   # account for product card height/2 ≈ 700/2 + breathing
    a_offset = 1750  # ±x
    upload_image(PRODUCT_DIR / "A1-what-is-a-block.svg",  -a_offset, y_a_row, PRODUCT_W)
    upload_image(PRODUCT_DIR / "A2-how-block-resolves.svg", 0,        y_a_row, PRODUCT_W)
    upload_image(PRODUCT_DIR / "A3-block-returns.svg",      a_offset, y_a_row, PRODUCT_W)
    print(f"· Product A1/A2/A3 @ y={y_a_row}")

    y_b = y_a_row + 1400
    upload_image(PRODUCT_DIR / "B1-timeline.svg", 0, y_b, PRODUCT_W)
    print(f"· Timeline B1 @ y={y_b}")

    # === C SECTION (how each extraction is refused) ===
    y_c_div = y_b + 1100
    upload_image(EXTRAS_DIR / "99-divider-HOW-IT-REFUSES.svg", 0, y_c_div, DIVIDER_W)
    print(f"\n· Divider · HOW IT REFUSES @ y={y_c_div}")

    # 4 + 3 grid of C cards
    c_names = ["C1-insider-trading", "C2-front-running", "C3-market-manipulation",
               "C4-pfof", "C5-spoofing", "C6-toxic-flow", "C7-latency"]
    y_c_row1 = y_c_div + 900
    y_c_row2 = y_c_row1 + 1400
    # Row 1 — 4 cards
    for i in range(4):
        upload_image(PRODUCT_DIR / f"{c_names[i]}.svg", X_C_OFFSETS[i], y_c_row1, PRODUCT_W)
        print(f"· {c_names[i]} @ y={y_c_row1}")
    # Row 2 — 3 cards, centred
    row2_offsets = [-1750, 0, 1750]
    for i in range(3):
        upload_image(PRODUCT_DIR / f"{c_names[4 + i]}.svg", row2_offsets[i], y_c_row2, PRODUCT_W)
        print(f"· {c_names[4 + i]} @ y={y_c_row2}")

    # === FIX ===
    y_fix = y_c_row2 + 1300
    upload_image(EXTRAS_DIR / "99-fix.svg", 0, y_fix, FIX_W)
    print(f"\n· FIX @ y={y_fix}")

    print(f"\nView: https://miro.com/app/board/{BID}")


if __name__ == "__main__":
    main()
