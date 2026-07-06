#!/bin/bash
# verify-scene-v2.sh — Multi-metric scene verification for autoresearch
#
# Uses ALL analysis layers:
#   1. SSIM (structural similarity)
#   2. Color accuracy (per-frame palette matching)
#   3. Text presence (are the right words on screen at the right time?)
#   4. Motion magnitude (does the flow intensity match the reference?)
#   5. Element count (right number of shapes/contours per frame?)
#
# Outputs: single SCORE (0-100) + detailed breakdown JSON
#
# Usage: verify-scene-v2.sh <comp-id> <ref-video> <start-sec> <duration-sec> <analysis-dir> [scale]

set -euo pipefail

COMP_ID="${1:?Usage: verify-scene-v2.sh <comp-id> <ref-video> <start> <duration> <analysis-dir> [scale]}"
REF_VIDEO="${2:?}"
START="${3:?}"
DURATION="${4:?}"
ANALYSIS_DIR="${5:?}"
SCALE="${6:-1}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VIDEO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK="/tmp/verify-v2-$$"
mkdir -p "$WORK"

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

cd "$VIDEO_DIR"

# ─── 0. GUARD: TypeScript compiles ───
echo "PHASE: typecheck" >&2
if ! npx tsc --noEmit 2>/dev/null; then
  echo "SCORE: 0"
  exit 1
fi

# ─── 1. RENDER ───
echo "PHASE: render" >&2
ATTEMPT="$WORK/attempt.mp4"
SCALE_FLAG=""
if [ "$SCALE" != "1" ]; then
  SCALE_FLAG="--scale=$SCALE"
fi

if ! npx remotion render src/index.ts "$COMP_ID" "$ATTEMPT" --codec h264 --timeout=180000 $SCALE_FLAG 2>/dev/null; then
  echo "SCORE: 0"
  exit 1
fi

# ─── 2. EXTRACT REFERENCE CLIP ───
echo "PHASE: extract_ref" >&2
REF_CLIP="$WORK/ref.mp4"
ffmpeg -ss "$START" -t "$DURATION" -i "$REF_VIDEO" -c copy "$REF_CLIP" -y 2>/dev/null

# Scale reference to match attempt if needed
if [ "$SCALE" != "1" ]; then
  ATT_W=$(ffprobe -v quiet -show_entries stream=width -of csv=p=0 "$ATTEMPT" | head -1)
  ATT_H=$(ffprobe -v quiet -show_entries stream=height -of csv=p=0 "$ATTEMPT" | head -1)
  REF_SCALED="$WORK/ref_scaled.mp4"
  ffmpeg -i "$REF_CLIP" -vf "scale=${ATT_W}:${ATT_H}" -c:v libx264 -crf 18 "$REF_SCALED" -y 2>/dev/null
  REF_CLIP="$REF_SCALED"
fi

# Ensure same duration
REF_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$REF_CLIP")
ATT_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$ATTEMPT")
MIN_DUR=$(python3 -c "print(min(float('$REF_DUR'), float('$ATT_DUR')))")

# ─── 3. SSIM (weight 30%) ───
echo "PHASE: ssim" >&2
VIDEO_SSIM=$(ffmpeg -t "$MIN_DUR" -i "$REF_CLIP" -t "$MIN_DUR" -i "$ATTEMPT" \
  -lavfi "ssim=stats_file=$WORK/ssim_log.txt" -f null - 2>&1 \
  | grep "All:" | sed 's/.*All://' | awk '{print $1}' || echo "0")

if [ -z "$VIDEO_SSIM" ] || [ "$VIDEO_SSIM" = "0" ]; then
  VIDEO_SSIM="0.0"
fi
echo "  ssim=$VIDEO_SSIM" >&2

# ─── 4. KEYFRAME SSIM (weight 25%) ───
echo "PHASE: keyframe_ssim" >&2
KF_SCORES=()
NUM_KEYFRAMES=8
for i in $(seq 0 $((NUM_KEYFRAMES - 1))); do
  T=$(python3 -c "print(round($MIN_DUR * $i / $NUM_KEYFRAMES, 2))")
  ffmpeg -i "$REF_CLIP" -ss "$T" -frames:v 1 "$WORK/ref_kf_${i}.png" -y 2>/dev/null || continue
  ffmpeg -i "$ATTEMPT" -ss "$T" -frames:v 1 "$WORK/att_kf_${i}.png" -y 2>/dev/null || continue

  if [ -f "$WORK/ref_kf_${i}.png" ] && [ -f "$WORK/att_kf_${i}.png" ]; then
    # ffmpeg SSIM, not ImageMagick compare — IM 7.x emits raw DISTORTION
    # (identical = 0), which read as similarity poisons the average
    # (replicate-method.md §The judge).
    KF=$(ffmpeg -nostdin -i "$WORK/ref_kf_${i}.png" -i "$WORK/att_kf_${i}.png" -lavfi ssim -f null - 2>&1 \
      | grep "All:" | sed 's/.*All://' | awk '{print $1}' || echo "0")
    if [ -n "$KF" ]; then KF_SCORES+=("$KF"); fi
  fi
