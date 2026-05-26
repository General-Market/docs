# The Graveyard of Perps — Research for the Animated Timeline

*Research compiled 2026-05-26. Four parallel research agents, sourced inline. This is the source document for the animation — what to show, in what order, with which numbers. Figures flagged TO-VERIFY must be pulled fresh before any number goes on screen.*

---

## The spine

One sentence carries the whole piece:

> **They raised the money. They could not buy the depth.**

A perpetual-futures exchange is a two-sided market. Traders go where the book is deep. Market makers quote where the flow is. At launch there is neither — no liquidity, so wide spreads, so no traders, so no reason for a maker to quote, so no liquidity. This is the hardest cold-start problem in DeFi, and a thin order book is not a smaller version of a deep one. It is *unusable*, so it attracts no one.

Money does not solve this. Money buys engineers, audits, and a launch. It does not buy a market-maker base. Every protocol in this graveyard tried to substitute capital — token emissions, a synthetic AMM curve, an LP pool, a shared backbone — for the one thing capital cannot conjure: a standing crowd of people willing to take the other side at a tight price.

The cost of liquidity is the spine. Everything below hangs from it.

---

## The thesis in three acts

The animation should move through three acts, because the history did.

**Act I — Liquidity is centralized, and so it is cheap.** BitMEX ships the perpetual swap in May 2016. A futures contract with no expiry concentrates all leverage flow into one continuously traded book. The deepest liquidity in crypto is born — and it lives on a centralized exchange. For years, that is where leverage trades.

**Act II — DeFi tries to *rent* liquidity, and it keeps leaving.** Compound's COMP launch in June 2020 proves liquidity mining as a cold-start tool — and births mercenary capital in the same stroke. Every perps DEX for four years copies the playbook: emit a token, rent the depth, watch it evaporate when emissions thin. The vAMM fakes a price with no real liquidity behind it. The pool model makes LPs the house. None of it sticks.

**Act III — FTX shows rented liquidity can vanish in seventy-two hours; Hyperliquid stops renting and *owns* it.** November 2022: Serum's keys are radioactive, Solana DeFi unplugs overnight, the chain's TVL falls ~98%. Then Hyperliquid — built by eleven people, zero VC — runs its own market-making strategies in a public vault (HLP), funds buybacks from real fees, and hands the upside to users. It takes 70–80% of the decentralized perp market.

*Rented liquidity leaves. Owned liquidity compounds.*

---

## The four ways the cost of liquidity killed them

Group the graveyard by *failure mode*, not by chain. There are four, and the animation can color-code each.

**1. The vAMM holds no liquidity — only an insurance fund that drains.**
Perpetual Protocol (and programmatically MCDEX) priced trades off a synthetic constant-product curve with no real depth behind it. A shared insurance fund became the de-facto counterparty, bled by skewed open interest and risk-free whale manipulation until insolvency loomed. *Fake price, real losses.*

**2. Token-emission liquidity is mercenary — it leaves on schedule.**
The hardest single number in the research: **dYdX's 24-hour volume fell 90% the moment a trading-reward epoch ended.** dYdX v3 paid trading rewards that often *exceeded the fees traders paid* — pure subsidy. When the subsidy thinned, the volume left. dYdX v4 had to build a wash-trading detector because its own incentives manufactured fake volume. Zeta, Vertex, ApolloX, RabbitX — all the same arc: incentives up, volume up, incentives normalize, volume and token collapse.

**3. An order book with no market makers is an empty book.**
DerivaDEX and Vega built technically excellent order-book and market-creation infrastructure, then could not attract the professional makers that make an order book function. Vega's own shutdown proposal named the cause: *"challenges in attracting significant market creators."* Permissionless market creation made it worse — every new market needs its own makers, fragmenting the depth they couldn't bootstrap once.

