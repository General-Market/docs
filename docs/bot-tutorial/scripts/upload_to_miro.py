#!/usr/bin/env python3
"""Upload bot-tutorial storyboard to the right side of the Miro board.

Board:        uXjVOkYo-do=
Center column (predator-anatomy) lives at x=0, width≈1100.
This column starts at centre_x=+1800 and stacks three frames vertically.

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

# Apple palette
INK = "#1D1D1F"
INK_2 = "#424245"
INK_3 = "#6E6E73"
BLUE = "#0071E3"
RULE = "#D2D2D7"
PAPER = "#FFFFFF"

# Right column anchor
CENTRE_X = 1800
SVG_WIDTH = 1200            # rendered width on board
FRAME_HEIGHT = 880          # 1200 * 1100/1500 — preserves SVG aspect

# Three frames stacked top-down, ~280 px clear gap between cards.
START_Y = -2400
GAP_Y = 1160                # centre-to-centre

CARDS = [
    {
        "n": "01",
        "title": "Clone the bot",
        "frame": "THE REPO",
        "svg": "01-clone.svg",
        "command": "git clone https://github.com/General-Market/vision-bot-examples",
    },
    {
        "n": "02",
        "title": "Let it assemble itself",
        "frame": "THE BOOTSTRAP",
        "svg": "02-bootstrap.svg",
        "command": "./setup.sh --auto-fund",
    },
    {
        "n": "03",
        "title": "Trade one block",
        "frame": "THE WAGER",
        "svg": "03-trade.svg",
        "command": ".venv/bin/python twitch/live_trader.py --deposit 0.1 --max-joins 1",
    },
]

HERO_Y = START_Y - 760
CLOSER_Y_OFFSET = 720       # closer placed below the last frame

# ── Miro helpers ──────────────────────────────────────────────────


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
    text(
        "YOUR FIRST VISION BOT",
        CENTRE_X,
        HERO_Y,
        1400,
        88,
        INK,
    )
    text(
        "Three steps. One claude. Three minutes from clone to live wager.",
        CENTRE_X,
        HERO_Y + 130,
        1400,
        28,
        INK_3,
        bold=False,
    )
    text(
        "Storyboard for a Claude Code-driven demo. Each frame is one shot in the video — "
        "the mock UIs match the real UIs you will see when you run the commands.",
        CENTRE_X,
        HERO_Y + 200,
        1100,
        18,
        INK_2,
        bold=False,
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
    closer_y = last_y + CLOSER_Y_OFFSET
    text(
        "The repo is solved.",
        CENTRE_X,
        closer_y,
        1500,
        54,
        INK,
    )
    text(
        "The strategy is yours.",
        CENTRE_X,
        closer_y + 80,
        1500,
        54,
        BLUE,
    )
    text(
        "github.com/General-Market/vision-bot-examples",
        CENTRE_X,
        closer_y + 200,
        1200,
        20,
        INK_3,
        bold=False,
    )

    print(f"\nDone. View: https://miro.com/app/board/{BOARD_ID}")


if __name__ == "__main__":
    main()
