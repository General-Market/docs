#!/bin/bash
# Cut short-02 audio: pick last take of each script sentence, concatenate
set -e

SRC="/Users/maxguillabert/Downloads/video/public/shorts/short-02/voice-raw.wav"
OUTDIR="/Users/maxguillabert/Downloads/video/public/shorts/short-02/segments"
FINAL="/Users/maxguillabert/Downloads/video/public/shorts/short-02/voice.wav"

mkdir -p "$OUTDIR"

echo "=== Cutting segments from source audio ==="

# Each segment: pre-pad ~100-200ms before first word, ~200-300ms after last word
# Timestamps from Whisper (based on 16kHz transcription, valid for 48kHz source)

# 1. "In Miami, there was a guy flipping used cars."
# seg 0: words 0.00-3.16 (only take)
ffmpeg -y -i "$SRC" -ss 0.00 -to 3.40 "$OUTDIR/seg01.wav" 2>/dev/null

# 2. "One day, he saw a forex trader."
# seg 1: words 8.22-11.54 (only take)
ffmpeg -y -i "$SRC" -ss 8.05 -to 11.80 "$OUTDIR/seg02.wav" 2>/dev/null

# 3. "Forex traders make more than me. I want to trade forex."
# seg 3: words 25.52-29.0 (only complete take; seg 2 was false start)
ffmpeg -y -i "$SRC" -ss 25.35 -to 29.20 "$OUTDIR/seg03.wav" 2>/dev/null

# 4. "So he became the forex trader."
# seg 8 (66.08-68.54): LAST of 5 takes (seg 4,5,6,7,8)
ffmpeg -y -i "$SRC" -ss 65.90 -to 68.80 "$OUTDIR/seg04.wav" 2>/dev/null

# 5. "But then he saw a stock trader."
# seg 9: words 74.38-77.2 (only take)
ffmpeg -y -i "$SRC" -ss 74.20 -to 77.50 "$OUTDIR/seg05.wav" 2>/dev/null

# 6. "Stocks are easier than forex. I want to trade stocks."
# seg 10: words 84.74-89.0 (only take)
ffmpeg -y -i "$SRC" -ss 84.55 -to 89.25 "$OUTDIR/seg06.wav" 2>/dev/null

# 7. "And he became the stock trader."
# seg 11: words 94.72-97.5 (only take)
ffmpeg -y -i "$SRC" -ss 94.55 -to 97.75 "$OUTDIR/seg07.wav" 2>/dev/null

# 8. "Then he saw bitcoin futures."
# seg 12: words 102.72-105.34 (only take; seg 13 is just an echo)
ffmpeg -y -i "$SRC" -ss 102.55 -to 105.60 "$OUTDIR/seg08.wav" 2>/dev/null

# 9a. "Bitcoin is faster than any stock."
# seg 14: words 111.96-115.6 (only take)
ffmpeg -y -i "$SRC" -ss 111.80 -to 115.85 "$OUTDIR/seg09a.wav" 2>/dev/null

# 9b. "I want to trade bitcoin."
# seg 15: words 130.4-132.6 (only take; gap from 9a is recording gap, not natural pause)
ffmpeg -y -i "$SRC" -ss 130.25 -to 132.85 "$OUTDIR/seg09b.wav" 2>/dev/null

# 10. "And he traded bitcoin."
# seg 20 (151.02-152.84): LAST of 4 takes (seg 17,18,19,20)
ffmpeg -y -i "$SRC" -ss 150.85 -to 153.10 "$OUTDIR/seg10.wav" 2>/dev/null

# 11. "But Goldman Sachs was on the other side of every trade."
# seg 21 (160.08-164.76): best usable take (seg 22 has corrupted word timestamps)
ffmpeg -y -i "$SRC" -ss 159.90 -to 165.00 "$OUTDIR/seg11.wav" 2>/dev/null

# 12. "The hedge funds were stronger than him, he thought."
# seg 27 (181.68-184.94): LAST of 2 takes (seg 26,27)
ffmpeg -y -i "$SRC" -ss 181.50 -to 185.20 "$OUTDIR/seg12.wav" 2>/dev/null

