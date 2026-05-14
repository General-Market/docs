#!/usr/bin/env python3
"""Generate eleven Apple-style product diagrams for Block Trading.

Three groups:
  A — product primitives (3 cards)
  B — timeline (1 card)
  C — extraction neutralisation (7 cards, blocks vs perps)

Canvas: 1600 × 1100. Concept cards, not multi-step walkthroughs.

Sizing rules (Miro-tile readable, ~2× the previous scale):
  Eyebrow             — SF Mono 24, tracking +0.18em
  Title (display)     — SF Pro Display 110, tracking -0.022em
  Title (serif accent)— NY serif italic 110, tracking -0.016em
  Tagline             — SF Pro Text 36, tracking -0.022em
  In-diagram labels   — SF Mono 22-24
  In-diagram primary  — SF Pro Text 30-36
  Big stats           — SF Pro Display 130-160
  Footer prose        — SF Pro Text 24 (one line, ≤12 words)

Margins: 100 top, 80 bottom, 80 sides. Frames interior padding ≥40.
Nothing below 20px.
"""
import math
import pathlib
import textwrap

from generate_diagrams import (
    T, R, L, CIRC, PATH, arrow_defs, wrap_text,
    INK, INK_2, INK_3, INK_4, PAPER, PAPER_2, PAPER_3, RULE, RULE_2,
    BLUE, BLUE_T, RED, RED_T, GREEN, GREEN_T,
    SF_DISPLAY, SF_TEXT, SF_MONO, NY_SERIF,
)

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "diagrams" / "product"
OUT.mkdir(parents=True, exist_ok=True)

# ===== CANVAS =====
W, H = 1600, 1300

# ===== MARGINS =====
MARGIN_TOP = 100
MARGIN_BOTTOM = 80
MARGIN_SIDE = 80

# ===== HEADER ZONE =====
EYEBROW_Y = MARGIN_TOP                       # 100
TITLE_Y = MARGIN_TOP + 130                   # 230  (baseline of 110px title)

# ===== SUMMARY (plain-English explainer line(s)) =====
SUMMARY_Y = MARGIN_TOP + 250                 # 350  (first baseline)
SUMMARY_LINE_H = 38

# ===== DIAGRAM ZONE =====
DIAG_TOP = MARGIN_TOP + 340                  # 440
DIAG_BOTTOM = H - MARGIN_BOTTOM - 190        # 1030 (preserves 590px diagram height)
DIAG_LEFT = MARGIN_SIDE                      # 80
DIAG_RIGHT = W - MARGIN_SIDE                 # 1520
DIAG_W = DIAG_RIGHT - DIAG_LEFT              # 1440

# ===== BRIDGE CAPTION (mono "you've seen this before as …") =====
BRIDGE_Y = H - MARGIN_BOTTOM - 120           # 1100

# ===== PROSE FOOTER (Cioran closer) =====
PROSE_Y = H - MARGIN_BOTTOM                  # 1220

# ===== SIZES =====
TITLE_PX = 110
SUMMARY_PX = 26
EYEBROW_PX = 24
BRIDGE_PX = 20
PROSE_PX = 28


def header(eyebrow, hook_left, hook_right, summary):
    """Eyebrow + two-line title + plain-English summary (wrapped).

    Title uses display sans + NY serif italic blue. The fourth argument
    used to be the marketing tagline; it is now the novice-friendly
    summary, which can wrap to two lines.
    """
    s = []
    s.append(T(W // 2, EYEBROW_Y, eyebrow,
               font=SF_MONO, size=EYEBROW_PX, weight=700,
               fill=INK_3, anchor="middle", tracking=4.32))  # 24 * 0.18

    # Composite centred title. Approximations:
    #   110px SF Pro Display ≈ 50 px/char
    #   110px NY serif italic ≈ 46 px/char
    left_w = len(hook_left) * 50
    right_w = len(hook_right) * 46
    gap = 28
    total = left_w + right_w + gap
    left_end_x = (W - total) // 2 + left_w
    right_start_x = left_end_x + gap

    s.append(T(left_end_x, TITLE_Y, hook_left,
               font=SF_DISPLAY, size=TITLE_PX, weight=700,
               fill=INK, anchor="end", tracking=-2.42))   # 110 * -0.022
    s.append(T(right_start_x, TITLE_Y, hook_right,
               font=NY_SERIF, size=TITLE_PX, weight=500,
               fill=BLUE, anchor="start", tracking=-1.76,  # 110 * -0.016
               italic=True))

    # Summary: 26px SF Pro Text, wraps at ~78 chars (~1100px wide).
    # Two lines max. Centred. Sits at SUMMARY_Y, second line +SUMMARY_LINE_H.
    lines = textwrap.wrap(summary, width=78, break_long_words=False)
    if len(lines) > 2:
        # Force at most two lines by re-wrapping wider.
        lines = textwrap.wrap(summary, width=92, break_long_words=False)
    for i, line in enumerate(lines[:2]):
        s.append(T(W // 2, SUMMARY_Y + i * SUMMARY_LINE_H, line,
                   font=SF_TEXT, size=SUMMARY_PX, weight=500,
                   fill=INK_2, anchor="middle", tracking=-0.57))  # 26 * -0.022
    return "\n".join(s)


def bridge(text):
    """Mono caption directly under the diagram. 'You've seen this before as …'."""
    return T(W // 2, BRIDGE_Y, text,
             font=SF_MONO, size=BRIDGE_PX, weight=500,
             fill=INK_3, anchor="middle", tracking=0.4)


def prose(text):
    """One short Cioran line at the bottom. ≤12 words."""
    return T(W // 2, PROSE_Y, text,
             font=SF_TEXT, size=PROSE_PX, weight=500,
             fill=INK, anchor="middle", tracking=-0.62)  # 28 * -0.022


def wrap_svg(body):
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f'width="{W}" height="{H}">\n'
        f'{arrow_defs()}\n'
        f'{R(0, 0, W, H, fill=PAPER)}\n'
        f'{body}\n'
        f'</svg>\n'
    )


# ===== SHARED PRIMITIVES =====
def card_frame(x, y, w, h, *, fill=PAPER_3, stroke=RULE_2, rx=14):
    return R(x, y, w, h, fill=fill, stroke=stroke, rx=rx)


def chip(cx, cy, label, *, fill=PAPER, stroke=RULE_2, text_color=INK,
         pad_x=20, pad_y=10, font=SF_MONO, size=22, weight=700, tracking=0.88):
    """Pill chip with mono label."""
    char_w = size * 0.64
    w = int(len(label) * char_w + pad_x * 2)
    h = int(size + pad_y * 2)
    x = cx - w // 2
    y = cy - h // 2
    return (R(x, y, w, h, fill=fill, stroke=stroke, rx=980) + "\n" +
            T(cx, cy + size // 2 - 2, label, font=font, size=size, weight=weight,
              fill=text_color, anchor="middle", tracking=tracking))


