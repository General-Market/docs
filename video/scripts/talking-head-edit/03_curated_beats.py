#!/usr/bin/env python3
"""
Hand-curated English cut list — best take of each beat, with word-level
trimming where the stutter is inside a WhisperX segment.

How it works:
 - `beats` lists `(start, end, "label")` tuples in playback order.
 - If a `start` lands inside a stuttered WhisperX segment that begins with
   a duplicate phrase, set `start` to the timestamp where the speaker
   finally got the clean take going. Look up word timestamps in
   /tmp/anticheat-aligned-merged.json for these moments.

Each label corresponds to one numbered line in /tmp/full-script-en.txt
so the editor can cross-check.
"""
import json
import shutil
from pathlib import Path

ALIGNED = Path("/tmp/anticheat-aligned-merged.json")
OUT     = Path("/tmp/anticheat-cuts.json")
COMP    = Path("/Users/maxguillabert/Downloads/index/video/src/compositions/anticheat-edit/cuts.json")
PAD = 0.20

# Beats — best take of each piece of the script, in order.
# Source line numbers reference /tmp/full-script-en.txt.
beats = [
    # ── INTRO (small file 16:29, per request) ─────────────────────────────
    (   5.58,  11.12, "S1  Hook: if you are a trader but don't make as much money as a market maker [SMALL]"),
    (  11.60,  18.02, "S2  13 mechanisms every market maker uses to make more than you [SMALL]"),
    (  25.73,  32.94, "S4  I traded 1B volume — options, prediction markets, memecoins [SMALL]"),
    (  39.06,  46.55, "S6  And I built index and perp protocol myself [SMALL] — end before stray 'The'"),
    (  67.67,  79.60, "S9  Mission: empower the next generation to have the same winning odds [SMALL]"),
    ( 167.38, 169.27, "L25  Let's start with number one [large]"),

    # ── POINT 1 — Colocation (spoken "Colocation." dropped: title card covers it)
    ( 220.32, 227.37, "L30  If you ever saw a red candle but weren't fast enough — someone caught it before you"),
    ( 228.31, 233.36, "L31  Because some market participants are faster than you"),
    ( 245.30, 251.49, "L34  In colocation, market maker buys slots next to the exchange to be faster"),
    ( 267.75, 279.38, "L36  What MMs do: you trade Paris → Tokyo server"),
    ( 288.15, 291.05, "L38  Your trade will take 200 milliseconds [RESTORED]"),
    ( 292.32, 301.20, "L39  They pay the company for servers in the same bay as the order books"),
    ( 347.74, 356.47, "L41-42  This is a practice every exchange does; MMs pay up to 200K/month"),
    ( 358.07, 368.89, "L43-44  Some exchanges sell it clearly; others, it's decentralized"),
    ( 405.26, 412.59, "L48  So whenever in backtest you feel you have an edge — someone is before you  [L47 200K dup dropped]"),
    ( 420.87, 424.12, "L49  And here you have the proof every exchange does this"),
    ( 429.69, 431.97, "L50  If you want to read more, we made a blog"),

    # ── POINT 2 — Unfair fee tier ────────────────────────────────────────
    ( 437.88, 439.92, "L51  Title: unfair fee tier"),
    ( 443.43, 471.09, "L53  Strategy at 30 bps vs. arbitrage at 2-4 bps — MMs have lower tiers"),
    ( 473.82, 496.44, "L54  If you don't pay, don't earn, don't have MM access — these strategies aren't for you"),
    ( 526.05, 535.25, "L58  If you do market making or arbitrage, many strategies are 2-4 bps profitable"),
    ( 536.00, 541.77, "L59  But on those exchanges, you need to pay enough in fees, volume, or programs"),
    ( 543.74, 569.07, "L60  Minimum fees > your edge → forced into directional, riskier strategies"),
    ( 575.94, 585.43, "L61  Depending on broker, edge can go from 5% to 3 bps"),
    ( 585.45, 589.60, "L62  Every exchange you've ever traded on is affected"),

    # ── POINT 3 — Maxing out advantages ──────────────────────────────────
    ( 604.91, 608.92, "L64  Title: maxing out advantages"),
    ( 610.78, 615.51, "L65  Trading = how much you risk to get a reward"),
    ( 618.67, 626.28, "L66  If you pay the platform for advantages, it's like doing a trade"),
    ( 627.55, 630.83, "L67  You'll win more later because it's easier to win on the market"),
    ( 633.63, 648.35, "L68  Almost every exchange has MM programs — 100M to a few hundred K per month"),
    ( 650.13, 654.67, "L70  If players are willing to pay this, it means they're profitable"),
    ( 655.67, 661.94, "L71  Which means: people who don't pay are paying for them"),
    ( 661.96, 666.79, "L72  If your strategy works in backtest but not in life, this is maybe why"),

    # ── POINT 4 — Listing front-running ──────────────────────────────────
    ( 674.98, 699.06, "L73  Listing front-running: insiders know which tokens get listed → frontrun you"),
    ( 702.85, 707.90, "L74  They don't take direct money — they take a statistical edge"),
    ( 710.44, 722.13, "L75  1000 trades → won't affect all, but will affect some hugely"),
    ( 722.99, 732.76, "L76  Averaged out: you bleed slowly"),

    # ── POINT 5 — Unfair dealer flow visibility ──────────────────────────
    ( 739.56, 743.00, "L77  Title: unfair dealer flow visibility"),
    ( 745.08, 750.25, "L78  Everyone trades on the exchange but can't see who's trading what"),
    ( 751.85, 760.79, "L79  Some participants buy access to this data — know who tends to lose"),
    ( 764.83, 769.60, "L81  They know who wins, who loses, when, where"),
    ( 770.85, 778.92, "L82  Gives them a new class of strategy nobody else can run"),
    ( 781.23, 783.45, "L83  Affects almost every exchange"),
    ( 788.09, 815.73, "L84  Order books need private servers; on-chain isn't fast enough; you can't avoid this"),
    ( 821.69, 829.54, "L86  The only way to avoid this is not to trade on order books"),

    # ── POINT 6 — Order flows ────────────────────────────────────────────
    ( 850.22, 851.99, "L87  Title: order flows"),
    ( 857.24, 867.42, "L90  In TradFi / CFDs you trade against a broker directly"),
    ( 867.89, 871.41, "L91  Who charges you spread every time you trade"),
    ( 871.98, 878.10, "L92  Every zero-fee CFD runs on this business model"),
    ( 878.68, 894.29, "L93  Studies: zero-fee exchanges cost more in spread than fee-paying ones"),

    # ── POINT 7 — Fair feed latency ──────────────────────────────────────
    ( 897.98, 926.45, "L94  Free lunch: see other trades first → faster to react → easy win"),
    ( 927.93, 930.84, "L95  Once again, almost every exchange has these programs"),
    ( 931.12, 934.70, "L96  Without it, you're the one losing"),
    ( 935.12, 955.69, "L97  Only way out: become a market maker, or trade products without latency edge"),

    # ── POINT 8 — Unfair matching & giant priority ───────────────────────
    ( 968.45, 995.54, "L98  In some exchanges, MM trades get filled before yours at same price"),
    ( 997.14, 1003.84, "L99  Lots of this in DeFi via complex MEV setups"),
    (1003.86, 1009.58, "L100  Sophisticated trading desks can win with that"),
    (1027.83, 1034.64, "L101  In normal exchanges: 'order among key priorities'"),
    (1035.02, 1045.74, "L102  Maker can shrink an order book without losing queue place"),

    # ── POINT 9 — Cancellation priorities ────────────────────────────────
    (1060.58, 1063.44, "L104  Title: cancellation priorities"),
    (1064.86, 1072.37, "L105  Someone can cancel before you, even if you asked at the same time"),
    (1080.35, 1085.40, "L107  Information first → take your order first → faster reaction"),
    (1085.84, 1094.39, "L108  Last to react = loses statistical edge = loses P&L"),
    (1097.63, 1105.25, "L109  Even on highly directional strategies — multiple percent per trade"),
    (1106.54, 1112.72, "L110  1000 trades → tiny invisible fee on each one"),

    # ── POINT 10 — Unfair API rate limits ────────────────────────────────
    (1116.67, 1118.03, "L111  Title: unfair API rate limits"),
    (1118.75, 1127.60, "L112  More API calls → more complex strategies, see more, trade more"),
    (1129.27, 1133.37, "L113  Once again, a technical edge on you"),

    # ── POINT 11 — Unfair funding rate boundary ──────────────────────────
    (1138.84, 1142.89, "L115  Title: unfair funding rate boundary"),
    (1143.85, 1154.58, "L116  Funding happening in 2 minutes — but you can't arbitrage it"),
    (1155.46, 1164.03, "L117  MMs pay exchanges for the edge; you don't have access"),

    # ── POINT 12 — MM programs / quotes ──────────────────────────────────
    (1186.93, 1209.09, "L118  Even worse: MM programs paying for quotes — exchanges need liquidity"),
    (1210.15, 1216.78, "L119  Pro MMs go to the exchange that pays them the most"),
    (1217.80, 1240.12, "L120  Exchanges pay the winning participants → other participants pay for that"),
    (1241.76, 1270.08, "L121  Run unprofitable strategies that are still profitable due to the reward — you can never beat them"),

    # ── POINT 13 — Maker rebate tiers ────────────────────────────────────
    (1296.62, 1301.04, "L122-123  Title: maker rebate tiers — works similarly"),
    (1304.55, 1326.02, "L124  Similar to paying MMs, but rewards the top market maker on the venue"),

    # ── POINT 13b — Unfair liquidation engine ────────────────────────────
    (1347.24, 1371.56, "L125  Liquidation engine quirks: profitable position closed, MMs offered the liquidation"),
    (1381.30, 1399.15, "L127  Best fills (high candles) → given to MM programs  [L126 'MMs take liquidation' dup dropped]"),

    # ── SOLUTIONS / GENERAL MARKET PITCH ─────────────────────────────────
    (1407.42, 1436.01, "L128  All 13 mechanisms — large players use them — but there are solutions"),
    (1437.81, 1455.52, "L129  If you want to avoid this: trade on exchanges that don't allow it"),
    (1456.32, 1463.65, "L130  Problem: most exchanges run on order books / IMMs with all these issues"),
    (1464.56, 1470.25, "L131  With General Market, we create the first market in all finance"),
    (1471.15, 1476.17, "L132  First financial instrument that doesn't give this kind of edge"),
    (1480.66, 1488.03, "L134  You can live on the moon, trade in Tokyo, same edge as someone colocated to our servers"),
    (1496.65, 1506.24, "L135  No more unfair listing or insider trading using illegal information"),
    (1507.66, 1515.37, "L136  We group assets in batches of 10 to 10,000 — everyone trades together"),
    (1516.01, 1528.26, "L137  Instead of who is best on one market — who is best on 10,000 markets"),
    (1528.58, 1533.09, "L138  Who is better at finding directional data"),
    (1534.40, 1547.38, "L139  10,000 markets at once → patterns, not insider info"),
    (1552.98, 1572.41, "L140  Not for arbitrage / very technical — for people who learn, like, and find patterns"),
    (1587.85, 1595.56, "L141  I've received messages saying what I share isn't true"),
    (1596.95, 1607.51, "L142  I invite you to read the long list of everything that happened on these exchanges"),
    (1609.21, 1626.71, "L143  Only the public part, only what went to court — 10 to 100 more cases per public one"),
    (1633.55, 1636.45, "L146  It happens on every exchange with order books or IMM tech  [L144 dup dropped; orphan 'on.' trimmed]"),
    (1637.07, 1639.37, "L147  Not that exchanges are bad —"),
    (1639.85, 1646.00, "L148  business model: maintain an order book → you need this kind of practice"),
    (1656.59, 1664.27, "L151  They can only exist by removing your edge"),
    (1670.12, 1679.09, "L152  As builder of General — once I see what we're doing, I'll never trade on order books"),
    (1682.31, 1693.55, "L153  Polymarket case: 0.04% of traders get 70% of wins"),
    (1693.57, 1701.40, "L154  99.96% share only 30% of the winners"),
    (1703.22, 1708.61, "L155  If you think you're smarter than others, look at how much"),
    (1710.43, 1723.62, "L156  hedge funds spend on infrastructure — if you haven't spent 1M, you're the one being found"),

    # ── OUTRO / CTA ──────────────────────────────────────────────────────
    (1758.10, 1760.30, "L159  Join our Discord to know more  [timestamp fixed 1738→1758; was grabbing silence]"),
    (1783.20, 1794.31, "L162  CLEAN take: I hope this video will bring a spark — in 10 yrs you'll be glad to have avoided this  [was garbled 'will be have' take]"),
    (1810.87, 1824.05, "L164  Always choose your counterparty; if not technical, don't trade where technical players win 70%"),
]

