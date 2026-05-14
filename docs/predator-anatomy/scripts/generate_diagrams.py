#!/usr/bin/env python3
"""Generate 7 Apple-style mechanism diagrams — v3.

v3 changes (from v2):
- Removed explicit SCAPEGOAT / PREDATOR text labels. Implied via the hero portrait.
- Each diagram opens with a hero block: 640×640 grayscale portrait + named quote +
  attribution + context paragraph. The named figure does the implying.
- Canvas 1500x1300 → 1600x1900. Header sits above hero; mechanism grid sits below.
- Apple-grade type: 19px lede, 17px body, 32-36px serif-italic pull-quote,
  72-88px hero title with serif italic accent.
- Step grid kept (3×2) but frames larger (480x360) and illustrations rendered
  with the same Apple type scale — no more squashed annotations.

Portraits live in docs/predator-anatomy/diagrams/portraits/{name}_sq.jpg
and are base64-embedded so each SVG is fully self-contained.
"""
import pathlib, textwrap, base64

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "diagrams" / "multi"
OUT.mkdir(parents=True, exist_ok=True)
PORTRAIT_DIR = ROOT / "diagrams" / "portraits"

# ===== CANVAS =====
W, H = 1600, 1900

# Header zone (eyebrow / hook / tagline)
HDR_TOP = 80
EYEBROW_Y = HDR_TOP
TITLE_Y = HDR_TOP + 84
TAGLINE_Y = HDR_TOP + 156

# Hero zone (portrait + quote)
HERO_TOP = HDR_TOP + 220              # 300
HERO_H = 660
HERO_BOTTOM = HERO_TOP + HERO_H        # 960
PORTRAIT_SIZE = 580
PORTRAIT_X = 80
PORTRAIT_Y = HERO_TOP + (HERO_H - PORTRAIT_SIZE) // 2  # vertically centred

# Step grid zone
GRID_TOP = HERO_BOTTOM + 80            # 1040
STEP_W, STEP_H = 480, 380
GAP_STEP = 30
GRID_W = STEP_W * 3 + GAP_STEP * 2     # = 1500
GRID_LEFT = (W - GRID_W) // 2          # = 50
FRAME_PAD = 36

# Footer (economics)
FOOTER_TOP = GRID_TOP + STEP_H * 2 + GAP_STEP + 60   # = 1890
# Push canvas down: make sure footer fits
H = FOOTER_TOP + 100 + 60              # 2050
FOOTER_H = 80

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

# ===== TYPE FAMILIES =====
SF_DISPLAY = "'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif"
SF_TEXT = "'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif"
SF_MONO = "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace"
NY_SERIF = "'New York', 'Times New Roman', Georgia, serif"

# ===== PRIMITIVES =====
def T(x, y, txt, *, font=SF_TEXT, size=17, weight=400, fill=INK, anchor="start",
      tracking=None, italic=False, opacity=None):
    s = [f"font-family:{font}", f"font-size:{size}px", f"font-weight:{weight}", f"fill:{fill}"]
    if italic: s.append("font-style:italic")
    if tracking is not None: s.append(f"letter-spacing:{tracking}px")
    if opacity is not None: s.append(f"opacity:{opacity}")
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="{";".join(s)}">{txt}</text>'

def R(x, y, w, h, *, fill=PAPER, stroke=None, stroke_w=1, rx=0, opacity=None):
    s = [f'x="{x}"', f'y="{y}"', f'width="{w}"', f'height="{h}"', f'rx="{rx}"', f'fill="{fill}"']
    if stroke:
        s.append(f'stroke="{stroke}"'); s.append(f'stroke-width="{stroke_w}"')
    if opacity is not None: s.append(f'opacity="{opacity}"')
    return f'<rect {" ".join(s)}/>'

def L(x1, y1, x2, y2, *, stroke=INK, w=1, dash=None, opacity=None):
    s = [f'x1="{x1}"', f'y1="{y1}"', f'x2="{x2}"', f'y2="{y2}"', f'stroke="{stroke}"', f'stroke-width="{w}"']
    if dash: s.append(f'stroke-dasharray="{dash}"')
    if opacity is not None: s.append(f'opacity="{opacity}"')
    return f'<line {" ".join(s)}/>'

def CIRC(cx, cy, r, *, fill=PAPER, stroke=None, w=1):
    s = [f'cx="{cx}"', f'cy="{cy}"', f'r="{r}"', f'fill="{fill}"']
    if stroke: s.append(f'stroke="{stroke}"'); s.append(f'stroke-width="{w}"')
    return f'<circle {" ".join(s)}/>'

def PATH(d, *, stroke=INK, fill="none", w=2, marker_end=None, dash=None):
    s = [f'd="{d}"', f'fill="{fill}"', f'stroke="{stroke}"', f'stroke-width="{w}"',
         'stroke-linecap="round"', 'stroke-linejoin="round"']
    if marker_end: s.append(f'marker-end="url(#{marker_end})"')
    if dash: s.append(f'stroke-dasharray="{dash}"')
    return f'<path {" ".join(s)}/>'

def arrow_defs():
    out = ['<defs>']
    for name, color in [("arrInk", INK), ("arrBlue", BLUE), ("arrRed", RED), ("arrGreen", GREEN), ("arrInk3", INK_3)]:
        out.append(f'<marker id="{name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">'
                   f'<path d="M 0 0 L 10 5 L 0 10 z" fill="{color}"/></marker>')
    out.append('</defs>')
    return "\n".join(out)

# ===== HEADER (eyebrow, hook with italic accent, tagline) =====
def header(eyebrow, hook_left, hook_right, tagline):
    s = []
    s.append(T(W//2, EYEBROW_Y, eyebrow, font=SF_MONO, size=15, weight=700,
               fill=INK_3, anchor="middle", tracking=2.7))
    # Approximate widths for centred composite title.
    # 72px display: roughly 32px/char average.
    left_w = len(hook_left) * 32
    right_w = len(hook_right) * 30
    total = left_w + right_w + 24
    left_x = (W - total) // 2 + left_w
    right_x = left_x + 24
    s.append(T(left_x, TITLE_Y, hook_left, font=SF_DISPLAY, size=72, weight=700,
               fill=INK, anchor="end", tracking=-1.584))
    s.append(T(right_x, TITLE_Y, hook_right, font=NY_SERIF, size=72, weight=500,
               fill=BLUE, anchor="start", tracking=-1.152, italic=True))
    s.append(T(W//2, TAGLINE_Y, tagline, font=SF_TEXT, size=22, weight=500,
               fill=INK_3, anchor="middle", tracking=-0.264))
    return "\n".join(s)

# ===== HERO BLOCK (portrait + quote + attribution + context) =====
def portrait_b64(name):
    """Return data URI for a portrait file in PORTRAIT_DIR."""
    p = PORTRAIT_DIR / f"{name}_sq.jpg"
    if not p.exists():
        return None
    return "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode()

def wrap_text(text, width=68):
    """Word-wrap for SVG <text> rendering (no auto-wrap in SVG)."""
    return textwrap.wrap(text, width=width, break_long_words=False)

