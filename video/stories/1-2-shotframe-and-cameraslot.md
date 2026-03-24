# Story 1.2: Create ShotFrame and CameraSlot

Status: done

## Story

As a video developer,
I want a ShotFrame component that renders slots in order inside a CameraSlot wrapper,
so that shot rendering is composable and camera effects are shared without duplicating math.

## Acceptance Criteria

1. **CameraSlot wraps children with 6 camera effects** — zoom drift, breathing pulse, camera tilt, horizontal drift, vertical drift, focus pull, color temperature shift — producing identical CSS transform/filter to current ShotRenderer lines 83-149
2. **CameraSlot reads all camera props from ShotDef** — `fullScreenZoom`, `breathingPulse`, `cameraTilt`, `cameraDrift`, `cameraVerticalDrift`, `focusPull`, `colorShift` — and returns bare `<AbsoluteFill>{children}</AbsoluteFill>` when none are set
3. **ShotFrame takes shot + slots[] + context** — renders CameraSlot wrapping each slot in array order
4. **Slots that return null produce no DOM nodes** — ShotFrame doesn't add wrappers around individual slots
5. **ShotFrame passes SlotProps to every slot** — shot, globalFrameOffset, captions, prevShotEmotion, nextShotEmotion, prevProjectTicker, voiceSegments
6. **Render order matches current ShotRenderer** — background first (z-back), transitions last (z-front)
7. **backgroundColor applied** — CameraSlot or ShotFrame sets `backgroundColor` from a `bgColor` prop (default `#0A0A0A`) on the outer AbsoluteFill
8. **`tsc --noEmit` passes** after adding both files

## Tasks / Subtasks