def check_badge(cx, cy, r=28, *, color=GREEN):
    return (CIRC(cx, cy, r, fill=color) + "\n" +
            T(cx, cy + 10, "✓", font=SF_TEXT, size=34, weight=800,
              fill=PAPER, anchor="middle"))


def cross_badge(cx, cy, r=28, *, color=RED):
    return (CIRC(cx, cy, r, fill=color) + "\n" +
            T(cx, cy + 10, "✗", font=SF_TEXT, size=34, weight=800,
              fill=PAPER, anchor="middle"))


def vs_header(side, lx, cy_top, col_w):
    """Top chip + badge for a vs-column. side ∈ {'blocks', 'perps'}."""
    s = []
    if side == "blocks":
        s.append(chip(lx + 200, cy_top + 56, "BLOCKS",
                      fill=GREEN_T, stroke=GREEN, text_color=GREEN, tracking=1.76,
                      size=22, pad_x=22, pad_y=10))
        s.append(check_badge(lx + col_w - 64, cy_top + 56, r=28, color=GREEN))
    else:
        s.append(chip(lx + 180, cy_top + 56, "PERPS",
                      fill=RED_T, stroke=RED, text_color=RED, tracking=1.76,
                      size=22, pad_x=22, pad_y=10))
        s.append(cross_badge(lx + col_w - 64, cy_top + 56, r=28, color=RED))
    return "\n".join(s)


# =====================================================
# A1 — WHAT IS A BLOCK
# =====================================================
def build_A1_what_is_a_block():
    body = [
        header("PRIMITIVE A1 · THE BUNDLE",
               "One hundred bets.", "One ticket.",
               "A block is one ticket that bundles a hundred up-or-down "
               "bets on a hundred different markets — BTC, ETH, SOL, and "
               "ninety-seven more."),
    ]
    s = []
    # 10×6 grid of mini cards.
    cols, rows = 10, 6
    pad = 8
    cell_w = 118
    cell_h = 86
    grid_w = cols * cell_w + (cols - 1) * pad
    grid_h = rows * cell_h + (rows - 1) * pad
    gx = (W - grid_w) // 2
    gy = DIAG_TOP + 20

    s.append(card_frame(gx - 40, gy - 40, grid_w + 80, grid_h + 80,
                        fill=PAPER, stroke=RULE_2))

    sample = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "LINK", "DOT", "MATIC",
              "ATOM", "ARB", "OP", "SUI", "APT", "SEI", "TIA", "INJ", "NEAR", "FTM"]

    for r in range(rows):
        for c in range(cols):
            cx = gx + c * (cell_w + pad)
            cy = gy + r * (cell_h + pad)
            idx = r * cols + c
            is_up = (idx * 7 + 3) % 2 == 0
            tone_stroke = GREEN if is_up else RED
            tone_text = GREEN if is_up else RED

            s.append(R(cx, cy, cell_w, cell_h, fill=PAPER, stroke=RULE_2, rx=10))
            label = sample[idx] if idx < len(sample) else f"#{idx + 1:03d}"
            s.append(T(cx + cell_w // 2, cy + 30, label,
                       font=SF_MONO, size=20, weight=700, fill=INK_3,
                       anchor="middle", tracking=0.4))
            arrow = "▲" if is_up else "▼"
            s.append(T(cx + cell_w // 2, cy + 68, arrow,
                       font=SF_TEXT, size=34, weight=700, fill=tone_text,
                       anchor="middle"))

    body.append("\n".join(s))
    body.append(bridge("THINK OF IT LIKE AN INDEX ETF — EVERY POSITION A DIRECTIONAL CALL."))
    body.append(prose("One ticket. One hundred opinions."))
    return wrap_svg("\n".join(body))


# =====================================================
# A2 — HOW A BLOCK RESOLVES
# =====================================================
def build_A2_how_block_resolves():
    body = [
        header("PRIMITIVE A2 · THE POOL",
               "Pool clears.", "Winners split.",
               "Each market in a block is parimutuel: everyone bets into "
               "a pool, winners split losers' money, no market maker."),
    ]
    s = []
    fx, fy = DIAG_LEFT, DIAG_TOP
    fw, fh = DIAG_W, DIAG_BOTTOM - DIAG_TOP
    s.append(card_frame(fx, fy, fw, fh, fill=PAPER, stroke=RULE_2))

    col_count = 4
    col_gap = 24
    col_w = (fw - 80 - col_gap * (col_count - 1)) // col_count
    col_h = fh - 100
    col_y = fy + 50

    markets = [
        ("BTC", "$60", "$40", "UP",   "WIN ×1.67"),
        ("ETH", "$30", "$70", "DOWN", "WIN ×1.43"),
        ("SOL", "$50", "$50", "UP",   "WIN ×2.00"),
        ("ARB", "$100", "$0",  None,  "REFUND"),
    ]

    for i, (ticker, up_p, down_p, winner, status) in enumerate(markets):
        cx = fx + 40 + i * (col_w + col_gap)
        cancelled = winner is None

        s.append(R(cx, col_y, col_w, col_h,
                   fill=PAPER_3 if not cancelled else PAPER_2,
                   stroke=RULE_2, rx=12))

        # Ticker
        s.append(T(cx + col_w // 2, col_y + 56, ticker,
                   font=SF_DISPLAY, size=44, weight=800, fill=INK,
                   anchor="middle", tracking=-0.97))

        # UP / DOWN bars
        bar_max = col_w - 80
        try:
            up_amt = int(up_p.replace("$", ""))
            down_amt = int(down_p.replace("$", ""))
        except ValueError:
            up_amt, down_amt = 50, 50
        total = max(up_amt + down_amt, 1)
        up_w = max(int((up_amt / total) * bar_max), 0)
        down_w = max(int((down_amt / total) * bar_max), 0)

        bar_x = cx + 40
        up_y = col_y + 110
        s.append(T(cx + col_w // 2, up_y, "UP",
                   font=SF_MONO, size=20, weight=700, fill=INK_3,
                   anchor="middle", tracking=0.8))
        s.append(R(bar_x, up_y + 14, bar_max, 22, fill=PAPER, stroke=RULE_2, rx=4))
        if up_w > 0:
            s.append(R(bar_x, up_y + 14, up_w, 22,
                       fill=GREEN if winner == "UP" else INK_3,
                       opacity=0.9, rx=4))
        s.append(T(cx + col_w // 2, up_y + 78, up_p,
                   font=SF_DISPLAY, size=40, weight=800,
                   fill=GREEN if winner == "UP" else (INK_3 if cancelled else INK_2),
                   anchor="middle", tracking=-0.88))

        down_y = up_y + 130
        s.append(T(cx + col_w // 2, down_y, "DOWN",
                   font=SF_MONO, size=20, weight=700, fill=INK_3,
                   anchor="middle", tracking=0.8))
        s.append(R(bar_x, down_y + 14, bar_max, 22, fill=PAPER, stroke=RULE_2, rx=4))
        if down_w > 0:
            s.append(R(bar_x, down_y + 14, down_w, 22,
                       fill=RED if winner == "DOWN" else (INK_3 if cancelled else RED),
                       opacity=0.9, rx=4))
        s.append(T(cx + col_w // 2, down_y + 78, down_p,
                   font=SF_DISPLAY, size=40, weight=800,
                   fill=RED if winner == "DOWN" else (INK_3 if cancelled else INK_2),
                   anchor="middle", tracking=-0.88))

        # Outcome
        result_y = col_y + col_h - 80
        s.append(L(cx + 24, result_y - 22, cx + col_w - 24, result_y - 22,
                   stroke=RULE_2, w=1))
        if cancelled:
            s.append(T(cx + col_w // 2, result_y + 22, "REFUND",
                       font=SF_DISPLAY, size=32, weight=800, fill=INK_3,
                       anchor="middle", tracking=-0.70))
        else:
            winner_color = GREEN if winner == "UP" else RED
            s.append(T(cx + col_w // 2, result_y + 22, status,
                       font=SF_DISPLAY, size=32, weight=800, fill=winner_color,
                       anchor="middle", tracking=-0.70))

    body.append("\n".join(s))
    body.append(bridge("SAME MODEL AS A HORSE-RACING POOL. SAME MODEL AS THE LOTTERY."))
    body.append(prose("No spread. No middleman. The pool is the price."))
    return wrap_svg("\n".join(body))


