# Animation Replication System

Replicate any motion design video in Remotion using autoresearch-driven iteration.

## Quick Start

```bash
# 1. Analyze the reference video
./scripts/analyze-reference.sh /path/to/reference.mp4

# 2. Read the analysis, update ReplicateComposition.tsx with correct dimensions/fps/duration
#    from analysis.json → remotion_config

# 3. Run autoresearch
/autoresearch
Goal: Replicate reference.mp4 — match layout, timing, easing, color frame-by-frame
Scope: video/src/compositions/replicate/**/*.tsx
Metric: Weighted SSIM (0-100, higher is better)
Verify: bash video/scripts/verify-replication.sh /path/to/reference.mp4 Replicate /path/to/reference-analysis
Guard: cd video && npx tsc --noEmit
```

## How It Works

### Phase 0: Analysis (once, before loop)

`analyze-reference.sh` extracts from the reference MP4:

| Output | What | Used For |
|--------|------|----------|
| `analysis.json` | Dimensions, fps, duration, scene timestamps, keyframe list | Configuring Remotion composition + verify keyframes |
| `frames/` | Every 0.5s as PNG | Visual reference during iteration |
| `scenes/` | Before/at/after each scene change | Understanding transitions |
| `palettes/` | Dominant colors per scene | Matching color palette |
| `palettes.json` | Hex colors + distribution per scene | Programmatic color matching |
| `motion.json` | Motion intensity timeline | Understanding pacing |
| `histograms.json` | Per-frame brightness/saturation | Matching overall feel |

### Phase 1-N: Autoresearch Loop

Each iteration:

1. **Read** reference frames + analysis data
2. **Modify** `ReplicateComposition.tsx` (or scene components it imports)
3. **Render** via Remotion CLI
4. **Compare** rendered output to reference via weighted SSIM
5. **Keep** if score improved, **discard** if not

### Verify Script Scoring

`verify-replication.sh` outputs `SCORE: N` where N is 0-100:

| Component | Weight | Measures |
|-----------|--------|----------|
| Video SSIM | 40% | Overall structural similarity across all frames |
| Keyframe SSIM | 35% | Similarity at critical moments (scene changes, checkpoints) |
| Color match | 15% | Mean color distance at 10 sample points |
| Duration match | 10% | How close the durations are (ratio) |

### Iteration Strategy

The autoresearch agent should attack dimensions sequentially, not all at once:

| Pass | Focus | What Changes |
|------|-------|-------------|
| 1-3 | **Structure** | Get elements on screen, rough positions, background colors |
| 4-6 | **Timing** | Frame-accurate scene changes, element entrances/exits |
| 7-9 | **Easing** | Spring constants, overshoot, ease curves, velocity matching |
| 10-12 | **Color** | Exact hex values, gradients, opacity, shadows |
| 13+ | **Polish** | Blur, glow, secondary motion, sub-pixel adjustments |

### Expected Score Progression

| Score | Meaning |
|-------|---------|
| 0-20 | Wrong dimensions, blank screen, or compile error |
| 20-40 | Right size, some elements present, wrong positions/timing |
| 40-60 | Recognizable layout, major timing correct, colors off |
| 60-75 | Good structure, most timing right, easing needs work |
| 75-85 | Close match, fine-tuning easing and color |
| 85-92 | Very close — remaining gap is subtle timing/effects |
| 92+ | Human eye needed for final adjustments |

### What the Agent Should Read Each Iteration

Before modifying code, the agent MUST read:

1. **Reference frames** at the keyframe timestamps from `analysis.json`
2. **The current SSIM breakdown** from verify output (which component is weakest?)
3. **The specific keyframes that scored lowest** (where is the biggest gap?)

This prevents blind iteration. If keyframe SSIM is low but video SSIM is decent, the problem is timing. If color match is low, the problem is palette. Always fix the weakest component first.

## File Structure

