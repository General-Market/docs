# 3D Articles Engine — Design Plan

**Date:** 2026-03-03
**Status:** Proposal
**Stack:** React Three Fiber + Drei + Theatre.js + Motion

---

## Problem

Each 3D scene is a 600-900 line file written from scratch. Colors, easing functions, animation loops, lighting, Canvas config, label styles, platform shapes, and flow-spark patterns are copy-pasted across 20+ files. There is no grid, no timeline, no primitive library, no color tokens in code. Adding a new scene takes hours of boilerplate before any creative work begins.

## Goal

A scene author writes **what** the scene contains (nodes, flows, labels, animation beats). The engine handles **how** it renders (lighting, camera, layout, anti-overlap, responsive sizing, performance budgets).

Target: a new scene should be < 150 lines of declarative configuration + custom geometry only for unique shapes.

---

## Stack Decision

| Layer | Tool | Why |
|-------|------|-----|
| 3D Renderer | **React Three Fiber** | Already in use. Only serious React-native 3D renderer. |
| 3D Utilities | **Drei** | Already in use. `<Html>`, `<Float>`, `<Text3D>`, `<RoundedBox>`, `<OrbitControls>`. |
| Animation Authoring | **Theatre.js** | Visual timeline editor with first-class R3F integration (`@theatre/r3f`). Export sequences as JSON, commit to git. Replaces raw `cycleT` range guards. |
| DOM Animation | **Motion (Framer Motion)** | Already in use for page transitions. `useScroll` + `useTransform` for surrounding prose. |
| Dev Controls | **Leva** | Dev-only GUI for tweaking positions, colors, timing without touching code. Strip from prod. |
| Spring Physics | **react-spring** (`@react-spring/three`) | Natural-feeling hover/enter/exit transitions on 3D objects. |

**Not adopted:**
- Babylon.js — too heavy, doesn't compose with React
- Spline — opaque blobs, can't version-control
- GSAP — imperative API fights React; Theatre.js is R3F-native
- A-Frame — VR-first, poor React integration
- deck.gl — geo/data-viz only

---

## Architecture

```
MDX Article
  │
  ├── <ArticleSection>           ← Motion text reveal
  │
  ├── <SceneContainer>           ← existing wrapper (WebGL, lazy mount, error boundary)
  │     │
  │     └── <ArticleCanvas>      ← NEW: preset Canvas + lighting + controls
  │           │
  │           ├── <AutoFitCamera>       ← existing
  │           ├── <StandardLighting />  ← NEW
  │           ├── <GridLayout>          ← NEW: positions children on a grid
  │           │     ├── <Node>          ← NEW: sphere/box/custom with label
  │           │     ├── <FlowPath>      ← NEW: bezier tube + spark particles
  │           │     └── <Gate>          ← NEW: ACCEPT ring / checkpoint
  │           │
  │           ├── Theatre sequence      ← NEW: animation timeline from JSON
  │           └── <OrbitControls>       ← configured by ArticleCanvas
  │
  ├── <ArticleSection>
  │
  └── <SceneContainer>
        └── <ArticleCanvas> ...
```

---

## Module Breakdown

### 1. Color Tokens (`shared/colors.ts`)

Single source of truth. Replace all hardcoded hex strings across all scene files.

```ts
// Semantic scene colors — matches visual-explanation-framework.md
export const SCENE_COLORS = {
  validation: '#8b5cf6',  // purple
  execution:  '#22c55e',  // green
  fee:        '#f59e0b',  // amber
  danger:     '#ef4444',  // red
  structural: '#3b82f6',  // blue
  special:    '#6366f1',  // indigo
  neutral:    '#94a3b8',  // slate
  surface:    '#fafafa',  // platform surface
  background: '#ffffff',  // canvas background
} as const

export type SceneColorKey = keyof typeof SCENE_COLORS
```

All scene files import from this module. A lint rule or type constraint can enforce usage.

### 2. Animation Utilities (`shared/animation.ts`)

