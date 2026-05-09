# The Anti-Cheat

**Technical Review № 001 — General Market — generalmarket.io/case-studies/anticheat**

---

## How to publish this on X / Twitter Articles

1. Open the live page → `https://generalmarket.io/case-studies/anticheat/`
2. Each card has a **CARD ID** below — screenshot that card directly from the page (or use the standalone `cover.html` rendered at 1200×675 for the OG image).
3. In Twitter Articles, paste the prose between the `[IMAGE …]` markers and upload the corresponding image at each marker, using the **ALT** and **TITLE** strings provided so the X algorithm and screen readers can read every card.
4. Headings (`H1`, `H2`) map to Twitter Article heading buttons.

---

# H1 — The Anti-Cheat

[IMAGE — cover.png]
ALT: The Anti-Cheat — General Market Technical Review № 001. Trading has 8 named exploits, video games solved every one of them between 1992 and 2020.
TITLE: The Anti-Cheat — General Market
CARD: cover

---

## H2 — Part I — The Thesis

Markets are the largest competitive multiplayer game on earth, and the most curious thing about them is that no one ever bothered to install an anti-cheat. Three decades of fixes were patiently catalogued for video games while none were borrowed for trading, on the polite assumption that real money is too dignified to need the same protection as a deathmatch.

[IMAGE — part-1-thesis.png]
ALT: The Thesis — markets are the largest competitive multiplayer game on earth, and they have never had an anti-cheat.
TITLE: The Thesis
CARD: hero-card

The asymmetry has a number, and like everything paid in the long run, the number is patient and enormous.

---

## H2 — Part II — The Losses

What ninety-two years of writing rules onto a defenseless architecture have actually delivered:

- **$1.5B** in MEV extracted from Ethereum users since 2020 by mempool front-running.
- **$3.8B per year** paid to brokers for routing your order against you.
- **$920M** single fine to JPMorgan in 2020 for spoofing — after eight uninterrupted years of doing it.
- **$1T** in market cap erased in 36 minutes during the 2010 Flash Crash, by a single spoofer in a London bedroom.
- **$50B+** in crypto liquidations during 2024 alone, cascaded off stop levels every wallet politely advertises.
- **$25B per year** in HFT industry revenue whose entire product is the privilege of being one foot closer to the wire.

[IMAGE — part-2-losses.png]
ALT: The Losses — $1.5B MEV since 2020, $3.8B PFOF per year, $920M JPMorgan fine, $1T Flash Crash, $50B crypto liquidations, $25B HFT industry.
TITLE: The Losses
CARD: stats-card

Trading reached for lobbyists while gaming reached for engineers, and the eight problems they share now wear two different vocabularies as if vocabulary were a defense.

---

## H2 — Part III — The Translation

Eight exploits, two vocabularies, one identical mechanism underneath.

| Trading vocabulary | Gaming vocabulary |
| --- | --- |
| Frontrunning / MEV | wallhack |
| Latency arbitrage | ping advantage |
| Insider trading | aimbot |
| Stop & liquidation hunting | spawn camping |
| Spoofing & layering | rage-cancel |
| Orderflow purchase (PFOF) | pay-to-win |
| Toxic-flow market making | smurfing |
| Cross-venue divergence | region-hopping |

[IMAGE — part-3-translation.png]
ALT: The Translation — same eight problems in trading and gaming, with two different vocabularies.
TITLE: The Translation
CARD: vocab-card

The man who runs the world's largest game store has been studying cheaters longer than most regulators have been alive, and the rule he arrived at is shorter than any paragraph in the Securities Exchange Act.

---

## H2 — Part IV — The Citation

> **"Our goal is to make them more expensive for cheaters than the economic benefit they can reasonably expect to gain."**
>
> — *Gabe Newell, Valve, on VAC, 2014*

Gaben said it about Counter-Strike, where every cheater wakes up the next day looking for somewhere weaker to play; the same principle lets architecture do what no rule book ever did, which is to make the exploit cost more than it pays, until the cheater quietly finds something else to do with his afternoon.

[IMAGE — part-4-citation.png]
ALT: Gabe Newell — anti-cheat economics — make the exploit more expensive than the gain.
TITLE: The Citation — Gabe Newell on anti-cheat
CARD: quote-card

Before describing the seven primitives, one ought to describe the object they protect, which is in itself an indictment of the order book.

---

## H2 — Part V — The Block

A General Market block bundles **100 parimutuel prediction markets** into a single sealed envelope: one cent on each, **$1 per block**, every market resolving UP or DOWN against a price the chain settles via BLS-verified oracle consensus.

