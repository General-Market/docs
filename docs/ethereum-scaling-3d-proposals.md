# Ethereum Scaling Roadmap — 3D Scene Proposals

8 Three.js / React Three Fiber diorama scenes for the Ethereum scaling article.
Each scene uses a spatial metaphor that teaches the concept without reading text.

Style contract (inherited from EIPTimeline3D / FrameTransactionScene):
- White `#ffffff` background, white ground plane
- `RoundedBox` from drei for all box primitives
- `instancedMesh` for particles and repeating elements (MANDATORY for >8 identical meshes)
- `Html` labels from drei (minimal — geometry teaches, text confirms)
- `OrbitControls` with `autoRotate` at 0.4 speed, zoom/pan disabled
- Step risers (thin white RoundedBox slabs) under main objects
- Contact shadows at 30% opacity
- Hover: lift 4px (0.04 world units), lighten color to `#fff`
- Flow particles on bezier curves, sphere geometry (8,8), transparent
- `flat` Canvas, camera fov 36-38, dpr [1,2], antialias true
- NO GLTF models. All THREE.js primitives.
- NO "ambient dust" particles. Every particle must represent data, gas, proofs, or transactions.
- NO gratuitous animations. If you cannot finish "This animates because ___," delete it.
- Canvas wrapper: `role="img"` and `aria-label` describing the concept for screen readers.

Color palette:
- Green: `#22c55e` (primary accent, success, Ethereum)
- Blue: `#3b82f6` (execution, compute)
- Indigo: `#6366f1` (calldata, data)
- Violet: `#8b5cf6` (proofs, ZK)
- Amber: `#f59e0b` (state creation, warning)
- Red: `#ef4444` (bottleneck, today/problem)
- Zinc greys: `#d4d4d8`, `#a1a1aa`, `#71717a` (neutral, inactive)

Performance budget (replaces "200+ prop" vanity target):
- **Draw calls: <50 per scene.** An instancedMesh with 64 instances = 1 draw call.
- **Zero gratuitous particles.** Do not pad scenes with filler to hit a number.
- **useFrame delta:** All callbacks use the `delta` argument, never assume 60fps.
- **Shadows:** `castShadow` on max 6-8 objects. Shadow map 512x512. `receiveShadow` only on ground.
- **NO transparent overlapping large planes.** Transparent materials only on small elements.
- **Static SVG fallback** for each scene when WebGL is unavailable.

---

## Scene 1: RoadmapStaircase3D

**Complexity: 2/5**

### Description

Ethereum's scaling roadmap is a staircase of three layers — execution, data, proofs — and each step enables the next.

**5-second test (mute):** Three ascending platforms. Left platform has DISTINCT shapes (a funnel, a clock face, a tank). Middle platform has flat grid slabs. Right platform has towers. The shapes alone tell you "different kinds of work, building upward." The tallest green pillar on the top platform is the destination.

### Layout

```
                    CAMERA  [2, 5, 8] — slight right offset to show height
                      |
                      v

   EXECUTION (low)     DATA (mid)         PROOFS (high)
   y=0.0              y=0.25             y=0.5
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │ ⌛  🕐  🪣│  >>>  │ ▦    ▦   │  >>>  │ 🗼  🗼   │
   │ AL  ePBS GS│      │ BL  PD  │       │ ZK  FV   │
   │           │       │          │       │    ┌──┐  │
   │           │       │          │       │    │FS│  │
   └──────────┘       └──────────┘       └──────────┘

   ◄──── X-axis: time ──────────────────────────────►
```

### Models

| Object | Primitive | Dimensions (w,h,d) | Color | Count |
|--------|-----------|---------------------|-------|-------|
| Ground plane | plane | 14.0 x 14.0 | #ffffff | 1 |
| Platform (execution) | RoundedBox | 3.5 x 0.08 x 2.5 | #dbeafe (blue tint) | 1 |
| Platform (data) | RoundedBox | 3.0 x 0.08 x 2.5 | #e0e7ff (indigo tint) | 1 |
| Platform (proofs) | RoundedBox | 3.0 x 0.08 x 2.5 | #f5f3ff (violet tint) | 1 |
| Stair risers (platform connections) | RoundedBox | 0.4 x step_h x 2.5 | #e5e7eb | 2 |
| AL: funnel (shows parallel lanes) | cone inverted | r1=0.15, r2=0.35, h=0.5 | #3b82f6 | 1 |
| ePBS: clock ring (shows slot time) | torus | R=0.25, r=0.02 | #3b82f6 | 1 |
| GS: tank (shows gas metering) | RoundedBox | 0.35 x 0.6 x 0.35 | #f59e0b | 1 |
| Blobs: flat grid slab (shows data cells) | RoundedBox | 0.7 x 0.08 x 0.7, with 4x4 cell texture | #6366f1 | 1 |
| PeerDAS: grid slab with sample marks | RoundedBox | 0.7 x 0.08 x 0.7 | #6366f1 | 1 |
| ZK-EVM: prover tower (tall) | RoundedBox | 0.3 x 0.7 x 0.3 | #8b5cf6 | 1 |
| Formal Verif: prover tower (tall, green accent) | RoundedBox | 0.3 x 0.7 x 0.3 | #8b5cf6, green top accent | 1 |
| Full Stack pillar (proofs platform, tallest) | RoundedBox | 0.7 x 1.2 x 0.7 | #22c55e | 1 |
| Step risers under objects | RoundedBox | 0.7 x 0.02 x 0.7 | #ffffff | 6 |
| Accent planes on pillar tops | plane | (w-0.02, d-0.02) | per-color, 15% opac | 6 |
| Dependency arrows (tube on bezier) | TubeGeometry | radius 0.012 | #a1a1aa | 4 |
| Cross-platform dependency arrows | TubeGeometry | radius 0.008 | #22c55e 50% opac | 3 |
| Timeline bar (ground level) | RoundedBox | 11.0 x 0.01 x 0.1 | #d4d4d8 | 1 |
| Year tick marks | cylinder | r=0.005, h=0.06 | #a1a1aa | 4 |

Object heights encode estimated throughput impact: funnel (0.5) and clock (ring 0.25 radius) are moderate improvements, tank (0.6) is larger, prover towers (0.7) represent significant proof gains, and the Full Stack pillar (1.2) is tallest because it represents the cumulative result. Shape differences — not just height — carry identity.

### Animations

| Element | Animation | Cause | Speed | Loop |
|---------|-----------|-------|-------|------|
| Flow particles (dependency) | Travel along bezier L-to-R | Shows data dependency between layers | t * 0.12 | infinite |
| Flow particles (cross-platform) | Travel along cross-links | Shows cross-cutting dependencies | t * 0.1 | infinite |
| Full Stack pillar | Static green glow (emissive 0.15) | Marks destination — NO animation needed | n/a | static |
| Year ticks | Sequential opacity pulse 0.4-1.0 | Shows time progression | 2s stagger | infinite |
| Throughput cubes (instanced, per platform) | Flow across platform surface L-to-R | Shows increasing capacity at each layer | t * 0.15 | infinite |

Initiative objects are STATIC. No bobbing. Their distinct shapes communicate identity.

### Particles

| Particle System | Primitive | Color | Count | Represents |
|----------------|-----------|-------|-------|------------|
| Flow particles (dependency arrows) | instancedMesh spheres, scale 0.02 | #22c55e | 40 (10/arrow) | Data/dependency flow between layers |
| Flow particles (cross-platform arrows) | instancedMesh spheres, scale 0.015 | per-arrow color | 24 (8/arrow) | Cross-cutting dependencies |
| Throughput cubes (execution platform) | instancedMesh RoundedBox, scale 0.08 | #3b82f6 | 12 | Transactions processed |
| Throughput cubes (data platform) | instancedMesh RoundedBox, scale 0.08 | #6366f1 | 24 | Data throughput increase |
| Throughput cubes (proofs platform) | instancedMesh RoundedBox, scale 0.08 | #22c55e | 48 | Final multiplied throughput |

