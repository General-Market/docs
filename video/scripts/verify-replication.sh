#!/bin/bash
# verify-replication.sh — Autoresearch verify command
#
# Renders a Remotion composition, compares to reference MP4, outputs SCORE: N
#
# Usage: ./scripts/verify-replication.sh <reference.mp4> <composition-id> [analysis-dir]
#
# The script:
#   1. Type-checks the Remotion project (guard)
#   2. Renders the composition to a temp MP4
#   3. Computes video-level SSIM
#   4. Computes keyframe-level SSIM at critical moments
#   5. Computes color histogram similarity
#   6. Outputs a single weighted score 0-100
#
# Exit codes:
#   0 = success (score printed)
#   1 = build/render failure
#   2 = reference file missing

set -euo pipefail

REFERENCE="${1:?Usage: verify-replication.sh <reference.mp4> <composition-id> [analysis-dir]}"
COMP_ID="${2:?Usage: verify-replication.sh <reference.mp4> <composition-id> [analysis-dir]}"
ANALYSIS_DIR="${3:-$(dirname "$REFERENCE")/reference-analysis}"

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VIDEO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REFERENCE="$(cd "$(dirname "$REFERENCE")" && pwd)/$(basename "$REFERENCE")"
ATTEMPT="/tmp/replicate-attempt-$$.mp4"
WORK="/tmp/replicate-verify-$$"

mkdir -p "$WORK"

cleanup() {
  rm -rf "$WORK" "$ATTEMPT" /tmp/_kf_ref_*.png /tmp/_kf_att_*.png
}
trap cleanup EXIT

# ─────────────────────────────────────────────
# 0. PREFLIGHT
# ─────────────────────────────────────────────
if [ ! -f "$REFERENCE" ]; then
  echo "ERROR: Reference file not found: $REFERENCE" >&2
  exit 2
fi

# Read analysis if available
ANALYSIS_JSON="$ANALYSIS_DIR/analysis.json"
if [ -f "$ANALYSIS_JSON" ]; then
  HAS_ANALYSIS=true
else
  HAS_ANALYSIS=false
  echo "WARNING: No analysis.json found at $ANALYSIS_DIR — using basic comparison" >&2
fi

# ─────────────────────────────────────────────
# 1. GUARD: TypeScript compiles
# ─────────────────────────────────────────────
echo "PHASE: typecheck" >&2
cd "$VIDEO_DIR"
if ! npx tsc --noEmit 2>/dev/null; then
  echo "ERROR: TypeScript compilation failed" >&2
  echo "SCORE: 0"
  exit 1
fi

# ─────────────────────────────────────────────
# 2. RENDER: Remotion composition to MP4
# ─────────────────────────────────────────────
echo "PHASE: render" >&2

# Get reference dimensions from analysis or probe
if [ "$HAS_ANALYSIS" = true ]; then
  REF_WIDTH=$(python3 -c "import json; d=json.load(open('$ANALYSIS_JSON')); print(d['video']['width'])")
  REF_HEIGHT=$(python3 -c "import json; d=json.load(open('$ANALYSIS_JSON')); print(d['video']['height'])")
  REF_FPS=$(python3 -c "import json; d=json.load(open('$ANALYSIS_JSON')); print(d['remotion_config']['fps'])")
else
  REF_WIDTH=$(ffprobe -v quiet -print_format json -show_streams "$REFERENCE" | python3 -c "import json,sys;d=json.load(sys.stdin);print([s['width'] for s in d['streams'] if s['codec_type']=='video'][0])")
  REF_HEIGHT=$(ffprobe -v quiet -print_format json -show_streams "$REFERENCE" | python3 -c "import json,sys;d=json.load(sys.stdin);print([s['height'] for s in d['streams'] if s['codec_type']=='video'][0])")
  REF_FPS=30
fi