**4. The pool model makes you the counterparty — and the counterparty can't refuse the trade.**
GMX, Gains, Level, Synthetix, Vela, Cap, Pika, Deri replaced thousands of market makers with one passive LP pool quoting off an oracle. Liquidity becomes a deposit instead of a continuous quoting operation. But the cost doesn't vanish — it relocates. The LP eats adverse selection (skilled traders), oracle/latency exploits, and a hard ceiling on open interest. *A liquidity pool can pretend to be a market maker, but it cannot refuse the trade it would rather not take.*

---

## The graveyard — the core visual

The central artifact of the animation is a table that fills in over time: each protocol drops in with what it **raised**, what it **peaked** at, and what **killed** it. Nearly **$400M in disclosed funding** across this set bought almost no durable liquidity.

| Protocol | Raised (disclosed) | Peak | Status 2026 | Cause of death |
|---|---|---|---|---|
| **dYdX** | ~$87M (a16z, Polychain, 3AC, Paradigm) | ~$10B/day, ~80% share, Sep–Oct 2021 | Faded (~7% share, ~$200M/day) | Rented volume with emissions; −90% when epoch ended |
| **Perpetual Protocol** | $1.8M seed (Multicoin) | vAMM pioneer, 2021 | Zombie, delisted everywhere | vAMM has no real depth; insurance fund drains |
| **MCDEX → MUX** | ~$7M (Delphi, Alameda) | Mid-tier | Pivoted to aggregator | Couldn't bootstrap own depth; became a router |
| **Futureswap** | ~$12.4M (Framework, Ribbit) | #1 DEX in 3 days; $4.2B cumulative | Dead; zombie contracts drained 2025–26 | Emissions-driven; abandoned, then exploited |
| **DerivaDEX** | $2.7M (Polychain, Coinbase, Dragonfly) | Negligible | Barely alive (Bermuda-licensed) | Empty order book; shipped years late |
| **Vega Protocol** | ~$53M ($43M CoinList sale) | Token ATH $23.93, ~no users | Dead; chain retired Aug 2024 | "Couldn't attract market creators" |
| **Injective** | >$17M (Binance Labs, Pantera, Cuban) | Helix >$40B cumulative | Alive, mid-tier | Survived — paid real makers with negative fees |
| **Mango Markets** | ~$70M token sale | $210M TVL, Nov 2021 | Dead; wound down Jan 2025 | $114M exploit via thin liquidity + SEC |
| **Drift** | ~$52.5M (Polychain, Multicoin) | $1B TVL, Jan 2025 | Alive, recovering from $295M hack | Solved liquidity (JIT); killed by an admin key |
| **Zeta Markets** | ~$13.5M (Jump, Electric, Alameda) | ~$7.5B lifetime | Faded / pivoting | Mercenary liquidity (points seasons) |
| **01 Exchange** | $2.2M (Alameda, Multicoin) | Never scaled | Dead / dormant | Lost Serum + Alameda in one week |
| **Cypher** | ~none | Tiny | Dead | $1M exploit, then insider theft of recovery fund |
| **Serum** | ~$20M+ (FTX/Alameda/Solana) | Solana's liquidity backbone | Dead; forked to OpenBook | FTX held the upgrade keys |
| **ApolloX → Aster** | Undisclosed (Binance Labs) | $159B cumulative vol on a $15M pool | Pivoted (merged into Aster) | $15M counterparty pool vs $159B claimed volume |
| **Vertex** | ~$8.5M+ (Hack VC, Wintermute) | $81M TVL, $133M OI, Dec 2024 | Abandoning Arbitrum + token | STIP incentive treadmill; lost category to HL |
| **RabbitX** | ~$11M (Sequoia, Multicoin) | TO-VERIFY (DeFiLlama) | Faded niche | Chain-hopping for the richest incentives |
| **GMX** | **No VC — fair launch** | ~$700M TVL May 2023; $326B cumulative | Faded leader | OI cap + $42M reentrancy hack (Jul 2025) |
| **Gains Network** | ~Fair launch ($250K Polygon grant) | Tens of $B cumulative | Thriving (survivor) | Discipline: fees > trader PnL, by design |
| **Level Finance** | $500K | $12M TVL; LVL $11.22 (Apr 2023) | Dead, −99.9% | Tranched LP risk; $1.1M referral-bug hack |
| **Synthetix / Kwenta** | ~$30M ICO + treasury sales | $50B cumulative by Q1 2024 | Faded; SNX −99% | Debt-pool model; 400%+ collateral strangled it |
| **Vela Exchange** | $2.1M | #6 on Arbitrum; $10M VLP | Dead | Bear market; pool couldn't sustain |
| **Cap / Pika / Deri** | Small / undisclosed | Deri $600M/day, Nov 2021 | Faded / zombie | Pool-model breaks (no fee buffer, OI ceiling) |

