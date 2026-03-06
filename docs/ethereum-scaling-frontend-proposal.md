# Ethereum Scaling Article -- Complete Frontend Rewrite Proposal

Session: 2026-03-01 (revised with architecture review fixes)

---

## 0. Executive Summary

Replace the EIP-8141 account abstraction article with a new **Ethereum Scaling Roadmap** article. The new article pairs 8 full-bleed Three.js dioramas with substantive prose sections. Every section has both a 3D scene AND enough descriptive text to rank on its own.

The entire EIP-8141 component tree gets deleted. A new `scaling/` directory houses 8 scene components, 5 shared primitives, 1 critical infrastructure wrapper (`SceneContainer`), and a new barrel export. The MDX registry swaps out all old components and registers the new ones.

**Critical infrastructure addition:** A `SceneContainer` wrapper component handles IntersectionObserver-based lazy mount/unmount, ErrorBoundary wrapping, WebGL detection, accessibility attributes, reduced-motion support, and scroll-hijack prevention. This is P0 — every scene uses it.

---

## 1. New MDX Article Structure

### File: `frontend/content/learn/ethereum-scaling.mdx`

New slug: `ethereum-scaling`. The old file `eip-8141-account-abstraction.mdx` gets deleted entirely.

```mdx
---
title: "How Ethereum Scales: The Complete Roadmap"
description: "Ethereum is engineering a 100x throughput increase over the next three years without breaking solo staking. Parallel verification, ePBS, multidimensional gas, PeerDAS blobs, and ZK-EVM — visualized in 3D."
keywords: ["Ethereum scaling", "Ethereum roadmap", "gas limits", "ePBS", "PeerDAS", "blobs", "ZK-EVM", "parallel verification", "multidimensional gas", "Ethereum throughput", "Glamsterdam", "access lists", "data availability sampling", "EOF", "EVM Object Format"]
date: "2026-03-01"
author: "General Market"
slug: "ethereum-scaling"
category: "Education"
readingTime: "15 min read"
tldr:
  - "Five independent upgrades converge to <strong>100x Ethereum's throughput</strong> over 3 years"
  - "Parallel verification and ePBS unlock <strong>10-30x higher gas limits</strong> per block"
  - "Multidimensional gas <strong>decouples compute from state growth</strong> — each resource priced independently"
  - "PeerDAS lets validators <strong>sample blobs instead of downloading them</strong> — 8 MB/sec data"
  - "ZK-EVM replaces re-execution with <strong>proof verification</strong> — solo stakers survive the throughput increase"
---

Ethereum does ~15 transactions per second today. The roadmap targets ~1,500. Here is every piece of the plan, and how they connect.

<ScalingStats />

## The Roadmap

Five scaling initiatives, three years, one goal: 100x throughput without killing solo staking. The upgrades split into three layers — execution speed, data availability, and proof verification. Each layer builds on the one below, and they converge into a single validated block at the end.

<RoadmapStaircase3D />

The rest of this article walks through each initiative in the order they compound. We start with the execution bottleneck (why blocks are slow), move through the structural fixes, then show how all three layers come together.

## Parallel Block Verification

Today, every transaction verifies sequentially — each one might depend on the last. A block with 1,000 transactions takes 1,000 serial steps even if most of those transactions touch completely different state. Access lists (EIP-7928) change this by declaring upfront which storage slots each transaction reads or writes. The EVM can then sort transactions into non-conflicting groups and verify them in parallel across CPU cores.

<ParallelVerification3D />

Parallel verification alone gets Ethereum from ~30M gas per block to potentially 300M gas per block — a ~10x improvement — but only if the rest of the slot budget accommodates it.

## ePBS: Using the Whole Slot

Validators currently cram block verification into roughly 300 milliseconds of their 12-second slot — about 2.5% of the available time. The remaining 97.5% is wasted on gossip propagation and attestation. ePBS (enshrined Proposer-Builder Separation) restructures the slot so that block building and block proposing are separate protocol roles. The proposer commits to a block header early, and the builder has most of the slot to construct and propagate the full block. This gives verification an order of magnitude more time.

<EPBSSlotClock3D />

Combined with parallel verification, ePBS means the gas limit can rise dramatically without increasing the hardware burden on solo validators. But raising the gas limit exposes a new problem: one resource pool pricing all costs.

## Gas Evolution: One Pool to Many

One gas pool means one bottleneck. Computation, state reads, state writes, and calldata all compete for the same budget. A sudden spike in calldata price spills over into computation price, even though they use different hardware resources. Ethereum's gas pricing is evolving in three stages: a single unified pool today, two pools (compute + state creation) with an overflow reservoir at Glamsterdam, and eventually N independent pools with floating market prices per resource.

<GasEvolution3D />

Multidimensional gas decouples resources so each can scale independently. State creation gets its own budget and cap. Computation gets its own budget. Calldata gets its own. The overflow reservoir at Glamsterdam provides backward compatibility while the ecosystem migrates tooling to the new pricing model.

## Blobs and PeerDAS

Rollups need data. Today, rollups post their state diffs as calldata, which is expensive and competes with execution gas. Blobs (EIP-4844) created a separate data lane. PeerDAS (Peer Data Availability Sampling) is the next step: instead of every validator downloading every blob, each validator downloads a random sample. Reed-Solomon erasure coding guarantees that if enough validators each grab a few fragments, the full dataset is reconstructable. This lets blob throughput scale to 8 MB/sec without proportionally increasing per-node bandwidth.

<BlobSampling3D />

PeerDAS is a constellation model — one producer broadcasts, many validators sample, collectively the network covers all the data. No single node downloads everything.

## ZK-EVM: Staged Rollout

Every upgrade so far increases what goes INTO a block. But validators still have to verify everything that comes out. Today, that means re-executing every transaction. ZK-EVM replaces re-execution with proof verification: a block comes with a cryptographic proof that the state transition is correct. Validators check the proof instead of replaying the computation — orders of magnitude faster.

<ZKEVMPopulation3D />

The rollout is deliberately cautious. Phase 1: one ZK node among twenty traditional validators (sanity check, no authority). Phase 2: a growing minority of ZK validators, still non-binding. Phase 3: 3-of-5 independent prover implementations must agree. Phase 4: formal verification of the ZK circuits themselves. This staged approach prevents a single prover bug from compromising the network.

## EOF: Structured Contracts

Today, smart contract bytecode is a flat blob — code and data are interleaved, jump targets are implicit, and static analysis is nearly impossible. EOF (EVM Object Format, EIP-7692) restructures bytecode into explicit sections: a header declaring the layout, typed code sections, and a separate data section. This enables the compiler and the EVM to perform static analysis, validate control flow at deploy time, and apply optimization passes. EOF is an enabler — it makes parallel verification safer (the EVM can prove non-interference statically) and ZK-EVM cheaper (structured bytecode produces smaller circuits).

<EOFContainerization3D />

## Full Stack Convergence

Every initiative feeds into every other. Parallel verification enables higher gas limits. Higher gas limits need multidimensional pricing. More execution capacity needs more data availability (PeerDAS). More throughput needs cheaper verification (ZK-EVM). Structured bytecode (EOF) makes all of the above safer and cheaper. The three layers — execution, data, proofs — converge into a single validated block that processes 100x more transactions while remaining verifiable on consumer hardware.

<FullStackLayers3D />

<ScalingSummary />

## Sources

- [Vitalik Buterin: "So, what exactly has changed in the Ethereum roadmap?"](https://vitalik.eth.limo/general/2024/10/23/futures5.html)
- [Ethereum Magicians: Glamsterdam Meta Thread](https://ethereum-magicians.org/t/glamsterdam-hardfork-meta-thread/)
- [EIP-7928: Block-Level Access Lists](https://eips.ethereum.org/EIPS/eip-7928)
- [Paradigm: Reth Execution Extensions](https://www.paradigm.xyz/2024/05/reth)
- [Ethereum Research: Multidimensional Gas](https://ethresear.ch/t/multidimensional-gas-pricing/20750)
- [EIP-4844: Blobs (Proto-Danksharding)](https://eips.ethereum.org/EIPS/eip-4844)
- [EIP-7692: EOF Meta](https://eips.ethereum.org/EIPS/eip-7692)

## Further Reading

- [What Are ITPs?](/learn/what-are-itps) — How on-chain index products work on General Market.
- [AI Prediction Markets](/learn/ai-prediction-markets) — How AI agents trade prediction markets.
```

