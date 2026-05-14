#!/usr/bin/env python3
"""Generate 7 multi-step Apple-style SVG diagrams — v2.

Fixes from v1:
- Canvas 1500x1300 (was 1068x1100), larger frames, no overflow
- Explicit SCAPEGOAT / PREDATOR role bar under each header
- Per-mechanism custom layout (not uniform 3x2 boxes everywhere)
- Cross-venue (03) rebuilt as a richer split-screen with the arbitrageur as the explicit
  third party
- PFOF (07) rebuilt as a full flow diagram with arrows and amounts contained
- Stricter padding so all in-illustration labels stay inside frames
- Caption wrapping fixed (real measurement, max 2 lines)
- Standardised text attributes (no `font:` shorthand — better Miro renderer compat)

Run: python3 docs/predator-anatomy/scripts/generate_diagrams.py
Out: docs/predator-anatomy/diagrams/multi/NN-name.svg
"""
import pathlib, textwrap

OUT = pathlib.Path(__file__).resolve().parents[1] / "diagrams" / "multi"
OUT.mkdir(parents=True, exist_ok=True)

# ===== CANVAS =====
W, H = 1500, 1300

# Header zone
HDR_TOP = 80
EYEBROW_Y = HDR_TOP                  # 80
TITLE_Y = HDR_TOP + 64               # 144
TAGLINE_Y = HDR_TOP + 116            # 196
ROLE_BAR_Y = HDR_TOP + 168           # 248 — scapegoat / predator labels live here

# Grid zone
GRID_TOP = HDR_TOP + 240             # 320
STEP_W, STEP_H = 460, 400
GAP_STEP = 30
GRID_W = STEP_W * 3 + GAP_STEP * 2   # = 1440
GRID_LEFT = (W - GRID_W) // 2        # = 30
FRAME_PAD = 36                       # padding INSIDE each step frame

# Footer (economics) zone
FOOTER_TOP = GRID_TOP + STEP_H * 2 + GAP_STEP + 50    # = 1200
FOOTER_H = 80
FOOTER_BOTTOM = FOOTER_TOP + FOOTER_H

# ===== APPLE COLORS =====
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
RED    = "#FF3B30"
RED_T  = "#FFEBE9"
GREEN  = "#34C759"
GREEN_T = "#E5F8EC"

# ===== TYPOGRAPHY HELPERS (one place, no shorthand) =====
SF_DISPLAY = "'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
SF_TEXT = "'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif"
SF_MONO = "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace"
NY_SERIF = "'New York', 'Times New Roman', Georgia, serif"

def T(x, y, txt, *, font=SF_TEXT, size=17, weight=400, fill=INK, anchor="start",
      tracking=None, italic=False, opacity=None):
    """Emit a single <text> element, no shorthand. tracking in absolute px (sourced em*size)."""
    style_parts = [
        f"font-family:{font}",
        f"font-size:{size}px",
        f"font-weight:{weight}",
        f"fill:{fill}",
    ]
    if italic: style_parts.append("font-style:italic")
    if tracking is not None: style_parts.append(f"letter-spacing:{tracking}px")
    if opacity is not None: style_parts.append(f"opacity:{opacity}")
    style = ";".join(style_parts)
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="{style}">{txt}</text>'

def R(x, y, w, h, *, fill=PAPER, stroke=None, stroke_w=1, rx=0, opacity=None):
    s = [f'x="{x}"', f'y="{y}"', f'width="{w}"', f'height="{h}"', f'rx="{rx}"', f'fill="{fill}"']
    if stroke:
        s.append(f'stroke="{stroke}"')
        s.append(f'stroke-width="{stroke_w}"')
    if opacity is not None: s.append(f'opacity="{opacity}"')
    return f'<rect {" ".join(s)}/>'

def L(x1, y1, x2, y2, *, stroke=INK, w=1, dash=None, opacity=None):
    s = [f'x1="{x1}"', f'y1="{y1}"', f'x2="{x2}"', f'y2="{y2}"', f'stroke="{stroke}"', f'stroke-width="{w}"']
    if dash: s.append(f'stroke-dasharray="{dash}"')
    if opacity is not None: s.append(f'opacity="{opacity}"')
    return f'<line {" ".join(s)}/>'

def CIRC(cx, cy, r, *, fill=PAPER, stroke=None, w=1):
    s = [f'cx="{cx}"', f'cy="{cy}"', f'r="{r}"', f'fill="{fill}"']
    if stroke:
        s.append(f'stroke="{stroke}"')
        s.append(f'stroke-width="{w}"')
    return f'<circle {" ".join(s)}/>'

def PATH(d, *, stroke=INK, fill="none", w=2, marker_end=None, dash=None, linecap="round"):
    s = [f'd="{d}"', f'fill="{fill}"', f'stroke="{stroke}"', f'stroke-width="{w}"', f'stroke-linecap="{linecap}"', f'stroke-linejoin="round"']
    if marker_end: s.append(f'marker-end="url(#{marker_end})"')
    if dash: s.append(f'stroke-dasharray="{dash}"')
    return f'<path {" ".join(s)}/>'

# ===== ARROW MARKERS =====
def arrow_defs():
    out = ['<defs>']
    for name, color in [("arrInk", INK), ("arrBlue", BLUE), ("arrRed", RED), ("arrGreen", GREEN), ("arrInk3", INK_3)]:
        out.append(f'<marker id="{name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">'
                   f'<path d="M 0 0 L 10 5 L 0 10 z" fill="{color}"/></marker>')
    out.append('</defs>')
    return "\n".join(out)

# ===== HEADER =====
def header(eyebrow, hook_left, hook_right, tagline, scapegoat, predator):
    """Apple-style header: eyebrow, hook with italic serif accent, tagline, role bar."""
    s = []
    # Eyebrow
    s.append(T(W//2, EYEBROW_Y, eyebrow, font=SF_MONO, size=14, weight=700,
               fill=INK_3, anchor="middle", tracking=2.52))
    # Hook title: regular display + serif italic, centred together
    # We approximate width by character count to centre nicely.
    left_w = len(hook_left) * 26
    right_w = len(hook_right) * 22
    total = left_w + right_w + 16
    left_x = (W - total) // 2 + left_w
    right_x = left_x + 16
    s.append(T(left_x, TITLE_Y, hook_left, font=SF_DISPLAY, size=48, weight=700,
               fill=INK, anchor="end", tracking=-1.056))
    s.append(T(right_x, TITLE_Y, hook_right, font=NY_SERIF, size=48, weight=500,
               fill=BLUE, anchor="start", tracking=-0.768, italic=True))
    # Tagline
    s.append(T(W//2, TAGLINE_Y, tagline, font=SF_TEXT, size=19, weight=500,
               fill=INK_3, anchor="middle", tracking=-0.228))
    # Role bar — explicit Girardian framing
    bar_w = 1200
    bar_x = (W - bar_w) // 2
    bar_y = ROLE_BAR_Y
    cell_w = (bar_w - 24) // 2
    # Scapegoat cell (red-tint)
    s.append(R(bar_x, bar_y, cell_w, 56, fill=RED_T, stroke=RED, rx=14, opacity=0.95))
    s.append(T(bar_x + 24, bar_y + 22, "SCAPEGOAT", font=SF_MONO, size=11, weight=700,
               fill=RED, tracking=1.98))
    s.append(T(bar_x + 24, bar_y + 44, scapegoat, font=SF_TEXT, size=15, weight=700,
               fill=INK, tracking=-0.075))
    # Predator cell (blue-tint)
    px = bar_x + cell_w + 24
    s.append(R(px, bar_y, cell_w, 56, fill=BLUE_T, stroke=BLUE, rx=14, opacity=0.95))
    s.append(T(px + 24, bar_y + 22, "PREDATOR", font=SF_MONO, size=11, weight=700,
               fill=BLUE, tracking=1.98))
    s.append(T(px + 24, bar_y + 44, predator, font=SF_TEXT, size=15, weight=700,
               fill=INK, tracking=-0.075))
    return "\n".join(s)