def hero(portrait_name, quote, attrib_name, attrib_title, attrib_source, context):
    s = []
    # Portrait
    data = portrait_b64(portrait_name) if portrait_name else None
    if data:
        # Wrap in a clip with subtle rounded corners and 1px hairline
        s.append(f'<defs><clipPath id="portClip"><rect x="{PORTRAIT_X}" y="{PORTRAIT_Y}" '
                 f'width="{PORTRAIT_SIZE}" height="{PORTRAIT_SIZE}" rx="14"/></clipPath></defs>')
        s.append(f'<image href="{data}" x="{PORTRAIT_X}" y="{PORTRAIT_Y}" '
                 f'width="{PORTRAIT_SIZE}" height="{PORTRAIT_SIZE}" '
                 f'preserveAspectRatio="xMidYMid slice" clip-path="url(#portClip)"/>')
        # Hairline border
        s.append(R(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE,
                   fill="none", stroke=RULE_2, rx=14))
    else:
        # Fallback: stylised placeholder card (used by spoofing — no public photo of Sarao)
        s.append(R(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE,
                   fill=INK, rx=14))
        s.append(T(PORTRAIT_X + PORTRAIT_SIZE//2, PORTRAIT_Y + PORTRAIT_SIZE//2,
                   "—", font=NY_SERIF, size=120, weight=500, fill=PAPER, anchor="middle"))

    # Right column: quote + attribution + context
    rx = PORTRAIT_X + PORTRAIT_SIZE + 80
    rw = W - rx - 80
    # Open quote mark — large serif as decorative accent
    s.append(T(rx, PORTRAIT_Y + 40, "“", font=NY_SERIF, size=120, weight=400,
               fill=BLUE, italic=False))
    # Pull-quote — wrap manually
    q_lines = wrap_text(quote, width=44)
    q_y = PORTRAIT_Y + 90
    for i, line in enumerate(q_lines[:5]):
        s.append(T(rx + 60, q_y + i * 50, line, font=NY_SERIF, size=36, weight=500,
                   fill=INK, italic=True, tracking=-0.576))
    # Attribution
    attr_y = q_y + len(q_lines[:5]) * 50 + 36
    s.append(T(rx + 60, attr_y, attrib_name, font=SF_TEXT, size=17, weight=700,
               fill=INK, tracking=-0.374))
    s.append(T(rx + 60, attr_y + 24, f"{attrib_title} · {attrib_source}",
               font=SF_TEXT, size=15, weight=500, fill=INK_3, tracking=-0.075))
    # Context paragraph
    ctx_lines = wrap_text(context, width=58)
    ctx_y = attr_y + 70
    for i, line in enumerate(ctx_lines[:4]):
        s.append(T(rx + 60, ctx_y + i * 28, line, font=SF_TEXT, size=18, weight=400,
                   fill=INK_2, tracking=-0.18))
    return "\n".join(s)

# ===== STEP FRAME =====
def step_frame(col, row, num, title, body_inner, caption):
    x = GRID_LEFT + col * (STEP_W + GAP_STEP)
    y = GRID_TOP + row * (STEP_H + GAP_STEP)
    s = []
    s.append(R(x, y, STEP_W, STEP_H, fill=PAPER_3, stroke=RULE_2, rx=14))
    s.append(CIRC(x + FRAME_PAD + 14, y + FRAME_PAD + 14, 14, fill=PAPER, stroke=BLUE, w=1.5))
    s.append(T(x + FRAME_PAD + 14, y + FRAME_PAD + 19, num, font=SF_MONO, size=14,
               weight=700, fill=BLUE, anchor="middle"))
    s.append(T(x + FRAME_PAD + 40, y + FRAME_PAD + 19, title, font=SF_TEXT, size=17,
               weight=700, fill=INK, tracking=-0.374))
    s.append(f'<g transform="translate({x + FRAME_PAD}, {y + 72})">')
    s.append(body_inner(STEP_W - FRAME_PAD * 2, STEP_H - 72 - 80))
    s.append('</g>')
    lines = wrap_text(caption, width=58)
    if len(lines) > 2:
        lines = lines[:2]
        lines[-1] = lines[-1][:55].rstrip() + "…"
    cap_y_base = y + STEP_H - 48
    for i, line in enumerate(lines):
        s.append(T(x + FRAME_PAD, cap_y_base + i * 22, line, font=SF_TEXT, size=15,
                   weight=400, fill=INK_2, tracking=-0.075))
    return "\n".join(s)

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
        s.append(T(cx + 28, FOOTER_TOP + 30, lbl, font=SF_MONO, size=13, weight=700,
                   fill=INK_3, tracking=2.34))
        s.append(T(cx + 28, FOOTER_TOP + 64, fig, font=SF_DISPLAY, size=32, weight=800,
                   fill=color, tracking=-0.704))
    return "\n".join(s)

