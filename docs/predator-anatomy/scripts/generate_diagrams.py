#!/usr/bin/env python3
"""Generate 7 multi-step Apple-style SVG diagrams for the predator anatomy.

Each SVG is 1068×1100, matching apple.com's wide-content max-width.
Header (eyebrow + hooking title + tagline) → 3×2 step grid → economics footer.

Run:
    python3 docs/predator-anatomy/scripts/generate_diagrams.py
Output:
    docs/predator-anatomy/diagrams/multi/NN-name.svg
"""
import pathlib, textwrap

OUT = pathlib.Path(__file__).resolve().parents[1] / "diagrams" / "multi"
OUT.mkdir(parents=True, exist_ok=True)

# ---------- APPLE STYLE — values sourced from docs/apple-style-table.md ----------
W, H = 1068, 1100
PADX = 0           # outer frame stretches to canvas edges; padding is internal
HDR_TOP = 64
HDR_H = 200        # eyebrow + title + tagline
GAP_HDR = 40
GRID_TOP = HDR_TOP + HDR_H + GAP_HDR
STEP_W, STEP_H = 340, 340
GAP_STEP = 24
GRID_W = STEP_W * 3 + GAP_STEP * 2  # = 1068, fills the canvas
GRID_LEFT = (W - GRID_W) // 2
GAP_FOOTER = 40
FOOTER_TOP = GRID_TOP + STEP_H * 2 + GAP_STEP + GAP_FOOTER
FOOTER_H = 80
FOOTER_BOTTOM = FOOTER_TOP + FOOTER_H

# Colors (apple.com production)
INK    = "#1D1D1F"
INK_2  = "#424245"
INK_3  = "#6E6E73"
INK_4  = "#86868B"
PAPER  = "#FFFFFF"
PAPER_2 = "#F5F5F7"
PAPER_3 = "#FBFBFD"
RULE   = "#D2D2D7"
RULE_2 = "#E8E8ED"
BLUE   = "#0071E3"
BLUE_T = "#E8F2FE"
RED    = "#FF3B30"   # iOS systemRed (light)
GREEN  = "#34C759"   # iOS systemGreen (light)

# Common style block — pasted into each SVG <style>
STYLE = textwrap.dedent(f"""
  /* All sizes precomputed from apple.com letter-spacing em values */
  .eyebrow {{ font: 700 13px "SF Mono", ui-monospace, Menlo, monospace; fill: {INK_3}; letter-spacing: 2.34px; text-transform: uppercase; }}
  .title   {{ font: 700 40px "SF Pro Display", "Helvetica Neue", sans-serif; fill: {INK}; letter-spacing: -0.88px; }}
  .titleEm {{ font: 500 40px "New York", "Times New Roman", Georgia, serif; fill: {BLUE}; letter-spacing: -0.64px; font-style: italic; }}
  .tagline {{ font: 500 19px "SF Pro Text", "Helvetica Neue", sans-serif; fill: {INK_3}; letter-spacing: -0.228px; }}
  .stepNum {{ font: 700 14px "SF Mono", ui-monospace, Menlo, monospace; fill: {BLUE}; letter-spacing: 0; }}
  .stepH   {{ font: 700 17px "SF Pro Text", "Helvetica Neue", sans-serif; fill: {INK}; letter-spacing: -0.374px; }}
  .stepC   {{ font: 400 14px "SF Pro Text", "Helvetica Neue", sans-serif; fill: {INK_2}; letter-spacing: -0.07px; }}
  .illL    {{ font: 600 11px "SF Mono", ui-monospace, Menlo, monospace; fill: {INK_3}; letter-spacing: 0.44px; }}
  .illP    {{ font: 700 14px "SF Mono", ui-monospace, Menlo, monospace; fill: {INK}; }}
  .illP-r  {{ font: 700 14px "SF Mono", ui-monospace, Menlo, monospace; fill: {RED}; }}
  .illP-g  {{ font: 700 14px "SF Mono", ui-monospace, Menlo, monospace; fill: {GREEN}; }}
  .illP-b  {{ font: 700 14px "SF Mono", ui-monospace, Menlo, monospace; fill: {BLUE}; }}
  .ecoL    {{ font: 700 11px "SF Mono", ui-monospace, Menlo, monospace; fill: {INK_3}; letter-spacing: 1.98px; text-transform: uppercase; }}
  .ecoF    {{ font: 800 28px "SF Pro Display", "Helvetica Neue", sans-serif; fill: {INK}; letter-spacing: -0.616px; }}
""")

# ---------- helpers ----------
def header(eyebrow: str, hook: str, hook_em: str, tagline: str) -> str:
    """Top section: eyebrow (uppercase mono), hooking title (italic serif accent), tagline.
    hook contains the regular part; hook_em is the italic emphasized fragment placed after.
    """
    # eyebrow
    cy = HDR_TOP + 6
    out = [f'<text x="{W/2}" y="{cy}" text-anchor="middle" class="eyebrow">{eyebrow}</text>']
    # title line: hook then italic em
    title_y = cy + 60
    out.append(f'<text x="{W/2}" y="{title_y}" text-anchor="middle">'
               f'<tspan class="title">{hook} </tspan>'
               f'<tspan class="titleEm">{hook_em}</tspan></text>')
    # tagline
    tag_y = title_y + 56
    out.append(f'<text x="{W/2}" y="{tag_y}" text-anchor="middle" class="tagline">{tagline}</text>')
    return "\n  ".join(out)


def step_frame(col: int, row: int, num: str, step_title: str, body_svg: str, caption: str) -> str:
    """Draw one step frame at column 0-2, row 0-1. body_svg is inline SVG content positioned
    inside the frame already (relative to frame top-left)."""
    x = GRID_LEFT + col * (STEP_W + GAP_STEP)
    y = GRID_TOP + row * (STEP_H + GAP_STEP)
    # Card background + 1px border
    out = [f'<rect x="{x}" y="{y}" width="{STEP_W}" height="{STEP_H}" rx="14" fill="{PAPER_3}" stroke="{RULE_2}" stroke-width="1"/>']
    # Step badge + number
    bx, by = x + 24, y + 24
    out.append(f'<circle cx="{bx + 14}" cy="{by + 14}" r="14" fill="{PAPER}" stroke="{BLUE}" stroke-width="1.5"/>')
    out.append(f'<text x="{bx + 14}" y="{by + 19}" text-anchor="middle" class="stepNum">{num}</text>')
    # Step title to right of badge
    out.append(f'<text x="{bx + 40}" y="{by + 19}" class="stepH">{step_title}</text>')
    # Illustration container — center area of frame, between badge and caption
    # Body coords supplied relative to (0,0); translate by (x, y + 68)
    out.append(f'<g transform="translate({x}, {y + 68})">{body_svg}</g>')
    # Caption — last ~60px of frame
    cap_y = y + STEP_H - 30
    # Wrap caption manually into ~46-char lines for visual width
    lines = textwrap.wrap(caption, width=46)
    if len(lines) > 2:
        lines = lines[:2]
        lines[-1] = lines[-1][:43].rstrip() + "…"
    if len(lines) == 1:
        out.append(f'<text x="{x + 24}" y="{cap_y}" class="stepC">{lines[0]}</text>')
    else:
        out.append(f'<text x="{x + 24}" y="{cap_y - 18}" class="stepC">{lines[0]}</text>')
        out.append(f'<text x="{x + 24}" y="{cap_y}" class="stepC">{lines[1]}</text>')
    return "\n  ".join(out)


