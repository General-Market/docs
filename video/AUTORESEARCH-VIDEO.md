# Autoresearch — Video Replication Protocol

Autonomous loop for replicating motion design videos in Remotion + GSAP.

## How It Works

One agent per scene + one SFX agent. Each scene agent iteration:
1. Read reference frames visually
2. Read tracking data (GSAP format)
3. Read scene interpretation (intent/emotion/technique)
4. Modify the scene file
5. Render specific frames
6. Compare to reference visually + SSIM
7. Keep if better, revert if worse
8. Repeat

## Pre-Loop Setup (run once per video)

```bash
VIDEO="/path/to/video.mp4"
NAME="videoname"

# 1. Basic analysis
bash video/scripts/analyze-reference.sh "$VIDEO" /tmp/${NAME}-analysis

# 2. Deep analysis
python3 video/scripts/deep-analyze.py "$VIDEO" /tmp/${NAME}-deep --fps 2

# 3. Motion tracking (EasyOCR + RAFT)
python3 video/scripts/track-v3.py "$VIDEO" /tmp/${NAME}-tracks-v3 --fps 8

# 4. Convert to GSAP format
python3 video/scripts/track-to-gsap.py /tmp/${NAME}-tracks-v3

# 5. Scene interpretation (run agent that reads all frames)
python3 video/scripts/scene-interpret.py /tmp/${NAME}-analysis --deep /tmp/${NAME}-deep/summary.json

# 6. Split into scenes + generate compositions
bash video/scripts/split-scenes.sh /tmp/${NAME}-analysis 10
```

## Autoresearch Config (per scene)

```
/autoresearch
Goal: Replicate Scene NN of [VIDEO] in Remotion + GSAP until visually identical.

Each iteration:
1. Read 5+ reference frames from /tmp/NAME-analysis/scene_frames/scene_NN/
2. Read scene interpretation from /tmp/NAME-analysis/scene-interpretations-complete.json
3. Read GSAP timeline data from /tmp/NAME-tracks-v3/gsap-timeline.json
4. Modify video/src/compositions/replicate-NAME/SceneNN.tsx
5. Render frame, compare to reference, keep or revert

Animation engine: GSAP (import from ../../lib/useGsapTimeline)
- SplitText for per-letter text
- MotionPathPlugin for curved paths
- MorphSVGPlugin for SVG morphs
- GSAP easing: power2.out, back.out(1.7), expo.out, elastic.out(1, 0.3)

User feedback to incorporate:
- Text misplaced in first 8s — check exact positions from tracking data
- Phone has wrong 3D animations — check reference for exact perspective/rotation
- Missing text in some animations — verify all OCR-detected words are present
- Motion must be ORGANIC (bezier curves, noise wobble, velocity blur)

Scope: video/src/compositions/replicate-NAME/SceneNN.tsx
Metric: Multi-metric (SSIM + color + text + motion, 0-100)
Direction: Maximize
Verify: cd /Users/maxguillabert/Downloads/index/video && bash scripts/verify-scene-v2.sh CompID "/path/to/original.mp4" START DURATION /tmp/NAME-analysis 1
Guard: cd /Users/maxguillabert/Downloads/index/video && npx tsc --noEmit
```

## GSAP Integration

```tsx
import { useGsapTimeline } from "../../lib/useGsapTimeline";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

const { tl, containerRef, scopedTimeline } = useGsapTimeline();

useEffect(() => {
  scopedTimeline(() => {
    // All selector-based animations scoped to containerRef
    const split = new SplitText(".my-text", { type: "chars" });
    tl.current.from(split.chars, {
      opacity: 0, y: 50, rotation: -15,
      stagger: { each: 0.03, from: "center" },
      ease: "back.out(1.7)",
    });
  });
}, []);
```

## Tracking Data → GSAP

The `gsap-timeline.json` contains pre-computed animations:

```json
{
  "word": "Introducing",
  "time": 8.5,
  "gsap_from": { "opacity": 0, "y": -30, "x": 15 },
  "duration": 0.6,
  "ease": "expo.out",
  "has_rotation": true,
  "angle_range": [-3.2, 1.5]
}
```

Agents paste these directly as GSAP .from() calls.

## Verify Script (verify-scene-v2.sh)

6 metrics weighted:
| Metric | Weight | What |
|--------|--------|------|
| SSIM | 30% | Structural similarity |
| Keyframe SSIM | 25% | Timing-critical moments |
| Color | 15% | Exact color accuracy |
| Text | 15% | Right words at right time |
| Motion | 10% | Motion energy match |
| Duration | 5% | Length match |

Output: single score 0-100 + breakdown JSON showing weakest component.

## Iteration Strategy

| Iteration | Focus |
|-----------|-------|
| 1-3 | Structure: get all elements on screen, correct positions |
| 4-6 | Timing: frame-accurate entrances/exits using GSAP timeline |
| 7-9 | Easing: replace linear with tracked easing curves (expo.out, back.out) |
| 10-12 | Motion: add bezier paths from tracking, motion blur, noise wobble |
| 13-15 | Color: exact hex values, gradient angles, opacity curves |
| 16+ | Polish: sub-pixel, font rendering, SSIM-guided weak frame fixes |

## Key Lessons (from 50+ agent rounds)

