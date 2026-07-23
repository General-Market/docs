# Three Walls — three micro-videos (design)

**Date:** 2026-05-26
**Status:** spec, awaiting build approval
**Location of code:** `video/src/compositions/three-walls/`

## Purpose

Three independent micro-videos, each one mechanical animation that states a single
reason the orderbook model cannot reach a billion assets. Pure motion. No title
cards. The only on-screen text is two diegetic captions and a small set of face
states. Quantity is shown by mass, area, and glow — never by a hero numeral.

The three:

1. **Technical Overload** — the orderbook breaks under a billion markets.
2. **Asphyxiation by Winners** — free choice starves the long tail; forced breadth feeds it.
3. **Finite Liquidity** — market-maker liquidity is finite and mercenary; VC subsidy is a treadmill.

Build order: **Finite Liquidity first**, then Technical Overload, then Asphyxiation by Winners.

## Style — inherited from batch-flow

The visual system is `BatchFlowReel`'s, taken from the *current* files (re-verify
the live comp before building, per context-decay rule):

- **Frame:** navy radial backlight (`#0B1E46` / `Stage` in `batch-flow/chrome.tsx`),
  a floating rounded panel (`WINDOW_SCALE = 0.92`) over `#F0F2F4` paper with a blue
  dot lattice. All three clips render inside this same `Stage`.
- **Surfaces:** `glassCard` / `glassPanel`. Pills use `PILL_GRADIENT`
  (`#0071E3 → #5E78FF → #9E7BFF`).
- **Palette:** `C` and `NEON` from `batch-flow/theme.ts`. `C.up` (green) = healthy /
  happy, `C.down` (red) = overload / unhappy, a warm yellow (`#E8A13A` from NEON) =
  the `mmm?` neutral state.
- **Easing:** `EASE.out / in / inOut` from theme. Element entrances spring in; there
  are **no scene-cut fades** (single continuous animation per clip, so none needed).
- **Type:** `font` (SF Pro), `monoFont`. `#1D1D1F` text.

### Format

`1920×1080 @ 60fps` for all three, matching `BatchFlowReel`.

| Clip | id | frames | seconds |
|------|----|--------|---------|
| Finite Liquidity | `FiniteLiquidity` | 1200 | 20.0 |
| Technical Overload | `TechnicalOverload` | 300 | 5.0 |
| Asphyxiation by Winners | `AsphyxiationByWinners` | 540 | 9.0 |

## Files

```
video/src/compositions/three-walls/
  theme.ts          re-export batch-flow/theme + face colors
  chrome.tsx        re-export Stage/glassCard/glassPanel/CaptionPill; add Face
  primitives.tsx    MMChip, VenueCard, FlowStream, TraderChip, VcSource, GovBox, BarTail
  FiniteLiquidity.tsx
  TechnicalOverload.tsx
  AsphyxiationByWinners.tsx
```

Each composition file exports a `*Meta`. Register all three in `src/Root.tsx`
inside a single `<Folder name="ThreeWalls">`. Clean orphaned imports on any later
delete.

## Shared primitives (`primitives.tsx`)

- **`Face`** — a small circular glyph attached to a chip. Three states:
  `happy` (green, smile), `unhappy` (red, frown), `neutral` (yellow, flat mouth + `?`).
  Pure CSS/SVG, ~28px.
- **`MMChip`** — a market-maker chip carrying a *finite* fuel orb (a vertical capsule,
  fill 0..1). The fill represents allocated-vs-idle liquidity; the **capacity never
  grows** across a clip. Optional `Face`.
- **`VenueCard`** — a company/venue glass card with a `state`: `dark | funded | alive | bust`.
  `bust` = grey + scale-down + slight crumble.
- **`VcSource`** — a source node with a money glyph (a `$` coin icon, not a numeral
  readout), emits a `FlowStream` into a venue.
- **`FlowStream`** — an animated particle stream from A→B (points-and-lines, blue),
  `progress` 0..1, reversible. The core A→B verb of every clip.
- **`TraderChip`** — reuse/extend `batch-flow/flow.tsx` `TraderChip`; add a `Face`.
- **`GovBox`** — a glass enclosure with a subtle official seal/shield emblem that
  lowers over a `VenueCard` and seals it.
- **`BarTail`** — a vertical bar graph, bars descending into a long tail.

Captions use `CaptionPill` (the existing quiet bottom glass pill), **never**
`BeatTitle`. Only two caption strings exist in the entire set:
`if giving choice to traders` and `2 years later`.

---

## 1 · Finite Liquidity — `FiniteLiquidity` (1200f)

A conveyor: one center "winner" slot, one right "challenger" slot. Each cycle the
challenger outbids, the MMs swing right, the old center goes bust, the challenger
slides into center, a new challenger rises.

