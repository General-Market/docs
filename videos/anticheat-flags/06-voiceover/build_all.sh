#!/usr/bin/env bash
# Build the AntiCheat video pipeline end-to-end.
#
# Steps:
#   1. Convert raw mp3 → 16k wav (parakeet) and 48k wav (DeepFilterNet) if not present
#   2. Transcribe both takes with parakeet (word-level timing, JSON output)
#   3. Extract script sentences from 05-script.md
#   4. Align each transcript to the script, retake-aware (finds all candidates per sentence)
#   5. Build the manifest from the two alignments with auto-pick heuristic
#   6. Clean both takes with DeepFilterNet (noise removal)
#   7. Publish — copy cleaned audio + video + manifest into video/public/anticheat-takes/
#      and into video/src/compositions/anticheat-video/manifest.json
#
# Re-run after editing 06-voiceover/overrides.json to flip individual sentence picks.

set -euo pipefail

cd "$(dirname "$0")"

VIDEO_PUBLIC="/Users/maxguillabert/Downloads/index/video/public/anticheat-takes"
COMPOSITION_DIR="/Users/maxguillabert/Downloads/index/video/src/compositions/anticheat-video"
SCRIPT_MD="../05-script.md"

OVERRIDES=""
[ -f overrides.json ] && OVERRIDES="overrides.json"

mkdir -p "$VIDEO_PUBLIC"

log() { printf "\n\033[1m▶ %s\033[0m\n" "$*"; }

# ─── Step 1 — wav conversion (only if missing) ──────────────────────────
if [ ! -s take-A-16k.wav ] || [ ! -s take-A-48k.wav ]; then
  log "1a. Convert take A raw mp3 → wav (16k mono + 48k mono)"
  ffmpeg -y -i take-A-raw.mp3 -vn -ar 16000 -ac 1 take-A-16k.wav 2>/dev/null
  ffmpeg -y -i take-A-raw.mp3 -vn -ar 48000 -ac 1 take-A-48k.wav 2>/dev/null
fi
if [ ! -s take-B-16k.wav ] || [ ! -s take-B-48k.wav ]; then
  log "1b. Convert take B raw mp3 → wav (16k mono + 48k mono)"
  ffmpeg -y -i take-B-raw.mp3 -vn -ar 16000 -ac 1 take-B-16k.wav 2>/dev/null
  ffmpeg -y -i take-B-raw.mp3 -vn -ar 48000 -ac 1 take-B-48k.wav 2>/dev/null
fi

# ─── Step 2 — parakeet transcription ────────────────────────────────────
if [ ! -s take-A-words.json ]; then
  log "2a. Parakeet → take-A-words.json"
  python3 parakeet_to_json.py take-A-16k.wav take-A-words.json
fi
if [ ! -s take-B-words.json ]; then
  log "2b. Parakeet → take-B-words.json"
  python3 parakeet_to_json.py take-B-16k.wav take-B-words.json
fi

# ─── Step 3 — script extraction ─────────────────────────────────────────
log "3. Extract script sentences"
python3 extract_script_sentences.py "$SCRIPT_MD" script-sentences.json

# ─── Step 4 — alignment per take ────────────────────────────────────────
log "4a. Align take A (retake-aware)"
python3 align_to_parakeet.py script-sentences.json take-A-words.json align-A.json
log "4b. Align take B (retake-aware)"
python3 align_to_parakeet.py script-sentences.json take-B-words.json align-B.json

# ─── Step 5 — manifest ──────────────────────────────────────────────────
log "5. Build manifest (with overrides if present)"
if [ -n "$OVERRIDES" ]; then
  python3 build_manifest.py script-sentences.json align-A.json align-B.json "$OVERRIDES" manifest.json
else
  python3 build_manifest.py script-sentences.json align-A.json align-B.json manifest.json
fi

# ─── Step 6 — audio cleanup ─────────────────────────────────────────────
if [ ! -s take-A-clean.wav ]; then
  log "6a. DeepFilterNet → take-A-clean.wav"
  python3 /Users/maxguillabert/Downloads/index/video/scripts/clean_audio.py take-A-48k.wav take-A-clean.wav
fi
if [ ! -s take-B-clean.wav ]; then
  log "6b. DeepFilterNet → take-B-clean.wav"
  python3 /Users/maxguillabert/Downloads/index/video/scripts/clean_audio.py take-B-48k.wav take-B-clean.wav
fi

# ─── Step 7 — publish to the Remotion project ───────────────────────────
log "7. Publish — copy cleaned audio + video into Remotion public + composition"
cp -f take-A-clean.wav "$VIDEO_PUBLIC/take-A-clean.wav"
cp -f take-B-clean.wav "$VIDEO_PUBLIC/take-B-clean.wav"
# Hardlink the video instead of copying — saves 956MB
if [ ! -e "$VIDEO_PUBLIC/take-A-video.mp4" ]; then
  ln "$(pwd)/take-A-video.mp4" "$VIDEO_PUBLIC/take-A-video.mp4" 2>/dev/null \
    || cp -f take-A-video.mp4 "$VIDEO_PUBLIC/take-A-video.mp4"
fi
cp -f manifest.json "$COMPOSITION_DIR/manifest.json"

log "Done. Open Remotion Studio: cd ../../../video && npx remotion studio --port 3333 → AntiCheatVideo"