Throughput cube counts (12, 24, 48) are a 2x multiplier per layer — the count IS the argument.

### Labels

| Label | Position | Content | Style |
|-------|----------|---------|-------|
| Object names | Html, above each object | "Access Lists", "ePBS", "Gas Split", "Blobs", "PeerDAS", "ZK-EVM", "Formal Verif", "Full Stack" | 12px bold, 9px sub |
| Year markers | Html, below timeline | "2024", "2025", "2026", "2027+" | 10px mono, zinc-400 |
| Platform labels | Html, front of platform | "Execution", "Data", "Proofs" | 10px uppercase tracking-wide |

### Interaction

- `OrbitControls`: autoRotate 0.4, zoom/pan disabled
- Polar angle: PI/4 to PI/3 (narrow band — this is a 2D layout, orbiting the back reveals nothing)
- Azimuth: -PI/8 to PI/8 (+/- 22.5 degrees)
- Hover on objects: lift 0.04, color -> #fff

### Camera

`position={[2, 5, 8]}` `fov={36}` — slight right offset reveals the height difference between platforms better than dead center.

### Mobile (375px)

6 initiative objects (not 8) across 3 platforms = 2 per platform. Each gets ~60px of viewport width. Labels: 12px bold fits. Sub-labels hidden on mobile via a `useMediaQuery` check.

### Accessibility

`aria-label="Three ascending platforms representing Ethereum's execution, data, and proof scaling layers, with arrows showing dependencies between them"`

### SVG Fallback

Three ascending rectangles (blue, indigo, violet) with labeled icons per platform and rightward arrows between them. Full Stack pillar represented as a tall green rectangle on the rightmost platform.

### Draw Call Budget

~20 discrete meshes + 4 instancedMesh systems = ~24 draw calls. Well under 50.

---

## Scene 2: ParallelVerification3D

**Complexity: 3/5**

### Description

Sequential transaction processing is slow. Access lists reveal which slots each transaction touches, enabling parallel lanes.

**5-second test (mute):** Left side: cubes jammed in single file behind a funnel. Right side: same cubes spread across 5 parallel lanes. The red ruler on the left is 2.5x longer than the green ruler on the right. Immediately reads as "bottleneck vs throughput."

### Layout

```
                    CAMERA [0, 5, 7]
                      |
                      v

  ── SEQUENTIAL (left) ──          ── PARALLEL (right) ──

  ┌────────────────────────┐      ┌────────────────────────┐
  │                        │      │  Lane 1: [T1][T3]      │
  │  [T1]→[T2]→[T3]→[T4]  │      │  Lane 2: [T2][T5]      │
  │  →[T5]→[T6]→[T7]→[T8] │      │  Lane 3: [T4][T7]      │
  │                        │      │  Lane 4: [T6]           │
  │  ◄──── long ruler ───► │      │  Lane 5: [T8]           │
  └────────────────────────┘      └────────────────────────┘
                                   ◄─ short ─►
```

### Models

| Object | Primitive | Dimensions | Color | Count |
|--------|-----------|------------|-------|-------|
| Ground platform (sequential) | RoundedBox | 5.0 x 0.06 x 2.0 | #fef2f2 (red tint) | 1 |
| Ground platform (parallel) | RoundedBox | 5.0 x 0.06 x 3.5 | #f0fdf4 (green tint) — WIDER than sequential to show capacity | 1 |
| Transaction cubes (sequential) | RoundedBox | 0.3 x 0.3 x 0.3 | #ef4444 | 8 |
| Transaction cubes (parallel) | RoundedBox | 0.3 x 0.3 x 0.3 | #22c55e | 8 |
| Sequential conveyor rail | TubeGeometry | radius 0.015, ~4.5 units | #d4d4d8 | 1 |
| Parallel lane rails | TubeGeometry | radius 0.012, ~3.5 each | #22c55e 40% opac | 5 |
| Bottleneck funnel (sequential side) | cone | r1=0.5, r2=0.1, h=0.3 | #ef4444 30% opac | 1 |
| Dependency wires (connecting tx sharing slots) | TubeGeometry thin bezier | radius 0.005 | #f59e0b 50% opac | 4 |
| Time ruler (sequential) | RoundedBox | 4.5 x 0.01 x 0.06 | #ef4444 | 1 |
| Time ruler (parallel) | RoundedBox | 1.8 x 0.01 x 0.06 | #22c55e | 1 |
| Lane divider markings | thin planes on ground | 3.5 x 0.002 | #d4d4d8 | 4 |
| Step risers | RoundedBox | varies x 0.02 | #ffffff | 6 |
| Divider line | RoundedBox | 0.01 x 0.3 x 3.5 | #e5e7eb | 1 |

### Animations

| Element | Animation | Cause | Speed | Loop |
|---------|-----------|-------|-------|------|
| Sequential cubes | March L-to-R one-at-a-time, each waits for previous | Shows sequential bottleneck — cube N blocks cube N+1 | 1.5s per cube | infinite |
| Parallel cubes | All lanes advance simultaneously | Shows parallel execution — no blocking | all 5 lanes sync, 1.5s per step | infinite |
| Conveyor particles | Flow along sequential rail (slow) | Shows slow throughput | t * 0.1 | infinite |
| Lane particles | Flow along all 5 parallel rails (fast) | Shows fast throughput | t * 0.2 | infinite |
| Bottleneck funnel | Squeeze pulse (scale x oscillation) | Shows constriction — cubes compress as they pass | sin(t * 2) * 0.08 | infinite |
| Dependency wires | Pulse opacity 0.2-0.8 traveling along wire | Shows WHY certain tx share lanes (shared storage) | 1s per pulse | infinite |

### Particles

| Particle System | Primitive | Color | Count | Represents |
|----------------|-----------|-------|-------|------------|
| Slot color badges on cube faces | instancedMesh planes, 0.12 x 0.12 | per-slot color | 16 | Storage slots accessed per tx |
| Conveyor particles (sequential) | instancedMesh spheres, scale 0.012 | #ef4444 | 16 | Transaction flow (slow) |
| Lane particles (parallel, all 5 lanes) | instancedMesh spheres, scale 0.012 | #22c55e | 40 (8/lane) | Transaction flow (fast) |
| Dependency spark particles | instancedMesh spheres, scale 0.006 | #f59e0b | 16 | Shared storage slot conflicts |

### Labels

| Label | Position | Content | Style |
|-------|----------|---------|-------|
| "SEQUENTIAL" | Html, above left platform | "Sequential" | 10px uppercase, red |
| "PARALLEL" | Html, above right platform | "Parallel" | 10px uppercase, green |
| Time durations | Html, BELOW rulers (not beside — avoids collision on mobile) | Qualitative only: "Slow" / "Fast" | 9px mono |

No specific ms numbers — they are fictional and unverifiable. The ruler LENGTH difference is the argument.

### Interaction

- `OrbitControls`: autoRotate 0.4, zoom/pan disabled
- Polar angle: PI/4 to PI/3 (narrow — 2D layout)
- Azimuth: -PI/8 to PI/8
- Hover on transaction cubes: lift 0.04, color -> #fff, show slot badges

### Camera

`position={[0, 5, 7]}` `fov={36}`

### Mobile (375px)

Side-by-side works at 375px. Each half ~180px. Cubes render at 0.3 world units, readable. Time labels below platforms (not beside) prevents collision.

### Accessibility

`aria-label="Side-by-side comparison showing transactions processed one at a time on the left versus five parallel lanes on the right, demonstrating how access lists enable parallel execution"`

### SVG Fallback

Two rectangles side by side. Left: single row of red squares with a long red bar beneath. Right: five stacked rows of green squares with a short green bar beneath. Labels "Sequential" and "Parallel" above each.

### Draw Call Budget

~22 discrete + 4 instancedMesh = ~26 draw calls.

---

## Scene 3: EPBSSlotClock3D

**Complexity: 3/5** (downgraded from 4 — use flat ShapeGeometry segments, not ExtrudeGeometry)

### Description

