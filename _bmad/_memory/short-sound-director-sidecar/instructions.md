# Short Sound Director — Instructions

## Working Directory

Agent operates in `_bmad-output/youtube/video/{video-name}/`.
All input files are relative to this directory. All output files are written here.

## Input File Requirements

| File | Required | Description |
|------|----------|-------------|
| `script.md` | YES | Sentence-by-sentence script, one sentence per line |
| `*.mp3` or `*.wav` or `*.WAV` | YES | Raw audio recording with multiple takes |
| `report/video_analysis_report.md` | YES | Recut's analysis of the reference video |
| `data/sfx_analysis.json` | Recommended | SFX catalog from reference video |
| `data/color_analysis.json` | Recommended | Color palette from reference video |
| `data/transition_analysis.json` | Recommended | Transition patterns from reference video |
| `data/motion_analysis.json` | Optional | Motion/optical flow from reference |
| `data/typography_analysis.json` | Optional | Text styling from reference |
| `stems/2stem/` | Optional | Extracted vocals + music_sfx from reference |
| `stems/4stem/` | Optional | Extracted vocals + drums + bass + other |

## Output Files

| File | Produced By | Description |
|------|-------------|-------------|
| `transcript.json` | TR | Whisper output with word timestamps and take decisions |
| `voice.wav` | CT | Assembled clean voice track |
| `voice-timing.json` | CT | Word-level timestamps for assembled voice |
| `direction.json` | DR | Machine-readable shot list (shots.ts-compatible) |
| `direction-report.md` | DR | Human-readable creative decision summary |

## Whisper Configuration

```bash
# Recommended flags
whisper raw_audio.wav \
  --model large-v3 \
  --word_timestamps True \
  --output_format json \
  --language en \
  --condition_on_previous_text False
```

- `--condition_on_previous_text False` prevents Whisper from hallucinating repeated text
- `large-v3` for best word boundary accuracy
- If audio is noisy, consider `--initial_prompt "Script keywords here"` to guide recognition

## Take Detection Algorithm

1. Parse Whisper segments into sentence-level groups
2. For each group, fuzzy-match against script.md sentences:
   - Token overlap ratio > 0.6 = potential match
   - If multiple script sentences match, use longest common subsequence
3. Build take map: `{ scriptLine: N, takes: [{ segmentIdx, startTime, endTime, text }] }`
4. For each script line with multiple takes: mark all but the LAST as CUT
5. Edge case — paragraph retakes:
   - If 3+ consecutive script lines all have retakes starting at similar timestamps,
     treat as a paragraph retake (speaker went back to redo a full section)
   - Keep the last contiguous block

## FFmpeg Cut Patterns

```bash
# Single segment extraction with GENEROUS padding (200ms before, 500ms after)
# Whisper end timestamps are 50-200ms too early — always pad generously
ffmpeg -i raw_audio.wav -ss {start - 0.20} -to {end + 0.50} -c:a pcm_s16le segment_{n}.wav

# Concatenation from file list
# segments.txt format: file 'segment_1.wav'\nfile 'gap.wav'\nfile 'segment_2.wav'\n...
ffmpeg -f concat -safe 0 -i segments.txt -c copy voice.wav
```

## Audio Quality Pipeline (CRITICAL)

### Proven Pipeline — Follow This Exactly
```
1. Cut segments from raw recording (generous padding — see above)
2. Per segment: ONLY sox highpass 80 lowpass 14000 (bandpass, nothing else)
3. Per segment: sox fade t 0.020 0 0.020 (20ms fade in/out)
4. Apply persona/character FX where needed (pitch/reverb) — NO norm in FX chain
5. Extract 250ms room tone from quiet section of recording → use as gap.wav
6. Assemble with ffmpeg concat (segments alternating with room tone gap.wav)
7. Normalize ONCE on the full assembly: sox assembled.wav final.wav norm -1
8. Post-assembly enhancement (see Voice Enhancement section below):
   a. Click/pop removal — detect transient spikes, repair by crossfade interpolation
   b. DeepFilterNet noise reduction — AI-based, single pass on full assembly
   c. Gentle HF rolloff — Butterworth order 2, cutoff 19kHz
9. Save every version as voice_vNN.wav for comparison
```

### Voice Enhancement (Step 8 — Post-Assembly)

Run ONCE on the normalized full assembly. This replaces per-segment noise reduction.
Validated against Adobe Enhance Speech: spectral match within +/-0.15 dB across audible bands.

**Prerequisites:** `pip install deepfilternet librosa scipy soundfile numpy`

#### 8a. Click/Pop Removal

Detect transients where peak amplitude > 2x surrounding RMS, repair by crossfade:

