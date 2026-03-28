#!/bin/bash
# analyze-reference.sh — Extract everything from a reference MP4 for replication
#
# Usage: ./scripts/analyze-reference.sh <reference.mp4> [output-dir]
#
# Outputs:
#   output-dir/analysis.json    — structured metadata (scenes, colors, timing, motion)
#   output-dir/frames/          — keyframes at scene boundaries + regular intervals
#   output-dir/scenes/          — one PNG per detected scene change
#   output-dir/palettes/        — dominant color palette per scene (PNG swatches)
#   output-dir/histograms/      — color histograms per scene
#
# Requirements: ffmpeg, ffprobe, ImageMagick (magick), python3

set -euo pipefail

INPUT="${1:?Usage: analyze-reference.sh <reference.mp4> [output-dir]}"
OUTDIR="${2:-$(dirname "$INPUT")/reference-analysis}"

# Resolve absolute paths
INPUT="$(cd "$(dirname "$INPUT")" && pwd)/$(basename "$INPUT")"

echo "=== Reference Analysis ==="
echo "Input:  $INPUT"
echo "Output: $OUTDIR"
echo ""

# Create output structure
mkdir -p "$OUTDIR"/{frames,scenes,palettes,histograms}

# ─────────────────────────────────────────────
# 1. PROBE: Basic video metadata
# ─────────────────────────────────────────────
echo "[1/7] Probing video metadata..."

PROBE=$(ffprobe -v quiet -print_format json -show_format -show_streams "$INPUT")