### Story Arc

| Section | Role | Emotional Beat |
|---------|------|----------------|
| Stats + Roadmap Staircase | Hook | "Whoa, 100x? Show me the plan." |
| Parallel Verification | Problem | "Oh, blocks are slow because of THIS." |
| ePBS Slot Clock | Problem deepened | "And we're wasting 97.5% of the slot." |
| Gas Evolution | Solution layer 1 | "Split the bottleneck, evolve the pricing." |
| Blobs + PeerDAS | Solution layer 2 | "Data scales too." |
| ZK-EVM Population | Solution layer 3 | "Proofs replace computation." |
| EOF Containerization | Enabler | "Structured code makes everything else possible." |
| Full Stack Layers | Climax | "All three layers working together." |
| Summary | Resolution | "Solo stakers survive. 100x achieved." |

### Prose Budget

Each section gets 3-5 sentences of substantive descriptive text, enough for Google to index meaningful content. The 3D scene reinforces the text visually. Text explains; geometry makes it intuitive.

The article contains ~800 words of substantive indexable prose, plus frontmatter, TLDR, sources, and further reading. Each section can stand alone as a meaningful paragraph if the 3D scene fails to load.

---

## 2. Component Architecture

### New File Tree

```
frontend/components/learn/diagrams/scaling/
  index.tsx                          # Barrel export for all scaling components
  SceneContainer.tsx                 # P0: IntersectionObserver + ErrorBoundary + a11y + WebGL check
  RoadmapStaircase3D.tsx             # Scene 1: Ascending platforms with dependency arrows
  ParallelVerification3D.tsx         # Scene 2: Sequential vs parallel conveyor
  EPBSSlotClock3D.tsx                # Scene 3: Dual clock faces (stripped to core)
  GasEvolution3D.tsx                 # Scene 4: Three-stage gas pricing evolution (merged)
  BlobSampling3D.tsx                 # Scene 5: Constellation sampling (reduced props)
  ZKEVMPopulation3D.tsx              # Scene 6: Population shift, grey to purple
  EOFContainerization3D.tsx          # Scene 7: Messy blob vs structured container
  FullStackLayers3D.tsx              # Scene 8: Three-story factory (simplified)
  ScalingCards.tsx                    # ScalingStats + ScalingSummary (CSS cards)
  shared/
    TankModel.tsx                    # Reusable hollow tank with animated fill + downward drain particles
    ProverTower.tsx                  # RoundedBox tower with checkmark/X overlay + emissive pulse
    BlobGrid.tsx                     # InstancedMesh grid of cubes with per-instance highlighting
    PlatformStage.tsx                # Elevated platform with optional stair riser
    ValidatorFigure.tsx              # InstancedMesh-friendly sphere+cylinder merged geometry
```

### SceneContainer.tsx — The Critical Wrapper (P0)

Every 3D scene uses this wrapper. It is the single most important piece of infrastructure in this proposal. It handles:

1. **IntersectionObserver lazy mount** — Canvas only mounts when within 200px of viewport
2. **IntersectionObserver lazy unmount** — Canvas unmounts when scrolled 600px past
3. **ErrorBoundary** — wraps the Canvas to catch WebGL crashes gracefully
4. **WebGL detection** — checks for WebGLRenderingContext before mounting Canvas
5. **Accessibility** — provides role="img", aria-label, and sr-only description
6. **Reduced motion** — reads usePrefersReducedMotion and passes it to children
7. **Scroll-hijack prevention** — sets `touch-action: pan-y` on the container
8. **Context loss recovery** — listens for webglcontextlost and shows recovery UI