def economics(spend_label: str, spend_fig: str, take_label: str, take_fig: str,
              gen_label: str, gen_fig: str) -> str:
    """Bottom economics row — three cells."""
    cell_w = (GRID_W - GAP_STEP * 2) // 3
    out = []
    cells = [
        (spend_label, spend_fig, PAPER_3, RULE_2, INK),
        (take_label, take_fig, PAPER_3, RULE_2, INK),
        (gen_label, gen_fig, BLUE_T, BLUE, BLUE),
    ]
    for i, (label, fig, fill, stroke, color) in enumerate(cells):
        cx = GRID_LEFT + i * (cell_w + GAP_STEP)
        out.append(f'<rect x="{cx}" y="{FOOTER_TOP}" width="{cell_w}" height="{FOOTER_H}" rx="14" fill="{fill}" stroke="{stroke}" stroke-width="1"/>')
        out.append(f'<text x="{cx + 20}" y="{FOOTER_TOP + 26}" class="ecoL">{label}</text>')
        out.append(f'<text x="{cx + 20}" y="{FOOTER_TOP + 60}" class="ecoF" style="fill: {color}">{fig}</text>')
    return "\n  ".join(out)


def wrap_svg(body: str) -> str:
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs>
<style>{STYLE}</style>
</defs>
<rect width="{W}" height="{H}" fill="{PAPER}"/>
{body}
</svg>
'''


# ---------- illustration primitives ----------
def orderbook(x0, y0, bid_label, bid_val, offer_label, offer_val,
              bid_color=BLUE, offer_color=RED, bid_strike=False, offer_strike=False,
              note=""):
    """Compact two-row orderbook. Anchored at (x0, y0) top-left, ~260×130."""
    s = []
    s.append(f'<text x="{x0}" y="{y0}" class="illL">PRICE</text>')
    s.append(f'<text x="{x0 + 220}" y="{y0}" text-anchor="end" class="illL">SIZE</text>')
    # Offer (top, red)
    oy = y0 + 18
    s.append(f'<rect x="{x0}" y="{oy}" width="220" height="36" rx="6" fill="{offer_color}" opacity="0.9"/>')
    if offer_strike:
        s.append(f'<line x1="{x0 + 12}" y1="{oy + 18}" x2="{x0 + 208}" y2="{oy + 18}" stroke="{PAPER}" stroke-width="1.5"/>')
    s.append(f'<text x="{x0 + 16}" y="{oy + 23}" fill="{PAPER}" style="font: 700 13px \'SF Mono\', monospace">{offer_label} {offer_val}</text>')
    # Bid (below, blue)
    by = oy + 44
    s.append(f'<rect x="{x0}" y="{by}" width="220" height="36" rx="6" fill="{bid_color}" opacity="0.9"/>')
    if bid_strike:
        s.append(f'<line x1="{x0 + 12}" y1="{by + 18}" x2="{x0 + 208}" y2="{by + 18}" stroke="{PAPER}" stroke-width="1.5"/>')
    s.append(f'<text x="{x0 + 16}" y="{by + 23}" fill="{PAPER}" style="font: 700 13px \'SF Mono\', monospace">{bid_label} {bid_val}</text>')
    if note:
        s.append(f'<text x="{x0 + 110}" y="{by + 70}" text-anchor="middle" class="illL">{note}</text>')
    return "\n  ".join(s)


def price_chart(x0, y0, w, h, path_d, dots=None, hlines=None, annotations=None):
    """Generic price chart. (x0,y0) top-left of plot area."""
    s = []
    # Background
    s.append(f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="8" fill="{PAPER}" stroke="{RULE_2}" stroke-width="1"/>')
    # Horizontal grid lines
    for hl in (hlines or []):
        y_pos, label = hl
        s.append(f'<line x1="{x0}" y1="{y_pos}" x2="{x0 + w}" y2="{y_pos}" stroke="{RULE_2}" stroke-width="1" stroke-dasharray="3 3"/>')
        s.append(f'<text x="{x0 + w - 6}" y="{y_pos - 4}" text-anchor="end" class="illL">{label}</text>')
    # Price line
    s.append(f'<path d="{path_d}" fill="none" stroke="{INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
    # Highlight dots
    for d in (dots or []):
        dx, dy, color, label = d
        s.append(f'<circle cx="{dx}" cy="{dy}" r="5" fill="{color}"/>')
        if label:
            s.append(f'<text x="{dx}" y="{dy - 12}" text-anchor="middle" class="illP-b" style="fill: {color}">{label}</text>')
    # Annotations
    for ann in (annotations or []):
        ax, ay, txt = ann
        s.append(f'<text x="{ax}" y="{ay}" class="illL">{txt}</text>')
    return "\n  ".join(s)


def boxchain(x0, y0, boxes, arrows=None):
    """Horizontal chain of boxes connected by arrows. boxes: [(label, sublabel, fill, text_color), ...]"""
    n = len(boxes)
    box_w = 80
    gap = (300 - box_w * n) // (n - 1) if n > 1 else 0
    s = []
    for i, (lbl, sub, fill, txt) in enumerate(boxes):
        bx = x0 + i * (box_w + gap)
        s.append(f'<rect x="{bx}" y="{y0}" width="{box_w}" height="80" rx="12" fill="{fill}" stroke="{RULE_2 if fill != BLUE else BLUE}" stroke-width="1"/>')
        s.append(f'<text x="{bx + box_w/2}" y="{y0 + 32}" text-anchor="middle" style="font: 700 11px \'SF Pro Text\', sans-serif; fill: {txt}">{lbl}</text>')
        if sub:
            s.append(f'<text x="{bx + box_w/2}" y="{y0 + 52}" text-anchor="middle" style="font: 500 9px \'SF Mono\', monospace; fill: {txt}; opacity: 0.75">{sub}</text>')
    # Arrows
    for ar in (arrows or []):
        i_from, i_to, color, label, side = ar
        x_from = x0 + i_from * (box_w + gap) + box_w
        x_to = x0 + i_to * (box_w + gap)
        if i_from < i_to:
            arrow_y = y0 + 18 if side == "top" else y0 + 62
            s.append(f'<path d="M {x_from + 2} {arrow_y} L {x_to - 4} {arrow_y}" stroke="{color}" stroke-width="1.8" fill="none" marker-end="url(#aHead)"/>')
        else:
            arrow_y = y0 + 62 if side == "bottom" else y0 + 18
            s.append(f'<path d="M {x_from + 2 - box_w} {arrow_y} L {x_to + box_w + 2} {arrow_y}" stroke="{color}" stroke-width="1.8" fill="none" marker-start="url(#aHead{color[-3:]})"/>')
        if label:
            lbl_y = arrow_y - 6 if side == "top" else arrow_y + 14
            s.append(f'<text x="{(x_from + x_to)/2}" y="{lbl_y}" text-anchor="middle" class="illP-b" style="fill: {color}">{label}</text>')
    return "\n  ".join(s)


def timebar(x0, y0, bars):
    """Horizontal time bars at log scale. bars: [(label, width_px, color), ...]"""
    s = [f'<line x1="{x0}" y1="{y0 + 130}" x2="{x0 + 300}" y2="{y0 + 130}" stroke="{RULE_2}"/>']
    s.append(f'<text x="{x0}" y="{y0 + 148}" class="illL">0</text>')
    s.append(f'<text x="{x0 + 300}" y="{y0 + 148}" text-anchor="end" class="illL">200 ms</text>')
    for i, (label, w, color) in enumerate(bars):
        ry = y0 + 6 + i * 28
        s.append(f'<rect x="{x0}" y="{ry}" width="{max(w, 4)}" height="20" rx="3" fill="{color}"/>')
        # label to the right of the bar if short, inside if long
        if w < 90:
            s.append(f'<text x="{x0 + max(w, 4) + 8}" y="{ry + 14}" style="font: 700 11px \'SF Mono\', monospace; fill: {INK}">{label}</text>')
        else:
            s.append(f'<text x="{x0 + 10}" y="{ry + 14}" style="font: 700 11px \'SF Mono\', monospace; fill: {PAPER}">{label}</text>')
    return "\n  ".join(s)


def calendar(x0, y0, months, fund_dots, retail_dots):
    """5-month timeline, two lanes."""
    s = []
    step = 300 / (len(months) - 1)
    for i, m in enumerate(months):
        cx = x0 + i * step
        s.append(f'<text x="{cx}" y="{y0}" text-anchor="middle" class="illL">{m}</text>')
        s.append(f'<line x1="{cx}" y1="{y0 + 8}" x2="{cx}" y2="{y0 + 140}" stroke="{RULE_2}" stroke-dasharray="2 3"/>')
    # Fund lane
    s.append(f'<line x1="{x0}" y1="{y0 + 50}" x2="{x0 + 300}" y2="{y0 + 50}" stroke="{INK}" stroke-width="1.5"/>')
    s.append(f'<text x="{x0 - 30}" y="{y0 + 54}" class="illL">FUND</text>')
    for di in fund_dots:
        s.append(f'<circle cx="{x0 + di * step}" cy="{y0 + 50}" r="5" fill="{BLUE}"/>')
    # Retail lane
    s.append(f'<line x1="{x0}" y1="{y0 + 110}" x2="{x0 + 300}" y2="{y0 + 110}" stroke="{INK}" stroke-width="1.5"/>')
    s.append(f'<text x="{x0 - 30}" y="{y0 + 114}" class="illL">YOU</text>')
    for di in retail_dots:
        s.append(f'<circle cx="{x0 + di * step}" cy="{y0 + 110}" r="6" fill="{RED}"/>')
    return "\n  ".join(s)


def big_number(x0, y0, value, label_top=None, label_bot=None, color=INK):
    s = []
    if label_top:
        s.append(f'<text x="{x0 + 130}" y="{y0}" text-anchor="middle" class="illL">{label_top}</text>')
    s.append(f'<text x="{x0 + 130}" y="{y0 + 56}" text-anchor="middle" style="font: 800 48px \'SF Pro Display\', sans-serif; fill: {color}; letter-spacing: -1.056px">{value}</text>')
    if label_bot:
        s.append(f'<text x="{x0 + 130}" y="{y0 + 90}" text-anchor="middle" class="illL">{label_bot}</text>')
    return "\n  ".join(s)


# ---------- common defs (arrowhead) ----------
ARROW_DEFS = f'''
  <defs>
    <marker id="aHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="{INK}"/>
    </marker>
    <marker id="aHeadBlue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="{BLUE}"/>
    </marker>
    <marker id="aHeadGreen" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="{GREEN}"/>
    </marker>
    <marker id="aHeadRed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="{RED}"/>
    </marker>
  </defs>