if ! npx remotion render src/index.ts "$COMP_ID" "$ATTEMPT" --codec h264 2>/dev/null; then
  echo "ERROR: Remotion render failed" >&2
  echo "SCORE: 0"
  exit 1
fi

if [ ! -f "$ATTEMPT" ]; then
  echo "ERROR: Render produced no output" >&2
  echo "SCORE: 0"
  exit 1
fi

# Scale attempt to match reference dimensions for fair comparison
ATTEMPT_SCALED="/tmp/replicate-attempt-scaled-$$.mp4"
ffmpeg -i "$ATTEMPT" -vf "scale=${REF_WIDTH}:${REF_HEIGHT}:force_original_aspect_ratio=decrease,pad=${REF_WIDTH}:${REF_HEIGHT}:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -crf 18 "$ATTEMPT_SCALED" -y 2>/dev/null
ATTEMPT="$ATTEMPT_SCALED"

# ─────────────────────────────────────────────
# 3. VIDEO-LEVEL SSIM (weight: 40%)
# ─────────────────────────────────────────────
echo "PHASE: video_ssim" >&2

# Ensure same duration — trim to shorter
REF_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$REFERENCE")
ATT_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$ATTEMPT")
MIN_DUR=$(python3 -c "print(min(float('$REF_DUR'), float('$ATT_DUR')))")

VIDEO_SSIM=$(ffmpeg -t "$MIN_DUR" -i "$REFERENCE" -t "$MIN_DUR" -i "$ATTEMPT" \
  -lavfi "ssim=stats_file=$WORK/ssim_log.txt" -f null - 2>&1 \
  | grep "All:" | sed 's/.*All://' | awk '{print $1}' || echo "0")

# Fallback if ssim filter fails
if [ -z "$VIDEO_SSIM" ] || [ "$VIDEO_SSIM" = "0" ]; then
  VIDEO_SSIM="0.0"
fi

echo "  video_ssim=$VIDEO_SSIM" >&2

# ─────────────────────────────────────────────
# 4. KEYFRAME SSIM (weight: 35%)
# ─────────────────────────────────────────────
echo "PHASE: keyframe_ssim" >&2

KF_SCORES=()

