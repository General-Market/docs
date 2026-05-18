#!/usr/bin/env python3
"""Score X-candidate bios for MM/quant/bot-dev fit."""
import csv
import re
import sys

KEEP = [
    (r"\bquant(s|itative)?\b", 3),
    (r"\b(market\s*making|market\s*maker|MM\s*bot|MM\s*firm)\b", 4),
    (r"\b(HFT|high[- ]frequency)\b", 4),
    (r"\b(vol(atility)?\s*(surface|trader|st|trading)|delta\s*hedge|gamma\s*(exposure|positioning)|dealer\s*positioning|theta|vanna|charm)\b", 3),
    (r"\b(derivs?|derivatives?)\b", 2),
    (r"\b(options?\s+(trader|trading|analyst|surface|flow|veteran))\b", 3),
    (r"\b(MEV|searcher|arb(itrage)?\s*bot|funding\s*arb|perp\s*basis|latency\s*arb|JIT\s*liquidity)\b", 3),
    (r"\b(bot\s*dev|algo\s*(trader|trading|dev)|trading\s*bot|searcher)\b", 3),
    (r"\b(data\s*analyst|physicist|risk\s*analyst|illiquid\s*strateg|risk\s*calc)\b", 2),
    (r"\b(paradex|thalex|deribit|laevitas|flowdesk|hyperliquid|GSR|wintermute|jane\s*street|jump|cumberland)\b", 2),
    (r"\b(prediction\s*market(s)?\s*(quant|trader|analyst|researcher))\b", 3),
    (r"\b(card\s*counter|card\s*counting)\b", 2),
    (r"\b(institutional[- ]grade|research|analyst)\b", 1),
    (r"\b(founder|CEO|CTO|head\s*of)\s*@?\w*(?:exchange|protocol|labs|capital|markets|fund|finance|trading|quant)\b", 2),
    (r"\b(hedge\s*fund)\b", 2),
    (r"@\s*paradex|@\s*ThalexGlobal|@\s*flowdesk|@\s*laevitas|@\s*Polymarket", 1),
]

DROP = [
    (r"\b(KOL|kol)\b", -4),
    (r"\bDM\s*(for|me|open|always)\s*(promo|marketing|inquir|business|collab|prom)", -4),
    (r"\b(growth\s*(strateg|manager|expert)|marketing\s*(strateg|manager))\b", -3),
    (r"\b(content\s*(creator|writer|manager))\b", -3),
    (r"\b(community\s*manager|brand\s*ambassador)\b", -3),
    (r"\b(creator\s*campaigns?|affiliate\s*program)\b", -3),
    (r"\bshitposter\b", -2),
    (r"#?\bDYOR\b", -1),
    (r"\b(memecoin|memes?\s*lover|$\w+\s*believer|$SOL\s*HOLDER|$XRP)\b", -3),
    (r"\b(daily\s*alpha|alpha\s*hunter|narrative)\b", -2),
    (r"\b(faith\s*&\s*finance|believer)\b", -3),
    (r"\b(degen|aper?|rug|gem)\b", -1),
    (r"\bDM\s*open\b", -1),
    (r"\b(sponsored|commissioned|paid\s*promotion)\b", -3),
    (r"\b(beginner|learner|hobby)\b", -1),
    (r"#̟Bitcoin|#crypto\s*lover|$\w+\s*army", -2),
]

def score(bio: str) -> tuple[int, list[str]]:
    if not bio:
        return -10, []
    s = 0
    hits = []
    for pat, w in KEEP + DROP:
        if re.search(pat, bio, re.IGNORECASE):
            s += w
            hits.append(f"{pat[:30]}={w:+d}")
    return s, hits


def main():
    rows = []
    with open(sys.argv[1]) as f:
        r = csv.DictReader(f, delimiter="\t")
        for row in r:
            try:
                fol = int(row["followers"])
            except (ValueError, KeyError, TypeError):
                continue
            s, hits = score(row.get("bio", ""))
            rows.append({
                "score": s,
                "followers": fol,
                "handle": row["handle"],
                "name": row.get("name", "")[:40],
                "bio": (row.get("bio", "") or "")[:140],
                "source": row.get("source", ""),
                "hits": ",".join(hits[:4]),
            })
    rows.sort(key=lambda r: (-r["score"], -r["followers"]))
    w = csv.DictWriter(sys.stdout, fieldnames=["score","followers","handle","name","bio","source","hits"], delimiter="\t")
    w.writeheader()
    for r in rows:
        w.writerow(r)


if __name__ == "__main__":
    main()
