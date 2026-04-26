# nsgame — System Understanding

A short doc. Its only job is to confirm we share the same model before I adapt 222 competitor files into nsgame's voice. If anything below is wrong, correct it now — wrong here costs minutes; wrong inside a finished Terms of Service costs a rewrite.

## What nsgame is

A prediction market on Solana. Short rounds. Parimutuel pools. The subjects are not stocks or weather — they are **adult-tube performance signals**: porn-star view counts, cam-room viewer counts. Twenty-five live PvP markets today across two boards. The number is a count, not a promise. The roster is curated. Pairs that earn their pool stay; pairs that don't, leave. The discipline is liquidity per market, not catalog stability.

It is not generalmarket.io. It shares a monorepo and shares nothing else. Different chain, different oracle, different markets.

## What you bet on

| Board | Window | Markets | Format | Examples |
|---|---|---|---|---|
| Stars | 4 hours | 15 | F1 — gain race | A vs B over four hours of view-count growth |
| Cams | 2 minutes | 10 | F1 — gain race + F2 — viewer total | A vs B over two minutes |

Each market is binary. A vs B. Pick a side. The pool decides the price.

## The mechanics, as I understand them

| Question | My current answer | Confidence |
|---|---|---|
| Settlement model | Parimutuel pool. Pot split among winners proportional to stake, minus rake. | High — explicit in the user's framing |
| Round duration | 4 hours (stars) or 2 minutes (cams) | High — twenty-five-forever.md |
| Open / lock / resolve cadence | Open during round, lock at close, resolve when oracle posts settlement | Inferred |
| Collateral | SOL on devnet today; presumably mainnet SOL or USDC later | Inferred — needs confirmation |
| Custody | Non-custodial. Wallet-based (Phantom etc.). User keeps keys. | High — Solana program model |
| Resolution oracle | **Multi-oracle network**, our own. Signed settlements on-chain. Not a single daemon. | Confirmed 2026-04-26 |
| Data source | Scraped or API'd from xvideos / xnxx / pornhub / chaturbate | High — PLAN.md |
| Rake / fee | **0.3% of each winning payout.** | Confirmed 2026-04-26 |
| Min / max bet | **Min $0.10. Max uncapped.** | Confirmed 2026-04-26 |
| Native token / governance | **A token is planned. Details undisclosed.** | Confirmed 2026-04-26 |
| Geo restrictions | **Standard decentralized-protocol blocklist.** No bespoke list — we follow the same set as the rest of the category. | Confirmed 2026-04-26 |
| KYC | **None.** Wallet-only onboarding. | Confirmed 2026-04-26 |
| Provably fair / verifiability | Oracle signs settlements on-chain. Data-source readings published from the oracle node. Audits of oracle + contracts gate the mainnet move. | Confirmed 2026-04-26 |

## The user flow, as I model it

1. Land on the site. Wallet prompt (Phantom or similar).
2. Connect wallet. No email. No password.
3. Browse the catalog — 25 fights, two boards.
4. Pick a side. Stake an amount in SOL.
5. The pool grows. Implied odds shift as the other side stakes.
6. Round closes. The market locks. No more bets.
7. Oracle reads the data-node, decides the winner, posts the settlement on-chain.
8. Winners claim. Pool minus rake distributes proportionally to stake.

If any step is wrong, the whole help center is wrong.

## Why this matters for the docs

The 222 competitor files cover four archetypes:

- **Polymarket** — offshore order-book prediction market on news/elections/sports. Non-custodial. Light legal posture.
- **Kalshi** — CFTC-regulated US derivatives exchange. Heavy legal scaffolding, KYC, NY law.
- **Stake** — offshore Curaçao crypto casino. House-edge model, RNG games, sponsorships, full iGaming legal stack.
- **Rainbet** — same archetype, lighter version, Anjouan-licensed.

nsgame inherits **almost entirely from Polymarket**. The iGaming legal scaffolding (Stake, Rainbet) is the wrong template — those are operators with licences, KYC, sponsorship pages, complaints offices. We are none of those.