- [x] Task 1: Create `src/slots/CameraSlot.tsx` (AC: #1, #2, #7)
  - [x] Extract camera math from ShotRenderer lines 82-149 (exact copy, no refactoring)
  - [x] Props: `{ shot: ShotDef; bgColor?: string; children: React.ReactNode }`
  - [x] Compute `durationFrames` from `secondsToFrame(shot.durationSeconds)`
  - [x] Effect 1 — Zoom drift: `interpolate(frame, [0, dur], "in" ? [1, 1.05] : [1.05, 1], clamp)` when `shot.fullScreenZoom` set
  - [x] Effect 2 — Breathing pulse: `1 + 0.015 * Math.sin((frame / 30) * Math.PI * 2 * 0.5)` when `shot.breathingPulse` set
  - [x] Effect 3 — Camera tilt: `interpolate(frame, [0, dur], "cw" ? [0, 0.5] : [0, -0.5], clamp)` when `shot.cameraTilt` set
  - [x] Effect 4 — Horizontal drift: `interpolate(frame, [0, dur], "right" ? [-10, 10] : [10, -10], clamp)` when `shot.cameraDrift` set
  - [x] Effect 4b — Vertical drift: `interpolate(frame, [0, dur], "down" ? [-80, 0] : [0, -80], clamp)` when `shot.cameraVerticalDrift` set
  - [x] Effect 5 — Focus pull: `interpolate(frame, [0, dur*0.4], "sharpen" ? [2, 0] : [0, 2], clamp)` when `shot.focusPull` set
  - [x] Effect 6 — Color shift: sepia + hue-rotate blend, `warmAmount` from `shot.colorShift` direction
  - [x] Build combined transform: `scale(${fsScale * breathScale}) rotate(${tiltDeg}deg) translateX(${driftPx}px) translateY(${vertDriftPx}px)`
  - [x] Build combined filter: `blur(${focusBlur}px) sepia(${warmAmount * 0.15}) hue-rotate(${warmAmount * -10}deg)`
  - [x] Render: `<AbsoluteFill style={{ backgroundColor: bgColor, transform, filter }}>{children}</AbsoluteFill>`
  - [x] When NO camera props set: still renders `<AbsoluteFill style={{ backgroundColor: bgColor }}>{children}</AbsoluteFill>` (pass-through)

- [x] Task 2: Create `src/slots/ShotFrame.tsx` (AC: #3, #4, #5, #6)
  - [x] Props interface:
    ```typescript
    interface ShotFrameProps {
      shot: ShotDef;
      slots: React.FC<SlotProps>[];
      globalFrameOffset: number;
      captions?: Caption[];
      prevShotEmotion?: string;
      nextShotEmotion?: string;
      prevProjectTicker?: string;
      voiceSegments?: VoiceSegment[];
      bgColor?: string;
    }
    ```
  - [x] Build `slotProps: SlotProps` from props (shot, globalFrameOffset, captions, prevShotEmotion, nextShotEmotion, prevProjectTicker, voiceSegments)
  - [x] Render: `<CameraSlot shot={shot} bgColor={bgColor}>{slots.map((Slot, i) => <Slot key={i} {...slotProps} />)}</CameraSlot>`
  - [x] No extra `<div>` or `<AbsoluteFill>` around each slot — just the component directly
  - [x] Slots returning null = zero DOM output for that slot

- [x] Task 3: Export from barrel (AC: #8)
  - [x] Add `export { CameraSlot } from "./CameraSlot"` to `src/slots/index.ts`
  - [x] Add `export { ShotFrame } from "./ShotFrame"` to `src/slots/index.ts`

- [x] Task 4: Type check (AC: #8)
  - [x] Run `npx tsc --noEmit` — zero errors

## Dev Notes

### Exact Camera Math (Copy From ShotRenderer lines 82-149)

```typescript
const frame = useCurrentFrame();
const durationFrames = secondsToFrame(shot.durationSeconds);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// 1. Zoom drift (1.0 ↔ 1.05)
const fsScale = shot.fullScreenZoom
  ? interpolate(frame, [0, durationFrames], shot.fullScreenZoom === "in" ? [1, 1.05] : [1.05, 1], clamp)
  : 1;

// 2. Breathing pulse — sinusoidal micro-scale (~2s period)
const breathScale = shot.breathingPulse
  ? 1 + 0.015 * Math.sin((frame / 30) * Math.PI * 2 * 0.5)
  : 1;

// 3. Camera tilt (0 → ±0.5°)
const tiltDeg = shot.cameraTilt
  ? interpolate(frame, [0, durationFrames], shot.cameraTilt === "cw" ? [0, 0.5] : [0, -0.5], clamp)
  : 0;

// 4. Camera drift (±10px)
const driftPx = shot.cameraDrift
  ? interpolate(frame, [0, durationFrames], shot.cameraDrift === "right" ? [-10, 10] : [10, -10], clamp)
  : 0;

// 4b. Camera vertical drift (±80px)
const vertDriftPx = shot.cameraVerticalDrift
  ? interpolate(frame, [0, durationFrames], shot.cameraVerticalDrift === "down" ? [-80, 0] : [0, -80], clamp)
  : 0;

// 5. Focus pull (blur 2px ↔ 0px over first 40%)
const focusBlur = shot.focusPull
  ? interpolate(frame, [0, durationFrames * 0.4], shot.focusPull === "sharpen" ? [2, 0] : [0, 2], clamp)
  : 0;

// 6. Color temperature shift
const colorProgress = shot.colorShift
  ? interpolate(frame, [0, durationFrames], [0, 1], clamp)
  : 0;
const warmAmount = shot.colorShift
  ? shot.colorShift === "cool-to-warm" ? colorProgress : 1 - colorProgress
  : 0;

// Build combined transform
const transforms: string[] = [];
const combinedScale = fsScale * breathScale;
if (combinedScale !== 1) transforms.push(`scale(${combinedScale})`);
if (tiltDeg !== 0) transforms.push(`rotate(${tiltDeg}deg)`);
if (driftPx !== 0) transforms.push(`translateX(${driftPx}px)`);
if (vertDriftPx !== 0) transforms.push(`translateY(${vertDriftPx}px)`);

// Build combined filter
const filters: string[] = [];
if (focusBlur > 0.01) filters.push(`blur(${focusBlur}px)`);
if (warmAmount > 0.01) {
  filters.push(`sepia(${warmAmount * 0.15})`);
  filters.push(`hue-rotate(${warmAmount * -10}deg)`);
}
```

**Copy this exactly. Do not refactor, rename, or "improve" the math.**

### ShotFrame Is Intentionally Simple

ShotFrame should be ~20 lines. It's a thin orchestrator:

```typescript
export const ShotFrame: React.FC<ShotFrameProps> = ({
  shot, slots, globalFrameOffset, captions,
  prevShotEmotion, nextShotEmotion, prevProjectTicker, voiceSegments,
  bgColor,
}) => {
  const slotProps: SlotProps = {
    shot, globalFrameOffset, captions,
    prevShotEmotion, nextShotEmotion, prevProjectTicker, voiceSegments,
  };

  return (
    <CameraSlot shot={shot} bgColor={bgColor}>
      {slots.map((Slot, i) => (
        <Slot key={i} {...slotProps} />
      ))}
    </CameraSlot>
  );
};
```

### Dependencies

- `useCurrentFrame` from remotion (for CameraSlot)
- `interpolate` from remotion (for CameraSlot)
- `AbsoluteFill` from remotion (for CameraSlot)
- `secondsToFrame` from `../../lib/utils/frameConvert` (for CameraSlot)
- `ShotDef`, `SlotProps`, `VoiceSegment` from `./types` (for both)
- `Caption` from `../../lib/types` (for ShotFrame)

### Previous Story Learnings (from 1.1)

- SlotProps interface already exists in `slots/types.ts` (line 401-409)
- Barrel export at `slots/index.ts` — add CameraSlot and ShotFrame
- `tsc --noEmit` is the validation gate
- No short-01 files should be touched

### What NOT To Do

- **DO NOT refactor the camera math** — copy it verbatim from ShotRenderer
- **DO NOT add new camera effects** — this is extraction only
- **DO NOT wrap individual slots in extra divs** — let each slot manage its own layout
- **DO NOT make CameraSlot depend on any slot** — it's pure math + wrapper
- **DO NOT use React.memo or useMemo on slots** — keep it simple, Remotion re-renders every frame anyway

### Project Structure Notes

After this story, `src/slots/` will contain:
```
src/slots/
├── index.ts           ← updated: +CameraSlot, +ShotFrame exports
├── types.ts           ← unchanged (SlotProps already defined)
├── CameraSlot.tsx     ← NEW
├── ShotFrame.tsx      ← NEW
├── BackgroundSlot.tsx ← from story 1.1
├── ChibiSlot.tsx      ← from story 1.1
├── ... (10 more slots from story 1.1)
├── hooks/
├── components/
└── data/
```

### References

- [Source: ShotRenderer.tsx lines 82-149 — camera math to extract]
- [Source: ARCHITECTURE.md — "How ShotFrame Replaces ShotRenderer" section]
- [Source: EPIC.md — Story 1.2 acceptance criteria]
- [Source: slots/types.ts line 401-409 — SlotProps interface]
- [Source: stories/1-1-extract-slots.md — previous story completion notes]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- `tsc --noEmit` passed with zero errors after creating CameraSlot.tsx, ShotFrame.tsx, and updating barrel export

### Completion Notes List
- CameraSlot.tsx: verbatim extraction of camera math from ShotRenderer lines 82-149, all 6 effects (zoom drift, breathing pulse, camera tilt, horizontal drift, vertical drift, focus pull, color shift), combined transform/filter strings, bgColor prop with #0A0A0A default
- ShotFrame.tsx: thin orchestrator (~45 lines), builds SlotProps from props, renders CameraSlot wrapping slots.map with no extra wrappers, slots returning null produce zero DOM
- Barrel export updated with CameraSlot and ShotFrame exports
- No short-01 files modified
- No refactoring of camera math — exact copy per story constraints

### File List
- `src/slots/CameraSlot.tsx` — NEW: camera effects wrapper (6 effects, verbatim from ShotRenderer)
- `src/slots/ShotFrame.tsx` — NEW: slot orchestrator (CameraSlot + slots.map)
- `src/slots/index.ts` — MODIFIED: added CameraSlot and ShotFrame exports

## Senior Developer Review (AI)

**Reviewer:** Code Review Workflow (adversarial)
**Date:** 2026-02-17
**Outcome:** Approved with fixes applied

### Issues Found: 1 High, 2 Medium, 2 Low

#### Fixed (3 issues):
- **[H1] FIXED** — BackgroundSlot `durationFrames` defaulted to 90 when rendered through ShotFrame (SlotProps doesn't include durationFrames). Removed prop, now computes `Math.round(shot.durationSeconds * LAYOUT.FPS)` internally — consistent with ChibiSlot and LetterboxSlot.
- **[M1] FIXED** — ShotFrameProps and CameraSlotProps were not exported. Added `export` keyword to both interfaces and re-exported types from barrel.
- **[M2] FIXED** — Barrel export comment said "all 12 slots" but now has 14 exports. Updated to "12 slots + CameraSlot + ShotFrame + types + hooks".

#### Noted (not fixed — low severity):
- **[L1]** ShotFrame uses `key={i}` for slot array. Acceptable since array is static, matches Dev Notes spec. Could use `Slot.displayName` for better DevTools.
- **[L2]** Completion Notes say "~45 lines" for ShotFrame, actual is 47. Trivial.

### Verification
- `tsc --noEmit` passes clean after all fixes
- Camera math verified verbatim against ShotRenderer lines 82-149
- All 8 ACs confirmed implemented
- All 4 tasks confirmed complete

## Change Log
- 2026-02-17: Story 1.2 implemented — CameraSlot (6 camera effects extracted from ShotRenderer) and ShotFrame (slot orchestrator) created. Barrel export updated. All tasks complete. `tsc --noEmit` passes.
- 2026-02-17: Code review — fixed BackgroundSlot durationFrames default (H1), exported ShotFrameProps/CameraSlotProps (M1), updated barrel comment (M2). `tsc --noEmit` passes. Status → done.
