#!/bin/bash
# split-scenes.sh — Split a reference video into per-scene clips + generate per-scene Remotion scaffolds
#
# Usage: ./scripts/split-scenes.sh <analysis-dir> [max-scenes]
#
# Reads analysis.json from the analysis dir, then:
#   1. Cuts the reference MP4 into per-scene clips (scene_01.mp4, scene_02.mp4, ...)
#   2. Extracts keyframes per scene
#   3. Generates per-scene Remotion component scaffolds (Scene01.tsx, Scene02.tsx, ...)
#   4. Generates a per-scene verify script (verify-scene-N.sh)
#   5. Generates ReplicateComposition.tsx that stitches all scenes
#   6. Writes parallel-autoresearch.md with ready-to-paste /autoresearch configs per scene
#
# Requirements: ffmpeg, python3, analysis.json must exist

set -euo pipefail

ANALYSIS_DIR="${1:?Usage: split-scenes.sh <analysis-dir> [max-scenes]}"
MAX_SCENES="${2:-10}"

ANALYSIS_DIR="$(cd "$ANALYSIS_DIR" && pwd)"
ANALYSIS_JSON="$ANALYSIS_DIR/analysis.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VIDEO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMP_DIR="$VIDEO_DIR/src/compositions/replicates/original"

if [ ! -f "$ANALYSIS_JSON" ]; then
  echo "ERROR: analysis.json not found at $ANALYSIS_JSON" >&2
  echo "Run analyze-reference.sh first." >&2
  exit 1
fi

echo "=== Scene Splitter ==="
echo "Analysis: $ANALYSIS_JSON"
echo "Max scenes: $MAX_SCENES"
echo ""

# ─────────────────────────────────────────────
# 1. READ ANALYSIS + COMPUTE SCENE BOUNDARIES
# ─────────────────────────────────────────────
echo "[1/5] Computing scene boundaries..."

SCENE_DATA=$(python3 - "$ANALYSIS_JSON" "$MAX_SCENES" << 'PYEOF'
import json, sys

analysis = json.load(open(sys.argv[1]))
max_scenes = int(sys.argv[2])

duration = analysis["video"]["duration"]
fps = analysis["video"]["fps"]
width = analysis["video"]["width"]
height = analysis["video"]["height"]
source = analysis["source"]

timestamps = analysis["scenes"]["change_timestamps"]

# Build scene list: each scene = (start, end, duration_frames)
scenes = []
boundaries = [0.0] + timestamps + [duration]

for i in range(len(boundaries) - 1):
    start = boundaries[i]
    end = boundaries[i + 1]
    dur = end - start
    if dur < 0.1:  # skip tiny scenes
        continue
    scenes.append({
        "index": len(scenes) + 1,
        "start": round(start, 3),
        "end": round(end, 3),
        "duration_sec": round(dur, 3),
        "start_frame": int(start * fps),
        "end_frame": int(end * fps),
        "duration_frames": max(1, int(dur * fps)),
    })

# If too many scenes, merge adjacent short ones
if len(scenes) > max_scenes:
    # Merge shortest scenes with their neighbors until we hit max
    while len(scenes) > max_scenes:
        # Find shortest scene
        shortest_idx = min(range(len(scenes)), key=lambda i: scenes[i]["duration_sec"])
        # Merge with shorter neighbor
        if shortest_idx == 0:
            merge_with = 1
        elif shortest_idx == len(scenes) - 1:
            merge_with = shortest_idx - 1
        else:
            # Merge with shorter neighbor
            if scenes[shortest_idx - 1]["duration_sec"] <= scenes[shortest_idx + 1]["duration_sec"]:
                merge_with = shortest_idx - 1
            else:
                merge_with = shortest_idx + 1

        lo = min(shortest_idx, merge_with)
        hi = max(shortest_idx, merge_with)
        merged = {
            "index": scenes[lo]["index"],
            "start": scenes[lo]["start"],
            "end": scenes[hi]["end"],
            "duration_sec": round(scenes[hi]["end"] - scenes[lo]["start"], 3),
            "start_frame": scenes[lo]["start_frame"],
            "end_frame": scenes[hi]["end_frame"],
            "duration_frames": scenes[hi]["end_frame"] - scenes[lo]["start_frame"],
        }
        scenes = scenes[:lo] + [merged] + scenes[hi+1:]

    # Re-index
    for i, s in enumerate(scenes):
        s["index"] = i + 1

# Get palette info per scene if available
palettes = analysis.get("scenes", {}).get("palettes", [])

output = {
    "source": source,
    "video": analysis["video"],
    "scene_count": len(scenes),
    "scenes": scenes,
    "palettes": palettes,
}

print(json.dumps(output))
PYEOF
)

