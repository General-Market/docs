# Niche research — memecoin trenches (EN/CN) + perps DEX (EN/CN/JP/KR)

Six cells, one directory each. Per cell:

- `queries.tsv`   — query bank (query, queryType, note). Input to sweep.py.
- `validation.md` — probe results for non-EN terms (which queries returned 0).
- `authors.tsv`   — ranked authors harvested from the sweep.
- `formats.json`  — machine output of format_miner.py.
- `formats.md`    — human-readable format ranking with exemplars.

Cross-cell deliverables live in `/marketing/niche-research/`:
- `<cell>.md`            — niche map per cell
- `format-playbook.md`   — replicable content-format bank

Budget: `budget.json` here is the single source of truth, enforced by twapi.py.
Plan: `docs/superpowers/plans/2026-06-05-niche-research-engine.md`.

## Cost

Final accounting on 2026-06-05:

| item | credits | USD |
|---|---:|---:|
| Budget baseline | 10,210,000 | $102.1000 |
| Final balance | 10,080,954 | $100.8095 |
| Total project spend | 129,046 | $1.2905 |
| Project cap | 1,500,000 | $15.0000 |

Phase allocation is normalized from same-day ledger labels because `delta_credits` can lag the balance endpoint. Absolute spend comes from `budget.json` baseline minus final balance.

| phase | ledger labels | normalized spend |
|---|---|---:|
| Validation + sweep | `advsearch[...]` | $1.0240 |
| Author deep-pull | `lasttweets:` | $0.1990 |
| Graph pass | `followings:` | $0.0675 |