# ===== STEP FRAME =====
def step_frame(col, row, num, title, body_inner, caption):
    """Frame at (col, row). body_inner is a callable returning SVG content positioned
    with (0,0) at the frame's inner top-left after pad. Caption auto-wrapped to 2 lines."""
    x = GRID_LEFT + col * (STEP_W + GAP_STEP)
    y = GRID_TOP + row * (STEP_H + GAP_STEP)
    s = []
    # Card surface
    s.append(R(x, y, STEP_W, STEP_H, fill=PAPER_3, stroke=RULE_2, rx=14))
    # Badge
    s.append(CIRC(x + FRAME_PAD + 14, y + FRAME_PAD + 14, 14, fill=PAPER, stroke=BLUE, w=1.5))
    s.append(T(x + FRAME_PAD + 14, y + FRAME_PAD + 19, num, font=SF_MONO, size=14,
               weight=700, fill=BLUE, anchor="middle"))
    # Step title
    s.append(T(x + FRAME_PAD + 40, y + FRAME_PAD + 19, title, font=SF_TEXT, size=17,
               weight=700, fill=INK, tracking=-0.374))
    # Illustration area: x ∈ [x+FRAME_PAD, x+STEP_W-FRAME_PAD], y ∈ [y+72, y+STEP_H-90]
    s.append(f'<g transform="translate({x + FRAME_PAD}, {y + 72})">')
    s.append(body_inner(STEP_W - FRAME_PAD * 2, STEP_H - 72 - 90))
    s.append('</g>')
    # Caption: max 2 lines, ~52 chars per line within the frame
    lines = textwrap.wrap(caption, width=52, break_long_words=False)
    if len(lines) > 2:
        lines = lines[:2]
        lines[-1] = lines[-1][:49].rstrip() + "…"
    cap_y_base = y + STEP_H - 56
    for i, line in enumerate(lines):
        s.append(T(x + FRAME_PAD, cap_y_base + i * 22, line, font=SF_TEXT, size=15,
                   weight=400, fill=INK_2, tracking=-0.075))
    return "\n".join(s)

# ===== ECONOMICS FOOTER =====
def economics(spend_label, spend_fig, take_label, take_fig, gen_label="ON GENERAL", gen_fig="$0"):
    cell_w = (GRID_W - GAP_STEP * 2) // 3
    s = []
    triples = [
        (spend_label, spend_fig, PAPER_3, RULE_2, INK),
        (take_label, take_fig, PAPER_3, RULE_2, INK),
        (gen_label, gen_fig, BLUE_T, BLUE, BLUE),
    ]
    for i, (lbl, fig, fill, stroke, color) in enumerate(triples):
        cx = GRID_LEFT + i * (cell_w + GAP_STEP)
        s.append(R(cx, FOOTER_TOP, cell_w, FOOTER_H, fill=fill, stroke=stroke, rx=14))
        s.append(T(cx + 24, FOOTER_TOP + 28, lbl, font=SF_MONO, size=12, weight=700,
                   fill=INK_3, tracking=2.16))
        s.append(T(cx + 24, FOOTER_TOP + 62, fig, font=SF_DISPLAY, size=28, weight=800,
                   fill=color, tracking=-0.616))
    return "\n".join(s)