def wrap_svg(body):
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
{arrow_defs()}
{R(0, 0, W, H, fill=PAPER)}
{body}
</svg>
'''

# ===== ILLUSTRATION PRIMITIVES (kept from v2, simplified) =====
def ob_row(x, y, w, h, price_label, price_val, side="bid", strike=False):
    fill = BLUE if side == "bid" else (RED if side == "offer" else INK_3)
    s = [R(x, y, w, h, fill=fill, rx=8, opacity=0.92)]
    s.append(T(x + 16, y + h//2 + 5, price_label, font=SF_MONO, size=13, weight=700,
               fill=PAPER, opacity=0.85))
    s.append(T(x + w - 16, y + h//2 + 5, price_val, font=SF_MONO, size=14, weight=800,
               fill=PAPER, anchor="end"))
    if strike:
        s.append(L(x + 14, y + h//2, x + w - 14, y + h//2, stroke=PAPER, w=2))
    return "\n".join(s)

def orderbook(cx, cy, *, offer, bid, offer_strike=False, bid_strike=False, note=None):
    w, h = 320, 48
    s = []
    s.append(ob_row(cx - w//2, cy - h - 4, w, h, "OFFER", offer, side="offer", strike=offer_strike))
    s.append(ob_row(cx - w//2, cy + 4, w, h, "BID", bid, side="bid", strike=bid_strike))
    if note:
        s.append(T(cx, cy + h + 40, note, font=SF_MONO, size=13, weight=600,
                   fill=INK_3, anchor="middle", tracking=0.52))
    return "\n".join(s)

def big_stat(cx, cy, value, *, color=INK, label_top=None, label_bot=None, value_size=72):
    s = []
    if label_top:
        s.append(T(cx, cy - 48, label_top, font=SF_MONO, size=13, weight=700,
                   fill=INK_3, anchor="middle", tracking=2.34))
    s.append(T(cx, cy + 22, value, font=SF_DISPLAY, size=value_size, weight=800,
               fill=color, anchor="middle", tracking=value_size * -0.022))
    if label_bot:
        s.append(T(cx, cy + 60, label_bot, font=SF_TEXT, size=15, weight=500,
                   fill=INK_3, anchor="middle", tracking=-0.075))
    return "\n".join(s)

def price_chart(x, y, w, h, path_d, *, hlines=None, dots=None, labels=None):
    s = [R(x, y, w, h, fill=PAPER, stroke=RULE_2, rx=10)]
    for hl in (hlines or []):
        ly, label_txt = hl
        s.append(L(x + 8, ly, x + w - 8, ly, stroke=RULE_2, w=1, dash="3 3"))
        if label_txt:
            s.append(T(x + w - 10, ly - 6, label_txt, font=SF_MONO, size=12, weight=600,
                       fill=INK_3, anchor="end", tracking=0.48))
    s.append(PATH(path_d, stroke=INK, w=2))
    for d in (dots or []):
        dx, dy, color = d
        s.append(CIRC(dx, dy, 5, fill=color))
    for lbl in (labels or []):
        lx, ly, txt, color, anchor = lbl
        s.append(T(lx, ly, txt, font=SF_MONO, size=12, weight=700,
                   fill=color, anchor=anchor, tracking=0.48))
    return "\n".join(s)

# =====================================================
# MECHANISM 01 — TOXIC-FLOW MARKET MAKING
# =====================================================
def build_01_toxic_flow():
    body = [
        header("EXTRACTION 01 · THE WIDEN",
               "Quote tight.", "Pay the cleanup.",
               "The spread you saw was a probe. The spread that mattered was the one after you filled."),
        hero(
            portrait_name="peng_zhao",
            quote="We have positive beta from technology — that is the only edge that matters in our business.",
            attrib_name="Peng Zhao",
            attrib_title="CEO, Citadel Securities",
            attrib_source="citadelsecurities.com",
            context="Citadel Securities runs the largest U.S. wholesale market-making operation, internalising roughly a third of retail equity orders. A quote that looks tight to the trader is the entry price of the round trip the firm has already modelled.",
        ),
    ]
    def f01(w, h):
        return orderbook(w//2, h//2, offer="$100.05", bid="$99.95", note="spread $0.10")
    body.append(step_frame(0, 0, "01", "Tight quote posted", f01,
                           "Two-sided market posted at the inside. Looks attractive to a retail taker."))
    def f02(w, h):
        s = [orderbook(w//2, h//2, offer="$100.05", bid="$99.95", note="incoming market buy")]
        s.append(PATH(f"M {w - 14} {h//2 - 28} L {w//2 + 170} {h//2 - 28}",
                      stroke=RED, w=2.4, marker_end="arrRed"))
        s.append(T(w - 14, h//2 - 44, "TAKER", font=SF_MONO, size=12, weight=700,
                   fill=RED, anchor="end", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(1, 0, "02", "A taker arrives", f02,
                           "Market buy enters at the offer. The fill itself is the information."))
    def f03(w, h):
        s = [orderbook(w//2, h//2, offer="$100.05", bid="$99.95", note="filled at the offer")]
        s.append(CIRC(w//2 + 178, h//2 - 28, 14, fill=GREEN))
        s.append(T(w//2 + 178, h//2 - 23, "✓", font=SF_TEXT, size=18, weight=800,
                   fill=PAPER, anchor="middle"))
        return "\n".join(s)
    body.append(step_frame(2, 0, "03", "Direction inferred", f03,
                           "Fill at the offer establishes the taker is long. The MM has the side."))
    def f04(w, h):
        return orderbook(w//2, h//2, offer="$100.05", bid="$99.95",
                         offer_strike=True, bid_strike=True, note="both quotes pulled · <50 ms")
    body.append(step_frame(0, 1, "04", "Quotes pulled", f04,
                           "Within fifty milliseconds, both original quotes are cancelled."))
    def f05(w, h):
        return orderbook(w//2, h//2, offer="$100.10", bid="$99.85", note="new spread $0.25")
    body.append(step_frame(1, 1, "05", "Spread widens", f05,
                           "New quote: bid drops ten cents, offer climbs five. Exit pre-priced."))
    def f06(w, h):
        return big_stat(w//2, h//2 + 10, "+$0.20", color=GREEN,
                        label_top="MM CAPTURED, PER SHARE", label_bot="zero inventory risk")
    body.append(step_frame(2, 1, "06", "The cleanup", f06,
                           "Round-trip cost is twenty cents per share. Inventory net zero."))
    body.append(economics("OPERATOR SPEND", "~$710K/yr", "ANNUAL TAKE", "$2–5M/yr"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 02 — STOP & LIQUIDATION HUNTING
# =====================================================
def build_02_stop_hunting():
    body = [
        header("EXTRACTION 02 · THE WICK",
               "Your support", "is their menu.",
               "Stops cluster at obvious levels. Depth-of-book makes the menu legible to one side only."),
        hero(
            portrait_name="ken_griffin",
            quote="Markets are an extraordinarily competitive arena. The information advantage is the entire game.",
            attrib_name="Kenneth C. Griffin",
            attrib_title="Founder & CEO, Citadel LLC",
            attrib_source="citadel.com",
            context="Citadel's hedge fund and securities arms together see depth retail cannot. A wall of 14,000 stops at $99.50 reads to the firm as a coordinated exit they may convert into a forced auction at any time of their choosing.",
        ),
    ]
    def f01(w, h):
        chart = price_chart(0, 0, w, h - 20,
            f"M 0 {(h-20)*0.36} L {w*0.2} {(h-20)*0.32} L {w*0.4} {(h-20)*0.38} L {w*0.6} {(h-20)*0.34} L {w*0.8} {(h-20)*0.40} L {w} {(h-20)*0.36}",
            hlines=[((h-20)*0.78, "$99.50 'support'")])
        n = (w - 60) // 24
        ticks = "\n".join(
            f'<line x1="{20 + i*24}" y1="{(h-20)*0.76 - 2}" x2="{30 + i*24}" y2="{(h-20)*0.84}" stroke="{RED}" stroke-width="1.5"/>'
            for i in range(min(14, n))
        )
        return chart + "\n" + ticks
    body.append(step_frame(0, 0, "01", "Stops cluster at support", f01,
                           "Retail puts stop-losses where the chart looks like support."))
    def f02(w, h):
        return (R(0, 0, w, h, fill=INK, rx=12) + "\n" +
                T(w//2, 38, "LEVEL 3 DEPTH FEED", font=SF_MONO, size=13, weight=700,
                  fill=BLUE_T, anchor="middle", tracking=2.34) + "\n" +
                T(w//2, h//2 + 12, "14,028", font=SF_DISPLAY, size=88, weight=800,
                  fill=PAPER, anchor="middle", tracking=-1.936) + "\n" +
                T(w//2, h//2 + 48, "working stop-orders at $99.50", font=SF_TEXT, size=15,
                  weight=500, fill=PAPER, anchor="middle", tracking=-0.075, opacity=0.85) + "\n" +
                T(w//2, h - 28, "$200K / year / venue · retail does not pay this", font=SF_MONO,
                  size=12, weight=600, fill=BLUE_T, anchor="middle", tracking=0.48, opacity=0.7))
    body.append(step_frame(1, 0, "02", "Depth makes them legible", f02,
                           "Level 3 market data shows every working order. Retail buys the chart, not the depth."))
    def f03(w, h):
        return price_chart(0, 0, w, h - 20,
            f"M 0 {(h-20)*0.30} L {w*0.2} {(h-20)*0.36} L {w*0.4} {(h-20)*0.46} L {w*0.6} {(h-20)*0.62} L {w*0.8} {(h-20)*0.74} L {w} {(h-20)*0.84}",
            hlines=[((h-20)*0.86, "$99.50")],
            labels=[(w*0.35, (h-20)*0.52, "MM SELLS $5M", RED, "middle")])
    body.append(step_frame(2, 0, "03", "The push", f03,
                           "Five million sold into a thin book. Price slides toward the cluster."))
    def f04(w, h):
        return price_chart(0, 0, w, h - 20,
            f"M 0 {(h-20)*0.32} L {w*0.2} {(h-20)*0.38} L {w*0.4} {(h-20)*0.50} L {w*0.5} {(h-20)*0.94} L {w*0.6} {(h-20)*0.50} L {w*0.8} {(h-20)*0.36} L {w} {(h-20)*0.30}",
            hlines=[((h-20)*0.84, "$99.50")],
            dots=[(w*0.5, (h-20)*0.94, RED)],
            labels=[(w*0.5, (h-20)*0.94 - 16, "$99.45", RED, "middle")])
    body.append(step_frame(0, 1, "04", "Cascade triggers", f04,
                           "Price touches $99.45. The stop cluster fires as a synchronised market-sell."))
    def f05(w, h):
        return big_stat(w//2, h//2, "$20M", color=RED,
                        label_top="FORCED SELLS ADDED",
                        label_bot="cascade overshoots to $98.20",
                        value_size=84)
    body.append(step_frame(1, 1, "05", "Forced auction", f05,
                           "Twenty million of unwanted sells. Price overshoots to $98.20."))
    def f06(w, h):
        return price_chart(0, 0, w, h - 20,
            f"M 0 {(h-20)*0.86} L {w*0.2} {(h-20)*0.78} L {w*0.4} {(h-20)*0.62} L {w*0.6} {(h-20)*0.42} L {w*0.8} {(h-20)*0.26} L {w} {(h-20)*0.18}",
            hlines=[((h-20)*0.18, "$101")],
            labels=[(w*0.18, (h-20)*0.82, "COVER $98.20", GREEN, "start"),
                    (w*0.82, (h-20)*0.14, "RESELL $101", GREEN, "end")])
    body.append(step_frame(2, 1, "06", "Cover and resell", f06,
                           "MM covers the short low and resells into the recovery."))
    body.append(economics("OPERATOR SPEND", "~$350K/yr", "PER CASCADE", "$50K–500K"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 03 — CROSS-VENUE ARBITRAGE
# =====================================================
def build_03_cross_venue():
    body = [
        header("EXTRACTION 03 · THE LAG",
               "Eighty milliseconds", "of light.",
               "Same asset. Two venues. The arbitrageur reads both mailboxes and writes one cheque."),
        hero(
            portrait_name="vincent_viola",
            quote="The whole edifice is built on the fact that two prices for the same thing cannot survive in front of a fast firm.",
            attrib_name="Vincent Viola",
            attrib_title="Founder, Virtu Financial",
            attrib_source="The New York Times",
            context="Virtu's prospectus famously reported one losing trading day in 1,238. The reason is structural: a global cross-venue arbitrageur with microwave links between matching engines is not betting on direction — it is collecting the latency tax that any two-venue market mathematically generates.",
        ),
    ]

    def venue_card(x, y, w, h, name, price, *, jumped=False, stale=False):
        s = [R(x, y, w, h, fill=PAPER, stroke=RULE_2, rx=12)]
        s.append(T(x + 16, y + 28, name, font=SF_MONO, size=13, weight=700,
                   fill=INK_3, tracking=2.08))
        color = RED if jumped else (INK_3 if stale else INK)
        s.append(T(x + w - 16, y + h - 20, price, font=SF_DISPLAY, size=30, weight=800,
                   fill=color, anchor="end", tracking=-0.66))
        if jumped:
            s.append(T(x + w - 16, y + 28, "↑ jumped", font=SF_MONO, size=12, weight=700,
                       fill=RED, anchor="end"))
        if stale:
            s.append(T(x + w - 16, y + 28, "stale", font=SF_MONO, size=12, weight=700,
                       fill=INK_3, anchor="end"))
        return "\n".join(s)

    def arb_actor(cx, cy, *, hot=False):
        r = 34
        fill = BLUE if hot else PAPER
        s = [CIRC(cx, cy, r, fill=fill, stroke=BLUE, w=2)]
        s.append(T(cx, cy - 2, "ARB", font=SF_MONO, size=13, weight=800,
                   fill=PAPER if hot else BLUE, anchor="middle", tracking=1.04))
        s.append(T(cx, cy + 16, "co-lo", font=SF_MONO, size=10, weight=600,
                   fill=PAPER if hot else BLUE, anchor="middle", opacity=0.85))
        return "\n".join(s)

    def f01(w, h):
        return (venue_card(0, 20, w//2 - 14, 96, "BINANCE", "$4,000")
                + "\n" + venue_card(w//2 + 14, 20, w//2 - 14, 96, "COINBASE", "$4,000")
                + "\n" + arb_actor(w//2, h - 60)
                + "\n" + T(w//2, h - 14, "watching · idle", font=SF_MONO, size=12,
                           weight=600, fill=INK_3, anchor="middle", tracking=0.48))
    body.append(step_frame(0, 0, "01", "Equilibrium", f01,
                           "Both venues quote ETH at $4,000. The arbitrageur is idle."))

    def f02(w, h):
        s = [venue_card(0, 20, w//2 - 14, 96, "BINANCE", "$4,005", jumped=True)]
        s.append(venue_card(w//2 + 14, 20, w//2 - 14, 96, "COINBASE", "$4,000"))
        s.append(T(w*0.18, 140, "WHALE BUY", font=SF_MONO, size=12, weight=700,
                   fill=RED, tracking=0.48))
        s.append(PATH(f"M {w*0.18} 148 L {w*0.18} 168 L {w*0.25} 168",
                      stroke=RED, w=2, marker_end="arrRed"))
        s.append(arb_actor(w//2, h - 60))
        s.append(T(w//2, h - 14, "sees the print at t=0", font=SF_MONO, size=12,
                   weight=600, fill=INK_3, anchor="middle", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(1, 0, "02", "Binance prints first", f02,
                           "A whale buy hits Binance. New print: $4,005. Coinbase hasn't seen it."))

    def f03(w, h):
        s = [venue_card(0, 20, w//2 - 14, 96, "BINANCE", "$4,005", jumped=True)]
        s.append(venue_card(w//2 + 14, 20, w//2 - 14, 96, "COINBASE", "$4,000", stale=True))
        s.append(R(0, 132, w, 32, fill=BLUE, opacity=0.10, rx=6))
        s.append(T(w//2, 153, "LAG WINDOW · 80 ms", font=SF_MONO, size=13, weight=700,
                   fill=BLUE, anchor="middle", tracking=0.52))
        s.append(arb_actor(w//2, h - 70, hot=True))
        return "\n".join(s)
    body.append(step_frame(2, 0, "03", "The lag window opens", f03,
                           "For eighty milliseconds, only the co-located firm sees both prices."))

    def f04(w, h):
        s = [venue_card(0, 20, w//2 - 14, 96, "BINANCE", "$4,005", jumped=True)]
        s.append(venue_card(w//2 + 14, 20, w//2 - 14, 96, "COINBASE", "$4,000", stale=True))
        s.append(arb_actor(w//2, h - 70, hot=True))
        s.append(PATH(f"M {w//2 + 30} {h - 90} L {w*0.78} 100",
                      stroke=GREEN, w=2.4, marker_end="arrGreen"))
        s.append(T(w*0.74, h*0.62, "BUY $200K", font=SF_MONO, size=13, weight=700,
                   fill=GREEN, anchor="middle", tracking=0.52))
        s.append(T(w*0.74, h*0.68, "@ $4,000", font=SF_MONO, size=12, weight=600,
                   fill=GREEN, anchor="middle"))
        return "\n".join(s)
    body.append(step_frame(0, 1, "04", "Buy the stale side", f04,
                           "Arbitrageur buys $200K of ETH on Coinbase at the stale $4,000 price."))

    def f05(w, h):
        s = [venue_card(0, 20, w//2 - 14, 96, "BINANCE", "$4,005", jumped=True)]
        s.append(venue_card(w//2 + 14, 20, w//2 - 14, 96, "COINBASE", "$4,000", stale=True))
        s.append(arb_actor(w//2, h - 70, hot=True))
        s.append(PATH(f"M {w//2 - 30} {h - 90} L {w*0.22} 100",
                      stroke=RED, w=2.4, marker_end="arrRed"))
        s.append(T(w*0.26, h*0.62, "SELL $200K", font=SF_MONO, size=13, weight=700,
                   fill=RED, anchor="middle", tracking=0.52))
        s.append(T(w*0.26, h*0.68, "@ $4,005", font=SF_MONO, size=12, weight=600,
                   fill=RED, anchor="middle"))
        return "\n".join(s)
    body.append(step_frame(1, 1, "05", "Hedge the fast side", f05,
                           "Simultaneously sells $200K on Binance at $4,005. Net inventory: zero."))

    def f06(w, h):
        return big_stat(w//2, h//2 + 10, "+$5", color=GREEN,
                        label_top="PER ETH ARBITRAGED",
                        label_bot="risk-free · repeats hundreds × day",
                        value_size=88)
    body.append(step_frame(2, 1, "06", "Receipt", f06,
                           "Coinbase catches up at t+80 ms. Five dollars per unit is banked."))

    body.append(economics("OPERATOR SPEND", "~$400K/yr", "ANNUAL TAKE", "$500K–2M"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 04 — LATENCY ARBITRAGE
# =====================================================
def build_04_latency():
    body = [
        header("EXTRACTION 04 · THE TIME BAR",
               "The trade was over", "before the click.",
               "You click in 200 milliseconds. They executed 250,000 trades in that window."),
        hero(
            portrait_name="doug_cifu",
            quote="Speed used to be the moat. Now speed is the floor — you cannot trade without it.",
            attrib_name="Douglas Cifu",
            attrib_title="CEO, Virtu Financial (2013–2025)",
            attrib_source="Virtu earnings call, 2022",
            context="Virtu's continuous-trading model depends on responding to a price-leader print in microseconds. The famous 'one losing day in 1,238' was not luck; it was the structural extraction of latency rent from every venue too slow to update simultaneously.",
        ),
    ]
    def f01(w, h):
        s = [T(w//2, 22, "CME · ES FUTURES", font=SF_MONO, size=13, weight=700,
               fill=INK_3, anchor="middle", tracking=2.34)]
        s.append(L(0, h*0.60, w, h*0.60, stroke=RULE_2))
        s.append(PATH(f"M 0 {h*0.60} L {w*0.45} {h*0.60} L {w*0.5} {h*0.32} L {w} {h*0.32}",
                      stroke=INK, w=2))
        s.append(CIRC(w*0.5, h*0.32, 6, fill=BLUE))
        s.append(T(w*0.5, h*0.26, "+0.3%", font=SF_MONO, size=13, weight=700,
                   fill=BLUE, anchor="middle"))
        s.append(T(w*0.5, h*0.78, "t = 0", font=SF_MONO, size=12, weight=600,
                   fill=INK_3, anchor="middle", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(0, 0, "01", "Leader prints first", f01,
                           "ES futures move on a macro headline. ES is the leader, ETFs are followers."))

    def f02(w, h):
        s = [T(w//2, 22, "ARCA · SPY ETF", font=SF_MONO, size=13, weight=700,
               fill=INK_3, anchor="middle", tracking=2.34)]
        s.append(L(0, h*0.50, w, h*0.50, stroke=RULE_2))
        s.append(PATH(f"M 0 {h*0.50} L {w} {h*0.50}", stroke=INK_3, w=2, dash="4 3"))
        s.append(T(w//2, h*0.34, "QUOTE STALE", font=SF_MONO, size=15, weight=800,
                   fill=RED, anchor="middle", tracking=2.7))
        s.append(T(w//2, h*0.78, "stale window: 50–500 μs", font=SF_MONO, size=12,
                   weight=600, fill=INK_3, anchor="middle", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(1, 0, "02", "Follower goes stale", f02,
                           "The correlated ETF hasn't updated yet. For microseconds, the price is wrong."))

    def f03(w, h):
        s = []
        bars = [
            ("FPGA: 810 ns", 8, GREEN),
            ("BANK EXEC: 5 ms", 18, BLUE),
            ("BROWSER RPC: 50 ms", 180, INK_3),
            ("RETAIL CLICK: 200 ms", w - 20, RED),
        ]
        s.append(L(10, h - 32, w - 10, h - 32, stroke=RULE_2))
        s.append(T(10, h - 12, "0", font=SF_MONO, size=12, weight=600, fill=INK_3))
        s.append(T(w - 10, h - 12, "200 ms", font=SF_MONO, size=12, weight=600,
                   fill=INK_3, anchor="end"))
        bar_h = 28; gap = 14
        for i, (label, bw, color) in enumerate(bars):
            by = 18 + i * (bar_h + gap)
            s.append(R(10, by, max(bw, 8), bar_h, fill=color, rx=4))
            if bw < 120:
                s.append(T(10 + max(bw, 8) + 12, by + bar_h//2 + 5, label, font=SF_MONO,
                           size=12, weight=700, fill=INK))
            else:
                s.append(T(22, by + bar_h//2 + 5, label, font=SF_MONO, size=12,
                           weight=700, fill=PAPER))
        return "\n".join(s)
    body.append(step_frame(2, 0, "03", "FPGA fires in 810 ns", f03,
                           "An FPGA converts the ES print into a SPY order instantly. Retail click: 200 ms."))

    def f04(w, h):
        return orderbook(w//2, h//2, offer="$500.20", bid="$500.10",
                         offer_strike=True, bid_strike=False,
                         note="slow MM's stale offer taken before they could pull it")
    body.append(step_frame(0, 1, "04", "Slow MM picked off", f04,
                           "A market maker who hasn't updated has their stale offer taken."))

    def f05(w, h):
        s = [T(w//2, 22, "ARCA · SPY ETF", font=SF_MONO, size=13, weight=700,
               fill=INK_3, anchor="middle", tracking=2.34)]
        s.append(L(0, h*0.60, w, h*0.60, stroke=RULE_2))
        s.append(PATH(f"M 0 {h*0.60} L {w*0.40} {h*0.60} L {w*0.45} {h*0.32} L {w} {h*0.32}",
                      stroke=INK, w=2))
        s.append(CIRC(w*0.45, h*0.32, 5, fill=INK_3))
        s.append(T(w*0.45, h*0.26, "t + 500 μs", font=SF_MONO, size=12, weight=600,
                   fill=INK_3, anchor="middle", tracking=0.48))
        s.append(T(w//2, h*0.85, "too late on this print", font=SF_MONO, size=12,
                   weight=600, fill=INK_3, anchor="middle", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(1, 1, "05", "Follower catches up", f05,
                           "Five hundred microseconds later the quote updates. The arbitrage closes."))

    def f06(w, h):
        return big_stat(w//2, h//2 + 10, "$5B", color=BLUE,
                        label_top="GLOBAL LATENCY TAX / YEAR",
                        label_bot="Aquilina · Budish · O'Neill · QJE 2022",
                        value_size=88)
    body.append(step_frame(2, 1, "06", "The accumulator", f06,
                           "Per trade: pennies. Across markets: $5B/yr. 17% of the cost of liquidity."))

    body.append(economics("OPERATOR SPEND", "~$650K/yr", "ANNUAL TAKE", "$300K–1.5M"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 05 — INFORMATION EDGE
# =====================================================
def build_05_information():
    body = [
        header("EXTRACTION 05 · THE CALENDAR",
               "Earnings are old news", "to ten people.",
               "By the time the press release prints, the position has already paid for the satellite."),
        hero(
            portrait_name="steve_cohen",
            quote="It's the most competitive business on the planet. Information arbitrage is the entire game.",
            attrib_name="Steven A. Cohen",
            attrib_title="Founder, Point72 Asset Management",
            attrib_source="Forbes profile, 2024",
            context="Cohen's SAC Capital paid a $1.8B settlement for insider trading in 2013; the firm relaunched as Point72 and now spends nine figures a year on alternative data. The legal definition of 'inside' moved. The economic definition did not.",
        ),
    ]
    def panel(title, *, value, value_color=INK, sub=None, footnote=None, dark=False):
        bg = INK if dark else PAPER_2
        text_main = PAPER if dark else INK
        text_sub = "rgba(255,255,255,0.7)" if dark else INK_3
        text_foot = "rgba(255,255,255,0.5)" if dark else INK_3
        def fn(w, h):
            s = [R(0, 0, w, h, fill=bg, stroke=RULE_2 if not dark else INK, rx=10)]
            s.append(T(w//2, 36, title, font=SF_MONO, size=13, weight=700,
                       fill=text_sub, anchor="middle", tracking=2.34))
            s.append(T(w//2, h//2 + 16, value, font=SF_DISPLAY, size=56, weight=800,
                       fill=value_color, anchor="middle", tracking=-1.232))
            if sub:
                s.append(T(w//2, h//2 + 52, sub, font=SF_TEXT, size=15, weight=500,
                           fill=text_main, anchor="middle", tracking=-0.075))
            if footnote:
                s.append(T(w//2, h - 24, footnote, font=SF_MONO, size=12, weight=600,
                           fill=text_foot, anchor="middle", tracking=0.48))
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
        return (R(0, 0, w, h, fill=PAPER_2, stroke=RULE_2, rx=10) + "\n" +
                T(w//2, 36, "MAR · EXPERT NETWORK", font=SF_MONO, size=13, weight=700,
                  fill=INK_3, anchor="middle", tracking=2.34) + "\n" +
                T(w//2, h//2 + 10, "“Tooling capacity confirmed.”",
                  font=NY_SERIF, size=22, weight=500, fill=INK, anchor="middle",
                  italic=True, tracking=-0.35) + "\n" +
                T(w//2, h//2 + 42, "— ex-Tesla supply-chain VP", font=SF_TEXT, size=15,
                  weight=500, fill=INK_2, anchor="middle", tracking=-0.075) + "\n" +
                T(w//2, h - 24, "GLG · $150K/yr", font=SF_MONO, size=12, weight=600,
                  fill=INK_3, anchor="middle", tracking=0.48))
    body.append(step_frame(2, 0, "03", "Confirmed by an insider", f03,
                           "An expert-network call with a former supply-chain VP confirms the read."))
    def f04(w, h):
        return (R(0, 0, w, h, fill=BLUE_T, stroke=BLUE, rx=10) + "\n" +
                T(w//2, 36, "LATE MAR · POSITION OPENS", font=SF_MONO, size=13, weight=700,
                  fill=BLUE, anchor="middle", tracking=2.34) + "\n" +
                T(w//2, h//2 + 18, "LONG CALLS", font=SF_DISPLAY, size=48, weight=800,
                  fill=BLUE, anchor="middle", tracking=-1.056) + "\n" +
                T(w//2, h//2 + 54, "positioned before consensus updates", font=SF_TEXT, size=15,
                  weight=500, fill=INK_2, anchor="middle", tracking=-0.075) + "\n" +
                T(w//2, h - 24, "three independent signals aligned", font=SF_MONO, size=12,
                  weight=600, fill=INK_3, anchor="middle", tracking=0.48))
    body.append(step_frame(0, 1, "04", "Position opens", f04,
                           "Three independent signals align. The fund opens a directional position."))
    def f05(w, h):
        return (R(0, 0, w, h, fill=PAPER, stroke=RULE_2, rx=10) + "\n" +
                T(w//2, 36, "APR · EARNINGS DAY", font=SF_MONO, size=13, weight=700,
                  fill=INK_3, anchor="middle", tracking=2.34) + "\n" +
                L(20, h*0.75, w-20, h*0.75, stroke=RULE_2) + "\n" +
                PATH(f"M 20 {h*0.65} L {w*0.3} {h*0.62} L {w*0.45} {h*0.66} L {w*0.55} {h*0.62} L {w*0.6} {h*0.30} L {w-20} {h*0.26}",
                     stroke=INK, w=2) + "\n" +
                CIRC(w*0.6, h*0.30, 6, fill=GREEN) + "\n" +
                T(w*0.6, h*0.22, "+8%", font=SF_MONO, size=15, weight=800,
                  fill=GREEN, anchor="middle") + "\n" +
                T(w//2, h - 24, "earnings beat printed", font=SF_MONO, size=12, weight=600,
                  fill=INK_3, anchor="middle", tracking=0.48))
    body.append(step_frame(1, 1, "05", "The print", f05,
                           "Tesla announces a beat. Stock jumps eight percent. The edge crystallises."))
    def f06(w, h):
        return (R(0, 0, w, h, fill=RED_T, stroke=RED, rx=10) + "\n" +
                T(w//2, 36, "APR · 4:01 PM", font=SF_MONO, size=13, weight=700,
                  fill=RED, anchor="middle", tracking=2.34) + "\n" +
                T(w//2, h//2 + 4, "TESLA BEATS Q1", font=SF_DISPLAY, size=32, weight=800,
                  fill=INK, anchor="middle", tracking=-0.704) + "\n" +
                T(w//2, h//2 + 36, "— CNBC headline", font=SF_TEXT, size=15, weight=500,
                  fill=INK_2, anchor="middle", tracking=-0.075) + "\n" +
                T(w//2, h - 24, "fund has already exited at the open",
                  font=SF_MONO, size=12, weight=600, fill=INK_3, anchor="middle", tracking=0.48))
    body.append(step_frame(2, 1, "06", "Retail reads the headline", f06,
                           "Four-oh-one p.m. The fund has already exited. Retail is buying the top."))
    body.append(economics("OPERATOR SPEND", "~$714K/yr", "ANNUAL TAKE", "$500K–2M"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 06 — SPOOFING (no portrait — use named firm + fine)
# =====================================================
def build_06_spoofing():
    body = [
        header("EXTRACTION 06 · THE WALL THAT WASN'T",
               "Build a wall.", "Cancel it.",
               "The chart is not a record. The chart is a stage. JPMorgan paid $920M for the run."),
        # Hero: no portrait — instead a powerful stat card
        # We replicate the hero block dimensions but with a different inner.
    ]
    # Custom hero — stat card on the left, quote on the right
    s = []
    s.append(R(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE, fill=INK, rx=14))
    s.append(T(PORTRAIT_X + PORTRAIT_SIZE//2, PORTRAIT_Y + 60, "U.S. v. JPMORGAN",
               font=SF_MONO, size=15, weight=700, fill=BLUE_T, anchor="middle", tracking=2.7))
    s.append(T(PORTRAIT_X + PORTRAIT_SIZE//2, PORTRAIT_Y + 220, "$920M",
               font=SF_DISPLAY, size=140, weight=800, fill=PAPER, anchor="middle", tracking=-3.08))
    s.append(T(PORTRAIT_X + PORTRAIT_SIZE//2, PORTRAIT_Y + 270, "single spoofing fine",
               font=SF_TEXT, size=22, weight=500, fill=PAPER, anchor="middle",
               tracking=-0.264, opacity=0.85))
    s.append(T(PORTRAIT_X + PORTRAIT_SIZE//2, PORTRAIT_Y + 360, "2020 · DOJ + CFTC + SEC",
               font=SF_MONO, size=14, weight=700, fill=BLUE_T, anchor="middle",
               tracking=2.52, opacity=0.85))
    s.append(T(PORTRAIT_X + PORTRAIT_SIZE//2, PORTRAIT_Y + PORTRAIT_SIZE - 60,
               "eight years of spoofing, two markets, fifteen traders",
               font=SF_TEXT, size=16, weight=500, fill=PAPER, anchor="middle",
               tracking=-0.16, opacity=0.7))
    # Right column quote
    rx = PORTRAIT_X + PORTRAIT_SIZE + 80
    s.append(T(rx, PORTRAIT_Y + 40, "“", font=NY_SERIF, size=120, weight=400, fill=BLUE))
    q_lines = wrap_text(
        "We deeply regret the conduct of certain former employees who placed orders they did not intend to fill.",
        width=44)
    q_y = PORTRAIT_Y + 90
    for i, line in enumerate(q_lines[:5]):
        s.append(T(rx + 60, q_y + i * 50, line, font=NY_SERIF, size=36, weight=500,
                   fill=INK, italic=True, tracking=-0.576))
    attr_y = q_y + len(q_lines[:5]) * 50 + 36
    s.append(T(rx + 60, attr_y, "JPMorgan Chase", font=SF_TEXT, size=17, weight=700,
               fill=INK, tracking=-0.374))
    s.append(T(rx + 60, attr_y + 24, "official statement · DOJ press release · September 2020",
               font=SF_TEXT, size=15, weight=500, fill=INK_3, tracking=-0.075))
    ctx_lines = wrap_text(
        "The firm placed and cancelled thousands of orders in precious metals and Treasuries to create false impressions of supply and demand. Eight years of practice. One press release of contrition.",
        width=58)
    ctx_y = attr_y + 70
    for i, line in enumerate(ctx_lines[:4]):
        s.append(T(rx + 60, ctx_y + i * 28, line, font=SF_TEXT, size=18, weight=400,
                   fill=INK_2, tracking=-0.18))
    body.append("\n".join(s))

    # Steps
    def thin_book(x0, y0, w, h, with_wall=False, wall_cancelled=False, fill_retail=False):
        s = []
        for i in range(3):
            bw = 36 + i * 12
            s.append(R(x0, y0 + i * 26, bw, 18, fill=RED, opacity=0.55, rx=3))
        s.append(L(x0, y0 + 82, x0 + w, y0 + 82, stroke=RULE_2, dash="2 3"))
        if with_wall:
            wall_w = w - 24
            if wall_cancelled:
                s.append(R(x0, y0 + 92, wall_w, 24, fill="none", stroke=BLUE,
                           stroke_w=1.5, opacity=0.6))
                s.append(T(x0 + wall_w//2, y0 + 110, "CANCELLED",
                           font=SF_MONO, size=12, weight=700, fill=INK_3, anchor="middle",
                           tracking=0.96))
            else:
                s.append(R(x0, y0 + 92, wall_w, 24, fill=BLUE, rx=3))
                s.append(T(x0 + wall_w//2, y0 + 110, "$5M @ $99.00",
                           font=SF_MONO, size=12, weight=700, fill=PAPER, anchor="middle",
                           tracking=0.72))
            for i in range(2):
                bw = 28 + i * 8
                s.append(R(x0, y0 + 124 + i * 24, bw, 18, fill=BLUE, opacity=0.4, rx=3))
        else:
            for i in range(3):
                bw = 28 + i * 8
                s.append(R(x0, y0 + 92 + i * 24, bw, 18, fill=BLUE, opacity=0.55, rx=3))
        if fill_retail:
            s.append(CIRC(x0 + w - 20, y0 + 10, 14, fill=GREEN))
            s.append(T(x0 + w - 20, y0 + 16, "✓", font=SF_TEXT, size=16, weight=800,
                       fill=PAPER, anchor="middle"))
        return "\n".join(s)

    def f01(w, h):
        return (thin_book(20, 20, w - 40, h - 40, with_wall=False)
                + "\n" + T(w - 20, 36, "thin book", font=SF_MONO, size=12, weight=700,
                           fill=INK_3, anchor="end", tracking=0.72)
                + "\n" + T(w//2, h - 12, "MM has private sell intent — invisible",
                           font=SF_MONO, size=12, weight=600, fill=INK_3, anchor="middle",
                           tracking=0.48))
    body.append(step_frame(0, 0, "01", "Thin book, hidden intent", f01,
                           "Order book is thin. MM wants to sell at the highest visible price."))
    def f02(w, h):
        return (thin_book(20, 20, w - 40, h - 40, with_wall=True)
                + "\n" + T(w//2, h - 12, "the chart now reads 'strong support'",
                           font=SF_MONO, size=12, weight=600, fill=BLUE, anchor="middle",
                           tracking=0.48))
    body.append(step_frame(1, 0, "02", "The wall goes up", f02,
                           "MM posts $5M at $99. The chart reads it as serious conviction."))
    def f03(w, h):
        return price_chart(0, 10, w, h - 40,
            f"M 0 {(h-40)*0.5} L {w*0.2} {(h-40)*0.52} L {w*0.4} {(h-40)*0.58} L {w*0.6} {(h-40)*0.62} L {w*0.8} {(h-40)*0.66} L {w} {(h-40)*0.62}",
            hlines=[((h-40)*0.72, "$99.00 'support'")],
            labels=[(w//2, (h-40)*0.86, "retail decides to buy the dip", BLUE, "middle")])
    body.append(step_frame(2, 0, "03", "Retail reads support", f03,
                           "The wall is flagged as buy-side conviction. Retail buys the dip."))
    def f04(w, h):
        return (thin_book(20, 20, w - 40, h - 40, with_wall=True, fill_retail=True)
                + "\n" + T(w//2, h - 12, "retail buys at $99.05 from the MM's offer",
                           font=SF_MONO, size=12, weight=600, fill=INK_3, anchor="middle",
                           tracking=0.48))
    body.append(step_frame(0, 1, "04", "Retail fills the offer", f04,
                           "Convinced by the wall, retail crosses the spread and buys at $99.05."))
    def f05(w, h):
        return (thin_book(20, 20, w - 40, h - 40, with_wall=True, wall_cancelled=True)
                + "\n" + T(w//2, h - 12, "wall lifespan: 47 milliseconds total",
                           font=SF_MONO, size=12, weight=700, fill=RED, anchor="middle",
                           tracking=0.48))
    body.append(step_frame(1, 1, "05", "The wall disappears", f05,
                           "Forty-seven milliseconds after appearing, the wall is cancelled."))
    def f06(w, h):
        return price_chart(0, 10, w, h - 40,
            f"M 0 {(h-40)*0.25} L {w*0.2} {(h-40)*0.32} L {w*0.4} {(h-40)*0.46} L {w*0.6} {(h-40)*0.60} L {w*0.8} {(h-40)*0.72} L {w} {(h-40)*0.80}",
            hlines=[((h-40)*0.25, "$99.05 fill"), ((h-40)*0.82, "$98.85")],
            labels=[(w - 20, (h-40)*0.92, "+$0.20 / share to MM", GREEN, "end")])
    body.append(step_frame(2, 1, "06", "The drop", f06,
                           "With no real support, price falls to $98.85. The MM kept the round trip."))
    body.append(economics("MARGINAL SPEND", "~$0", "ANNUAL TAKE", "$200K–2M"))
    return wrap_svg("\n".join(body))


# =====================================================
# MECHANISM 07 — PAYMENT FOR ORDER FLOW
# =====================================================
def build_07_pfof():
    body = [
        header("EXTRACTION 07 · THE CASH ROUTE",
               "Your broker", "has three owners.",
               "Citadel paid $943M for nine months of retail order flow in 2024. They paid because it works."),
        hero(
            portrait_name="vlad_tenev",
            quote="I make more money by getting you to transact more. PFOF is inherently here to stay.",
            attrib_name="Vladimir Tenev",
            attrib_title="CEO, Robinhood Markets",
            attrib_source="CNBC, December 2023",
            context="Tenev's admission, on camera, is the cleanest statement of the conflict. The broker's revenue grows with the user's activity, because every order is sold to a wholesaler who pays cash for non-toxic flow. The trader gets 'price improvement.' The wholesaler gets the spread.",
        ),
    ]
    def party_box(x0, y0, w, h, *, name, sub, fill, color):
        s = [R(x0, y0, w, h, fill=fill, stroke=(BLUE if fill == BLUE else RULE_2), rx=12)]
        s.append(T(x0 + w//2, y0 + 30, name, font=SF_TEXT, size=15, weight=700,
                   fill=color, anchor="middle", tracking=-0.075))
        s.append(T(x0 + w//2, y0 + 54, sub, font=SF_MONO, size=11, weight=600,
                   fill=color, anchor="middle", opacity=0.75, tracking=0.44))
        return "\n".join(s)

    def f01(w, h):
        return (R(w*0.3, 30, w*0.4, h - 60, fill=PAPER_2, stroke=RULE_2, rx=20)
                + "\n" + T(w//2, 64, "ROBINHOOD", font=SF_MONO, size=12, weight=700,
                           fill=INK_3, anchor="middle", tracking=1.92)
                + "\n" + R(w*0.34, 96, w*0.32, 48, fill=GREEN, rx=10)
                + "\n" + T(w//2, 126, "BUY 100 AAPL", font=SF_TEXT, size=15, weight=700,
                           fill=PAPER, anchor="middle", tracking=-0.075)
                + "\n" + T(w//2, h - 78, "$17,200 order", font=SF_MONO, size=14, weight=700,
                           fill=INK, anchor="middle")
                + "\n" + T(w//2, h - 50, "click", font=SF_MONO, size=12, weight=600,
                           fill=INK_3, anchor="middle", tracking=0.48))
    body.append(step_frame(0, 0, "01", "Retail clicks Buy", f01,
                           "A retail trader places a market order through Robinhood."))

    def f02(w, h):
        bw = 110
        gap_x = (w - bw * 3) // 2
        s = [party_box(0, 30, bw, 88, name="RETAIL", sub="$17.2K", fill=PAPER, color=INK)]
        s.append(party_box(bw + gap_x, 30, bw, 88, name="BROKER", sub="Robinhood", fill=PAPER, color=INK))
        s.append(party_box(bw * 2 + gap_x * 2, 30, bw, 88, name="WHOLESALER", sub="Citadel", fill=BLUE, color=PAPER))
        s.append(PATH(f"M {bw + 4} 60 L {bw + gap_x - 4} 60", stroke=INK, w=1.8, marker_end="arrInk"))
        s.append(T(bw + gap_x//2, 50, "order", font=SF_MONO, size=12, weight=700,
                   fill=INK, anchor="middle", tracking=0.48))
        s.append(PATH(f"M {bw*2 + gap_x + 4} 60 L {bw*2 + gap_x*2 - 4} 60", stroke=INK, w=1.8, marker_end="arrInk"))
        s.append(T(bw*2 + gap_x + gap_x//2, 50, "rerouted", font=SF_MONO, size=12,
                   weight=700, fill=INK, anchor="middle", tracking=0.48))
        s.append(T(w//2, h - 18, "order does not reach a public exchange",
                   font=SF_MONO, size=12, weight=600, fill=INK_3, anchor="middle", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(1, 0, "02", "Routed to a wholesaler", f02,
                           "Robinhood does not send to NYSE. It routes to Citadel Securities."))

    def f03(w, h):
        bw = 110
        gap_x = (w - bw * 3) // 2
        s = [party_box(0, 30, bw, 88, name="RETAIL", sub="", fill=PAPER, color=INK)]
        s.append(party_box(bw + gap_x, 30, bw, 88, name="BROKER", sub="Robinhood", fill=PAPER, color=INK))
        s.append(party_box(bw * 2 + gap_x * 2, 30, bw, 88, name="WHOLESALER", sub="Citadel", fill=BLUE, color=PAPER))
        s.append(PATH(f"M {bw*2 + gap_x*2 - 4} 150 L {bw + gap_x + bw + 4} 150",
                      stroke=GREEN, w=2.2, marker_end="arrGreen"))
        s.append(T(bw + gap_x + bw//2 + gap_x//2, 170, "$1.30 PFOF",
                   font=SF_MONO, size=13, weight=800, fill=GREEN, anchor="middle", tracking=0.52))
        s.append(T(w//2, h - 14, "cash paid for access to the flow",
                   font=SF_MONO, size=12, weight=600, fill=INK_3, anchor="middle", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(2, 0, "03", "Cash to the broker", f03,
                           "Citadel pays Robinhood roughly $1.30 in cash — payment for order flow."))

    def f04(w, h):
        bw = 110
        gap_x = (w - bw * 3) // 2
        s = [party_box(0, 30, bw, 88, name="RETAIL", sub="", fill=PAPER, color=INK)]
        s.append(party_box(bw + gap_x, 30, bw, 88, name="BROKER", sub="", fill=PAPER, color=INK))
        s.append(party_box(bw * 2 + gap_x * 2, 30, bw, 88, name="WHOLESALER", sub="Citadel", fill=BLUE, color=PAPER))
        s.append(PATH(f"M {bw*2 + gap_x*2 - 4} 160 L {bw - 4} 160",
                      stroke=RED, w=2.2, marker_end="arrRed"))
        s.append(T(w//2, 180, "$0.20 'price improvement'",
                   font=SF_MONO, size=13, weight=800, fill=RED, anchor="middle", tracking=0.52))
        s.append(T(w//2, h - 14, "filled at NBBO midpoint",
                   font=SF_MONO, size=12, weight=600, fill=INK_3, anchor="middle", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(0, 1, "04", "Token improvement returns", f04,
                           "Citadel fills at NBBO midpoint and hands back $0.20 of 'price improvement.'"))

    def f05(w, h):
        s = [party_box(20, 30, w*0.36, 88, name="CITADEL", sub="long 100 AAPL", fill=BLUE, color=PAPER)]
        s.append(party_box(w - 20 - w*0.36, 30, w*0.36, 88, name="NYSE / ARCA",
                           sub="public venue", fill=INK, color=PAPER))
        s.append(PATH(f"M {20 + w*0.36 + 4} 74 L {w - 20 - w*0.36 - 4} 74",
                      stroke=INK, w=2, marker_end="arrInk"))
        s.append(T(w//2, 64, "hedge", font=SF_MONO, size=12, weight=700,
                   fill=INK, anchor="middle", tracking=0.48))
        s.append(T(w//2, h - 14, "offsetting trade at NBBO bid",
                   font=SF_MONO, size=12, weight=600, fill=INK_3, anchor="middle", tracking=0.48))
        return "\n".join(s)
    body.append(step_frame(1, 1, "05", "Citadel hedges in public", f05,
                           "On a real exchange, Citadel takes the offsetting position at the NBBO bid."))

    def f06(w, h):
        rows = [("Citadel kept", "+$3.50", GREEN),
                ("Robinhood kept", "+$1.10", BLUE),
                ("Retail 'improvement'", "+$0.20", RED)]
        s = [T(w//2, 28, "FINAL RECEIPT", font=SF_MONO, size=13, weight=700,
               fill=INK_3, anchor="middle", tracking=2.34)]
        for i, (label, val, color) in enumerate(rows):
            ry = 70 + i * 42
            s.append(T(12, ry, label, font=SF_TEXT, size=17, weight=600,
                       fill=INK, tracking=-0.085))
            s.append(T(w - 12, ry, val, font=SF_MONO, size=22, weight=800,
                       fill=color, anchor="end"))
        s.append(L(12, 210, w - 12, 210, stroke=RULE_2))
        s.append(T(12, 240, "Citadel · 9 mo of 2024", font=SF_TEXT, size=15,
                   weight=600, fill=INK, tracking=-0.075))
        s.append(T(w - 12, 240, "$943M paid", font=SF_MONO, size=18, weight=800,
                   fill=INK, anchor="end"))
        return "\n".join(s)
    body.append(step_frame(2, 1, "06", "Who paid whom", f06,
                           "Citadel kept $3.50. Robinhood kept $1.10. Retail subsidised both."))
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