Today, validators get 2.5% of a 12-second slot for verification. ePBS gives them ~42% (from 2.5%). The clock metaphor makes wasted time visceral.

**5-second test (mute):** Two clocks. Left clock: nearly all grey, tiny red sliver. Right clock: three distinct colored segments filling most of the face, with a small grey gap remaining for network overhead. Immediately reads as "wasted vs utilized."

### Layout

```
                    CAMERA [0, 6, 5]
                      |
                      v

   ── TODAY ──                    ── WITH ePBS ──

   ┌──────────────────┐          ┌──────────────────┐
   │    ┌────────┐    │          │    ┌────────┐    │
   │    │ CLOCK  │    │          │    │ CLOCK  │    │
   │    │  97.5% │    │          │    │  B/P/V │    │
   │    │  GREY  │    │          │    │ filled │    │
   │    └────────┘    │          │    │ (grey  │    │
   │                  │          │    │  gap)  │    │
   │                  │          │    └────────┘    │
   └──────────────────┘          └──────────────────┘
```

### Models

| Object | Primitive | Dimensions | Color | Count |
|--------|-----------|------------|-------|-------|
| Ground plane | plane | 14.0 x 14.0 | #ffffff | 1 |
| Clock ring (today) | torus | R=1.2, r=0.04 | #d4d4d8 | 1 |
| Clock ring (ePBS) | torus | R=1.2, r=0.04 | #d4d4d8 | 1 |
| Clock face disk (today) | cylinder | r=1.15, h=0.02 | #fafafa | 1 |
| Clock face disk (ePBS) | cylinder | r=1.15, h=0.02 | #fafafa | 1 |
| Verification sliver (today, 9-degree arc) | ShapeGeometry extruded 0.03 | arc, r=1.1 | #ef4444 | 1 |
| Dead zone (today, 351-degree arc) | ShapeGeometry extruded 0.03 | arc, r=1.1 | #f4f4f5 | 1 |
| Builder segment (ePBS, 100-deg) | ShapeGeometry extruded 0.03 | arc, r=1.1 | #3b82f6 | 1 |
| Proposer segment (ePBS, 50-deg) | ShapeGeometry extruded 0.03 | arc, r=1.1 | #f59e0b | 1 |
| Verification segment (ePBS, 150-deg) | ShapeGeometry extruded 0.03 | arc, r=1.1 | #22c55e | 1 |
| Network overhead gap (ePBS, 60-deg) | ShapeGeometry extruded 0.03 | arc, r=1.1 | #f4f4f5 | 1 |
| Sweep hand (today) | RoundedBox | 0.03 x 1.0 x 0.015 | #ef4444 | 1 |
| Sweep hand (ePBS) | RoundedBox | 0.03 x 1.0 x 0.015 | #22c55e | 1 |
| Step risers | RoundedBox | 2.8 x 0.02 x 2.8 | #ffffff | 2 |
| Divider line | RoundedBox | 0.01 x 0.3 x 3.5 | #e5e7eb | 1 |

Note: ePBS segments total 300 degrees (not 360). The remaining 60 degrees is grey — representing network propagation overhead. This is honest. The improvement is 2.5% to ~42% verification time, not 2.5% to 100%.

### Animations

| Element | Animation | Cause | Speed | Loop |
|---------|-----------|-------|-------|------|
| Sweep hand (today) | Full 360 rotation in 12s (real-time slot) | Shows real-time slot progression | 1 rev / 12s | infinite |
| Sweep hand (ePBS) | Same speed, synced | Same clock speed, different utilization | same | infinite |
| Verification sliver (today) | Flash red as sweep hand passes through it (~0.3s exposure) | Shows how BRIEF the verification window is | per revolution | infinite |
| ePBS segments | Glow sequentially as sweep hand enters each (builder -> proposer -> verify) | Shows each role's time allocation being used | 0.5s glow | infinite |

No "orbit within arc" particles. The sweep hand is the ONLY moving element. Simplicity IS the argument.

### Particles

| Particle System | Primitive | Color | Count | Represents |
|----------------|-----------|-------|-------|------------|
| Hour tick marks | instancedMesh cylinders, r=0.006, h=0.05 | #71717a | 24 (12/clock) | Clock hour divisions |

That is it. No segment fill particles. The colored segments themselves are the visual. Particles inside arcs are confetti.

### Labels

| Label | Position | Content | Style |
|-------|----------|---------|-------|
| "TODAY" | Html, above left clock | "Today" | 10px uppercase, red |
| "WITH ePBS" | Html, above right clock | "With ePBS" | 10px uppercase, green |
| Segment labels | Html, inside each arc | "Build", "Propose", "Verify" | 9px, per-segment color |
| Utilization percent | Html, below each clock | "2.5%", "~42%" | 12px bold mono |

### Interaction

- `OrbitControls`: autoRotate 0.4, zoom/pan disabled
- Full orbit allowed — clocks are interesting from multiple angles (but they are flat, so the benefit is mostly parallax)
- Hover on clock segments (ePBS): lift 0.04, brighten

### Camera

`position={[0, 6, 5]}` `fov={36}`

### Mobile (375px)

Two clocks side by side. Each clock ~180px diameter. Segment labels at 9px fit. No issues.

### Accessibility

`aria-label="Two clock faces comparing Ethereum slot time utilization. Today's clock shows 97.5% grey wasted time with a tiny red verification sliver. The ePBS clock shows three colored segments for builder, proposer, and verifier roles using about 83% of the slot."`

### SVG Fallback

Two circles side by side. Left circle: mostly light grey fill with a thin red arc at 12-o'clock. Right circle: three colored arc segments (blue, amber, green) with a small grey gap. Percentage labels below each.

### Draw Call Budget

~15 discrete + 1 instancedMesh = ~16 draw calls. Very lightweight.

---

## Scene 4: GasEvolution3D

**Complexity: 4/5** (justified — overflow mechanism is the key concept)

### Description

Gas pricing evolves in three stages — one pool today, two pools at Glamsterdam (with reservoir overflow), N pools with floating prices in the future.

**5-second test (mute):** Three platforms at ascending heights. Left: one grey tank, half full. Middle: two tanks of DIFFERENT heights (blue tall, amber short with red cap) connected by a pipe to a reservoir below. Right: four tanks of DIFFERENT widths connected to a shared reservoir, each with a mini number display. Immediately reads as "from simple to sophisticated."

### Layout

```
                    CAMERA [2, 5, 8]
                      |
                      v

   STAGE 1 (y=0.0)      STAGE 2 (y=0.2)         STAGE 3 (y=0.4)

   ┌──────────┐         ┌──────────────┐         ┌──────────────────┐
   │  ┌────┐  │         │ ┌──┐  ┌──┐  │         │ ┌════┐┌──┐┌─┐┌──┐│
   │  │ONE │  │   >>>   │ │EX│  │ST│  │   >>>   │ │ EX ││CD││S││SA││
   │  │POOL│  │         │ └──┘  └──┘  │         │ └════┘└──┘└─┘└──┘│
   │  └────┘  │         │  overflow    │         │ ┌──────────────┐ │
   │          │         │  ══pipe══    │         │ │  RESERVOIR   │ │
   │          │         │  ┌────────┐  │         │ └──────────────┘ │
   │          │         │  │RESERV. │  │         │  [8gw][3gw]...  │
   │          │         │  └────────┘  │         │   price tickers  │
   └──────────┘         └──────────────┘         └──────────────────┘
```

### Models