```
video/
├── scripts/
│   ├── analyze-reference.sh      # Pre-loop: extract everything from reference MP4
│   └── verify-replication.sh     # In-loop: render + compare + score
├── src/compositions/replicate/
│   └── ReplicateComposition.tsx   # The composition autoresearch modifies
└── REPLICATE.md                   # This file
```

## Limitations

- **3D content**: If the reference uses true 3D renders (Blender, C4D), SSIM will plateau around 70-80. The geometry can't be inferred from 2D frames alone.
- **Custom fonts**: Font rendering differs between tools. Use the exact same font file if possible.
- **Video/photo assets**: If the reference composites real footage, those assets need to be sourced separately and placed in `public/`.
- **Audio sync**: verify-replication.sh does not compare audio. Audio matching is a separate problem.

## Adding Scene Components

As the reference gets more complex, split scenes into separate files:

```
video/src/compositions/replicate/
├── ReplicateComposition.tsx    # Main composition, scene timing
├── Scene1.tsx                  # First scene
├── Scene2.tsx                  # Second scene
├── Scene3.tsx                  # etc.
└── shared.ts                   # Shared colors, easing configs, constants
```

All files in `video/src/compositions/replicate/**/*.tsx` are within autoresearch scope.

---

## Parallel Mode (10 sub-agents, one per scene)

The real speed comes from parallelization. Instead of one agent doing 30 sequential passes over a 30-second video, 10 agents each handle a 3-second scene simultaneously.

### Setup

```bash
# 1. Analyze the reference
bash video/scripts/analyze-reference.sh /path/to/reference.mp4 /path/to/analysis-dir

# 2. Split into per-scene components + per-scene verify scripts
bash video/scripts/split-scenes.sh /path/to/analysis-dir 10

# 3. Register per-scene compositions in Root.tsx (the script tells you what to add)

# 4. Read the generated configs
cat /path/to/analysis-dir/parallel-autoresearch.md
```

### What split-scenes.sh generates

| Output | Purpose |
|--------|---------|
| `Scene01.tsx` ... `Scene10.tsx` | Per-scene Remotion components with palette colors pre-filled |
| `ReplicateComposition.tsx` | Master composition that sequences all scenes |
| `scene_clips/scene_01.mp4` ... | Per-scene reference clips for faster verify |
| `scene_frames/scene_01/` ... | Per-scene reference frames for the agent to read |
| `verify-scene-01.sh` ... | Per-scene verify scripts (render + compare one scene only) |
| `parallel-autoresearch.md` | Ready-to-paste `/autoresearch` configs for each scene |

### Launching parallel agents

Each scene gets its own autoresearch loop. They don't conflict because each agent only modifies its own `SceneNN.tsx` file:

```
# In Claude Code, launch up to 10 agents:
# Each one gets its own /autoresearch config from parallel-autoresearch.md
# They run concurrently — each modifying only its SceneNN.tsx
```

### Why this is faster

| Mode | Scenes | Agents | Time per scene | Total wall time |
|------|--------|--------|----------------|-----------------|
| Sequential | 10 | 1 | ~20 iterations | ~200 iterations |
| **Parallel** | 10 | 10 | ~20 iterations | **~20 iterations** |

Each per-scene verify is also faster — it renders 3 seconds instead of 30, so the feedback loop is ~10x tighter.

### After all scenes converge

Once every scene scores >90 individually, run the full-video verify:

```bash
bash video/scripts/verify-replication.sh /path/to/reference.mp4 Replicate /path/to/analysis-dir
```

If the stitched score is lower than individual scenes, the transitions between scenes need work. Edit `ReplicateComposition.tsx` to add crossfades or transitions between `<Sequence>` blocks using `@remotion/transitions`.

---

## Sequential Mode (single agent, full video)

### Ready-to-Paste Autoresearch Configs

### Motionimo (1280x720, 30fps, 30s, 902 frames)