```python
import numpy as np, librosa, soundfile as sf
from scipy.ndimage import median_filter

y, sr = librosa.load("voice.wav", sr=None, mono=True)

# Auto-detect clicks
frames = librosa.util.frame(y, frame_length=256, hop_length=64)
energy = np.sqrt(np.mean(frames**2, axis=0))
ctx = max(3, int(0.03 * sr / 64)) | 1
local_med = median_filter(energy, size=ctx)
ratio = energy / (local_med + 1e-10)
thresh = np.percentile(energy, 90) * 0.3
spikes = np.where((ratio > 4.0) & (energy > thresh))[0]

# Group consecutive spike frames, repair each click region
result = y.copy()
if len(spikes) > 0:
    groups, cur = [], [spikes[0]]
    for i in range(1, len(spikes)):
        if spikes[i] - spikes[i-1] <= 3: cur.append(spikes[i])
        else: groups.append(cur); cur = [spikes[i]]
    groups.append(cur)

    for g in groups:
        if len(g) > int(0.1*sr/64): continue  # skip if > 100ms (not a click)
        si = max(0, g[0]*64 - int(0.01*sr))
        ei = min(len(result), (g[-1]+1)*64 + 256 + int(0.01*sr))
        pk = np.max(np.abs(result[si:ei]))
        ctx_b = result[max(0,si-int(0.1*sr)):si]
        ctx_a = result[ei:min(len(result),ei+int(0.1*sr))]
        cr = np.sqrt(np.mean(np.concatenate([ctx_b,ctx_a])**2)) if len(ctx_b)+len(ctx_a)>0 else 0.001
        if pk/(cr+1e-10) > 2.0:
            n = ei-si
            pre = result[si-min(int(0.003*sr),si):si]
            post = result[ei:ei+min(int(0.003*sr),len(result)-ei)]
            pe = np.interp(np.linspace(0,len(pre)-1,n), np.arange(len(pre)), pre)
            po = np.interp(np.linspace(0,len(post)-1,n), np.arange(len(post)), post)
            result[si:ei] = pe*np.linspace(1,0,n) + po*np.linspace(0,1,n)

sf.write("voice_declicked.wav", result, sr, subtype='PCM_16')
```

#### 8b. DeepFilterNet Noise Reduction

```bash
deepFilter voice_declicked.wav --output-dir . --no-suffix
# Output overwrites voice_declicked.wav with denoised version
```

This is NOT the same as `sox noisered`. DeepFilterNet is an AI model trained on speech:
- No "musical noise" artifacts — the #1 problem with spectral subtraction
- Preserves voice dynamics (no compression effect)
- Preserves sibilants (no de-essing)
- ~16 dB noise floor reduction in one pass
- Safe on clean recordings (minimal effect if noise is already low)

#### 8c. Gentle HF Rolloff

```python
from scipy import signal as sig
y, sr = librosa.load("voice_declicked.wav", sr=None, mono=True)
b, a = sig.butter(2, 19000/(sr/2), btype='low')
y_out = sig.filtfilt(b, a, y)
sf.write("voice_enhanced.wav", y_out, sr, subtype='PCM_16')
```

Butterworth order 2, cutoff 19kHz. Flat across all audible frequencies, only attenuates
inaudible artifacts above 18kHz. This is NOT an EQ — it does not color the voice.

#### When to Skip Enhancement
- Recording was done in a treated studio with no background noise → skip 8b
- No audible clicks/pops → skip 8a
- Already enhanced externally (e.g., Adobe Enhance Speech) → skip all of step 8

### NEVER Do These (Proven to Cause Artifacts)
- **NO per-segment `norm -1`** — amplifies quiet regions (breaths, noise) up to 22x. This is the #1 source of breath and artifact problems.
- **NO `sox noisered` above 0.25** — spectral subtraction > 0.25 creates "musical noise" (tonal chirping in quiet regions). Even 0.25 is rarely needed if the recording is clean.
- **NO `noisered` at all if the recording is clean** — bandpass handles rumble/hiss. Only use noisered if there's audible hiss.
- **NO noise profile across recording sessions** — each recording has different noise. Never apply one recording's profile to another.
- **NO `compand` (noise gate)** — creates pumping artifacts with speech.
- **NO de-esser** (`equalizer 6000 2000h -6`) — removes vocal presence.
- **NO Whisper timestamps for audio trimming/silencing** — end timestamps are 50-200ms too early, cutting trailing consonants. Use energy-based detection (librosa) for any audio manipulation.
- **NO compounding processing steps** — each step adds artifacts. Start minimal. Add ONE thing at a time only if needed.

### Room Tone Gaps (Not Digital Silence)
Digital silence (0.0 RMS) between segments creates harsh contrast that makes every breath pop out. Instead:
1. Find the quietest section of the raw recording using energy analysis
2. Extract 250ms of natural room tone from that section
3. Use this as gap.wav between segments
This makes transitions sound natural instead of jarring.

### Level Matching Across Recordings
When segments come from different recording sessions (different mic, gain, room):
- Match RMS levels within each session first
- Then balance sessions against each other
- Match to the same session's level, not to a global target
- NEVER apply aggressive gain reduction (> 6dB) — likely means something is wrong

### Word Boundary Verification
Whisper's word-end timestamps are unreliable for editing. After cutting:
1. Use `librosa.effects.split(y, top_db=25-30)` to verify speech boundaries
2. Check energy decay after Whisper's reported word end — words like "cars", "stocks" ring 200-600ms past
3. Always listen to segment boundaries before assembly
4. If a word sounds cut: extend the segment, don't try to fix with processing

## Pacing Analysis Method

From reference video report, extract:
- **Total duration** and **sentence count** → average sentence duration
- **Cuts/second curve** — usually accelerates: 0.2 cuts/s (intro) → 1.6 cuts/s (climax)
- **Pause pattern** — where in the narrative arc pauses appear (setup vs payoff)
- **Beat alignment** — if music is 120 BPM, cuts often fall on beats (every 0.5s)

Map onto new script:
- Scale sentence count: if reference has 25 sentences in 80s and new script has 20 sentences in 65s, proportionally adjust
- Preserve acceleration shape: intro sentences get more time, climax sentences get less
- Insert micro-pauses (100-200ms) between sections for breathing room

## Style Constraints

- **NO AI-generated video** — backgrounds must be static images, gradients, or solid colors
- **Chibi characters only** — no real human footage or AI avatar
- **Images** — describe what to source or create (stock photo, screenshot, illustration)
- **Music v1** — use original creator's extracted stems from stems/ folder
- **SFX** — describe type needed (impact, whoosh, riser, stinger) + suggest from reference catalog
