# Wabi Onboarding — Remotion Replication Brief

A replication of the Wabi iOS app onboarding loop. Thirteen seconds. One breath in, one breath out. A bubble rises, becomes a lens, multiplies into a swarm of worlds, retreats. The source uses Apple's **Liquid Glass** material natively. Remotion runs in a browser. The material does not. We approximate, or we cheat elegantly.

## Source

Reference frames live at `/Users/maxguillabert/.claude/image-cache/5f7e2433-45c5-4e78-97b0-cf554e8ad683/` (frames 5–20). Extracted from a screen recording of the Wabi onboarding flow, circa 2026.

---

## The Sequence — Act by Act

### Act I — Arrival (0.0s → 0.9s)

**State at t=0:**
- Canvas: `#F2F2F2` (off-white, warm-neutral)
- Heading "A new era of software is here." centered, slightly above vertical midpoint. Bold grotesk, ~28pt, graphite `#1A1A1A`, tight leading.
- Footer microcopy "Swipe up to enter" at bottom, muted gray `#8E8E93`.
- iOS status bar at top ("9:41", signal, wifi, battery).

**Transition:**
- A glass sphere emerges from beyond the bottom bezel, rising upward.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (expo-out) with ~4px overshoot then settle.
- Scale: 0.92 → 1.0.
- Duration: ~900ms.
- The sphere carries a soft blue toroidal ring inside its core. The material refracts the canvas through its lower hemisphere.

### Act II — The Ascent (0.9s → 2.3s)

- The orb leaves its resting anchor and climbs toward screen-center.
- **Heading fades out linearly, tied to the orb's vertical position** — not time. As the orb crosses the text baseline, opacity drops proportionally.
- Orb scales 1.0 → 1.8× during the climb.
- Refraction intensifies as it grows. The blue internal ring thickens. Edge lensing becomes visible along the equator.
- Motion: vertical translate with faint horizontal sway (±6px, sinusoidal). The sphere *floats* — it does not travel in a straight line.
- Duration: ~1400ms.

### Act III — The Lens Moment (2.3s → 2.9s)

The core identity effect. Execute it perfectly or the whole piece collapses.

- "Meet Wabi." renders *behind* the orb on a text layer.
- The orb applies radial displacement to the content beneath it. Fisheye-style.
- **Chromatic dispersion**: red channel displaced outward, blue inward. Max separation 8–12px at the equator, zero at center.
- Peak magnification ~2.0× inside the sphere — glyphs warp into unreadable color-separated streaks (frame 9 shows this clearly).
- Edge caustics: thin orange/amber iridescent arcs at top-right and bottom-left.
- Duration: ~600ms.

### Act IV — The Settle (2.9s → 4.1s)

- The orb **drains** — loses its glassiness, chromatic rim, blue core.
- Resolves to a matte white neumorphic puck, ~0.35× of peak scale.
- A thin warm rainbow arc remains inside the puck — memory of the glass state.
- Text re-materializes below the puck, now outside it:
  1. "Meet Wabi." (bold, ~320ms fade-in, 6px rise)
  2. "The first personal software platform." (~240ms later, same treatment)
- Auth CTAs slide up from bottom bezel with 80ms stagger:
  1. "Continue with Google" — white pill, neumorphic shadow, Google G mark
  2. "Continue with Apple" — graphite pill, Apple logo
- Easing on CTAs: spring with slight overshoot.
- Total: ~1200ms.

### Act V — The Generation (4.1s → 6.5s)

The puck becomes a spawn point. Not a bubble emitter — a *birthplace*.

- Bubbles begin spawning above the central puck and **rise upward** (against gravity, on an invisible current).
- Spawn rate: 1–3 bubbles per 400ms, irregular.
- Each bubble is a translucent Liquid-Glass sphere containing a unique 3D-rendered object or texture:
  - Chess knight, landscape tile, human eye, basketball, planetary surface, face, marble, mushroom cluster, figures, terrain.
  - Size variance: 14px → 60px diameter.
  - Larger bubbles sit on a slight z-offset with subtle motion blur.
- **Inside the central puck**, a tiny 3D avatar materializes (frame 8: peach-toned figure with a blue iris). It cycles through different identities as the scene progresses (frame 10 shows a different figure).
- Bubble motion: vertical rise ~80px/sec, Perlin-noise horizontal sway (±15px), occasional soft collisions that nudge neighbors.