# =====================================================
# A3 — A $1 BLOCK, RETURNS EXPLAINED
# =====================================================
def build_A3_block_returns():
    body = [
        header("PRIMITIVE A3 · THE ARITHMETIC",
               "Forty wrong.", "Profit anyway.",
               "On a block, you can be wrong on most markets and still "
               "finish in profit, because each winning market pays more "
               "than each losing market costs."),
    ]
    s = []
    panel_gap = 60
    panel_w = (DIAG_W - panel_gap) // 2
    pan_h = DIAG_BOTTOM - DIAG_TOP
    lx = DIAG_LEFT
    rx = DIAG_LEFT + panel_w + panel_gap

    # LEFT — 10x10 grid
    s.append(card_frame(lx, DIAG_TOP, panel_w, pan_h, fill=PAPER, stroke=RULE_2))

    cells_per_row = 10
    cell_size = 46
    cell_gap = 6
    inner_w = cells_per_row * cell_size + (cells_per_row - 1) * cell_gap
    grid_x = lx + (panel_w - inner_w) // 2
    grid_y = DIAG_TOP + (pan_h - inner_w) // 2

    for i in range(100):
        r = i // 10
        c = i % 10
        is_win = i < 60
        cx = grid_x + c * (cell_size + cell_gap)
        cy = grid_y + r * (cell_size + cell_gap)
        fill_color = GREEN_T if is_win else RED_T
        stroke_color = GREEN if is_win else RED
        s.append(R(cx, cy, cell_size, cell_size,
                   fill=fill_color, stroke=stroke_color, rx=6))
        s.append(T(cx + cell_size // 2, cy + cell_size // 2 + 8,
                   "✓" if is_win else "✗",
                   font=SF_TEXT, size=24, weight=800,
                   fill=GREEN if is_win else RED, anchor="middle"))

    # RIGHT — math
    s.append(card_frame(rx, DIAG_TOP, panel_w, pan_h, fill=PAPER, stroke=RULE_2))

    eq_y = DIAG_TOP + 90
    rows = [
        ("60 wins",    "+$0.18", GREEN),
        ("40 losses",  "−$0.08", RED),
    ]
    for i, (label, value, color) in enumerate(rows):
        ry = eq_y + i * 130
        s.append(T(rx + 50, ry + 30, label,
                   font=SF_DISPLAY, size=44, weight=700, fill=INK,
                   tracking=-0.97))
        s.append(T(rx + panel_w - 50, ry + 36, value,
                   font=SF_DISPLAY, size=72, weight=800, fill=color,
                   anchor="end", tracking=-1.58))

    div_y = eq_y + 130 * 2 - 10
    s.append(L(rx + 50, div_y, rx + panel_w - 50, div_y, stroke=INK, w=2))

    net_y = div_y + 50
    s.append(T(rx + 50, net_y + 60, "Net",
               font=SF_DISPLAY, size=56, weight=700, fill=INK,
               tracking=-1.23))
    s.append(T(rx + panel_w - 50, net_y + 90, "+$0.10",
               font=SF_DISPLAY, size=130, weight=800, fill=BLUE,
               anchor="end", tracking=-2.86))

    body.append("\n".join(s))
    body.append(bridge("THE ASYMMETRY OPTIONS TRADERS PAY A PREMIUM FOR — BUILT IN BY DEFAULT."))
    body.append(prose("Be right on enough. Not on everything."))
    return wrap_svg("\n".join(body))