```tsx
'use client'

import { useRef, useState, useEffect, useCallback, ReactNode } from 'react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { usePrefersReducedMotion } from '@/hooks/useMediaQueries'

interface SceneContainerProps {
  children: (props: { reducedMotion: boolean }) => ReactNode
  height: string                    // e.g. "h-[340px] md:h-[480px]"
  ariaLabel: string                 // e.g. "3D visualization of parallel block verification"
  srDescription: string             // Full text description for screen readers
  legend: ReactNode                 // Legend strip content
  fallbackText: string              // Text to show if WebGL unavailable
  rootMarginMount?: string          // IntersectionObserver margin for mount (default "200px")
  rootMarginUnmount?: string        // IntersectionObserver margin for unmount (default "600px")
}

export function SceneContainer({
  children,
  height,
  ariaLabel,
  srDescription,
  legend,
  fallbackText,
  rootMarginMount = '200px',
  rootMarginUnmount = '600px',
}: SceneContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldMount, setShouldMount] = useState(false)
  const [webglSupported, setWebglSupported] = useState(true)
  const [contextLost, setContextLost] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  // WebGL detection
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      if (!gl) setWebglSupported(false)
    } catch {
      setWebglSupported(false)
    }
  }, [])

  // IntersectionObserver: mount when near, unmount when far
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const mountObserver = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setShouldMount(true) },
      { rootMargin: rootMarginMount }
    )

    const unmountObserver = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) setShouldMount(false) },
      { rootMargin: rootMarginUnmount }
    )

    mountObserver.observe(el)
    unmountObserver.observe(el)

    return () => {
      mountObserver.disconnect()
      unmountObserver.disconnect()
    }
  }, [rootMarginMount, rootMarginUnmount])

  // Context loss handler
  const handleContextLost = useCallback(() => setContextLost(true), [])
  const handleContextRestored = useCallback(() => setContextLost(false), [])

  return (
    <div className="my-12 -mx-4 md:-mx-8" ref={containerRef}>
      <div className="bg-white border-t-[3px] border-b border-black border-b-border-light">
        {/* Accessible description (hidden visually, read by screen readers) */}
        <div className="sr-only">{srDescription}</div>

        {/* Canvas area */}
        <div
          className={`${height} cursor-grab active:cursor-grabbing`}
          role="img"
          aria-label={ariaLabel}
          style={{ touchAction: 'pan-y' }}
        >
          {!webglSupported || contextLost ? (
            <div className="h-full flex items-center justify-center bg-zinc-50 px-8">
              <p className="text-[14px] text-text-secondary text-center max-w-md">
                {contextLost ? 'WebGL context lost. Scroll away and back to retry.' : fallbackText}
              </p>
            </div>
          ) : shouldMount ? (
            <ErrorBoundary fallback={
              <div className="h-full flex items-center justify-center bg-zinc-50">
                <p className="text-[14px] text-text-muted">3D scene failed to load.</p>
              </div>
            }>
              {children({ reducedMotion })}
            </ErrorBoundary>
          ) : (
            <div className="h-full animate-pulse bg-zinc-50" />
          )}
        </div>

        {/* Legend strip */}
        <div className="px-6 pb-3 pt-1 flex items-center justify-between border-t border-zinc-200">
          {legend}
          <span className="text-[10px] text-text-muted font-mono">drag to orbit</span>
        </div>
      </div>
    </div>
  )
}
```

### Barrel Export: `scaling/index.tsx`

```tsx
'use client'

import dynamic from 'next/dynamic'

const Placeholder = ({ h }: { h: string }) => (
  <div className="my-12 -mx-4 md:-mx-8">
    <div className="bg-[#f5f5f5] border-t-[3px] border-black animate-pulse" style={{ height: h }} />
  </div>
)

export const RoadmapStaircase3D = dynamic(
  () => import('./RoadmapStaircase3D').then(m => m.RoadmapStaircase3D),
  { ssr: false, loading: () => <Placeholder h="480px" /> }
)

export const ParallelVerification3D = dynamic(
  () => import('./ParallelVerification3D').then(m => m.ParallelVerification3D),
  { ssr: false, loading: () => <Placeholder h="460px" /> }
)

export const EPBSSlotClock3D = dynamic(
  () => import('./EPBSSlotClock3D').then(m => m.EPBSSlotClock3D),
  { ssr: false, loading: () => <Placeholder h="460px" /> }
)

export const GasEvolution3D = dynamic(
  () => import('./GasEvolution3D').then(m => m.GasEvolution3D),
  { ssr: false, loading: () => <Placeholder h="460px" /> }
)

export const BlobSampling3D = dynamic(
  () => import('./BlobSampling3D').then(m => m.BlobSampling3D),
  { ssr: false, loading: () => <Placeholder h="520px" /> }
)

export const ZKEVMPopulation3D = dynamic(
  () => import('./ZKEVMPopulation3D').then(m => m.ZKEVMPopulation3D),
  { ssr: false, loading: () => <Placeholder h="480px" /> }
)

export const EOFContainerization3D = dynamic(
  () => import('./EOFContainerization3D').then(m => m.EOFContainerization3D),
  { ssr: false, loading: () => <Placeholder h="460px" /> }
)

export const FullStackLayers3D = dynamic(
  () => import('./FullStackLayers3D').then(m => m.FullStackLayers3D),
  { ssr: false, loading: () => <Placeholder h="540px" /> }
)

// CSS-only components — dynamic import to avoid polluting the barrel chunk
export const ScalingStats = dynamic(
  () => import('./ScalingCards').then(m => m.ScalingStats),
  { ssr: true }
)

export const ScalingSummary = dynamic(
  () => import('./ScalingCards').then(m => m.ScalingSummary),
  { ssr: true }
)
```

Note: ScalingStats and ScalingSummary are now dynamically imported too, preventing them from being eagerly bundled into the barrel chunk that every article page imports.

### Shared Primitives -- Props Interfaces

**TankModel.tsx**
```tsx
interface TankModelProps {
  position: [number, number, number]
  width: number
  height: number
  depth: number
  color: string                     // tank wall color, e.g. '#3b82f6'
  fillColor: string                 // fill interior color, e.g. '#3b82f6' at 50% opacity
  fillPercent: number               // 0.0 to 1.0, animated target
  fillOscillation?: number          // amplitude of sin oscillation on fill level (0 = static)
  capBar?: boolean                  // red bar across the top (for "capped" tanks)
  showDrain?: boolean               // show downward-flowing drain particles (gas units consumed)
  drainCount?: number               // number of drain particles (default 8)
  growthChevrons?: boolean          // upward pulse arrows (for "can scale" tanks)
  label?: string                    // Html label above the tank
  labelSub?: string                 // Html sub-label
  scale?: number                    // uniform scale (default 1)
  reducedMotion?: boolean           // suppress drain particles when true
}
```

**ProverTower.tsx**
```tsx
interface ProverTowerProps {
  position: [number, number, number]
  color: string                   // #8b5cf6 for active, #d4d4d8 for dim
  agrees: boolean                 // true = green checkmark + emissive pulse, false = grey X
  label?: string                  // e.g. "Prover A"
  height?: number                 // default 0.7
  reducedMotion?: boolean         // suppress pulse when true
}
```

**BlobGrid.tsx**
```tsx
interface BlobGridProps {
  position: [number, number, number]
  cellCount?: number              // total cells, must be a perfect square (default 16 = 4x4)
  cellSize?: number               // world units per cell cube (default 0.06)
  baseColor: string               // dim color for unsampled cells
  highlightColor: string          // glow color for sampled cells
  highlightedIndices: number[]    // which cells are currently "sampled"
  onCellHighlight?: (index: number) => void
  label?: string
}
```

**PlatformStage.tsx**
```tsx
interface PlatformStageProps {
  position: [number, number, number]
  width: number
  depth: number
  color: string                   // platform surface color
  label: string                   // platform label text
  labelColor: string              // label text color
  height?: number                 // platform thickness (default 0.08)
  stairFrom?: [number, number, number]  // if set, render stair riser from this position
  stairRiserHeight?: number       // how tall the connecting riser is
  labelSub?: string
}
```

