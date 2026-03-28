# Video Replication Process — Agent Playbook

Repeatable process for replicating any motion design video in Remotion. Follow these steps in order.

## Prerequisites

- ffmpeg, ImageMagick, Python 3.10+, PyTorch 2.8+, OpenCV, EasyOCR, pytesseract
- RAFT: built into torchvision (comes with PyTorch) — zero install
- Remotion project at `video/` with @remotion/three, @remotion/noise, @remotion/motion-blur installed

**Note:** CoTracker3 (Meta) does NOT work for motion graphics. It's trained on natural video and treats solid backgrounds as occluded. Don't waste time on it. Our v3 tracker (EasyOCR + RAFT + HSV) is the right tool.

## Step 1: Analyze the Reference Video

Run these scripts in order. Each captures different things.

```bash
VIDEO="/path/to/video.mp4"
NAME="videoname"

# 1. Basic analysis — scene cuts, palettes, motion intensity, audio, frame extraction
bash video/scripts/analyze-reference.sh "$VIDEO" /tmp/${NAME}-analysis

# 2. Deep analysis — 100+ data points per frame: edges, shadows, blur, effects, text OCR, layout
python3 video/scripts/deep-analyze.py "$VIDEO" /tmp/${NAME}-deep --fps 2

# 3. V3 tracker (BEST) — EasyOCR rotated text + RAFT dense flow + HSV color segmentation
#    This is the primary motion data source. Gives exact rotation angles, bezier curves, easing types.
python3 video/scripts/track-v3.py "$VIDEO" /tmp/${NAME}-tracks-v3 --fps 8

# 4. V3 per-scene with RAFT — run on busiest scenes for dense flow data
#    Replace START/END with scene timestamps from analysis.json
python3 video/scripts/track-v3.py "$VIDEO" /tmp/${NAME}-tracks-v3-sceneN --fps 5 --scene START END

# 5. V2 tracker — OCR text tracking, per-letter positions, contour shapes, perspective detection
python3 video/scripts/track-motion.py "$VIDEO" /tmp/${NAME}-tracks-v2 --fps 10

# 6. Frame-by-frame storyboard — every micro-animation between consecutive frames
python3 video/scripts/storyboard.py "$VIDEO" /tmp/${NAME}-storyboard --skip 2
```

### What each analysis produces

| Script | Output | Key data for agents |
|--------|--------|-------------------|
| `analyze-reference.sh` | `analysis.json`, `scene_frames/`, `palettes/` | Scene boundaries, timing, color palette, composition dimensions |
| `deep-analyze.py` | `deep-analysis.json`, `summary.json` | Shader list, audio beats, text content per scene, shadows, blur, effects |
| `track-v3.py` | `text-tracks.json`, `raft-flow.json`, `remotion-text-keyframes.json` | **Rotated text boxes with exact angles**, RAFT motion hotspots, easing curves, bezier paths, Remotion interpolate() arrays |
| `track-motion.py` | `text-tracks.json`, `letter-tracks.json`, `perspective.json`, `trajectories.json` | Per-word/letter positions, contour shape trajectories, 3D perspective frames, rotation detection |
| `storyboard.py` | `storyboard.json`, `animation-sequences.json` | Micro-animations between frames, transition types, element entrances/exits |

### V3 tracker — what makes it better

| Feature | V2 (pytesseract + contours) | V3 (EasyOCR + RAFT + HSV) |
|---------|---------------------------|--------------------------|
| Text detection | Axis-aligned boxes only | **Rotated boxes with exact angles** |
| Rotation detection | Via contours only | **Per-text-element angles** (43/139 elements had rotation on OF) |
| Optical flow | OpenCV Farneback (basic) | **RAFT deep learning** (sub-pixel accuracy) |
| Motion hot spots | None | **Per-region motion centers from RAFT** |
| Color tracking | None | **HSV segmentation per color group** |
| Angle output | Contour minAreaRect only | **EasyOCR rotated bbox + RAFT direction vectors** |
| Remotion output | Position only | **Position + angle interpolation arrays** |

### What does NOT work for motion graphics