| Object | Primitive | Dimensions | Color | Count |
|--------|-----------|------------|-------|-------|
| Ground plane | plane | 14.0 x 14.0 | #ffffff | 1 |
| Stage 1 platform | RoundedBox | 2.5 x 0.08 x 2.5 | #f4f4f5 | 1 |
| Stage 2 platform | RoundedBox | 3.0 x 0.08 x 3.0 | #f0fdf4 | 1 |
| Stage 3 platform | RoundedBox | 3.5 x 0.08 x 3.5 | #eff6ff | 1 |
| Stair risers (1->2, 2->3) | RoundedBox | 0.5 x step_h x 2.5 | #e5e7eb | 2 |
| Single gas tank (S1) | RoundedBox | 0.6 x 1.0 x 0.6 | #d4d4d8 | 1 |
| Single fill (S1) | RoundedBox inner | 0.5 x animated x 0.5 | #a1a1aa 50% | 1 |
| Exec tank (S2) | RoundedBox | 0.5 x 1.0 x 0.5 | #3b82f6 | 1 |
| State tank (S2) — SHORTER than exec | RoundedBox | 0.5 x 0.5 x 0.5 | #f59e0b | 1 |
| Exec fill (S2) | RoundedBox inner | animated | #3b82f6 50% | 1 |
| State fill (S2) | RoundedBox inner | animated, small range | #f59e0b 50% | 1 |
| Overflow pipe (S2) | TubeGeometry horizontal bezier | radius 0.02 | #a1a1aa | 1 |
| Reservoir tank (S2) | RoundedBox | 1.0 x 0.5 x 0.5 | #71717a | 1 |
| Reservoir fill (S2) | RoundedBox inner | animated | #71717a 40% | 1 |
| Cap bar (state tank, S2) | RoundedBox | 0.6 x 0.025 x 0.025 | #ef4444 | 1 |
| Growth chevrons (exec tank, S2) | 3 rotated planes | 0.2 x 0.08 | #22c55e | 3 |
| Exec tank (S3) — WIDEST (70% of gas) | RoundedBox | 0.6 x 0.9 x 0.4 | #3b82f6 | 1 |
| Calldata tank (S3) | RoundedBox | 0.35 x 0.8 x 0.4 | #6366f1 | 1 |
| State tank (S3) — NARROWEST (5% of gas) | RoundedBox | 0.2 x 0.6 x 0.4 | #f59e0b | 1 |
| State access tank (S3) — not yet live | RoundedBox | 0.25 x 0.7 x 0.4 | #d4d4d8 border, #22c55e outline | 1 |
| Fills (S3) | 4 RoundedBox inner | animated | per-tank 50% | 4 |
| Reservoir (S3) | RoundedBox | 1.8 x 0.3 x 0.4 | #71717a | 1 |
| Reservoir fill (S3) | RoundedBox inner | animated | #71717a 40% | 1 |
| Overflow pipes (S3) | TubeGeometry x4 | radius 0.01 | #a1a1aa | 4 |
| Price ticker boards (S3) | RoundedBox thin upright | 0.3 x 0.2 x 0.015 | #1e1e1e | 4 |
| Step risers | RoundedBox | various | #ffffff | 8 |
| Stage plaques | RoundedBox thin | 0.4 x 0.15 x 0.015 | white border | 3 |

Key size differences that teach:
- S2: Exec tank (1.0 tall) vs State tank (0.5 tall) — exec has higher limit.
- S3: Tank widths proportional to gas share: exec=0.6, calldata=0.35, state=0.2, access=0.25.
- State access tank is GREY (not green) because it is a future proposal, not live.

### Animations

| Element | Animation | Cause | Speed | Loop |
|---------|-----------|-------|-------|------|
| S1 fill | Slow oscillation | Shows gas consumption/refill cycle | sin(t * 0.3) | infinite |
| S2 exec fill | Oscillation, larger range | Shows exec gas CAN GROW (no hard cap) | sin(t * 0.4) * 0.3 | infinite |
| S2 state fill | Small oscillation near cap | Shows state gas is CAPPED — fill bumps against red bar | sin(t * 0.5) * 0.1 | infinite |
| S2 overflow particles | Active when state fill nears cap, flow through pipe | CAUSE: cap reached. EFFECT: overflow to reservoir | bezier, t * 0.2 | infinite |
| S2 growth chevrons | Sequential upward opacity pulse | Shows "room to grow" direction | 0.5s stagger | infinite |
| S2 cap bar | Subtle red emissive pulse | Warns "hard limit here" | sin(t * 2) * 0.3 | infinite |
| S3 fills | Each oscillates independently | Shows independent gas markets | staggered sin | infinite |
| S3 price tickers | Digits update every 3-5s (random integer 5-20) | Shows dynamic pricing | random interval | infinite |
| S3 overflow particles | Continuous flow through overflow pipes | Shows reservoir as safety valve | bezier, t * 0.15 | infinite |
| Gas drain particles (all tanks) | Flow DOWNWARD inside tanks | Shows gas being consumed (not brownian jiggle) | t * 0.3, top to bottom | infinite |

### Particles

| Particle System | Primitive | Color | Count | Represents |
|----------------|-----------|-------|-------|------------|
| Progression arrows (floor) | instancedMesh chevron planes, 0.15 x 0.08 | #22c55e | 6 | Stage progression |
| Gas drain particles (S1) | instancedMesh spheres, scale 0.012 | #a1a1aa | 12 | Gas consumed |
| Gas drain particles (S2, exec) | instancedMesh spheres, scale 0.012 | #3b82f6 | 12 | Execution gas consumed |
| Gas drain particles (S2, state) | instancedMesh spheres, scale 0.012 | #f59e0b | 8 | State gas consumed |
| Overflow particles (S2) | instancedMesh spheres, scale 0.015 | amber->grey lerp | 10 | Excess gas flowing to reservoir |
| Gas drain particles (S3, all 4) | instancedMesh spheres, scale 0.01 | per-tank | 32 | Gas per dimension consumed |
| Reservoir particles (S3) | instancedMesh spheres, scale 0.012 | #71717a | 12 | Reservoir buffer |
| Overflow particles (S3) | instancedMesh spheres, scale 0.008 | per-tank | 16 | Excess gas per dimension |

### Labels

| Label | Position | Content | Style |
|-------|----------|---------|-------|
| Stage plaques | Html, front of platforms | "Today", "Glamsterdam", "Future" | 10px uppercase |
| Tank labels | Html, above each tank | "Exec", "State", "Calldata", "SA" | 9px per-color |
| Price values | Html, on ticker boards | Dynamic gwei values | 10px mono |

### Interaction

- `OrbitControls`: autoRotate 0.4, zoom/pan disabled
- Polar angle: PI/4 to PI/3 (narrow — L-to-R layout)
- Azimuth: -PI/8 to PI/8
- Hover on tanks: lift 0.04, color -> #fff

### Camera

`position={[2, 5, 8]}` `fov={36}` — slight right offset to show platform height differences.

### Mobile (375px)

Three stages at 375px = ~120px each. S3 is tight. Accept that mobile users orbit to focus on individual stages. Consider tighter FOV on mobile (fov=30) to zoom in.

### Accessibility

`aria-label="Three-stage evolution of Ethereum gas pricing, from a single pool today, to two separate pools with overflow at Glamsterdam, to four independently priced gas dimensions in the future"`

### SVG Fallback

Three platform rectangles at ascending heights. S1: one grey rectangle. S2: two rectangles (blue tall, amber short) with a horizontal line to a grey rectangle below. S3: four rectangles of different widths with number labels, connected to a long grey rectangle.

### Draw Call Budget

~40 discrete + 8 instancedMesh = ~48 draw calls. At the budget limit. Monitor carefully.

---

## Scene 5: BlobSampling3D

**Complexity: 3/5** (downgraded from 4 — reduce validators from 12 to 8, beams from 36 to 16)

### Description

Block producers emit large data blobs. PeerDAS means validators sample a few cells each instead of downloading everything. Collectively, 100% coverage is achieved.

**5-second test (mute):** Central dark tower broadcasts outward (expanding rings). Ring of small 4x4 GRID squares surrounds it — visibly grid-shaped, not scattered. Colored figures around the perimeter shoot thin green lines at specific grid cells, which glow on contact. Immediately reads as "sampling from a grid."

### Layout

```
                    CAMERA [0, 7, 3] — near top-down for radial layout
                      |
                      v

              o  o  o  o  o  o
            o                    o
          o    ▦▦▦▦  ▦▦▦▦  ▦▦▦▦   o
         o     GRID  GRID  GRID    o
         o           ┌──┐          o
          o          │BP│         o
            o        └──┘       o
              o  o  o  o  o  o

   o = validator (samples 2 cells each)
   Grids arranged in ring, VISIBLY 4x4 square layout
```