**The contrast that closes the table:**

| **Hyperliquid** | **$0 — zero VC** | $21B/day, ~65% share (Jan 2025); $10.6B OI (Jul 2025) | **Thriving — 70–80% of the market** | Stopped renting. *Owned* its liquidity (HLP). |

---

## The timeline — chronological, dated, with the liquidity angle

The animation runs along this spine. Each beat: **date → what happened → why it's about liquidity.**

1. **2016-05-13 — BitMEX ships the perpetual swap.** Liquidity concentrates into one no-expiry book. The deepest market in crypto is born — on a CEX.
2. **2017–2018 — dYdX founded, seed + Series A.** First serious on-chain order-book derivatives venue; first to take VC. The rented-liquidity template is set.
3. **2020-06-15 — Compound launches COMP; DeFi Summer.** Liquidity mining proven — and mercenary capital born. Every perps DEX copies it for four years.
4. **Late 2020 — Perpetual Protocol launches the vAMM.** First credible cold-start answer for derivatives — synthetic liquidity, no real pool. Proves the path, and its flaw.
5. **2021-02 — dYdX migrates to StarkEx L2.** First real attack on the gas/latency wall keeping order books off-chain. Share runs toward ~80%.
6. **2021 Q3 — dYdX Series C ($65M, Paradigm) + DYDX token + emissions.** High-water mark of VC + emissions. Rewards soon exceed fees paid. Volume is subsidized, not organic.
7. **2021–2022 — GMX / GLP era on Arbitrum.** The pooled-liquidity model peaks. Passive LPs as universal counterparty solve cold-start — but cap depth and load LPs with trader PnL.
8. **2022-11-11 to 14 — FTX collapses; Serum frozen, OpenBook forked.** The catastrophe case. Solana TVL falls ~98% ($10.17B → $206M). Liquidity *is* confidence — and it can vanish in 72 hours. **(Place this before Hyperliquid in the cut.)**
9. **2023-02 — Hyperliquid alpha (built 2022, zero VC).** On-chain order book on a purpose-built L1. The owned-liquidity model is seeded.
10. **2023-05 — HLP vault launches.** The pivot. The protocol *becomes* the market maker and lets the public own the P&L — no management fee, no performance fee.
11. **2023-10 — dYdX v4 launches its own Cosmos L1.** The incumbent abandons Ethereum for control — but a $20M token-incentive program reignites wash-trading concerns. Subsidy, again.
12. **2024 (Jun–Sep) — Arbitrum STIP grants flow to GMX.** The clearest incentive cliff: growth tracks the grant window, then normalizes. The mercenary pattern in plain sight.
13. **2024-11-29 — HYPE airdrop.** ~310M tokens (31% of supply) to ~94k users, ~$1.6B. No investor allocation, because there were no investors. Share spikes to ~66%.
14. **2025-01-19 — Hyperliquid ATH: $21B daily volume, ~65% share.** Next day, record $4.42M protocol revenue. A DEX out-trades the field on a single day. Cold-start fully escaped.
15. **2025-07/08 — OI surges to ~$10.6B; 70–80% of the decentralized perp market.** Owned liquidity has compounded into structural dominance while rented-liquidity rivals shrank.
16. **2025-10-10 — Flash crash: $10B liquidated on Hyperliquid** (> Bybit's $4.6B, > Binance's $2.4B). The system holds. HLP absorbs liquidations as designed. Owned liquidity is durable under fire.
17. **2026 — HIP-3 tokenized-equity markets (~$2.5B OI); a DEX captures a record 6.9% of *aggregate* perp OI vs all CEXs.** The CEX moat is breached. A DEX now competes for open interest against Binance itself.

