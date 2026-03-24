# Short-03 Engine Architecture

Short-03 is the latest iteration. This doc maps how it works today, what's fragile, and how to make each part independent so editing one thing never breaks another.

---

## How Short-03 Works Right Now

```
FebNewTop500Composition.tsx (208 lines)
│
├── IMPORTS FROM SHORT-01 (the problem)
│   ├── ShortProvider          ← context (20 lines, trivial)
│   ├── ShotRenderer           ← 378-line god object
│   └── types (35 re-exports)  ← ShotDef, BackgroundDef, etc.
│
├── IMPORTS FROM LIB (clean)
│   ├── Vignette, FilmGrain, ProgressBar
│   ├── AudioEngineProvider
│   ├── msToFrame, remapCaptions, buildVoiceTimeline
│   └── Caption type
│
├── SHORT-03 OWN FILES (6 total)
│   ├── shots.ts               ← 594 lines, 12 shot definitions
│   ├── types.ts               ← re-exports short-01 types + COLORS
│   ├── components/
│   │   ├── ViralCaptions.tsx   ← 184 lines, smart phrase grouping
│   │   └── RejectedStamp.tsx   ← 111 lines, spring slam overlay
│   └── audio/
│       └── MoodMusic.tsx       ← 100 lines, segment-based music
│
└── RENDER PIPELINE
    ├── buildVoiceTimeline(shots) → voiceRuns, shotFrameOffsets, durations
    ├── <Audio> per voiceRun (composition-level, no decoder clicks)
    ├── <Series> loop → <ShotRenderer> per shot
    ├── <ViralCaptions> (composition-level overlay)
    ├── <MoodMusic> (segment-based music ducking)
    └── <Vignette> + <FilmGrain> + <ProgressBar>
```

---

## The Dependency Chain (This Is The Problem)

```
short-03/FebNewTop500Composition.tsx
    │
    ├── short-01/ShotRenderer.tsx (378 lines, 37 imports)
    │   │
    │   ├── short-01/ShotBackground.tsx
    │   ├── short-01/VoiceSyncChibi.tsx
    │   ├── short-01/ShotCaptions.tsx
    │   ├── short-01/ShotTransition.tsx
    │   ├── short-01/DataCallout.tsx
    │   ├── short-01/ArchitectureDiagram.tsx
    │   ├── short-01/DuotoneOverlay.tsx
    │   ├── short-01/AnimatedBg.tsx
    │   ├── short-01/BrollMosaic.tsx
    │   ├── short-01/FloatingCryptoLogos.tsx
    │   ├── short-01/StablecoinCards.tsx
    │   ├── short-01/ProjectShowcase.tsx
    │   ├── short-01/ProjectDataCard.tsx
    │   ├── short-01/CinematicLetterbox.tsx
    │   ├── short-01/ShotVfx.tsx
    │   ├── short-01/LightLeakOverlay.tsx
    │   ├── short-01/ChibiVfx.tsx
    │   ├── short-01/AnimatedBarChart.tsx       ← short-03 NEVER uses this
    │   ├── short-01/AnimatedRankings.tsx       ← short-03 NEVER uses this
    │   ├── short-01/RedditToTerminalMorph.tsx  ← short-03 NEVER uses this
    │   ├── short-01/GhostLogos.tsx             ← short-03 NEVER uses this
    │   ├── short-01/ImpactScene.tsx            ← short-03 NEVER uses this
    │   ├── short-01/MiniPersona.tsx            ← short-03 NEVER uses this
    │   ├── short-01/QuestionStack.tsx          ← short-03 NEVER uses this
    │   ├── short-01/CompoundingList.tsx        ← short-03 NEVER uses this
    │   ├── short-01/ScreenBreak.tsx            ← short-03 NEVER uses this
    │   ├── short-01/CrowdVisualization.tsx     ← short-03 NEVER uses this
    │   ├── short-01/SneakyCEO.tsx              ← short-03 NEVER uses this
    │   ├── short-01/FandomScroll.tsx           ← short-03 NEVER uses this
    │   ├── short-01/SplitScreen.tsx            ← short-03 NEVER uses this
    │   ├── short-01/CrunchyrollReveal.tsx      ← short-03 NEVER uses this
    │   │
    │   ├── short-01/types.ts (ShotDef: 40+ optional props)
    │   ├── short-01/sceneRegistry.tsx
    │   └── short-01/ShortContext.tsx
    │
    ├── lib/Effects/ (ScreenShake, FlashImpact, EmojiRain, SpeedLines)
    ├── lib/Audio/ (SFXTrigger, AudioEngine)
    └── lib/Overlays/ (Vignette, FilmGrain, ProgressBar)
```