### Models

| Object | Primitive | Dimensions | Color | Count |
|--------|-----------|------------|-------|-------|
| Ground plane | plane | 12.0 x 12.0 | #ffffff | 1 |
| Block producer tower | RoundedBox | 0.5 x 1.0 x 0.5 | #1e1e1e | 1 |
| Producer antenna | cylinder + cone | r=0.015, h=0.3 | #71717a | 1 |
| Broadcast rings (expanding from producer) | torus | R animated, r=0.006 | #6366f1 25% opac | 3 |
| Blob container wireframes (4 blobs) | wireframe RoundedBox | 0.7 x 0.12 x 0.7 | #d4d4d8 | 4 |
| KZG commitment markers | small sphere on each blob | r=0.025 | #8b5cf6 | 4 |
| Network coverage ground disc | cylinder flat | r=4.0, h=0.003 | #22c55e 4% opac | 1 |
| Step risers | RoundedBox | various | #ffffff | 5 |

### Animations

| Element | Animation | Cause | Speed | Loop |
|---------|-----------|-------|-------|------|
| Broadcast rings | Expand from producer, fade at max R, respawn staggered | Shows data propagation outward from source | 3s per ring | infinite |
| Blob grid cells | STATIC. No oscillation. | They are data, not living things. | n/a | static |
| Sample beams | Each validator cycles through 2 sample targets, beam activates 1s, off 0.5s | Shows active sampling of specific cells | 1.5s per target | infinite |
| Sampled cell highlights | Glow bright when beam hits, fade over 2s | Shows successful data retrieval | 0.5s glow, 2s fade | per-beam |
| KZG markers | Pulse scale 1.0-1.2 | Shows cryptographic commitment (the ONE animated element on blobs) | sin(t * 2) | infinite |

Validators are STATIC. No bobbing. They are infrastructure, not dancing.

### Particles

| Particle System | Primitive | Color | Count | Represents |
|----------------|-----------|-------|-------|------------|
| Blob grid cells (4 blobs x 16 cells, 4x4 SQUARE layout) | instancedMesh cubes, 0.06 x 0.06 x 0.06 | #6366f1 varying opac | 64 | Data cells within blobs |
| Validator nodes | instancedMesh (merged sphere+cylinder) | #22c55e | 8 | Network validators |
| Sample beams (2 per validator) | instancedMesh thin box, 0.003 x len x 0.003 | #22c55e 35% opac | 16 | DAS sampling requests |
| Sampled cell highlights | instancedMesh cubes (slightly larger, emissive), 0.07 | #22c55e emissive | 16 | Successfully sampled cells |

8 validators x 2 beams = 16 beams. Same concept as 12x3=36, 56% fewer matrix computations.

### Labels

| Label | Position | Content | Style |
|-------|----------|---------|-------|
| "Block Producer" | Html, above tower | "Block Producer" | 10px bold |
| Blob labels | Html, above each grid | "Blob 1-4" | 9px mono |
| Coverage percentage | Html, center bottom | "100% coverage" (after all cells sampled) | 12px bold green |

### Interaction

- `OrbitControls`: autoRotate 0.4, zoom/pan disabled
- Full orbit allowed — radial layout benefits from all angles
- Hover on validator: lift 0.04, highlight its 2 sample targets

### Camera

`position={[0, 7, 3]}` `fov={32}` — near top-down to see ring structure without far validators overlapping near ones.

### Mobile (375px)

Radial layout compresses well. 8 validators in a ring at 375px — each gets ample spacing. No issues.

### Accessibility

`aria-label="Central block producer tower broadcasting data blobs outward, with 8 validators around the perimeter sampling specific cells from a grid, collectively achieving 100% data availability coverage"`

### SVG Fallback

Central dark square with concentric dashed circles radiating outward. Four small 4x4 grids arranged in a ring around it. Eight green dots around the perimeter with thin lines pointing at highlighted grid cells.

### Draw Call Budget

~15 discrete + 4 instancedMesh = ~19 draw calls. Very lightweight.

---

## Scene 6: ZKEVMPopulation3D

**Complexity: 3/5**

### Description

ZK-EVM adoption is gradual and cautious — from 5% of validators running ZK clients to 100% with formal verification, over 4 stages.

**5-second test (mute):** Four groups of figures on ascending platforms, left to right. Group 1: 1 large purple figure among 9 tiny grey figures. Group 2: 4 large purple among 6 tiny grey. Group 3: 10 figures, 6 purple with raised arms (voting), 4 grey with lowered arms. Group 4: ALL figures purple, green glow across the whole group. Immediately reads as "purple is taking over."

### Layout

```
                    CAMERA [2, 5, 8]
                      |
                      v

   ── 5% ──        ── 20% ──       ── 3-of-5 ──     ── VERIFIED ──
   y=0.0           y=0.12          y=0.24            y=0.36

   1 LARGE purple  4 LARGE purple  6 purple raised   ALL purple
   9 small grey    6 small grey    4 grey lowered    green glow
```

### Models

| Object | Primitive | Dimensions | Color | Count |
|--------|-----------|------------|-------|-------|
| Ground plane | plane | 14.0 x 14.0 | #ffffff | 1 |
| Stage platforms (4, ascending) | RoundedBox | 2.5 x 0.06 x 2.5 | #faf5ff | 4 |
| Stair risers (platform connections) | RoundedBox | 0.3 x step_h x 2.5 | #e5e7eb | 3 |
| Consensus arcs (Stage 3, connecting raised-hand figures) | TubeGeometry | radius 0.008 | #22c55e | 3 |
| Green glow disc (Stage 4, floor overlay) | cylinder | r=1.0, h=0.005 | #22c55e 15% opac | 1 |
| Timeline bar | RoundedBox | 10.0 x 0.008 x 0.08 | #d4d4d8 | 1 |
| Progress fill on timeline | RoundedBox | animated_w x 0.012 x 0.1 | #8b5cf6 | 1 |

Consistent figure metaphor across ALL 4 stages. No towers. No seals. No metaphor shifts.

### Animations

| Element | Animation | Cause | Speed | Loop |
|---------|-----------|-------|-------|------|
| ZK validators (purple) | Static. Large size IS the emphasis. | Their SIZE communicates importance, not fidgeting. | n/a | static |
| Trad validators (grey) | Static. Small and still. | Their smallness communicates declining relevance. | n/a | static |
| ZK sparkles | Orbit around ZK validator positions | Shows ZK proof generation activity | 0.5 rad/s, random phase | infinite |
| Network pulse rings | Expand from ZK validators, fade | Shows growing network influence | 2s per ring staggered | infinite |
| Stage 3 raised-hand figures | Subtle arm-up position (built into geometry, not animated) | Shows voting/agreement — STATIC pose, not animation | n/a | static |
| Consensus particles | Flow along arcs between raised-hand figures | Shows consensus messages between agreeing validators | bezier, t * 0.25 | infinite |
| Stage 4 glow disc | Slow pulse opacity 0.1-0.2 | Shows formal verification covers everything | sin(t * 0.8) | infinite |
| Progress fill | Grows L-to-R over 10s, resets | Shows timeline progression | linear | infinite loop |

### Particles