if [ "$HAS_ANALYSIS" = true ]; then
  # Use keyframes from analysis
  KEYFRAME_TIMES=$(python3 -c "
import json
d = json.load(open('$ANALYSIS_JSON'))
for kf in d.get('keyframes_for_comparison', []):
    print(kf['time'])
")
else
  # Default: every 2 seconds
  KEYFRAME_TIMES=$(python3 -c "
t = 0.0
while t < float('$MIN_DUR'):
    print(f'{t:.2f}')
    t += 2.0
")
fi

KF_IDX=0
while IFS= read -r ts; do
  KF_IDX=$((KF_IDX + 1))
  REF_FRAME="/tmp/_kf_ref_${KF_IDX}.png"
  ATT_FRAME="/tmp/_kf_att_${KF_IDX}.png"

  # Extract frame at this timestamp from both videos
  ffmpeg -i "$REFERENCE" -ss "$ts" -frames:v 1 -vf "scale=${REF_WIDTH}:${REF_HEIGHT}" "$REF_FRAME" -y 2>/dev/null || continue
  ffmpeg -i "$ATTEMPT" -ss "$ts" -frames:v 1 -vf "scale=${REF_WIDTH}:${REF_HEIGHT}" "$ATT_FRAME" -y 2>/dev/null || continue

  if [ -f "$REF_FRAME" ] && [ -f "$ATT_FRAME" ]; then
    # SSIM via ffmpeg (same metric as the video component). ImageMagick's
    # `compare -metric SSIM` emits raw distortion on this build (identical=0),
    # which read as similarity poisoned the keyframe average.
    KF_SSIM=$(ffmpeg -i "$REF_FRAME" -i "$ATT_FRAME" -lavfi ssim -f null - 2>&1 \
      | grep "All:" | sed 's/.*All://' | awk '{print $1}' || echo "0")
    if [ -z "$KF_SSIM" ]; then KF_SSIM="0"; fi
    KF_SCORES+=("$KF_SSIM")
  fi
done <<< "$KEYFRAME_TIMES"

# Average keyframe SSIM
if [ ${#KF_SCORES[@]} -gt 0 ]; then
  KF_AVG=$(python3 -c "
scores = [float(s) for s in '${KF_SCORES[*]}'.split() if s and float(s) > 0]
print(sum(scores)/len(scores) if scores else 0)
")
else
  KF_AVG="0.0"
fi

echo "  keyframe_ssim=$KF_AVG (${#KF_SCORES[@]} frames)" >&2

# ─────────────────────────────────────────────
# 5. COLOR SIMILARITY (weight: 15%)
# ─────────────────────────────────────────────
echo "PHASE: color_similarity" >&2

COLOR_SCORE=$(python3 - "$REFERENCE" "$ATTEMPT" "$MIN_DUR" << 'PYEOF'
import subprocess, sys, math

ref_path = sys.argv[1]
att_path = sys.argv[2]
min_dur = float(sys.argv[3])

# Sample mean color at regular intervals
samples = 10
scores = []

for i in range(samples):
    t = min_dur * i / samples
    ref_frame = f"/tmp/_color_ref_{i}.png"
    att_frame = f"/tmp/_color_att_{i}.png"

    subprocess.run(["ffmpeg", "-i", ref_path, "-ss", str(t), "-frames:v", "1",
                     "-vf", "scale=64:-1", ref_frame, "-y"], capture_output=True)
    subprocess.run(["ffmpeg", "-i", att_path, "-ss", str(t), "-frames:v", "1",
                     "-vf", "scale=64:-1", att_frame, "-y"], capture_output=True)

    # Get mean RGB from each
    def get_rgb(path):
        r = subprocess.run(["magick", path, "-resize", "1x1!", "-format",
                            "%[fx:mean.r],%[fx:mean.g],%[fx:mean.b]", "info:-"],
                           capture_output=True, text=True)
        try:
            return [float(x) for x in r.stdout.strip().split(",")]
        except:
            return [0, 0, 0]

    ref_rgb = get_rgb(ref_frame)
    att_rgb = get_rgb(att_frame)

    # Euclidean distance in RGB space, normalized to 0-1
    dist = math.sqrt(sum((a-b)**2 for a, b in zip(ref_rgb, att_rgb)))
    max_dist = math.sqrt(3)  # max possible distance
    similarity = 1.0 - (dist / max_dist)
    scores.append(similarity)

    # Cleanup
    import os
    for f in [ref_frame, att_frame]:
        if os.path.exists(f):
            os.remove(f)

avg_score = sum(scores) / len(scores) if scores else 0
print(f"{avg_score:.6f}")
PYEOF
)

echo "  color_similarity=$COLOR_SCORE" >&2

# ─────────────────────────────────────────────
# 6. DURATION PENALTY (weight: 10%)
# ─────────────────────────────────────────────
echo "PHASE: duration_match" >&2

DUR_SCORE=$(python3 -c "
ref = float('$REF_DUR')
att = float('$ATT_DUR')
if ref == 0:
    print(0)
else:
    ratio = min(ref, att) / max(ref, att)
    print(f'{ratio:.6f}')
")

echo "  duration_match=$DUR_SCORE" >&2

# ─────────────────────────────────────────────
# 7. FINAL WEIGHTED SCORE
# ─────────────────────────────────────────────
FINAL_SCORE=$(python3 -c "
video_ssim = float('$VIDEO_SSIM')
kf_ssim = float('$KF_AVG')
color = float('$COLOR_SCORE')
duration = float('$DUR_SCORE')

# Weights
score = (
    video_ssim * 0.40 +    # Overall structural similarity
    kf_ssim * 0.35 +       # Timing-critical moments
    color * 0.15 +          # Color accuracy
    duration * 0.10         # Duration match
) * 100

print(f'{score:.1f}')
")

# ─────────────────────────────────────────────
# 8. WRITE BREAKDOWN FILE (for agent to read)
# ─────────────────────────────────────────────
mkdir -p "$ANALYSIS_DIR"
BREAKDOWN_FILE="$ANALYSIS_DIR/last-verify-breakdown.json"
python3 -c "
import json
breakdown = {
    'score': float('$FINAL_SCORE'),
    'components': {
        'video_ssim': {'value': float('$VIDEO_SSIM'), 'weight': 0.40, 'weighted': round(float('$VIDEO_SSIM') * 0.40 * 100, 1)},
        'keyframe_ssim': {'value': float('$KF_AVG'), 'weight': 0.35, 'weighted': round(float('$KF_AVG') * 0.35 * 100, 1)},
        'color_match': {'value': float('$COLOR_SCORE'), 'weight': 0.15, 'weighted': round(float('$COLOR_SCORE') * 0.15 * 100, 1)},
        'duration_match': {'value': float('$DUR_SCORE'), 'weight': 0.10, 'weighted': round(float('$DUR_SCORE') * 0.10 * 100, 1)},
    },
    'keyframe_scores': dict(zip(
        ['${KF_SCORES[*]}'.split()][0] if '${KF_SCORES[*]}' else [],
        range(len('${KF_SCORES[*]}'.split()))
    )) if '${KF_SCORES[*]}' else {},
    'weakest_component': sorted(
        [('video_ssim', float('$VIDEO_SSIM') * 0.40),
         ('keyframe_ssim', float('$KF_AVG') * 0.35),
         ('color_match', float('$COLOR_SCORE') * 0.15),
         ('duration_match', float('$DUR_SCORE') * 0.10)],
        key=lambda x: x[1]
    )[0][0]
}
with open('$BREAKDOWN_FILE', 'w') as f:
    json.dump(breakdown, f, indent=2)
" 2>/dev/null || true

# Write per-keyframe detail file
KF_DETAIL_FILE="$ANALYSIS_DIR/last-verify-keyframes.txt"
{
  echo "# Per-keyframe SSIM scores (lower = needs more work at this timestamp)"
  KF_IDX2=0
  KF_SCORES_STR="${KF_SCORES[*]:-}"
  while IFS= read -r ts; do
    if [ $KF_IDX2 -lt ${#KF_SCORES[@]} ]; then
      SCORE_VAL="${KF_SCORES[$KF_IDX2]}"
      echo "  t=${ts}s  ssim=${SCORE_VAL}"
    fi
    KF_IDX2=$((KF_IDX2 + 1))
  done <<< "$KEYFRAME_TIMES"
} > "$KF_DETAIL_FILE" 2>/dev/null || true

echo "" >&2
echo "BREAKDOWN:" >&2
echo "  video_ssim:    $VIDEO_SSIM (40%)" >&2
echo "  keyframe_ssim: $KF_AVG (35%)" >&2
echo "  color_match:   $COLOR_SCORE (15%)" >&2
echo "  duration:      $DUR_SCORE (10%)" >&2
echo "  weakest: $(python3 -c "
c=[('video_ssim',float('$VIDEO_SSIM')*0.40),('keyframe_ssim',float('$KF_AVG')*0.35),('color_match',float('$COLOR_SCORE')*0.15),('duration',float('$DUR_SCORE')*0.10)]
print(sorted(c,key=lambda x:x[1])[0][0])
" 2>/dev/null || echo 'unknown')" >&2
echo "  breakdown: $BREAKDOWN_FILE" >&2
echo "  keyframes: $KF_DETAIL_FILE" >&2
echo "  ──────────────────────" >&2
echo "SCORE: $FINAL_SCORE"
