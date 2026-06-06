# Walkthrough engine — build contract

A manifest-driven Remotion engine that turns the docs-shots walkthrough into an
animated screen-recording-style video: a faux-browser window holding a clean
screenshot, a cursor that glides between targets on a bezier arc, click ripples,
and callouts (ring + numbered chip + arrow + caption) that spring in — one beat
per step, pixelate/cut between screens (NEVER fade — house rule).

Read first: `video/.claude/rules/remotion.md`, `docs/GMStyle.md`,
`docs/apple-style-table.md`. Match `compositions/block-trading/BlockTradingExile.tsx`
and `compositions/market-anatomy/`. `@remotion/*` are all 4.0.438.

## Assets (already produced)

`public/walkthrough/taker/walkthrough.json` + 12 clean PNGs (2× = 2880×1800).
Manifest shape:

```ts
{
  viewport: { width: 1440, height: 900 },   // CSS px the rects are in
  scale: 2,                                  // PNG is 2× the viewport
  steps: Array<{
    name: string;                            // e.g. "collateral"
    image: string;                           // staticFile path, e.g. "walkthrough/taker/collateral.png"
    callouts: Array<{
      label: string;                         // caption
      side: "left" | "right" | "top" | "bottom";
      rect: { x: number; y: number; w: number; h: number };  // in 1440×900 CSS px
    }>;
  }>;
}
```

The FIRST callout of each step is the cursor's destination (and the primary
popup). Remaining callouts are secondary popups, staggered after.

Canvas: **1920×1080 @ 30fps**. The screenshot sits in a browser-chrome window;
B owns the transform `toCanvas(rect)` from 1440×900 image space to canvas space
(scale + offset by where the window is placed). All coords passed to Cursor and
Callout are ALREADY in canvas space — A never sees the manifest.

## Frozen component interfaces

```tsx
// Cursor.tsx  (Agent A) — frame-driven; reads useCurrentFrame internally.
// Glides from→to over [startFrame, startFrame+moveDuration] on an eased bezier
// arc; holds at `to` afterward; before startFrame it rests at `from`. Renders a
// frame-driven click ripple + pointer dip around clickFrame (NO CSS animation —
// it must render frame-by-frame).
export const Cursor: React.FC<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  startFrame: number;
  moveDuration: number;       // frames to travel (e.g. 26)
  clickFrame?: number;        // frame the click fires, omit for no click
}>;

// cursorPath.ts (Agent A)
export function bezierArc(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,                  // 0..1 (already eased by the caller, or ease inside)
): { x: number; y: number };  // a gentle arc, not a straight line

// Callout.tsx (Agent A) — ring + numbered chip + arrow + caption, springs in
// from appearFrame using the house spring. target is in CANVAS coords.
export const Callout: React.FC<{
  target: { x: number; y: number; w: number; h: number };
  label: string;
  side: "left" | "right" | "top" | "bottom";
  index: number;              // chip number (1-based)
  appearFrame: number;        // relative frame it springs in
}>;
```

Both A components live in `compositions/walkthrough/`. They use brand tokens
(GMStyle blue `#0071E3`, electric `#2D5BFF`, Bricolage Grotesque for caption,
Commit Mono for the chip number) — read GMStyle.md for exact values/easings.
Verify them in isolation with a tiny throwaway `<Composition>` if helpful, but do
NOT register throwaways in Root permanently.

## Agent B — engine + integration

Files: `BrowserChrome.tsx`, `Screen.tsx`, `walkthroughData.ts`, `WalkthroughVideo.tsx`,
plus the Root.tsx registration.

- `walkthroughData.ts` — import the JSON (`import manifest from "../../../public/walkthrough/taker/walkthrough.json"` or via staticFile+fetch in calculateMetadata; prefer a typed static import), the step-title map below, and the per-step timing → exports `STEPS` (resolved) and `TOTAL_FRAMES`.
- `BrowserChrome.tsx` — a faux browser window (traffic-light dots, a slim address bar showing `app.crxfx.com`) on the GMStyle dot-grid ground; children = the screenshot.
- `Screen.tsx` — renders the step image via `staticFile`, owns `toCanvas`. Keep `scale = 1` if it fits (window 1440 wide, image 900 tall + chrome) centered, leaving side margins for callouts; otherwise scale down and keep margins ≥ 120px each side so left/right callouts never clip.
- `WalkthroughVideo.tsx` — a `<Sequence>` per step. Within a step: Cursor glides from the previous step's primary target (carried in canvas coords; step 0 starts near window centre) to this step's primary target over ~26f, clicks ~+6f, primary Callout springs ~+10f, secondary callouts stagger +18f each, hold to reading speed (~2.5 words/sec on the longest caption + 0.4s settle), then PIXELATE or cut to the next step (`effects/HexPixelate.tsx` or a `TransitionSeries`; never fade). A persistent lower-third shows the step title.
- `calculateMetadata` sets `durationInFrames = TOTAL_FRAMES`.
- Register `WalkthroughVideo` at the ROOT of Root.tsx (it's a finished video), id `WalkthroughTaker`, 1920×1080, 30fps.

Step-title map (name → title):

```ts
collateral: "Fund your balance"
counterparties-list: "Pick your counterparty"
counterparties-confirm: "Confirm — no money moves"
counterparties-live: "Your one live desk"
hedge-1-amount: "Say what to hedge"
hedge-2-date: "Choose the settle date"
hedge-3-counterparty: "One desk quotes you"
hedge-4-quote: "Get a firm quote"
hedge-5-locked: "Your rate is locked"
positions: "Watch the position"
position-detail: "The full position"
activity-settled: "It settles itself"
```

## Done = 

`npx tsc --noEmit` clean for the new files, `WalkthroughTaker` appears in Studio
(`npx remotion studio --port 3333`) and renders a still without error. Do NOT
commit or push — the orchestrator integrates and verifies visually.
