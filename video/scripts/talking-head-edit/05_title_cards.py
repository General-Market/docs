#!/usr/bin/env python3
"""
Generate 13 title cards (1.5s each) — one per exploit — as mp4 clips, to be
inserted before each mechanism in the bake.

Apple black-surface style (per project CLAUDE.md):
  - #000 hero background
  - SF Pro Display (SFNS.ttf), white #F5F5F7 title
  - marketing blue #0071E3 index number
  - tight tracking, centered

Writes /tmp/title-cards/card-NN.mp4 and /tmp/title-cards/cards.json
(the source-time triggers used by the bake).
"""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path("/tmp/title-cards")
OUT.mkdir(exist_ok=True)
FONT = "/System/Library/Fonts/SFNS.ttf"

W, H = 1920, 1080
BG = (0, 0, 0)
WHITE = (245, 245, 247)
BLUE = (0, 113, 227)
MUTED = (134, 134, 139)
CARD_SECS = 1.5

# (index number, NAME, trigger source-time in seconds where the exploit's
#  spoken intro begins). The card is inserted before the first kept segment
#  at/after this source time.
CARDS = [
    (1,  "Colocation",                 204.6),
    (2,  "Unfair Fee Tiers",           437.9),
    (3,  "Maxing Out Advantages",      604.7),
    (4,  "Listing Front-Running",      674.8),
    (5,  "Dealer Flow Visibility",     739.4),
    (6,  "Order Flow",                 850.0),
    (7,  "Feed Latency",               897.8),
    (8,  "Matching & Queue Priority",  968.2),
    (9,  "Cancellation Priority",     1060.4),
    (10, "API Rate Limits",           1116.5),
    (11, "Funding Rate Edge",         1138.6),
    (12, "Market-Maker Rebates",      1186.7),
    (13, "Liquidation Engine Quirks", 1347.0),
]


def load_font(size):
    return ImageFont.truetype(FONT, size)


def draw_centered(draw, text, font, y, fill, tracking=0.0):
    # measure with tracking
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = (W - total) / 2
    for ch, wd in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += wd + tracking


def make_png(num, name, path):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    num_font = load_font(96)
    # Title size scales down if the name is long.
    title_size = 150 if len(name) <= 18 else (120 if len(name) <= 26 else 96)
    title_font = load_font(title_size)
    label_font = load_font(34)

    # Small "MECHANISM" eyebrow.
    draw_centered(d, "MECHANISM", label_font, H * 0.34, MUTED, tracking=8)

    # Big index number in blue.
    num_text = f"{num:02d}"
    nb = d.textbbox((0, 0), num_text, font=num_font)
    nw = nb[2] - nb[0]
    d.text(((W - nw) / 2, H * 0.40), num_text, font=num_font, fill=BLUE)

    # Exploit name, white, tight tracking.
    draw_centered(d, name, title_font, H * 0.52, WHITE, tracking=-title_size * 0.022)

    # Thin divider under the title.
    line_w = 120
    d.rectangle([(W - line_w) / 2, H * 0.66, (W + line_w) / 2, H * 0.66 + 3], fill=BLUE)

    img.save(path)


def make_clip(png, mp4):
    cmd = (
        f'ffmpeg -y -hide_banner -loglevel error '
        f'-loop 1 -i "{png}" '
        f'-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 '
        f'-t {CARD_SECS} '
        f'-c:v libx264 -r 30 -pix_fmt yuv420p -crf 18 -preset veryfast '
        f'-c:a aac -b:a 192k -shortest -movflags +faststart "{mp4}"'
    )
    subprocess.run(cmd, shell=True, check=True)


def main():
    triggers = []
    for num, name, trig in CARDS:
        png = OUT / f"card-{num:02d}.png"
        mp4 = OUT / f"card-{num:02d}.mp4"
        make_png(num, name, png)
        make_clip(png, mp4)
        triggers.append({"num": num, "name": name, "trigger": trig, "clip": str(mp4)})
        print(f"card {num:02d}  {name:30}  trigger src {trig:.1f}s  -> {mp4.name}")
    json.dump({"cards": triggers, "card_secs": CARD_SECS},
              open(OUT / "cards.json", "w"), indent=2)
    print(f"\n-> {OUT}/cards.json")


if __name__ == "__main__":
    main()
