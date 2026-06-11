---
title: Legal structure
navTitle: Legal structure
description: The DAO, one legal compartment per DTF, separated custody and interface companies, and the decentralization roadmap.
order: 9
group: System
mode: explanation
---

```gmplain
A protocol that issues a thousand index funds cannot register each one as a separate fund — the paperwork would bury it. So the legal design works differently: a member-governed organization legally owns the protocol, every index lives in its own sealed legal compartment, and the companies that hold assets and run the website are kept separate from the protocol itself. This page explains that design and why each separation exists.
```

```gmsummary
What is the legal shape? :: A DAO LLC governs; custody and interface sit in separate companies
Why one legal compartment per DTF? :: Series insulation — one index's liabilities never touch another
Why is the website a separate company? :: The interface publishes; it does not operate the protocol
Why is custody a separate company? :: Keeps licensed activity and assets outside the DAO
How does governance reduce securities risk? :: Real, distributed control weakens the "efforts of others" test
How decentralized is it today? :: A four-phase roadmap that starts founder-led by design
Where can I read the full memorandum? :: The hosted PDF, with its limitations stated
```

## What is the legal shape?

The protocol is governed by a DAO incorporated as a Marshall Islands DAO LLC, while the activities that touch assets or users run through separate operating companies. The structure has four parts:

| Entity | Jurisdiction | Role |
|---|---|---|
| IndexMaker DAO LLC (Master–Series) | Marshall Islands | Legally owns and governs the protocol; one Series per index |
| Authorized Participant | Panama | Custody and trade execution — the regulated hands that touch assets |
| Interface operator | Panama | Runs the website (the GUI) under a license, separate from the protocol |
| IndexMaker Labs | — | Develops the open-source software under a paid support agreement with the DAO |

The Marshall Islands DAO LLC regime (under its Decentralized Autonomous Organization Act of 2022) gives the DAO formal legal recognition and limited liability for members while letting governance run natively on-chain — tokens can directly represent LLC membership units. Index tokens — what these docs call DTFs — are issued as a separate, non-voting class of units; governance votes are weighted by USDC deposits (1 USDC = 1 vote).

**This architecture comes from a structuring proposal dated September 2025. Parts of it — including some of the entities above — are still being put in place.**

## Why one legal compartment per DTF?

Because one index's failure must never touch another. The DAO LLC is a Master–Series LLC: the Master is a single legal entity that can open many Series inside it, and each Series has its own assets, liabilities, and business purpose, legally separated from the rest. Each DTF is one Series.

This is what makes a thousand indexes practical. A new Series needs only a short template operating agreement — not a new fund registration. If one index underperforms or incurs liabilities, the others are insulated by law, not just by code.

## Why is the website a separate company?

Because operating a front end is legally distinct from operating a protocol. The smart contracts run autonomously on-chain and are governed by the DAO; the website is a passive publishing tool that displays publicly available information and lets you sign your own transactions. Keeping the interface in its own company, under a simple license for the front-end software, limits the risk that a regulator treats the software developer as the operator of the whole protocol — the same separation argued in Uniswap's defense to the SEC.

Panama is the customary home for interface operators because it currently imposes no virtual-asset service provider (VASP) licensing on this activity.

## Why is custody a separate company?

Two reasons. First, custody and order execution are exactly the activities that trigger VASP-style obligations — placing them in a dedicated Panama entity keeps those obligations out of the Marshall Islands DAO. Second, holding assets in a separate company keeps them out of reach of governance attacks: a hostile takeover of DAO voting cannot commandeer custody accounts it does not control.

The Authorized Participant acts as OTC desk and custodian. It executes the buy and sell orders the protocol generates and co-signs movements through MPC infrastructure. **Authorized Participants have no power over index design — their role is purely executional.** Several can compete, which tightens spreads.

## How does governance reduce securities risk?

Under U.S. law, the Howey test asks whether buyers depend on the *efforts of others* — a central promoter — for their profit. The more genuinely distributed the control over a protocol, the weaker that case becomes. The governance design attacks that prong directly:

- **Votes carry real power.** The DAO General Assembly sets protocol rules, elects participants, and any member can force a binding vote that meets thresholds — control is not symbolic.
- **Supervisors are chosen by lottery, not entrenched.** The Elected DAO — 15 to 20 members who supervise the system — is selected by sortition: random, verifiable selection from a pool gated by skills, training, and collateral. Random selection makes managers interchangeable and replaceable by construction, which is precisely what the case law looks for.
- **Index managers are removable.** A Curator — the role these docs call the DTF creator ([Create your own DTF](/docs/index/create-a-dtf) (~5 min)) — proposes an index and its methodology, and can be dismissed or replaced for cause by the Elected DAO.
- **Execution is separated from governance.** The Issuer Network — the validator and oracle operators described in [System architecture](/docs/developers/architecture) (~8 min) — applies approved decisions on-chain and enforces compliance guardrails, without taking trading or inventory exposure.

## How decentralized is it today?

Not fully — and the design says so out loud. The roadmap is *progressive decentralization*, in four phases: guided operations (founders and trusted operators run the Elected DAO and a small Issuer Network), hybrid elections (half the seats filled by sortition), full sortition governance (all seats by lottery, validators independent), and mature autonomy (the system self-sustains under on-chain mechanisms).

**The protocol sits at the start of that roadmap: the early phases are founder-led by design.** The legal benefit of decentralization is earned only when the decentralization is real — illusory rights, pre-filled ballots, or an irreplaceable core team would undo it.

**Testnet only.** The deployed system today is a testnet; the legal structure is being implemented alongside it.

## Where can I read the full memorandum?

The full structuring memorandum is hosted here: [IndexMaker Structuring Memorandum — September 2025](/download/indexmaker-structuring-memorandum.pdf) (~20 min). It covers the case law behind each design choice, the Marshall Islands and Panama analysis, the entity formation steps, and the governance process in detail.

Read it with its own limitations in view, stated plainly:

- **It is not legal advice**, in any jurisdiction, and was not prepared by lawyers qualified in the United States, the Marshall Islands, or Panama.
- **No one may rely on it** for investment or any other decision; it is general information only.
- **It is a proposal, not a description of completed fact** — it analyzes a structure for the protocol to grow into.

```gmseealso
[{"title": "What is a DTF?", "href": "/docs/index/what-is-a-dtf"}, {"title": "Create your own DTF", "href": "/docs/index/create-a-dtf"}, {"title": "DTF, lending, and bridge risks", "href": "/docs/index/risks"}]
```

Next: [DTF, lending, and bridge risks](/docs/index/risks) (~3 min)
