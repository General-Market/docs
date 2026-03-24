---
stepsCompleted: ["step-01", "step-02", "step-03"]
inputDocuments:
  - /Users/maxguillabert/Downloads/video/ARCHITECTURE.md
---

# Video Engine - Epic Breakdown

## Overview

Single epic to refactor the short-03 video engine from a monolithic ShotRenderer (imported from short-01) into a plug-and-play slot-based architecture where no short imports from another short.

## Requirements Inventory

### Functional Requirements

FR1: Each visual feature (background, chibi, callout, diagram, etc.) must be a standalone slot component
FR2: A ShotFrame component must render an ordered array of slots for a given shot
FR3: A CameraSlot must wrap shot content with zoom/breathe/tilt/drift/focus/color effects
FR4: Each slot must read its own prop from ShotDef and return null if absent
FR5: Short-03 must render identically after migration (pixel-perfect regression)
FR6: useSafeCaptions hook must be extracted to a shared location
FR7: Types (ShotDef, BackgroundDef, etc.) must live in slots/types.ts, not in short-01
FR8: Each short must declare which slots it uses via an array

### Non-Functional Requirements

NFR1: No short ever imports from another short
NFR2: Adding a new visual feature = 1 new slot file + adding to SLOTS array (no edits to existing code)
NFR3: Editing a slot must not break shorts that don't use it
NFR4: Creating a new short requires only shots.ts + config + picking slots

### Additional Requirements

- Camera math (lines 83-149 of current ShotRenderer) must be extracted without changing the math
- Short-01 must continue working untouched during migration (parallel operation)
- Voice timeline (buildVoiceTimeline), caption remapping (remapCaptions), and audio engine stay in lib/ (already clean)
- Slot render order must match current ShotRenderer layer order to preserve visual stacking

### FR Coverage Map

| FR | Stories |
|----|---------|
| FR1 | 1.1 |
| FR2 | 1.2 |
| FR3 | 1.2 |
| FR4 | 1.1 |
| FR5 | 1.4 |
| FR6 | 1.1 |
| FR7 | 1.1 |
| FR8 | 1.3 |

## Epic List

- **Epic 1**: Slot-Based Engine Refactor

---

## Epic 1: Slot-Based Engine Refactor

**Goal:** Decouple short-03 from short-01's ShotRenderer by extracting visual features into independent slot components, so each part is plug-and-play and editable without breaking other shorts.

### Story 1.1: Extract Slots from Short-01 Components

As a video developer,
I want each visual feature extracted into its own slot file in `src/slots/`,
So that I can use, edit, or remove any feature without touching other features.

**Acceptance Criteria:**

**Given** short-01/components/ShotBackground.tsx exists
**When** I create slots/BackgroundSlot.tsx
**Then** it renders image/video/gradient/solid from `shot.background` and returns null if absent

**Given** short-01/components/VoiceSyncChibi.tsx exists
**When** I create slots/ChibiSlot.tsx
**Then** it renders the chibi character from `shot.chibiEmotion` with entrance/exit/expressions and returns null if no emotion set

**Given** short-01/components/DataCallout.tsx exists
**When** I create slots/CalloutSlot.tsx
**Then** it renders data callout from `shot.dataCallout` (and `shot.secondaryCallout`, `shot.callouts[]`) and returns null if absent

**Given** short-01/components/ArchitectureDiagram.tsx exists
**When** I create slots/DiagramSlot.tsx
**Then** it renders architecture diagram from `shot.architectureDiagram` and returns null if absent

**Given** short-01/components/ProjectDataCard.tsx exists
**When** I create slots/DataCardSlot.tsx
**Then** it renders CoinGecko-style card from `shot.projectDataCard` and returns null if absent

**Given** short-01/components/BrollMosaic.tsx exists
**When** I create slots/BrollSlot.tsx
**Then** it renders B-roll grid from `shot.brollMosaic` and returns null if absent

**Given** short-01/components/StablecoinCards.tsx, ProjectShowcase.tsx, FloatingCryptoLogos.tsx exist
**When** I create slots/StablecoinSlot.tsx, ShowcaseSlot.tsx, LogosSlot.tsx
**Then** each renders from its respective shot prop and returns null if absent

**Given** short-01/components/CinematicLetterbox.tsx exists
**When** I create slots/LetterboxSlot.tsx
**Then** it renders letterbox bars from `shot.letterbox` and returns null if absent

**Given** short-01/components/ShotTransition.tsx exists
**When** I create slots/TransitionSlot.tsx
**Then** it renders transition overlay from `shot.transitionIn` (when not "cut") and returns null for cuts

**Given** lib/components/Audio/SFXTrigger.tsx exists
**When** I create slots/SFXSlot.tsx
**Then** it triggers sound effects from `shot.sfx[]` and returns null if array is empty