# 13. "So he switched to zero-DTE options."
# seg 30 (197.46-200.7): LAST of 2 complete takes (seg 28,30; seg 29 was false start)
ffmpeg -y -i "$SRC" -ss 197.28 -to 200.95 "$OUTDIR/seg13.wav" 2>/dev/null

# 14+15. "Then the hedge funds followed him there too. So he jumped to memecoins."
# seg 31+32: continuous (only 0.3s gap), cutting as one piece
ffmpeg -y -i "$SRC" -ss 210.05 -to 216.25 "$OUTDIR/seg14_15.wav" 2>/dev/null

# 16. "And the hedge funds showed up in memecoins."
# seg 34: words 221.68-225.0 (only take)
ffmpeg -y -i "$SRC" -ss 221.50 -to 225.25 "$OUTDIR/seg16.wav" 2>/dev/null

# 17. "So he thought... Maybe prediction markets — Polymarket — that's where I'll have an edge."
# seg 37+38 (247.26-254.3): LAST complete take (seg 35+36 was first take)
# Includes natural dramatic pause between "thought..." and "Maybe"
ffmpeg -y -i "$SRC" -ss 247.08 -to 254.55 "$OUTDIR/seg17.wav" 2>/dev/null

# 18. "And finally he traded Polymarket."
# seg 40 (268.88-272.3): LAST of 2 takes (seg 39,40)
ffmpeg -y -i "$SRC" -ss 268.70 -to 272.55 "$OUTDIR/seg18.wav" 2>/dev/null

# 19. "But then Citadel and Jump Trading were right there, cutting into his profits."
# seg 41 (287.12-294.46): only take
ffmpeg -y -i "$SRC" -ss 286.95 -to 294.70 "$OUTDIR/seg19.wav" 2>/dev/null

# 20. "And so he realized — I want to go back — I want to go back to flipping cars."
# seg 54+55 (427.64-431.82): LAST complete take of the retake session
ffmpeg -y -i "$SRC" -ss 427.45 -to 432.05 "$OUTDIR/seg20.wav" 2>/dev/null

# 21+22. "That's the lesson. The edge was always in the niche."
# seg 58 (444.04-448.74): LAST complete take
ffmpeg -y -i "$SRC" -ss 443.85 -to 448.95 "$OUTDIR/seg21_22.wav" 2>/dev/null

# 23. "See you on AgiArena."
# seg 59 (454.0-456.26): LAST standalone take
ffmpeg -y -i "$SRC" -ss 453.80 -to 456.50 "$OUTDIR/seg23.wav" 2>/dev/null

echo "=== All segments cut ==="

# Create concat file list
cat > "$OUTDIR/filelist.txt" << 'EOF'
file 'seg01.wav'
file 'seg02.wav'
file 'seg03.wav'
file 'seg04.wav'
file 'seg05.wav'
file 'seg06.wav'
file 'seg07.wav'
file 'seg08.wav'
file 'seg09a.wav'
file 'seg09b.wav'
file 'seg10.wav'
file 'seg11.wav'
file 'seg12.wav'
file 'seg13.wav'
file 'seg14_15.wav'
file 'seg16.wav'
file 'seg17.wav'
file 'seg18.wav'
file 'seg19.wav'
file 'seg20.wav'
file 'seg21_22.wav'
file 'seg23.wav'
EOF

echo "=== Concatenating segments ==="
ffmpeg -y -f concat -safe 0 -i "$OUTDIR/filelist.txt" -c copy "$FINAL" 2>/dev/null

# Convert to MP3 for Remotion
ffmpeg -y -i "$FINAL" -codec:a libmp3lame -b:a 192k "/Users/maxguillabert/Downloads/video/public/shorts/short-02/voice.mp3" 2>/dev/null

# Get duration
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$FINAL")
echo "=== Done! Final duration: ${DURATION}s ==="
echo "  WAV: $FINAL"
echo "  MP3: /Users/maxguillabert/Downloads/video/public/shorts/short-02/voice.mp3"