```
/autoresearch
Goal: Replicate the animation in Motionimo_1881390514953412608.mp4 using Remotion. The output must be visually indistinguishable from the reference at every keyframe.

CRITICAL AGENT INSTRUCTIONS — read these every iteration:

1. VISUAL REFERENCE: Before writing ANY code, read 5-8 reference frames from the analysis dir
   (use the Read tool on PNG files in <ANALYSIS_DIR>/frames/). You are multimodal — LOOK at what
   the reference looks like at each moment. This is your primary source of truth, not the SSIM score.

2. VERIFY BREAKDOWN: After each verify run, read <ANALYSIS_DIR>/last-verify-breakdown.json.
   It tells you which scoring component is weakest. Fix the weakest component first:
   - Low video_ssim → wrong layout, missing elements, wrong background
   - Low keyframe_ssim → timing is off (elements arrive/leave at wrong frames)
   - Low color_match → wrong colors, brightness, contrast
   - Low duration_match → composition duration doesn't match reference

3. PER-KEYFRAME DETAIL: Read <ANALYSIS_DIR>/last-verify-keyframes.txt to find WHICH
   specific timestamps score lowest. Then read the reference frame at that timestamp
   to see what's wrong.

4. SEQUENTIAL ATTACK — never change multiple dimensions at once:
   Pass 1-5:   STRUCTURE — get every element on screen (backgrounds, shapes, text, images)
                Read reference frames, identify every visual element, create React components for each.
                Background color, layout grid, element sizes and positions.
   Pass 6-10:  TIMING — match when things appear and disappear, frame-accurate.
                Use Sequence with exact from/durationInFrames matching scene timestamps from analysis.json.
   Pass 11-15: EASING — spring() vs interpolate(), overshoot, ease curves, velocity.
                Compare reference frame pairs (t and t+0.5s) to see motion arcs.
   Pass 16-20: COLOR & OPACITY — exact hex values, gradients, opacity animations, shadows.
                Read palettes.json for exact colors per scene.
   Pass 21+:   POLISH — blur, glow, film grain, noise, secondary motion, sub-pixel.

5. WHEN SSIM PLATEAUS (>5 iterations with <0.5 point improvement):
   - Read the weakest keyframe's reference PNG and the rendered frame side by side
   - Describe in your commit message EXACTLY what visual difference you see
   - Target that specific difference, not the SSIM number
   - Try radically different approaches: different Remotion primitives, Three.js for 3D scenes,
     CSS filters for effects, SVG for shapes

6. AVAILABLE REMOTION TOOLS (use these, they're all installed):
   - @remotion/three + @react-three/drei — 3D scenes, GLTF models
   - @remotion/transitions — fade(), slide(), wipe(), flip(), clockWipe()
   - @remotion/noise — Perlin noise for organic motion
   - @remotion/motion-blur — CameraMotionBlur for fast elements
   - @remotion/shapes — Triangle, Star, Pie, Circle
   - @remotion/paths — SVG morphing, evolvePath
   - @remotion/animation-utils — interpolateStyles
   - remotion-animated — declarative animation helpers
   - gl-transitions — 80+ GLSL shader transitions
   - spring() — physics-based easing (the most important tool for natural motion)

7. FILE ORGANIZATION:
   - Main composition: video/src/compositions/replicate/ReplicateComposition.tsx
   - Split complex scenes into: Scene1.tsx, Scene2.tsx, etc.
   - Shared constants (colors, timing): shared.ts
   - All must be within video/src/compositions/replicate/

8. DO NOT STOP until score exceeds 90 or you've been explicitly interrupted.
   If stuck, re-read ALL reference frames from scratch and rebuild from a different angle.

Scope: video/src/compositions/replicate/**/*.tsx
Metric: Weighted SSIM score (0-100, higher is better)
Direction: Maximize
Verify: cd /Users/maxguillabert/Downloads/index && bash video/scripts/verify-replication.sh /Users/maxguillabert/Downloads/Motionimo_1881390514953412608.mp4 Replicate /Users/maxguillabert/Downloads/Motionimo-analysis
Guard: cd /Users/maxguillabert/Downloads/index/video && npx tsc --noEmit
```

### Generic (any reference MP4)