Extract the copy-pasted math into one module:

```ts
export function easeInOut(t: number): number
export function clamp01(v: number): number
export function rangeT(cycleT: number, start: number, end: number): number
export function pingPong(t: number): number

export const DEFAULT_CYCLE = 10 // seconds

// Hook: encapsulates the elapsedRef + useFrame + cycleT pattern
export function useAnimationCycle(
  cycle?: number,
  reducedMotion?: boolean
): { cycleT: number; elapsed: number }
```

Every animated component replaces its inline `useFrame` + `elapsedRef` pattern with `const { cycleT } = useAnimationCycle(CYCLE, reducedMotion)`.

### 3. Beat Timeline (`shared/timeline.ts`)

Named animation beats instead of raw `cycleT > 0.3 && cycleT < 0.6`:

```ts
interface Beat {
  name: string
  start: number  // 0-1 fraction of cycle
  end: number
}

interface Timeline {
  beats: Beat[]
  at(name: string, cycleT: number): number  // returns 0-1 progress within that beat, or -1 if outside
  isActive(name: string, cycleT: number): boolean
}

export function createTimeline(beats: Beat[]): Timeline
```

Usage: `const tl = createTimeline([{ name: 'inspect', start: 0.0, end: 0.3 }, { name: 'accept', start: 0.3, end: 0.5 }, ...])`. Then `tl.at('accept', cycleT)` returns the local progress.

**Phase 2:** Replace `createTimeline` with Theatre.js sequences for visual authoring.

### 4. ArticleCanvas (`shared/ArticleCanvas.tsx`)

Replaces the ~15 lines of Canvas boilerplate in every scene:

```tsx
interface ArticleCanvasProps {
  children: ReactNode
  cameraPosition?: [number, number, number]  // default [0, 4, 7]
  fov?: number                               // default 34
  orbit?: boolean                            // default true
  orbitConfig?: Partial<OrbitControlsProps>
  fitPoints?: [number, number, number][]     // passed to AutoFitCamera
  background?: string                        // default '#ffffff'
}
```

Includes: `<Canvas>`, `<ContextDisposer>`, `<color>`, `<StandardLighting>`, `<OrbitControls>`, `<AutoFitCamera>`. Scene authors only write their scene graph as children.

### 5. StandardLighting (`shared/StandardLighting.tsx`)

The canonical three-light setup extracted into one component:

```tsx
export function StandardLighting({ intensity?: number }) {
  // ambientLight 1.2, directionalLight [5,10,5] @ 1.0, directionalLight [-3,6,-2] @ 0.3
}
```

Presets: `'article'` (current default), `'dramatic'` (stronger shadows), `'soft'` (ambient-heavy).

### 6. Primitive Shape Library (`shared/primitives/`)

Composable building blocks that encode the framework's shape semantics:

| Component | Shape | Semantic | Props |
|-----------|-------|----------|-------|
| `<Node>` | Sphere | Actor/entity | `color`, `label`, `position`, `size`, `pulse` |
| `<Container>` | RoundedBox | Frame/group | `color`, `label`, `position`, `width`, `height`, `depth` |
| `<Gate>` | Torus | ACCEPT checkpoint | `color`, `position`, `active`, `label` |
| `<Platform>` | RoundedBox + shadow | Ground surface | `position`, `width`, `depth`, `label`, `color` |
| `<Padlock>` | RoundedBox + Torus arc | Auth/signature | `position`, `color`, `open` |
| `<FlowPath>` | TubeGeometry + InstancedMesh sparks | Data/token flow | `curve`, `color`, `active`, `sparkCount`, `speed` |
| `<FlowBeam>` | Cylinder beam | Directional flow | `from`, `to`, `color`, `active`, `width` |
| `<AmbientParticles>` | InstancedMesh spheres | Background atmosphere | `count`, `color`, `bounds`, `speed` |