**ValidatorFigure.tsx**
```tsx
interface ValidatorFigureProps {
  // Used as an instancedMesh-friendly merged geometry (sphere head + cylinder body + disk base)
  // Intended to be instantiated via instancedMesh, not as a standalone component
  scale?: number                  // uniform scale (default 0.22)
  color?: string                  // figure color (default '#d4d4d8' for trad, '#8b5cf6' for ZK)
}

// Returns a single BufferGeometry suitable for instancedMesh
function createMergedGeometry(): THREE.BufferGeometry
```

### MDX Registry Integration

**Updated `frontend/components/mdx/index.tsx`:**

Remove ALL old EIP-8141 imports:
```
- FrameTransactionScene, PaymasterFlow, MempoolLayers, EIPTimeline, EIPTimeline3D
- PrivacyDiagram, BeforeAfterScene, FrameFlow, FlowNormalTx, FlowAtomicOps
- FlowNewAccount, FlowPrivacyZK, StatsOverview, StatsUnlocked, EOABenefits
- CapabilityCards, FOCILComparison, QuantumComparison, HegotaSummary
```

Add new scaling imports:
```tsx
import {
  RoadmapStaircase3D,
  ParallelVerification3D,
  EPBSSlotClock3D,
  GasEvolution3D,
  BlobSampling3D,
  ZKEVMPopulation3D,
  EOFContainerization3D,
  FullStackLayers3D,
  ScalingStats,
  ScalingSummary,
} from '@/components/learn/diagrams/scaling'
```

Register each in the `mdxComponents` object:
```tsx
export const mdxComponents: MDXComponents = {
  // ... keep all generic components (h1, h2, p, a, Callout, etc.)

  // Scaling article scenes
  RoadmapStaircase3D,
  ParallelVerification3D,
  EPBSSlotClock3D,
  GasEvolution3D,
  BlobSampling3D,
  ZKEVMPopulation3D,
  EOFContainerization3D,
  FullStackLayers3D,
  ScalingStats,
  ScalingSummary,
}
```

**Migration note:** Since the MDX registry is shared across all articles, the old component registrations should ONLY be removed AFTER the old MDX file is deleted. If done in the wrong order, the build will fail. The safe sequence is: (1) add new components to registry, (2) add new MDX file, (3) delete old MDX file, (4) remove old components from registry, (5) delete old component files.

### Connection Flow: MDX to Rendered Scene

```
ethereum-scaling.mdx
  contains: <RoadmapStaircase3D />
      |
      v
mdx/index.tsx (mdxComponents registry)
  maps "RoadmapStaircase3D" to the React component
      |
      v
scaling/index.tsx (barrel)
  dynamic(() => import('./RoadmapStaircase3D'))
  SSR disabled, Placeholder shown while JS loads
      |
      v
scaling/RoadmapStaircase3D.tsx
  renders <SceneContainer> (handles IO, ErrorBoundary, a11y, WebGL check)
    └── <Canvas> with R3F scene graph
          └── uses shared/* primitives as needed
          └── receives reducedMotion prop from SceneContainer
```

---

## 3. Animation Strategy

### Scroll-Triggered Activation

Every 3D scene is wrapped in `SceneContainer`, which uses IntersectionObserver to gate Canvas mounting. The scene does NOT render or animate until it enters the viewport. Pattern:

```
SceneContainer (div with height, role="img", touch-action: pan-y)
  ├── sr-only description (screen reader text)
  ├── IntersectionObserver gate
  │     ├── NOT in viewport → skeleton pulse
  │     ├── WebGL unsupported → fallback text
  │     └── IN viewport → ErrorBoundary → Canvas (R3F) → Scene content
  └── Legend strip
```

When the scene is off-screen:
- Canvas is unmounted entirely (frees GPU memory and WebGL context)
- Mount threshold: 200px before entering viewport
- Unmount threshold: 600px after leaving viewport

When the scene scrolls into view:
- Canvas mounts with `frameloop="always"` (or `frameloop="demand"` if reducedMotion is true)
- Animations begin from their initial state (not from wherever the clock is)
- One-shot reveal animations play once (e.g., platforms rising, pillars growing)
- Looping animations continue (particles, bobbing, rotation)
- If `reducedMotion` is true: skip reveal animations (show final state), disable auto-rotate, suppress particle motion

### Animation Types

| Type | Behavior | Reduced Motion | Example |
|------|----------|----------------|---------|
| **Reveal (one-shot)** | Plays once when scene enters view, never replays | Show final state immediately | Platform ascending in RoadmapStaircase |
| **Loop (continuous)** | Runs while scene is visible, pauses off-screen | Disabled | Particle flows, auto-rotation |
| **Sequence (phased)** | Multi-phase animation that loops (e.g., 3-stage reveal) | Show all stages simultaneously | GasEvolution3D staged progression |
| **Hover (interactive)** | Triggered by pointer events | Still active (hover is user-initiated) | Pillar lift, label brighten, beam intensify |

### Reveal Animations (per scene)

| Scene | Reveal Effect |
|-------|---------------|
| RoadmapStaircase3D | Platforms rise from ground to final Y positions sequentially (0.5s stagger). Initiative shapes grow on each platform after it reaches height. Throughput cubes begin flowing. |
| ParallelVerification3D | Sequential lane (left) starts marching first. After 2s, parallel lanes (right) start simultaneously. Bottleneck funnel pulses once. |
| EPBSSlotClock3D | Both clocks start with sweep hand at 12 o'clock. As hands sweep, segments illuminate. The ePBS clock fills dramatically. |
| GasEvolution3D | Stage 1 platform appears first with single tank. After 1.5s, Stage 2 rises with two tanks and overflow pipe. After 3s, Stage 3 rises with four tanks and price tickers. |
| BlobSampling3D | Producer tower rises first. Broadcast rings emit. Blob grids materialize in a ring (0.2s stagger per blob). Validators fade in last. |
| ZKEVMPopulation3D | Platforms ascend L-to-R. Validators populate each platform after it reaches height. |
| EOFContainerization3D | Today container appears with chaotic tumbling cubes. After 1.5s, EOF container materializes with organized sections. Analysis beam begins scanning. |
| FullStackLayers3D | Layer 1 appears first, Layer 2 rises above it after 1s, Layer 3 after 2s. Elevator particles start only after all layers are visible. |

### Performance Budget

**Rule: Maximum 3 Canvas instances mounted simultaneously.**

Since the article is scrolled vertically and each scene takes ~400-540px of viewport height, at most 2-3 scenes will be in the viewport at any time. The IntersectionObserver in `SceneContainer` guarantees that off-screen scenes are unmounted, freeing their WebGL contexts.