# =====================================================
# B1 — THE THREE-PHASE TIMELINE
# =====================================================
def build_B1_timeline():
    body = [
        header("TIMELINE B1 · THE THREE PHASES",
               "Submit. Reveal.", "Claim.",
               "Every block trades in three ten-minute phases. While you "
               "submit, your bets are encrypted. No one can see them, copy "
               "them, or trade ahead of them."),
    ]
    s = []
    frame_x = DIAG_LEFT
    frame_y = DIAG_TOP
    frame_w = DIAG_W
    frame_h = DIAG_BOTTOM - DIAG_TOP
    s.append(card_frame(frame_x, frame_y, frame_w, frame_h, fill=PAPER, stroke=RULE_2))

    phase_gap = 32
    phase_w = (frame_w - 80 - phase_gap * 2) // 3
    phase_h = 420
    px0 = frame_x + 40
    py = frame_y + 50

    phases = [
        ("01", "SUBMIT", "10 min", BLUE,
         ("You place your bets.", "Encrypted.")),
        ("02", "REVEAL", "10 min", INK,
         ("Everyone reveals at once.", "Bets are locked.")),
        ("03", "CLAIM",  "10 min", GREEN,
         ("Winners take", "the pool.")),
    ]

    for i, (num, name, duration, color, sublines) in enumerate(phases):
        x = px0 + i * (phase_w + phase_gap)
        s.append(R(x, py, phase_w, phase_h, fill=PAPER_3, stroke=color, rx=14, stroke_w=2))

        # Phase number badge
        s.append(CIRC(x + 50, py + 50, 32, fill=color))
        s.append(T(x + 50, py + 60, num,
                   font=SF_MONO, size=24, weight=800,
                   fill=PAPER, anchor="middle"))

        # Duration chip
        dur_chip_w = 140
        s.append(R(x + phase_w - dur_chip_w - 28, py + 26, dur_chip_w, 50,
                   fill=PAPER, stroke=color, rx=980))
        s.append(T(x + phase_w - dur_chip_w // 2 - 28, py + 60, duration,
                   font=SF_MONO, size=22, weight=700, fill=color,
                   anchor="middle", tracking=0.88))

        # Phase name (huge)
        s.append(T(x + phase_w // 2, py + 200, name,
                   font=SF_DISPLAY, size=84, weight=800, fill=INK,
                   anchor="middle", tracking=-1.85))

        # Plain-English explainer (two lines)
        s.append(T(x + phase_w // 2, py + 280, sublines[0],
                   font=SF_TEXT, size=24, weight=500, fill=INK_2,
                   anchor="middle", tracking=-0.53))
        s.append(T(x + phase_w // 2, py + 316, sublines[1],
                   font=SF_TEXT, size=24, weight=500, fill=INK_2,
                   anchor="middle", tracking=-0.53))

    # Bottom timeline bar
    bar_y = py + phase_h + 70
    bar_x = px0
    bar_w = phase_w * 3 + phase_gap * 2

    s.append(L(bar_x, bar_y, bar_x + bar_w, bar_y, stroke=RULE, w=3))

    tick_colors = [BLUE, INK, GREEN]
    for i in range(3):
        seg_x = bar_x + i * (phase_w + phase_gap)
        s.append(L(seg_x, bar_y, seg_x + phase_w, bar_y, stroke=tick_colors[i], w=5))
        s.append(CIRC(seg_x, bar_y, 10, fill=PAPER, stroke=tick_colors[i], w=3))
        s.append(T(seg_x, bar_y + 46, f"t = {i * 10} min",
                   font=SF_MONO, size=22, weight=700, fill=INK_3,
                   anchor="middle", tracking=0.88))

    end_x = bar_x + bar_w
    s.append(CIRC(end_x, bar_y, 10, fill=PAPER, stroke=GREEN, w=3))
    s.append(T(end_x, bar_y + 46, "t = 30 min",
               font=SF_MONO, size=22, weight=700, fill=INK_3,
               anchor="end", tracking=0.88))

    body.append("\n".join(s))
    body.append(bridge("ON A NORMAL EXCHANGE, EVERY ORDER IS VISIBLE THE SECOND YOU PLACE IT."))
    body.append(prose("Three phases. Zero visibility for ten minutes."))
    return wrap_svg("\n".join(body))


# =====================================================
# Shared vs-comparison column scaffolding (C1..C7)
# =====================================================
def _vs_columns():
    """Return (lx, rx, col_w, col_h, cy_top) for the two-column layout."""
    col_gap = 40
    col_w = (DIAG_W - col_gap) // 2
    col_h = DIAG_BOTTOM - DIAG_TOP
    lx = DIAG_LEFT
    rx = DIAG_LEFT + col_w + col_gap
    cy_top = DIAG_TOP
    return lx, rx, col_w, col_h, cy_top


def _vs_frames(lx, rx, col_w, col_h, cy_top):
    """Frames + chip + badge for both columns. Returns list of svg fragments."""
    s = []
    s.append(card_frame(lx, cy_top, col_w, col_h, fill=PAPER, stroke=RULE_2))
    s.append(vs_header("blocks", lx, cy_top, col_w))
    s.append(card_frame(rx, cy_top, col_w, col_h, fill=PAPER, stroke=RULE_2))
    s.append(vs_header("perps", rx, cy_top, col_w))
    return s


# =====================================================
# C1 — INSIDER TRADING
# =====================================================
def build_C1_insider():
    body = [
        header("EXTRACTION C1 · INSIDER TRADING",
               "Know one market.", "Win nothing.",
               "Even if you have inside information on one market, you "
               "still need to be right on the other ninety-nine. Insider "
               "edge collapses to almost zero."),
    ]
    s = []
    lx, rx, col_w, col_h, cy_top = _vs_columns()
    s.extend(_vs_frames(lx, rx, col_w, col_h, cy_top))

    # LEFT — Blocks
    s.append(T(lx + col_w // 2, cy_top + col_h // 2 - 30, "≈ 0.1%",
               font=SF_DISPLAY, size=160, weight=800, fill=GREEN,
               anchor="middle", tracking=-3.52))
    s.append(T(lx + col_w // 2, cy_top + col_h // 2 + 50, "INSIDER EDGE",
               font=SF_MONO, size=24, weight=700, fill=INK_3,
               anchor="middle", tracking=4.32))

    # RIGHT — Perps
    s.append(T(rx + col_w // 2, cy_top + col_h // 2 - 30, "100%",
               font=SF_DISPLAY, size=160, weight=800, fill=RED,
               anchor="middle", tracking=-3.52))
    s.append(T(rx + col_w // 2, cy_top + col_h // 2 + 50, "INSIDER EDGE",
               font=SF_MONO, size=24, weight=700, fill=INK_3,
               anchor="middle", tracking=4.32))

    mid_x = (lx + col_w + rx) // 2
    s.append(L(mid_x, cy_top + 60, mid_x, DIAG_BOTTOM - 60,
               stroke=RULE_2, w=1, dash="2 6"))

    body.append("\n".join(s))
    body.append(bridge("KNOWING ONE STOCK'S EARNINGS BEATS = NEAR-100% TRADE. HERE: COIN-FLIP × 99."))
    body.append(prose("Insider edge: from 100% to 0.1%."))
    return wrap_svg("\n".join(body))