**What short-03 ACTUALLY uses from ShotRenderer:**
- ShotBackground (images, gradients, video)
- VoiceSyncChibi (character + emotion)
- DataCallout (text overlays)
- ArchitectureDiagram (Zama/Aztec diagrams)
- ProjectDataCard (CoinGecko-style cards)
- BrollMosaic (Aztec B-roll grid)
- StablecoinCards (shot 4)
- ProjectShowcase (shot 1)
- FloatingCryptoLogos (shot 1)
- CinematicLetterbox (shots 11-12)
- ShotTransition (fade/cut between shots)
- SFXTrigger (per-shot sound effects)
- Camera math (zoom, breathe, tilt, drift, focus, color shift)

**What short-03 NEVER uses but still loads:**
AnimatedBarChart, AnimatedRankings, RedditToTerminalMorph, GhostLogos, ImpactScene, MiniPersona, QuestionStack, CompoundingList, ScreenBreak, CrowdVisualization, SneakyCEO, FandomScroll, SplitScreen, CrunchyrollReveal, AnimatedBg (as overlay), DuotoneOverlay, LightLeakOverlay, ShotVfx, ShotCaptions (disabled via `hideCaptions: true`)

---

## What Breaks What (Current State)

```
IF YOU CHANGE...                    IT BREAKS...
─────────────────────               ────────────
short-01/ShotRenderer.tsx           → short-03 (direct import)
short-01/types.ts (ShotDef shape)   → short-03 (re-exports all types)
short-01/ShotBackground.tsx         → short-03 (used in every shot)
short-01/VoiceSyncChibi.tsx         → short-03 (used in every shot)
short-01/ProjectDataCard.tsx        → short-03 (used in 6 shots)
short-01/COLORS (the object)        → short-03 ShotRenderer uses COLORS.BG_BASE

short-03/shots.ts                   → nothing else (leaf node)
short-03/ViralCaptions.tsx          → nothing else (leaf node)
short-03/RejectedStamp.tsx          → nothing else (leaf node)
short-03/MoodMusic.tsx              → nothing else (leaf node)

lib/buildVoiceTimeline              → short-03 composition (timeline breaks)
lib/remapCaptions                   → short-03 composition (caption sync breaks)
```

**The core issue: short-03 has zero isolation from short-01.** Any edit to short-01's ShotRenderer or its 37 sub-components can cascade into short-03.

---

## What Short-03 Actually Needs (Minimal Feature Set)

Looking at the 12 shots, short-03 uses exactly these visual features:

```
FEATURE                  SHOTS USING IT     COMPONENT
───────────────────────  ────────────────    ─────────────────
Background (img/vid/grad) all 12            ShotBackground
Chibi character          all 12             VoiceSyncChibi
Camera effects           all 12             (baked in ShotRenderer lines 83-149)
Shot transitions         fade: 2,5,7,11     ShotTransition
                         cut: rest
SFX triggers             9 of 12            SFXTrigger (from lib)
Project data card        shots 2,5,7,8,11,12  ProjectDataCard
Word highlights          all 12             (via ViralCaptions, not ShotCaptions)
Data callout             shots 1,3,6,10     DataCallout
Architecture diagram     shots 3,9          ArchitectureDiagram
B-roll mosaic            shot 7             BrollMosaic
Stablecoin cards         shot 4             StablecoinCards
Project showcase         shot 1             ProjectShowcase
Floating logos           shot 1             FloatingCryptoLogos
Cinematic letterbox      shots 11,12        CinematicLetterbox
Focus pull               shots 5,6,10,11,12 (baked in ShotRenderer)
Color shift              shots 5,6,10,11    (baked in ShotRenderer)
Rejected stamp           shots 6,11         RejectedStamp (own component)
Viral captions           all 12             ViralCaptions (own component)
Mood music               composition-level  MoodMusic (own component)
```