**Given** useSafeCaptions is duplicated in every composition
**When** I create slots/hooks/useSafeCaptions.ts
**Then** it can be imported by any short composition without copy-paste

**Given** short-01/types.ts defines ShotDef and 35+ types
**When** I create slots/types.ts
**Then** it contains all shared types (ShotDef, BackgroundDef, ChibiEmotion, etc.) and short-01/types.ts can re-export from it for backwards compatibility

---

### Story 1.2: Create ShotFrame and CameraSlot

As a video developer,
I want a ShotFrame component that renders slots in order inside a CameraSlot wrapper,
So that shot rendering is composable and camera effects are shared.

**Acceptance Criteria:**

**Given** ShotRenderer lines 83-149 contain camera math (zoom, breathe, tilt, drift, vertDrift, focusPull, colorShift)
**When** I create slots/CameraSlot.tsx
**Then** it wraps children with the exact same transform/filter calculations
**And** the math produces identical output for all 6 camera effects

**Given** ShotRenderer renders 30+ conditional layers in fixed order
**When** I create slots/ShotFrame.tsx
**Then** it takes `shot` + `slots[]` array + context props (globalFrameOffset, captions, etc.)
**And** it wraps content in CameraSlot
**And** it renders each slot in array order, passing shot and context to each
**And** slots that return null produce no DOM nodes

**Given** a slot array `[BackgroundSlot, ChibiSlot, TransitionSlot]`
**When** ShotFrame renders with a shot that has background + chibiEmotion + transitionIn
**Then** all 3 slots render in order
**And** a shot missing chibiEmotion only renders BackgroundSlot + TransitionSlot

---

### Story 1.3: Rewire Short-03 to Use ShotFrame

As a video developer,
I want short-03 to use ShotFrame + picked slots instead of importing short-01's ShotRenderer,
So that short-03 has zero dependency on short-01.

**Acceptance Criteria:**

**Given** short-03/FebNewTop500Composition.tsx imports ShotRenderer from short-01
**When** I replace the import with ShotFrame from slots/
**Then** short-03 declares exactly these 12 slots: BackgroundSlot, DiagramSlot, BrollSlot, StablecoinSlot, ShowcaseSlot, LogosSlot, DataCardSlot, ChibiSlot, CalloutSlot, LetterboxSlot, SFXSlot, TransitionSlot
**And** no import references `../short-01/` anywhere in short-03

**Given** short-03/types.ts re-exports 35 types from short-01
**When** I change it to import from slots/types.ts
**Then** all type imports still resolve correctly
**And** short-03 has zero imports from short-01

**Given** short-03 uses ShortProvider from short-01/ShortContext.tsx
**When** I move ShortContext to slots/ (or keep a local copy)
**Then** the context provider works identically

**Given** short-03 uses useSafeCaptions (local copy in composition)
**When** I replace with import from slots/hooks/useSafeCaptions
**Then** caption loading works identically

---

### Story 1.4: Regression Test — Visual Parity

As a video developer,
I want to verify short-03 renders identically after the migration,
So that the refactor introduces zero visual regressions.

**Acceptance Criteria:**

**Given** short-03 rendered before migration (baseline)
**When** I render short-03 after migration using `npx remotion render Short03`
**Then** output video is visually identical to baseline

**Given** all 12 shots use camera effects (breathingPulse, fullScreenZoom, etc.)
**When** rendered through CameraSlot
**Then** zoom, breathe, tilt, drift, vertDrift, focusPull, and colorShift produce identical transforms

**Given** shots 6 and 11 show RejectedStamp overlay
**When** rendered after migration
**Then** stamp timing, spring animation, and screen shake are identical

**Given** ViralCaptions renders composition-level captions
**When** rendered after migration
**Then** phrase grouping, timing, and positioning are identical

**Given** voice runs produce no decoder clicks at shot boundaries
**When** rendered after migration
**Then** audio is identical (buildVoiceTimeline and getRunVolume unchanged)

---

### Story 1.5: Clean Up and Document

As a video developer,
I want the slots/ folder documented with a README and the old imports removed,
So that future shorts can be created quickly using the slot pattern.

**Acceptance Criteria:**

**Given** all slots are extracted and short-03 is migrated
**When** I check short-03's import graph
**Then** it imports from: slots/, lib/, and its own files only — never from short-01 or any other short

**Given** a developer wants to create short-05
**When** they look at slots/
**Then** each slot file is self-contained and its purpose is clear from the filename
**And** creating a new short requires: shots.ts + types.ts (COLORS) + composition.tsx with SLOTS array

**Given** short-01 still exists unchanged
**When** short-01 is rendered
**Then** it still works via its own ShotRenderer (untouched, parallel operation)