- **CoTracker3** — visibility model fails (0.2% visibility on clean backgrounds)
- **SAM2** — needs real objects with texture, not geometric shapes
- **OpenCV goodFeaturesToTrack** — needs texture, returns 0 points on solid blue

## Step 2: Create Composition Structure

```bash
# Auto-split into per-scene Remotion compositions
bash video/scripts/split-scenes.sh /tmp/${NAME}-analysis 10

# OR manually create in: video/src/compositions/replicate-${NAME}/
```

### File structure per video

```
video/src/compositions/replicate-${NAME}/
├── ${Name}ReplicateComposition.tsx  — Master (sequences all scenes)
├── Scene01.tsx                      — Independent scene file
├── Scene02.tsx
├── ...
└── SceneNN.tsx
```

Register in `video/src/Root.tsx`:
```tsx
import { nameMeta, nameSceneMetas } from "./compositions/replicate-name/NameReplicateComposition";

// In RemotionRoot:
<Composition id={nameMeta.id} component={nameMeta.component} ... />
<Folder name="Name-Scenes">
  {nameSceneMetas.map((meta) => (
    <Composition key={meta.id} id={meta.id} component={meta.component} ... />
  ))}
</Folder>
```

## Step 3: Launch Parallel Agents (Round 1)

One agent per scene. Max 10-14 agents at a time.

### Agent prompt template (Round 1 — Structure)

```
Replicate Scene NN of [VIDEO NAME] in Remotion.

Your file: video/src/compositions/replicate-VIDEONAME/SceneNN.tsx
Composition ID: VideoSceneNN ([width]x[height], [fps]fps, [frames] frames)

Reference frames: /tmp/VIDEONAME-analysis/scene_frames/scene_NN/
Deep analysis: /tmp/VIDEONAME-deep/summary.json (scene N)

READ ALL reference frames first. Then build the Remotion equivalent.
Render frames and compare visually. Iterate at least 10 times.
One render at a time. --timeout=90000.
```

## Step 4: Progressive Rounds (2-10+)

Each round feeds deeper data. **Never recycle the same data — each round must add something new.**