Additional performance rules:
- Every scene with >8 identical meshes MUST use `instancedMesh`
- Maximum 1 shadow-casting directional light per scene
- Shadow map capped at 512x512
- No GLTF models. All THREE.js primitives.
- `dpr` capped at `[1, 2]` on desktop, `[1, 1.5]` on mobile (via `useIsMobile()`)
- No post-processing effects (bloom, SSAO, etc.)
- `flat` mode on Canvas (no tone mapping)
- Particle sphere geometry: `(8, 8)` segments max
- NO textures. All solid colors via `meshStandardMaterial` or `meshBasicMaterial`.
- NO transparent overlapping large planes (overdraw death). Transparent materials only on small elements (particles, beams).
- NO "ambient dust" particles. Every particle must represent data, gas, proofs, or transactions.
- NO gratuitous animations. If you cannot finish "This animates because ___," delete the animation.
- Mobile: reduce instanced particle counts by 50% via a `useIsMobile()` check
- `castShadow` only on main objects (max 6-8 per scene). `receiveShadow` only on ground plane.
- All custom geometries created in `useMemo` MUST be disposed on unmount via `useEffect` cleanup.
- ContactShadows from drei (per 3D proposals style contract): opacity 0.3, max 1 per scene.

### Resource Disposal

Every scene that creates geometry or materials in `useMemo` must clean up on unmount:

```tsx
const geometry = useMemo(() => new THREE.TubeGeometry(...), [deps])

useEffect(() => {
  return () => geometry.dispose()
}, [geometry])
```

R3F auto-disposes primitives declared in JSX, but anything created imperatively (ExtrudeGeometry for clock arcs, TubeGeometry for arrows) must be manually disposed. Failure to dispose causes GPU memory leaks when IntersectionObserver unmounts/remounts scenes during scroll.

---

## 4. Interaction Design

### OrbitControls (every scene)

Standard configuration inherited from the EIP-8141 article, with mobile scroll fix:

```tsx
<OrbitControls
  enableZoom={false}
  enablePan={false}
  minPolarAngle={Math.PI / 8}
  maxPolarAngle={Math.PI / 2.3}
  autoRotate={!reducedMotion}
  autoRotateSpeed={0.4}
  dampingFactor={0.05}
  touches={{ ONE: THREE.TOUCH.ROTATE }}
/>
```

Key additions from the original:
- `autoRotate` is gated on `!reducedMotion` (respects prefers-reduced-motion)
- `touches` explicitly set to `ROTATE` only — prevents OrbitControls from interpreting vertical swipes as panning, which would hijack page scroll

The containing div has `style={{ touchAction: 'pan-y' }}` (set by SceneContainer). This tells the browser to handle vertical scroll natively and only pass horizontal gestures to the Canvas. This prevents the 8 scroll-trap zones that would otherwise exist on mobile.

For scenes with fundamentally 2D layouts (Scenes 1, 2, 4, 6, 7), restrict orbit to a narrow band to prevent users from seeing behind the curtain:
```tsx
// 2D-layout scenes: narrow orbit band
minAzimuthAngle={-Math.PI / 8}   // -22.5 degrees
maxAzimuthAngle={Math.PI / 8}    // +22.5 degrees
minPolarAngle={Math.PI / 4}      // 45 degrees
maxPolarAngle={Math.PI / 3}      // 60 degrees
```

Scenes 3 (radial clocks), 5 (radial blob ring), and 8 (vertical stack) benefit from wider orbit freedom.

### Hover States

Every hoverable object follows this pattern:
- **Lift:** `position.y += 0.04` (0.04 world units)
- **Color:** Transition to `#ffffff`
- **Label:** Opacity to 1.0, additional detail text appears (sub-label)
- **Cursor:** `cursor: pointer` on the containing div

Hover is implemented via `onPointerOver` / `onPointerOut` on R3F group elements, using `useState` to track hover state and `useFrame` to smoothly interpolate the lift.

**Touch device detection:** Use `matchMedia('(hover: hover)')` instead of `'ontouchstart' in window`. Modern touch laptops have both touch and mouse — `ontouchstart` gives false positives. When `(hover: hover)` is false, hover handlers are not attached.

```tsx
const canHover = typeof window !== 'undefined'
  && window.matchMedia('(hover: hover)').matches

// In JSX:
<group
  onPointerOver={canHover ? handleOver : undefined}
  onPointerOut={canHover ? handleOut : undefined}
>
```

### Scene-Specific Interactions

| Scene | Hover Target | Hover Effect |
|-------|-------------|--------------|
| RoadmapStaircase3D | Initiative shapes | Lift + label brightens + category halo glows |
| RoadmapStaircase3D | Throughput cubes | Speed up briefly on hovered platform |
| ParallelVerification3D | Transaction cubes | Lift + slot badges glow on both before/after copies |
| ParallelVerification3D | Dependency wires | Both connected cubes highlight amber |
| EPBSSlotClock3D | Clock segments | Segment lifts, label brightens |
| GasEvolution3D | Gas tanks | Show gas limit number |
| GasEvolution3D | Overflow pipe | Tooltip: "Overflow to reservoir for backward compatibility" |
| GasEvolution3D | Price ticker boards (S3) | Flash price digits |
| GasEvolution3D | Cap bar | Tooltip: "State creation capped" |
| BlobSampling3D | Validator node | 3 sample beams glow, target cells highlight |
| BlobSampling3D | Blob container | All validators sampling from that blob light up |
| ZKEVMPopulation3D | ZK validator | Sparkles intensify, tooltip: "ZK-EVM client" |
| ZKEVMPopulation3D | Prover tower | Implementation name tooltip |
| ZKEVMPopulation3D | Formal seal | Formal verification tooltip |
| EOFContainerization3D | Today container | Chaotic tumbling speeds up |
| EOFContainerization3D | EOF sections | Section flashes, analysis beam targets it |
| EOFContainerization3D | Gas meter | Show exact metering value |
| FullStackLayers3D | Layer floor | All elements on that layer glow |
| FullStackLayers3D | Elevator shaft | Particles speed up |
| FullStackLayers3D | Valid block output | Burst particles intensify |

### Mobile

- **Touch to orbit:** OrbitControls captures horizontal rotate only. Vertical scroll handled by browser via `touch-action: pan-y`.
- **No hover states:** Devices without `(hover: hover)` media query skip hover handlers entirely.
- **Reduced particles:** All `instancedMesh` particle counts halved on mobile:
  - Flow particles: halved per instance
  - Blob grid cells: 4x4 to 4x4 (stays at 16 per blob, already lean)
  - Validator crowds: reduce density