| Particle System | Primitive | Color | Count | Represents |
|----------------|-----------|-------|-------|------------|
| ZK validators Stage 1 (large purple figures) | instancedMesh (sphere+cylinder), scale 0.4 | #8b5cf6 | 1 | ZK-enabled validators |
| Trad validators Stage 1 (small grey figures) | instancedMesh (sphere+cylinder), scale 0.18 | #d4d4d8 | 9 | Traditional validators |
| ZK validators Stage 2 | instancedMesh, scale 0.4 | #8b5cf6 | 4 | Growing ZK adoption |
| Trad validators Stage 2 | instancedMesh, scale 0.18 | #d4d4d8 | 6 | Remaining traditional |
| Voting figures Stage 3 (raised hands, purple) | instancedMesh, scale 0.35 | #8b5cf6 | 6 | Agreeing ZK validators |
| Non-voting figures Stage 3 (lowered, grey) | instancedMesh, scale 0.18 | #d4d4d8 | 4 | Disagreeing/inactive |
| All-purple figures Stage 4 | instancedMesh, scale 0.35 | #8b5cf6 | 10 | Full ZK adoption |
| Year markers | instancedMesh cylinders, r=0.006, h=0.08 | #71717a | 4 | Timeline milestones |
| ZK proof sparkle particles | instancedMesh spheres, scale 0.006 | #8b5cf6 | 20 | ZK proof generation |
| Network pulse rings (from ZK validators) | instancedMesh torus, R=0.12, r=0.002 | #8b5cf6 25% | 10 | Network influence |
| Consensus beam particles (Stage 3 arcs) | instancedMesh spheres, scale 0.008 | #22c55e | 18 | Consensus messages |

ZK validators at scale 0.4, trad at 0.18 — a 2.2x size difference, readable on mobile.
10 figures per stage (not 20) — readable at 375px.

### Labels

| Label | Position | Content | Style |
|-------|----------|---------|-------|
| Stage labels | Html, above each platform | "5%", "20%", "3-of-5", "Verified" | 10px uppercase |
| Year markers | Html, below timeline | "2026", "2027", "2028", "2030+" | 9px mono |

### Interaction

- `OrbitControls`: autoRotate 0.4, zoom/pan disabled
- Polar angle: PI/4 to PI/3 (narrow — L-to-R layout)
- Azimuth: -PI/8 to PI/8
- Hover on ZK validators: lift 0.04, show sparkle burst

### Camera

`position={[2, 5, 8]}` `fov={36}`

### Mobile (375px)

4 stages at 375px = ~90px each. 10 figures per stage (not 20). 1 ZK figure at scale 0.4 is distinguishable from 9 grey figures at scale 0.18. Readable.

### Accessibility

`aria-label="Four stages of ZK-EVM adoption shown as figure populations on ascending platforms: 5% adoption, 20% adoption, 3-of-5 consensus voting, and 100% formally verified validators"`

### SVG Fallback

Four ascending rectangles left to right. Each contains circles (figures): Stage 1 has 1 large purple + 9 small grey. Stage 2 has 4 large purple + 6 small grey. Stage 3 has 6 purple with upward arrows + 4 grey. Stage 4 has 10 purple with a green background glow.

### Draw Call Budget

~15 discrete + 10 instancedMesh = ~25 draw calls.

---

## Scene 7: EOFContainerization3D

**Complexity: 2/5**

### Description

EOF (EVM Object Format) separates code from data in smart contracts. Today, code and data are mixed in a single blob. With EOF, contracts have structured sections — header, code, data — making static analysis, metering, and optimization possible.

**5-second test (mute):** Left: a translucent box with grey cubes tumbling chaotically inside. Right: the same cubes sorted into stacked colored compartments — still and organized. A green scanning line sweeps top-to-bottom through the right container. Immediately reads as "messy vs organized."

### Layout

```
                    CAMERA [0, 5, 7]
                      |
                      v

   ── TODAY ──                    ── WITH EOF ──

   ┌──────────────────┐          ┌──────────────────────┐
   │                  │          │ ┌──────┐ HEADER      │
   │   MIXED BLOB     │          │ └──────┘             │
   │   grey cubes     │          │ ┌──────┐ CODE SEC 1  │
   │   tumbling       │          │ └──────┘             │
   │                  │          │ ┌──────┐ CODE SEC 2  │
   │                  │          │ └──────┘             │
   │                  │          │ ┌──────┐ DATA        │
   │                  │          │ └──────┘             │
   └──────────────────┘          └──────────────────────┘
```

### Models

| Object | Primitive | Dimensions | Color | Count |
|--------|-----------|------------|-------|-------|
| Ground plane | plane | 12.0 x 12.0 | #ffffff | 1 |
| Today container (single box, translucent walls) | RoundedBox | 1.5 x 1.2 x 1.0 | #fef2f2 walls, 30% opac | 1 |
| EOF container (structured, translucent walls) | RoundedBox | 1.5 x 1.8 x 1.0 | #f0fdf4 walls, 30% opac | 1 |
| Header section box (EOF) | RoundedBox | 1.3 x 0.15 x 0.8 | #22c55e | 1 |
| Code section boxes (EOF, 2) | RoundedBox | 1.3 x 0.3 x 0.8 | #3b82f6 | 2 |
| Data section box (EOF) | RoundedBox | 1.3 x 0.25 x 0.8 | #6366f1 | 1 |
| Section divider planes (inside EOF container) | plane | 1.3 x 0.8 | #d4d4d8 15% opac | 3 |
| Analysis beam (scanning top-to-bottom) | RoundedBox thin | 1.4 x 0.015 x 0.9 | #22c55e 30% opac | 1 |
| Gas meter (next to EOF container) | RoundedBox + fill | 0.15 x 0.6 x 0.08 | #f59e0b border, fill animated | 1 |
| Step risers | RoundedBox | various | #ffffff | 4 |
| Divider line | RoundedBox | 0.01 x 0.4 x 3.0 | #e5e7eb | 1 |

### Animations

| Element | Animation | Cause | Speed | Loop |
|---------|-----------|-------|-------|------|
| Mixed content cubes (today) | Slow chaotic tumble — random rotation and slight position drift within bounds | Shows that code+data are JUMBLED and inseparable | random angular velocity per cube | infinite |
| Organized cubes (EOF) | Static grid, no movement | The STILLNESS is the point — structured code is analyzable BECAUSE it does not move | none | static |
| Analysis beam | Sweeps top-to-bottom through EOF container | Shows a static analyzer scanning structured code section by section | 3s per sweep, pause, repeat | infinite loop |
| Gas meter fill | Rises as analysis beam passes each section, resets | Shows that structured code enables accurate gas metering (CAUSE: beam passes section, EFFECT: meter rises) | synced with beam | infinite loop |
| Header section | Brief green flash when analysis beam passes | Shows section successfully analyzed | 0.3s | per-sweep |
| Code sections | Brief blue flash when beam passes | Shows section successfully analyzed | 0.3s | per-sweep |
| Data section | Brief indigo flash when beam passes | Shows section successfully analyzed | 0.3s | per-sweep |

### Particles

| Particle System | Primitive | Color | Count | Represents |
|----------------|-----------|-------|-------|------------|
| Mixed content cubes (inside today container) | instancedMesh RoundedBox, 0.12 x 0.12 x 0.12 | random mix of #a1a1aa, #d4d4d8, #71717a (GREY tones, NOT red — mixed code is not broken, just unstructured) | 60 | Jumbled code+data bytecode |
| Organized cubes inside code sections | instancedMesh RoundedBox, 0.1 x 0.1 x 0.1 | #3b82f6 | 35 | Structured code bytecode |
| Organized cubes inside data section | instancedMesh RoundedBox, 0.1 x 0.1 x 0.1 | #6366f1 | 18 | Structured data bytecode |
| Entropy particles (today, chaotic drift) | instancedMesh spheres, scale 0.008 | #ef4444 | 20 | Analysis FAILURES (red = problem, correctly used here) |
| Order particles (EOF, calm orbit) | instancedMesh spheres, scale 0.008 | #22c55e | 20 | Successful static analysis passes |

### Labels

| Label | Position | Content | Style |
|-------|----------|---------|-------|
| "TODAY" | Html, above left container | "Today: Mixed Bytecode" | 10px uppercase, red |
| "WITH EOF" | Html, above right container | "With EOF: Structured" | 10px uppercase, green |
| Section labels | Html, beside each section | "Header", "Code 1", "Code 2", "Data" | 9px per-section color |
| Gas meter label | Html, above meter | "Metering" | 8px amber |

### Interaction