WIDTH=$(echo "$PROBE" | python3 -c "import json,sys; d=json.load(sys.stdin); print([s['width'] for s in d['streams'] if s['codec_type']=='video'][0])")
HEIGHT=$(echo "$PROBE" | python3 -c "import json,sys; d=json.load(sys.stdin); print([s['height'] for s in d['streams'] if s['codec_type']=='video'][0])")
FPS=$(echo "$PROBE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for s in d['streams']:
    if s['codec_type']=='video':
        r = s.get('r_frame_rate','30/1')
        num, den = r.split('/')
        print(f'{int(num)/int(den):.2f}')
        break
")
DURATION=$(echo "$PROBE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['format'].get('duration','0'))")
TOTAL_FRAMES=$(echo "$PROBE" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for s in d['streams']:
    if s['codec_type']=='video':
        nb = s.get('nb_frames')
        if nb and nb != 'N/A':
            print(nb)
        else:
            import math
            dur = float(d['format'].get('duration','0'))
            r = s.get('r_frame_rate','30/1')
            num, den = r.split('/')
            print(int(math.ceil(dur * int(num)/int(den))))
        break
")
HAS_AUDIO=$(echo "$PROBE" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if any(s['codec_type']=='audio' for s in d['streams']) else 'false')")

echo "  ${WIDTH}x${HEIGHT} @ ${FPS}fps, ${DURATION}s, ${TOTAL_FRAMES} frames, audio=${HAS_AUDIO}"

# ─────────────────────────────────────────────
# 2. SCENE DETECTION: Find cut points
# ─────────────────────────────────────────────
echo "[2/7] Detecting scene changes..."

# Use ffmpeg scene detection (threshold 0.3 = moderate sensitivity)
SCENE_CSV="$OUTDIR/scene_changes.csv"
ffmpeg -i "$INPUT" -vf "select='gt(scene,0.3)',showinfo" -vsync vfr -f null - 2>&1 \
  | grep "showinfo" \
  | sed -n 's/.*pts_time:\([0-9.]*\).*/\1/p' \
  > "$SCENE_CSV" 2>/dev/null || true

SCENE_COUNT=$(wc -l < "$SCENE_CSV" | tr -d ' ')
echo "  Found $SCENE_COUNT scene changes"

# Also detect with lower threshold for subtle transitions
ffmpeg -i "$INPUT" -vf "select='gt(scene,0.15)',showinfo" -vsync vfr -f null - 2>&1 \
  | grep "showinfo" \
  | sed -n 's/.*pts_time:\([0-9.]*\).*/\1/p' \
  > "$OUTDIR/scene_changes_sensitive.csv" 2>/dev/null || true

# ─────────────────────────────────────────────
# 3. FRAME EXTRACTION: Regular + scene boundaries
# ─────────────────────────────────────────────
echo "[3/7] Extracting frames..."

# Regular interval frames (every 0.5s for dense coverage)
ffmpeg -i "$INPUT" -vf "fps=2,scale=1920:-1" "$OUTDIR/frames/regular_%04d.png" -y 2>/dev/null
REGULAR_COUNT=$(ls "$OUTDIR/frames/regular_"*.png 2>/dev/null | wc -l | tr -d ' ')
echo "  Extracted $REGULAR_COUNT regular frames (every 0.5s)"

# Scene boundary frames
SCENE_IDX=0
while IFS= read -r timestamp; do
  SCENE_IDX=$((SCENE_IDX + 1))
  # Frame just before scene change
  BEFORE=$(echo "$timestamp - 0.04" | bc -l 2>/dev/null || echo "$timestamp")
  ffmpeg -i "$INPUT" -ss "$BEFORE" -frames:v 1 -vf "scale=1920:-1" \
    "$OUTDIR/scenes/scene_${SCENE_IDX}_before.png" -y 2>/dev/null || true
  # Frame at scene change
  ffmpeg -i "$INPUT" -ss "$timestamp" -frames:v 1 -vf "scale=1920:-1" \
    "$OUTDIR/scenes/scene_${SCENE_IDX}_at.png" -y 2>/dev/null || true
  # Frame just after scene change
  AFTER=$(echo "$timestamp + 0.08" | bc -l)
  ffmpeg -i "$INPUT" -ss "$AFTER" -frames:v 1 -vf "scale=1920:-1" \
    "$OUTDIR/scenes/scene_${SCENE_IDX}_after.png" -y 2>/dev/null || true
done < "$SCENE_CSV"
echo "  Extracted $SCENE_IDX scene boundary triplets"

# ─────────────────────────────────────────────
# 4. COLOR ANALYSIS: Dominant colors per scene
# ─────────────────────────────────────────────
echo "[4/7] Analyzing color palettes..."

python3 - "$INPUT" "$OUTDIR" "$SCENE_CSV" "$DURATION" << 'PYEOF'
import subprocess, json, sys, os

input_path = sys.argv[1]
outdir = sys.argv[2]
scene_csv = sys.argv[3]
duration = float(sys.argv[4])

# Read scene boundaries
scenes = [0.0]
if os.path.exists(scene_csv):
    with open(scene_csv) as f:
        for line in f:
            t = line.strip()
            if t:
                scenes.append(float(t))
scenes.append(duration)

palettes = []

for i in range(len(scenes) - 1):
    start = scenes[i]
    end = scenes[i + 1]
    mid = (start + end) / 2
    scene_dur = end - start

    # Extract a representative frame from middle of scene
    frame_path = os.path.join(outdir, "palettes", f"scene_{i+1}_frame.png")
    subprocess.run([
        "ffmpeg", "-i", input_path, "-ss", str(mid), "-frames:v", "1",
        "-vf", "scale=320:-1", frame_path, "-y"
    ], capture_output=True)

    if not os.path.exists(frame_path):
        continue

    # Extract dominant colors using ImageMagick
    result = subprocess.run([
        "magick", frame_path, "-colors", "8", "-depth", "8",
        "-format", "%c", "histogram:info:-"
    ], capture_output=True, text=True)

    colors = []
    for line in result.stdout.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        # Parse: "  12345: (R,G,B) #RRGGBB srgb(r,g,b)"
        parts = line.split("#")
        if len(parts) >= 2:
            hex_color = "#" + parts[1][:6]
            count_part = line.split(":")[0].strip()
            try:
                count = int(count_part)
                colors.append({"hex": hex_color, "pixels": count})
            except ValueError:
                pass

    # Sort by pixel count descending
    colors.sort(key=lambda c: c["pixels"], reverse=True)

    # Create palette swatch
    if colors:
        swatch_cmd = ["magick", "-size", f"{80*len(colors[:8])}x80"]
        color_args = []
        for j, c in enumerate(colors[:8]):
            color_args.extend([
                "xc:" + c["hex"]
            ])
        subprocess.run([
            "magick", *[f"xc:{c['hex']}[80x80!]" for c in colors[:8]],
            "+append",
            os.path.join(outdir, "palettes", f"scene_{i+1}_palette.png")
        ], capture_output=True)

    palettes.append({
        "scene": i + 1,
        "start": round(start, 3),
        "end": round(end, 3),
        "duration": round(scene_dur, 3),
        "dominant_colors": [c["hex"] for c in colors[:8]],
        "color_distribution": colors[:8]
    })

# Save palette data
with open(os.path.join(outdir, "palettes.json"), "w") as f:
    json.dump(palettes, f, indent=2)

print(f"  Analyzed {len(palettes)} scene palettes")
PYEOF

# ─────────────────────────────────────────────
# 5. MOTION ANALYSIS: How much movement per region
# ─────────────────────────────────────────────
echo "[5/7] Analyzing motion intensity..."

python3 - "$INPUT" "$OUTDIR" "$DURATION" "$FPS" << 'PYEOF'
import subprocess, json, sys, os

input_path = sys.argv[1]
outdir = sys.argv[2]
duration = float(sys.argv[3])
fps = float(sys.argv[4])

# Sample motion at 1-second intervals using frame differencing
# We compare consecutive frames and measure mean absolute difference
motion_data = []
sample_interval = 0.5  # every 0.5s
t = 0.0

while t < duration - sample_interval:
    # Extract two consecutive frames
    f1 = "/tmp/_motion_f1.png"
    f2 = "/tmp/_motion_f2.png"
    subprocess.run([
        "ffmpeg", "-i", input_path, "-ss", str(t), "-frames:v", "1",
        "-vf", "scale=320:-1,format=gray", f1, "-y"
    ], capture_output=True)
    subprocess.run([
        "ffmpeg", "-i", input_path, "-ss", str(t + 1.0/fps), "-frames:v", "1",
        "-vf", "scale=320:-1,format=gray", f2, "-y"
    ], capture_output=True)

    if os.path.exists(f1) and os.path.exists(f2):
        # Compute mean absolute error between frames
        result = subprocess.run([
            "magick", "compare", "-metric", "MAE", f1, f2, "/dev/null"
        ], capture_output=True, text=True)
        # MAE output format: "1234.5 (0.0188)"
        mae_str = result.stderr.strip()
        try:
            # Extract the normalized value in parentheses
            if "(" in mae_str:
                normalized = float(mae_str.split("(")[1].rstrip(")"))
            else:
                normalized = float(mae_str.split()[0]) / 65535.0
            motion_data.append({
                "time": round(t, 2),
                "motion_intensity": round(normalized, 4)
            })
        except (ValueError, IndexError):
            motion_data.append({"time": round(t, 2), "motion_intensity": 0.0})

    t += sample_interval

# Classify motion levels
for m in motion_data:
    intensity = m["motion_intensity"]
    if intensity < 0.01:
        m["level"] = "static"
    elif intensity < 0.05:
        m["level"] = "subtle"
    elif intensity < 0.15:
        m["level"] = "moderate"
    elif intensity < 0.30:
        m["level"] = "fast"
    else:
        m["level"] = "extreme"

with open(os.path.join(outdir, "motion.json"), "w") as f:
    json.dump(motion_data, f, indent=2)

# Summary stats
if motion_data:
    intensities = [m["motion_intensity"] for m in motion_data]
    avg = sum(intensities) / len(intensities)
    peak = max(intensities)
    peak_time = motion_data[intensities.index(peak)]["time"]
    print(f"  {len(motion_data)} samples, avg_motion={avg:.4f}, peak={peak:.4f} at {peak_time}s")
else:
    print("  No motion data extracted")
PYEOF

# ─────────────────────────────────────────────
# 6. COLOR HISTOGRAMS: Per-frame color distribution
# ─────────────────────────────────────────────
echo "[6/7] Computing color histograms..."

python3 - "$OUTDIR" << 'PYEOF'
import subprocess, json, sys, os, glob

outdir = sys.argv[1]
frames_dir = os.path.join(outdir, "frames")
histograms = []

frame_files = sorted(glob.glob(os.path.join(frames_dir, "regular_*.png")))

for i, frame_path in enumerate(frame_files):
    # Get mean RGB values
    result = subprocess.run([
        "magick", frame_path, "-resize", "1x1!", "-format", "%[fx:mean.r],%[fx:mean.g],%[fx:mean.b]", "info:-"
    ], capture_output=True, text=True)

    try:
        r, g, b = [float(x) for x in result.stdout.strip().split(",")]
        # Also get brightness and saturation
        result2 = subprocess.run([
            "magick", frame_path, "-colorspace", "HSL", "-resize", "1x1!",
            "-format", "%[fx:mean.r],%[fx:mean.g],%[fx:mean.b]", "info:-"
        ], capture_output=True, text=True)
        h, s, l = [float(x) for x in result2.stdout.strip().split(",")]

        histograms.append({
            "frame": i + 1,
            "time": round(i * 0.5, 1),
            "rgb": {"r": round(r, 3), "g": round(g, 3), "b": round(b, 3)},
            "hsl": {"h": round(h * 360, 1), "s": round(s, 3), "l": round(l, 3)},
            "brightness": round(l, 3),
            "saturation": round(s, 3)
        })
    except (ValueError, IndexError):
        pass

with open(os.path.join(outdir, "histograms.json"), "w") as f:
    json.dump(histograms, f, indent=2)

print(f"  Computed histograms for {len(histograms)} frames")
PYEOF

# ─────────────────────────────────────────────
# 7. ASSEMBLE: Master analysis JSON
# ─────────────────────────────────────────────
echo "[7/7] Assembling analysis.json..."

python3 - "$OUTDIR" "$WIDTH" "$HEIGHT" "$FPS" "$DURATION" "$TOTAL_FRAMES" "$HAS_AUDIO" "$INPUT" << 'PYEOF'
import json, sys, os

outdir = sys.argv[1]
width = int(sys.argv[2])
height = int(sys.argv[3])
fps = float(sys.argv[4])
duration = float(sys.argv[5])
total_frames = int(sys.argv[6])
has_audio = sys.argv[7] == "true"
input_path = sys.argv[8]

# Load sub-analyses
palettes = []
motion = []
histograms = []
scene_times = []

if os.path.exists(os.path.join(outdir, "palettes.json")):
    with open(os.path.join(outdir, "palettes.json")) as f:
        palettes = json.load(f)

if os.path.exists(os.path.join(outdir, "motion.json")):
    with open(os.path.join(outdir, "motion.json")) as f:
        motion = json.load(f)

if os.path.exists(os.path.join(outdir, "histograms.json")):
    with open(os.path.join(outdir, "histograms.json")) as f:
        histograms = json.load(f)

scene_csv = os.path.join(outdir, "..", "scene_changes.csv")
if not os.path.exists(scene_csv):
    scene_csv = os.path.join(outdir, "scene_changes.csv")
# Try the one written in the outdir parent... actually it's written to outdir
# Let's just read from where it was written
for candidate in [
    os.path.join(outdir, "scene_changes.csv"),
    os.path.join(os.path.dirname(outdir), "scene_changes.csv"),
]:
    if os.path.exists(candidate):
        with open(candidate) as f:
            scene_times = [float(l.strip()) for l in f if l.strip()]
        break

# Compute global color summary
if histograms:
    avg_brightness = sum(h["brightness"] for h in histograms) / len(histograms)
    avg_saturation = sum(h["saturation"] for h in histograms) / len(histograms)
    brightness_range = max(h["brightness"] for h in histograms) - min(h["brightness"] for h in histograms)
else:
    avg_brightness = avg_saturation = brightness_range = 0

# Compute motion summary
if motion:
    avg_motion = sum(m["motion_intensity"] for m in motion) / len(motion)
    peak_motion = max(m["motion_intensity"] for m in motion)
    static_pct = sum(1 for m in motion if m["level"] == "static") / len(motion) * 100
else:
    avg_motion = peak_motion = static_pct = 0

# Build keyframe list for SSIM comparison (scene changes + regular checkpoints)
keyframes = []
# Always include first and last frame
keyframes.append({"frame": 0, "time": 0.0, "reason": "start"})
# Scene change frames
for t in scene_times:
    frame_num = int(t * fps)
    keyframes.append({"frame": frame_num, "time": round(t, 3), "reason": "scene_change"})
# Regular checkpoints every 2s (fill gaps)
t = 2.0
while t < duration - 0.5:
    frame_num = int(t * fps)
    # Don't duplicate near scene changes
    if not any(abs(kf["time"] - t) < 1.0 for kf in keyframes):
        keyframes.append({"frame": frame_num, "time": round(t, 3), "reason": "checkpoint"})
    t += 2.0
# Last frame
keyframes.append({"frame": total_frames - 1, "time": round(duration, 3), "reason": "end"})
keyframes.sort(key=lambda k: k["frame"])

# Assemble master analysis
analysis = {
    "source": os.path.basename(input_path),
    "video": {
        "width": width,
        "height": height,
        "fps": fps,
        "duration": round(duration, 3),
        "total_frames": total_frames,
        "has_audio": has_audio,
        "aspect_ratio": f"{width}:{height}",
    },
    "remotion_config": {
        "width": width,
        "height": height,
        "fps": int(fps),
        "durationInFrames": total_frames,
    },
    "scenes": {
        "count": len(scene_times) + 1,
        "change_timestamps": scene_times,
        "palettes": palettes,
    },
    "motion": {
        "average_intensity": round(avg_motion, 4),
        "peak_intensity": round(peak_motion, 4),
        "static_percentage": round(static_pct, 1),
        "timeline": motion,
    },
    "color": {
        "average_brightness": round(avg_brightness, 3),
        "average_saturation": round(avg_saturation, 3),
        "brightness_range": round(brightness_range, 3),
        "timeline": histograms,
    },
    "keyframes_for_comparison": keyframes,
    "paths": {
        "frames_dir": os.path.join(outdir, "frames"),
        "scenes_dir": os.path.join(outdir, "scenes"),
        "palettes_dir": os.path.join(outdir, "palettes"),
    }
}

output_path = os.path.join(outdir, "analysis.json")
with open(output_path, "w") as f:
    json.dump(analysis, f, indent=2)

print(f"  Wrote {output_path}")
print(f"  {len(keyframes)} keyframes selected for SSIM comparison")
print(f"  Scenes: {len(scene_times)+1}, Avg motion: {avg_motion:.4f}, Avg brightness: {avg_brightness:.3f}")
PYEOF

echo ""
echo "=== Analysis Complete ==="
echo "Results in: $OUTDIR"
echo ""
echo "Key files:"
echo "  $OUTDIR/analysis.json       — Master analysis (feed to autoresearch)"
echo "  $OUTDIR/frames/             — Regular frames (every 0.5s)"
echo "  $OUTDIR/scenes/             — Scene boundary triplets"
echo "  $OUTDIR/palettes/           — Dominant colors per scene"
echo ""
echo "Next: Use this with verify-replication.sh in an /autoresearch loop"