That's **16 visual features**. ShotRenderer supports **30+** features. Short-03 carries 14 unused features as dead weight and coupling risk.

---

## Proposed Architecture: Slot-Based Composition

**Goal:** Each short owns its render pipeline. No short imports another short. Features are slots you pick from a shared menu.

### The Slot Model

```
┌─────────────────────────────────────────────────────────────┐
│  Short Composition                                           │
│                                                              │
│  buildVoiceTimeline(shots) → timeline                        │
│  <Series> shots.map → <ShotFrame shot={shot}>               │
│                                                              │
│    ShotFrame renders SLOTS in order:                         │
│    ┌─────────────────────────────────────────┐               │
│    │ slot: background   → BackgroundSlot     │               │
│    │ slot: diagram      → DiagramSlot        │  each slot    │
│    │ slot: broll        → BrollSlot          │  is a         │
│    │ slot: dataCard     → DataCardSlot       │  standalone   │
│    │ slot: chibi        → ChibiSlot          │  component    │
│    │ slot: callout      → CalloutSlot        │  that checks  │
│    │ slot: sfx          → SFXSlot            │  its own      │
│    │ slot: letterbox    → LetterboxSlot      │  ShotDef      │
│    │ slot: transition   → TransitionSlot     │  props        │
│    └─────────────────────────────────────────┘               │
│                                                              │
│  Composition-level overlays:                                 │
│    <ViralCaptions>                                           │
│    <MoodMusic>                                               │
│    <Vignette> <FilmGrain> <ProgressBar>                     │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── slots/                        ← NEW: shared visual building blocks
│   ├── BackgroundSlot.tsx        ← renders image/video/gradient/solid from shot.background
│   ├── ChibiSlot.tsx             ← renders character from shot.chibiEmotion
│   ├── CameraSlot.tsx            ← wraps children with zoom/breathe/tilt/drift/focus/color
│   ├── TransitionSlot.tsx        ← fade/cut overlay from shot.transitionIn
│   ├── SFXSlot.tsx               ← sound effects from shot.sfx[]
│   ├── CalloutSlot.tsx           ← data callout from shot.dataCallout
│   ├── DiagramSlot.tsx           ← architecture diagram from shot.architectureDiagram
│   ├── DataCardSlot.tsx          ← CoinGecko card from shot.projectDataCard
│   ├── BrollSlot.tsx             ← B-roll mosaic from shot.brollMosaic
│   ├── LetterboxSlot.tsx         ← cinematic bars from shot.letterbox
│   ├── StablecoinSlot.tsx        ← stablecoin cards from shot.stablecoinCards
│   ├── ShowcaseSlot.tsx          ← project showcase from shot.projectShowcase
│   ├── LogosSlot.tsx             ← floating logos from shot.floatingLogos
│   └── index.ts                  ← barrel export
│
├── slots/hooks/                  ← NEW: shared hooks
│   ├── useSafeCaptions.ts        ← extracted from every composition
│   └── useFrameOffsets.ts        ← frame offset computation
│
├── slots/ShotFrame.tsx           ← NEW: replaces ShotRenderer
│   Takes: shot, slots[], globalFrameOffset
│   Wraps with CameraSlot, renders each slot
│
└── shorts/
    └── short-03/
        ├── FebNewTop500Composition.tsx   ← uses ShotFrame + picked slots
        ├── shots.ts                       ← unchanged
        ├── types.ts                       ← imports from slots/types (not short-01)
        ├── components/
        │   ├── ViralCaptions.tsx          ← unchanged
        │   └── RejectedStamp.tsx          ← unchanged (could become a slot too)
        └── audio/
            └── MoodMusic.tsx              ← unchanged
```

### How a Slot Works

Each slot is dead simple — it reads its specific prop from ShotDef, renders if present, returns null otherwise:

```tsx
// slots/CalloutSlot.tsx
import type { ShotDef } from "./types";

export const CalloutSlot: React.FC<{ shot: ShotDef }> = ({ shot }) => {
  if (!shot.dataCallout) return null;
  return <DataCallout callout={shot.dataCallout} />;
};
```

