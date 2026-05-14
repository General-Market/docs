#!/usr/bin/env python3
"""Add the missing colored shape cells (spend/take/General + matrix)."""
import os, json, urllib.parse, requests, time

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BOARD_ID = "uXjVOkYo-do="
BOARD_ENC = urllib.parse.quote(BOARD_ID, safe="")
BASE = f"https://api.miro.com/v2/boards/{BOARD_ENC}"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

INK = "#1D1D1F"
BLUE = "#0071E3"
RED = "#DD0426"
GREEN = "#0A7C42"
PAPER = "#FFFFFF"
RED_SOFT = "#FCEAEC"
BLUE_SOFT = "#E8F2FE"
GREEN_SOFT = "#E5F4EC"

CARDS = [
    {"n": "01", "spend": "~$710K / yr", "take": "$2–5M / yr"},
    {"n": "02", "spend": "~$350K / yr", "take": "$1–4M / yr"},
    {"n": "03", "spend": "~$400K / yr", "take": "$500K–2M / yr"},
    {"n": "04", "spend": "~$650K / yr", "take": "$300K–1.5M / yr"},
    {"n": "05", "spend": "~$714K / yr", "take": "$500K–2M / yr"},
    {"n": "06", "spend": "~$0 marginal", "take": "$200K–2M / yr"},
    {"n": "07", "spend": "$943M / 9mo", "take": "$3–5B / yr"},
]

def shape(content_html, x, y, w, h, fill, font_color, font_size=18):
    payload = {
        "data": {"shape": "rectangle", "content": content_html},
        "style": {
            "fillColor": fill,
            "fillOpacity": "1.0",
            "borderColor": fill,        # match fill = invisible border
            "borderWidth": "1.0",       # API requires > 1.0 as string
            "borderStyle": "normal",
            "borderOpacity": "1.0",
            "color": font_color,
            "fontFamily": "open_sans",
            "fontSize": str(font_size),
            "textAlign": "center",
            "textAlignVertical": "middle",
        },
        "position": {"x": x, "y": y, "origin": "center"},
        "geometry": {"width": w, "height": h},
    }
    r = requests.post(f"{BASE}/shapes", headers={**HEADERS, "Content-Type": "application/json"}, json=payload)
    if not r.ok:
        print(f"ERR: {r.status_code} {r.text[:200]}")
    return r.json() if r.text else {}

# Match the upload_to_miro.py layout exactly
title_y = -2900
start_y = title_y + 580
gap_y = 880
centre_x = 0
cell_w = 340
cell_h = 110

for i, card in enumerate(CARDS):
    y = start_y + i * gap_y
    bottom_y = y + 240
    spend_html = f'<p><strong>OPERATOR SPEND</strong><br>{card["spend"]}</p>'
    take_html = f'<p><strong>ANNUAL TAKE</strong><br>{card["take"]}</p>'
    gen_html = f'<p><strong>ON GENERAL</strong><br>$0</p>'
    shape(spend_html, centre_x - cell_w - 10, bottom_y, cell_w, cell_h, RED_SOFT, RED)
    shape(take_html, centre_x, bottom_y, cell_w, cell_h, RED_SOFT, RED)
    shape(gen_html, centre_x + cell_w + 10, bottom_y, cell_w, cell_h, BLUE_SOFT, BLUE)
    print(f"  card {card['n']} bottom cells at y={bottom_y}")
    time.sleep(0.15)

# Matrix cells
mat_y = start_y + len(CARDS) * gap_y + 200
col_w = 380
row_h = 200
col_label_y = mat_y - 30
row1_y = col_label_y + 130
row2_y = row1_y + row_h + 30

# Row 1
shape("<p><strong>+$4.5–16.5M / yr</strong><br><span>The stack pays for itself 1.5–6× over.</span></p>",
      centre_x - col_w / 2 - 200, row1_y, col_w, row_h, GREEN_SOFT, GREEN, font_size=20)
shape("<p><strong>$0</strong><br><span>Every line item targets a surface that does not exist.</span></p>",
      centre_x + col_w / 2 + 200, row1_y, col_w, row_h, PAPER, INK, font_size=20)
# Row 2
shape("<p><strong>−$65 / $10K trade</strong><br><span>≈ −$65,000/yr at 1,000 trades.</span></p>",
      centre_x - col_w / 2 - 200, row2_y, col_w, row_h, RED_SOFT, RED, font_size=20)
shape("<p><strong>$0</strong><br><span>Fair clearing. No surface to extract from.</span></p>",
      centre_x + col_w / 2 + 200, row2_y, col_w, row_h, PAPER, INK, font_size=20)

print("\nDone.")