| Round | New data fed | Focus |
|-------|-------------|-------|
| 1 | Basic analysis + frames | Structure: layout, elements, backgrounds |
| 2 | + Deep analysis | Colors (#exact hex), shadows, glass effects, springs |
| 3 | + Storyboard | Micro-animations, card staggers, transition types |
| 4 | + V3 text tracks (rotated) | Text easing curves, **exact rotation angles**, bezier paths |
| 5 | + RAFT flow data | Dense motion vectors, motion blur amounts per region |
| 6 | + V2 letter tracks | Per-character animation, font size changes |
| 7 | SSIM measurement | Fix weakest frames (data-driven) |
| 8 | Re-analyze weak scenes (higher FPS) | Ultra-detail on problem areas |
| 9 | Screenshot compositing | Extract real frames for unreproducible content |
| 10+ | Final polish | Sub-pixel, integer rounding, golden render |

### Agent prompt template (Round 4+ — Motion Data)

```
ROUND N of Scene NN. Now using V3 motion tracking data.

NEW DATA:
- /tmp/VIDEONAME-tracks-v3/text-tracks.json — per-word positions with ROTATION ANGLES
- /tmp/VIDEONAME-tracks-v3/remotion-text-keyframes.json — copy-paste interpolate() code
- /tmp/VIDEONAME-tracks-v3/raft-flow.json — dense flow showing WHERE things move fast

For each text element, the data contains:
  - "angle_range": [-7.2, 12.5] ← the text rotates between these angles
  - "x_easing": "ease_out_expo" ← how it moves horizontally
  - "y_easing": "ease_in" ← how it moves vertically
  - "bezier": {...} ← fitted curve with control points
  - "code_x": "interpolate(frame, [...], [...])" ← paste directly into Remotion

USE THESE EXACT CURVES. Don't guess linear paths.

CRITICAL RULES:
- All motion must be ORGANIC (bezier curves, not linear interpolate)
- All fast elements need velocity-proportional motion blur
- Use noise2D from @remotion/noise for wobble on all positions
- Use spring() with low damping for bouncy entrances
- Rotation angles are NON-AXIS-ALIGNED (12°, -7°, 23°, not 0/45/90)
```

## Step 5: SSIM Verification

After round 6+, measure SSIM to guide remaining work:

```bash
# Render scene to MP4
npx remotion render src/index.ts VideoSceneNN --output=/tmp/scene_verify.mp4 --codec h264 --timeout=180000

# Extract reference clip
ffmpeg -ss START -t DURATION -i /path/to/original.mp4 /tmp/ref_clip.mp4 -y

# Compute SSIM
ffmpeg -i /tmp/ref_clip.mp4 -i /tmp/scene_verify.mp4 -lavfi ssim -f null - 2>&1 | grep "All:"
```

### SSIM targets

| Score | Meaning | Action |
|-------|---------|--------|
| < 0.5 | Wrong structure | Fix layout, missing elements |
| 0.5-0.7 | Recognizable but off | Fix timing, colors, sizes |
| 0.7-0.85 | Good, needs polish | Fix easing, shadows, transitions |
| 0.85-0.92 | Close | Micro-adjustments, font rendering |
| 0.92-0.95 | Very close | Sub-pixel, font weight |
| > 0.95 | **Done** | Golden render |

### SSIM ceiling causes + fixes

| Ceiling | Cause | Fix |
|---------|-------|-----|
| ~0.50 | CSS approximating 3D | @remotion/three (ThreeCanvas + real geometry) |
| ~0.75 | Photographic content as gradients | Extract reference frames, composite with staticFile() |
| ~0.88 | Synthetic background vs real screenshot | Blur reference frame as background |
| ~0.93 | Font rendering differences | Try weight 500 vs 400, textRendering: geometricPrecision |
| ~0.95 | Compression artifacts | **Wall. Scene is done.** |

## Key Rules for All Agents

### Motion MUST be organic
```tsx
// BAD
transform: `translateX(${interpolate(frame, [0, 30], [100, 0])}px)`

// GOOD — quadratic bezier
const t = interpolate(frame, [0, 30], [0, 1]);
const x = (1-t)*(1-t)*startX + 2*(1-t)*t*controlX + t*t*endX;
const y = (1-t)*(1-t)*startY + 2*(1-t)*t*controlY + t*t*endY;
```

### Motion blur on fast elements
```tsx
const velocity = Math.abs(currentPos - prevPos);
style={{ filter: `blur(${Math.min(velocity * 0.2, 6)}px)` }}
```

### CameraMotionBlur for fast segments
```tsx
import { CameraMotionBlur } from "@remotion/motion-blur";
<CameraMotionBlur samples={6} shutterAngle={100}>
  <FastElement />
</CameraMotionBlur>
```

### Noise wobble on everything
```tsx
import { noise2D } from "@remotion/noise";
const wobbleX = noise2D("x", frame * 0.02, 0) * 5;
```

### GSAP is the primary animation engine

GSAP 3.14 is installed with ALL plugins (free since 2024). Use it for everything complex.

```tsx
// GSAP + Remotion integration (syncs GSAP timeline to Remotion frame clock)
import { useGsapTimeline, disintegrateText, morphSVG } from "../../lib/useGsapTimeline";

const { tl, containerRef } = useGsapTimeline();

useEffect(() => {
  if (!containerRef.current) return;

  // Per-letter text animation (SplitText)
  const split = new SplitText(".my-text", { type: "chars,words" });
  tl.current.from(split.chars, {
    opacity: 0, y: 50, rotation: -15, scale: 0.5,
    stagger: { each: 0.03, from: "center" },
    ease: "back.out(1.7)", duration: 0.6,
  });

  // SVG morph (MorphSVGPlugin)
  tl.current.to("#sparkle-path", {
    morphSVG: "#google-g-path",
    duration: 1, ease: "power2.inOut",
  }, "+=0.5");

  // Element follows bezier curve (MotionPathPlugin)
  tl.current.to(".phone", {
    motionPath: {
      path: [{ x: 0, y: 200 }, { x: -100, y: 100 }, { x: 0, y: 0 }],
      curviness: 1.5, autoRotate: true,
    },
    duration: 0.8, ease: "power2.out",
  }, 1.0);

  // Text disintegration (Bard death)
  disintegrateText(tl.current, ".bard-text", { delay: 1.5, spread: 200 });
}, []);

return <div ref={containerRef}>...</div>;
```

**When to use GSAP vs Remotion primitives:**

| Use GSAP for | Use interpolate()/spring() for |
|-------------|-------------------------------|
| Per-letter text animation (SplitText) | Simple opacity fade |
| SVG morphing (MorphSVGPlugin) | Basic position slide |
| Bezier motion paths (MotionPathPlugin) | Spring bounce entrance |
| Complex timeline sequencing | Single-property animation |
| Text disintegration/particle effects | Color interpolation |
| Staggered multi-element choreography | Scale/rotation basics |

**Converting tracking data to GSAP:**
```bash
python3 scripts/track-to-gsap.py /tmp/VIDEO-tracks-v3
# Outputs: gsap-timeline.json + gsap-timeline-code.ts
# Contains: GSAP .from() calls with correct easing, MotionPath arrays
```

### Also useful
```tsx
// Page curl — GLSL shader (gl-transitions/InvertedPageCurl.glsl)
// SVG path morph — @remotion/paths interpolatePath() (simpler than GSAP for basic morphs)
// 3D geometry — @remotion/three ThreeCanvas (glass, tubes, metallic)
```

### Three.js for real 3D
```tsx
import { ThreeCanvas } from "@remotion/three";
<ThreeCanvas>
  <mesh>
    <tubeGeometry args={[curve, 64, 0.3, 8, false]} />
    <meshPhysicalMaterial transmission={0.6} roughness={0.1} />
  </mesh>
</ThreeCanvas>
```

### Screenshot compositing for unreproducible content
```bash
ffmpeg -y -i original.mp4 -vf "select=eq(n\,FRAME)" -vsync vfr video/public/ref-bg.png
```
```tsx
<Img src={staticFile("ref-bg.png")} style={{ filter: "blur(8px)" }} />
```

## Analysis Scripts Reference

| Script | What | Best for |
|--------|------|----------|
| `analyze-reference.sh` | Basic: scenes, palettes, audio | Scene setup, composition config |
| `deep-analyze.py` | 100+ pts/frame: shadows, effects, text | Shader requirements, effect detection |
| `track-v3.py` | **EasyOCR rotated text + RAFT flow** | **Primary motion data — rotation angles, bezier curves, easing** |
| `track-motion.py` | OCR + contours + perspective | Per-letter tracking, 3D frame detection |
| `storyboard.py` | Frame-by-frame diffs | Micro-animations, transition detection |
| `verify-scene-v2.sh` | **Multi-metric verify (SSIM + color + text + motion)** | **Autoresearch verify command** |
| `verify-replication.sh` | Basic SSIM comparison (legacy) | Quick score check |
| `scene-interpret.py` | AI scene interpretation (intent, emotion, technique) | Context for agents |
| `split-scenes.sh` | Scene splitting | Per-scene compositions |
| `track-cotracker.py` | CoTracker3 (DO NOT USE for motion graphics) | Only for natural video with textured objects |

## Autoresearch Config — Full Pipeline

The verify-scene-v2.sh uses 6 metrics instead of just SSIM:

| Metric | Weight | What it catches |
|--------|--------|----------------|
| SSIM | 30% | Overall structural similarity |
| Keyframe SSIM | 25% | Timing-critical moments (scene changes) |
| Color match | 15% | Exact color accuracy per frame |
| Text match | 15% | Are the right words on screen at the right time? |
| Motion intensity | 10% | Does the motion energy match the reference? |
| Duration | 5% | Length match |

### Ready-to-paste autoresearch config (per scene)

```
/autoresearch
Goal: Replicate Scene NN of [VIDEO] in Remotion until all metrics converge.

AGENT INSTRUCTIONS — read EVERY iteration:

1. READ the scene interpretation: /tmp/VIDEO-analysis/scene-interpretations-complete.json
   This tells you the INTENT, EMOTION, and TECHNIQUES of the scene. Don't just match pixels — match the FEELING.

2. READ motion tracking data: /tmp/VIDEO-tracks-v3/text-tracks.json
   This has EXACT rotation angles, bezier paths, easing curves for every text element.
   Use the "remotion-text-keyframes.json" — it has paste-ready interpolate() code.

3. READ RAFT flow data: /tmp/VIDEO-tracks-v3-sceneN/raft-flow.json
   This shows WHERE things move fast (hot spots) and in WHAT DIRECTION.

4. After each verify, READ the breakdown: /tmp/VIDEO-analysis/verify-breakdown-CompID.json
   Fix the WEAKEST metric first:
   - Low ssim → wrong layout, missing elements
   - Low keyframe_ssim → timing off
   - Low color → wrong hex values
   - Low text_match → missing text or wrong content
   - Low motion → animation too static or too fast

5. All motion MUST use bezier curves from the tracking data. No linear interpolate().
6. All fast elements need velocity-proportional motion blur.
7. Use noise2D wobble on everything.
8. DO NOT STOP until score > 85 or interrupted.

Scope: video/src/compositions/replicate-VIDEO/SceneNN.tsx
Metric: Multi-metric score (0-100, higher is better)
Direction: Maximize
Verify: cd /Users/maxguillabert/Downloads/index/video && bash scripts/verify-scene-v2.sh CompSceneNN "/path/to/original.mp4" START DURATION /tmp/VIDEO-analysis 1
Guard: cd /Users/maxguillabert/Downloads/index/video && npx tsc --noEmit
```

### Agent wave organization (for full rewrites)

After the code audit identifies KEEP / FIX / REWRITE segments:

```
WAVE 1 — REWRITE agents (one per REWRITE segment, full rebuild)
  Each gets: scene interpretation + v3 tracks + RAFT flow + reference frames
  Goal: build correct structure from scratch using all data layers

WAVE 2 — FIX agents (one per NEEDS_FIX segment, scoped edits)
  Each gets: current code + specific gap description + tracking data
  Goal: fix motion curves, timing, colors without breaking structure

WAVE 3 — VERIFY agents (one per scene, SSIM measurement)
  Each gets: verify-scene-v2.sh output
  Goal: data-driven fixes on weakest metrics

WAVE 4 — POLISH agents (cross-scene)
  Motion blur pass, audio sync, transition smoothing
  Goal: push all scenes above 85
```

Multiple agents CAN work on the same file if they touch different <Sequence> blocks (different frame ranges). The audit JSON maps which frames each agent owns.

## Parallelism Rules

- Max **10-14 agents** at a time (avoid OOM from concurrent Chromium)
- **One Remotion render per agent** at a time (no parallel `npx remotion still`)
- `--timeout=90000` for 720p, `--timeout=120000` for 4K
- `--scale=0.5` for 4K during iteration (full res for final only)
- Exit code 144 = OOM kill → reduce concurrent agents
- Exit code 137 = killed → same, too many processes

## Lessons Learned

1. **CoTracker3 fails on motion graphics** — trained on natural video, treats clean backgrounds as occluded
2. **EasyOCR >> pytesseract** for rotation — gives rotated bounding boxes with exact angles
3. **RAFT >> OpenCV Farneback** for optical flow — deep learning catches sub-pixel motion
4. **CSS can't replicate 3D** — use @remotion/three for glass, tubes, metallic materials
5. **Screenshot compositing** breaks SSIM ceilings — extract real frames for backgrounds
6. **Agents comment out imports** when they hit compile errors — always check Root.tsx imports
7. **18+ concurrent agents** will hit rate limits — cap at 14
8. **Film grain must animate** — shift noise position per frame, not static overlay
9. **Spring damping 8-12** gives visible overshoot — damping 16+ looks too stiff
10. **Integer pixel rounding** eliminates sub-pixel jitter in static holds