Each primitive:
- Accepts a `label?: string` prop → renders `<SmartLabel>` (not raw `<Html>`)
- Accepts a `color` prop typed as `SceneColorKey | string` → resolves from tokens
- Has sensible defaults for size, material properties
- Supports `reducedMotion` → skips animation

### 7. Grid Layout (`shared/GridLayout.tsx`)

Positions children on a spatial grid so authors specify cell coordinates, not absolute floats:

```tsx
interface GridLayoutProps {
  columns: number
  rows: number
  cellSize?: number      // world units per cell, default 2
  centerOrigin?: boolean // default true
  children: ReactNode
}

// Children use: <GridCell col={0} row={1}><Node ... /></GridCell>
```

A scene that positions 5 nodes in a row becomes:
```tsx
<GridLayout columns={5} rows={1} cellSize={2.5}>
  <GridCell col={0} row={0}><Node color="validation" label="Frame 0" /></GridCell>
  <GridCell col={1} row={0}><Gate color="execution" label="ACCEPT" /></GridCell>
  ...
</GridLayout>
```

No absolute coordinates. The grid handles spacing, centering, and responsive scaling.

### 8. Material Presets (`shared/materials.ts`)

Named material configurations instead of raw roughness/metalness per mesh:

```ts
export const MATERIALS = {
  standard:  { roughness: 0.4, metalness: 0.1 },
  glass:     { roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.4 },
  emissive:  { roughness: 0.3, metalness: 0.0, emissiveIntensity: 0.4 },
  matte:     { roughness: 0.9, metalness: 0.0 },
  metallic:  { roughness: 0.2, metalness: 0.7 },
} as const
```

Primitives accept `material?: keyof typeof MATERIALS` instead of raw props.

### 9. Scene Config Format (Phase 2)

Declarative JSON/TS config that describes a scene without JSX:

```ts
const paymasterScene: SceneConfig = {
  height: 'h-[340px] md:h-[400px]',
  camera: { position: [0, 4, 7], fov: 34 },
  fitPoints: [[-4, 3, 0], [4, 3, 0]],
  grid: { columns: 4, rows: 2, cellSize: 2.5 },
  nodes: [
    { id: 'paymaster', type: 'node', cell: [0, 0], color: 'special', label: 'Paymaster' },
    { id: 'accept',    type: 'gate', cell: [1, 0], color: 'execution', label: 'ACCEPT' },
    { id: 'wallet',    type: 'node', cell: [2, 0], color: 'validation', label: 'Wallet' },
    { id: 'action',    type: 'container', cell: [3, 0], color: 'structural', label: 'Swap' },
  ],
  flows: [
    { from: 'paymaster', to: 'accept', color: 'fee', label: 'ETH gas' },
    { from: 'wallet', to: 'action', color: 'execution', label: 'Execute' },
  ],
  timeline: [
    { name: 'inspect', start: 0.0, end: 0.3 },
    { name: 'accept',  start: 0.3, end: 0.5 },
    { name: 'execute', start: 0.5, end: 0.8 },
    { name: 'settle',  start: 0.8, end: 1.0 },
  ],
  legend: [
    { color: 'special', label: 'Paymaster' },
    { color: 'execution', label: 'Execution' },
    { color: 'fee', label: 'Gas fee' },
  ],
  aria: { label: 'Paymaster gas payment flow', description: 'A paymaster covers ETH gas...' },
  fallback: 'Paymaster covers gas in ETH while wallet pays a fee in RAI.',
}
```

A `<ConfigScene config={paymasterScene} />` renderer interprets this config. Custom scenes still use JSX directly when they need unique geometry.

### 10. Theatre.js Integration (Phase 2)

Replace `createTimeline` + `useAnimationCycle` with Theatre.js for visual authoring:

1. Install `@theatre/core`, `@theatre/studio`, `@theatre/r3f`
2. Each scene gets a Theatre.js **sheet** with named objects (camera, nodes, flows)
3. Animation keyframes are authored visually in Theatre.js Studio (dev mode only)
4. Export the sheet state as JSON → commit to `frontend/content/learn/animations/`
5. Production loads the JSON, no studio overhead

