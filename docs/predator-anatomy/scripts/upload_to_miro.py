#!/usr/bin/env python3
"""Upload predator-anatomy visual brief to Miro in Apple style."""
import os, json, pathlib, time, urllib.parse, requests

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BOARD_ID = "uXjVOkYo-do="
BOARD_ENC = urllib.parse.quote(BOARD_ID, safe="")
BASE = f"https://api.miro.com/v2/boards/{BOARD_ENC}"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

SVG_DIR = pathlib.Path("/tmp/predator-anatomy-svgs")

# Apple palette
INK = "#1D1D1F"
INK_2 = "#424245"
INK_3 = "#6E6E73"
BLUE = "#0071E3"
BLUE_TINT = "#B5D4F5"
RULE = "#D2D2D7"
PAPER = "#FFFFFF"
PAPER_2 = "#FBFBFD"
RED = "#DD0426"
GREEN = "#0A7C42"

# Per-card data
CARDS = [
    {
        "n": "01", "title": "Toxic-flow market making", "frame": "THE WIDEN",
        "tagline": "Quote tight. Dump on uninformed counterparty.",
        "svg": "01-toxic-flow.svg",
        "spend": "~$710K / yr", "take": "$2–5M / yr",
        "cap": "Quote tight to attract retail. Read direction at fill. Widen spread. $0.20/share captured, no inventory risk.",
    },
    {
        "n": "02", "title": "Stop & liquidation hunting", "frame": "THE WICK",
        "tagline": "Push the price. Harvest the forced sellers.",
        "svg": "02-stop-hunting.svg",
        "spend": "~$350K / yr", "take": "$1–4M / yr",
        "cap": "Level 3 feed reveals stop clusters. $5M of selling triggers $20M of forced unwinds. Cover, resell.",
    },
    {
        "n": "03", "title": "Cross-venue arbitrage", "frame": "THE LAG",
        "tagline": "Same asset. Two venues. 80 milliseconds of light.",
        "svg": "03-cross-venue.svg",
        "spend": "~$400K / yr", "take": "$500K–2M / yr",
        "cap": "Binance moves at t=0. Coinbase catches up at t+80ms. The arbitrageur reads both mailboxes.",
    },
    {
        "n": "04", "title": "Latency arbitrage", "frame": "THE TIME BAR",
        "tagline": "Co-locate. Beat the orderbook to the print.",
        "svg": "04-latency.svg",
        "spend": "~$650K / yr", "take": "$300K–1.5M / yr",
        "cap": "FPGA tick-to-trade: 810 nanoseconds. Retail click: 200 milliseconds. The click was never the trade.",
    },
    {
        "n": "05", "title": "Information edge", "frame": "THE CALENDAR",
        "tagline": "Read the receipts before the company does.",
        "svg": "05-information.svg",
        "spend": "~$714K / yr", "take": "$500K–2M / yr",
        "cap": "Credit-card panel in January. Satellite in February. Expert call in March. Position in April. Headline in April.",
    },
    {
        "n": "06", "title": "Spoofing & layering", "frame": "THE WALL THAT WASN'T",
        "tagline": "Build a wall. Cancel it. Walk the price.",
        "svg": "06-spoofing.svg",
        "spend": "~$0 marginal", "take": "$200K–2M / yr",
        "cap": "Bid wall at $99 for 47ms. Retail reads support, buys. Wall cancels. Price drops $0.20. Sarao did this for $40M.",
    },
    {
        "n": "07", "title": "Payment for order flow", "frame": "THE CASH ROUTE",
        "tagline": "Pay the broker. Pocket the spread.",
        "svg": "07-pfof.svg",
        "spend": "$943M / 9mo (Citadel)", "take": "$3–5B / yr",
        "cap": "Citadel pays Robinhood $1.30 to route your order. Hands back $0.20 'price improvement'. Keeps $3.50 of spread.",
    },
]


def create_item(endpoint: str, payload: dict) -> dict:
    r = requests.post(f"{BASE}/{endpoint}", headers={**HEADERS, "Content-Type": "application/json"}, json=payload)
    if not r.ok:
        print(f"  ERR {endpoint}: {r.status_code} {r.text[:200]}")
    return r.json() if r.text else {}


def upload_image(svg_path: pathlib.Path, x: float, y: float, width: int) -> dict:
    # Multipart upload
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
        r = requests.post(f"{BASE}/images", headers=HEADERS, files=files)
    if not r.ok:
        print(f"  ERR upload {svg_path.name}: {r.status_code} {r.text[:300]}")
    return r.json() if r.text else {}


def text(content: str, x: float, y: float, width: int, font_size: int, color: str = INK, align: str = "center", bold: bool = True) -> dict:
    weight = "bold" if bold else "normal"
    # Miro accepts simple HTML in text content
    html = f'<p style="text-align:{align}"><span style="color:{color};font-size:{font_size}px;font-weight:{weight};letter-spacing:-0.022em">{content}</span></p>'
    payload = {
        "data": {"content": html},
        "style": {"textAlign": align, "color": color},
        "position": {"x": x, "y": y, "origin": "center"},
        "geometry": {"width": width},
    }
    return create_item("texts", payload)


