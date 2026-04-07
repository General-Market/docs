# Docs Refactor — Design

## Summary

Refactor all documentation pages: fix 2 broken snippet references, add 11 Mermaid diagrams, restructure 9 concept pages to practical-first pattern.

## Problems

1. **Missing snippets**: `chain-info.mdx` and `nav-formula.mdx` referenced but don't exist
2. **No visual diagrams**: Only ASCII art, zero Mermaid. Complex flows (batch lifecycle, resolution cycle, BLS verification, order state machine) need real diagrams.
3. **Theory-first concept pages**: 9 pages open with definitions and structs instead of showing practical usage first.

## Fix 1: Missing Snippets

Create two files:
- `docs/index/snippets/chain-info.mdx` — Network config (Chain ID, RPC, collateral)
- `docs/index/snippets/nav-formula.mdx` — NAV formula with worked example

## Fix 2: Mermaid Diagrams (11 total)

### Vision Diagrams (6)

| Page | Diagram Type | What It Shows |
|------|-------------|---------------|
| `vision/concepts/batches.mdx` | flowchart | Batch lifecycle: create → join → tick → resolve → claim |
| `vision/concepts/bitmaps.mdx` | flowchart | Bitmap flow: predict → encode → hash → commit on-chain → reveal to oracles |
| `vision/concepts/ticks.mdx` | flowchart | Resolution cycle (replace ASCII): check due → filter players → fetch prices → match → BLS sign → submit |
| `vision/concepts/balance-proofs.mdx` | sequence | BLS verification: oracle compute → sign → aggregate → on-chain verify → claim |
| `vision/concepts/fees.mdx` | flowchart | Fee flow: gross profit → 0.05% fee → net payout |
| `vision/bots/overview.mdx` | flowchart | Bot architecture (replace ASCII): on-chain vs off-chain separation |

### Index Diagrams (5)

| Page | Diagram Type | What It Shows |
|------|-------------|---------------|
| `index/concepts/itps.mdx` | flowchart | ITP lifecycle: create (weights→qty) → price (NAV) → buy/sell (mint/burn) → rebalance (new qty) |
| `index/concepts/order-lifecycle.mdx` | stateDiagram | Order state machine (replace ASCII): pending → matched → confirmed → filled/cancelled |
| `index/concepts/lending.mdx` | flowchart | Morpho flow: deposit ITP → vault → earn yield → withdraw |
| `index/architecture/oracle-nodes.mdx` | flowchart | Consensus flow (replace ASCII): leader proposes → peers verify → BLS aggregate → on-chain |
| `index/architecture/data-node.mdx` | flowchart | Data pipeline (replace ASCII): sources → collectors → aggregator → API |

Format: Mermaid code blocks (```mermaid). Keep existing ASCII for simple inline examples (bitmap byte packing).

## Fix 3: Practical-First Restructure (9 pages)

### Current Pattern (wrong)
```
# [Concept]
[Definition paragraph]
## What Is [Concept]?
[More theory]
## [Struct/Technical Detail]
[Solidity struct, formulas]
## [How to use it] (buried)
```

### New Pattern
```
# [Concept]

## Quick Start
[2-3 step practical example with code]
[Link: "Deep dive below" or "See [Concept Guide](/path)"]

## How It Works
[Mermaid diagram]
[Brief explanation — 2-3 paragraphs max]
[Links to related concept pages]

## Technical Details
[Struct definitions, formulas, edge cases]
[This is where the deep theory lives]
```

### Pages to Restructure

**Vision (6):**
1. `vision/concepts/batches.mdx` — Lead with "Join a batch" code example
2. `vision/concepts/bitmaps.mdx` — Lead with "Encode your first bitmap" code
3. `vision/concepts/ticks.mdx` — Lead with "What happens every tick" summary
4. `vision/concepts/balance-proofs.mdx` — Lead with "Check your balance" API call
5. `vision/concepts/fees.mdx` — Lead with fee table + "How much will I pay?" example
6. `vision/concepts/resolution-types.mdx` — Lead with comparison table

**Index (3):**
1. `index/concepts/itps.mdx` — Lead with "Buy your first ITP" example
2. `index/concepts/order-lifecycle.mdx` — Lead with order status check example
3. `index/concepts/lending.mdx` — Lead with "Deposit to earn yield" example

## Task Breakdown

| Task | Pages | Work |
|------|-------|------|
| T1 | Fix snippets | Create chain-info.mdx + nav-formula.mdx |
| T2 | Vision concepts (batches, bitmaps, ticks) | 3 Mermaid diagrams + restructure to practical-first |
| T3 | Vision concepts (balance-proofs, fees, resolution-types) | 2 Mermaid diagrams + restructure |
| T4 | Vision bots/overview | 1 Mermaid diagram (replace ASCII) |
| T5 | Index concepts (itps, order-lifecycle, lending) | 3 Mermaid diagrams + restructure |
| T6 | Index architecture (oracle-nodes, data-node) | 2 Mermaid diagrams (replace ASCII) |

## Not In Scope
- API reference pages (already practical-first with code examples)
- Getting Started pages (already practical)
- Guide pages (already step-by-step)
- New pages or navigation changes
- Content rewrites beyond structural reorganization