---

## What to put on screen — the killer data points

If the animation can only land five numbers, land these. Each is a punch.

- **−90%.** dYdX's 24-hour volume the moment a reward epoch ended. The single cleanest proof that the volume was rented.
- **~$400M raised, ~0 durable liquidity.** The sum of disclosed rounds across the graveyard versus what survived.
- **$159B on $15M.** ApolloX's cumulative volume sitting on a counterparty pool worth fifteen million dollars. Volume without depth.
- **$0 → 70–80%.** Hyperliquid's VC raise versus its market share. The whole thesis in two numbers.
- **~98% in 72 hours.** Solana DeFi TVL after Serum's keys went radioactive. Liquidity is confidence, and confidence is fragile.

Two structural images worth animating:
- **The OI cap.** GMX hard-capped AVAX open interest after the 2022 oracle exploit — a pool can only back as much risk as it can afford to lose. The pool model has a *ceiling* an order book doesn't. Show it as a literal lid.
- **The empty book.** DerivaDEX and Vega — beautiful order-book UI, no quotes on either side. Show the bid/ask ladder, empty.

---

## The honest counterpoint (don't skip it)

Two protocols survived the cost of liquidity, and the timeline is stronger for naming them:

- **GMX** survived because its fee engine out-earned the bleed — GLP stakers lost ~$20M to skilled traders but were paid ~$140M in fees, *7× the bleed*. Solvent while the crowd is large and the winners are few.
- **Gains Network** turned "fees must beat trader PnL" into an explicit, survivable rule and is still standing — fair-launched, no VC.
- **Drift** actually solved the bootstrap problem with a three-layer JIT/AMM liquidity stack — and was nearly killed anyway, by a North Korean admin-key breach ($295M), *not* by the liquidity problem.

The pattern the survivors confirm: **the protocol that owns its liquidity outlives the one that rents it.** Capital bootstraps a launch. Only structural liquidity design sustains one.

---

## Figures to verify before anything goes on screen

The research flagged these as soft or disputed. Pull fresh before locking the cut:

- **RabbitX** peak volume / OI — no reliable secondary figure; pull from `api.llama.fi/protocol/rabbitx` or DeFiLlama perps page directly.
- **Gains Network** clean peak TVL/volume — pull `api.llama.fi/protocol/gains-network`.
- **GMX peak TVL** — use "~$700M combined (Arbitrum + Avalanche), May 2023" as headline; footnote the DeFiLlama Arbitrum-only GLP figure ($517M, 2023-05-26).
- **ApolloX seed amount** — Binance Labs participation confirmed; dollar amount undisclosed. Don't put a number on it.
- **01 Exchange** shutdown date — no formal announcement; "dead/dormant" inferred from total post-2022 inactivity.
- **Mango exploit size** — $110M–$116M disputed range; ~$114M is most-cited; ~$67M returned.
- **Drift exploit size** — $285M (initial) vs $295.4M (final post-mortem); both in primary sources.
- **Aggregate VC-into-perps-DEX total** — do NOT assert a single industry-wide figure. The per-protocol rounds are solid; the ~$400M sum is *disclosed rounds across this specific set*, not an industry total. Frame it that way or pull a Messari/DeFiLlama funding dataset.
- **MUX vs Mycelium** — genuinely two different projects (ex-MCDEX vs ex-Tracer DAO). Don't let the animation collapse them.

---

*Sources are inline in the four agent research dumps that produced this document. Highest-confidence primaries: Fortune (Hyperliquid), Hyperliquid Docs (HLP), CoinDesk (HYPE airdrop, FTX/Solana TVL), The Block (dYdX v4, Mango wind-down), Decrypt/Blockworks (dYdX funding), Messari (Vertex Q4 2024), Halborn (GMX/Level hacks), SEC press release 2024-154 (Mango settlement).*
