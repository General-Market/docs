# The Anti-Cheat

Technical Review № 001 — General Market

---

Markets are the largest competitive multiplayer game on earth, and the most curious thing about them is that no one ever bothered to install an anti-cheat. Three decades of fixes were patiently catalogued for video games while none were borrowed for trading, on the polite assumption that real money is too dignified to need the same protection as a deathmatch.

The asymmetry has a number, and like everything paid in the long run, the number is patient and enormous.

---

## Part I — The Thesis

A multiplayer game without an anti-cheat is not a game, only a habit.

Markets are the largest competitive multiplayer game on earth, and they have never had an anti-cheat. Three decades of fixes were patiently catalogued for video games while none were borrowed for trading, on the polite assumption that real money is too dignified to need the same protection as a deathmatch.

---

## Part II — The Losses

What ninety-two years of writing rules onto a defenseless architecture have actually delivered:

- **$1.5B** in MEV extracted from Ethereum users since 2020 by mempool front-running.
- **$3.8B per year** paid to brokers for routing your order against you.
- **$920M** single fine to JPMorgan in 2020 for spoofing, after eight uninterrupted years of doing it.
- **$1T** in market cap erased in 36 minutes during the 2010 Flash Crash, by a single spoofer in a London bedroom.
- **$50B+** in crypto liquidations during 2024 alone, cascaded off stop levels every wallet politely advertises.
- **$25B per year** in HFT industry revenue whose entire product is the privilege of being one foot closer to the wire.

Trading reached for lobbyists while gaming reached for engineers, and the eight problems they share now wear two different vocabularies as if vocabulary were a defense.

---

## Part III — The Translation

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

The man who runs the world's largest game store has been studying cheaters longer than most regulators have been alive, and the rule he arrived at is shorter than any paragraph in the Securities Exchange Act.

---

## Part IV — The Citation

> **"Our goal is to make them more expensive for cheaters than the economic benefit they can reasonably expect to gain."**
> — *Gabe Newell, Valve, on VAC, 2014*

Gaben said it about Counter-Strike, where every cheater wakes up the next day looking for somewhere weaker to play; the same principle lets architecture do what no rule book ever did, which is to make the exploit cost more than it pays, until the cheater quietly finds something else to do with his afternoon.

Before describing the seven primitives, one ought to describe the object they protect, which is in itself an indictment of the order book.

---

## Part V — The Block

A General Market block bundles **100 parimutuel prediction markets** into a single sealed envelope: one cent on each, **$1 per block**, every market resolving UP or DOWN against a price the chain settles via BLS-verified oracle consensus.

The block runs three phases of ten minutes each:

1. **SUBMIT (10 min · sealed)** — every bet is committed as a cryptographic hash; nothing legible is on the wire.
2. **REVEAL (10 min · locked)** — bets unseal simultaneously; nothing can be retracted.
3. **CLAIM (10 min · parimutuel)** — winners draw from the pool against the losers, no market maker.

Sealed during submit, locked at reveal, parimutuel at claim, BLS-verified oracle consensus settling each price — the architecture every primitive below describes, already on the chain.

Seven architectural primitives, each of them quietly putting an entire class of fraud out of work, all of them already inside the block.

---

## 01 — Fog of War — Dune II, Westwood, 1992

Don't transmit what shouldn't be seen.

In gaming, the server holds the world and the client receives only the corner it is entitled to. In a General Market block, the same rule applies: inside the submit window the block carries one hundred hashed bets, and the mempool sees commitments where it expected to find prey.

---

## 02 — Server-Authoritative — Quake, id Software, 1996

The truth is not on the client.

In gaming, the client proposes and the server decides; the client cannot lie about what occurred. In a General Market block, three oracles sign each price with BLS and consensus settles around them, while the wallet's claim is registered, ignored, and forgotten.

---

## 03 — Lockstep Tick — StarCraft, Blizzard, 1998

Latency does not exist within the window.

In gaming, all inputs are collected and the tick advances only when everyone has committed; the order in which packets arrived is forgotten. In a General Market block, every bet inside the ten-minute submit window resolves at the same instant, and latency, the most expensive product on Wall Street, becomes the only one with a value of zero.

---

## 04 — Rollback / Lock — GGPO, Tony Cannon, 2006

Once committed, never retracted.

In gaming, once an input is committed for a frame it cannot be retracted, not on lag, not on a crash, not on regret. In a General Market block, each parimutuel bet locks at reveal, and the spoofer goes looking for an order book that was never built in the first place.

---

## 05 — Encrypted State — EAC / BattlEye, 2014

In memory, but illegible.

In gaming, the state lives in RAM but it is encrypted, and the cheat that reads it discovers entropy where it expected an enemy. In a General Market block, one hundred commitments live on the L3 sealed against curiosity, and the front-runner reads the chain to find a hash where there ought to have been a victim.

---

## 06 — Adaptive Difficulty — FACEIT AC, 2016

Catch the shape, scale the math.

In gaming, the honest distribution sits against the cheater outlier and the ban arrives by shape rather than confession. In a General Market block, the bundle starts at one hundred markets, and the day a trader's hit-rate climbs above the curve we scale it to two hundred, then a thousand, then ten thousand, until the math swallows the edge politely. Difficulty is a knob.

---

## 07 — Verifier Below the Player — Riot Vanguard, 2020

The runtime sits where you can't reach.

In gaming, the anti-cheat boots before the operating system, and from underneath, every cheat the player loads is already too late. In a General Market block, the L3 chain runs underneath the trader through BLS consensus and a sealed block, and at each level the verifier sits where the cheater's hand cannot arrive.

Stack the seven primitives and look honestly at where each venue lands; the picture is unflattering for everyone who has ever charged a fee for the privilege of being cheated.

---

## Part VI — The Map

Cheat-resistance against financial stakes, with the venues honestly placed: Polymarket, Sportsbooks, CEX Perps, and TradFi sit in the lower-left where leaks meet real money. StarCraft and Valorant sit in the lower-right, sealed but with only play money on the table. **General Market** is alone in the upper-right, every primitive applied, real money on the table.

Eight exploits, one architecture, all gone.

---

## Part VII — The Kill List

What disappears the moment you stop pretending an order book is mandatory.

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

Counter-Strike has been playable since 1999, and in twenty-seven years no one has ever front-run a Counter-Strike match, while every trade you ever placed was front-run by something you never saw; trading received law, the cheapest of the four modalities, and asked for nothing else, and we did the embarrassing thing, which is to say we read what gaming had already written down.

---

## Part VIII — The Verdict

Quake 1996 · StarCraft 1998 · GGPO 2006 · Vanguard 2020.

**The anti-cheat existed, and trading just never installed it.**

> **Trading is easy with an Anti-Cheat.**

— **General Market** · Technical Review № 001 · 2026