# =====================================================
# C2 — FRONT-RUNNING
# =====================================================
def build_C2_front_running():
    body = [
        header("EXTRACTION C2 · FRONT-RUNNING",
               "No mempool.", "Nothing to read.",
               "On normal blockchains your trade waits in a public queue "
               "(the 'mempool') — a bot reads it and trades ahead of you. "
               "Here, your trade is encrypted until reveal."),
    ]
    s = []
    lx, rx, col_w, col_h, cy_top = _vs_columns()
    s.extend(_vs_frames(lx, rx, col_w, col_h, cy_top))

    # LEFT — three phase boxes
    pb_y = cy_top + 200
    pb_w = (col_w - 80 - 16 * 2) // 3
    pb_h = 280
    pb_x0 = lx + 40
    phases = [
        ("SUBMIT", "ENCRYPTED"),
        ("REVEAL", "LOCKED"),
        ("CLAIM",  "SETTLED"),
    ]
    for i, (name, state) in enumerate(phases):
        x = pb_x0 + i * (pb_w + 16)
        s.append(R(x, pb_y, pb_w, pb_h, fill=PAPER_3, stroke=GREEN, rx=12, stroke_w=2))
        s.append(T(x + pb_w // 2, pb_y + 64, name,
                   font=SF_MONO, size=24, weight=700, fill=GREEN,
                   anchor="middle", tracking=4.32))
        s.append(T(x + pb_w // 2, pb_y + 170, state,
                   font=SF_DISPLAY, size=42, weight=800, fill=INK,
                   anchor="middle", tracking=-0.92))

    s.append(T(lx + col_w // 2, cy_top + col_h - 60, "NO PUBLIC QUEUE TO READ",
               font=SF_MONO, size=24, weight=800, fill=GREEN,
               anchor="middle", tracking=4.32))

    # RIGHT — actor chain
    actor_y = cy_top + 240
    actor_h = 170
    actor_gap = 30
    actor_w = (col_w - 80 - actor_gap * 2) // 3
    actor_x0 = rx + 40
    actors = [
        ("YOU", "PLACE BUY", INK, PAPER_3),
        ("BOT", "JUMPS AHEAD", RED, RED_T),
        ("YOU", "PAY MORE", INK_3, PAPER_3),
    ]
    for i, (name, action, color, fill) in enumerate(actors):
        x = actor_x0 + i * (actor_w + actor_gap)
        s.append(R(x, actor_y, actor_w, actor_h, fill=fill, stroke=color, rx=12, stroke_w=2))
        s.append(T(x + actor_w // 2, actor_y + 64, name,
                   font=SF_MONO, size=22, weight=800, fill=color,
                   anchor="middle", tracking=3.96))
        s.append(T(x + actor_w // 2, actor_y + 120, action,
                   font=SF_DISPLAY, size=30, weight=800, fill=INK,
                   anchor="middle", tracking=-0.66))

    for i in range(2):
        x1 = actor_x0 + i * (actor_w + actor_gap) + actor_w
        x2 = x1 + actor_gap
        s.append(PATH(f"M {x1 + 4} {actor_y + actor_h // 2} L {x2 - 4} {actor_y + actor_h // 2}",
                      stroke=RED, w=3, marker_end="arrRed"))

    s.append(T(rx + col_w // 2, cy_top + col_h - 90, "$700M+",
               font=SF_DISPLAY, size=110, weight=800, fill=RED,
               anchor="middle", tracking=-2.42))
    s.append(T(rx + col_w // 2, cy_top + col_h - 40, "STOLEN PER YEAR ON ETHEREUM",
               font=SF_MONO, size=22, weight=700, fill=INK_3,
               anchor="middle", tracking=3.96))

    mid_x = (lx + col_w + rx) // 2
    s.append(L(mid_x, cy_top + 60, mid_x, DIAG_BOTTOM - 60,
               stroke=RULE_2, w=1, dash="2 6"))

    body.append("\n".join(s))
    body.append(bridge("THE $700M/YR MEV ECONOMY ON ETHEREUM — REFUSED AT THE PROTOCOL LEVEL."))
    body.append(prose("Sealed bets cannot be front-run."))
    return wrap_svg("\n".join(body))


# =====================================================
# C3 — MARKET MANIPULATION
# =====================================================
def build_C3_manipulation():
    body = [
        header("EXTRACTION C3 · MANIPULATION",
               "Move one.", "Move all hundred.",
               "To manipulate a single perpetual market and profit, you "
               "push one price. To manipulate a block, you would have to "
               "push a hundred — at a hundred times the cost."),
    ]
    s = []
    lx, rx, col_w, col_h, cy_top = _vs_columns()
    s.extend(_vs_frames(lx, rx, col_w, col_h, cy_top))

    # LEFT — 10x10 mini grid of red Xs
    mini_size = 30
    mini_gap = 6
    mini_total = 10 * mini_size + 9 * mini_gap
    mini_x0 = lx + (col_w - mini_total) // 2
    mini_y0 = cy_top + 150
    for i in range(100):
        r = i // 10
        c = i % 10
        x = mini_x0 + c * (mini_size + mini_gap)
        y = mini_y0 + r * (mini_size + mini_gap)
        s.append(R(x, y, mini_size, mini_size, fill=RED_T, stroke=RED, rx=4))
        s.append(T(x + mini_size // 2, y + mini_size // 2 + 7, "✗",
                   font=SF_TEXT, size=20, weight=800, fill=RED,
                   anchor="middle"))

    eco_y = mini_y0 + mini_total + 60
    s.append(T(lx + col_w // 2, eco_y, "100×",
               font=SF_DISPLAY, size=130, weight=800, fill=INK,
               anchor="middle", tracking=-2.86))
    s.append(T(lx + col_w // 2, eco_y + 50, "ATTACKS NEEDED",
               font=SF_MONO, size=22, weight=700, fill=INK_3,
               anchor="middle", tracking=3.96))

    # RIGHT — one big red box with X
    big_w = 360
    big_h = 360
    big_x = rx + (col_w - big_w) // 2
    big_y = cy_top + 150
    s.append(R(big_x, big_y, big_w, big_h, fill=RED_T, stroke=RED, rx=14, stroke_w=3))
    s.append(T(big_x + big_w // 2, big_y + big_h // 2 + 50, "✗",
               font=SF_TEXT, size=240, weight=800, fill=RED,
               anchor="middle"))

    eco_y = big_y + big_h + 60
    s.append(T(rx + col_w // 2, eco_y, "1×",
               font=SF_DISPLAY, size=130, weight=800, fill=INK,
               anchor="middle", tracking=-2.86))
    s.append(T(rx + col_w // 2, eco_y + 50, "ATTACK NEEDED",
               font=SF_MONO, size=22, weight=700, fill=INK_3,
               anchor="middle", tracking=3.96))

    mid_x = (lx + col_w + rx) // 2
    s.append(L(mid_x, cy_top + 60, mid_x, DIAG_BOTTOM - 60,
               stroke=RULE_2, w=1, dash="2 6"))

    body.append("\n".join(s))
    body.append(bridge("MANIPULATION WORKS WHEN ONE VENUE DECIDES THE OUTCOME. A BLOCK USES A HUNDRED."))
    body.append(prose("Manipulation needs concentration. Blocks dilute it."))
    return wrap_svg("\n".join(body))