def wrap_svg(body):
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
{arrow_defs()}
{R(0, 0, W, H, fill=PAPER)}
{body}
</svg>
'''

# ===== ILLUSTRATION PRIMITIVES =====
# Reusable: orderbook row, price chart, money-flow box, time axis, stat card.

def ob_row(x, y, w, h, price_label, price_val, side="bid", strike=False, note=None):
    """Single order-book row. side ∈ bid/offer/inactive."""
    fill = BLUE if side == "bid" else (RED if side == "offer" else INK_3)
    s = [R(x, y, w, h, fill=fill, rx=8, opacity=0.92)]
    s.append(T(x + 16, y + h//2 + 5, price_label, font=SF_MONO, size=13, weight=700,
               fill=PAPER, opacity=0.85))
    s.append(T(x + w - 16, y + h//2 + 5, price_val, font=SF_MONO, size=14, weight=800,
               fill=PAPER, anchor="end"))
    if strike:
        s.append(L(x + 14, y + h//2, x + w - 14, y + h//2, stroke=PAPER, w=2))
    if note:
        s.append(T(x + w//2, y + h + 22, note, font=SF_MONO, size=12, weight=600,
                   fill=INK_3, anchor="middle", tracking=0.48))
    return "\n".join(s)

def orderbook_v2(cx, cy, *, offer, bid, offer_strike=False, bid_strike=False, note=None,
                 spread_label=None):
    """Two-row orderbook centred at (cx, cy). Returns SVG."""
    w, h = 280, 44
    s = []
    s.append(ob_row(cx - w//2, cy - h - 4, w, h, "OFFER", offer, side="offer",
                    strike=offer_strike))
    s.append(ob_row(cx - w//2, cy + 4, w, h, "BID", bid, side="bid", strike=bid_strike))
    if spread_label:
        s.append(T(cx, cy + h + 38, spread_label, font=SF_MONO, size=12, weight=600,
                   fill=INK_3, anchor="middle", tracking=0.48))
    if note:
        s.append(T(cx, cy + h + 70, note, font=SF_MONO, size=12, weight=600,
                   fill=INK_3, anchor="middle", tracking=0.48))
    return "\n".join(s)

def big_stat(cx, cy, value, *, color=INK, label_top=None, label_bot=None, value_size=64):
    s = []
    if label_top:
        s.append(T(cx, cy - 40, label_top, font=SF_MONO, size=12, weight=700,
                   fill=INK_3, anchor="middle", tracking=2.16))
    s.append(T(cx, cy + 18, value, font=SF_DISPLAY, size=value_size, weight=800,
               fill=color, anchor="middle", tracking=value_size * -0.022))
    if label_bot:
        s.append(T(cx, cy + 56, label_bot, font=SF_TEXT, size=14, weight=500,
                   fill=INK_3, anchor="middle", tracking=-0.07))
    return "\n".join(s)

def price_chart(x, y, w, h, path_d, *, hlines=None, dots=None, labels=None):
    """Price chart with optional horizontal levels, dots, and absolute-positioned labels."""
    s = [R(x, y, w, h, fill=PAPER, stroke=RULE_2, rx=10)]
    for hl in (hlines or []):
        ly, label_txt = hl
        s.append(L(x + 8, ly, x + w - 8, ly, stroke=RULE_2, w=1, dash="3 3"))
        if label_txt:
            s.append(T(x + w - 10, ly - 6, label_txt, font=SF_MONO, size=11, weight=600,
                       fill=INK_3, anchor="end", tracking=0.44))
    s.append(PATH(path_d, stroke=INK, w=2))
    for d in (dots or []):
        dx, dy, color = d
        s.append(CIRC(dx, dy, 5, fill=color))
    for lbl in (labels or []):
        lx, ly, txt, color, anchor = lbl
        s.append(T(lx, ly, txt, font=SF_MONO, size=11, weight=700,
                   fill=color, anchor=anchor, tracking=0.44))
    return "\n".join(s)

# =====================================================
# MECHANISM 01 — TOXIC-FLOW MARKET MAKING
# =====================================================
def build_01_toxic_flow():
    body = [header(
        eyebrow="EXTRACTION 01 · THE WIDEN",
        hook_left="Quote tight.",
        hook_right="Pay the cleanup.",
        tagline="The spread you saw was a probe. The spread that mattered was the one after you filled.",
        scapegoat="Retail trader who saw a tight spread",
        predator="Market maker willing to widen on signal",
    )]
    def f01(w, h):
        return orderbook_v2(w//2, h//2, offer="$100.05", bid="$99.95",
                            spread_label="spread $0.10")
    body.append(step_frame(0, 0, "01", "Tight quote posted", f01,
                           "MM posts a two-sided market that looks attractive."))
    def f02(w, h):
        # Orderbook + arrow from right approaching offer — kept inside frame
        s = [orderbook_v2(w//2, h//2, offer="$100.05", bid="$99.95",
                          spread_label="incoming market buy")]
        # Arrow from inside the frame to the offer
        s.append(PATH(f"M {w - 24} {h//2 - 22} L {w//2 + 150} {h//2 - 22}",
                      stroke=RED, w=2.4, marker_end="arrRed"))
        s.append(T(w - 24, h//2 - 36, "RETAIL", font=SF_MONO, size=11, weight=700,
                   fill=RED, anchor="end", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(1, 0, "02", "Retail order arrives", f02,
                           "Market buy enters the book. The spread looks generous."))
    def f03(w, h):
        s = [orderbook_v2(w//2, h//2, offer="$100.05", bid="$99.95",
                          spread_label="filled at the offer")]
        # Green check on offer
        s.append(CIRC(w//2 + 158, h//2 - 22, 14, fill=GREEN, w=0))
        s.append(T(w//2 + 158, h//2 - 17, "✓", font=SF_TEXT, size=18, weight=800,
                   fill=PAPER, anchor="middle"))
        return "\n".join(s)
    body.append(step_frame(2, 0, "03", "Direction revealed", f03,
                           "Fill at the offer means the trader is long. The MM now knows the direction."))
    def f04(w, h):
        return orderbook_v2(w//2, h//2, offer="$100.05", bid="$99.95",
                            offer_strike=True, bid_strike=True,
                            spread_label="both quotes pulled · <50 ms")
    body.append(step_frame(0, 1, "04", "Quotes pulled", f04,
                           "Within fifty milliseconds, the MM cancels both sides of the original quote."))
    def f05(w, h):
        return orderbook_v2(w//2, h//2, offer="$100.10", bid="$99.85",
                            spread_label="new spread $0.25")
    body.append(step_frame(1, 1, "05", "Spread widens", f05,
                           "Bid drops ten cents. Offer climbs five. The exit has been pre-priced."))
    def f06(w, h):
        return big_stat(w//2, h//2, "+$0.20", color=GREEN,
                        label_top="MM CAPTURED, PER SHARE",
                        label_bot="zero inventory risk")
    body.append(step_frame(2, 1, "06", "The cleanup", f06,
                           "Retail exits into the new bid at $99.85. Round-trip cost is twenty cents."))
    body.append(economics("OPERATOR SPEND", "~$710K/yr",
                          "ANNUAL TAKE", "$2–5M/yr"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 02 — STOP HUNTING
# =====================================================
def build_02_stop_hunting():
    body = [header(
        eyebrow="EXTRACTION 02 · THE WICK",
        hook_left="Your support",
        hook_right="is their menu.",
        tagline="Retail stops cluster at obvious levels. Level 3 makes the menu legible.",
        scapegoat="14,000 retail stop-losses at $99.50",
        predator="MM with depth-of-book access",
    )]
    def f01(w, h):
        # Chart with stop ticks
        chart = price_chart(0, 0, w, h - 20,
                            f"M 0 {(h-20)*0.35} L {w*0.2} {(h-20)*0.30} L {w*0.4} {(h-20)*0.36} L {w*0.6} {(h-20)*0.32} L {w*0.8} {(h-20)*0.38} L {w} {(h-20)*0.34}",
                            hlines=[((h-20)*0.78, "$99.50 support")])
        ticks = "\n".join(
            f'<line x1="{20 + i*22}" y1="{(h-20)*0.76 - 2}" x2="{30 + i*22}" y2="{(h-20)*0.84}" stroke="{RED}" stroke-width="1.5"/>'
            for i in range(min(14, (w-40)//22))
        )
        return chart + "\n" + ticks
    body.append(step_frame(0, 0, "01", "Stops cluster at support", f01,
                           "Retail places stop-losses at $99.50 because the level looks like obvious support."))
    def f02(w, h):
        # Dark panel showing 14,028 stops
        return (
            R(0, 0, w, h, fill=INK, rx=12) + "\n" +
            T(w//2, 32, "LEVEL 3 DEPTH FEED", font=SF_MONO, size=12, weight=700,
              fill=BLUE_T, anchor="middle", tracking=2.16) + "\n" +
            T(w//2, h//2 + 6, "14,028", font=SF_DISPLAY, size=72, weight=800,
              fill=PAPER, anchor="middle", tracking=-1.584) + "\n" +
            T(w//2, h//2 + 38, "working stop-orders at $99.50", font=SF_TEXT, size=14,
              weight=500, fill=PAPER, anchor="middle", tracking=-0.07, opacity=0.85) + "\n" +
            T(w//2, h - 24, "RETAIL DOES NOT PAY FOR THIS VIEW", font=SF_MONO, size=11,
              weight=700, fill=BLUE_T, anchor="middle", tracking=1.65, opacity=0.7)
        )
    body.append(step_frame(1, 0, "02", "The MM sees the menu", f02,
                           "Level 3 market data shows every working order. Retail buys the chart, not the depth."))
    def f03(w, h):
        return price_chart(0, 0, w, h - 20,
            f"M 0 {(h-20)*0.30} L {w*0.2} {(h-20)*0.34} L {w*0.4} {(h-20)*0.42} L {w*0.6} {(h-20)*0.58} L {w*0.8} {(h-20)*0.72} L {w} {(h-20)*0.82}",
            hlines=[((h-20)*0.86, "$99.50")],
            labels=[(w*0.35, (h-20)*0.50, "MM SELLS $5M", RED, "middle")])
    body.append(step_frame(2, 0, "03", "The push down", f03,
                           "MM sells five million into a thin book. Price slides toward the cluster."))
    def f04(w, h):
        # Sharp wick
        return price_chart(0, 0, w, h - 20,
            f"M 0 {(h-20)*0.32} L {w*0.2} {(h-20)*0.38} L {w*0.4} {(h-20)*0.50} L {w*0.5} {(h-20)*0.94} L {w*0.6} {(h-20)*0.50} L {w*0.8} {(h-20)*0.36} L {w} {(h-20)*0.30}",
            hlines=[((h-20)*0.84, "$99.50")],
            dots=[(w*0.5, (h-20)*0.94, RED)],
            labels=[(w*0.5, (h-20)*0.94 - 14, "$99.45", RED, "middle")])
    body.append(step_frame(0, 1, "04", "Wick triggers cascade", f04,
                           "Price touches $99.45. Fourteen thousand stops fire as market sells in sequence."))
    def f05(w, h):
        return big_stat(w//2, h//2, "$20M", color=RED,
                        label_top="FORCED SELLS ADDED",
                        label_bot="cascade overshoots to $98.20",
                        value_size=68)
    body.append(step_frame(1, 1, "05", "Forced selling adds pressure", f05,
                           "The cascade adds twenty million of unwanted sells. Price overshoots to $98.20."))
    def f06(w, h):
        return price_chart(0, 0, w, h - 20,
            f"M 0 {(h-20)*0.86} L {w*0.2} {(h-20)*0.78} L {w*0.4} {(h-20)*0.62} L {w*0.6} {(h-20)*0.42} L {w*0.8} {(h-20)*0.26} L {w} {(h-20)*0.18}",
            hlines=[((h-20)*0.18, "$101")],
            labels=[(w*0.18, (h-20)*0.82, "COVER $98.20", GREEN, "start"),
                    (w*0.82, (h-20)*0.14, "SELL $101", GREEN, "end")])
    body.append(step_frame(2, 1, "06", "Cover and resell", f06,
                           "MM covers the short low and resells into the recovery higher."))
    body.append(economics("OPERATOR SPEND", "~$350K/yr",
                          "PER CASCADE", "$50K–500K"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 03 — CROSS-VENUE ARBITRAGE  (rebuilt richer)
# =====================================================
def build_03_cross_venue():
    body = [header(
        eyebrow="EXTRACTION 03 · THE LAG",
        hook_left="Eighty milliseconds",
        hook_right="of light.",
        tagline="Same asset. Two venues. The arbitrageur reads both mailboxes and writes one cheque.",
        scapegoat="Retail trader on either venue at stale prices",
        predator="Arbitrageur with microwave + cross-venue API",
    )]

    def venue_card(x, y, w, h, name, price, *, jumped=False, stale=False):
        """One venue mini-card with price."""
        s = [R(x, y, w, h, fill=PAPER, stroke=RULE_2, rx=12)]
        s.append(T(x + 16, y + 24, name, font=SF_MONO, size=12, weight=700,
                   fill=INK_3, tracking=1.92))
        s.append(T(x + 16, y + h - 36, "PRICE", font=SF_MONO, size=11, weight=600,
                   fill=INK_3, tracking=0.44))
        color = RED if jumped else (INK_3 if stale else INK)
        s.append(T(x + w - 16, y + h - 18, price, font=SF_DISPLAY, size=24, weight=800,
                   fill=color, anchor="end", tracking=-0.528))
        if jumped:
            s.append(T(x + w - 16, y + 24, "↑ jumped", font=SF_MONO, size=11, weight=700,
                       fill=RED, anchor="end"))
        if stale:
            s.append(T(x + w - 16, y + 24, "stale", font=SF_MONO, size=11, weight=700,
                       fill=INK_3, anchor="end"))
        return "\n".join(s)

    def arb_actor(cx, cy, *, hot=False):
        """The arbitrageur as an explicit visual entity, centered at (cx, cy)."""
        r = 30
        fill = BLUE if hot else PAPER
        stroke_w = 2 if hot else 1.5
        s = [CIRC(cx, cy, r, fill=fill, stroke=BLUE, w=stroke_w)]
        s.append(T(cx, cy - 4, "ARB", font=SF_MONO, size=11, weight=800,
                   fill=PAPER if hot else BLUE, anchor="middle", tracking=0.88))
        s.append(T(cx, cy + 12, "co-lo", font=SF_MONO, size=9, weight=600,
                   fill=PAPER if hot else BLUE, anchor="middle", opacity=0.85))
        return "\n".join(s)

    def f01(w, h):
        s = [venue_card(0, 20, w//2 - 16, 100, "BINANCE", "$4,000")]
        s.append(venue_card(w//2 + 16, 20, w//2 - 16, 100, "COINBASE", "$4,000"))
        s.append(arb_actor(w//2, h//2 + 60, hot=False))
        s.append(T(w//2, h//2 + 110, "watching · idle", font=SF_MONO, size=11,
                   weight=600, fill=INK_3, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(0, 0, "01", "Equilibrium", f01,
                           "Both venues quote ETH at $4,000. The arbitrageur watches, idle."))

    def f02(w, h):
        s = [venue_card(0, 20, w//2 - 16, 100, "BINANCE", "$4,005", jumped=True)]
        s.append(venue_card(w//2 + 16, 20, w//2 - 16, 100, "COINBASE", "$4,000"))
        # Whale arrow into Binance
        s.append(T(w//4 - 30, 150, "WHALE BUY", font=SF_MONO, size=11, weight=700,
                   fill=RED, tracking=0.66))
        s.append(PATH(f"M {w//4 - 30} 160 L {w//4 - 30} 180 L {w//4} 180",
                      stroke=RED, w=2, marker_end="arrRed"))
        s.append(arb_actor(w//2, h//2 + 60, hot=False))
        s.append(T(w//2, h//2 + 110, "saw the print at t=0", font=SF_MONO, size=11,
                   weight=600, fill=INK_3, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(1, 0, "02", "Binance prints first", f02,
                           "A large whale buy hits Binance. Print: $4,005. Coinbase hasn't seen it."))

    def f03(w, h):
        s = [venue_card(0, 20, w//2 - 16, 100, "BINANCE", "$4,005", jumped=True)]
        s.append(venue_card(w//2 + 16, 20, w//2 - 16, 100, "COINBASE", "$4,000", stale=True))
        # Lag band annotation
        s.append(R(0, 140, w, 28, fill=BLUE, opacity=0.10, rx=6))
        s.append(T(w//2, 158, "LAG WINDOW · 80 ms · only the co-lo'd sees both", font=SF_MONO,
                   size=12, weight=700, fill=BLUE, anchor="middle", tracking=0.48))
        s.append(arb_actor(w//2, h//2 + 80, hot=True))
        return "\n".join(s)
    body.append(step_frame(2, 0, "03", "The lag window opens", f03,
                           "For eighty milliseconds, Coinbase is stale. The co-located firm sees both."))

    def f04(w, h):
        s = [venue_card(0, 20, w//2 - 16, 100, "BINANCE", "$4,005", jumped=True)]
        s.append(venue_card(w//2 + 16, 20, w//2 - 16, 100, "COINBASE", "$4,000", stale=True))
        s.append(arb_actor(w//2, h//2 + 80, hot=True))
        # Buy arrow from arb to coinbase
        s.append(PATH(f"M {w//2 + 30} {h//2 + 65} L {w*0.78} 100",
                      stroke=GREEN, w=2.4, marker_end="arrGreen"))
        s.append(T(w*0.7, h*0.6, "BUY $200K", font=SF_MONO, size=12, weight=700,
                   fill=GREEN, anchor="middle", tracking=0.48))
        s.append(T(w*0.7, h*0.6 + 18, "@ $4,000", font=SF_MONO, size=11, weight=600,
                   fill=GREEN, anchor="middle"))
        return "\n".join(s)
    body.append(step_frame(0, 1, "04", "Buy the stale side", f04,
                           "Arbitrageur buys $200K of ETH on Coinbase at the stale $4,000 price."))

    def f05(w, h):
        s = [venue_card(0, 20, w//2 - 16, 100, "BINANCE", "$4,005", jumped=True)]
        s.append(venue_card(w//2 + 16, 20, w//2 - 16, 100, "COINBASE", "$4,000", stale=True))
        s.append(arb_actor(w//2, h//2 + 80, hot=True))
        # Sell arrow from arb to Binance
        s.append(PATH(f"M {w//2 - 30} {h//2 + 65} L {w*0.22} 100",
                      stroke=RED, w=2.4, marker_end="arrRed"))
        s.append(T(w*0.3, h*0.6, "SELL $200K", font=SF_MONO, size=12, weight=700,
                   fill=RED, anchor="middle", tracking=0.48))
        s.append(T(w*0.3, h*0.6 + 18, "@ $4,005", font=SF_MONO, size=11, weight=600,
                   fill=RED, anchor="middle"))
        return "\n".join(s)
    body.append(step_frame(1, 1, "05", "Hedge on the fast side", f05,
                           "Simultaneously sells $200K on Binance at $4,005. Net inventory zero."))

    def f06(w, h):
        return big_stat(w//2, h//2, "+$5", color=GREEN,
                        label_top="PER ETH ARBITRAGED",
                        label_bot="risk-free · repeats hundreds × day",
                        value_size=72)
    body.append(step_frame(2, 1, "06", "Receipt", f06,
                           "Coinbase catches up at t+80 ms. The five dollars per unit is banked."))

    body.append(economics("OPERATOR SPEND", "~$400K/yr",
                          "ANNUAL TAKE", "$500K–2M"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 04 — LATENCY ARBITRAGE
# =====================================================
def build_04_latency():
    body = [header(
        eyebrow="EXTRACTION 04 · THE TIME BAR",
        hook_left="The trade was over",
        hook_right="before the click.",
        tagline="You click in 200 milliseconds. They executed 250,000 trades in that window.",
        scapegoat="Retail clicker; slow MM with stale quotes",
        predator="HFT firm with FPGA + co-lo + microwave",
    )]
    def f01(w, h):
        # CME ES jump
        s = [T(w//2, 18, "CME · ES FUTURES", font=SF_MONO, size=12, weight=700,
               fill=INK_3, anchor="middle", tracking=2.16)]
        s.append(L(0, h*0.6, w, h*0.6, stroke=RULE_2))
        s.append(PATH(f"M 0 {h*0.6} L {w*0.45} {h*0.6} L {w*0.5} {h*0.35} L {w} {h*0.35}",
                      stroke=INK, w=2))
        s.append(CIRC(w*0.5, h*0.35, 6, fill=BLUE))
        s.append(T(w*0.5, h*0.30, "+0.3%", font=SF_MONO, size=12, weight=700,
                   fill=BLUE, anchor="middle"))
        s.append(T(w*0.5, h*0.78, "t = 0", font=SF_MONO, size=11, weight=600,
                   fill=INK_3, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(0, 0, "01", "ES futures move first", f01,
                           "A macro print pushes ES futures up 0.3%. The leader has spoken."))

    def f02(w, h):
        s = [T(w//2, 18, "ARCA · SPY ETF", font=SF_MONO, size=12, weight=700,
               fill=INK_3, anchor="middle", tracking=2.16)]
        s.append(L(0, h*0.5, w, h*0.5, stroke=RULE_2))
        s.append(PATH(f"M 0 {h*0.5} L {w} {h*0.5}", stroke=INK_3, w=2, dash="4 3"))
        s.append(T(w//2, h*0.36, "QUOTE STALE", font=SF_MONO, size=14, weight=800,
                   fill=RED, anchor="middle", tracking=2.52))
        s.append(T(w//2, h*0.78, "stale window: 50–500 μs", font=SF_MONO, size=12,
                   weight=600, fill=INK_3, anchor="middle", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(1, 0, "02", "SPY quote goes stale", f02,
                           "The correlated ETF hasn't updated yet. For microseconds, the price is wrong."))

    def f03(w, h):
        # Time bar chart at log scale
        s = []
        bars = [
            ("FPGA: 810 ns", 6, GREEN),
            ("BANK EXEC: 5 ms", 14, BLUE),
            ("BROWSER RPC: 50 ms", 160, INK_3),
            ("RETAIL CLICK: 200 ms", w - 20, RED),
        ]
        s.append(L(10, h - 30, w - 10, h - 30, stroke=RULE_2))
        s.append(T(10, h - 10, "0", font=SF_MONO, size=11, weight=600,
                   fill=INK_3, tracking=0.44))
        s.append(T(w - 10, h - 10, "200 ms", font=SF_MONO, size=11, weight=600,
                   fill=INK_3, anchor="end", tracking=0.44))
        bar_h = 26
        gap = 14
        for i, (label, bw, color) in enumerate(bars):
            by = 14 + i * (bar_h + gap)
            s.append(R(10, by, max(bw, 6), bar_h, fill=color, rx=4))
            # Label outside if bar is short, inside if long
            if bw < 100:
                s.append(T(10 + max(bw, 6) + 10, by + bar_h//2 + 5, label, font=SF_MONO,
                           size=11, weight=700, fill=INK))
            else:
                s.append(T(20, by + bar_h//2 + 5, label, font=SF_MONO, size=11,
                           weight=700, fill=PAPER))
        return "\n".join(s)
    body.append(step_frame(2, 0, "03", "FPGA fires in 810 ns", f03,
                           "An FPGA converts the ES print into a SPY order, instantly. Retail click: 200 ms."))

    def f04(w, h):
        return orderbook_v2(w//2, h//2, offer="$500.20", bid="$500.10",
                            offer_strike=True, bid_strike=False,
                            note="slow MM's stale offer taken at $500.20 before they could pull it")
    body.append(step_frame(0, 1, "04", "Slow MM picked off", f04,
                           "A market maker who hasn't updated yet has their stale quote taken."))

    def f05(w, h):
        s = [T(w//2, 18, "ARCA · SPY ETF", font=SF_MONO, size=12, weight=700,
               fill=INK_3, anchor="middle", tracking=2.16)]
        s.append(L(0, h*0.6, w, h*0.6, stroke=RULE_2))
        s.append(PATH(f"M 0 {h*0.6} L {w*0.4} {h*0.6} L {w*0.45} {h*0.35} L {w} {h*0.35}",
                      stroke=INK, w=2))
        s.append(CIRC(w*0.45, h*0.35, 5, fill=INK_3))
        s.append(T(w*0.45, h*0.28, "t + 500 μs", font=SF_MONO, size=11, weight=600,
                   fill=INK_3, anchor="middle", tracking=0.44))
        s.append(T(w//2, h*0.85, "too late on this print", font=SF_MONO, size=12,
                   weight=600, fill=INK_3, anchor="middle", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(1, 1, "05", "SPY catches up", f05,
                           "Five hundred microseconds later the quote updates. The arbitrage is closed."))

    def f06(w, h):
        return big_stat(w//2, h//2, "$5B", color=BLUE,
                        label_top="GLOBAL LATENCY TAX / YEAR",
                        label_bot="Aquilina · Budish · O'Neill · QJE 2022",
                        value_size=72)
    body.append(step_frame(2, 1, "06", "The accumulator", f06,
                           "Per trade: pennies. Across markets: $5B a year. Seventeen percent of liquidity cost."))

    body.append(economics("OPERATOR SPEND", "~$650K/yr",
                          "ANNUAL TAKE", "$300K–1.5M"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 05 — INFORMATION EDGE
# =====================================================
def build_05_information():
    body = [header(
        eyebrow="EXTRACTION 05 · THE CALENDAR",
        hook_left="Earnings are old news",
        hook_right="to ten people.",
        tagline="By the time the press release prints, the position has already paid for the satellite.",
        scapegoat="Retail trader reading the headline at 4:01 pm",
        predator="Hedge fund with credit-card panels + satellites + experts",
    )]
    def panel(title, *, value, value_color=INK, sub=None, footnote=None, dark=False):
        bg = INK if dark else PAPER_2
        text_main = PAPER if dark else INK
        text_sub = "rgba(255,255,255,0.7)" if dark else INK_3
        text_foot = "rgba(255,255,255,0.5)" if dark else INK_3
        def fn(w, h):
            s = [R(0, 0, w, h, fill=bg, stroke=RULE_2 if not dark else INK, rx=10)]
            s.append(T(w//2, 30, title, font=SF_MONO, size=12, weight=700,
                       fill=text_sub, anchor="middle", tracking=2.16))
            s.append(T(w//2, h//2 + 14, value, font=SF_DISPLAY, size=48, weight=800,
                       fill=value_color, anchor="middle", tracking=-1.056))
            if sub:
                s.append(T(w//2, h//2 + 44, sub, font=SF_TEXT, size=14, weight=500,
                           fill=text_main, anchor="middle", tracking=-0.07))
            if footnote:
                s.append(T(w//2, h - 20, footnote, font=SF_MONO, size=11, weight=600,
                           fill=text_foot, anchor="middle", tracking=0.44))
            return "\n".join(s)
        return fn
    body.append(step_frame(0, 0, "01", "Receipts before the company",
                           panel("JAN · CREDIT-CARD PANEL", value="+22%", value_color=GREEN,
                                 sub="YoY service receipts", footnote="YipitData · $120K/yr"),
                           "Credit-card data shows Tesla service revenue up 22% YoY in January."))
    body.append(step_frame(1, 0, "02", "Counted from orbit",
                           panel("FEB · SATELLITE IMAGERY", value="+18%", value_color=PAPER,
                                 sub="Shanghai factory parking", footnote="RS Metrics · $80K/yr",
                                 dark=True),
                           "Satellite imagery confirms the factory parking lot is 18% fuller than Q4."))
    def f03(w, h):
        return (
            R(0, 0, w, h, fill=PAPER_2, stroke=RULE_2, rx=10) + "\n" +
            T(w//2, 30, "MAR · EXPERT NETWORK", font=SF_MONO, size=12, weight=700,
              fill=INK_3, anchor="middle", tracking=2.16) + "\n" +
            T(w//2, h//2 + 4, "“Tooling capacity confirmed.”",
              font=NY_SERIF, size=19, weight=500, fill=INK, anchor="middle",
              italic=True, tracking=-0.30) + "\n" +
            T(w//2, h//2 + 32, "— ex-Tesla supply-chain VP", font=SF_TEXT, size=14,
              weight=500, fill=INK_2, anchor="middle", tracking=-0.07) + "\n" +
            T(w//2, h - 20, "GLG · $150K/yr", font=SF_MONO, size=11, weight=600,
              fill=INK_3, anchor="middle", tracking=0.44)
        )
    body.append(step_frame(2, 0, "03", "Confirmed by an insider", f03,
                           "A paid expert-network call with a former supply-chain VP confirms it."))
    def f04(w, h):
        return (
            R(0, 0, w, h, fill=BLUE_T, stroke=BLUE, rx=10) + "\n" +
            T(w//2, 30, "LATE MAR · POSITION OPENS", font=SF_MONO, size=12, weight=700,
              fill=BLUE, anchor="middle", tracking=2.16) + "\n" +
            T(w//2, h//2 + 14, "LONG CALLS", font=SF_DISPLAY, size=40, weight=800,
              fill=BLUE, anchor="middle", tracking=-0.88) + "\n" +
            T(w//2, h//2 + 44, "positioned before consensus updates", font=SF_TEXT, size=14,
              weight=500, fill=INK_2, anchor="middle", tracking=-0.07) + "\n" +
            T(w//2, h - 20, "three independent signals aligned", font=SF_MONO, size=11,
              weight=600, fill=INK_3, anchor="middle", tracking=0.44)
        )
    body.append(step_frame(0, 1, "04", "Position opens", f04,
                           "With three pieces of evidence aligned, the fund opens a directional position."))
    def f05(w, h):
        return (
            R(0, 0, w, h, fill=PAPER, stroke=RULE_2, rx=10) + "\n" +
            T(w//2, 30, "APR · EARNINGS DAY", font=SF_MONO, size=12, weight=700,
              fill=INK_3, anchor="middle", tracking=2.16) + "\n" +
            L(20, h*0.75, w-20, h*0.75, stroke=RULE_2) + "\n" +
            PATH(f"M 20 {h*0.65} L {w*0.3} {h*0.62} L {w*0.45} {h*0.66} L {w*0.55} {h*0.62} L {w*0.6} {h*0.30} L {w-20} {h*0.26}",
                 stroke=INK, w=2) + "\n" +
            CIRC(w*0.6, h*0.30, 6, fill=GREEN) + "\n" +
            T(w*0.6, h*0.22, "+8%", font=SF_MONO, size=14, weight=800,
              fill=GREEN, anchor="middle") + "\n" +
            T(w//2, h - 20, "earnings beat printed", font=SF_MONO, size=11, weight=600,
              fill=INK_3, anchor="middle", tracking=0.44)
        )
    body.append(step_frame(1, 1, "05", "The print", f05,
                           "Tesla announces a beat. The stock jumps eight percent. The edge crystallises."))
    def f06(w, h):
        return (
            R(0, 0, w, h, fill=RED_T, stroke=RED, rx=10) + "\n" +
            T(w//2, 30, "APR · 4:01 PM", font=SF_MONO, size=12, weight=700,
              fill=RED, anchor="middle", tracking=2.16) + "\n" +
            T(w//2, h//2, "TESLA BEATS Q1", font=SF_DISPLAY, size=28, weight=800,
              fill=INK, anchor="middle", tracking=-0.616) + "\n" +
            T(w//2, h//2 + 28, "— CNBC headline", font=SF_TEXT, size=14, weight=500,
              fill=INK_2, anchor="middle", tracking=-0.07) + "\n" +
            T(w//2, h - 20, "fund has already exited at the open",
              font=SF_MONO, size=11, weight=600, fill=INK_3, anchor="middle", tracking=0.44)
        )
    body.append(step_frame(2, 1, "06", "Retail reads the headline", f06,
                           "Four-oh-one p.m. The fund has already exited. The retail reader is buying the top."))
    body.append(economics("OPERATOR SPEND", "~$714K/yr",
                          "ANNUAL TAKE", "$500K–2M"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 06 — SPOOFING & LAYERING
# =====================================================
def build_06_spoofing():
    body = [header(
        eyebrow="EXTRACTION 06 · THE WALL THAT WASN'T",
        hook_left="Build a wall.",
        hook_right="Cancel it.",
        tagline="The chart is not a record. The chart is a stage. Sarao did this for $40M.",
        scapegoat="Retail trader reading 'strong support' on the chart",
        predator="Spoofer with millisecond cancel speed",
    )]

    def thin_book(x0, y0, w, h, with_wall=False, wall_cancelled=False, fill_retail=False,
                  drop=False):
        """Compact orderbook visualization. Returns SVG."""
        s = []
        # Asks
        for i in range(3):
            bw = 30 + i * 10
            s.append(R(x0, y0 + i * 24, bw, 16, fill=RED, opacity=0.55, rx=3))
        # Mid line
        s.append(L(x0, y0 + 76, x0 + w, y0 + 76, stroke=RULE_2, dash="2 3"))
        # Bids — either thin or with wall
        if with_wall:
            wall_w = w - 20
            if wall_cancelled:
                s.append(R(x0, y0 + 84, wall_w, 22, fill="none", stroke=BLUE, stroke_w=1.5,
                           opacity=0.6))
                s.append(T(x0 + wall_w//2, y0 + 100, "CANCELLED",
                           font=SF_MONO, size=11, weight=700, fill=INK_3,
                           anchor="middle", tracking=0.88))
            else:
                s.append(R(x0, y0 + 84, wall_w, 22, fill=BLUE, rx=3))
                s.append(T(x0 + wall_w//2, y0 + 100, "$5M @ $99.00",
                           font=SF_MONO, size=11, weight=700, fill=PAPER,
                           anchor="middle", tracking=0.66))
            # Smaller real bids below
            for i in range(2):
                bw = 24 + i * 8
                s.append(R(x0, y0 + 112 + i * 22, bw, 16, fill=BLUE, opacity=0.4, rx=3))
        else:
            for i in range(3):
                bw = 24 + i * 8
                s.append(R(x0, y0 + 84 + i * 22, bw, 16, fill=BLUE, opacity=0.55, rx=3))
        if fill_retail:
            s.append(CIRC(x0 + w - 18, y0 + 8, 12, fill=GREEN))
            s.append(T(x0 + w - 18, y0 + 13, "✓", font=SF_TEXT, size=14, weight=800,
                       fill=PAPER, anchor="middle"))
        return "\n".join(s)

    def f01(w, h):
        s = [thin_book(20, 20, w - 40, h - 40, with_wall=False)]
        s.append(T(w - 20, 32, "thin book", font=SF_MONO, size=11, weight=700,
                   fill=INK_3, anchor="end", tracking=0.66))
        s.append(T(w//2, h - 12, "MM has private sell intent — invisible",
                   font=SF_MONO, size=11, weight=600, fill=INK_3, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(0, 0, "01", "Thin book, hidden intent", f01,
                           "Order book is thin. The MM wants to sell at the highest visible price."))

    def f02(w, h):
        s = [thin_book(20, 20, w - 40, h - 40, with_wall=True)]
        s.append(T(w//2, h - 12, "the chart now reads 'strong support'",
                   font=SF_MONO, size=11, weight=600, fill=BLUE, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(1, 0, "02", "The wall goes up", f02,
                           "MM posts $5M bid at $99. To the chart it looks like serious conviction."))

    def f03(w, h):
        # Retail chart with support line
        return price_chart(0, 10, w, h - 40,
            f"M 0 {(h-40)*0.5} L {w*0.2} {(h-40)*0.52} L {w*0.4} {(h-40)*0.58} L {w*0.6} {(h-40)*0.62} L {w*0.8} {(h-40)*0.66} L {w} {(h-40)*0.62}",
            hlines=[((h-40)*0.72, "$99.00 'support'")],
            labels=[(w//2, (h-40)*0.86, "retail decides to buy the dip", BLUE, "middle")])
    body.append(step_frame(2, 0, "03", "Retail reads the wall as support", f03,
                           "The wall is flagged as buy-side conviction. Retail decides to buy the dip."))

    def f04(w, h):
        s = [thin_book(20, 20, w - 40, h - 40, with_wall=True, fill_retail=True)]
        s.append(T(w//2, h - 12, "retail buys at $99.05 from the MM's offer",
                   font=SF_MONO, size=11, weight=600, fill=INK_3, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(0, 1, "04", "Retail fills the MM's offer", f04,
                           "Convinced by the wall, retail crosses the spread and buys at $99.05."))

    def f05(w, h):
        s = [thin_book(20, 20, w - 40, h - 40, with_wall=True, wall_cancelled=True)]
        s.append(T(w//2, h - 12, "wall lifespan: 47 milliseconds total",
                   font=SF_MONO, size=11, weight=700, fill=RED, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(1, 1, "05", "The wall disappears", f05,
                           "Forty-seven milliseconds after appearing, the wall is cancelled."))

    def f06(w, h):
        return price_chart(0, 10, w, h - 40,
            f"M 0 {(h-40)*0.25} L {w*0.2} {(h-40)*0.32} L {w*0.4} {(h-40)*0.46} L {w*0.6} {(h-40)*0.60} L {w*0.8} {(h-40)*0.72} L {w} {(h-40)*0.80}",
            hlines=[((h-40)*0.25, "$99.05 fill"), ((h-40)*0.82, "$98.85")],
            labels=[(w - 20, (h-40)*0.92, "+$0.20 / share to MM", GREEN, "end")])
    body.append(step_frame(2, 1, "06", "The drop", f06,
                           "With no real support, price falls to $98.85. The MM kept the round trip."))

    body.append(economics("MARGINAL SPEND", "~$0",
                          "ANNUAL TAKE", "$200K–2M"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 07 — PAYMENT FOR ORDER FLOW (rebuilt)
# =====================================================
def build_07_pfof():
    body = [header(
        eyebrow="EXTRACTION 07 · THE CASH ROUTE",
        hook_left="Your broker",
        hook_right="has three owners.",
        tagline="Citadel paid $943M for nine months of retail order flow in 2024. They paid because retail flow is the best in the world.",
        scapegoat="Retail trader who thinks they got NBBO",
        predator="Citadel Securities, the wholesaler",
    )]
    def party_box(x0, y0, w, h, *, name, sub, fill, color):
        s = [R(x0, y0, w, h, fill=fill, stroke=(BLUE if fill == BLUE else RULE_2), rx=12)]
        s.append(T(x0 + w//2, y0 + 30, name, font=SF_TEXT, size=15, weight=700,
                   fill=color, anchor="middle", tracking=-0.075))
        s.append(T(x0 + w//2, y0 + 54, sub, font=SF_MONO, size=11, weight=600,
                   fill=color, anchor="middle", opacity=0.75, tracking=0.44))
        return "\n".join(s)

    def f01(w, h):
        # Phone with buy button
        return (
            R(w*0.3, 30, w*0.4, h - 60, fill=PAPER_2, stroke=RULE_2, rx=20) + "\n" +
            T(w//2, 60, "ROBINHOOD", font=SF_MONO, size=11, weight=700,
              fill=INK_3, anchor="middle", tracking=1.65) + "\n" +
            R(w*0.34, 90, w*0.32, 44, fill=GREEN, rx=10) + "\n" +
            T(w//2, 118, "BUY 100 AAPL", font=SF_TEXT, size=14, weight=700,
              fill=PAPER, anchor="middle", tracking=-0.07) + "\n" +
            T(w//2, h - 70, "$17,200 order", font=SF_MONO, size=13, weight=700,
              fill=INK, anchor="middle") + "\n" +
            T(w//2, h - 46, "click", font=SF_MONO, size=11, weight=600,
              fill=INK_3, anchor="middle", tracking=0.44)
        )
    body.append(step_frame(0, 0, "01", "Retail clicks Buy", f01,
                           "A retail trader places a market order through Robinhood."))

    def f02(w, h):
        bw = 100
        gap_x = (w - bw * 3) // 2
        s = [party_box(0, 30, bw, 80, name="RETAIL", sub="$17.2K", fill=PAPER, color=INK)]
        s.append(party_box(bw + gap_x, 30, bw, 80, name="BROKER", sub="Robinhood", fill=PAPER, color=INK))
        s.append(party_box(bw * 2 + gap_x * 2, 30, bw, 80, name="WHOLESALER", sub="Citadel", fill=BLUE, color=PAPER))
        # Order flow arrows (top, ink)
        s.append(PATH(f"M {bw + 4} 56 L {bw + gap_x - 4} 56", stroke=INK, w=1.8, marker_end="arrInk"))
        s.append(T(bw + gap_x//2, 46, "order", font=SF_MONO, size=11, weight=700,
                   fill=INK, anchor="middle", tracking=0.44))
        s.append(PATH(f"M {bw*2 + gap_x + 4} 56 L {bw*2 + gap_x*2 - 4} 56", stroke=INK, w=1.8, marker_end="arrInk"))
        s.append(T(bw*2 + gap_x + gap_x//2, 46, "rerouted", font=SF_MONO, size=11,
                   weight=700, fill=INK, anchor="middle", tracking=0.44))
        s.append(T(w//2, h - 14, "order does not reach a public exchange",
                   font=SF_MONO, size=11, weight=600, fill=INK_3, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(1, 0, "02", "Rerouted to a wholesaler", f02,
                           "Robinhood does not send the order to NYSE. It routes to Citadel Securities."))

    def f03(w, h):
        bw = 100
        gap_x = (w - bw * 3) // 2
        s = [party_box(0, 30, bw, 80, name="RETAIL", sub="", fill=PAPER, color=INK)]
        s.append(party_box(bw + gap_x, 30, bw, 80, name="BROKER", sub="Robinhood", fill=PAPER, color=INK))
        s.append(party_box(bw * 2 + gap_x * 2, 30, bw, 80, name="WHOLESALER", sub="Citadel", fill=BLUE, color=PAPER))
        # PFOF arrow from Citadel to Broker (bottom, green)
        s.append(PATH(f"M {bw*2 + gap_x*2 - 4} 140 L {bw + gap_x + bw + 4} 140",
                      stroke=GREEN, w=2, marker_end="arrGreen"))
        s.append(T(bw + gap_x + bw//2 + gap_x//2, 158, "$1.30 PFOF",
                   font=SF_MONO, size=12, weight=800, fill=GREEN, anchor="middle", tracking=0.48))
        s.append(T(w//2, h - 14, "cash paid for access to the flow",
                   font=SF_MONO, size=11, weight=600, fill=INK_3, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(2, 0, "03", "Cash to the broker", f03,
                           "Citadel pays Robinhood ~$1.30 in cash — payment for order flow."))

    def f04(w, h):
        bw = 100
        gap_x = (w - bw * 3) // 2
        s = [party_box(0, 30, bw, 80, name="RETAIL", sub="", fill=PAPER, color=INK)]
        s.append(party_box(bw + gap_x, 30, bw, 80, name="BROKER", sub="", fill=PAPER, color=INK))
        s.append(party_box(bw * 2 + gap_x * 2, 30, bw, 80, name="WHOLESALER", sub="Citadel", fill=BLUE, color=PAPER))
        # 'Price improvement' arrow from Citadel back to Retail (long, bottom)
        s.append(PATH(f"M {bw*2 + gap_x*2 - 4} 150 L {bw - 4} 150",
                      stroke=RED, w=2, marker_end="arrRed"))
        s.append(T(w//2, 170, "$0.20 'price improvement'",
                   font=SF_MONO, size=12, weight=800, fill=RED, anchor="middle", tracking=0.48))
        s.append(T(w//2, h - 14, "filled at NBBO midpoint",
                   font=SF_MONO, size=11, weight=600, fill=INK_3, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(0, 1, "04", "Token improvement returns", f04,
                           "Citadel fills at NBBO midpoint and hands back $0.20 of 'price improvement.'"))

    def f05(w, h):
        s = [party_box(20, 30, w*0.36, 80, name="CITADEL", sub="long 100 AAPL", fill=BLUE, color=PAPER)]
        s.append(party_box(w - 20 - w*0.36, 30, w*0.36, 80, name="NYSE / ARCA", sub="public venue", fill=INK, color=PAPER))
        s.append(PATH(f"M {20 + w*0.36 + 4} 70 L {w - 20 - w*0.36 - 4} 70",
                      stroke=INK, w=2, marker_end="arrInk"))
        s.append(T(w//2, 60, "hedge", font=SF_MONO, size=11, weight=700,
                   fill=INK, anchor="middle", tracking=0.44))
        s.append(T(w//2, h - 14, "offsetting trade at NBBO bid",
                   font=SF_MONO, size=11, weight=600, fill=INK_3, anchor="middle", tracking=0.44))
        return "\n".join(s)
    body.append(step_frame(1, 1, "05", "Citadel hedges in public", f05,
                           "On a real exchange, Citadel takes the offsetting position at the NBBO bid."))

    def f06(w, h):
        # Receipt-style ledger
        rows = [
            ("Citadel kept", "+$3.50", GREEN),
            ("Robinhood kept", "+$1.10", BLUE),
            ("Retail 'improvement'", "+$0.20", RED),
        ]
        s = [T(w//2, 22, "FINAL RECEIPT", font=SF_MONO, size=12, weight=700,
               fill=INK_3, anchor="middle", tracking=2.16)]
        for i, (label, val, color) in enumerate(rows):
            ry = 56 + i * 38
            s.append(T(8, ry, label, font=SF_TEXT, size=15, weight=600,
                       fill=INK, tracking=-0.075))
            s.append(T(w - 8, ry, val, font=SF_MONO, size=20, weight=800,
                       fill=color, anchor="end"))
        s.append(L(8, 180, w - 8, 180, stroke=RULE_2))
        s.append(T(8, 208, "Citadel · 9 mo of 2024", font=SF_TEXT, size=14,
                   weight=600, fill=INK, tracking=-0.07))
        s.append(T(w - 8, 208, "$943M paid", font=SF_MONO, size=16, weight=800,
                   fill=INK, anchor="end"))
        return "\n".join(s)
    body.append(step_frame(2, 1, "06", "Who paid whom", f06,
                           "Citadel kept $3.50 on the spread. Robinhood kept $1.10. Retail subsidised both."))

    body.append(economics("PFOF PAID (CITADEL 9MO)", "$943M",
                          "ANNUAL TAKE (CITADEL)", "$3–5B"))
    return wrap_svg("\n".join(body))


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
        (OUT / f"{name}.svg").write_text(svg)
        print(f"  wrote {name}.svg  ({len(svg)} bytes)")
    print(f"\nDone. Canvas: {W}x{H}. Output: {OUT}")