### Act VI — The Swarm (6.5s → 9.0s)

- Bubble density compounds. By the end of this act, the top 40% of the canvas is a dense cloud of refracted identities.
- Composition reads as an inverted fountain — puck at bottom-center emits, swarm accumulates above.
- The central puck begins to re-glassify. Chromatic distortion reappears at its perimeter. It is preparing to become a lens again.

### Act VII — The Refraction Loop (9.0s → 10.5s)

- Central sphere is fully Liquid Glass again. It has grown slightly.
- Text behind it — "Meet Wabi. / The first personal software platform." — warps through the lens. RGB ghosting returns (frames 17–18).
- Swarm above reaches maximum density. Bubbles overlap, refract each other. Small bubbles visible *through* large ones.
- This is the visual climax.

### Act VIII — The Return (10.5s → 13.0s)

- The central sphere retreats below the bottom bezel, shrinking as it descends.
- Auth CTAs dissolve (reverse of their entrance).
- Subtitle dissolves.
- Heading "A new era of software is here." re-materializes (opacity tied to orb's exit position, mirror of Act II).
- **The bubble swarm does not vanish immediately**. Individual bubbles fade at staggered random intervals (~1500ms each). The top of the canvas stays populated for several seconds after the orb leaves.
- A faint new orb begins to emerge from below — the loop closing.
- Frame 20 ≈ Frame 5, with bubble residue at the top. The system remembers.

---

## Timing Spine

| Act | Start | End | Duration | Beat |
|-----|-------|-----|----------|------|
| I — Arrival | 0.0s | 0.9s | 0.9s | Orb enters |
| II — Ascent | 0.9s | 2.3s | 1.4s | Text fades, orb climbs |
| III — Lens | 2.3s | 2.9s | 0.6s | Text refracts through orb |
| IV — Settle | 2.9s | 4.1s | 1.2s | Orb quiets, CTAs appear |
| V — Generation | 4.1s | 6.5s | 2.4s | Bubbles rise |
| VI — Swarm | 6.5s | 9.0s | 2.5s | Density builds |
| VII — Refraction | 9.0s | 10.5s | 1.5s | Second lens moment |
| VIII — Return | 10.5s | 13.0s | 2.5s | Orb exits, loop closes |

**Total loop:** 13.0s. Seamless.

At 60fps: **780 frames**. At 30fps: 390 frames.

---

## Typography

- **Heading / "Meet Wabi." / subtitle:** Geometric or humanist sans, weight 600–700. Candidates: SF Pro Display Bold, Inter Bold, General Sans Semibold. Tight letter-spacing (-0.02em). Generous leading (1.15).
- **Microcopy ("Swipe up to enter"):** Same family, weight 400, size ~14pt, color `#8E8E93`.
- **Body size:** ~28pt heading, ~20pt subtitle, ~14pt microcopy. Scaled to viewport.

## Color

- Canvas: `#F2F2F2`
- Text: `#1A1A1A`
- Microcopy: `#8E8E93`
- Sphere core glow: `#4A9BFF` (blue toroidal ring)
- Specular highlights: warm white
- Chromatic aberration: full-spectrum RGB split
- Apple button: `#000000` background, white text
- Google button: `#FFFFFF` background, graphite text

---

## Liquid Glass on the Web — Technical Reality

Apple's Liquid Glass is a native material. The web has no equivalent. Since WWDC 2025, the community has produced three families of approximation. Ranked by what matters for us — a Remotion render, not a live product.

### Prior art we already own (in this repo)

This project ships **all the primitives needed**. We do not start from zero.

- **`MeshTransmissionMaterial`** from `@react-three/drei` — the single best Liquid Glass approximation on the web. Supports `transmission`, `ior`, `chromaticAberration`, `thickness`, `distortion`, `distortionScale`, `temporalDistortion`, `anisotropy`, `backside`, `samples`. Used in:
  - `video/src/compositions/gm/logo-3d/SceneFrostedGlass.tsx` — glass text with `Environment` + `Lightformer` for specular sheen. Our reference implementation.
  - `video/src/scenes/ThemeAnimations/Theme3DGlassThreeJS.tsx` — glass spheres + background objects refracted through them. Closest existing thing to what Wabi does with its orb.
- **`ThreeCanvas`** from `@remotion/three` — integration layer. Wraps R3F for deterministic frame rendering.
- **`Environment` + `Lightformer`** from drei — drives the specular highlights and edge lensing for free. This is the feature that sells the effect.
- **`EffectComposer` + `Bloom` + `ToneMapping`** from `@react-three/postprocessing` — final glow pass. AGX tone mapping in `SceneFrostedGlass` is exceptional.
- **SVG `feTurbulence` + `feDisplacementMap`** — used in `video/src/scenes/RollerAnimations/RollerLiquid.tsx` for fluid text morphing. Useful for the subtle "breathing" warp on the puck during Act IV.

### External references worth reading before we build

**WebGL / R3F (primary approach):**
- [Anderson Mancini — Liquid Glass via Three.js and R3F](https://appleliquidglass.vercel.app/) — the reference. Recreates the full Apple effect with `MeshTransmissionMaterial`.
- [Olivier Larose — 3D Glass Effect tutorial](https://blog.olivierlarose.com/tutorials/3d-glass-effect) — R3F + Next.js, walks through `MeshTransmissionMaterial` properties.
- [Maxime Heckel — Refraction, dispersion, and other shader light effects](https://blog.maximeheckel.com/posts/refraction-dispersion-and-other-shader-light-effects/) — deep dive on the physics, including Snell's Law and per-channel IOR.
- [Codrops — Warping 3D Text Inside a Glass Torus](https://tympanus.net/codrops/2025/03/13/warping-3d-text-inside-a-glass-torus/) — exact technique for Act III (the lens moment).
- [Three.js forum — MeshTransmissionMaterial showcase](https://discourse.threejs.org/t/meshtransmissionmaterial-more-realistic-glas-epoxy-gelatin/46522) — parameter tuning reference.
- [clayharmon/webgl-liquid-glass](https://github.com/clayharmon/webgl-liquid-glass) — WebGL navbar with SDF edges, directional specular, chromatic aberration at rim, motion shimmer. Good for the puck's rainbow arc.

**Pure CSS + SVG (secondary, lower fidelity):**
- [nikdelvin/liquid-glass](https://github.com/nikdelvin/liquid-glass) — "pixel-perfect" recreation with CSS + SVG filters. Chromium-only (SVG-as-backdrop-filter).
- [kube.io — Liquid Glass in the Browser: Refraction with CSS and SVG](https://kube.io/blog/liquid-glass-css-svg/) — physics-based refraction via `feDisplacementMap`.
- [LogRocket — How to create Liquid Glass effects with CSS and SVG](https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/)

**WebGL-over-DOM overlays (not applicable to us — these refract live DOM, which Remotion doesn't need):**
- [LiquidGlass by ybouane](https://liquid-glass.ybouane.com/)
- [naughtyduk/liquidGL](https://github.com/naughtyduk/liquidGL)
- [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react)

### Decision: WebGL via `MeshTransmissionMaterial`

Remotion renders in headless Chromium at a fixed framerate. Browser compatibility is moot — we pick fidelity. Our codebase already uses this primitive twice successfully. No new dependency. No new shader to write. The material does the work.

**Approach per act:**

| Act | Technique | Why |
|-----|-----------|-----|
| I — Arrival | R3F `sphereGeometry` + `MeshTransmissionMaterial` with moderate IOR (~1.4) | Simple glass sphere, no content behind it yet |
| II — Ascent | Same orb, IOR ramps 1.4 → 1.8, `chromaticAberration` ramps 0.02 → 0.08 | Sell the material intensifying as it grows |
| III — Lens | R3F `<Text>` plane behind the orb. IOR peaks at 1.9, `distortion` 0.3, `distortionScale` 0.5 | Transmission material refracts the text for free. Matches frames 8–9 |
| IV — Settle | Switch material to `MeshPhysicalMaterial` with high roughness + subtle `transmission: 0.3` | Becomes the matte neumorphic puck. Keep a faint rainbow arc as a thin emissive torus inside |
| V — Generation | Instanced spheres, each with `MeshTransmissionMaterial` and a unique background plane per bubble | One draw call, N bubbles. Each carries its "world" texture |
| VI — Swarm | Same as V, denser, with depth-of-field via R3F's `Depth` + bloom pass | Read as a cloud, not a grid |
| VII — Refraction | Central puck re-glassifies. Interpolate IOR/transmission back up | Mirror of Act III |
| VIII — Return | Orb shrinks, exits frame. Bubbles fade at random intervals via per-instance opacity | Stagger via hash function on bubble ID |

Fidelity target: ~85–90% of native Liquid Glass. The remaining 10% is Apple's environment-adaptive sampling (Liquid Glass pulls color from its surroundings in real time based on lighting direction). We fake this with a pre-baked `Environment` preset and minor time-varying rotation — good enough for a 13-second loop.

### Do NOT build

- A custom fragment shader. `MeshTransmissionMaterial` is better than anything we'd write in a week.
- The SVG/CSS approach for the hero moments. Reserve it for the Act VIII fade-tails if useful.
- A DOM-refraction overlay library (liquidGL, liquid-glass-react). Those exist for live sites, not for Remotion renders.

---

## Component Architecture

```
src/compositions/replicates/wabi/
├── BRIEF.md                     ← this file
├── WabiComposition.tsx          ← root Remotion composition
├── scenes/
│   ├── ActI_Arrival.tsx
│   ├── ActII_Ascent.tsx
│   ├── ActIII_Lens.tsx
│   ├── ActIV_Settle.tsx
│   ├── ActV_Generation.tsx
│   ├── ActVI_Swarm.tsx
│   ├── ActVII_Refraction.tsx
│   └── ActVIII_Return.tsx
├── elements/
│   ├── LiquidGlassOrb.tsx       ← WebGL sphere, the protagonist
│   ├── NeumorphicPuck.tsx       ← the settled state
│   ├── BubbleSwarm.tsx          ← particle system with WebGL instancing
│   ├── ChromaticText.tsx        ← text that refracts through a lens
│   ├── AuthButton.tsx           ← Google/Apple CTAs
│   └── StatusBar.tsx            ← iOS status bar (9:41, signal, wifi, battery)
├── shaders/
│   ├── liquidGlass.frag         ← the orb shader
│   ├── liquidGlass.vert
│   └── refraction.glsl          ← shared refraction function
└── assets/
    ├── worlds/                  ← 3D-rendered textures for bubble interiors
    │   ├── chess-knight.png
    │   ├── eye.png
    │   ├── basketball.png
    │   ├── landscape.png
    │   ├── figure-01.png
    │   ├── ...
    └── icons/
        ├── google-g.svg
        └── apple-logo.svg
```

---

## Assets To Source Or Create

1. **~20 "world" textures** for bubble interiors. Render at 512×512, PNG with alpha. Style: semi-realistic 3D, warm lighting, color-rich. Subjects: chess pieces, faces/figures, nature (mushrooms, landscapes, terrain), objects (basketball, marbles), abstract (planets, swirls).
2. **Central puck avatar textures** — 3–5 variants of small 3D figures/scenes for the puck's interior viewport during Act V.
3. **Apple logo** (SF Symbols `apple.logo` or custom SVG).
4. **Google G** (official brand mark, SVG).
5. **Font files**: SF Pro Display, Inter, or General Sans. Include Bold (700) and Regular (400).

---

## Composition Setup

```tsx
// In Root.tsx:
<Composition
  id="WabiOnboarding"
  component={WabiComposition}
  durationInFrames={390}        // 13s at 30fps
  fps={30}
  width={375}                    // iPhone 13/14/15 logical width
  height={812}                   // iPhone 13/14/15 logical height
/>
```

For higher fidelity: 60fps / 780 frames. For preview: 30fps.

---

## Open Questions Before Building

1. **Are we matching the source exactly**, or reinterpreting with Wabi-style aesthetics for a different product (e.g., Index / General Market)?
2. **How literal with the "Meet Wabi." text** — keep the name, or swap for something else?
3. **Will the assets for the bubble "worlds" be hand-rendered**, or do we use stock 3D renders / procedural textures?
4. **Do we want the loop seamless** (for embedding as a silent bg) or **one-shot** (for a launch reel with audio)?
5. **Target output**: in-app video, landing page hero, social reel, or all three? Dimensions and framerate depend on this.

---

## The Test

The piece works if, on second loop, the viewer pauses. If they watch a third time, the sequence has done its job. If they don't — we built something competent but not alive. A bubble rises. It carries a world. The world fills with more worlds. The world retreats. Software as weather.