| frames | beat |
|--------|------|
| 0–48 | Three `MMChip`s spring in low-center, orbs ~70% filled. `VcSource` top-left. |
| 48–84 | VC pours into Company A (center) → `funded`. |
| 84–132 | 3 MMs stream liquid up into A; orbs dip (allocated). A → `alive`, glowing. |
| 132–168 | A pays rebate back (streams A→MMs); reward returns to orbs. |
| 168–228 | Company B rises right with a **bigger** VC pour; MMs swing streams A→B; A loses inflow → `bust`. B slides to center. |
| 228–408 | Cycle 2: challenger C rises right, bigger pour, MMs swing, B `bust`, C → center. |
| 408–588 | Cycle 3: challenger D rises, MMs swing, C `bust`, D → center. |
| 588–648 | `. . .` appears; stage begins a fast leftward conveyor scroll. |
| 648–828 | Montage: 6–8 venues flare→grey rushing past, accelerating. **MM orbs stay fixed-size in the foreground — they never grow.** |
| 828–888 | Scroll halts. Caption **`2 years later`** (CaptionPill). |
| 888–960 | A company (center) takes VC money → `funded`/`alive`. |
| 960–1056 | `GovBox` lowers from top over it and seals. |
| 1056–1140 | Challenger rises right with the biggest VC pour yet. |
| 1140–1200 | MMs do **not** swing — streams stay locked into the boxed company; challenger's pull-lines reach and snap back. Boxed company holds, glowing. Hold to end. |

**Reading:** the same finite liquid sloshed between venues until, finally, only a
*government-fenced* venue could hold it. Liquidity walled in by force, never earned.

---

## 2 · Technical Overload — `TechnicalOverload` (300f)

True 3D via `@remotion/three` `ThreeCanvas` (4.0.438 lockstep), rendered inside the
`Stage` panel. **No drei `<Environment>` / PMREM** (known blank-render bug). Use
`meshBasicMaterial` (emissive-feel via color) or `meshStandardMaterial` + a single
ambient + directional light only.

| frames | beat |
|--------|------|
| 0–90 | Camera close on a `100k`-cell cube (`InstancedMesh`, ~100×100×10 = 100k boxes, shared `BoxGeometry`), lit calm **green**. A trader glyph fires order-packets in; cube pulses green — accepting, healthy. |
| 90–180 | Camera dollies out; the green cube shrinks to a bright speck at one corner of a vastly larger cube — the **billion** cube. The billion-cube is a single large box with a dense grid **shader/canvas texture** (cannot instance 1e9). |
| 180–252 | Many trader glyphs fire packets in parallel; cells wash green→amber→red, an overload wave ripples the faces, the cube shudders. |
| 252–300 | The billion-cube **explodes** — instanced fragment chunks burst outward (manual physics: `pos += vel*t + gravity`), reddened. Hold on debris. |

**Risks:** 100k instances are fine with shared geometry; the 1B is a textured shell,
not instances. Verify renders with `--concurrency=1` (parallel-render NaN bug).

---

## 3 · Asphyxiation by Winners — `AsphyxiationByWinners` (540f)

| frames | beat |
|--------|------|
| 0–60 | `BarTail` springs up (≈18 bars, first 3 tall, long thin tail). Caption **`if giving choice to traders`** (CaptionPill). |
| 60–180 | 2 `TraderChip`s + 1 `MMChip` (right) stream orders **only** into the first 2–3 bars; tail untouched; winners pulse. |
| 180–300 | *Beat 1.5* — money flows **back to the MM**: streams converge into the MM orb, which swells. Both traders → **unhappy** faces. |
| 300–360 | The **General layer** drops in — a translucent GM-marked plane sweeping across all bars (no title; subtle GM mark). |
| 360–420 | The layer **forces** the 2 traders to stream across **all** bars; streams fan to the whole tail. All chips → **`mmm?` yellow** neutral. |
| 420–540 | Money flows **back to the traders**: streams converge into the two trader chips → **happy**. The MM stays **`mmm?` yellow**, orb settles to a *moderate* size — got some back, not all, not nothing. Hold. |

**Reading:** free choice crowds the winners and feeds the MM; forced breadth feeds the
traders and merely levels the MM. (GM mark: check `video/src/compositions/gm/` /
`public/` for an existing wordmark before drawing one.)

---

## Verification

- `cd video && npx tsc --noEmit` — zero errors.
- `npx eslint src/compositions/three-walls --quiet` — zero errors.
- Preview each at `http://localhost:3333/<id>` (studio on :3333).
- 3D clip: render-check with `--concurrency=1`.

## Open items folded into build

- GM wordmark asset for the General layer (locate or draw a simple `GM` glyph).
- Government seal/shield emblem for `GovBox` (simple drawn glyph acceptable).
- Exact bar count / tail curve for `BarTail` (tune in studio).