- **Lower DPR:** `dpr={[1, 1.5]}` on mobile (vs `[1, 2]` on desktop) to reduce fill rate.

### Responsive Layout

| Breakpoint | Scene Height | Camera FOV | Camera Position | DPR Cap |
|------------|-------------|------------|-----------------|---------|
| `< 768px` (mobile) | 340px | 42 (wider) | Pulled back 1.2x on Z | `[1, 1.5]` |
| `>= 768px` (desktop) | 400-540px (per scene) | 36-38 | As specified in 3D proposals | `[1, 2]` |

Each scene container uses responsive Tailwind classes:
```tsx
<div className="h-[340px] md:h-[480px] cursor-grab active:cursor-grabbing">
```

Camera position adjusts via a `useIsMobile()` hook (already exists at `frontend/hooks/useMediaQueries.ts`):
```tsx
const isMobile = useIsMobile()
const cameraPos = isMobile ? [0, 5, 8.5] : [0, 4, 7]
const fov = isMobile ? 42 : 36
const dprRange: [number, number] = isMobile ? [1, 1.5] : [1, 2]
```

---

## 5. Design System

### Color Palette

Every scene uses the same palette, inherited from the 3D proposals document:

| Role | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Primary accent / success | `#22c55e` | `green-500` | Ethereum, "after", verified, good |
| Execution / compute | `#3b82f6` | `blue-500` | Execution gas, Layer 1 |
| Calldata / data | `#6366f1` | `indigo-500` | Data blobs, Layer 2 |
| Proofs / ZK | `#8b5cf6` | `violet-500` | ZK-EVM, provers, Layer 3 |
| State creation / warning | `#f59e0b` | `amber-500` | State gas, caution |
| Bottleneck / problem | `#ef4444` | `red-500` | "Today", "before", cramped |
| Neutral dark | `#71717a` | `zinc-500` | Inactive, reservoir |
| Neutral mid | `#a1a1aa` | `zinc-400` | Pipes, dividers |
| Neutral light | `#d4d4d8` | `zinc-300` | Ground, inactive validators |

### Layer Color Mapping (Full Stack scene)

| Layer | Floor Tint | Accent |
|-------|-----------|--------|
| Layer 1: Execution | `#dbeafe` | `#3b82f6` |
| Layer 2: Data | `#e0e7ff` | `#6366f1` |
| Layer 3: Proofs | `#f5f3ff` | `#8b5cf6` |

### Typography (Html Labels Inside Canvas)

All in-scene text uses `Html` from `@react-three/drei` with these classes:

| Element | Size | Weight | Color | Tracking |
|---------|------|--------|-------|----------|
| Section label (e.g. "SHORT-TERM") | `text-[12px]` | `font-bold` | Per-section accent | `tracking-[0.15em] uppercase` |
| Object name (e.g. "Access Lists") | `text-[10px]` or `text-[11px]` | `font-bold` | `text-black` | `tracking-tight` |
| Object sub-label | `text-[8px]` or `text-[9px]` | normal | `text-zinc-500` | normal |
| Numeric value (e.g. "800ms") | `text-[10px]` | `font-mono` | Per-section accent | normal |
| Phase indicator | `text-[9px]` | normal | `text-zinc-400` | normal |

All labels: `pointerEvents: 'none'`, `userSelect: 'none'`, `whiteSpace: 'nowrap'`.

### Scene Container Styles

Every 3D scene is wrapped in `SceneContainer` which enforces the standard container structure:

```tsx
<SceneContainer
  height="h-[340px] md:h-[480px]"
  ariaLabel="3D visualization of parallel block verification showing sequential vs parallel transaction processing"
  srDescription="A split-view scene. On the left, eight transaction cubes are lined up single-file behind a bottleneck funnel, taking 800ms to process sequentially. On the right, the same eight transactions are spread across five parallel lanes based on their storage access lists, completing in 300ms. The parallel side shows 2.7x more throughput."
  fallbackText="This section shows a 3D comparison of sequential vs parallel block verification. Your browser does not support WebGL. In short: access lists let validators run non-conflicting transactions simultaneously, reducing block verification time from 800ms to 300ms."
  legend={
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-red-500 border border-red-600" />
        <span className="text-[10px] text-text-muted tracking-wide">Sequential</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-green-500 border border-green-600" />
        <span className="text-[10px] text-text-muted tracking-wide">Parallel</span>
      </div>
    </div>
  }
>
  {({ reducedMotion }) => (
    <Canvas flat camera={{ position: [0, 4, 7], fov: 36 }} dpr={dprRange} gl={{ antialias: true }}>
      <color attach="background" args={['#ffffff']} />
      {/* ... scene content ... */}
      <OrbitControls autoRotate={!reducedMotion} /* ... */ />
    </Canvas>
  )}
</SceneContainer>
```

Key rules:
- **Background:** Always `#ffffff`. No gradients, no dark scenes.
- **Top border:** `border-t-[3px] border-black` (BlackRock-report aesthetic)
- **Bottom border:** `border-b border-b-border-light` (subtle)
- **Legend strip:** Always present. Color swatches (12x8px rounded boxes) with 10px labels. "drag to orbit" right-aligned in mono.
- **Negative margins:** `-mx-4 md:-mx-8` to bleed outside article column.
- **touch-action: pan-y** on the Canvas container to prevent scroll hijack.
- **role="img"** with descriptive aria-label on the Canvas container.
- **sr-only description** as a hidden paragraph inside the container.

### Dark Mode

Not applicable. The article uses a forced light theme (`bg-white`, `color-black`). All scene backgrounds are `#ffffff`. If the site adds dark mode later, the 3D scenes would need:
- `<color attach="background" args={['#1a1a1a']} />`
- Ground plane `meshBasicMaterial` color swap
- Html label text color inversions
- This is out of scope for this rewrite.

---

## 6. Implementation Priority

### Build Order

Build order is driven by three factors: (1) SceneContainer must exist first, (2) shared primitive dependencies, and (3) visual impact.