Benefits: non-engineers can tweak timing, camera paths, and transitions visually. Animation state is version-controlled JSON.

### 11. Leva Dev Controls (Phase 2)

Dev-mode GUI panels for each scene:

```tsx
// In dev only:
const { cameraFov, cycleDuration, nodeSpacing } = useControls('Scene', {
  cameraFov: { value: 34, min: 20, max: 60 },
  cycleDuration: { value: 10, min: 4, max: 20 },
  nodeSpacing: { value: 2.5, min: 1, max: 5 },
})
```

Tree-shaken in production via `import('leva').then(...)` dynamic import.

### 12. Performance Budget (`shared/perf.ts`)

Runtime assertions (dev only) that enforce framework limits:

```ts
export function useSceneBudget(opts: {
  maxObjects?: number   // default 120
  maxDrawCalls?: number // default 50
  warnOnly?: boolean
})
```

Hooks into `useFrame` to read `gl.info.render.calls` and `scene.children.length`. Logs warnings or throws in dev if budget is exceeded.

### 13. Auto MDX Registration

Convention-based discovery. Instead of hand-importing every scene in `mdx/index.tsx`:

```ts
// mdx/index.tsx
import { loadSceneComponents } from '@/components/learn/diagrams/registry'

const mdxComponents = {
  ...staticComponents,
  ...loadSceneComponents(),  // auto-discovers all index.tsx barrel exports
}
```

Each article folder's `index.tsx` exports a `SCENE_REGISTRY` map. The loader collects them.

---

## Implementation Phases

### Phase 1 — Extract & Standardize (eliminate duplication)

| Task | Files | Effort |
|------|-------|--------|
| Create `shared/colors.ts` with `SCENE_COLORS` | 1 new, ~20 updated | Small |
| Create `shared/animation.ts` with utilities + `useAnimationCycle` | 1 new, ~20 updated | Small |
| Create `shared/timeline.ts` with `createTimeline` | 1 new | Small |
| Create `shared/ArticleCanvas.tsx` | 1 new, ~20 updated | Medium |
| Create `shared/StandardLighting.tsx` | 1 new | Small |
| Create `shared/materials.ts` presets | 1 new | Small |
| Adopt `SmartLabel` in all scenes (replace raw `<Html>`) | ~20 updated | Medium |
| Remove inline Legend functions (already done for eip8141-v2) | Verify scaling/ scenes | Small |
| Delete `eip8141/` (old v1 scenes) and clean MDX registry | ~10 deleted | Small |

**Outcome:** Every scene file drops from 600-900 lines to ~300-400 lines. Zero duplication of colors, easing, lighting, or Canvas config.

### Phase 2 — Primitive Library (composable building blocks)

| Task | Files | Effort |
|------|-------|--------|
| Build `<Node>` primitive | 1 new | Medium |
| Build `<Container>` primitive | 1 new | Small |
| Build `<Gate>` primitive | 1 new | Small |
| Build `<Platform>` primitive (generalize existing) | 1 new | Small |
| Build `<Padlock>` primitive | 1 new | Small |
| Build `<FlowPath>` primitive (tube + sparks) | 1 new | Medium |
| Build `<FlowBeam>` primitive | 1 new | Small |
| Build `<AmbientParticles>` primitive | 1 new | Small |
| Build `<GridLayout>` + `<GridCell>` | 2 new | Medium |
| Refactor 2-3 scenes to use primitives (prove the API) | ~3 updated | Medium |

**Outcome:** A library of ~10 primitives that cover 90% of scene patterns. New scenes compose from these instead of writing raw geometry.

### Phase 3 — Timeline & Visual Authoring