# =====================================================
# C4 — PFOF
# =====================================================
def build_C4_pfof():
    body = [
        header("EXTRACTION C4 · ORDERFLOW",
               "No broker.", "No back room.",
               "You don't send your order to a broker who resells it to "
               "a wholesaler. You send it straight to the pool. There is "
               "no middleman to pay for your flow."),
    ]
    s = []
    lx, rx, col_w, col_h, cy_top = _vs_columns()
    s.extend(_vs_frames(lx, rx, col_w, col_h, cy_top))

    # LEFT — two big boxes: TRADER → POOL
    box_w = 240
    box_h = 160
    flow_y = cy_top + 240
    trader_x = lx + 60
    pool_x = lx + col_w - 60 - box_w

    s.append(R(trader_x, flow_y, box_w, box_h, fill=PAPER_3, stroke=INK, rx=12, stroke_w=2))
    s.append(T(trader_x + box_w // 2, flow_y + 80, "TRADER",
               font=SF_MONO, size=28, weight=800, fill=INK,
               anchor="middle", tracking=5.04))
    s.append(T(trader_x + box_w // 2, flow_y + 120, "→",
               font=SF_DISPLAY, size=36, weight=800, fill=INK_3,
               anchor="middle"))

    s.append(R(pool_x, flow_y, box_w, box_h, fill=GREEN_T, stroke=GREEN, rx=12, stroke_w=2))
    s.append(T(pool_x + box_w // 2, flow_y + 80, "POOL",
               font=SF_MONO, size=28, weight=800, fill=GREEN,
               anchor="middle", tracking=5.04))
    s.append(T(pool_x + box_w // 2, flow_y + 120, "one price",
               font=SF_TEXT, size=24, weight=500, fill=INK_2,
               anchor="middle", tracking=-0.53))

    s.append(PATH(f"M {trader_x + box_w + 12} {flow_y + box_h // 2} "
                  f"L {pool_x - 12} {flow_y + box_h // 2}",
                  stroke=GREEN, w=4, marker_end="arrGreen"))

    s.append(T(lx + col_w // 2, cy_top + col_h - 90, "$0",
               font=SF_DISPLAY, size=130, weight=800, fill=GREEN,
               anchor="middle", tracking=-2.86))
    s.append(T(lx + col_w // 2, cy_top + col_h - 40, "PFOF PAID",
               font=SF_MONO, size=22, weight=700, fill=INK_3,
               anchor="middle", tracking=3.96))

    # RIGHT — three boxes
    box_w = 180
    box_h = 130
    flow_y = cy_top + 240
    gap = 40
    total = box_w * 3 + gap * 2
    fx0 = rx + (col_w - total) // 2

    actors = [
        ("TRADER", INK, PAPER_3),
        ("BROKER", RED, RED_T),
        ("WHOLESALER", INK, PAPER_3),
    ]
    for i, (name, color, fill) in enumerate(actors):
        x = fx0 + i * (box_w + gap)
        s.append(R(x, flow_y, box_w, box_h, fill=fill, stroke=color, rx=12, stroke_w=2))
        # Mono name (size 22 for the longer "WHOLESALER")
        nm_size = 22 if name == "WHOLESALER" else 24
        s.append(T(x + box_w // 2, flow_y + 78, name,
                   font=SF_MONO, size=nm_size, weight=800, fill=color,
                   anchor="middle", tracking=3.6))

    for i in range(2):
        x1 = fx0 + i * (box_w + gap) + box_w
        x2 = x1 + gap
        s.append(PATH(f"M {x1 + 4} {flow_y + box_h // 2} L {x2 - 4} {flow_y + box_h // 2}",
                      stroke=RED, w=3, marker_end="arrRed"))

    s.append(T(rx + col_w // 2, cy_top + col_h - 90, "$943M",
               font=SF_DISPLAY, size=110, weight=800, fill=RED,
               anchor="middle", tracking=-2.42))
    s.append(T(rx + col_w // 2, cy_top + col_h - 40, "CITADEL → ROBINHOOD · 9 MONTHS, 2024",
               font=SF_MONO, size=20, weight=700, fill=INK_3,
               anchor="middle", tracking=3.6))

    mid_x = (lx + col_w + rx) // 2
    s.append(L(mid_x, cy_top + 60, mid_x, DIAG_BOTTOM - 60,
               stroke=RULE_2, w=1, dash="2 6"))

    body.append("\n".join(s))
    body.append(bridge("RETAIL ORDERFLOW IS THE BEST IN THE WORLD. HERE, THE BROKER DOESN'T EXIST."))
    body.append(prose("No order to sell. No flow to buy."))
    return wrap_svg("\n".join(body))