| From Polymarket — most of it | Non-custodial wallet posture. Parimutuel "no house" framing. On-chain resolution. Public-data oracles. Thin legal surface (Terms / Privacy / Market Integrity). Geographic-restrictions help article. The "Is My Money Safe" / "Is Polymarket the House" / "Does Polymarket Have a Token" Q&A pattern. |
| From Kalshi — narrowly | The market-rules-per-type structure (one rules block per market format), and the fee-schedule layout. Nothing else — no insider-trading policy, no trading-prohibitions list, no member agreement. |
| From Stake / Rainbet — almost nothing | We do not need their AML/KYC tier structure, their sponsorship transparency pages, their insider-trading policy, their trading-prohibitions list, their dispute-resolution / arbitration / complaints-procedure / ADR / ombudsman pages. We have no operator entity to file complaints against. |
| From Rainbet — only one piece | The provably-fair seed-mechanics writeup as a structural reference. We adapt it to our oracle network rather than RNG. |
| From xvideos / chaturbate — three pieces | The takedown / abuse-reporting form pattern. The age-of-majority gate. The data-source / 2257-style disclosure that anchors trust by being legally precise. |

**The single biggest re-frame.** AML/sanctions scaffolding is replaced by one sentence: *the protocol settles on Solana; every transaction is public.* That is the AML disclosure. We don't run a screening program because there is nothing for us to screen — the chain is the ledger, not us.

What nsgame inherits from **none** of them, and must write from scratch:

- The subject-matter posture. None of the four bet on adult-industry performance metrics. The Terms of Service must explain why this is acceptable, who the subjects are, whether they consent to being market subjects, and what happens if a subject demands removal.
- The data-source disclosure. We scrape tube sites. That has to be said plainly and accurately.
- The short-timeframe parimutuel mechanic. Polymarket is order-book. Stake/Rainbet are casino RNG. Kalshi is order-book derivatives. None document a 2-minute cam-room race.
- The curated-roster model. Twenty-five fights today, growing as pairs earn their pool — not the continuously-listed sprawl of an order-book exchange, not a frozen list either. The protocol does not promise a particular set; it promises the set will be the one worth trading.

## The legal posture (confirmed)

**DAO-governed protocol — DAO in formation.** No incorporated entity — no N.V., no LLC, no Holdings. A DAO is being assembled. It will hold the treasury, elect the oracle operators (the **Goldilock** network), and decide anything that needs deciding. During testnet, governance details are TBA. The protocol exists on-chain; the website is a window onto it; the oracle is run today by the founding team and transitions to DAO-elected operators at mainnet. This is the central framing. Every legal document begins from it.

**The honest sentence to repeat:** *the DAO is in formation; details will be published when finalised.* This is the same sentence as the token line, applied to governance. It is not evasion — it is what is true.

Consequences:

- **No KYC.** Wallet is identity. We do not collect documents because we are not a custodian and not a regulated venue.
- **No license to disclose.** No Curaçao, no Anjouan, no MGA. The protocol is the licence.
- **Standard decentralized blocklist.** We follow the same restricted-territory pattern as the rest of the on-chain category — not a bespoke list shaped by adult content. The chain doesn't care; the website refuses connections from a standard set.
- **Subject consent / removal: the clean line.** A subject who objects can be **delisted from the UI**. The protocol cannot delist them — anyone running the oracle, anyone reading the chain, can keep showing the market. The honest sentence is: *the website is something we control. The protocol is something we don't.*
- **Token: planned, undisclosed.** Mentioned, never specified. Treated like Polymarket's "Does Polymarket Have a Token?" — yes-but-no-details posture.
- **Mainnet gate: audits.** Devnet/testnet until oracle and contracts are externally audited. Mainnet after. No date.
- **Data sources are public.** Tube-site signals are public metrics. The oracle node publishes its readings. Anyone can re-derive the resolution.
- **Refund if the data fails.** If the oracle goes down, if the data-node returns garbage, if a tube site rate-limits us mid-round — the round is voided and stakes are refunded. This is the provably-fair guarantee for a non-RNG product.