- `OrbitControls`: autoRotate 0.4, zoom/pan disabled
- Polar angle: PI/4 to PI/3 (narrow — before/after layout)
- Azimuth: -PI/8 to PI/8
- Hover on sections (EOF): lift 0.04, brighten, show section name

### Camera

`position={[0, 5, 7]}` `fov={36}`

### Mobile (375px)

Two containers side by side. Each ~180px. Cubes at 0.1-0.12 world units are small but the COLOR CONTRAST (grey chaos vs colored order) reads at any size.

### Accessibility

`aria-label="Comparison of smart contract bytecode formats. Left shows today's mixed code and data as chaotically tumbling grey cubes. Right shows EOF format with neatly organized colored sections being scanned by an analysis beam."`

### SVG Fallback

Two rectangles side by side. Left: scattered small grey squares inside a red-tinted box. Right: four stacked colored bands (green header, two blue code sections, indigo data section) inside a green-tinted box, with a horizontal green line sweeping downward.

### Draw Call Budget

~16 discrete + 5 instancedMesh = ~21 draw calls. Very lightweight.

---

## Scene 8: FullStackLayers3D

**Complexity: 4/5** (downgraded from 5 — cut to 3 objects per layer, removed duplicates from other scenes)

### Description

All three scaling layers — execution, data, proofs — stack vertically and feed each other. The output is a validated block.

**5-second test (mute):** Three opaque colored floors stacked vertically. Bottom floor (blue) has a funnel, a clock, and a tank — instantly recognizable as the 3 execution components from earlier. Middle floor (indigo) has flat grid slabs. Top floor (violet) has towers connected by arcs. A green block rises from the top on a beam. Immediately reads as "layered factory producing output."

### Layout

```
                    CAMERA [5, 5, 5] — angled to show all 3 floors
                      |
                      v     target: [0, 0.7, 0]

   ┌──────────────────────────────┐  y=1.4
   │  PROOFS: 3 prover towers    │  (connected by green arcs)
   │  → green "VALID" block out  │
   ├──────────────────────────────┤  y=0.8
   │  DATA: 3 blob grids (4x4)  │  (one with highlight glow)
   │                              │
   ├──────────────────────────────┤  y=0.2
   │  EXECUTION: funnel + clock  │  (+ 1 tank)
   │  + 1 gas tank               │
   └──────────────────────────────┘  y=0.0

   Elevator shafts connecting all 3
   Valid block emits upward from proof layer
```

### Models

| Object | Primitive | Dimensions | Color | Count |
|--------|-----------|------------|-------|-------|
| Ground plane | plane | 10.0 x 10.0 | #ffffff | 1 |
| Layer 1 floor (execution, OPAQUE) | RoundedBox | 4.0 x 0.03 x 2.5 | #dbeafe | 1 |
| Layer 2 floor (data, OPAQUE) | RoundedBox | 4.0 x 0.03 x 2.5 | #e0e7ff | 1 |
| Layer 3 floor (proofs, OPAQUE) | RoundedBox | 4.0 x 0.03 x 2.5 | #f5f3ff | 1 |
| L1: Funnel (parallel verification) | cone inverted | r1=0.12, r2=0.25, h=0.35 | #3b82f6 | 1 |
| L1: Clock ring (ePBS) | torus | R=0.2, r=0.015 | #3b82f6 | 1 |
| L1: Gas tank | RoundedBox | 0.25 x 0.35 x 0.25 | #f59e0b | 1 |
| L2: Blob grids (3, 4x4 visible grid) | wireframe RoundedBox | 0.45 x 0.08 x 0.45 | #6366f1 30% opac | 3 |
| L3: Prover towers (3, connected by arcs) | RoundedBox | 0.25 x 0.4 x 0.25 | #8b5cf6 | 3 |
| Consensus arcs (2, connecting 3 provers) | TubeGeometry | radius 0.006 | #22c55e | 2 |
| Valid block output | RoundedBox | 0.35 x 0.2 x 0.35 | #22c55e | 1 |
| Output beam (vertical above block) | cylinder | r=0.03, h=0.5 | #22c55e 15% opac | 1 |
| Elevator shafts (vertical tubes, 2 per gap = 4) | TubeGeometry | radius 0.012 | #a1a1aa | 4 |
| Layer label plaques | RoundedBox thin | 0.5 x 0.12 x 0.015 | white, border per-layer color | 3 |
| Step risers | RoundedBox | various | #ffffff | 4 |

Floors are 4.0 wide (not 6.0). Objects are proportionally larger on each floor. 3 objects per layer, not 5-7. Each object is a MINIATURE of its corresponding scene's hero object — the funnel from Scene 2, the clock from Scene 3, the tank from Scene 4, etc.

### Animations

| Element | Animation | Cause | Speed | Loop |
|---------|-----------|-------|-------|------|
| Elevator particles | Rise through shafts, color lerps across layer boundaries | Shows data dependency flowing upward through the stack | bezier upward, t * 0.12 | infinite |
| Consensus particles (L3) | Flow along prover arcs | Shows proof consensus happening | bezier, t * 0.2 | infinite |
| Output burst | Emit upward from valid block, fan outward, fade | Shows validated output being produced | radial upward | infinite |
| Output beam | Pulse opacity 0.08-0.25 | Shows continuous validation output | sin(t * 1.5) | infinite |
| Valid block | Gentle Y rotation | Shows it is the OUTPUT, the thing being produced | 0.3 rad/s | infinite |

L1 and L2 objects are STATIC. They are reference markers, not active demonstrations (their own scenes handle that). Only L3 (proof consensus) and the elevator/output animations run.

### Particles

| Particle System | Primitive | Color | Count | Represents |
|----------------|-----------|-------|-------|------------|
| Blob grid cells (L2) | instancedMesh cubes, 0.03 x 0.03 x 0.03 | #6366f1 | 48 (3x16) | Data availability cells |
| Elevator particles (L1->L2) | instancedMesh spheres, scale 0.01 | #3b82f6 -> #6366f1 lerp | 12 | Data flowing up from execution |
| Elevator particles (L2->L3) | instancedMesh spheres, scale 0.01 | #6366f1 -> #8b5cf6 lerp | 12 | Data flowing up from data layer |
| Consensus particles (L3, along arcs) | instancedMesh spheres, scale 0.008 | #22c55e | 12 | Consensus messages |
| Output burst particles | instancedMesh spheres, scale 0.01 | #22c55e | 16 | Validated output |

### Labels

| Label | Position | Content | Style |
|-------|----------|---------|-------|
| Layer labels | Html, on plaques | "Execution", "Data", "Proofs" | 10px uppercase, per-layer color |
| Output label | Html, above valid block | "VALID" | 12px bold green |

No individual component labels on this scene. This is the OVERVIEW — it references the other scenes, it does not re-explain them.

### Interaction

- `OrbitControls`: autoRotate 0.4, zoom/pan disabled
- Full orbit allowed — vertical stack benefits from seeing all angles
- Hover on layer floors: lift 0.04, brighten components on that layer

### Camera

`position={[5, 5, 5]}` `fov={36}` with `target={[0, 0.7, 0]}` — angled so the middle layer is center-frame and all three floors are visible.

### Mobile (375px)

Vertical stack works well on phone — natural scrolling metaphor. 4.0 wide floors with 3 objects each = ~1.3 units per object. Readable at 375px.

### Accessibility

`aria-label="Three-layer vertical stack showing Ethereum's full scaling architecture. Bottom blue floor has execution components, middle indigo floor has data blobs, top violet floor has proof validators connected by consensus arcs. A green validated block rises from the top."`

### SVG Fallback

Three stacked colored rectangles (blue, indigo, violet) with simplified icons on each: funnel + clock + tank on bottom, three grids in middle, three towers with arcs on top. Vertical arrows between layers. Green square with "VALID" label rising from the top layer.

### Draw Call Budget

~22 discrete + 5 instancedMesh = ~27 draw calls. Comfortable.

---

## Summary Table