# =====================================================
# C5 — SPOOFING
# =====================================================
def build_C5_spoofing():
    body = [
        header("EXTRACTION C5 · SPOOFING",
               "No book.", "No wall to fake.",
               "There is no order book — no list of bids and offers a "
               "manipulator can post fake walls on. The pool clears at "
               "one price. You cannot spoof a lottery."),
    ]
    s = []
    lx, rx, col_w, col_h, cy_top = _vs_columns()
    s.extend(_vs_frames(lx, rx, col_w, col_h, cy_top))

    # LEFT — struck-through orderbook
    ob_x = lx + 80
    ob_y = cy_top + 160
    ob_w = col_w - 160
    ob_h = 380

    s.append(R(ob_x, ob_y, ob_w, ob_h, fill=PAPER_3, stroke=RULE_2, rx=12))
    row_h = 50
    for i in range(7):
        ry = ob_y + 25 + i * row_h
        if i == 3:
            s.append(L(ob_x + 30, ry + row_h // 2, ob_x + ob_w - 30, ry + row_h // 2,
                       stroke=RULE_2, w=1, dash="3 5"))
            continue
        is_offer = i < 3
        bg = RED_T if is_offer else BLUE_T
        s.append(R(ob_x + 30, ry + 4, ob_w - 60, row_h - 8, fill=bg, rx=6))
        s.append(T(ob_x + 50, ry + row_h // 2 + 8,
                   "$100.05" if is_offer else "$99.95",
                   font=SF_MONO, size=22, weight=700, fill=INK_3, tracking=0.88))
        s.append(T(ob_x + ob_w - 50, ry + row_h // 2 + 8,
                   f"{500 + i * 100}",
                   font=SF_MONO, size=22, weight=700, fill=INK_3,
                   anchor="end", tracking=0.88))

    s.append(L(ob_x, ob_y, ob_x + ob_w, ob_y + ob_h,
               stroke=GREEN, w=8, opacity=0.7))
    s.append(L(ob_x + ob_w, ob_y, ob_x, ob_y + ob_h,
               stroke=GREEN, w=8, opacity=0.7))

    s.append(T(lx + col_w // 2, cy_top + col_h - 60, "NO ORDERBOOK",
               font=SF_MONO, size=28, weight=800, fill=GREEN,
               anchor="middle", tracking=5.04))

    # RIGHT — orderbook with fake wall
    ob2_x = rx + 80
    ob2_y = cy_top + 160
    ob2_w = col_w - 160
    ob2_h = 380
    s.append(R(ob2_x, ob2_y, ob2_w, ob2_h, fill=PAPER_3, stroke=RULE_2, rx=12))

    for i in range(3):
        ry = ob2_y + 25 + i * row_h
        s.append(R(ob2_x + 30, ry + 4, ob2_w - 60, row_h - 8, fill=RED_T, rx=6))
        s.append(T(ob2_x + 50, ry + row_h // 2 + 8, "$100.05",
                   font=SF_MONO, size=22, weight=700, fill=INK_3, tracking=0.88))
        s.append(T(ob2_x + ob2_w - 50, ry + row_h // 2 + 8,
                   f"{500 + i * 100}",
                   font=SF_MONO, size=22, weight=700, fill=INK_3,
                   anchor="end", tracking=0.88))

    ry_mid = ob2_y + 25 + 3 * row_h
    s.append(L(ob2_x + 30, ry_mid + row_h // 2, ob2_x + ob2_w - 30, ry_mid + row_h // 2,
               stroke=RULE_2, w=1, dash="3 5"))

    fake_y = ob2_y + 25 + 4 * row_h
    s.append(R(ob2_x + 30, fake_y + 4, ob2_w - 60, row_h - 8,
               fill=RED, opacity=0.9, rx=6))
    s.append(T(ob2_x + 50, fake_y + row_h // 2 + 8, "$99.95",
               font=SF_MONO, size=22, weight=800, fill=PAPER, tracking=0.88))
    s.append(T(ob2_x + ob2_w - 50, fake_y + row_h // 2 + 8, "14,028",
               font=SF_MONO, size=22, weight=800, fill=PAPER,
               anchor="end", tracking=0.88))

    for i in range(5, 7):
        ry = ob2_y + 25 + i * row_h
        s.append(R(ob2_x + 30, ry + 4, ob2_w - 60, row_h - 8, fill=BLUE_T, rx=6))
        s.append(T(ob2_x + 50, ry + row_h // 2 + 8, "$99.93",
                   font=SF_MONO, size=22, weight=700, fill=INK_3, tracking=0.88))
        s.append(T(ob2_x + ob2_w - 50, ry + row_h // 2 + 8,
                   f"{300 + i * 50}",
                   font=SF_MONO, size=22, weight=700, fill=INK_3,
                   anchor="end", tracking=0.88))

    s.append(T(rx + col_w // 2, cy_top + col_h - 60, "FAKE WALL · JPMORGAN PAID $920M IN FINES",
               font=SF_MONO, size=20, weight=700, fill=INK_3,
               anchor="middle", tracking=3.6))

    mid_x = (lx + col_w + rx) // 2
    s.append(L(mid_x, cy_top + 60, mid_x, DIAG_BOTTOM - 60,
               stroke=RULE_2, w=1, dash="2 6"))

    body.append("\n".join(s))
    body.append(bridge("THE FAKE-WALL TRICK ON EVERY TRADINGVIEW CHART. IT NEEDS A BOOK. THERE ISN'T ONE."))
    body.append(prose("The chart is not a stage if there is no audience."))
    return wrap_svg("\n".join(body))


# =====================================================
# C6 — TOXIC-FLOW MM
# =====================================================
def build_C6_toxic_flow():
    body = [
        header("EXTRACTION C6 · TOXIC-FLOW",
               "No makers.", "No spread.",
               "There is no market maker setting a bid-ask spread. "
               "Everyone trades into the same pool at the same clearing "
               "price. The spread you pay is zero."),
    ]
    s = []
    lx, rx, col_w, col_h, cy_top = _vs_columns()
    s.extend(_vs_frames(lx, rx, col_w, col_h, cy_top))

    # LEFT — single pool circle
    pool_cx = lx + col_w // 2
    pool_cy = cy_top + col_h // 2 - 50
    pool_r = 150
    s.append(CIRC(pool_cx, pool_cy, pool_r + 18, fill=GREEN_T, stroke="none"))
    s.append(CIRC(pool_cx, pool_cy, pool_r, fill=PAPER, stroke=GREEN, w=3))
    s.append(T(pool_cx, pool_cy + 14, "POOL",
               font=SF_DISPLAY, size=72, weight=800, fill=GREEN,
               anchor="middle", tracking=-1.58))

    s.append(T(lx + col_w // 2, cy_top + col_h - 90, "$0",
               font=SF_DISPLAY, size=130, weight=800, fill=GREEN,
               anchor="middle", tracking=-2.86))
    s.append(T(lx + col_w // 2, cy_top + col_h - 40, "SPREAD YOU PAY",
               font=SF_MONO, size=22, weight=700, fill=INK_3,
               anchor="middle", tracking=3.96))

    # RIGHT — ring of MARKET MAKER dots
    centre_cx = rx + col_w // 2
    centre_cy = cy_top + col_h // 2 - 50
    s.append(CIRC(centre_cx, centre_cy, 70, fill=PAPER_3, stroke=INK, w=3))
    s.append(T(centre_cx, centre_cy + 10, "YOU",
               font=SF_MONO, size=26, weight=800, fill=INK,
               anchor="middle", tracking=4.68))

    n_mms = 10
    ring_r = 200
    for i in range(n_mms):
        ang = (i / n_mms) * 2 * math.pi - math.pi / 2
        mx = centre_cx + math.cos(ang) * ring_r
        my = centre_cy + math.sin(ang) * ring_r
        s.append(CIRC(mx, my, 36, fill=RED_T, stroke=RED, w=2))
        s.append(T(mx, my + 7, "MAKER",
                   font=SF_MONO, size=16, weight=800, fill=RED,
                   anchor="middle", tracking=0.8))
        sx = centre_cx + math.cos(ang) * (ring_r - 36)
        sy = centre_cy + math.sin(ang) * (ring_r - 36)
        ax = centre_cx + math.cos(ang) * 80
        ay = centre_cy + math.sin(ang) * 80
        s.append(L(sx, sy, ax, ay, stroke=RED, w=2, opacity=0.5))

    s.append(T(rx + col_w // 2, cy_top + col_h - 90, "$2–5M",
               font=SF_DISPLAY, size=110, weight=800, fill=RED,
               anchor="middle", tracking=-2.42))
    s.append(T(rx + col_w // 2, cy_top + col_h - 40, "PER MAKER · SPREAD WIDENS ON YOU",
               font=SF_MONO, size=20, weight=700, fill=INK_3,
               anchor="middle", tracking=3.6))

    mid_x = (lx + col_w + rx) // 2
    s.append(L(mid_x, cy_top + 60, mid_x, DIAG_BOTTOM - 60,
               stroke=RULE_2, w=1, dash="2 6"))

    body.append("\n".join(s))
    body.append(bridge("MAKERS TIGHTEN SPREADS TO ATTRACT YOU, THEN WIDEN ONCE THEY READ YOUR DIRECTION."))
    body.append(prose("No quote to fade. No spread to widen."))
    return wrap_svg("\n".join(body))