```tsx
// slots/CameraSlot.tsx — wraps children with camera effects
export const CameraSlot: React.FC<{ shot: ShotDef; children: React.ReactNode }> = ({ shot, children }) => {
  const frame = useCurrentFrame();
  const dur = secondsToFrame(shot.durationSeconds);

  const fsScale = shot.fullScreenZoom
    ? interpolate(frame, [0, dur], shot.fullScreenZoom === "in" ? [1, 1.05] : [1.05, 1], clamp)
    : 1;
  const breathScale = shot.breathingPulse
    ? 1 + 0.015 * Math.sin((frame / 30) * Math.PI * 2 * 0.5)
    : 1;
  // ... tilt, drift, vertDrift, focusPull, colorShift (same math as current ShotRenderer)

  return (
    <AbsoluteFill style={{ transform: ..., filter: ... }}>
      {children}
    </AbsoluteFill>
  );
};
```

### How ShotFrame Replaces ShotRenderer

```tsx
// slots/ShotFrame.tsx
interface Props {
  shot: ShotDef;
  slots: React.FC<{ shot: ShotDef; [key: string]: any }>[];
  globalFrameOffset: number;
  captions?: Caption[];
  prevShotEmotion?: string;
  nextShotEmotion?: string;
  prevProjectTicker?: string;
  voiceSegments?: VoiceSegment[];
}

export const ShotFrame: React.FC<Props> = ({ shot, slots, ...rest }) => {
  return (
    <CameraSlot shot={shot}>
      {slots.map((Slot, i) => (
        <Slot key={i} shot={shot} {...rest} />
      ))}
    </CameraSlot>
  );
};
```

### How Short-03 Composition Looks After

```tsx
// short-03/FebNewTop500Composition.tsx

import { ShotFrame } from "../../slots/ShotFrame";
import { BackgroundSlot, ChibiSlot, CalloutSlot, DiagramSlot,
         DataCardSlot, BrollSlot, StablecoinSlot, ShowcaseSlot,
         LogosSlot, LetterboxSlot, TransitionSlot, SFXSlot } from "../../slots";

// Short-03 picks EXACTLY the slots it uses — nothing else loaded
const SLOTS = [
  BackgroundSlot,
  DiagramSlot,
  BrollSlot,
  StablecoinSlot,
  ShowcaseSlot,
  LogosSlot,
  DataCardSlot,
  ChibiSlot,
  CalloutSlot,
  LetterboxSlot,
  SFXSlot,
  TransitionSlot,
];

// ... buildVoiceTimeline etc stays the same ...

export const FebNewTop500Composition: React.FC = () => {
  // ... same voice timeline, captions, etc ...

  return (
    <ShortProvider assetDir={ASSET_DIR}>
      <AudioEngineProvider ...>
        <AbsoluteFill style={{ backgroundColor: COLORS.BG_BASE }}>
          {/* Voice audio (unchanged) */}
          {voiceRuns.map((run, ri) => (
            <Sequence key={ri} from={run.compFrom} durationInFrames={run.compDuration}>
              <Audio src={...} startFrom={...} volume={getRunVolume(run)} />
            </Sequence>
          ))}

          {/* Shot sequence — uses ShotFrame instead of ShotRenderer */}
          <Series>
            {shots.map((shot, i) => (
              <Series.Sequence key={shot.id} durationInFrames={shotFrameDurations[i]}>
                <ShotFrame
                  shot={{ ...shot, hideCaptions: true }}
                  slots={SLOTS}
                  globalFrameOffset={shotFrameOffsets[i]}
                  captions={captions}
                  prevShotEmotion={...}
                  nextShotEmotion={...}
                  prevProjectTicker={...}
                  voiceSegments={shot.voiceSegments}
                />
                {STAMP_CONFIG[shot.id] && (
                  <RejectedStamp delayFrames={STAMP_CONFIG[shot.id].delayFrames} />
                )}
              </Series.Sequence>
            ))}
          </Series>

          <ViralCaptions ... />
          <MoodMusic ... />
          <Vignette opacity={0.3} spread={50} />
          <FilmGrain opacity={0.02} />
          <ProgressBar color={COLORS.ACCENT_BLUE} height={3} />
        </AbsoluteFill>
      </AudioEngineProvider>
    </ShortProvider>
  );
};
```

---

## What Changes for Each Scenario

### "I want to edit a slot (e.g. fix ProjectDataCard)"

