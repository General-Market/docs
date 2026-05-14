# Predator Anatomy — Handoff

Multi-step visual brief of the seven extractions. Designed to ship on a Miro board first, the marketing site second.

## Files

| File | What |
|---|---|
| `PLAN.md` | Goal, status, the seven six-step mechanism breakdowns, build approach, Miro upload steps. **Read first.** |
| `STYLE.md` | Apple style applied to SVG — colors, fonts, type scale, quick-start CSS. |
| `diagrams/*.svg` | Seven **single-frame** SVGs extracted from the shipped HTML case study. Reference only — the next iteration replaces them with six-frame walkthroughs. |
| `scripts/upload_to_miro.py` | Upload SVGs as images to Miro board `uXjVOkYo-do=`. Single-frame uploader (works as-is; layout coords will need bumping when SVGs grow). |
| `scripts/add_shapes.py` | Adds the colored economics-row cells using Miro shapes. **Deprecated** for the multi-step iteration — the new SVGs will contain their own economics row. |

## State

- HTML case study (single-frame) — **shipped** at `/case-studies/predator-anatomy/`
- Miro board — **empty** (wiped 2026-05-14, ready for the new upload)
- Multi-step SVGs — **not built yet** (the next agent's job)

## How to pick up

1. Read `PLAN.md` — the seven six-step breakdowns are the spec.
2. Read `STYLE.md` — copy the inline `<style>` block into each SVG.
3. Build seven new SVGs at `diagrams/<NN>-<name>-multi.svg` (1500×1100). Don't overwrite the originals.
4. Update `scripts/upload_to_miro.py` to point at the new files and the new vertical coords (1500px gap between cards).
5. Run: `export $(grep -E "^MIRO_" .env | xargs) && python3 docs/predator-anatomy/scripts/upload_to_miro.py`
6. Commit + push.

## Board

https://miro.com/app/board/uXjVOkYo-do=
