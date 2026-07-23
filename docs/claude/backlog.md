# Design decision backlog

**TL;DR.** Log non-obvious decisions and failed attempts to `./backlog.md`. Format: `[DECISION|FAILED] <desc> — <reason>`. Session ID: `YYYYMMDD-HHMM-<4char>`.

## When to log

- New design or architecture decisions.
- Approaches that failed (include the reason).
- Non-obvious tradeoffs made.

**Log live.** Do not wait until end of task.

## Format

```
[DECISION] Switched ITP pricing to inventory-first — weight fallback caused NAV drift on legacy ITPs
[FAILED] Tried Edge runtime for /api/itp — Wagmi imports break on edge, reverted
```

Session ID: `YYYYMMDD-HHMM-<4-char-random>` (e.g. `20260128-1430-a7x2`).