| Task | Files | Effort |
|------|-------|--------|
| Install Theatre.js (`@theatre/core`, `@theatre/studio`, `@theatre/r3f`) | package.json | Small |
| Create `shared/TheatreProvider.tsx` (dev studio wrapper) | 1 new | Small |
| Convert 1 scene to Theatre.js sequences | 1 updated | Medium |
| Export animation sheet as JSON, verify git-friendly | JSON files | Small |
| Add Leva dev controls to ArticleCanvas | 1 updated | Small |
| Add `useSceneBudget` perf monitor | 1 new | Small |

**Outcome:** Animation authoring moves from code to visual timeline. Designers can tweak timing without touching JSX.

### Phase 4 — Config-Driven Scenes

| Task | Files | Effort |
|------|-------|--------|
| Define `SceneConfig` TypeScript interface | 1 new | Small |
| Build `<ConfigScene>` renderer | 1 new | Large |
| Convert 2-3 simple scenes to config format | ~3 updated | Medium |
| Auto MDX registration | 2 updated | Small |

**Outcome:** Simple scenes are pure data. Complex scenes still use JSX with shared primitives. MDX registration is automatic.

---

## File Structure (Final State)

```
frontend/components/learn/diagrams/
├── scaling/
│   ├── SceneContainer.tsx          ← existing (WebGL, lazy mount, errors)
│   └── shared/
│       ├── index.ts                ← barrel export
│       ├── colors.ts               ← SCENE_COLORS tokens
│       ├── animation.ts            ← easeInOut, useAnimationCycle, etc.
│       ├── timeline.ts             ← createTimeline, Beat, Timeline
│       ├── materials.ts            ← material presets
│       ├── perf.ts                 ← useSceneBudget
│       ├── ArticleCanvas.tsx       ← Canvas + lighting + controls preset
│       ├── StandardLighting.tsx    ← three-light setup
│       ├── AutoFitCamera.tsx       ← existing
│       ├── SceneLegend.tsx         ← existing
│       ├── SmartLabel.tsx          ← existing
│       ├── ContextDisposer.tsx     ← existing
│       ├── GridLayout.tsx          ← grid positioning
│       ├── ConfigScene.tsx         ← config-driven renderer (Phase 4)
│       └── primitives/
│           ├── Node.tsx            ← sphere actor
│           ├── Container.tsx       ← RoundedBox frame
│           ├── Gate.tsx            ← torus checkpoint
│           ├── Platform.tsx        ← ground surface
│           ├── Padlock.tsx         ← auth symbol
│           ├── FlowPath.tsx        ← bezier tube + sparks
│           ├── FlowBeam.tsx        ← directional beam
│           └── AmbientParticles.tsx ← background drift
├── eip8141-v2/                     ← scene implementations
│   ├── index.tsx                   ← dynamic imports
│   ├── NormalVsFrame3D.tsx
│   ├── PaymasterFlow3D.tsx
│   └── ...
└── registry.ts                     ← auto MDX registration (Phase 4)
```

---

## Quality Gates

Before merging each phase:

1. **TypeScript strict** — zero errors
2. **No hardcoded hex colors** — all colors from `SCENE_COLORS` or inline override with comment
3. **No copy-pasted utilities** — `easeInOut`, `clamp01`, `rangeT` imported from `animation.ts`
4. **No inline Canvas boilerplate** — all scenes use `<ArticleCanvas>`
5. **All labels use `<SmartLabel>`** — no raw `<Html>` for scene labels
6. **Performance budget** — `useSceneBudget` passes in dev for every scene
7. **Visual regression** — screenshot comparison before/after for each refactored scene
8. **Bundle size** — no phase adds > 50KB gzipped to the learn page bundle

---

## What This Does NOT Cover

- **3D model loading** (glTF/GLB) — not needed yet; all shapes are procedural
- **Physics simulation** — not needed for educational diagrams
- **VR/AR** — not in scope
- **Scroll-driven scene transitions** — considered for Phase 5 if articles move to continuous scroll format
- **Multi-article theme system** — each article can override color tokens if needed, but this is not a priority