| Priority | What | Why | Deps | Est. Components |
|----------|------|-----|------|-----------------|
| **P0** | SceneContainer.tsx | Every scene depends on this. IO, ErrorBoundary, a11y, WebGL detection. | None | 1 file |
| **P0** | Shared primitives: TankModel, PlatformStage, ValidatorFigure | Multiple scenes depend on these | None | 3 files |
| **P1** | Scene 2: ParallelVerification3D | Simplest before/after scene. Establishes the pattern. No shared primitive deps. | SceneContainer | 1 file |
| **P1** | Scene 3: EPBSSlotClock3D | Clock geometry, ShapeGeometry arcs. Standalone. | SceneContainer | 1 file |
| **P2** | Scene 7: EOFContainerization3D | New scene, simple geometry, high impact for missing concept. | SceneContainer | 1 file |
| **P2** | Shared primitives: ProverTower, BlobGrid | Needed by Scenes 5, 6, 8 | None | 2 files |
| **P3** | Scene 4: GasEvolution3D | Uses TankModel + PlatformStage. Most complex animation (3-stage reveal). Merged from three original scenes. | SceneContainer, TankModel, PlatformStage | 1 file |
| **P3** | Scene 1: RoadmapStaircase3D | Uses PlatformStage. Overview scene, benefits from having built the pieces. | SceneContainer, PlatformStage | 1 file |
| **P4** | Scene 6: ZKEVMPopulation3D | Uses PlatformStage + ProverTower + ValidatorFigure. | SceneContainer, PlatformStage, ProverTower, ValidatorFigure | 1 file |
| **P4** | Scene 5: BlobSampling3D | Uses BlobGrid + ValidatorFigure. Second-most complex instancing. | SceneContainer, BlobGrid, ValidatorFigure | 1 file |
| **P5** | Scene 8: FullStackLayers3D | Build LAST. Reuses components from ALL other scenes. Grand finale. | SceneContainer, TankModel, BlobGrid, ProverTower, PlatformStage, ValidatorFigure | 1 file |
| **P5** | ScalingCards.tsx | CSS-only stat cards (ScalingStats, ScalingSummary). No deps. Can be built anytime. | None | 1 file |
| **P5** | scaling/index.tsx barrel + MDX registry update | Wiring. Should be set up early (can export stubs) and finalized last. | All scenes | 2 files |

### Estimated Component Count

| Category | Count |
|----------|-------|
| Infrastructure (SceneContainer) | 1 |
| 3D scene components | 8 |
| Shared primitive components | 5 |
| CSS card components | 1 (with 2 exports) |
| Barrel export (index.tsx) | 1 |
| **Total new files** | **16** |

Plus updates to:
- `frontend/components/mdx/index.tsx` (swap imports)
- `frontend/content/learn/ethereum-scaling.mdx` (new article)

### Migration Sequence (avoid build breakage)

The MDX registry is shared across all articles. The swap must be done in this order to avoid breaking the build:

1. Create `scaling/` directory with all new components (can be stubs initially)
2. Create `scaling/index.tsx` barrel
3. ADD new component registrations to `mdx/index.tsx` (keep old ones)
4. Create `ethereum-scaling.mdx`
5. Verify new article builds and renders
6. Delete `eip-8141-account-abstraction.mdx`
7. REMOVE old component registrations from `mdx/index.tsx`
8. Delete old component files from `diagrams/`

Steps 6-8 must happen in the same commit or the build breaks.

### Dependency Graph

```
SceneContainer ─── REQUIRED BY ALL 8 SCENES

TankModel ──────┬── GasEvolution3D (P3)
                └── FullStackLayers3D (P5)

PlatformStage ──┬── RoadmapStaircase3D (P3)
                ├── GasEvolution3D (P3)
                ├── ZKEVMPopulation3D (P4)
                └── FullStackLayers3D (P5)

ProverTower ────┬── ZKEVMPopulation3D (P4)
                └── FullStackLayers3D (P5)

BlobGrid ───────┬── BlobSampling3D (P4)
                └── FullStackLayers3D (P5)

ValidatorFigure ┬── BlobSampling3D (P4)
                ├── ZKEVMPopulation3D (P4)
                └── FullStackLayers3D (P5)

(No deps) ──────┬── ParallelVerification3D (P1)
                ├── EPBSSlotClock3D (P1)
                ├── EOFContainerization3D (P2)
                └── ScalingCards (P5)
```

---

## 7. What Gets Deleted

### Components Removed (entire files)

Every file in the existing `frontend/components/learn/diagrams/` directory that is specific to the EIP-8141 article:

| File | What It Contains | Replacement |
|------|-----------------|-------------|
| `EIPTimeline3D.tsx` | 3D pillar timeline of EIP history | RoadmapStaircase3D |
| `FrameTransactionScene.tsx` | 3D frame transaction pipeline | No equivalent (article topic changed) |
| `BeforeAfterScene.tsx` | 3D before/after architecture comparison | No equivalent |
| `MempoolLayers.tsx` | 3D three-tier mempool scene | No equivalent |
| `PrivacyDiagram.tsx` | 3D privacy before/after with crowd users | No equivalent |
| `PaymasterFlow.tsx` | 3D paymaster U-shape flow | No equivalent |
| `VisualCards.tsx` | CSS stat cards, benefit grids, comparisons (StatsOverview, StatsUnlocked, EOABenefits, CapabilityCards, FOCILComparison, QuantumComparison, HegotaSummary) | ScalingCards.tsx |
| `FrameFlow.tsx` | CSS step-flow diagrams (FlowNormalTx, FlowAtomicOps, FlowNewAccount, FlowPrivacyZK, FrameFlow) | No equivalent |
| `EIPTimeline.tsx` | 2D CSS timeline (referenced in barrel, dead code in MDX) | No equivalent |

### Files That Stay (infrastructure)

| File | Why It Stays |
|------|-------------|
| `ClientOnly.tsx` | Generic SSR guard. Still useful as a utility, though SceneContainer handles the SSR guard for 3D scenes. |
| `index.tsx` (current barrel) | Gets COMPLETELY REWRITTEN to re-export from `scaling/index.tsx`. Or: the MDX registry import path changes to `@/components/learn/diagrams/scaling`. |

### MDX File Removed

| File | Replacement |
|------|-------------|
| `frontend/content/learn/eip-8141-account-abstraction.mdx` | `frontend/content/learn/ethereum-scaling.mdx` |

### MDX Registry Changes

In `frontend/components/mdx/index.tsx`, remove these 17 component registrations:

```
FrameTransactionScene, PaymasterFlow, MempoolLayers, EIPTimeline, EIPTimeline3D,
PrivacyDiagram, BeforeAfterScene, FrameFlow, FlowNormalTx, FlowAtomicOps,
FlowNewAccount, FlowPrivacyZK, StatsOverview, StatsUnlocked, EOABenefits,
CapabilityCards, FOCILComparison, QuantumComparison, HegotaSummary
```

Replace with 10 new registrations:

```
RoadmapStaircase3D, ParallelVerification3D, EPBSSlotClock3D,
GasEvolution3D, BlobSampling3D, ZKEVMPopulation3D, EOFContainerization3D,
FullStackLayers3D, ScalingStats, ScalingSummary
```

### Summary of Deletions

