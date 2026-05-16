#!/usr/bin/env python3
"""Restore every Miro-board SVG from HEAD~1 and upload it to the board
at a +12000 px x-offset — so the previous (Apple keynote) version sits
to the right of the current (AntiCheatFull) rebuild for side-by-side
comparison.

Does NOT wipe. Adds only. Run after the AntiCheatFull rebuild is live.

    export $(grep -E "^MIRO_" .env | xargs)
    python3 docs/predator-anatomy/scripts/upload_previous_for_compare.py
"""
import json
import os
import pathlib
import subprocess
import time
import urllib.parse

import requests

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BID = "uXjVOkYo-do="
ENC = BID.replace("=", "%3D")
BASE = f"https://api.miro.com/v2/boards/{ENC}"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

REPO = pathlib.Path(__file__).resolve().parents[3]
TMP = pathlib.Path("/tmp/oldsvgs")

# Shift the entire old layout this far right of the current one.
X_OFFSET = 12000

# Layout numbers — mirrors upload_board.py and upload_to_miro.py.
Y_HERO         = 0
Y_THEORY_1     = 1700
Y_THEORY_2     = 3300
Y_DIVIDER_MECH = 4800
Y_MECH_START   = 5900
MECH_PITCH     = 2250

HERO_W = 2400
THEORY_W = 1800
DIVIDER_W = 2400
MECH_W = 1500
VOICES_W = 600
PRODUCT_W = 1600
FIX_W = 2400

X_THEORY_OFFSET = 1000
X_MECH = -450
X_VOICES = 1450
X_PRODUCT_OFFSET = 1750
X_C_OFFSETS = [-2625, -875, 875, 2625]

# Bot-tutorial layout (from upload_to_miro.py).
BT_CENTRE_X = 4800
BT_SVG_WIDTH = 1200
BT_START_Y = 1200
BT_GAP_Y = 1300
BT_HERO_Y = 0
BT_CLOSER_OFFSET = 900


def extract(rel_path: str) -> pathlib.Path:
    """Pull a single file from HEAD~1 into /tmp/oldsvgs/<rel_path>."""
    out = TMP / rel_path
    out.parent.mkdir(parents=True, exist_ok=True)
    content = subprocess.check_output(
        ["git", "show", f"HEAD~1:{rel_path}"], cwd=REPO
    )
    out.write_bytes(content)
    return out


def upload_image(svg_path: pathlib.Path, x: float, y: float, width: int):
    data = {
        "title": f"OLD · {svg_path.stem}",
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
            timeout=30,
        )
    if not r.ok:
        print(f"  ERR {svg_path.name}: {r.status_code} {r.text[:200]}")
    return r


def text(content: str, x: float, y: float, width: int, font_size: int,
         color: str = "#0A0A0A", bold: bool = True):
    weight = "bold" if bold else "normal"
    html = (
        f'<p style="text-align:center">'
        f'<span style="color:{color};font-size:{font_size}px;'
        f'font-weight:{weight};letter-spacing:-0.022em">{content}</span></p>'
    )
    payload = {
        "data": {"content": html},
        "style": {"textAlign": "center", "color": color},
        "position": {"x": x, "y": y, "origin": "center"},
        "geometry": {"width": width},
    }
    r = requests.post(
        f"{BASE}/texts",
        headers={**HEADERS, "Content-Type": "application/json"},
        json=payload,
        timeout=20,
    )
    if not r.ok:
        print(f"  ERR text: {r.status_code} {r.text[:200]}")