SCENE_COUNT=$(echo "$SCENE_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['scene_count'])")
SOURCE=$(echo "$SCENE_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['source'])")
REF_PATH=$(echo "$SCENE_DATA" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['source'])")
WIDTH=$(echo "$SCENE_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['video']['width'])")
HEIGHT=$(echo "$SCENE_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['video']['height'])")
FPS=$(echo "$SCENE_DATA" | python3 -c "import json,sys; print(int(json.load(sys.stdin)['video']['fps']))")

echo "  $SCENE_COUNT scenes detected (capped at $MAX_SCENES)"

# Save scene data
echo "$SCENE_DATA" | python3 -m json.tool > "$ANALYSIS_DIR/scenes_split.json"

# ─────────────────────────────────────────────
# 2. CUT REFERENCE INTO PER-SCENE CLIPS + FRAMES
# ─────────────────────────────────────────────
echo "[2/5] Cutting per-scene clips and frames..."

# Find the original reference video
REF_VIDEO=$(python3 -c "
import json
a = json.load(open('$ANALYSIS_JSON'))
# Try common locations
import os
candidates = [
    os.path.join(os.path.dirname('$ANALYSIS_DIR'), a['source']),
    os.path.join('/Users/maxguillabert/Downloads', a['source']),
    a['source'],
]
for c in candidates:
    if os.path.exists(c):
        print(c)
        break
else:
    print('NOT_FOUND')
")

if [ "$REF_VIDEO" = "NOT_FOUND" ]; then
  echo "WARNING: Could not find original reference video. Scene clips won't be created." >&2
  echo "  Per-scene frames will be extracted from existing analysis frames instead." >&2
else
  mkdir -p "$ANALYSIS_DIR/scene_clips"
  mkdir -p "$ANALYSIS_DIR/scene_frames"

  echo "$SCENE_DATA" | python3 -c "
import json, sys, subprocess, os

data = json.load(sys.stdin)
ref = '$REF_VIDEO'
outdir = '$ANALYSIS_DIR'

for scene in data['scenes']:
    idx = scene['index']
    start = scene['start']
    dur = scene['duration_sec']

    # Cut clip
    clip_path = os.path.join(outdir, 'scene_clips', f'scene_{idx:02d}.mp4')
    subprocess.run([
        'ffmpeg', '-i', ref, '-ss', str(start), '-t', str(dur),
        '-c:v', 'libx264', '-crf', '18', clip_path, '-y'
    ], capture_output=True)

    # Extract frames at 2fps for this scene
    frames_dir = os.path.join(outdir, 'scene_frames', f'scene_{idx:02d}')
    os.makedirs(frames_dir, exist_ok=True)
    subprocess.run([
        'ffmpeg', '-i', ref, '-ss', str(start), '-t', str(dur),
        '-vf', 'fps=2,scale=960:-1',
        os.path.join(frames_dir, 'frame_%03d.png'), '-y'
    ], capture_output=True)

    frame_count = len([f for f in os.listdir(frames_dir) if f.endswith('.png')])
    print(f'  Scene {idx:02d}: {start:.1f}s-{start+dur:.1f}s ({dur:.1f}s) → {frame_count} frames')
"
fi

# ─────────────────────────────────────────────
# 3. GENERATE PER-SCENE REMOTION COMPONENTS
# ─────────────────────────────────────────────
echo "[3/5] Generating Remotion scene components..."

mkdir -p "$COMP_DIR"

echo "$SCENE_DATA" | python3 -c "
import json, sys, os

data = json.load(sys.stdin)
comp_dir = '$COMP_DIR'
fps = int(data['video']['fps'])
width = data['video']['width']
height = data['video']['height']

# Get palette colors per scene
palettes = data.get('palettes', [])

for scene in data['scenes']:
    idx = scene['index']
    dur_frames = scene['duration_frames']
    start = scene['start']
    end = scene['end']

    # Find palette for this scene
    bg_color = '#000000'
    scene_colors = []
    for p in palettes:
        if p.get('start', 0) >= start - 0.5 and p.get('start', 0) <= end + 0.5:
            scene_colors = p.get('dominant_colors', [])
            if scene_colors:
                bg_color = scene_colors[0]
            break

    colors_str = ', '.join([f'\"{c}\"' for c in scene_colors[:6]]) if scene_colors else '\"#000000\"'

    component = f'''import React from \"react\";
import {{
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Sequence,
}} from \"remotion\";

/**
 * Scene {idx:02d} — {start:.1f}s to {end:.1f}s ({scene['duration_sec']:.1f}s)
 *
 * Reference frames: <ANALYSIS_DIR>/scene_frames/scene_{idx:02d}/
 * Scene clip: <ANALYSIS_DIR>/scene_clips/scene_{idx:02d}.mp4
 *
 * AGENT: Read the reference frames in scene_frames/scene_{idx:02d}/ to see what this scene looks like.
 * Then build the Remotion equivalent below.
 */

// Dominant colors from reference (from palette analysis)
const COLORS = [{colors_str}];

export const Scene{idx:02d}: React.FC = () => {{
  const frame = useCurrentFrame();
  const {{ fps, width, height }} = useVideoConfig();

  return (
    <AbsoluteFill
      style={{{{
        backgroundColor: COLORS[0] || \"{bg_color}\",
        justifyContent: \"center\",
        alignItems: \"center\",
      }}}}
    >
      {{/* REPLACE: Build this scene to match reference frames */}}
      <div
        style={{{{
          color: \"#ffffff\",
          fontSize: 32,
          fontFamily: \"sans-serif\",
          opacity: interpolate(frame, [0, fps * 0.3], [0, 1], {{
            extrapolateRight: \"clamp\",
          }}),
        }}}}
      >
        Scene {idx:02d} — Replace with reference content
      </div>
    </AbsoluteFill>
  );
}};

export const scene{idx:02d}Meta = {{
  id: \"ReplicateScene{idx:02d}\",
  component: Scene{idx:02d},
  width: {width},
  height: {height},
  fps: {fps},
  durationInFrames: {dur_frames},
}};
'''

    filepath = os.path.join(comp_dir, f'Scene{idx:02d}.tsx')
    # Don't overwrite existing scene files (they may have been iterated on)
    if not os.path.exists(filepath):
        with open(filepath, 'w') as f:
            f.write(component)
        print(f'  Created Scene{idx:02d}.tsx ({dur_frames} frames)')
    else:
        print(f'  Scene{idx:02d}.tsx already exists — skipping')
"

# ─────────────────────────────────────────────
# 4. GENERATE MASTER COMPOSITION + ROOT REGISTRATION
# ─────────────────────────────────────────────
echo "[4/5] Generating master composition..."

echo "$SCENE_DATA" | python3 -c "
import json, sys, os

data = json.load(sys.stdin)
comp_dir = '$COMP_DIR'
fps = int(data['video']['fps'])
width = data['video']['width']
height = data['video']['height']
scenes = data['scenes']
total_frames = sum(s['duration_frames'] for s in scenes)

imports = []
scene_entries = []
meta_imports = []

for s in scenes:
    idx = s['index']
    imports.append(f'import {{ Scene{idx:02d}, scene{idx:02d}Meta }} from \"./Scene{idx:02d}\";')
    meta_imports.append(f'scene{idx:02d}Meta')
    scene_entries.append(f'''        <Sequence
          key={{\"scene-{idx}\"}}
          from={{{s['start_frame']}}}
          durationInFrames={{{s['duration_frames']}}}
          name=\"Scene {idx:02d}\"
        >
          <Scene{idx:02d} />
        </Sequence>''')

composition = f'''import React from \"react\";
import {{ AbsoluteFill, Sequence, useVideoConfig }} from \"remotion\";
{chr(10).join(imports)}

/**
 * Master Replication Composition — stitches all scenes together.
 *
 * Each SceneNN is independently developed by a parallel sub-agent.
 * This composition sequences them at the correct frame offsets.
 */

export const ReplicateComposition: React.FC = () => {{
  return (
    <AbsoluteFill style={{{{ backgroundColor: \"#000000\" }}}}>
{chr(10).join(scene_entries)}
    </AbsoluteFill>
  );
}};

export const replicateMeta = {{
  id: \"Replicate\",
  component: ReplicateComposition,
  width: {width},
  height: {height},
  fps: {fps},
  durationInFrames: {total_frames},
}};

// Per-scene metas for individual registration
export const sceneMetas = [{', '.join(meta_imports)}];
'''

filepath = os.path.join(comp_dir, 'ReplicateComposition.tsx')
with open(filepath, 'w') as f:
    f.write(composition)
print(f'  Wrote ReplicateComposition.tsx ({len(scenes)} scenes, {total_frames} total frames)')
"

# ─────────────────────────────────────────────
# 5. GENERATE PER-SCENE VERIFY SCRIPTS
# ─────────────────────────────────────────────
echo "[5/5] Generating per-scene verify scripts..."

mkdir -p "$VIDEO_DIR/scripts/scene-verify"

echo "$SCENE_DATA" | python3 -c "
import json, sys, os

data = json.load(sys.stdin)
video_dir = '$VIDEO_DIR'
analysis_dir = '$ANALYSIS_DIR'
scenes = data['scenes']
width = data['video']['width']
height = data['video']['height']
fps = int(data['video']['fps'])

for s in scenes:
    idx = s['index']
    start = s['start']
    dur = s['duration_sec']
    dur_frames = s['duration_frames']

    script = f'''#!/bin/bash
# verify-scene-{idx:02d}.sh — Verify scene {idx:02d} only (faster than full video)
# Auto-generated by split-scenes.sh

set -euo pipefail

SCRIPT_DIR=\"\$(cd \"\$(dirname \"\$0\")\" && pwd)\"
VIDEO_DIR=\"\$(cd \"\$SCRIPT_DIR/../..\" && pwd)\"
ANALYSIS_DIR=\"{analysis_dir}\"
SCENE_CLIP=\"\$ANALYSIS_DIR/scene_clips/scene_{idx:02d}.mp4\"
COMP_ID=\"ReplicateScene{idx:02d}\"
ATTEMPT=\"/tmp/scene-{idx:02d}-attempt-\$\$.mp4\"

cd \"$VIDEO_DIR\"

# Guard: TypeScript compiles
if ! npx tsc --noEmit 2>/dev/null; then
  echo \"SCORE: 0\"
  exit 1
fi

# Render just this scene
if ! npx remotion render src/index.ts \"\$COMP_ID\" \"\$ATTEMPT\" --codec h264 2>/dev/null; then
  echo \"SCORE: 0\"
  exit 1
fi

if [ ! -f \"\$ATTEMPT\" ] || [ ! -f \"\$SCENE_CLIP\" ]; then
  echo \"SCORE: 0\"
  exit 1
fi

# Scale to match
ATTEMPT_SCALED=\"/tmp/scene-{idx:02d}-scaled-\$\$.mp4\"
ffmpeg -i \"\$ATTEMPT\" -vf \"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2\" \\
  -c:v libx264 -crf 18 \"\$ATTEMPT_SCALED\" -y 2>/dev/null
ATTEMPT=\"\$ATTEMPT_SCALED\"

# SSIM comparison
MIN_DUR=\$(python3 -c \"
import subprocess, json
def get_dur(p):
    r = subprocess.run(['ffprobe','-v','quiet','-print_format','json','-show_format',p], capture_output=True, text=True)
    return float(json.loads(r.stdout)['format']['duration'])
print(min(get_dur('\$SCENE_CLIP'), get_dur('\$ATTEMPT')))
\")

VIDEO_SSIM=\$(ffmpeg -t \"\$MIN_DUR\" -i \"\$SCENE_CLIP\" -t \"\$MIN_DUR\" -i \"\$ATTEMPT\" \\
  -lavfi ssim -f null - 2>&1 | grep \"All:\" | sed 's/.*All://' | awk '{{print \$1}}' || echo \"0\")

# Keyframe SSIM (5 samples across the scene)
KF_SUM=0
KF_COUNT=0
for i in 0 1 2 3 4; do
  T=\$(python3 -c \"print(round({start} + {dur} * \$i / 5, 2))\")
  ffmpeg -i \"\$SCENE_CLIP\" -ss \$(python3 -c \"print(round({dur} * \$i / 5, 2))\") -frames:v 1 /tmp/_skf_ref_\$i.png -y 2>/dev/null || continue
  ffmpeg -i \"\$ATTEMPT\" -ss \$(python3 -c \"print(round({dur} * \$i / 5, 2))\") -frames:v 1 /tmp/_skf_att_\$i.png -y 2>/dev/null || continue
  KF=\$(magick compare -metric SSIM /tmp/_skf_ref_\$i.png /tmp/_skf_att_\$i.png /dev/null 2>&1 | head -1 | awk '{{print \$1}}' || echo \"0\")
  KF_SUM=\$(echo \"\$KF_SUM + \$KF\" | bc -l)
  KF_COUNT=\$((KF_COUNT + 1))
done
KF_AVG=\$(python3 -c \"print(\$KF_SUM / max(1, \$KF_COUNT))\")

# Color similarity
COLOR=\$(python3 -c \"
import subprocess, math, os
def rgb(p):
    r=subprocess.run(['magick',p,'-resize','1x1!','-format','%[fx:mean.r],%[fx:mean.g],%[fx:mean.b]','info:-'],capture_output=True,text=True)
    try: return [float(x) for x in r.stdout.strip().split(',')]
    except: return [0,0,0]
scores=[]
for i in range(5):
    t={dur}*i/5
    ref='/tmp/_sc_ref.png'; att='/tmp/_sc_att.png'
    subprocess.run(['ffmpeg','-i','\$SCENE_CLIP','-ss',str(t),'-frames:v','1','-vf','scale=64:-1',ref,'-y'],capture_output=True)
    subprocess.run(['ffmpeg','-i','\$ATTEMPT','-ss',str(t),'-frames:v','1','-vf','scale=64:-1',att,'-y'],capture_output=True)
    if os.path.exists(ref) and os.path.exists(att):
        rr,ar=rgb(ref),rgb(att)
        d=math.sqrt(sum((a-b)**2 for a,b in zip(rr,ar)))
        scores.append(1-d/math.sqrt(3))
print(sum(scores)/len(scores) if scores else 0)
\")

# Duration match
DUR_MATCH=\$(python3 -c \"
rd=float('\$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 \"\$SCENE_CLIP\")')
ad=float('\$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 \"\$ATTEMPT\")')
print(min(rd,ad)/max(rd,ad) if max(rd,ad)>0 else 0)
\")

SCORE=\$(python3 -c \"
s=(float('\$VIDEO_SSIM')*0.40 + float('\$KF_AVG')*0.35 + float('\$COLOR')*0.15 + float('\$DUR_MATCH')*0.10)*100
print(f'{{s:.1f}}')
\")

# Write breakdown for agent
mkdir -p \"\$ANALYSIS_DIR\"
cat > \"\$ANALYSIS_DIR/scene_{idx:02d}_breakdown.json\" << JSONEOF
{{
  \"scene\": {idx},
  \"score\": \$SCORE,
  \"video_ssim\": \$VIDEO_SSIM,
  \"keyframe_ssim\": \$KF_AVG,
  \"color_match\": \$COLOR,
  \"duration_match\": \$DUR_MATCH
}}
JSONEOF

# Cleanup
rm -f \"\$ATTEMPT\" \"\$ATTEMPT_SCALED\" /tmp/_skf_*.png /tmp/_sc_*.png 2>/dev/null

echo \"SCORE: \$SCORE\" >&2
echo \"\$SCORE\"
'''

    filepath = os.path.join(video_dir, 'scripts', 'scene-verify', f'verify-scene-{idx:02d}.sh')
    with open(filepath, 'w') as f:
        f.write(script)
    os.chmod(filepath, 0o755)
    print(f'  Created verify-scene-{idx:02d}.sh')
"

# ─────────────────────────────────────────────
# 6. GENERATE PARALLEL AUTORESEARCH CONFIG
# ─────────────────────────────────────────────
echo ""
echo "=== Generating parallel autoresearch configs ==="

echo "$SCENE_DATA" | python3 -c "
import json, sys, os

data = json.load(sys.stdin)
analysis_dir = '$ANALYSIS_DIR'
video_dir = '$VIDEO_DIR'
index_dir = os.path.dirname(video_dir)
scenes = data['scenes']

configs = []
for s in scenes:
    idx = s['index']
    config = f'''### Scene {idx:02d} ({s['start']:.1f}s — {s['end']:.1f}s, {s['duration_sec']:.1f}s)

\`\`\`
/autoresearch
Goal: Replicate Scene {idx:02d} of the reference video in Remotion. This scene runs from {s['start']:.1f}s to {s['end']:.1f}s.

AGENT INSTRUCTIONS:
1. Read ALL frames in {analysis_dir}/scene_frames/scene_{idx:02d}/ — LOOK at every frame to understand what happens in this scene.
2. Read {analysis_dir}/scenes_split.json for timing data.
3. Read {analysis_dir}/scene_{idx:02d}_breakdown.json after each verify to see which component is weakest.
4. Edit ONLY video/src/compositions/replicates/original/Scene{idx:02d}.tsx
5. Sequential attack: structure → timing → easing → color → polish
6. When stuck: re-read the reference frames. Visually compare your rendered output (use npx remotion still) to the reference.
7. DO NOT STOP until score exceeds 90 or interrupted.

Scope: video/src/compositions/replicates/original/Scene{idx:02d}.tsx
Metric: SSIM score (0-100, higher is better)
Direction: Maximize
Verify: cd {index_dir} && bash video/scripts/scene-verify/verify-scene-{idx:02d}.sh
Guard: cd {index_dir}/video && npx tsc --noEmit
\`\`\`
'''
    configs.append(config)

# Write to file
output = '''# Parallel Autoresearch — Per-Scene Configs

Launch each scene as a separate /autoresearch invocation. They run in parallel,
each modifying only its own SceneNN.tsx file (no conflicts).

After all scenes converge (score > 90), run the full-video verify to check transitions.

## Per-Scene Configs

''' + '\\n'.join(configs) + '''

## After All Scenes Converge

Run the full composition verify to check scene stitching:

\`\`\`bash
cd ''' + index_dir + ''' && bash video/scripts/verify-replication.sh <REFERENCE_PATH> Replicate ''' + analysis_dir + '''
\`\`\`

If the full score is lower than individual scenes, the transitions between scenes need work.
Edit ReplicateComposition.tsx to add crossfade/slide/wipe transitions between Sequences.
'''

filepath = os.path.join(analysis_dir, 'parallel-autoresearch.md')
with open(filepath, 'w') as f:
    f.write(output)
print(f'  Wrote {filepath}')
print(f'  {len(scenes)} parallel configs ready')
"

echo ""
echo "=== Scene Split Complete ==="
echo ""
echo "Per-scene components: $COMP_DIR/Scene*.tsx"
echo "Per-scene verify:     $VIDEO_DIR/scripts/scene-verify/"
echo "Per-scene clips:      $ANALYSIS_DIR/scene_clips/"
echo "Per-scene frames:     $ANALYSIS_DIR/scene_frames/"
echo "Parallel configs:     $ANALYSIS_DIR/parallel-autoresearch.md"
echo ""
echo "Next steps:"
echo "  1. Register per-scene compositions in Root.tsx"
echo "  2. Read parallel-autoresearch.md"
echo "  3. Launch up to $SCENE_COUNT sub-agents in parallel"