| Category | Count |
|----------|-------|
| TSX files deleted | 8 (EIPTimeline3D, FrameTransactionScene, BeforeAfterScene, MempoolLayers, PrivacyDiagram, PaymasterFlow, VisualCards, FrameFlow) + 1 (EIPTimeline) |
| MDX files deleted | 1 (eip-8141-account-abstraction.mdx) |
| Component registrations removed from MDX registry | 17 |
| Total exports removed from barrel | ~17 |

### What Gets Preserved

| Item | Preserved As |
|------|-------------|
| `ClientOnly.tsx` | Kept as utility (SceneContainer replaces its role for 3D scenes) |
| Container pattern (`my-12 -mx-4 md:-mx-8`, border-t, legend strip) | Moved INTO SceneContainer (single source of truth) |
| `Canvas` setup pattern (`flat`, `dpr`, `gl={{ antialias: true }}`) | Documented in SceneContainer usage, applied in each scene |
| `OrbitControls` configuration | Documented, applied in each scene with reducedMotion gate |
| `FadeInSection` component | Still used by MDX h2 headings |
| `ArticleHeader` component | Still used by the article layout |
| `Callout` MDX component | Still available (may not be used in new article) |
| Instanced particle pattern (`useFrame` + `instancedMesh` + dummy `Object3D`) | Inherited pattern, reproduced in new scenes |
| `StepRiser` pattern | Rebuilt as part of `PlatformStage` shared primitive |
| `FlowParticles` / `FlowArrow` pattern | Rebuilt as inline utilities in scenes that need them |
| `PersonModel` pattern | Rebuilt as `ValidatorFigure` shared primitive |

---

## 8. Draw Call Budget Summary

From the 3D proposals document (source of truth). The metric is draw calls, not individual prop counts — an instancedMesh with 64 instances is 1 draw call.

| # | Scene | Discrete Meshes | InstancedMesh Systems | Draw Calls | Budget (max 50) |
|---|-------|-----------------|-----------------------|------------|-----------------|
| 1 | RoadmapStaircase3D | ~20 | 4 | ~24 | Under |
| 2 | ParallelVerification3D | ~22 | 4 | ~26 | Under |
| 3 | EPBSSlotClock3D | ~15 | 1 | ~16 | Under |
| 4 | GasEvolution3D | ~40 | 8 | ~48 | At limit |
| 5 | BlobSampling3D | ~15 | 4 | ~19 | Under |
| 6 | ZKEVMPopulation3D | ~15 | 10 | ~25 | Under |
| 7 | EOFContainerization3D | ~16 | 5 | ~21 | Under |
| 8 | FullStackLayers3D | ~22 | 5 | ~27 | Under |

Scene 4 (GasEvolution3D) is at the draw call budget limit and must be monitored. All other scenes are comfortably under the 50-draw-call cap.

Every particle and instanced element represents something meaningful — data flow, gas consumption, transaction throughput, or validator state. Zero gratuitous particles.

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Mobile GPU can't handle 8 Canvas instances** | SceneContainer's IntersectionObserver ensures max 3 mounted at once. Canvases unmount when scrolled 600px past. Mobile particle counts halved. Mobile DPR capped at 1.5. |
| **WebGL context limit (browser-wide 16, mobile 8)** | IntersectionObserver unmounts off-screen scenes, freeing contexts. With max 3 mounted, even 3+ tabs is safe. SceneContainer checks for WebGL support before mounting. |
| **WebGL context loss** | SceneContainer listens for `webglcontextlost` event and shows recovery UI. R3F Canvas internally handles context restoration, but the wrapper provides fallback text. |
| **3D scene crashes (bad geometry, shader errors)** | ErrorBoundary around every Canvas. Crash reports to PostHog via existing ErrorBoundary. User sees graceful fallback text, not a broken page. |
| **Browser does not support WebGL** | SceneContainer checks for WebGLRenderingContext. If absent, shows fallback text describing what the scene would show. |
| **Screen reader users see nothing** | Every scene has role="img", aria-label, and a sr-only paragraph describing the visualization in full sentences. |
| **prefers-reduced-motion users** | SceneContainer reads usePrefersReducedMotion. Scenes receive reducedMotion prop. Auto-rotate disabled. Reveal animations show final state. Loop animations suppressed. Canvas uses frameloop="demand". |
| **Touch scroll hijack (8 Canvases on mobile)** | SceneContainer sets `touch-action: pan-y` on the Canvas container. OrbitControls configured with `touches={{ ONE: THREE.TOUCH.ROTATE }}`. Browser handles vertical scroll natively. |
| **SEO: thin content with mostly Canvas** | Each section has 3-5 sentences of substantive prose (~800 words total). sr-only descriptions add additional crawlable text. Html labels inside Canvas are also in the DOM. |
| **ExtrudeGeometry (Scene 3 clock arcs) is computationally expensive** | Downgraded to ShapeGeometry extruded to depth 0.03 (per 3D proposals recommendation). Pre-compute in `useMemo`. Dispose on unmount. |
| **100-cell blob grid (Scene 5) stutters** | Single `instancedMesh` with per-instance color buffer. Matrix updates batched in one `useFrame`. Already cut from 512 to 100 cells. |
| **GasEvolution3D (Scene 4) three-stage animation is complex** | Use modular clock (`elapsed % cycleDuration`) for perfect looping, not accumulating offsets. |
| **Html labels cause layout thrashing** | All labels are `pointerEvents: 'none'`, `userSelect: 'none'`, absolute positioned. No reflows. |
| **Bundle size from 8 dynamically imported scenes** | Each scene is code-split via `next/dynamic`. Only the visible scenes load. ScalingCards also dynamically imported to avoid polluting barrel chunk. |
| **Shared primitives duplicated across chunks** | Add splitChunks config in next.config.js to extract `scaling/shared/*` into a named chunk, or import shared primitives from a single barrel that webpack can deduplicate. |
| **Transparent overlapping large planes (Scene 8 floors)** | Layer floors are OPAQUE, not transparent. Transparency only on small elements (particles, beams). |
| **Shadow maps too expensive** | Capped at 512x512. Max 6-8 shadow casters per scene. ContactShadows (per 3D proposals style contract) at opacity 0.3. |
| **GPU memory leaks on scene remount** | All custom geometries and materials created in `useMemo` are disposed in `useEffect` cleanup. IntersectionObserver unmount triggers full React teardown. |
| **Build breakage during migration** | Migration sequence documented: add new components first, delete old ones last. Steps 6-8 must be atomic (same commit). |
| **Touch detection false positives** | Use `matchMedia('(hover: hover)')` instead of `'ontouchstart' in window`. Modern touch+mouse devices are handled correctly. |
| **Multiple tabs with same article** | Each tab mounts max 3 Canvases = 6 contexts for 2 tabs. Browser limit is 16. Safe margin. |