## What this changes about the doc adaptation

Most of the inheritance map from the previous section still holds, with three sharp adjustments:

1. **Stake/Rainbet's KYC, AML, license, dispute-arbitration, sanctions, complaints stack — drop most of it.** We have no operator to file complaints against. AML and sanctions become "the protocol does not screen — the website applies a standard blocklist." Most of the iGaming legal scaffolding is irrelevant; what survives is responsible-gaming guidance (informational, not enforced).
2. **Polymarket's posture is the closest match.** Non-custodial, on-chain, no KYC, oracle-resolved, public data. Their Terms of Use, Privacy Policy, Market Integrity, geographic-restrictions help article are the templates. Their thin legal surface (3 main legal pages) is the right thin legal surface for nsgame too.
3. **The novel pages — what nsgame must write that none of the four publish:**
    - **Subject Removal Policy** — UI delisting yes, protocol delisting no. The honest line.
    - **Data Source Methodology** — what gets scraped, how often, how normalised. This is the trust spine.
    - **Round Refund Policy** — when a round voids and how stakes return.
    - **Decentralization Disclosure** — why there is no operator, no licence, no complaints office. Frame it as a feature, not an absence.
    - **Audit & Mainnet Roadmap** — what's testnet, what gates mainnet, who the auditors are.
    - **Token Status** — planned, undisclosed, do not buy anything claiming to be ours.

## Confirmed answers — locked in 2026-04-26

| # | Question | Answer |
|---|---|---|
| 1 | Rake | 0.3% of each winning payout, **routed to the DAO treasury** |
| 2 | Min bet / Max bet | $0.10 min / uncapped max |
| 3 | KYC | None |
| 4 | Geographic restrictions | Standard decentralized-protocol blocklist |
| 5 | Subject removal | UI delisting only — protocol is decentralized, oracle is decentralized, we do not control all participants |
| 6 | Token | Planned. **TBA — "A token is planned. Details will be published when finalised."** |
| 7 | Mainnet path | Testnet until audits of oracle + contracts pass, then mainnet |
| 8 | Data source disclosure | Available on the oracle node — public methodology |
| 9 | Operator entity | **No incorporated entity. Governed by a DAO.** |
| 10 | Round-cancel policy | Refund on data issue or other failure |
| 11 | Rake destination | **DAO treasury (DAO in formation).** During testnet: held in a multisig by the founding team, transferred to DAO at mainnet. |
| 12 | Oracle network | **"Goldilock"** — operated by elected DAO members at mainnet. **During testnet: operated by the founding team.** DAO governance details TBA. |
| 18 | DAO status | **In formation.** Token-weighting, election cycles, slashing rules, entity wrapper — all TBA. Not relevant for testnet. |
| 13 | Subject delisting workflow | **Form → we send a link → proof of ID required.** Then UI delisting. |
| 14 | Age gate | **Soft gate.** Checkbox affirmation. Plus a confirmation message after entry. |
| 15 | Refund mechanism | **Claim-based by default; auto-refund when ergonomically better.** |
| 16 | Domain | **nsgame.org.** Single canonical. |
| 17 | Support channel | **Discord link in footer.** Added later. |

## What to do next

The model is locked. Next step: adapt the 222 competitor files into the nsgame voice across the inventory bands. The shape will be:

- **Thin legal surface, Polymarket-style** — Terms, Privacy, Market Integrity, plus the novel decentralized-protocol pages.
- **Compact responsible-trading stack** — informational only (no enforcement we don't operate).
- **Rich product/trust layer** — Round Mechanics, Parimutuel Methodology, Fee Schedule, Refund Policy, Subject Removal, Data Source Methodology, Audit & Mainnet Roadmap, Token Status.
- **Standard plumbing** — Help Center, FAQ, Glossary, Wallet Setup Guide, security.txt, sitemap, accessibility.

Voice stays Cioran. Length stays cruel. The decentralized framing gets repeated, because it is the protocol's only real argument.