# =====================================================
# C7 — LATENCY
# =====================================================
def build_C7_latency():
    body = [
        header("EXTRACTION C7 · LATENCY",
               "One venue.", "One clearing.",
               "There is only one venue, and it settles every bet at one "
               "price per round. A fast firm cannot exploit lag between "
               "venues, because there are no other venues."),
    ]
    s = []
    lx, rx, col_w, col_h, cy_top = _vs_columns()
    s.extend(_vs_frames(lx, rx, col_w, col_h, cy_top))

    # LEFT — one venue box with arrows converging from traders
    venue_cx = lx + col_w // 2
    venue_cy = cy_top + col_h // 2 - 60
    vw, vh = 360, 180
    s.append(R(venue_cx - vw // 2, venue_cy - vh // 2, vw, vh,
               fill=GREEN_T, stroke=GREEN, rx=14, stroke_w=3))
    s.append(T(venue_cx, venue_cy - 14, "ONE VENUE",
               font=SF_MONO, size=26, weight=800, fill=GREEN,
               anchor="middle", tracking=4.68))
    s.append(T(venue_cx, venue_cy + 32, "ONE CLEARING PRICE",
               font=SF_DISPLAY, size=34, weight=800, fill=INK,
               anchor="middle", tracking=-0.75))

    sources = [(-300, -120), (300, -120), (-300, 140), (300, 140),
               (-340, 10), (340, 10)]
    for dx, dy in sources:
        tx = venue_cx + dx
        ty = venue_cy + dy
        s.append(CIRC(tx, ty, 28, fill=PAPER, stroke=INK_3, w=2))
        s.append(T(tx, ty + 7, "YOU",
                   font=SF_MONO, size=16, weight=800, fill=INK_3,
                   anchor="middle", tracking=0.6))
        # Vector to venue edge
        end_x = venue_cx - (vw // 2 + 8) if dx < 0 else venue_cx + (vw // 2 + 8)
        end_y = venue_cy + dy * 0.45
        start_x = tx + (28 if dx > 0 else -28)
        s.append(L(start_x, ty, end_x, end_y, stroke=GREEN, w=2, opacity=0.65))

    s.append(T(lx + col_w // 2, cy_top + col_h - 90, "0 µs",
               font=SF_DISPLAY, size=130, weight=800, fill=GREEN,
               anchor="middle", tracking=-2.86))
    s.append(T(lx + col_w // 2, cy_top + col_h - 40, "EDGE A FAST FIRM CAN BUY",
               font=SF_MONO, size=20, weight=700, fill=INK_3,
               anchor="middle", tracking=3.6))

    # RIGHT — two venues with ARB in middle
    venue_w = 220
    venue_h = 140
    v_y = cy_top + col_h // 2 - 120
    v1_x = rx + 60
    v2_x = rx + col_w - 60 - venue_w

    s.append(R(v1_x, v_y, venue_w, venue_h, fill=PAPER_3, stroke=INK, rx=12, stroke_w=2))
    s.append(T(v1_x + venue_w // 2, v_y + 60, "BINANCE",
               font=SF_MONO, size=24, weight=800, fill=INK,
               anchor="middle", tracking=3.84))
    s.append(T(v1_x + venue_w // 2, v_y + 110, "$4,005",
               font=SF_DISPLAY, size=36, weight=800, fill=RED,
               anchor="middle", tracking=-0.79))

    s.append(R(v2_x, v_y, venue_w, venue_h, fill=PAPER_3, stroke=INK, rx=12, stroke_w=2))
    s.append(T(v2_x + venue_w // 2, v_y + 60, "COINBASE",
               font=SF_MONO, size=24, weight=800, fill=INK,
               anchor="middle", tracking=3.84))
    s.append(T(v2_x + venue_w // 2, v_y + 110, "$4,000",
               font=SF_DISPLAY, size=36, weight=800, fill=INK_3,
               anchor="middle", tracking=-0.79))

    arb_cx = (v1_x + venue_w + v2_x) // 2
    arb_cy = v_y + venue_h // 2
    s.append(CIRC(arb_cx, arb_cy, 64, fill=RED, w=0))
    s.append(T(arb_cx, arb_cy + 7, "FAST",
               font=SF_MONO, size=18, weight=800, fill=PAPER,
               anchor="middle", tracking=1.4))
    s.append(T(arb_cx, arb_cy + 28, "FIRM",
               font=SF_MONO, size=18, weight=800, fill=PAPER,
               anchor="middle", tracking=1.4))

    s.append(PATH(f"M {arb_cx - 68} {arb_cy - 18} L {v1_x + venue_w + 6} {arb_cy - 18}",
                  stroke=RED, w=3, marker_end="arrRed"))
    s.append(PATH(f"M {arb_cx + 68} {arb_cy + 18} L {v2_x - 6} {arb_cy + 18}",
                  stroke=RED, w=3, marker_end="arrRed"))

    s.append(T(arb_cx, v_y + venue_h + 50, "80 ms gap",
               font=SF_DISPLAY, size=34, weight=800, fill=RED,
               anchor="middle", tracking=-0.75))

    s.append(T(rx + col_w // 2, cy_top + col_h - 90, "$5B/yr",
               font=SF_DISPLAY, size=110, weight=800, fill=RED,
               anchor="middle", tracking=-2.42))
    s.append(T(rx + col_w // 2, cy_top + col_h - 40, "EXTRACTED BETWEEN MIRROR VENUES",
               font=SF_MONO, size=20, weight=700, fill=INK_3,
               anchor="middle", tracking=3.6))

    mid_x = (lx + col_w + rx) // 2
    s.append(L(mid_x, cy_top + 60, mid_x, DIAG_BOTTOM - 60,
               stroke=RULE_2, w=1, dash="2 6"))

    body.append("\n".join(s))
    body.append(bridge("$5B/YR EXTRACTED GLOBALLY FROM LAG BETWEEN MIRROR VENUES. A SINGLE VENUE: IMMUNE."))
    body.append(prose("Faster than light buys nothing in a sealed batch."))
    return wrap_svg("\n".join(body))


BUILDERS = [
    ("A1-what-is-a-block", build_A1_what_is_a_block),
    ("A2-how-block-resolves", build_A2_how_block_resolves),
    ("A3-block-returns", build_A3_block_returns),
    ("B1-timeline", build_B1_timeline),
    ("C1-insider-trading", build_C1_insider),
    ("C2-front-running", build_C2_front_running),
    ("C3-market-manipulation", build_C3_manipulation),
    ("C4-pfof", build_C4_pfof),
    ("C5-spoofing", build_C5_spoofing),
    ("C6-toxic-flow", build_C6_toxic_flow),
    ("C7-latency", build_C7_latency),
]


if __name__ == "__main__":
    for name, fn in BUILDERS:
        svg = fn()
        (OUT / f"{name}.svg").write_text(svg)
        print(f"  wrote {name}.svg  ({len(svg):,} bytes)")