def main():
    print("Extracting HEAD~1 SVGs to /tmp/oldsvgs/ ...")

    EXTRAS = "docs/predator-anatomy/diagrams/extras"
    MULTI  = "docs/predator-anatomy/diagrams/multi"
    PRODUCT = "docs/predator-anatomy/diagrams/product"
    BT     = "docs/bot-tutorial/diagrams"

    # Predator-anatomy layout files (matching upload_board.py).
    pa_files = [
        # Hero
        f"{EXTRAS}/00-hero.svg",
        # Theory 2x2
        f"{EXTRAS}/0A-triangle.svg",
        f"{EXTRAS}/0B-limit.svg",
        f"{EXTRAS}/0C-skandalon.svg",
        f"{EXTRAS}/0D-pharmakon.svg",
        # Dividers
        f"{EXTRAS}/99-divider-MECHANISMS.svg",
        f"{EXTRAS}/99-divider-PROTOCOL.svg",
        f"{EXTRAS}/99-divider-REFUSAL.svg",
        f"{EXTRAS}/99-fix.svg",
        # Mechanisms (mainline)
        f"{MULTI}/01-toxic-flow.svg",
        f"{MULTI}/02-stop-hunting.svg",
        f"{MULTI}/03-cross-venue.svg",
        f"{MULTI}/04-latency.svg",
        f"{MULTI}/05-information.svg",
        f"{MULTI}/06-spoofing.svg",
        f"{MULTI}/07-pfof.svg",
        # Voices
        f"{EXTRAS}/voices-01-toxic-flow.svg",
        f"{EXTRAS}/voices-02-stop-hunting.svg",
        f"{EXTRAS}/voices-03-cross-venue.svg",
        f"{EXTRAS}/voices-04-latency.svg",
        f"{EXTRAS}/voices-05-information.svg",
        f"{EXTRAS}/voices-06-spoofing.svg",
        f"{EXTRAS}/voices-07-pfof.svg",
        # Product
        f"{PRODUCT}/A1-what-is-a-block.svg",
        f"{PRODUCT}/A2-how-block-resolves.svg",
        f"{PRODUCT}/A3-block-returns.svg",
        f"{PRODUCT}/B1-timeline.svg",
        # Refusal
        f"{PRODUCT}/C1-insider-trading.svg",
        f"{PRODUCT}/C2-front-running.svg",
        f"{PRODUCT}/C3-market-manipulation.svg",
        f"{PRODUCT}/C4-pfof.svg",
        f"{PRODUCT}/C5-spoofing.svg",
        f"{PRODUCT}/C6-toxic-flow.svg",
        f"{PRODUCT}/C7-latency.svg",
    ]
    bt_files = [f"{BT}/{n:02d}-{name}.svg" for n, name in [
        (1, "clone"), (2, "bootstrap"), (3, "probe"), (4, "strategy"),
        (5, "backtest"), (6, "training"), (7, "dryrun"), (8, "trade"),
        (9, "race"), (10, "track"),
    ]]
    for rel in pa_files + bt_files:
        try:
            extract(rel)
        except subprocess.CalledProcessError as e:
            print(f"  ⚠ could not extract {rel}: {e}")

    print(f"Extracted {len(pa_files) + len(bt_files)} files. Uploading shifted by +{X_OFFSET} ...")

    # Header label so it's obvious what this column is.
    text("PREVIOUS VERSION — APPLE KEYNOTE",
         X_OFFSET, -800, 2400, 80, "#1D1D1F")

    # ── HERO ──
    upload_image(TMP / EXTRAS / "00-hero.svg",
                 X_OFFSET, Y_HERO, HERO_W)
    # ── 4 THEORY ──
    upload_image(TMP / EXTRAS / "0A-triangle.svg",
                 X_OFFSET - X_THEORY_OFFSET, Y_THEORY_1, THEORY_W)
    upload_image(TMP / EXTRAS / "0B-limit.svg",
                 X_OFFSET + X_THEORY_OFFSET, Y_THEORY_1, THEORY_W)
    upload_image(TMP / EXTRAS / "0C-skandalon.svg",
                 X_OFFSET - X_THEORY_OFFSET, Y_THEORY_2, THEORY_W)
    upload_image(TMP / EXTRAS / "0D-pharmakon.svg",
                 X_OFFSET + X_THEORY_OFFSET, Y_THEORY_2, THEORY_W)
    # ── Divider MECHANISMS ──
    upload_image(TMP / EXTRAS / "99-divider-MECHANISMS.svg",
                 X_OFFSET, Y_DIVIDER_MECH, DIVIDER_W)
    # ── Mechanisms + voices ──
    mech_names = ["01-toxic-flow", "02-stop-hunting", "03-cross-venue", "04-latency",
                  "05-information", "06-spoofing", "07-pfof"]
    for i, name in enumerate(mech_names):
        y = Y_MECH_START + i * MECH_PITCH
        upload_image(TMP / MULTI / f"{name}.svg",
                     X_OFFSET + X_MECH, y, MECH_W)
        upload_image(TMP / EXTRAS / f"voices-{name}.svg",
                     X_OFFSET + X_VOICES, y, VOICES_W)
        time.sleep(0.12)

    PRODUCT_ROW_PITCH = 1600
    y_protocol_div = Y_MECH_START + len(mech_names) * MECH_PITCH + 200
    upload_image(TMP / EXTRAS / "99-divider-PROTOCOL.svg",
                 X_OFFSET, y_protocol_div, DIVIDER_W)
    y_a_row = y_protocol_div + 1000
    upload_image(TMP / PRODUCT / "A1-what-is-a-block.svg",
                 X_OFFSET - X_PRODUCT_OFFSET, y_a_row, PRODUCT_W)
    upload_image(TMP / PRODUCT / "A2-how-block-resolves.svg",
                 X_OFFSET, y_a_row, PRODUCT_W)
    upload_image(TMP / PRODUCT / "A3-block-returns.svg",
                 X_OFFSET + X_PRODUCT_OFFSET, y_a_row, PRODUCT_W)
    y_b = y_a_row + PRODUCT_ROW_PITCH
    upload_image(TMP / PRODUCT / "B1-timeline.svg",
                 X_OFFSET, y_b, PRODUCT_W)

    y_c_div = y_b + 1100
    upload_image(TMP / EXTRAS / "99-divider-REFUSAL.svg",
                 X_OFFSET, y_c_div, DIVIDER_W)
    c_names = ["C1-insider-trading", "C2-front-running", "C3-market-manipulation",
               "C4-pfof", "C5-spoofing", "C6-toxic-flow", "C7-latency"]
    y_c_row1 = y_c_div + 1000
    y_c_row2 = y_c_row1 + PRODUCT_ROW_PITCH
    for i in range(4):
        upload_image(TMP / PRODUCT / f"{c_names[i]}.svg",
                     X_OFFSET + X_C_OFFSETS[i], y_c_row1, PRODUCT_W)
    row2_offsets = [-1750, 0, 1750]
    for i in range(3):
        upload_image(TMP / PRODUCT / f"{c_names[4 + i]}.svg",
                     X_OFFSET + row2_offsets[i], y_c_row2, PRODUCT_W)
    y_fix = y_c_row2 + 1500
    upload_image(TMP / EXTRAS / "99-fix.svg",
                 X_OFFSET, y_fix, FIX_W)

    # ── Bot-tutorial column (shifted right of everything else) ──
    bt_x = X_OFFSET + BT_CENTRE_X
    text("PREVIOUS VERSION — BOT TUTORIAL",
         bt_x, BT_HERO_Y - 200, 1500, 60, "#1D1D1F")
    for i, rel in enumerate(bt_files):
        y = BT_START_Y + i * BT_GAP_Y
        upload_image(TMP / rel, bt_x, y, BT_SVG_WIDTH)
        time.sleep(0.12)

    print(f"\nDone. View: https://miro.com/app/board/{BID}")


if __name__ == "__main__":
    main()