The block then runs three phases of ten minutes each:

1. **SUBMIT (10 min · sealed)** — every bet is committed as a cryptographic hash; nothing legible is on the wire.
2. **REVEAL (10 min · locked)** — bets unseal simultaneously; nothing can be retracted.
3. **CLAIM (10 min · parimutuel)** — winners draw from the pool against the losers, no market maker.

[IMAGE — part-5-block.png]
ALT: The Block — 100 parimutuel prediction markets, three phases (Submit, Reveal, Claim), sealed during submit, locked at reveal, parimutuel at claim.
TITLE: The Block — General Market architecture
CARD: block-card

Sealed during submit, locked at reveal, parimutuel at claim, BLS-verified oracle consensus settling each price — the architecture every primitive below describes, already on the chain.

Seven architectural primitives, each of them quietly putting an entire class of fraud out of work, all of them already inside the block.

---

## H2 — 01 · Fog of War — Dune II, Westwood, 1992

In gaming, the server holds the world and the client receives only the corner it is entitled to. In a General Market block, the same rule applies: inside the submit window the block carries one hundred hashed bets, and the mempool sees commitments where it expected to find prey.

[IMAGE — primitive-01-fog-of-war.png]
ALT: 01 Fog of War — In gaming, the server withholds the map. In trading, the GM block holds 100 sealed market commitments during the submit phase; the mempool reads the hash, not the bet.
TITLE: 01 — Fog of War — Dune II, 1992
CARD: prim-card-01

---

## H2 — 02 · Server-Authoritative — Quake, id Software, 1996

In gaming, the client proposes and the server decides; the client cannot lie about what occurred. In a General Market block, three oracles sign each price with BLS and consensus settles around them, while the wallet's claim is registered, ignored, and forgotten.

[IMAGE — primitive-02-server-authoritative.png]
ALT: 02 Server-Authoritative — In gaming, the client claims a hit and the server overrules it. In trading, three BLS oracles sign each market price and consensus settles, regardless of what the wallet says.
TITLE: 02 — Server-Authoritative — Quake, 1996
CARD: prim-card-02

---

## H2 — 03 · Lockstep Tick — StarCraft, Blizzard, 1998

In gaming, all inputs are collected and the tick advances only when everyone has committed; the order in which packets arrived is forgotten. In a General Market block, every bet inside the ten-minute submit window resolves at the same instant, and latency, the most expensive product on Wall Street, becomes the only one with a value of zero.

[IMAGE — primitive-03-lockstep.png]
ALT: 03 Lockstep Tick — In gaming, all four players commit before the tick resolves them simultaneously. In trading, every bet inside the 10-minute submit window resolves at the same instant; co-location buys nothing.
TITLE: 03 — Lockstep Tick — StarCraft, 1998
CARD: prim-card-03

---

## H2 — 04 · Rollback / Lock — GGPO, Tony Cannon, 2006

In gaming, once an input is committed for a frame it cannot be retracted, not on lag, not on a crash, not on regret. In a General Market block, each parimutuel bet locks at reveal, and the spoofer goes looking for an order book that was never built in the first place.

[IMAGE — primitive-04-rollback.png]
ALT: 04 Rollback Lock — In gaming, an input committed for the frame cannot be retracted. In trading, MARKET#23 BTC/USDT UP locks at reveal in BLOCK 47; spoofing is a former problem.
TITLE: 04 — Rollback Lock — GGPO, 2006
CARD: prim-card-04

---

## H2 — 05 · Encrypted State — EAC / BattlEye, 2014

In gaming, the state lives in RAM but it is encrypted, and the cheat that reads it discovers entropy where it expected an enemy. In a General Market block, one hundred commitments live on the L3 sealed against curiosity, and the front-runner reads the chain to find a hash where there ought to have been a victim.

[IMAGE — primitive-05-encrypted-state.png]
ALT: 05 Encrypted State — In gaming, EAC/BattlEye encrypt enemy positions in RAM. In trading, 100 bet commitments live on the L3 sealed during submit; "BUY 100 ETH" is unreadable.
TITLE: 05 — Encrypted State — EAC/BattlEye, 2014
CARD: prim-card-05

---

## H2 — 06 · Adaptive Difficulty — FACEIT AC, 2016

In gaming, the honest distribution sits against the cheater outlier and the ban arrives by shape rather than confession. In a General Market block, the bundle starts at one hundred markets, and the day a trader's hit-rate climbs above the curve we scale it to two hundred, then a thousand, then ten thousand, until the math swallows the edge politely. Difficulty is a knob.