def shape(text_html: str, x: float, y: float, w: int, h: int, fill: str, font_color: str, font_size: int = 16) -> dict:
    payload = {
        "data": {"shape": "rectangle", "content": text_html},
        "style": {
            "fillColor": fill, "fillOpacity": "1.0", "borderColor": fill,
            "borderWidth": 0, "borderStyle": "normal",
            "color": font_color, "fontFamily": "open_sans", "fontSize": str(font_size),
            "textAlign": "center", "textAlignVertical": "middle",
        },
        "position": {"x": x, "y": y, "origin": "center"},
        "geometry": {"width": w, "height": h},
    }
    return create_item("shapes", payload)


def main():
    # Layout constants
    centre_x = 0
    card_width = 1100
    svg_width = 980
    gap_y = 880  # vertical spacing between card centres
    title_y = -2900

    # -------- HERO --------
    text("THE PREDATOR ANATOMY", centre_x, title_y, 1400, 88, INK)
    text("Seven extractions, frame by frame.", centre_x, title_y + 130, 1400, 32, INK_3, bold=False)
    text("A ten-person market-making firm spends $2.88M a year on the stack below. Each card shows what one weapon costs to operate, what it earns, and what it costs you in slippage.", centre_x, title_y + 200, 1100, 18, INK_2, bold=False)

    # -------- 7 CARDS --------
    start_y = title_y + 580
    for i, card in enumerate(CARDS):
        y = start_y + i * gap_y
        # Card label number
        text(card["n"], centre_x - 480, y - 280, 80, 56, BLUE)
        # Card title
        text(card["title"], centre_x - 70, y - 280, 800, 36, INK, align="left")
        # Frame name
        text(card["frame"], centre_x + 480, y - 280, 280, 14, INK_3, align="right")
        # Tagline
        text(card["tagline"], centre_x - 70, y - 220, 800, 16, INK_3, align="left", bold=False)

        # Upload SVG
        svg = SVG_DIR / card["svg"]
        upload_image(svg, centre_x, y, svg_width)
        time.sleep(0.2)  # gentle pacing

        # 3-column bottom row: spend | take | on General
        bottom_y = y + 240
        cell_w = 340
        cell_h = 110
        # Spend
        spend_html = f'<p><strong>OPERATOR SPEND</strong></p><p>{card["spend"]}</p>'
        shape(spend_html, centre_x - cell_w - 10, bottom_y, cell_w, cell_h, "#FCEAEC", RED, font_size=18)
        # Take
        take_html = f'<p><strong>ANNUAL TAKE</strong></p><p>{card["take"]}</p>'
        shape(take_html, centre_x, bottom_y, cell_w, cell_h, "#FCEAEC", RED, font_size=18)
        # General
        gen_html = f'<p><strong>ON GENERAL</strong></p><p>$0</p>'
        shape(gen_html, centre_x + cell_w + 10, bottom_y, cell_w, cell_h, "#E8F2FE", BLUE, font_size=18)

        # Caption below
        text(card["cap"], centre_x, bottom_y + 100, 1000, 14, INK_2, bold=False)

        print(f"  placed card {card['n']} at y={y}")

    # -------- MATRIX --------
    mat_y = start_y + len(CARDS) * gap_y + 200
    text("THE MATRIX", centre_x, mat_y - 240, 600, 18, INK_3)
    text("Where the stack works.", centre_x, mat_y - 180, 1000, 44, INK, bold=True)
    text("A predator stack is a venue-specific asset. The venue is the variable.", centre_x, mat_y - 110, 1000, 18, INK_3, bold=False)

    col_w = 380
    row_h = 200
    col_label_y = mat_y - 30
    text("EXCHANGES", centre_x - col_w / 2 - 200, col_label_y, 300, 16, BLUE)
    text("GENERAL MARKET", centre_x + col_w / 2 + 200, col_label_y, 300, 16, BLUE)

    # Row 1: $2.88M stack
    row1_y = col_label_y + 130
    text("$2.88M PREDATOR STACK", centre_x - 720, row1_y, 280, 14, INK)
    text("small MM firm", centre_x - 720, row1_y + 36, 280, 12, INK_3, bold=False)
    shape("<p><strong>+$4.5–16.5M / yr</strong></p>", centre_x - col_w / 2 - 200, row1_y, col_w, row_h, "#E5F4EC", GREEN, font_size=22)
    shape("<p><strong>$0</strong></p>", centre_x + col_w / 2 + 200, row1_y, col_w, row_h, PAPER, INK, font_size=22)

    # Row 2: $0 stack
    row2_y = row1_y + row_h + 30
    text("$0 STACK", centre_x - 720, row2_y, 280, 14, INK)
    text("you", centre_x - 720, row2_y + 36, 280, 12, INK_3, bold=False)
    shape("<p><strong>−$65 / $10K trade</strong></p>", centre_x - col_w / 2 - 200, row2_y, col_w, row_h, "#FCEAEC", RED, font_size=22)
    shape("<p><strong>$0</strong></p>", centre_x + col_w / 2 + 200, row2_y, col_w, row_h, PAPER, INK, font_size=22)

    # -------- CLOSER --------
    closer_y = row2_y + 360
    text("If you can't trade like a hedge fund,", centre_x, closer_y, 1600, 54, INK)
    text("trade where hedge funds trade like you.", centre_x, closer_y + 80, 1600, 54, BLUE)
    text("generalmarket.io", centre_x, closer_y + 200, 600, 18, INK_3, bold=False)

    print(f"\nDone. View: https://miro.com/app/board/{BOARD_ID}")


if __name__ == "__main__":
    main()