```
BEFORE: Edit short-01/components/ProjectDataCard.tsx
        → Risk: breaks short-01 AND short-03 simultaneously
        → Can't test in isolation

AFTER:  Edit slots/DataCardSlot.tsx
        → Only affects shorts that include DataCardSlot in their SLOTS array
        → Each slot has no knowledge of other slots
        → Test with: npx remotion preview --props '{"shot": {..., "projectDataCard": {...}}}'
```

### "I want to add a new visual feature for short-04"

```
BEFORE: 1. Add props to short-01/types.ts (breaks short-03 type re-exports)
        2. Add conditional block to short-01/ShotRenderer.tsx (breaks short-03)
        3. Import new component in ShotRenderer (adds to bundle for all shorts)
        4. Test — hope nothing in short-03 broke

AFTER:  1. Create slots/MyNewSlot.tsx (self-contained)
        2. Add optional prop to slots/types.ts (additive, never breaking)
        3. In short-04 composition: SLOTS = [...defaults, MyNewSlot]
        4. Short-03 doesn't know MyNewSlot exists, can't break
```

### "I want to go back and improve short-01 backgrounds"

```
BEFORE: Edit short-01/ShotBackground.tsx
        → short-03 imports ShotRenderer which imports ShotBackground
        → If you change the prop interface, short-03 breaks
        → If you change rendering behavior, short-03 looks different

AFTER:  Edit slots/BackgroundSlot.tsx
        → All shorts using BackgroundSlot get the improvement
        → OR: short-01 can override with its own BackgroundSlot variant
              by putting a local one in its SLOTS array
        → Short-03 is unaffected if it doesn't want the change
```

### "I want to create short-05 fast"

```
BEFORE: 1. Clone _template/ (22 files)
        2. Edit ShotRenderer to remove unused features
        3. Copy types, adjust
        4. Wire audio, captions, overlays

AFTER:  1. Create short-05/
        2. shots.ts (your shot definitions)
        3. types.ts (import from slots/types, add COLORS)
        4. index.tsx:
           const SLOTS = [BackgroundSlot, ChibiSlot, TransitionSlot];
           // 3 slots = that's all you need to start
        5. Add slots as you need them
```

---

## Migration Plan (Non-Breaking)

```
Step 1: Extract slots from short-01 components
────────────────────────────────────────────────
For each component short-03 actually uses:
  - Copy short-01/components/ShotBackground.tsx → slots/BackgroundSlot.tsx
  - Wrap with shouldRender check (if !shot.background return null)
  - Keep short-01's ShotRenderer untouched
  - Both work in parallel

Step 2: Extract CameraSlot from ShotRenderer lines 83-149
──────────────────────────────────────────────────────────────
  - Copy the camera math (zoom, breathe, tilt, drift, focus, color)
  - Make it a wrapper component
  - This is pure math, no risk

Step 3: Build ShotFrame
────────────────────────
  - Takes shot + slots array, wraps with CameraSlot
  - Renders each slot in order
  - Test with one shot first

Step 4: Rewire short-03 to use ShotFrame
──────────────────────────────────────────
  - Replace: import { ShotRenderer } from "../short-01/..."
  - With: import { ShotFrame } from "../../slots/ShotFrame"
  - Pick only the 12 slots short-03 needs
  - Delete the short-01 import entirely

Step 5: Freeze. Test. Ship.
─────────────────────────────
  - Short-01 still uses its own ShotRenderer (unchanged)
  - Short-03 uses ShotFrame + slots (independent)
  - No cross-short imports
  - Future shorts use slots from day 1
```

---

## Before / After Summary

```
                        BEFORE                          AFTER
                        ──────                          ─────
short-03 imports from   short-01 (37 transitive deps)   slots/ (12 picked slots)
Edit short-01           breaks short-03                 doesn't affect short-03
New feature             edit ShotRenderer (all shorts)  add one slot file
New short               clone 22 files                  pick slots, write shots.ts
Dead code in short-03   14 unused components loaded     zero (only picked slots)
Camera math             baked in ShotRenderer            CameraSlot (shared, testable)
Types                   re-exported from short-01       imported from slots/types
```

The key principle: **no short ever imports from another short.** Shared things live in `slots/` or `lib/`. Each short picks what it needs.