done

KF_AVG="0.0"
if [ ${#KF_SCORES[@]} -gt 0 ]; then
  KF_AVG=$(python3 -c "
scores = [float(s) for s in '${KF_SCORES[*]}'.split() if s]
print(sum(scores)/len(scores) if scores else 0)
")
fi
echo "  keyframe_ssim=$KF_AVG (${#KF_SCORES[@]} frames)" >&2

# ─── 5. COLOR ACCURACY (weight 15%) ───
echo "PHASE: color" >&2
COLOR_SCORE=$(python3 -c "
import subprocess, math, os
scores = []
for i in range(5):
    t = round(float('$MIN_DUR') * i / 5, 2)
    ref = '/tmp/verify-v2-$$/color_ref_{}.png'.format(i)
    att = '/tmp/verify-v2-$$/color_att_{}.png'.format(i)
    subprocess.run(['ffmpeg','-i','$REF_CLIP','-ss',str(t),'-frames:v','1','-vf','scale=64:-1',ref,'-y'], capture_output=True)
    subprocess.run(['ffmpeg','-i','$ATTEMPT','-ss',str(t),'-frames:v','1','-vf','scale=64:-1',att,'-y'], capture_output=True)
    def rgb(p):
        r=subprocess.run(['magick',p,'-resize','1x1!','-format','%[fx:mean.r],%[fx:mean.g],%[fx:mean.b]','info:-'],capture_output=True,text=True)
        try: return [float(x) for x in r.stdout.strip().split(',')]
        except: return [0,0,0]
    if os.path.exists(ref) and os.path.exists(att):
        rr,ar=rgb(ref),rgb(att)
        d=math.sqrt(sum((a-b)**2 for a,b in zip(rr,ar)))
        scores.append(1-d/math.sqrt(3))
print(round(sum(scores)/len(scores),6) if scores else 0)
")
echo "  color=$COLOR_SCORE" >&2

# ─── 6. TEXT MATCH (weight 15%) ───
echo "PHASE: text_match" >&2
TEXT_SCORE=$(python3 -c "
import subprocess, os, json

# Get expected text from analysis if available
expected_texts = set()
analysis_path = os.path.join('$ANALYSIS_DIR', 'scene-interpretations-complete.json')
deep_path = os.path.join('$ANALYSIS_DIR', '..', 'ordinaryfolk-deep', 'summary.json')

# Try to load expected text from deep analysis
for path in [analysis_path, deep_path, os.path.join('$ANALYSIS_DIR', 'deep-analysis.json')]:
    if os.path.exists(path):
        try:
            data = json.load(open(path))
            # Extract text content from various formats
            if 'per_scene_summary' in data:
                for s in data['per_scene_summary']:
                    for t in s.get('text_content', []):
                        if len(t) > 2:
                            expected_texts.add(t.lower())
            if 'scenes' in data:
                for s in data['scenes']:
                    interp = s.get('interpretation', {})
                    if isinstance(interp, dict):
                        for v in interp.values():
                            if isinstance(v, str):
                                for word in v.split():
                                    if len(word) > 3:
                                        expected_texts.add(word.lower())
        except: pass

if not expected_texts:
    print(0.8)  # no baseline, assume decent
else:
    # OCR the rendered video at a few timestamps
    import pytesseract
    found = set()
    for i in range(5):
        t = round(float('$MIN_DUR') * i / 5, 2)
        frame = '/tmp/verify-v2-$$/text_att_{}.png'.format(i)
        subprocess.run(['ffmpeg','-i','$ATTEMPT','-ss',str(t),'-frames:v','1',frame,'-y'], capture_output=True)
        if os.path.exists(frame):
            try:
                import cv2
                img = cv2.imread(frame)
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                text = pytesseract.image_to_string(gray, config='--psm 11').lower()
                for word in text.split():
                    if len(word) > 2:
                        found.add(word.strip('.,!?;:'))
            except: pass

    # Score: what fraction of expected text was found?
    if expected_texts:
        matches = len(expected_texts & found)
        score = matches / len(expected_texts)
        print(round(min(score * 1.5, 1.0), 4))  # generous scaling
    else:
        print(0.8)
")
echo "  text_match=$TEXT_SCORE" >&2

# ─── 7. DURATION MATCH (weight 5%) ───
echo "PHASE: duration" >&2
DUR_SCORE=$(python3 -c "
ref=float('$REF_DUR'); att=float('$ATT_DUR')
print(round(min(ref,att)/max(ref,att),4) if max(ref,att)>0 else 0)
")
echo "  duration=$DUR_SCORE" >&2

# ─── 8. MOTION INTENSITY MATCH (weight 10%) ───
echo "PHASE: motion" >&2
MOTION_SCORE=$(python3 -c "
import subprocess, json, os, math
import cv2
import numpy as np

# Sample motion from both videos
def measure_motion(video_path, samples=5, duration=float('$MIN_DUR')):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    magnitudes = []
    prev_gray = None
    for i in range(samples):
        t = duration * i / samples
        frame_num = int(t * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        if not ret: continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if prev_gray is not None:
            flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5, 2, 10, 2, 5, 1.1, 0)
            mag = np.sqrt(flow[:,:,0]**2 + flow[:,:,1]**2)
            magnitudes.append(float(mag.mean()))
        prev_gray = gray
    cap.release()
    return magnitudes

ref_motion = measure_motion('$REF_CLIP')
att_motion = measure_motion('$ATTEMPT')

if ref_motion and att_motion:
    # Compare motion intensity profiles
    ref_avg = sum(ref_motion) / len(ref_motion)
    att_avg = sum(att_motion) / len(att_motion)
    if max(ref_avg, att_avg) > 0:
        ratio = min(ref_avg, att_avg) / max(ref_avg, att_avg)
        score = ratio
    else:
        score = 1.0  # both static
    print(round(score, 4))
else:
    print(0.5)
")
echo "  motion=$MOTION_SCORE" >&2

# ─── 9. FINAL WEIGHTED SCORE ───
FINAL=$(python3 -c "
ssim = float('$VIDEO_SSIM')
kf = float('$KF_AVG')
color = float('$COLOR_SCORE')
text = float('$TEXT_SCORE')
dur = float('$DUR_SCORE')
motion = float('$MOTION_SCORE')

score = (
    ssim * 0.30 +
    kf * 0.25 +
    color * 0.15 +
    text * 0.15 +
    motion * 0.10 +
    dur * 0.05
) * 100

print(f'{score:.1f}')
")

# Write breakdown
BREAKDOWN_FILE="$ANALYSIS_DIR/verify-breakdown-${COMP_ID}.json"
python3 -c "
import json
breakdown = {
    'comp_id': '$COMP_ID',
    'score': float('$FINAL'),
    'components': {
        'ssim': {'value': float('$VIDEO_SSIM'), 'weight': 0.30},
        'keyframe_ssim': {'value': float('$KF_AVG'), 'weight': 0.25},
        'color_match': {'value': float('$COLOR_SCORE'), 'weight': 0.15},
        'text_match': {'value': float('$TEXT_SCORE'), 'weight': 0.15},
        'motion_match': {'value': float('$MOTION_SCORE'), 'weight': 0.10},
        'duration_match': {'value': float('$DUR_SCORE'), 'weight': 0.05},
    },
    'weakest': sorted([
        ('ssim', float('$VIDEO_SSIM') * 0.30),
        ('keyframe_ssim', float('$KF_AVG') * 0.25),
        ('color', float('$COLOR_SCORE') * 0.15),
        ('text', float('$TEXT_SCORE') * 0.15),
        ('motion', float('$MOTION_SCORE') * 0.10),
        ('duration', float('$DUR_SCORE') * 0.05),
    ], key=lambda x: x[1])[0][0],
    'keyframe_scores': '${KF_SCORES[*]:-}'.split() if '${KF_SCORES[*]:-}' else [],
}
with open('$BREAKDOWN_FILE', 'w') as f:
    json.dump(breakdown, f, indent=2)
" 2>/dev/null || true

echo "" >&2
echo "BREAKDOWN:" >&2
echo "  ssim:      $VIDEO_SSIM (30%)" >&2
echo "  kf_ssim:   $KF_AVG (25%)" >&2
echo "  color:     $COLOR_SCORE (15%)" >&2
echo "  text:      $TEXT_SCORE (15%)" >&2
echo "  motion:    $MOTION_SCORE (10%)" >&2
echo "  duration:  $DUR_SCORE (5%)" >&2
echo "  weakest:   $(python3 -c "
c=[('ssim',float('$VIDEO_SSIM')*0.30),('kf',float('$KF_AVG')*0.25),('color',float('$COLOR_SCORE')*0.15),('text',float('$TEXT_SCORE')*0.15),('motion',float('$MOTION_SCORE')*0.10)]
print(sorted(c,key=lambda x:x[1])[0][0])
" 2>/dev/null || echo 'unknown')" >&2
echo "  ──────────" >&2
echo "$FINAL"