'''


# ==================== MECHANISMS ====================

def build_01_toxic_flow() -> str:
    body = [header(
        "EXTRACTION 01 · THE WIDEN",
        "Quote tight.",
        "Pay the cleanup.",
        "The spread you saw was a probe. The spread that mattered was the one after you filled.",
    )]
    # Step 1: tight orderbook
    s1 = orderbook(40, 24, "BID", "$99.95", "OFFER", "$100.05", note="spread $0.10")
    body.append(step_frame(0, 0, "01", "Tight quote posted", s1,
                           "MM posts a two-sided market that looks attractive: $99.95 / $100.05."))
    # Step 2: retail order arriving
    s2 = (orderbook(40, 24, "BID", "$99.95", "OFFER", "$100.05", note="incoming buy")
          + f'\n  <path d="M 320 50 L 280 50" stroke="{RED}" stroke-width="2" fill="none" marker-end="url(#aHeadRed)"/>'
          + f'\n  <text x="332" y="54" class="illP-r">RETAIL</text>')
    body.append(step_frame(1, 0, "02", "Retail order arrives", s2,
                           "A market buy enters the book. Spread looks generous; the trader takes it."))
    # Step 3: fill
    s3 = (orderbook(40, 24, "BID", "$99.95", "OFFER", "$100.05", note="filled $100.05")
          + f'\n  <circle cx="270" cy="50" r="14" fill="{GREEN}" opacity="0.18"/>'
          + f'\n  <text x="270" y="55" text-anchor="middle" style="font: 800 14px \'SF Pro Text\'; fill: {GREEN}">✓</text>')
    body.append(step_frame(2, 0, "03", "Direction revealed", s3,
                           "Fill at the offer means the trader is long. The MM now knows the direction."))
    # Step 4: cancel
    s4 = orderbook(40, 24, "BID", "$99.95", "OFFER", "$100.05",
                   bid_strike=True, offer_strike=True, note="both quotes pulled <50 ms")
    body.append(step_frame(0, 1, "04", "Quotes pulled", s4,
                           "Within fifty milliseconds, the MM cancels both sides of the original quote."))
    # Step 5: new wider quote
    s5 = orderbook(40, 24, "BID", "$99.85", "OFFER", "$100.10", note="new spread $0.25")
    body.append(step_frame(1, 1, "05", "Spread widens", s5,
                           "New quote: bid drops $0.10, offer climbs $0.05. The MM has pre-priced the exit."))
    # Step 6: P&L
    s6 = big_number(40, 30, "+$0.20", "PER SHARE", "no inventory risk", color=GREEN)
    body.append(step_frame(2, 1, "06", "The cleanup", s6,
                           "Retail exits into the new bid at $99.85. Round-trip cost $0.20 a share."))
    body.append(economics("OPERATOR SPEND", "~$710K / yr",
                          "ANNUAL TAKE", "$2–5M / yr",
                          "ON GENERAL", "$0"))
    return wrap_svg(ARROW_DEFS + "\n".join(body))


def build_02_stop_hunting() -> str:
    body = [header(
        "EXTRACTION 02 · THE WICK",
        "Your support",
        "is their menu.",
        "Stops cluster at obvious levels. Level 3 makes the menu legible.",
    )]
    # Step 1: stop cluster forming
    chart1 = price_chart(20, 30, 300, 220, "M 0 80 L 60 70 L 120 84 L 180 78 L 240 90 L 300 86",
                         hlines=[(190, "$99.50 support")])
    chart1 += f'\n  <g opacity="0.6">' + ''.join(
        f'<line x1="{40 + i*22}" y1="186" x2="{40 + i*22 + 14}" y2="194" stroke="{RED}" stroke-width="1.5"/>'
        for i in range(11)
    ) + '</g>'
    body.append(step_frame(0, 0, "01", "Stops cluster at support", chart1,
                           "Retail traders place stop-losses at $99.50 because it looks like obvious support."))
    # Step 2: MM's view
    s2 = (f'<rect x="40" y="20" width="260" height="230" rx="10" fill="{INK}" />'
          f'\n  <text x="170" y="46" text-anchor="middle" style="font: 700 11px \'SF Mono\'; fill: {BLUE_T}; letter-spacing: 1.8px">LEVEL 3 FEED</text>'
          f'\n  <text x="170" y="118" text-anchor="middle" style="font: 800 56px \'SF Pro Display\'; fill: {PAPER}; letter-spacing: -1.232px">14,028</text>'
          f'\n  <text x="170" y="146" text-anchor="middle" style="font: 500 13px \'SF Pro Text\'; fill: {PAPER}; opacity: 0.7">working stop-orders at $99.50</text>'
          f'\n  <text x="170" y="220" text-anchor="middle" class="illL" style="fill: {BLUE_T}; opacity: 0.6">cost: ~$200K / yr / venue</text>')
    body.append(step_frame(1, 0, "02", "The MM sees the menu", s2,
                           "Level 3 market data shows every working order. Retail does not pay for it."))
    # Step 3: MM sells
    chart3 = price_chart(20, 30, 300, 220,
                         "M 0 60 L 60 64 L 120 80 L 180 110 L 240 150 L 300 180",
                         hlines=[(190, "$99.50")])
    chart3 += (f'\n  <text x="160" y="100" class="illP-r">SELL $5M</text>'
               f'\n  <path d="M 160 110 L 200 160" stroke="{RED}" stroke-width="2" marker-end="url(#aHeadRed)"/>')
    body.append(step_frame(2, 0, "03", "The push down", chart3,
                           "MM sells $5M into a thin order book. Price slides toward the cluster."))
    # Step 4: wick triggers
    chart4 = price_chart(20, 30, 300, 220,
                         "M 0 60 L 60 70 L 120 100 L 180 150 L 200 200 L 220 145 L 280 100 L 300 90",
                         hlines=[(190, "$99.50")])
    chart4 += (f'\n  <circle cx="200" cy="200" r="6" fill="{RED}"/>'
               f'\n  <text x="200" y="222" text-anchor="middle" class="illP-r">$99.45</text>')
    body.append(step_frame(0, 1, "04", "Wick triggers cascade", chart4,
                           "Price touches $99.45. Fourteen thousand stops fire as market sells in sequence."))
    # Step 5: forced selling
    s5 = big_number(40, 30, "$20M", "FORCED SELLS", "added to the book", color=RED)
    body.append(step_frame(1, 1, "05", "Forced selling adds pressure", s5,
                           "The cascade adds $20M of unwanted sells. Price overshoots to $98.20."))
    # Step 6: recovery + cover
    chart6 = price_chart(20, 30, 300, 220,
                         "M 0 200 L 60 210 L 120 180 L 180 130 L 240 80 L 300 60",
                         hlines=[(60, "$101.00")])
    chart6 += (f'\n  <text x="60" y="240" class="illP-g">COVER $98.20</text>'
               f'\n  <text x="180" y="50" class="illP-g">SELL $101</text>')
    body.append(step_frame(2, 1, "06", "Cover and resell", chart6,
                           "MM covers the short at $98.20 and resells into the recovery at $101."))
    body.append(economics("OPERATOR SPEND", "~$350K / yr",
                          "PER CASCADE", "$50K–500K",
                          "ON GENERAL", "$0"))
    return wrap_svg(ARROW_DEFS + "\n".join(body))


def build_03_cross_venue() -> str:
    body = [header(
        "EXTRACTION 03 · THE LAG",
        "Eighty milliseconds",
        "of light.",
        "Same asset. Two venues. The arbitrageur reads both mailboxes.",
    )]
    def two_track(s_top, s_bot, lag_band=None, ann=None):
        out = []
        # Binance lane
        out.append(f'<text x="20" y="30" class="illL">BINANCE</text>')
        out.append(f'<line x1="20" y1="70" x2="320" y2="70" stroke="{INK}" stroke-width="2"/>')
        out.append(f'<text x="20" y="56" class="illP">{s_top[0]}</text>')
        out.append(f'<text x="320" y="56" text-anchor="end" class="illP" style="fill: {s_top[2]}">{s_top[1]}</text>')
        # Coinbase lane
        out.append(f'<text x="20" y="150" class="illL">COINBASE</text>')
        out.append(f'<line x1="20" y1="190" x2="320" y2="190" stroke="{INK}" stroke-width="2"/>')
        out.append(f'<text x="20" y="176" class="illP">{s_bot[0]}</text>')
        out.append(f'<text x="320" y="176" text-anchor="end" class="illP" style="fill: {s_bot[2]}">{s_bot[1]}</text>')
        if lag_band:
            lx, lw = lag_band
            out.append(f'<rect x="{lx}" y="60" width="{lw}" height="140" fill="{BLUE}" opacity="0.10"/>')
            out.append(f'<text x="{lx + lw/2}" y="245" text-anchor="middle" class="illL" style="fill: {BLUE}">{ann or "80 ms"}</text>')
        return "\n  ".join(out)
    s1 = two_track(("t=0", "$4,000.00", INK), ("t=0", "$4,000.00", INK))
    body.append(step_frame(0, 0, "01", "Equilibrium", s1,
                           "Both venues quote ETH at $4,000. Spread between venues is zero."))
    s2 = two_track(("t=0", "$4,005 ↑", RED), ("t=0", "$4,000.00", INK))
    body.append(step_frame(1, 0, "02", "Binance prints first", s2,
                           "A large market buy hits Binance. New print: $4,005. Coinbase still has not seen it."))
    s3 = two_track(("t=0", "$4,005", RED), ("t+40ms", "still $4,000…", INK_3),
                   lag_band=(160, 100), ann="LAG 80ms")
    body.append(step_frame(2, 0, "03", "Light-speed lag", s3,
                           "The new price has not crossed the network. Coinbase quote is stale for 80 ms."))
    s4 = two_track(("t+1ms", "$4,005", RED), ("t+1ms", "$4,000 BUY", GREEN), lag_band=(160, 100))
    body.append(step_frame(0, 1, "04", "Buy the stale side", s4,
                           "Co-located MM buys $200K of ETH on Coinbase at the stale $4,000 price."))
    s5 = two_track(("t+1ms", "$4,005 SELL", RED), ("t+1ms", "$4,000", GREEN), lag_band=(160, 100))
    body.append(step_frame(1, 1, "05", "Hedge on the fast side", s5,
                           "Simultaneously sells $200K on Binance at $4,005. Net inventory zero."))
    s6 = big_number(40, 30, "+$5", "PER ETH ARBITRAGED", "cycle repeats hundreds × day", color=GREEN)
    body.append(step_frame(2, 1, "06", "Receipt", s6,
                           "Coinbase catches up at t+80 ms. Five dollars per unit, risk-free, banked."))
    body.append(economics("OPERATOR SPEND", "~$400K / yr",
                          "ANNUAL TAKE", "$500K–2M",
                          "ON GENERAL", "$0"))
    return wrap_svg(ARROW_DEFS + "\n".join(body))


def build_04_latency() -> str:
    body = [header(
        "EXTRACTION 04 · THE TIME BAR",
        "The trade was over",
        "before the click.",
        "You click in 200 milliseconds. They executed 250,000 trades in that window.",
    )]
    # Step 1: ES futures move
    s1 = (f'<text x="170" y="30" text-anchor="middle" class="illL">CME · ES FUTURES</text>'
          f'\n  <line x1="20" y1="120" x2="320" y2="120" stroke="{RULE_2}"/>'
          f'\n  <path d="M 20 120 L 140 120 L 160 80 L 320 80" fill="none" stroke="{INK}" stroke-width="2"/>'
          f'\n  <circle cx="160" cy="80" r="6" fill="{BLUE}"/>'
          f'\n  <text x="160" y="64" text-anchor="middle" class="illP-b">+0.3%</text>'
          f'\n  <text x="160" y="160" text-anchor="middle" class="illL">t = 0</text>')
    body.append(step_frame(0, 0, "01", "ES futures move first", s1,
                           "A macro print pushes ES futures up 0.3%. The leader has spoken."))
    # Step 2: SPY stale
    s2 = (f'<text x="170" y="30" text-anchor="middle" class="illL">ARCA · SPY ETF</text>'
          f'\n  <line x1="20" y1="120" x2="320" y2="120" stroke="{RULE_2}"/>'
          f'\n  <path d="M 20 120 L 320 120" fill="none" stroke="{INK_3}" stroke-width="2" stroke-dasharray="4 3"/>'
          f'\n  <text x="170" y="100" text-anchor="middle" class="illP-r">QUOTE STALE</text>'
          f'\n  <text x="170" y="160" text-anchor="middle" class="illL">window: 50–500 μs</text>')
    body.append(step_frame(1, 0, "02", "SPY quote goes stale", s2,
                           "Correlated SPY hasn't updated yet. For microseconds, the price is wrong."))
    # Step 3: FPGA fires
    s3 = timebar(10, 30, [
        ("FPGA: 810 ns", 4, GREEN),
        ("BANK EXEC: 5 ms", 14, BLUE),
        ("BROWSER: 50 ms", 140, INK_3),
        ("RETAIL CLICK: 200 ms", 300, RED),
    ])
    body.append(step_frame(2, 0, "03", "FPGA fires in 810 ns", s3,
                           "A field-programmable gate array converts the ES print into a SPY order, instantly."))
    # Step 4: slow MM picked off
    s4 = (orderbook(40, 24, "BID", "stale $500.10", "OFFER", "stale $500.20",
                    note="hit by fast MM"))
    body.append(step_frame(0, 1, "04", "Slow MM picked off", s4,
                           "A market maker who hasn't updated yet sees their stale quote taken before they can cancel."))
    # Step 5: SPY catches up
    s5 = (f'<text x="170" y="30" text-anchor="middle" class="illL">ARCA · SPY ETF</text>'
          f'\n  <line x1="20" y1="120" x2="320" y2="120" stroke="{RULE_2}"/>'
          f'\n  <path d="M 20 120 L 180 120 L 200 84 L 320 84" fill="none" stroke="{INK}" stroke-width="2"/>'
          f'\n  <circle cx="200" cy="84" r="5" fill="{INK_3}"/>'
          f'\n  <text x="200" y="68" text-anchor="middle" class="illL">t + 500 μs</text>'
          f'\n  <text x="170" y="160" text-anchor="middle" class="illL">too late on this print</text>')
    body.append(step_frame(1, 1, "05", "SPY catches up", s5,
                           "Five hundred microseconds later the quote updates. The arbitrage is closed."))
    # Step 6: accumulator
    s6 = big_number(40, 30, "$5B", "GLOBAL LATENCY TAX / yr", "Aquilina–Budish QJE 2022", color=BLUE)
    body.append(step_frame(2, 1, "06", "The accumulator", s6,
                           "Per trade: a penny. Across markets, five billion dollars a year. 17% of the cost of liquidity."))
    body.append(economics("OPERATOR SPEND", "~$650K / yr",
                          "ANNUAL TAKE", "$300K–1.5M",
                          "ON GENERAL", "$0"))
    return wrap_svg(ARROW_DEFS + "\n".join(body))


def build_05_information() -> str:
    body = [header(
        "EXTRACTION 05 · THE CALENDAR",
        "Earnings are old news",
        "to ten people.",
        "By the time the press release prints, the position has already paid for the satellite.",
    )]
    # Step 1: credit card panel
    s1 = (f'<text x="170" y="30" text-anchor="middle" class="illL">JAN · CREDIT-CARD PANEL</text>'
          f'\n  <rect x="60" y="60" width="220" height="120" rx="10" fill="{PAPER}" stroke="{RULE_2}"/>'
          f'\n  <text x="170" y="100" text-anchor="middle" style="font: 800 36px \'SF Pro Display\'; fill: {GREEN}; letter-spacing: -0.79px">+22%</text>'
          f'\n  <text x="170" y="130" text-anchor="middle" class="illL">YoY service-center receipts</text>'
          f'\n  <text x="170" y="160" text-anchor="middle" class="illL" style="fill: {INK_3}">YipitData · $120K / yr</text>')
    body.append(step_frame(0, 0, "01", "Receipts before the company", s1,
                           "A credit-card data panel shows Tesla service revenue up 22% YoY in January."))
    # Step 2: satellite
    s2 = (f'<text x="170" y="30" text-anchor="middle" class="illL">FEB · SATELLITE IMAGERY</text>'
          f'\n  <rect x="60" y="60" width="220" height="120" rx="10" fill="{INK}"/>'
          f'\n  <text x="170" y="100" text-anchor="middle" style="font: 800 36px \'SF Pro Display\'; fill: {PAPER}; letter-spacing: -0.79px">+18%</text>'
          f'\n  <text x="170" y="130" text-anchor="middle" class="illL" style="fill: {PAPER}; opacity: 0.7">Shanghai factory parking lot</text>'
          f'\n  <text x="170" y="160" text-anchor="middle" class="illL" style="fill: {PAPER}; opacity: 0.5">RS Metrics · $80K / yr</text>')
    body.append(step_frame(1, 0, "02", "Counted from orbit", s2,
                           "Satellite imagery confirms the factory parking lot is 18% fuller than the prior quarter."))
    # Step 3: expert call
    s3 = (f'<text x="170" y="30" text-anchor="middle" class="illL">MAR · EXPERT NETWORK</text>'
          f'\n  <rect x="60" y="60" width="220" height="120" rx="10" fill="{PAPER_2}" stroke="{RULE_2}"/>'
          f'\n  <text x="170" y="100" text-anchor="middle" style="font: 700 17px \'SF Pro Display\'; fill: {INK}; letter-spacing: -0.374px">"Tooling capacity confirmed"</text>'
          f'\n  <text x="170" y="130" text-anchor="middle" class="illL">— ex-Tesla supply-chain VP</text>'
          f'\n  <text x="170" y="160" text-anchor="middle" class="illL" style="fill: {INK_3}">GLG · $150K / yr</text>')
    body.append(step_frame(2, 0, "03", "Confirmed by the inside", s3,
                           "A paid call with a former supply-chain VP confirms the capacity is real."))
    # Step 4: fund positions
    s4 = (f'<text x="170" y="30" text-anchor="middle" class="illL">LATE MAR · FUND ENTRY</text>'
          f'\n  <text x="170" y="100" text-anchor="middle" style="font: 800 36px \'SF Pro Display\'; fill: {BLUE}; letter-spacing: -0.79px">LONG CALLS</text>'
          f'\n  <text x="170" y="130" text-anchor="middle" class="illL">positioned before consensus</text>'
          f'\n  <text x="170" y="160" text-anchor="middle" class="illL">three pieces of evidence aligned</text>')
    body.append(step_frame(0, 1, "04", "Position opens", s4,
                           "With three pieces of evidence aligned, the fund opens a directional position."))
    # Step 5: earnings beat
    s5 = (f'<text x="170" y="30" text-anchor="middle" class="illL">APR · EARNINGS DAY</text>'
          f'\n  <line x1="20" y1="160" x2="320" y2="160" stroke="{RULE_2}"/>'
          f'\n  <path d="M 20 140 L 80 138 L 130 142 L 160 140 L 170 90 L 320 80" fill="none" stroke="{INK}" stroke-width="2"/>'
          f'\n  <circle cx="170" cy="90" r="6" fill="{GREEN}"/>'
          f'\n  <text x="170" y="74" text-anchor="middle" class="illP-g">+8%</text>'
          f'\n  <text x="170" y="185" text-anchor="middle" class="illL">earnings beat printed</text>')
    body.append(step_frame(1, 1, "05", "The print", s5,
                           "Tesla announces a beat. The stock jumps 8%. The fund's edge crystallises."))
    # Step 6: retail reads
    s6 = (f'<text x="170" y="30" text-anchor="middle" class="illL">APR · 4:01 PM</text>'
          f'\n  <rect x="40" y="60" width="260" height="120" rx="10" fill="{PAPER_2}" stroke="{RULE_2}"/>'
          f'\n  <text x="170" y="90" text-anchor="middle" style="font: 800 16px \'SF Pro Display\'; fill: {RED}; letter-spacing: -0.352px">TESLA BEATS EXPECTATIONS</text>'
          f'\n  <text x="170" y="120" text-anchor="middle" class="illL">CNBC headline · retail reads it</text>'
          f'\n  <text x="170" y="150" text-anchor="middle" class="illL" style="fill: {INK_3}">fund has already exited at the open</text>')
    body.append(step_frame(2, 1, "06", "Retail reads the headline", s6,
                           "Four-oh-one p.m. The fund has already exited. The retail reader is buying the top."))
    body.append(economics("OPERATOR SPEND", "~$714K / yr",
                          "ANNUAL TAKE", "$500K–2M",
                          "ON GENERAL", "$0"))
    return wrap_svg(ARROW_DEFS + "\n".join(body))


def build_06_spoofing() -> str:
    body = [header(
        "EXTRACTION 06 · THE WALL THAT WASN'T",
        "Build a wall.",
        "Cancel it.",
        "The chart is not a record. The chart is a stage.",
    )]
    # Step 1: thin orderbook
    s1 = (f'<text x="170" y="30" text-anchor="middle" class="illL">ORDER BOOK · THIN</text>'
          + ''.join(
              f'<rect x="40" y="{55 + i*20}" width="{40 + i*12}" height="14" fill="{RED}" opacity="0.6" rx="3"/>'
              for i in range(3))
          + ''.join(
              f'<rect x="40" y="{125 + i*20}" width="{60 + i*8}" height="14" fill="{BLUE}" opacity="0.6" rx="3"/>'
              for i in range(3))
          + f'\n  <text x="280" y="100" text-anchor="end" class="illL">MM has private sell intent</text>')
    body.append(step_frame(0, 0, "01", "Thin book, hidden intent", s1,
                           "Order book is thin. MM wants to sell at the highest visible price."))
    # Step 2: wall posted
    s2 = (f'<text x="170" y="30" text-anchor="middle" class="illL">SAME BOOK + WALL</text>'
          + ''.join(
              f'<rect x="40" y="{55 + i*20}" width="{40 + i*12}" height="14" fill="{RED}" opacity="0.6" rx="3"/>'
              for i in range(3))
          + f'\n  <rect x="40" y="125" width="240" height="20" fill="{BLUE}" rx="3"/>'
          + f'\n  <text x="160" y="139" text-anchor="middle" style="font: 700 11px \'SF Mono\'; fill: {PAPER}">$5M BID @ $99.00</text>'
          + ''.join(
              f'<rect x="40" y="{155 + i*20}" width="{40 + i*8}" height="14" fill="{BLUE}" opacity="0.4" rx="3"/>'
              for i in range(2)))
    body.append(step_frame(1, 0, "02", "The wall goes up", s2,
                           "MM posts a $5M bid at $99. To the chart it looks like serious support."))
    # Step 3: retail reads support
    s3 = (f'<text x="170" y="30" text-anchor="middle" class="illL">RETAIL CHART · MIN 13</text>'
          f'\n  <line x1="20" y1="140" x2="320" y2="140" stroke="{RULE_2}" stroke-dasharray="3 3"/>'
          f'\n  <text x="320" y="136" text-anchor="end" class="illL">$99.00 support</text>'
          f'\n  <path d="M 20 110 L 80 112 L 130 120 L 180 130 L 240 138 L 300 134" fill="none" stroke="{INK}" stroke-width="2"/>'
          f'\n  <text x="170" y="180" text-anchor="middle" class="illP-b">"strong bid at $99"</text>')
    body.append(step_frame(2, 0, "03", "Retail reads the wall as support", s3,
                           "Charting tools flag the wall as buy-side conviction. The thesis spreads."))
    # Step 4: retail fills
    s4 = (orderbook(40, 24, "BID", "$5M wall", "OFFER", "MM @ $99.05",
                    note="retail buys $99.05")
          + f'\n  <circle cx="270" cy="50" r="14" fill="{GREEN}" opacity="0.18"/>'
          + f'\n  <text x="270" y="55" text-anchor="middle" style="font: 800 14px \'SF Pro Text\'; fill: {GREEN}">✓</text>')
    body.append(step_frame(0, 1, "04", "Retail fills the MM's offer", s4,
                           "Convinced by the wall, retail crosses the spread and buys at $99.05."))
    # Step 5: wall cancelled
    s5 = (f'<text x="170" y="30" text-anchor="middle" class="illL">+47 ms · WALL CANCELLED</text>'
          + ''.join(
              f'<rect x="40" y="{55 + i*20}" width="{40 + i*12}" height="14" fill="{RED}" opacity="0.6" rx="3"/>'
              for i in range(3))
          + f'\n  <rect x="40" y="125" width="240" height="20" fill="none" stroke="{BLUE}" stroke-width="1.5" stroke-dasharray="4 3" rx="3"/>'
          + f'\n  <text x="160" y="139" text-anchor="middle" style="font: 700 11px \'SF Mono\'; fill: {INK_3}">$0 · CANCELLED</text>'
          + ''.join(
              f'<rect x="40" y="{155 + i*20}" width="{40 + i*8}" height="14" fill="{BLUE}" opacity="0.3" rx="3"/>'
              for i in range(2))
          + f'\n  <text x="170" y="225" text-anchor="middle" class="illP-r">lifespan: 47 ms total</text>')
    body.append(step_frame(1, 1, "05", "The wall disappears", s5,
                           "Forty-seven milliseconds after appearing, the wall is cancelled."))
    # Step 6: price drops
    s6 = (f'<text x="170" y="30" text-anchor="middle" class="illL">SECONDS LATER</text>'
          f'\n  <line x1="20" y1="100" x2="320" y2="100" stroke="{RULE_2}" stroke-dasharray="3 3"/>'
          f'\n  <text x="20" y="96" class="illL">$99.05 fill</text>'
          f'\n  <line x1="20" y1="180" x2="320" y2="180" stroke="{RULE_2}" stroke-dasharray="3 3"/>'
          f'\n  <text x="20" y="200" class="illL">$98.85</text>'
          f'\n  <path d="M 20 100 L 80 110 L 130 125 L 180 145 L 240 165 L 300 178" fill="none" stroke="{INK}" stroke-width="2"/>'
          f'\n  <text x="290" y="220" text-anchor="end" class="illP-g">+$0.20 / share</text>')
    body.append(step_frame(2, 1, "06", "The drop", s6,
                           "With no real support, price falls to $98.85. MM kept the round trip."))
    body.append(economics("MARGINAL SPEND", "~$0",
                          "ANNUAL TAKE", "$200K–2M",
                          "ON GENERAL", "$0"))
    return wrap_svg(ARROW_DEFS + "\n".join(body))


def build_07_pfof() -> str:
    body = [header(
        "EXTRACTION 07 · THE CASH ROUTE",
        "Your broker",
        "has three owners.",
        "None of them is you. Citadel paid $943M for nine months of order flow in 2024.",
    )]
    # Step 1: retail clicks
    s1 = (f'<rect x="80" y="40" width="180" height="200" rx="20" fill="{PAPER_2}" stroke="{RULE_2}"/>'
          f'\n  <text x="170" y="80" text-anchor="middle" class="illL">ROBINHOOD APP</text>'
          f'\n  <rect x="100" y="100" width="140" height="40" rx="10" fill="{GREEN}"/>'
          f'\n  <text x="170" y="126" text-anchor="middle" style="font: 700 15px \'SF Pro Text\'; fill: {PAPER}">BUY 100 AAPL</text>'
          f'\n  <text x="170" y="170" text-anchor="middle" class="illL">click</text>'
          f'\n  <text x="170" y="200" text-anchor="middle" class="illP">$17,200 order</text>')
    body.append(step_frame(0, 0, "01", "Retail clicks Buy", s1,
                           "A retail trader places a market order through their broker app."))
    # Step 2: routed to Citadel
    s2 = boxchain(20, 60, [
        ("RETAIL", "$17.2K", PAPER, INK),
        ("BROKER", "Robinhood", PAPER, INK),
        ("WHOLESALER", "Citadel", BLUE, PAPER),
    ], arrows=[(0, 1, INK, "order", "top"), (1, 2, INK, "rerouted", "top")])
    s2 += f'\n  <text x="170" y="200" text-anchor="middle" class="illL" style="fill: {INK_3}">order does not reach a public exchange</text>'
    body.append(step_frame(1, 0, "02", "Rerouted to a wholesaler", s2,
                           "Robinhood does not send the order to NYSE. It routes to Citadel Securities."))
    # Step 3: cash to broker
    s3 = boxchain(20, 60, [
        ("RETAIL", "", PAPER, INK),
        ("BROKER", "Robinhood", PAPER, INK),
        ("WHOLESALER", "Citadel", BLUE, PAPER),
    ], arrows=[(2, 1, GREEN, "$1.30 PFOF", "bottom")])
    s3 += f'\n  <text x="170" y="200" text-anchor="middle" class="illP-g">cash paid for the order</text>'
    body.append(step_frame(2, 0, "03", "Cash to the broker", s3,
                           "Citadel pays Robinhood ~$1.30 in cash — payment for order flow."))
    # Step 4: fill + improvement
    s4 = boxchain(20, 60, [
        ("RETAIL", "", PAPER, INK),
        ("BROKER", "", PAPER, INK),
        ("WHOLESALER", "Citadel", BLUE, PAPER),
    ], arrows=[(2, 0, RED, "$0.20 'improvement'", "bottom")])
    s4 += f'\n  <text x="170" y="200" text-anchor="middle" class="illL">filled at NBBO midpoint</text>'
    body.append(step_frame(0, 1, "04", "Token improvement returns", s4,
                           "Citadel fills at NBBO midpoint and hands back $0.20 of 'price improvement.'"))
    # Step 5: Citadel hedges
    s5 = (f'<rect x="40" y="40" width="120" height="80" rx="10" fill="{BLUE}"/>'
          f'\n  <text x="100" y="74" text-anchor="middle" style="font: 700 12px \'SF Pro Text\'; fill: {PAPER}">CITADEL</text>'
          f'\n  <text x="100" y="94" text-anchor="middle" style="font: 500 10px \'SF Mono\'; fill: {BLUE_T}">long 100 AAPL</text>'
          f'\n  <rect x="200" y="40" width="120" height="80" rx="10" fill="{INK}"/>'
          f'\n  <text x="260" y="74" text-anchor="middle" style="font: 700 12px \'SF Pro Text\'; fill: {PAPER}">NYSE / ARCA</text>'
          f'\n  <text x="260" y="94" text-anchor="middle" style="font: 500 10px \'SF Mono\'; fill: {PAPER}; opacity: 0.7">public venue</text>'
          f'\n  <path d="M 162 80 L 198 80" stroke="{INK}" stroke-width="1.8" marker-end="url(#aHead)"/>'
          f'\n  <text x="180" y="64" text-anchor="middle" class="illL">hedge</text>'
          f'\n  <text x="170" y="180" text-anchor="middle" class="illL">offsetting trade at NBBO bid</text>')
    body.append(step_frame(1, 1, "05", "Citadel hedges in public", s5,
                           "On a real venue, Citadel takes the offsetting position at the NBBO bid."))
    # Step 6: receipts
    s6 = (f'<text x="170" y="30" text-anchor="middle" class="illL">FINAL RECEIPT</text>'
          f'\n  <text x="40" y="78" class="stepH">Citadel kept</text>'
          f'\n  <text x="320" y="78" text-anchor="end" class="illP-g" style="font-size: 20px">+$3.50</text>'
          f'\n  <text x="40" y="118" class="stepH">Robinhood kept</text>'
          f'\n  <text x="320" y="118" text-anchor="end" class="illP-b" style="font-size: 20px">+$1.10</text>'
          f'\n  <text x="40" y="158" class="stepH">Retail "improvement"</text>'
          f'\n  <text x="320" y="158" text-anchor="end" class="illP-r" style="font-size: 20px">+$0.20</text>'
          f'\n  <line x1="40" y1="180" x2="320" y2="180" stroke="{RULE_2}"/>'
          f'\n  <text x="40" y="208" class="stepH">Citadel · 9 mo of 2024</text>'
          f'\n  <text x="320" y="208" text-anchor="end" class="illP" style="font-size: 16px">$943M paid</text>')
    body.append(step_frame(2, 1, "06", "Who paid whom", s6,
                           "Citadel kept $3.50 on the spread. Robinhood kept $1.10. Retail subsidised both."))
    body.append(economics("PFOF PAID (CITADEL 9MO)", "$943M",
                          "ANNUAL TAKE (CITADEL)", "$3–5B",
                          "ON GENERAL", "$0"))
    return wrap_svg(ARROW_DEFS + "\n".join(body))


# ---------- run ----------
BUILDERS = [
    ("01-toxic-flow", build_01_toxic_flow),
    ("02-stop-hunting", build_02_stop_hunting),
    ("03-cross-venue", build_03_cross_venue),
    ("04-latency", build_04_latency),
    ("05-information", build_05_information),
    ("06-spoofing", build_06_spoofing),
    ("07-pfof", build_07_pfof),
]

if __name__ == "__main__":
    for name, fn in BUILDERS:
        svg = fn()
        p = OUT / f"{name}.svg"
        p.write_text(svg)
        print(f"  wrote {p}  ({len(svg)} bytes)")
    print(f"\nDone. Output: {OUT}")