| # | Scene | Component Name | Complexity | Draw Calls | Primary Color | Teaches |
|---|-------|---------------|------------|------------|---------------|---------|
| 1 | Roadmap | RoadmapStaircase3D | 2/5 | ~24 | Mixed | Three-layer scaling roadmap |
| 2 | Parallel Verification | ParallelVerification3D | 3/5 | ~26 | Red -> Green | Sequential vs parallel tx |
| 3 | ePBS Slot Clock | EPBSSlotClock3D | 3/5 | ~16 | Red -> Green | Slot utilization 2.5% vs ~42% |
| 4 | Gas Evolution | GasEvolution3D | 4/5 | ~48 | Blue + Amber | Gas pricing in 3 stages |
| 5 | Blob Sampling | BlobSampling3D | 3/5 | ~19 | Indigo + Green | PeerDAS sampling != downloading |
| 6 | ZK-EVM Population | ZKEVMPopulation3D | 3/5 | ~25 | Violet + Green | Gradual ZK adoption |
| 7 | EOF Container | EOFContainerization3D | 2/5 | ~21 | Blue + Green | Code/data separation |
| 8 | Full Stack | FullStackLayers3D | 4/5 | ~27 | All layers | Layered system convergence |
| | **TOTALS** | | avg 3.0 | **~206** | | |

Draw call budget: 206 total across 8 scenes. Average 26 per scene. All under the 50 limit.

---

## Performance Strategy

### Critical Rules
- Every scene with >8 identical meshes MUST use `instancedMesh`. No exceptions.
- Maximum draw calls per scene: **<50**. All scenes currently estimated at 16-48.
- Blob grid cells (Scene 5: 64 cubes, Scene 8: 48 cubes) — single `instancedMesh` with per-instance color via `instanceColor`.
- Validator crowds (Scenes 5, 6) — bake sphere+cylinder into a single merged `BufferGeometry`, instance that.
- All `useFrame` callbacks: use the `delta` argument, never assume 60fps.
- NO textures. All solid colors via `meshStandardMaterial` or `meshBasicMaterial`.
- Shadows: `castShadow` only on main objects (max 6-8 per scene). `receiveShadow` only on ground plane. Shadow map 512x512.
- NO transparent overlapping large planes (overdraw death). Transparent materials only on small elements (particles, beams).
- Scene 8 (FullStackLayers): the 3 layer floors are OPAQUE, not transparent.
- Scene 3 (EPBSSlotClock): Use `ShapeGeometry` extruded to 0.03 depth for arc segments. NOT `ExtrudeGeometry` with complex arc paths.

### Mobile Performance Targets
- Galaxy A53 / iPhone 12 mini: 45fps minimum
- iPhone 14 / Pixel 7: 60fps
- Test with Chrome DevTools Performance tab on throttled CPU (4x slowdown)

### Lazy Loading
- Each 3D scene wrapped in `ClientOnly` with skeleton fallback (established pattern).
- IntersectionObserver: only mount Canvas when scene is within 200px of viewport.
- Unmount Canvas when scrolled 600px past (free GPU memory for next scene).

### WebGL Fallback
- Each scene must have a static SVG fallback that communicates the same concept when WebGL is unavailable.
- The SVG should be a simplified 2D version of the 3D layout (platforms as rectangles, arrows as lines, etc.).
- Detect WebGL failure via `Canvas` error boundary, swap to SVG.

### Accessibility
- Every Canvas wrapper gets `role="img"` and `aria-label` (specified per scene above).
- For screen readers: the aria-label IS the content. It must stand alone as a description.

---

## Shared Components (reuse across scenes)

Existing (from EIPTimeline3D / FrameTransactionScene / MempoolLayers / PrivacyDiagram):
- `StepRiser` — thin white RoundedBox slab
- `FlowParticles` — instancedMesh spheres on bezier curve
- `FlowArrow` — TubeGeometry on bezier
- `PersonModel` — sphere head + cylinder body + disk base
- `PoolModel` — torus rim + flat cylinder + instancedMesh floating cubes
- `ChainModel` — instancedMesh blocks + links on conveyor
- `CrowdUsers` — semicircle arc of instancedMesh figures + firing particles
- `VFlow` — vertical tube + instancedMesh particles

New shared components (with TypeScript interfaces):

```typescript
// TankModel — used in Scenes 4, 8
interface TankModelProps {
  position: [number, number, number]
  width: number
  height: number
  depth: number
  color: string          // tank wall color
  fillColor: string      // fill interior color
  fillPercent: number    // 0-1, animated target
  fillOscillation: number // amplitude of sin oscillation (0 = static)
  capBar?: boolean       // show red cap line at top
  showDrain?: boolean    // show downward-flowing drain particles
  drainCount?: number    // number of drain particles (default 8)
}

// ProverTower — used in Scenes 6, 8
interface ProverTowerProps {
  position: [number, number, number]
  agrees: boolean         // true = bright + green check, false = dim + grey X
  color?: string          // default #8b5cf6
  height?: number         // default 0.7
}

// BlobGrid — used in Scenes 5, 8
interface BlobGridProps {
  position: [number, number, number]
  cellCount: number       // total cells (should be a perfect square, e.g. 16)
  cellSize: number        // world units per cell cube
  baseColor: string       // default cell color
  highlightedIndices: number[]  // indices currently highlighted (green glow)
  onCellHighlight?: (index: number) => void
}

// PlatformStage — used in Scenes 1, 4, 6
interface PlatformStageProps {
  position: [number, number, number]
  width: number
  depth: number
  color: string           // platform surface color
  label: string           // platform label text
  labelColor: string      // label text color
  stairFrom?: [number, number, number]  // if set, render stair riser from this position
}

// ValidatorFigure — used in Scenes 5, 6
// Baked merged geometry: sphere(head) + cylinder(body) + disk(base)
// Designed for instancedMesh usage
interface ValidatorFigureGeometry {
  // Returns a single BufferGeometry suitable for instancedMesh
  createMergedGeometry(): THREE.BufferGeometry
}
```

---

## File Organization

```
frontend/components/learn/diagrams/scaling/
  RoadmapStaircase3D.tsx
  ParallelVerification3D.tsx
  EPBSSlotClock3D.tsx
  GasEvolution3D.tsx
  BlobSampling3D.tsx
  ZKEVMPopulation3D.tsx
  EOFContainerization3D.tsx
  FullStackLayers3D.tsx
  shared/
    TankModel.tsx
    ProverTower.tsx
    BlobGrid.tsx
    PlatformStage.tsx
    ValidatorFigure.tsx
  fallbacks/
    RoadmapStaircaseSVG.tsx
    ParallelVerificationSVG.tsx
    EPBSSlotClockSVG.tsx
    GasEvolutionSVG.tsx
    BlobSamplingSVG.tsx
    ZKEVMPopulationSVG.tsx
    EOFContainerizationSVG.tsx
    FullStackLayersSVG.tsx
```

---

## Build Sequence

1. **Shared components first** — TankModel, ProverTower, BlobGrid, PlatformStage, ValidatorFigure. Each is independently testable with a Storybook-style harness.
2. **Scene 7 (EOFContainerization)** — simplest scene (2/5), establishes the before/after pattern.
3. **Scene 2 (ParallelVerification)** — before/after with timing animation, 3/5.
4. **Scene 3 (EPBSSlotClock)** — ShapeGeometry arcs, sweep hand. Standalone 3/5.
5. **Scene 1 (Roadmap)** — uses PlatformStage. Overview scene, benefits from having built the pieces.
6. **Scene 6 (ZKEVMPopulation)** — uses PlatformStage + ValidatorFigure.
7. **Scene 5 (BlobSampling)** — uses BlobGrid + ValidatorFigure.
8. **Scene 4 (GasEvolution)** — uses TankModel + PlatformStage. Most complex animation (4/5).
9. **Scene 8 (FullStackLayers)** — build LAST. Reuses miniature versions of all other scenes' hero objects.
10. **SVG fallbacks** — build after all 3D scenes are verified working. One per scene.

Estimated build time per scene: 3-5 hours for a developer familiar with R3F/drei.
Total: 35-50 hours (including SVG fallbacks). Parallelizable with 2 developers after shared components are done.