1. **GSAP > interpolate()** for complex animation (SplitText, MorphSVG, MotionPath)
2. **Keep interpolate()/spring()** for simple opacity/position (less overhead)
3. **CoTracker3 FAILS** on motion graphics — use EasyOCR + RAFT tracker (track-v3.py)
4. **Scene interpretation** prevents mechanical animation — agents need to know the INTENT
5. **SSIM ceiling ~0.95** is font rendering / compression — declare scene DONE
6. **SSIM ceiling ~0.50** means CSS approximating 3D — use @remotion/three
7. **Screenshot compositing** breaks background ceilings — extract real frames for BG
8. **Max 5 concurrent agents** to avoid OOM and rate limits
9. **One render at a time** per agent (no parallel Chromium)
10. **Integer pixel rounding** (Math.round) eliminates sub-pixel jitter in holds
11. **Film grain must animate** — shift noise position per frame
12. **Spring damping 8-12** = visible overshoot, 16+ = too stiff
13. **Agents comment out imports** when they hit errors — always verify Root.tsx
14. **GSAP DOM mode FAILS in headless renders** — use GSAP proxy mode (animate JS objects, read in JSX) or stick with Remotion spring()/interpolate()
15. **GSAP proxy mode WORKS** — animate a plain JS object, read values in React styles (Scene04 pattern)
16. **For 2000+ line files, GSAP rewrite is too risky** — the file is too complex for a full rewrite. Fix specific segments instead
17. **GSAP seek(frame/fps)** syncs timeline to Remotion frame clock (only works with proxy mode)
15. **SplitText + stagger + "from edges"** = premium per-letter animation

## Orchestration — Main Chat Manages Sub-Agents

The main chat is the orchestrator. Sub-agents do the work. Never wait for all agents to finish before acting.

### Core rules:

1. **Launch 5 agents max** (one per scene). Each runs its own autoresearch loop autonomously.
2. **When any agent dies** (rate limit, OOM, crash) → **re-launch it immediately.** Don't wait for the others.
3. **When any agent completes** → check its SSIM score. If < 0.85, re-launch with specific feedback on what's weak. If > 0.85, move to next priority (Motionimo, Whop, or polish pass).
4. **When an agent plateaus** (>3 iterations with <0.5 point improvement) → kill it, re-launch with different strategy (e.g., "try Three.js instead of CSS for this element").
5. **Never block.** While agents run, the orchestrator can: check progress (`wc -l`, `stat`), fix TS errors that block all renders, update tracking data, prepare next video's analysis.

### Agent lifecycle:

```
LAUNCH → agent reads ref + renders + compares + fixes → loops autonomously
  │
  ├─ Agent dies (rate limit) → RE-LAUNCH with same prompt immediately
  ├─ Agent dies (OOM/crash) → RE-LAUNCH with --timeout increase or --scale=0.5
  ├─ Agent completes → CHECK SCORE → launch next priority or re-enter with feedback
  └─ Agent plateaus → KILL → re-launch with different approach
```

### Parallel slot management:

```
Slot 1: OF S01 loop ──dies──→ re-launch OF S01 ──completes──→ launch Motionimo S01
Slot 2: OF S02 loop ──dies──→ re-launch OF S02
Slot 3: OF S03 loop ──completes──→ launch OF S03 SSIM verify ──completes──→ launch Whop S01
Slot 4: OF S04 loop ──running──
Slot 5: OF S05 loop ──running──
```

Each slot is independent. A slot freed by completion or death gets the next highest-priority item from the queue. No slot ever sits idle waiting for other slots.

## SFX Agent (runs parallel to scene agents)

A dedicated agent handles sound effects. It runs as the 6th slot alongside the 5 scene agents.

### What the SFX agent does:
1. Extract audio from the reference video: `ffmpeg -i original.mp4 -vn -acodec pcm_s16le audio.wav`
2. Analyze audio for SFX timestamps: `python3 scripts/analyze_music.py audio.wav`
3. Identify each SFX type (whoosh, click, pop, transition sweep, impact)
4. Search for matching clean SFX: `python3 scripts/fetch_sfx.py "whoosh transition" 5`
5. If clean SFX not found online, generate: `python3 scripts/generate_music.py sfx "quick whoosh" -d 0.5`
6. Place SFX in `video/public/sfx/`
7. Add `<Audio>` components at the correct frame timestamps in the composition
8. Verify audio sync by rendering with audio

### SFX agent autoresearch loop:
```
/autoresearch
Goal: Extract and replicate all SFX from the reference video.

Each iteration:
1. Read audio analysis from /tmp/VIDEO-deep/summary.json (sfx_timestamps, beat_timestamps)
2. Listen to reference audio sections (extract clips with ffmpeg)
3. Find or generate matching SFX
4. Add <Audio src={staticFile("sfx/whoosh-01.wav")} /> at correct frame
5. Render with audio, compare to reference

Scope: video/src/compositions/replicate-VIDEO/*.tsx + video/public/sfx/
Verify: Compare audio waveform similarity at SFX timestamps
```

### Priority queue (what to launch next):

```
P0: Re-launch any dead agent (same scene, same loop)
P1: Scene with lowest SSIM score (needs most work)
P2: Scene from a different video that hasn't started yet
P3: Cross-cutting pass (motion blur, audio sync)
P4: Polish pass on scenes above 0.85
```

### Checking progress without blocking:

```bash
# Quick file size check (are agents writing code?)
for f in Scene0{1,2,3,4,5}.tsx; do wc -l < "$f"; done

# Recent modification (is agent alive?)
stat -f "%Sm" Scene01.tsx

# Total lines across all scenes
cat Scene0*.tsx | wc -l

# TypeScript health (are agents breaking things?)
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

Do these checks between notification bursts.

### Git push after every batch of completions:
```bash
git add video/src/compositions/replicate*/ video/src/lib/ video/scripts/
git commit -m "autoresearch: <summary of changes>"
git push mono main
```
Push after every 2-3 agent completions. Never let more than 30 minutes of work sit uncommitted. If TS errors appear, fix them from the main chat — unblocks ALL agents simultaneously.
