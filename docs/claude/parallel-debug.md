# Parallel consensus debugging

**TL;DR.** When a bug spans multiple systems, dispatch 4 sub-agents in parallel. Each investigates the **full** problem independently. Agreements become the fix. Disagreements get a tiebreaker.

## When to use

- UI shows stale or missing data.
- Multiple systems misbehaving at once.
- Root cause is unclear.

## How

1. Each agent receives the same problem statement + all context (screenshots, API responses, logs).
2. Each agent reads all relevant files (frontend components, API routes, hooks, backend services).
3. Each agent proposes a complete diagnosis + fix.
4. Consolidate: fixes that 3+ agents agree on get applied. Contradictions get a tiebreaker agent.

## Why

Sequential debugging misses cross-system root causes. One agent finds the API issue, another finds the component bug, a third finds the data pipeline gap. The agreement is the truth.
