# CRX-Anoma — UI Fidelity Lift

**Date:** 2026-07-09
**Branch:** `claude/anoma-ui-fidelity-lift`
**Scope decision:** Fidelity lift, same scenes (owner-approved).
**File under work:** `src/compositions/replicates/anoma/CrxAppCards.tsx` (+ `diatype.ts`, one new fonts loader).

## The finding that reframes the task

The film's mock UIs already match app.crxfx.com's *palette* — same teal `#0fb6ab`, `#f7f8fa`
canvas, `rgba(23,23,33,0.08)` hairlines, 20px radius, one soft card shadow. `CrxAppCards.tsx`
was built against the app's `globals.css` on purpose.

The gap the owner feels is **craft, not colour.** The real app earns its polish through
fidelity: tabular numerals that align in columns, token chips with subtitles and a teal
selection ring, circular flag badges, nested sunken panels, honest tables, health meters, a
working date picker. The film's cards gesture at these with plain `<div>`s. Same paint,
thinner carpentry.

**Therefore:** we do not re-skin. We raise the carpentry, card by card, to the product's
level — and the beat-sync never moves.

## Guardrails (non-negotiable)

- **Beat-sync is sacred.** No frame window, mount time, cursor-click frame, or timing constant
  changes. Every card stays in the frame range it occupies today.
- **Geometry is fixed.** CARD box `{504,122,710,476}` and S12 box `{83,321,1114,399}` do not move.
- **Palette stays.** Tokens already match the app; we add craft, we never recolour.
- **No invented depth.** Shadows/gradients stay within what app.crxfx.com actually renders. The
  allowed richness is exactly what the app renders: nested sunken panels, tabular numerals, real
  chips, flag discs, a month-grid picker.
- **Stage surgically.** `git add` explicit anoma paths only — never `-A`. The repo holds other
  sessions' unrelated work.

## Typography — leave it exactly as it is (documented decision)

Do **not** introduce a mono face or `tnum`. The whole cut deliberately wears **Diatype**
(replacing Inter) for brand cohesion, and `CrxAppCards.tsx:70–73` records that tabular figures
were left off on purpose — Diatype's `tnum` monospaces the space/comma/period too, rendering
"$30 , 440 . 00". Column alignment is already achieved by **right-anchoring value cells**, not by
tabular digits. The fidelity gap is *component richness*, not type. Keep Diatype 400/700.

## Phase 1 — Shared primitives (build first, one commit)

New/upgraded module-scope helpers in `CrxAppCards.tsx`:

1. (dropped — no mono/tnum; see Typography above. Value cells stay right-anchored in Diatype.)
2. `TokenChip` — circular token disc + name + subtitle; optional selected (teal ring + check).
   Matches the app MARGIN-TOKEN chips.
3. `FlagBadge` / upgraded `FlagPair` — overlapping circular flag discs like the app currency pair.
4. `Panel` — nested sunken inset (bg `SURFACE2`/`WELL`, radius 12–14) for grouping, like the
   app's inner gray cards.
5. `DataTable` — uppercase micro-label header row + hairline rows + right-aligned tabular numeric
   columns. Backs positions, dealer ladder, holdings.
6. `HealthMeter` — track + fill + tick + tabular `%` label (position health).
7. `Stepper` — upgrade the 3-node teal progress stepper to app fidelity (connectors fill,
   check-circles resolve).
8. `CalendarPicker` — **NEW.** Month-grid date picker popover: header `‹ August 2026 ›`, weekday
   row Su–Sa, 6×7 day cells, selected day `8` teal-filled, today ringed, `30 days from today`
   caption, overlay shadow. Opens on the tenor click, cursor-driven. **This is the owner's
   "make the calendar work" requirement.**
9. `BarChart` polish — keep hand-rolled (no chart lib); add a value axis, a hero-month dot,
   cleaner gridlines, optional soft area fill. Credible without a library.

## Phase 2 — Per-card upgrades (sequential; commit + push EACH)

| Card | Frames | Lift |
|---|---|---|
| **S3 Portfolio** | 216–326 | Total + rows in tabular `Num`; Available/Margin/Unrealized in a sunken `Panel`, right-aligned, coloured PnL; USDC/USDT as `TokenChip` rows w/ balances; `BarChart` polish. |
| **S4 Hedge ticket** | 348–611 | Notional well w/ tabular typed amount + USDC `TokenChip`; tabular spot; `FlagBadge` pair + corridor dropdown (flags + subtitles); **working `CalendarPicker`** on the tenor well (opens f501/f523, selects Aug 8 2026); forward-rate ticks tabular → brass "Locked · firm 120s"; teal CTA. Hero card. |
| **S8 Onboarding** | 896–1094 | App-grade `Stepper`; rows in a `Panel`; statuses as chips (Running… spinner, Verified check-well); "Verified · Ready to trade" flood. |
| **S9 Dealers RFQ** | 1116–1226 | Trade chips (`FlagBadge` + tabular notional); skeleton → 3-row dealer `DataTable`, tabular rates, best ringed teal; "Firm · 120s" countdown. |
| **S10 Compliance** | 1204–1357 | 4 check rows in a `Panel` w/ green check-wells; "All clear" pill. |
| **S12 Finale dashboard** | 1489–1621 | Frosted nav refine; balance card tabular; `BarChart` card; **positions `DataTable`** w/ `FlagBadge` pairs, Long/Short chips, tabular PnL (green/red), per-row `HealthMeter`. The full-app reveal — the most impressive frame. |

## Verification (disk-starved box)

- Build a **`CRX-Anoma-QA` gallery** composition (slim QA root, no video background — cards on the
  app canvas) laying each upgraded card at its key frame. Render stills with `remotion still` at
  reduced scale; compare side-by-side to the captured app screenshots
  (`app-crxfx-swap/portfolio/compliance.png`). Iterate per card until a stranger would read it as
  a real app screenshot.
- Spot-render the real `CRX-Anoma` comp at 1–2 frames per card (APFS-cloned `--public-dir`, freed
  caches, `--concurrency=1`) to confirm the card still sits right over the silk background.
- Per-card acceptance: (a) reads as the real app; (b) value columns are right-anchored and align
  (Diatype proportional, no mono); (c) the card's frame window and cursor clicks are byte-for-byte
  the same timings.

(Note: "tabular" in the per-card table below means *right-anchored aligned value cells*, not a
mono/tnum face.)

## Push cadence

Commit + push to `claude/anoma-ui-fidelity-lift` after Phase 1 and after each card — ~7
checkpoints. This is the owner's "push regularly so we don't waste checkpoints." No merge to
`main` without explicit go.
