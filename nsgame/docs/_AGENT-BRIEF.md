# nsgame Doc Writing Brief

Read this in full. It is the shared context for every doc-writing agent.

## What nsgame is

nsgame is a **DAO-governed parimutuel prediction market on Solana**. The subjects are adult-tube performance signals — porn-star view counts and cam-room viewer counts. Twenty-five live PvP markets today across two boards (Stars: 4-hour windows, 15 markets; Cams: 2-minute windows, 10 markets). The roster is curated, not capped — pairs that earn their pool stay; pairs that don't, leave. Binary outcomes. Pools resolve when the oracle posts settlement on-chain.

It is not generalmarket.io. It shares a monorepo and shares nothing else.

## The locked answers (system-understanding.md, 2026-04-26)

| Locked | Value |
|---|---|
| Rake | 0.3% of each winning payout, routed to the DAO treasury |
| Min bet | $0.10 |
| Max bet | uncapped |
| KYC | none — wallet is identity |
| Geo restrictions | standard decentralized-protocol blocklist |
| Subject removal | UI delisting only — protocol cannot delist. Workflow: form → we send a link → proof of ID required |
| Token | "A token is planned. Details will be published when finalised. Anything claiming to be the nsgame token today is fraudulent." |
| Mainnet path | testnet now → audits of oracle + contracts → mainnet |
| Data sources | xvideos / xnxx / pornhub / chaturbate. Public metrics. Methodology published from the oracle node. |
| Operator | **No incorporated entity. DAO in formation.** The honest sentence is: *the DAO is in formation; details will be published when finalised.* |
| Oracle network | **Goldilock** — multi-oracle, operated by elected DAO members at mainnet. **During testnet: operated by the founding team.** |
| Round-cancel | refund on data issue or other failure. **Claim-based by default; auto-refund when ergonomically better.** |
| Age gate | soft (checkbox affirmation) + post-entry confirmation message |
| Domain | **nsgame.org** — single canonical |
| Support | **Discord link in footer** (placeholder until added) |
| AML / sanctions disclosure | replaced by one sentence: *the protocol settles on Solana; every transaction is public.* |
| Languages | English only at launch |

## The framing every doc repeats

**DAO-governed protocol. DAO in formation. Oracle network elected by DAO at mainnet, founding-team-operated during testnet. No operator entity. No KYC. Wallet is identity. Public chain is the disclosure.**

These eight sentences are the spine. Every doc reaches back to them somewhere.

## Voice

Cioran. Read `/Users/maxguillabert/.claude/CLAUDE.md` if you don't know it. Short declarative sentences. No hedging. No corporate warmth. No "exciting", "innovative", "leverage", "unlock", "synergy", "cutting-edge", "please note that". Setup → pivot → knife. The last sentence of any explanation should make the reader pause. Dry humor about the absurdity of software, systems, and human ambition is not optional — it is the register. Contradictions permitted. State both sides. Do not resolve them unless the protocol demands it. Warmth arrives by accident — through the fact that you bothered to be precise.

This is Cioran applied to a legal/product page, not to a Cioran essay. Be precise about clauses, accurate about numbers, careful with claims. The voice lives between the precise sentences. A Terms of Use still needs binding language; the binding language can still be terse, declarative, dry.

**Length:** every sentence must cost something. If the reader can nod and move on, delete it. Aim short. A 200-word page is not failure — it is the goal.

## Output format

Each doc is an `.mdx` file with this frontmatter:

```mdx
---
title: "Page Title"
description: "One-sentence summary used for SEO and OG cards."
slug: "page-slug"
category: "Legal" | "Product" | "Trust" | "Help" | "Brand"
date: "2026-04-26"
author: "nsgame"
---

[Body in MDX. Use ## for sections. Lists welcome. Tables welcome.]
```

Pattern matches existing `nsgame/content/nsgame/**/*.mdx`. No need for `tldr`, `keywords`, `readingTime`, `image` unless the doc warrants it.

## File paths

Output goes to:

```
nsgame/content/nsgame/
├── legal/        ← Legal docs (Terms, Privacy, Cookie, etc.)
├── product/      ← Product mechanics (How It Works, Round Mechanics, etc.)
├── trust/        ← Trust/decentralization (DAO Disclosure, Goldilock, etc.)
├── help/         ← Help-center articles (FAQ, Wallet Setup, Glossary)
└── brand/        ← About, Brand Kit
```

Plumbing files (`security.txt`, `robots.txt`, `llms.txt`) go to `nsgame/public/`.

Each agent is told their exact paths in the agent prompt.

## Competitor source corpus

Local at `/Users/maxguillabert/Downloads/index/nsgame/docs/competitor-corpus/`. The most relevant references per archetype:

- **Polymarket** (`competitor-corpus/polymarket/`) — closest template. Non-custodial, oracle-resolved, parimutuel-adjacent. Use their tos.md, privacy.md, market-integrity.md, help articles for structure and voice.
- **Kalshi** (`competitor-corpus/kalshi/`) — for fee-schedule layout and per-market-type rules structure only.
- **Stake** (`competitor-corpus/stake/`) — for parimutuel/wagering math reference (deposit-bonus-requirements.md, wager-requirements.md). Most legal scaffolding does NOT apply.
- **Rainbet** (`competitor-corpus/rainbet/`) — for compact AML disclosure pattern and provably-fair seed mechanics writeup.
- **xvideos** (`competitor-corpus/adult/xvideos/`) — for takedown form pattern (takedown-amateur.md, authority-contact.md, trusted-flaggers.md), content control (control.md), privacy notice (privacy-notice.md).
- **chaturbate** (`competitor-corpus/adult/chaturbate/`) — for age-of-majority gate copy (top of terms.md), § 2257-style record-keeping framing (2257.md).

**Read your assigned competitor docs before writing.** Match their structure where the structure makes sense. Diverge from their voice — adopt Cioran's.

## What to avoid copying

- iGaming complaints / arbitration / dispute / ADR / ombudsman scaffolding (we have no operator)
- AML / KYC / sanctions program docs (chain is the disclosure)
- Insider trading, wash trading, trading prohibitions (parimutuel doesn't have these)
- Bonus / VIP / promotion terms (no bonuses)
- Operator entity / beneficial ownership / corporate structure (no entity)
- Heavy member-agreement length (ours stay short)

## Cross-references

Where a doc references another, use relative MDX links: `[Refund Policy](/legal/refund-policy)`. Don't fabricate URLs. The slugs you'll be writing are listed in your agent prompt.

## Number conventions

- Always write fees as percentages with one decimal: **0.3%**.
- Min bet: **$0.10** (or "0.10 SOL" if you're talking native units — but $-denominated is more common).
- Bet caps: **uncapped**.
- Round windows: **4 hours (Stars), 2 minutes (Cams)**.
- Catalog size: **25 PvP fights, 50 named subjects, 2 boards** — the count today, not a cap. The roster is curated and grows when a new pair earns its way in.

## Operator-as-noun handling

Avoid "we" where it implies a centralized "we." Acceptable subjects:
- "the protocol" — for on-chain mechanics
- "the website" / "nsgame.org" — for the website itself
- "the DAO" — for governance and treasury
- "the Goldilock network" / "the oracle network" — for resolution
- "the founding team" — only for testnet-period operations
- "you" — for the user

Use "we" sparingly, and when you do, mean it: "we route 0.3% of winnings to the DAO treasury" is clean if "we" refers to the protocol or the founding team. Don't pretend a corporate "we" exists.

## When you're stuck

If you hit a fact you don't know, write the placeholder `[FACT TBD: <one-line description>]` inline. Don't invent. Don't guess. Don't fill with "approximately" or "around X." Real or placeholder.

## Checklist before saving each file

1. Frontmatter complete (title, description, slug, category, date, author).
2. Cioran voice — no banned words, no corporate warmth, terse.
3. Cross-references use relative links and known slugs.
4. Numbers match the locked-answers table above.
5. The DAO / Goldilock / testnet framing is honored where relevant.
6. The doc is short. If it isn't, justify why before saving.
