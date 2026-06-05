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