# Build cuts.json.
segments = []
for i, (start, end, label) in enumerate(beats):
    s = max(0.0, start - PAD)
    e = end + PAD
    if i + 1 < len(beats):
        next_start = beats[i + 1][0]
        if e > next_start - 0.05:
            e = max(end, next_start - 0.05)
    segments.append({
        "start": round(s, 3),
        "end":   round(e, 3),
        "text":  label,
    })

kept = sum(s["end"] - s["start"] for s in segments)
src_total = max(s["end"] for s in segments)

out = {
    "source": "anticheat-edit/source.mp4",
    "duration_source": round(src_total, 3),
    "duration_cut":    round(kept, 3),
    "ratio":           round(kept / src_total, 3) if src_total else 0,
    "segments":        segments,
    "stats": {
        "method": "hand-curated from English transcript, one best take per beat",
        "pad_seconds": PAD,
        "beats": len(beats),
    },
}
json.dump(out, open(OUT, "w"), indent=2, ensure_ascii=False)
shutil.copy(OUT, COMP)
print(f"beats:    {len(beats)}")
print(f"kept:     {kept:.1f}s before speedup ({kept/1.2:.1f}s at 1.2× = {kept/1.2/60:.1f} min)")
print(f"ratio:    {out['ratio']*100:.0f}% of source kept")
print(f"-> {COMP}")
