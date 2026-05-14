#!/usr/bin/env python3
"""Generate the extra cards for the iceberg board:
- 1 HERO title card
- 4 theory cards: TRIANGLE, LIMIT, SKANDALON, PHARMAKON
- 7 VOICES cards (one beside each mechanism, narrow)
- 1 FIX closing card

Uses the same Apple-style helpers and palette as generate_diagrams.py.
Output: docs/predator-anatomy/diagrams/extras/*.svg
"""
import pathlib, textwrap, base64, sys

# Reuse helpers from generate_diagrams
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_diagrams import (
    INK, INK_2, INK_3, INK_4, PAPER, PAPER_2, PAPER_3, RULE, RULE_2,
    BLUE, BLUE_T, RED, RED_T, GREEN, GREEN_T,
    SF_DISPLAY, SF_TEXT, SF_MONO, NY_SERIF,
    T, R, L, CIRC, PATH, arrow_defs, portrait_b64, wrap_text,
)

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "diagrams" / "extras"
OUT.mkdir(parents=True, exist_ok=True)


def make_svg(w, h, body):
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
{arrow_defs()}
{R(0, 0, w, h, fill=PAPER)}
{body}
</svg>
'''


# ===== HERO TITLE CARD =====
def build_hero():
    W, H = 2400, 1300
    s = []
    # Top eyebrow
    s.append(T(W//2, 140, "GENERAL MARKET · TECHNICAL REVIEW Nº 002",
               font=SF_MONO, size=18, weight=700, fill=INK_3, anchor="middle", tracking=3.24))
    # Massive title
    s.append(T(W//2, 460, "THE", font=SF_DISPLAY, size=200, weight=800,
               fill=INK, anchor="middle", tracking=-4.4))
    s.append(T(W//2, 700, "ICEBERG", font=NY_SERIF, size=240, weight=500,
               fill=BLUE, anchor="middle", italic=True, tracking=-5.28))
    # Subtitle
    s.append(T(W//2, 820, "What sits below the tape, and what to do about it.",
               font=SF_TEXT, size=32, weight=500, fill=INK_3, anchor="middle", tracking=-0.704))
    # Iceberg waterline at bottom — simple horizontal line, then 7 small dots representing the seven hidden mechanisms
    s.append(L(W//2 - 700, 1020, W//2 + 700, 1020, stroke=BLUE, w=2, opacity=0.4))
    s.append(T(W//2 - 700, 1004, "↑ the tape", font=SF_MONO, size=15, weight=700,
               fill=INK_3, tracking=2.7))
    s.append(T(W//2 + 700, 1050, "↓ what they kept", font=SF_MONO, size=15, weight=700,
               fill=INK_3, anchor="end", tracking=2.7))
    # Dots below the line
    for i in range(7):
        x = W//2 - 360 + i * 120
        s.append(CIRC(x, 1110, 22, fill=PAPER, stroke=INK, w=1.5))
        s.append(T(x, 1116, f"0{i+1}", font=SF_MONO, size=13, weight=700,
                   fill=INK, anchor="middle"))
    s.append(T(W//2, 1180, "seven extractions · one fix",
               font=SF_MONO, size=15, weight=700, fill=INK_3, anchor="middle", tracking=2.7))
    return make_svg(W, H, "\n".join(s))


# ===== THEORY CARD SKELETON =====
def theory_card(eyebrow, hook_left, hook_right, lede, body_blocks):
    """One-page theory card. body_blocks is a list of (title, text, ...) dicts."""
    W, H = 1800, 1400
    s = []
    # Eyebrow
    s.append(T(W//2, 88, eyebrow, font=SF_MONO, size=15, weight=700,
               fill=INK_3, anchor="middle", tracking=2.7))
    # Hook title — display + serif italic
    left_w = len(hook_left) * 32
    right_w = len(hook_right) * 30
    total = left_w + right_w + 24
    left_x = (W - total) // 2 + left_w
    right_x = left_x + 24
    s.append(T(left_x, 200, hook_left, font=SF_DISPLAY, size=80, weight=700,
               fill=INK, anchor="end", tracking=-1.76))
    s.append(T(right_x, 200, hook_right, font=NY_SERIF, size=80, weight=500,
               fill=BLUE, anchor="start", italic=True, tracking=-1.28))
    # Lede
    lede_lines = wrap_text(lede, width=86)
    for i, line in enumerate(lede_lines[:2]):
        s.append(T(W//2, 290 + i * 36, line, font=SF_TEXT, size=24, weight=500,
                   fill=INK_3, anchor="middle", tracking=-0.288))
    return W, H, s


# ===== THEORY 01 — THE TRIANGLE =====
def build_triangle():
    W, H, s = theory_card(
        "THEORY · 01",
        "You don't want the trade.", "You want to beat them.",
        "Mimetic desire — Girard 1961. The object of desire is never the object itself; it is mediated by a third party. The retail trader does not want $TSLA. The retail trader wants to feel like the institution that traded $TSLA first.",
        [],
    )
    # The triangle in the centre — three vertices, big.
    cx, cy = W//2, 820
    tri_size = 380
    # Vertices
    top = (cx, cy - tri_size)
    bl = (cx - tri_size, cy + tri_size//2)
    br = (cx + tri_size, cy + tri_size//2)
    # Triangle lines (subtle)
    s.append(PATH(f"M {bl[0]} {bl[1]} L {top[0]} {top[1]} L {br[0]} {br[1]} Z",
                  stroke=RULE, w=1.5, dash="6 6"))
    # Labels at vertices
    # Top: OBJECT
    s.append(CIRC(top[0], top[1], 16, fill=INK))
    s.append(T(top[0], top[1] - 36, "OBJECT", font=SF_MONO, size=14, weight=700,
               fill=INK_3, anchor="middle", tracking=2.52))
    s.append(T(top[0], top[1] - 72, "“beating the institutions”",
               font=NY_SERIF, size=28, weight=500, fill=INK, anchor="middle",
               italic=True, tracking=-0.448))
    s.append(T(top[0], top[1] + 56, "status, not yield",
               font=SF_TEXT, size=16, weight=500, fill=INK_3, anchor="middle"))
    # Bottom left: YOU (subject)
    s.append(CIRC(bl[0], bl[1], 16, fill=INK))
    s.append(T(bl[0], bl[1] + 44, "YOU", font=SF_MONO, size=14, weight=700,
               fill=INK_3, anchor="middle", tracking=2.52))
    s.append(T(bl[0], bl[1] + 76, "the subject", font=SF_TEXT, size=16,
               weight=500, fill=INK_3, anchor="middle"))
    # Bottom right: MODEL
    s.append(CIRC(br[0], br[1], 16, fill=BLUE))
    s.append(T(br[0], br[1] + 44, "MODEL", font=SF_MONO, size=14, weight=700,
               fill=BLUE, anchor="middle", tracking=2.52))
    s.append(T(br[0], br[1] + 76, "the mediator", font=SF_TEXT, size=16,
               weight=500, fill=BLUE, anchor="middle"))
    s.append(T(br[0], br[1] + 100, "“smart money flow” · DD thread · the influencer",
               font=SF_MONO, size=12, weight=600, fill=INK_3, anchor="middle"))
    # Arrows: YOU → MODEL → OBJECT (desire path)
    # YOU to MODEL (bottom edge)
    s.append(PATH(f"M {bl[0] + 30} {bl[1]} L {br[0] - 30} {br[1]}",
                  stroke=BLUE, w=2.5, marker_end="arrBlue"))
    s.append(T((bl[0]+br[0])//2, bl[1] - 18, "looks to", font=SF_MONO, size=14,
               weight=700, fill=BLUE, anchor="middle", tracking=1.12))
    # MODEL to OBJECT (right edge)
    s.append(PATH(f"M {br[0] - 20} {br[1] - 30} L {top[0] + 20} {top[1] + 30}",
                  stroke=BLUE, w=2.5, marker_end="arrBlue"))
    s.append(T(br[0] + 50, (br[1]+top[1])//2, "wants",
               font=SF_MONO, size=14, weight=700, fill=BLUE, tracking=1.12))
    # YOU to OBJECT (dashed — what they think they're doing)
    s.append(PATH(f"M {bl[0] + 30} {bl[1] - 30} L {top[0] - 30} {top[1] + 30}",
                  stroke=INK_3, w=1.5, dash="4 5"))
    s.append(T(bl[0] - 60, (bl[1]+top[1])//2, "(thinks)",
               font=SF_MONO, size=12, weight=600, fill=INK_3, anchor="end"))
    # The PREDATOR — standing at the model's elbow
    s.append(CIRC(br[0] + 110, br[1] - 28, 26, fill=RED))
    s.append(T(br[0] + 110, br[1] - 22, "PRED", font=SF_MONO, size=10, weight=800,
               fill=PAPER, anchor="middle", tracking=0.8))
    s.append(T(br[0] + 110, br[1] - 8, "ATOR", font=SF_MONO, size=10, weight=800,
               fill=PAPER, anchor="middle", tracking=0.8))
    s.append(PATH(f"M {br[0] + 92} {br[1] - 38} L {br[0] + 26} {br[1] - 8}",
                  stroke=RED, w=2, dash="3 3"))
    s.append(T(br[0] + 130, br[1] - 70, "pays the mediator",
               font=SF_MONO, size=13, weight=700, fill=RED, tracking=0.52))
    s.append(T(br[0] + 130, br[1] - 52, "collects the rent",
               font=SF_MONO, size=13, weight=700, fill=RED, tracking=0.52))

    # Bottom footer — the killer line
    s.append(T(W//2, H - 200, "“We don't want what we want.", font=NY_SERIF, size=32,
               weight=500, fill=INK, anchor="middle", italic=True, tracking=-0.512))
    s.append(T(W//2, H - 158, "We want what the other wants.”",
               font=NY_SERIF, size=32, weight=500, fill=INK, anchor="middle",
               italic=True, tracking=-0.512))
    s.append(T(W//2, H - 110, "RENÉ GIRARD · DECEIT, DESIRE, AND THE NOVEL · 1961",
               font=SF_MONO, size=13, weight=700, fill=INK_3, anchor="middle", tracking=2.34))
    return make_svg(W, H, "\n".join(s))


# ===== THEORY 02 — THE LIMIT =====
def build_limit():
    W, H, s = theory_card(
        "THEORY · 02",
        "Start winning.", "Watch the door close.",
        "Internal mediation — the closer your model, the more violent the imitation. The path from retail to pro looks open. The moment you start using it, the system removes the rungs above you.",
        [],
    )
    # Two columns: LEFT = the dream, RIGHT = the limit notification
    # Dream column — "becoming the pro"
    dx, dy = 160, 460
    dw, dh = 700, 700
    s.append(R(dx, dy, dw, dh, fill=PAPER_2, stroke=RULE_2, rx=18))
    s.append(T(dx + dw//2, dy + 60, "THE OPEN ROAD", font=SF_MONO, size=14, weight=700,
               fill=INK_3, anchor="middle", tracking=2.52))
    s.append(T(dx + dw//2, dy + 130, "what they sold you",
               font=NY_SERIF, size=24, weight=500, fill=INK_2, anchor="middle",
               italic=True, tracking=-0.384))
    # Stair-step "ladder" visual
    rungs = ["retail", "small-funded", "prop firm", "fund LP", "principal trader"]
    for i, rung in enumerate(rungs):
        y = dy + 220 + i * 78
        s.append(L(dx + 80, y, dx + dw - 80, y, stroke=INK_3, w=1.5, opacity=0.4))
        s.append(T(dx + 100, y - 12, rung.upper(), font=SF_MONO, size=14, weight=700,
                   fill=INK, tracking=1.12))
    s.append(T(dx + dw//2, dy + dh - 50, "the deck of cards they showed you",
               font=SF_MONO, size=12, weight=600, fill=INK_3, anchor="middle"))

    # Limit notification column — "the moment you start winning"
    lx, ly = 940, 460
    lw, lh = 700, 700
    s.append(R(lx, ly, lw, lh, fill=INK, rx=18))
    s.append(T(lx + lw//2, ly + 60, "DRAFTKINGS · YOUR ACCOUNT", font=SF_MONO,
               size=14, weight=700, fill=BLUE_T, anchor="middle", tracking=2.52))
    s.append(T(lx + lw//2, ly + 200, "MAX BET", font=SF_MONO, size=15, weight=700,
               fill=PAPER, anchor="middle", tracking=2.7, opacity=0.85))
    s.append(T(lx + lw//2, ly + 320, "$1.37",
               font=SF_DISPLAY, size=180, weight=800, fill=PAPER, anchor="middle",
               tracking=-3.96))
    s.append(T(lx + lw//2, ly + 400, "limit applied · 14 hours after VIP invite",
               font=SF_TEXT, size=18, weight=500, fill=PAPER, anchor="middle",
               tracking=-0.18, opacity=0.85))
    # Reddit quote
    s.append(T(lx + lw//2, ly + 510, "“I got up 40k and my host politely told me",
               font=NY_SERIF, size=22, weight=500, fill=PAPER, anchor="middle",
               italic=True, tracking=-0.352))
    s.append(T(lx + lw//2, ly + 542, "to fuck off lol.”",
               font=NY_SERIF, size=22, weight=500, fill=PAPER, anchor="middle",
               italic=True, tracking=-0.352))
    s.append(T(lx + lw//2, ly + 596, "u/Live-Horror · r/sportsbook",
               font=SF_MONO, size=13, weight=700, fill=BLUE_T, anchor="middle",
               tracking=0.52))

    # Bottom — the structural claim
    s.append(T(W//2, H - 200, "“Scumbag piece of fucking shit sportsbooks fucking bums.”",
               font=NY_SERIF, size=28, weight=500, fill=INK, anchor="middle",
               italic=True, tracking=-0.448))
    s.append(T(W//2, H - 160, "u/MomCallsMeLowlife · r/sportsbook · on five years of getting limited",
               font=SF_MONO, size=13, weight=700, fill=INK_3, anchor="middle", tracking=2.34))
    s.append(T(W//2, H - 110, "The ladder is real. The rungs above you are not.",
               font=NY_SERIF, size=22, weight=500, fill=INK, anchor="middle",
               italic=True, tracking=-0.352))
    return make_svg(W, H, "\n".join(s))


# ===== THEORY 03 — THE SKANDALON REVEALED =====
def build_skandalon():
    W, H, s = theory_card(
        "THEORY · 03 · REVELATION",
        "You knew.", "You came back.",
        "The skandalon is the obstacle that fascinates. Once named, the spell breaks. Tenev said it on camera. Reddit screenshotted it. Then everyone opened the app anyway.",
        [],
    )
    # Left: the quote (Tenev on camera)
    qx, qy = 120, 460
    qw = 820
    s.append(R(qx, qy, qw, 700, fill=INK, rx=18))
    s.append(T(qx + qw//2, qy + 60, "CNBC · DECEMBER 2023", font=SF_MONO,
               size=14, weight=700, fill=BLUE_T, anchor="middle", tracking=2.52))
    quote_lines = [
        "“I make more money",
        "by getting you",
        "to transact more.”",
    ]
    for i, line in enumerate(quote_lines):
        s.append(T(qx + qw//2, qy + 200 + i * 96, line, font=NY_SERIF, size=68,
                   weight=500, fill=PAPER, anchor="middle", italic=True, tracking=-1.088))
    s.append(T(qx + qw//2, qy + 600, "VLADIMIR TENEV · CEO, ROBINHOOD",
               font=SF_MONO, size=15, weight=700, fill=BLUE_T, anchor="middle", tracking=2.7))
    s.append(T(qx + qw//2, qy + 632, "live, on camera, no retraction",
               font=SF_TEXT, size=17, weight=500, fill=PAPER, anchor="middle",
               italic=True, opacity=0.85, tracking=-0.17))

    # Right: the user's response
    rx, ry = 980, 460
    rw = 700
    s.append(R(rx, ry, rw, 700, fill=PAPER_2, stroke=RULE_2, rx=18))
    s.append(T(rx + rw//2, ry + 60, "THE USER · ONE DAY LATER", font=SF_MONO,
               size=14, weight=700, fill=INK_3, anchor="middle", tracking=2.52))

    # Reddit-style post
    s.append(T(rx + 60, ry + 140, "u/anonymous · r/wallstreetbets",
               font=SF_MONO, size=14, weight=700, fill=INK_3, tracking=1.12))
    rline = [
        "Thanks Robinhood,",
        "still won't use",
        "your fucking app",
        "though.",
    ]
    for i, line in enumerate(rline):
        s.append(T(rx + 60, ry + 220 + i * 48, line, font=NY_SERIF, size=40,
                   weight=500, fill=INK, italic=True, tracking=-0.64))

    # App-store rating panel
    s.append(L(rx + 60, ry + 488, rx + rw - 60, ry + 488, stroke=RULE))
    s.append(T(rx + 60, ry + 528, "ROBINHOOD — APP STORE", font=SF_MONO, size=13,
               weight=700, fill=INK_3, tracking=2.34))
    s.append(T(rx + 60, ry + 596, "4.2 ★ · 4.1M ratings",
               font=SF_DISPLAY, size=48, weight=800, fill=INK, tracking=-1.056))
    s.append(T(rx + 60, ry + 640, "26M monthly active users · still climbing",
               font=SF_TEXT, size=16, weight=500, fill=INK_2, tracking=-0.16))

    # Bottom — the reveal
    s.append(T(W//2, H - 200, "Knowing was not the cure. Knowing was the trap.",
               font=NY_SERIF, size=36, weight=500, fill=INK, anchor="middle",
               italic=True, tracking=-0.576))
    s.append(T(W//2, H - 130, "GIRARD · BATTLING TO THE END · 2007",
               font=SF_MONO, size=14, weight=700, fill=INK_3, anchor="middle", tracking=2.52))
    return make_svg(W, H, "\n".join(s))


# ===== THEORY 04 — THE PHARMAKON =====
def build_pharmakon():
    W, H, s = theory_card(
        "THEORY · 04",
        "Every gift is", "the wound.",
        "Pharmakon — the same substance heals and poisons. The free trade is the harvest. The price improvement is the cut. The smart-money alert is the leash.",
        [],
    )
    # Three "gifts" side by side, each shown as a Apple-style receipt card
    # Width per card: 520, gap 40
    gift_w = 520
    gift_h = 720
    gift_y = 460
    centre = W // 2
    positions = [
        (centre - gift_w - 40 - gift_w//2, "FREE TRADING", "$0.00",
         "ROBINHOOD APP", "you paid", "$15 / 500 shares",
         "Schwarz et al., Journal of Finance"),
        (centre - gift_w//2, "PRICE IMPROVEMENT", "+$0.20",
         "CITADEL EXECUTION", "you missed", "$3.50 of spread",
         "internalised at NBBO midpoint"),
        (centre + 40 + gift_w//2, "SMART-MONEY ALERT", "FREE",
         "TWITTER / DISCORD", "you became", "exit liquidity",
         "the alert was the trap"),
    ]
    for cx, label, gift_val, source, paid_label, paid_val, footnote in positions:
        x = cx - gift_w // 2
        # The "gift" side, blue tint
        s.append(R(x, gift_y, gift_w, gift_h//2, fill=BLUE_T, stroke=BLUE, rx=18))
        s.append(T(x + gift_w//2, gift_y + 50, "THE GIFT", font=SF_MONO, size=13,
                   weight=700, fill=BLUE, anchor="middle", tracking=2.34))
        s.append(T(x + gift_w//2, gift_y + 130, label, font=SF_TEXT, size=20,
                   weight=700, fill=INK, anchor="middle", tracking=-0.22))
        s.append(T(x + gift_w//2, gift_y + 230, gift_val, font=SF_DISPLAY, size=72,
                   weight=800, fill=BLUE, anchor="middle", tracking=-1.584))
        s.append(T(x + gift_w//2, gift_y + 280, source, font=SF_MONO, size=12,
                   weight=600, fill=INK_3, anchor="middle", tracking=0.96))

        # The "wound" side, red tint
        ws = gift_h // 2
        s.append(R(x, gift_y + ws, gift_w, ws, fill=RED_T, stroke=RED, rx=18))
        s.append(T(x + gift_w//2, gift_y + ws + 50, "THE WOUND", font=SF_MONO, size=13,
                   weight=700, fill=RED, anchor="middle", tracking=2.34))
        s.append(T(x + gift_w//2, gift_y + ws + 130, paid_label, font=SF_TEXT, size=20,
                   weight=700, fill=INK, anchor="middle", tracking=-0.22))
        s.append(T(x + gift_w//2, gift_y + ws + 230, paid_val, font=SF_DISPLAY, size=44,
                   weight=800, fill=RED, anchor="middle", tracking=-0.968))
        s.append(T(x + gift_w//2, gift_y + ws + 290, footnote, font=SF_TEXT, size=14,
                   weight=500, fill=INK_2, anchor="middle", italic=True, tracking=-0.14))

    # Bottom
    s.append(T(W//2, H - 200, "“What heals is what kills, in the same hand.”",
               font=NY_SERIF, size=32, weight=500, fill=INK, anchor="middle",
               italic=True, tracking=-0.512))
    s.append(T(W//2, H - 130, "DERRIDA AFTER PLATO · LA PHARMACIE · 1972",
               font=SF_MONO, size=14, weight=700, fill=INK_3, anchor="middle", tracking=2.52))
    return make_svg(W, H, "\n".join(s))


# ===== VOICES CARD (narrow strip beside each mechanism) =====
# Each post tuple: (mini_header, username, sub, time_ago, body, upvotes, comments)
VOICES_DATA = {
    "01-toxic-flow": [
        ("SPREADS", "u/eatingpeopleisqueasy", "r/Forex", "2y",
         "Watch out — the house (MM) always wins, mathematically. Hence you always see 70/30 - 65/35% of clients lose money.",
         "1.2k", "87"),
        ("THE WIDEN", "u/lossmaker_99", "r/options", "6mo",
         "Filled at offer. Watched the bid drop $0.10 in 200ms. Tried to scratch. Already a different book.",
         "412", "28"),
    ],
    "02-stop-hunting": [
        ("LEVEL 3 DATA", "u/anon", "r/Daytrading", "3y",
         "MM have level 3, so they can see the stops. Most people play similar style putting stops near obvious support.",
         "3.4k", "214"),
        ("WICK HUNT", "u/Firm_Diet", "r/Daytrading", "1y",
         "Stopped out for −$3,000. I wouldn't have held this whole trade but would've been +$12,000.",
         "892", "64"),
        ("FTX", "u/No_Fuel_4676", "r/CryptoCurrency", "2y",
         "There was not one time I didn't buy either the top or bottom with 2x on FTX. Almost instantly after buying price went against me and activated stop loss.",
         "2.1k", "156"),
    ],
    "03-cross-venue": [
        ("VENUE LAG", "u/My_Rhythm875", "r/CryptoCurrency", "3mo",
         "If u were holding long positions, you probably got wicked out before you could even blink. We saw btc slice through 85k like it wasn't even there.",
         "4.8k", "318"),
        ("MARKET MAKERS", "u/Samurailaronkes", "r/CryptoCurrency", "8mo",
         "Three companies decide if you get liquidity. DWF. Wintermute. GSR. Say the names. Know them. Because they own you.",
         "6.2k", "412"),
    ],
    "04-latency": [
        ("STALE LINES", "u/jirachi_2000", "r/sportsbook", "1y",
         "Lines are way too tight. Books move instantly on any info. See value, place bet, line's already shifted.",
         "743", "52"),
        ("INSIDER WALLETS", "u/EthanTruthSeeker", "r/Polymarket", "4mo",
         "Bro has access to information that hasn't happened yet and we're sitting here reading charts like idiots.",
         "5.1k", "287"),
    ],
    "05-information": [
        ("INSIDER WALLETS", "u/Due-Radish1719", "r/Polymarket", "2mo",
         "How is an account being created in april 2026 and risk $17M in geopolitics… like they know something already.",
         "7.8k", "521"),
        ("HARVARD STUDY", "u/MundaneUniversity436", "r/Polymarket", "5mo",
         "A Harvard paper estimated roughly $143M in profits trace back to wallets with apparent insider information.",
         "4.3k", "198"),
    ],
    "06-spoofing": [
        ("FAKE WALLS", "u/sightwhale", "r/Polymarket", "7mo",
         "That's a fake liquidity wall. The MMs and whales use these to trick you into bad trades and siphon money from people who don't understand the order book.",
         "3.6k", "184"),
        ("ORDERBOOK TRICKS", "u/immortalismmmm", "r/Polymarket", "3mo",
         "Bro the fake wall trick has gotten me so many times lmao. You watch that big order just evaporate right as you click buy.",
         "1.9k", "96"),
    ],
    "07-pfof": [
        ("ROBINHOOD", "u/anon", "r/wallstreetbets", "1y",
         "Thanks Robinhood, still won't use your fucking app though.",
         "6.7k", "234"),
        ("CITADEL", "u/anon", "r/wallstreetbets", "2y",
         "Citadel is your daddy. Not Elon.",
         "8.4k", "412"),
        ("HARD DATA", "Schwarz et al.", "Journal of Finance · 2023", "—",
         "Robinhood users losing on average $15 on each 500-share order, even after paying zero commissions.",
         "2.4k", "178"),
    ],
}

# Reddit-style avatar palette — flat, calm, recognisable.
_AVATAR_PALETTE = [
    "#FF4500",  # Reddit orange
    "#0079D3",  # Reddit blue
    "#46A508",  # green
    "#7193FF",  # periwinkle
    "#A06A42",  # brown
    "#00A6A5",  # teal
    "#FF66AC",  # pink
    "#FFB000",  # amber
]

def _avatar_color(username):
    """Stable per-username flat color."""
    h = 0
    for ch in username:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return _AVATAR_PALETTE[h % len(_AVATAR_PALETTE)]


def _initial(username):
    """First alpha character of the username, uppercased.
    Strips a leading 'u/' or 'r/' if present."""
    name = username
    if name.startswith("u/") or name.startswith("r/"):
        name = name[2:]
    for ch in name:
        if ch.isalpha():
            return ch.upper()
    return "?"


def mini_header(x, y, w, label):
    """Topic label above a post.
    SF Mono 12px / 700 / +2.16px tracking / uppercase / #6E6E73.
    Followed by a 1px #E8E8ED divider at y + 14."""
    s = []
    s.append(T(x, y, label, font=SF_MONO, size=12, weight=700,
               fill=INK_3, tracking=2.16))
    s.append(L(x, y + 14, x + w, y + 14, stroke=RULE_2, w=1))
    return s


def reddit_post(x, y, w, username, sub, time_ago, body, upvotes, comments):
    """One Reddit-styled post card. Returns (svg_fragments, total_height).
    Layout, top-down:
      - 16px top padding
      - 32px avatar circle (centre at y+32)
      - meta line: `u/username · r/sub · time` at y+38 (mono 13/600/#6E6E73)
      - 16px gap below meta
      - body text (SF Pro Text 17/400/#1D1D1F), wrapped, 24px line-height
      - 12px gap
      - footer row: chevron + upvotes  ·  comment-icon + comments
      - 16px bottom padding
    """
    pad_x = 16
    inner_w = w - pad_x * 2
    avatar_r = 16
    avatar_cx = x + pad_x + avatar_r
    avatar_cy = y + 16 + avatar_r  # 32

    # Body wrap. Roughly 32 chars per line at the 504px inner width on
    # a 17px SF Pro Text — Reddit-comfortable.
    body_lines = wrap_text(body, width=42)
    body_top = y + 76
    line_h = 24
    body_h = len(body_lines) * line_h

    footer_y = body_top + body_h + 14
    total_h = (footer_y - y) + 16 + 12  # bottom padding + footer band

    s = []
    # Card
    s.append(R(x, y, w, total_h, fill=PAPER, stroke=RULE_2, stroke_w=1, rx=12))

    # Avatar
    color = _avatar_color(username)
    s.append(CIRC(avatar_cx, avatar_cy, avatar_r, fill=color))
    s.append(T(avatar_cx, avatar_cy + 5, _initial(username),
               font=SF_DISPLAY, size=14, weight=700, fill=PAPER, anchor="middle"))

    # Meta line — `u/username · r/sub · time`
    meta_x = avatar_cx + avatar_r + 12
    meta = f"{username} · {sub} · {time_ago}"
    s.append(T(meta_x, avatar_cy + 5, meta,
               font=SF_MONO, size=13, weight=600, fill=INK_3, tracking=0.143))

    # Body
    for i, line in enumerate(body_lines):
        s.append(T(x + pad_x, body_top + i * line_h, line,
                   font=SF_TEXT, size=17, weight=400, fill=INK,
                   tracking=-0.374))

    # Footer row — chevron (orange) + upvote count, then comment bubble + count
    fx = x + pad_x
    fy = footer_y
    # Chevron up — small triangle path
    s.append(PATH(f"M {fx} {fy + 10} L {fx + 7} {fy + 3} L {fx + 14} {fy + 10}",
                  stroke="#FF4500", fill="none", w=2))
    s.append(T(fx + 22, fy + 11, upvotes,
               font=SF_MONO, size=13, weight=700, fill=INK_3, tracking=0.143))

    # Comment icon — small speech bubble drawn as rounded rect with tail
    cx0 = fx + 22 + max(28, len(upvotes) * 9) + 24
    s.append(R(cx0, fy - 1, 16, 12, fill="none", stroke=INK_3,
               stroke_w=1.5, rx=2))
    s.append(PATH(f"M {cx0 + 3} {fy + 11} L {cx0 + 5} {fy + 14} L {cx0 + 7} {fy + 11}",
                  stroke=INK_3, fill="none", w=1.5))
    s.append(T(cx0 + 24, fy + 11, comments,
               font=SF_MONO, size=13, weight=700, fill=INK_3, tracking=0.143))

    return s, total_h


def build_voices(mech_id):
    """Narrow voice strip — placed beside the mechanism card.
    Dimensions: 600 wide × 2050 tall (matches mechanism height).
    Layout: existing header block → for each voice, mini-header + post."""
    W, H = 600, 2050
    voices = VOICES_DATA[mech_id]
    s = []

    # ----- Header (kept from previous version) -----
    s.append(T(W//2, 100, "VOICES", font=SF_MONO, size=15, weight=700,
               fill=BLUE, anchor="middle", tracking=2.7))
    s.append(T(W//2, 156, "From below the tape", font=NY_SERIF, size=32, weight=500,
               fill=INK, anchor="middle", italic=True, tracking=-0.512))
    s.append(L(80, 200, W - 80, 200, stroke=BLUE, w=2))

    # ----- Posts -----
    margin_x = 40
    col_w = W - margin_x * 2  # 520
    cy = 260
    gap_after_label = 24      # divider sits at label_y+14, then post starts gap below
    gap_between_blocks = 40   # space between two voice blocks
    for entry in voices:
        label, username, sub, time_ago, body, upvotes, comments = entry
        # Mini-header
        s.extend(mini_header(margin_x, cy, col_w, label))
        post_y = cy + gap_after_label + 4
        frags, post_h = reddit_post(margin_x, post_y, col_w,
                                     username, sub, time_ago, body,
                                     upvotes, comments)
        s.extend(frags)
        cy = post_y + post_h + gap_between_blocks

    return make_svg(W, H, "\n".join(s))


# ===== SECTION DIVIDER =====
def build_divider():
    W, H = 2400, 280
    s = []
    s.append(L(W//2 - 900, H//2, W//2 - 360, H//2, stroke=INK, w=2))
    s.append(L(W//2 + 360, H//2, W//2 + 900, H//2, stroke=INK, w=2))
    s.append(T(W//2, H//2 + 12, "THE SEVEN MECHANISMS", font=SF_MONO, size=22,
               weight=700, fill=INK, anchor="middle", tracking=3.96))
    return make_svg(W, H, "\n".join(s))


# ===== FIX CARD (closing) =====
def build_fix():
    W, H = 2400, 1600
    s = []
    # Eyebrow
    s.append(T(W//2, 120, "THE FIX · ONE PRIMITIVE", font=SF_MONO, size=18,
               weight=700, fill=INK_3, anchor="middle", tracking=3.24))
    # Massive title
    s.append(T(W//2, 290, "BLOCK", font=SF_DISPLAY, size=140, weight=800,
               fill=INK, anchor="middle", tracking=-3.08))
    s.append(T(W//2, 430, "TRADING", font=NY_SERIF, size=140, weight=500,
               fill=BLUE, anchor="middle", italic=True, tracking=-2.24))
    # Subtitle
    s.append(T(W//2, 510, "sealed bets · parimutuel settlement · one clearing price per round",
               font=SF_TEXT, size=24, weight=500, fill=INK_3, anchor="middle", tracking=-0.288))

    # Seven checkmarks
    cy = 660
    items = [
        ("01", "Toxic-flow market making", "no MM, no widen"),
        ("02", "Stop & liquidation hunting", "no order book, no stops to read"),
        ("03", "Cross-venue arbitrage", "one venue, one clearing price"),
        ("04", "Latency arbitrage", "sealed batch, microseconds = nothing"),
        ("05", "Information edge", "resolves against an oracle, not a counterparty"),
        ("06", "Spoofing & layering", "no order book, no wall to fake"),
        ("07", "Payment for order flow", "parimutuel pool, no wholesaler"),
    ]
    cell_w = 320
    n_cols = 4
    n_rows = 2
    grid_w = cell_w * n_cols + 30 * (n_cols - 1)
    grid_x = (W - grid_w) // 2
    for i, (num, name, fix) in enumerate(items):
        col = i % n_cols
        row = i // n_cols
        cx = grid_x + col * (cell_w + 30)
        cy_pos = cy + row * 270
        s.append(R(cx, cy_pos, cell_w, 240, fill=BLUE_T, stroke=BLUE, rx=18))
        # Checkmark circle
        s.append(CIRC(cx + cell_w//2, cy_pos + 50, 28, fill=BLUE))
        s.append(T(cx + cell_w//2, cy_pos + 60, "✓", font=SF_DISPLAY, size=32,
                   weight=800, fill=PAPER, anchor="middle"))
        # Number
        s.append(T(cx + cell_w//2, cy_pos + 110, num, font=SF_MONO, size=13,
                   weight=700, fill=BLUE, anchor="middle", tracking=2.34))
        # Name
        s.append(T(cx + cell_w//2, cy_pos + 142, name, font=SF_TEXT, size=18,
                   weight=700, fill=INK, anchor="middle", tracking=-0.198))
        # Fix
        s.append(T(cx + cell_w//2, cy_pos + 192, fix, font=SF_TEXT, size=14,
                   weight=500, fill=INK_3, anchor="middle", italic=True, tracking=-0.14))

    # Closing line
    s.append(T(W//2, H - 110, "“If you can't trade like a hedge fund,",
               font=NY_SERIF, size=32, weight=500, fill=INK, anchor="middle",
               italic=True, tracking=-0.512))
    s.append(T(W//2, H - 64, "trade where hedge funds trade like you.”",
               font=NY_SERIF, size=32, weight=500, fill=BLUE, anchor="middle",
               italic=True, tracking=-0.512))
    return make_svg(W, H, "\n".join(s))


BUILDERS = [
    ("00-hero", build_hero),
    ("0A-triangle", build_triangle),
    ("0B-limit", build_limit),
    ("0C-skandalon", build_skandalon),
    ("0D-pharmakon", build_pharmakon),
    ("99-divider", build_divider),
    ("99-fix", build_fix),
]

if __name__ == "__main__":
    for name, fn in BUILDERS:
        svg = fn()
        (OUT / f"{name}.svg").write_text(svg)
        print(f"  wrote {name}.svg ({len(svg)} bytes)")
    # Voice strips
    for mech_id in VOICES_DATA:
        svg = build_voices(mech_id)
        (OUT / f"voices-{mech_id}.svg").write_text(svg)
        print(f"  wrote voices-{mech_id}.svg ({len(svg)} bytes)")
    print(f"\nDone. Output: {OUT}")