Replace `<REFERENCE_PATH>`, `<ANALYSIS_DIR>`, and the filename in the Goal:

```
/autoresearch
Goal: Replicate the animation in <FILENAME>.mp4 using Remotion. The output must be visually indistinguishable from the reference at every keyframe.

CRITICAL AGENT INSTRUCTIONS — read these every iteration:

1. VISUAL REFERENCE: Before writing ANY code, read 5-8 reference frames from the analysis dir
   (use the Read tool on PNG files in <ANALYSIS_DIR>/frames/). You are multimodal — LOOK at what
   the reference looks like at each moment. This is your primary source of truth, not the SSIM score.

2. VERIFY BREAKDOWN: After each verify run, read <ANALYSIS_DIR>/last-verify-breakdown.json.
   It tells you which scoring component is weakest. Fix the weakest component first:
   - Low video_ssim → wrong layout, missing elements, wrong background
   - Low keyframe_ssim → timing is off (elements arrive/leave at wrong frames)
   - Low color_match → wrong colors, brightness, contrast
   - Low duration_match → composition duration doesn't match reference

3. PER-KEYFRAME DETAIL: Read <ANALYSIS_DIR>/last-verify-keyframes.txt to find WHICH
   specific timestamps score lowest. Then read the reference frame at that timestamp
   to see what's wrong.

4. SEQUENTIAL ATTACK — never change multiple dimensions at once:
   Pass 1-5:   STRUCTURE — backgrounds, shapes, text, images, layout
   Pass 6-10:  TIMING — when things appear/disappear, frame-accurate
   Pass 11-15: EASING — spring constants, interpolation curves, overshoot
   Pass 16-20: COLOR — exact hex, gradients, opacity, shadows
   Pass 21+:   POLISH — blur, glow, grain, secondary motion

5. WHEN SSIM PLATEAUS (>5 iterations with <0.5 point improvement):
   - Visually compare the weakest keyframe (Read both PNGs)
   - Describe the exact visual difference in your commit message
   - Try radically different Remotion primitives

6. AVAILABLE REMOTION TOOLS: @remotion/three, @remotion/transitions, @remotion/noise,
   @remotion/motion-blur, @remotion/shapes, @remotion/paths, remotion-animated,
   gl-transitions, spring()

7. DO NOT STOP until score exceeds 90 or explicitly interrupted.

Scope: video/src/compositions/replicate/**/*.tsx
Metric: Weighted SSIM score (0-100, higher is better)
Direction: Maximize
Verify: cd /Users/maxguillabert/Downloads/index && bash video/scripts/verify-replication.sh <REFERENCE_PATH> Replicate <ANALYSIS_DIR>
Guard: cd /Users/maxguillabert/Downloads/index/video && npx tsc --noEmit
```

## Pre-flight Checklist

### Both modes

- [ ] Reference MP4 downloaded, path known
- [ ] `bash video/scripts/analyze-reference.sh <reference.mp4> <analysis-dir>` completed
- [ ] `analysis.json` exists with correct video metadata
- [ ] Git is clean in `video/src/compositions/replicate/`

### Sequential mode (add to above)

- [ ] `replicateMeta` in `ReplicateComposition.tsx` updated with correct width/height/fps/durationInFrames
- [ ] Dry-run: `bash video/scripts/verify-replication.sh <ref.mp4> Replicate <analysis-dir>` outputs a SCORE

### Parallel mode (add to above)

- [ ] `bash video/scripts/split-scenes.sh <analysis-dir> 10` completed
- [ ] Per-scene compositions registered in `Root.tsx` (import + `<Composition>` for each)
- [ ] `<analysis-dir>/scene_frames/` has frames for every scene
- [ ] `<analysis-dir>/scene_clips/` has clips for every scene
- [ ] Dry-run one scene: `bash video/scripts/scene-verify/verify-scene-01.sh` outputs a SCORE
- [ ] Read `<analysis-dir>/parallel-autoresearch.md` for ready-to-paste configs
