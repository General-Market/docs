#!/usr/bin/env python3
"""Upload the full ten-frame bot-tutorial storyboard to Miro.

Board:    uXjVOkYo-do=
Column:   far right, past every other section (existing content max x ≈ +2625).
          Hero at x=+4800, y=0. Frames stack down with 1300 px between centres.

Usage:
    export $(grep -E "^MIRO_" .env | xargs)
    python3 docs/bot-tutorial/scripts/upload_to_miro.py
"""
import json
import os
import pathlib
import time
import urllib.parse

import requests

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BOARD_ID = "uXjVOkYo-do="
BOARD_ENC = urllib.parse.quote(BOARD_ID, safe="")
BASE = f"https://api.miro.com/v2/boards/{BOARD_ENC}"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

REPO = pathlib.Path(__file__).resolve().parents[3]
SVG_DIR = REPO / "docs" / "bot-tutorial" / "diagrams"

# Palette — kept in sync with the SVGs.
INK = "#0A0A0A"
INK_2 = "#1F1F24"
INK_3 = "#6E727A"
BLUE = "#0052FF"

# Right column anchor — past the rightmost existing item (x ≈ +2625).
CENTRE_X = 4800
SVG_WIDTH = 1200            # rendered width on board
START_Y = 1200              # first card centre, just below the hero
GAP_Y = 1300                # centre-to-centre between cards
HERO_Y = 0                  # aligned with the existing board hero
CLOSER_OFFSET = 900         # closer placed below the last card


CARDS = [
    {"n": "01", "svg": "01-clone.svg",     "title": "Clone the bot"},
    {"n": "02", "svg": "02-bootstrap.svg", "title": "Bootstrap + faucet"},
    {"n": "03", "svg": "03-probe.svg",     "title": "Probe the chain"},
    {"n": "04", "svg": "04-strategy.svg",  "title": "Pick a thesis"},
    {"n": "05", "svg": "05-backtest.svg",  "title": "Backtest"},
    {"n": "06", "svg": "06-training.svg",  "title": "Train the model"},
    {"n": "07", "svg": "07-dryrun.svg",    "title": "Dry run"},
    {"n": "08", "svg": "08-trade.svg",     "title": "First live wager"},
    {"n": "09", "svg": "09-race.svg",      "title": "Race two strategies"},
    {"n": "10", "svg": "10-track.svg",     "title": "Track the ledger"},
]


def create_item(endpoint: str, payload: dict) -> dict:
    r = requests.post(
        f"{BASE}/{endpoint}",
        headers={**HEADERS, "Content-Type": "application/json"},
        json=payload,
        timeout=20,
    )
    if not r.ok:
        print(f"  ERR {endpoint}: {r.status_code} {r.text[:240]}")
    return r.json() if r.text else {}


def upload_image(svg_path: pathlib.Path, x: float, y: float, width: int) -> dict:
    data_payload = {
        "title": svg_path.stem,
        "position": {"x": x, "y": y, "origin": "center"},
        "geometry": {"width": width},
    }
    with open(svg_path, "rb") as f:
        files = {
            "resource": (svg_path.name, f, "image/svg+xml"),
            "data": (None, json.dumps(data_payload), "application/json"),
        }
        r = requests.post(
            f"{BASE}/images", headers=HEADERS, files=files, timeout=30
        )
    if not r.ok:
        print(f"  ERR upload {svg_path.name}: {r.status_code} {r.text[:300]}")
    return r.json() if r.text else {}


def text(
    content: str,
    x: float,
    y: float,
    width: int,
    font_size: int,
    color: str = INK,
    align: str = "center",
    bold: bool = True,
) -> dict:
    weight = "bold" if bold else "normal"
    html = (
        f'<p style="text-align:{align}">'
        f'<span style="color:{color};font-size:{font_size}px;'
        f'font-weight:{weight};letter-spacing:-0.022em">{content}</span></p>'
    )
    payload = {
        "data": {"content": html},
        "style": {"textAlign": align, "color": color},
        "position": {"x": x, "y": y, "origin": "center"},
        "geometry": {"width": width},
    }
    return create_item("texts", payload)


def main() -> None:
    # ── Hero ──
    text("YOUR FIRST VISION BOT",        CENTRE_X, HERO_Y,        1500, 96, INK)
    text("Ten steps from clone to live wager.", CENTRE_X, HERO_Y + 130, 1500, 30, INK_3, bold=False)
    text(
        "Storyboard for a Claude Code-driven demo of "
        "github.com/General-Market/vision-bot-examples. "
        "Each frame is one shot. The video records the same commands, in the same order, "
        "against the real chain.",
        CENTRE_X, HERO_Y + 220, 1200, 18, INK_2, bold=False,
    )

    # ── Cards ──
    last_y = START_Y
    for i, card in enumerate(CARDS):
        y = START_Y + i * GAP_Y
        svg_path = SVG_DIR / card["svg"]
        upload_image(svg_path, CENTRE_X, y, SVG_WIDTH)
        print(f"  placed card {card['n']} at y={y}  ({card['svg']})")
        last_y = y
        time.sleep(0.3)

    # ── Closer ──
    closer_y = last_y + CLOSER_OFFSET
    text("The plumbing is solved.",       CENTRE_X, closer_y,        1500, 54, INK)
    text("The strategy is yours.",        CENTRE_X, closer_y + 80,   1500, 54, BLUE)
    text(
        "github.com/General-Market/vision-bot-examples",
        CENTRE_X, closer_y + 220, 1200, 20, INK_3, bold=False,
    )

    print(f"\nDone. View: https://miro.com/app/board/{BOARD_ID}")


if __name__ == "__main__":
    main()