[IMAGE — primitive-06-adaptive-difficulty.png]
ALT: 06 Adaptive Difficulty — In gaming, FACEIT bans by reaction-time distribution. In trading, the GM block bundle scales from 100 to 200 to 1000 markets when a hit-rate outlier is detected; insider winrate falls from 0.1% to 0.001%.
TITLE: 06 — Adaptive Difficulty — FACEIT AC, 2016
CARD: prim-card-06

---

## H2 — 07 · Verifier Below the Player — Riot Vanguard, 2020

In gaming, the anti-cheat boots before the operating system, and from underneath, every cheat the player loads is already too late. In a General Market block, the L3 chain runs underneath the trader through BLS consensus and a sealed block, and at each level the verifier sits where the cheater's hand cannot arrive.

[IMAGE — primitive-07-verifier-below.png]
ALT: 07 Verifier Below the Player — In gaming, Riot Vanguard loads as a kernel driver before the OS. In trading, the L3 chain runs below the trader through BLS oracle consensus and the sealed block.
TITLE: 07 — Verifier Below the Player — Vanguard, 2020
CARD: prim-card-07

Stack the seven primitives and look honestly at where each venue lands; the picture is unflattering for everyone who has ever charged a fee for the privilege of being cheated.

---

## H2 — Part VI — The Map

Cheat-resistance against financial stakes, with the venues honestly placed: Polymarket, Sportsbooks, CEX Perps, and TradFi sit in the lower-left quadrant where leaks meet real money. StarCraft and Valorant sit in the lower-right, sealed but with only play money on the table. **General Market** is alone in the upper-right — every primitive applied, real money on the table.

[IMAGE — part-6-map.png]
ALT: The Map — General Market sits alone in the top-right quadrant of cheat-resistance versus financial stakes; Polymarket, sportsbooks, CEX perps, TradFi all leak; StarCraft and Valorant are sealed but only with play money.
TITLE: The Map — cheat-resistance vs financial stakes
CARD: quadrant-card

Eight exploits, one architecture, all gone.

---

## H2 — Part VII — The Kill List

| Trading exploit | Gaming alias | Killed by |
| --- | --- | --- |
| Frontrunning / MEV | wallhack | sealed bets |
| Latency arbitrage | ping advantage | lockstep tick |
| Insider trading | aimbot | adaptive bundle size |
| Stop hunting | spawn camping | no leverage |
| Spoofing | rage-cancel | reveal lock |
| PFOF | pay-to-win | direct submission |
| Toxic-flow MM | smurfing | parimutuel |
| Cross-venue divergence | region-hopping | single chain |

[IMAGE — part-7-kill-list.png]
ALT: The Kill List — eight trading exploits paired with their gaming-cheat aliases and the architectural primitive that kills each one.
TITLE: The Kill List — what disappears
CARD: mapping-card

Counter-Strike has been playable since 1999, and in twenty-seven years no one has ever front-run a Counter-Strike match, while every trade you ever placed was front-run by something you never saw; trading received law, the cheapest of the four modalities, and asked for nothing else, and we did the embarrassing thing, which is to say we read what gaming had already written down.

---

## H2 — Part VIII — The Verdict

**The anti-cheat existed, and trading just never installed it.**

[IMAGE — part-8-verdict.png]
ALT: The Verdict — Quake 1996, StarCraft 1998, GGPO 2006, Vanguard 2020 — the anti-cheat existed, and trading just never installed it. Trading is easy with an Anti-Cheat.
TITLE: The Verdict
CARD: closer-card

> **Trading is easy with an Anti-Cheat.**

— **General Market** · Technical Review № 001 · 2026

Read the full review at **generalmarket.io/case-studies/anticheat**.

---

## Image production cheatsheet

If the user prefers single-card images for the thread on X (rather than embedded images in a Twitter Article), every card on the live page has the **blue frame around white inner**, sized for direct screenshot. Recommended capture method:

1. Open `https://generalmarket.io/case-studies/anticheat/` in a Chromium browser
2. DevTools → device toolbar → set width 720px (matches the share-card max width)
3. Right-click each card → "Capture node screenshot"
4. Save with the filename listed under each `[IMAGE …]` marker
5. Upload to X with the listed `ALT` and `TITLE` strings

For the cover image, use the standalone `cover.html` (1200×675, exact Twitter OG dimensions) instead of cropping the page hero.
