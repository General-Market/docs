# Video Analysis Report — "The Stonecutter"

**Source:** `https://www.youtube.com/watch?v=mtXnbWCq4go`
**Format:** 1080x1920 (9:16 vertical), AV1 codec, 25fps
**Duration:** 1min 22s (82.5s)
**Genre:** AI-generated short-form narrative (likely Kling/Sora-style)

---

## 1. Full Script (Whisper Transcription — word-level timestamps)

| Timecode | Line | Keywords (yellow) |
|----------|------|-------------------|
| 0.00–3.36 | In Japan, there was a **poor man** cutting stone. | poor man |
| 3.90–6.46 | One day, he saw a **rich man**. | rich |
| 6.88–8.28 | Rich people are stronger than me. | Rich |
| 9.10–10.00 | I want to be **rich**! | rich |
| 10.46–12.70 | Suddenly, he became the **rich man**. | rich |
| 12.96–14.80 | But then he saw a **king**. | king |
| 15.40–17.00 | The **king** is stronger than the rich. | king |
| 17.62–18.82 | I want to be **king**! | King |
| 19.30–21.14 | And he became **the king**. | the king |
| 21.50–23.74 | Then he saw **the sun** in the sky. | the sun |
| 24.40–26.60 | **The sun** is stronger than any king. | The sun |
| 27.18–29.04 | I want to be **the sun**! | the sun |
| 29.04–31.20 | And he became **the sun**. | the sun |
| 31.68–33.82 | But a **cloud** blocked his light. | cloud |
| 34.32–37.30 | The **cloud** was stronger than the sun, he thought. | cloud |
| 37.76–39.70 | So he became **the cloud**. | the cloud |
| 40.04–42.36 | Then **the wind** pushed the cloud. | the wind |
| 42.76–45.80 | So he decided to become **the wind**. | the wind |
| 46.26–48.50 | And the wind hit a **mountain**. | mountain |
| 49.12–50.18 | So he thought, | — |
| 50.64–52.20 | The **mountain** is stronger than the wind. | mountain |
| 53.64–54.62 | I want to be the **mountain**! | mountain |
| 54.62–58.12 | And finally, he became **the mountain**. | the mountain |
| 59.52–60.28 | But then, | — |
| 61.82–65.56 | a poor **stone cutter** came with his hammer | stone cutter |
| 65.56–68.48 | and began to cut the **mountain**. | mountain |
| 69.04–71.78 | And so, he wished to become... | — |
| 71.78–72.60 | I want to be king! *(rapid flashback)* | — |
| 72.66–75.22 | I want to be the **stone cutter**. | stone cutter |
| 76.82–77.54 | That's one minute. | 1 minute |
| 78.02–78.42 | See you tomorrow. | — |

**Narration type:** Male voiceover, English, calm/deliberate storytelling tone.
**Voice-to-music ratio:** 1.99:1 (voice dominates throughout, music takes over only in final 5s)

---

## 2. Story & Narrative Structure

The video retells the Japanese folk tale **"The Stonecutter"** (石工の話) — a parable about desire and the cycle of power. A poor stonecutter envies those stronger than him, wishes to transform, and cycles through increasingly powerful forms before returning to where he started.

### Story Arc (8 acts)

| Act | Time | Transformation | Visual Setting |
|-----|------|----------------|----------------|
| 1 | 0:00–0:08 | **Poor stonecutter** cutting rock | Quarry, harsh sun, ropes, physical labor |
| 2 | 0:08–0:15 | Sees a **rich man** → becomes rich | Market town, blue kimono, parasol, entourage |
| 3 | 0:15–0:24 | Sees a **king** → becomes king | Royal procession, ornate red/gold robes, throne room |
| 4 | 0:24–0:35 | Sees **the sun** → becomes the sun | Palace courtyard, sun behind Mt. Fuji, golden glow |
| 5 | 0:35–0:47 | A **cloud** blocks him → becomes cloud | Night sky over village, towering cumulus, moonlit |
| 6 | 0:47–0:55 | **Wind** pushes the cloud → becomes wind | Motion blur, leaves, speed lines |
| 7 | 0:55–1:09 | Hits a **mountain** → becomes mountain | Cliff face, Mt. Fuji base, seated meditating figure |
| 8 | 1:09–1:22 | A stonecutter **cuts him** → back to stonecutter | Full circle — quarry, chisel, fade to white |

---

## 3. VFX Techniques Identified

### 3.1 AI Image/Video Generation
The entire video appears to be **AI-generated** (text-to-video or image-to-video). Key tells:
- Consistent character face across wildly different settings (AI face consistency techniques)
- Hyper-detailed textures on costumes that shift slightly between frames
- Hands occasionally show AI artifacts (scene_0021: hand in clouds has slight distortion)
- Backgrounds have painterly/composite quality rather than photographic realism

### 3.2 Lens Flare / Light Leak Transitions (Measured)

**9 distinct light leak regions detected** via frame-by-frame brightness analysis (threshold: avg brightness > 190):

| # | Timecode | Duration | Frames | Peak Brightness | Type |
|---|----------|----------|--------|-----------------|------|
| 1 | 10.40–10.52s | 0.160s | 4 | 249.3 | Flash triplet |
| 2 | 15.32–15.44s | 0.160s | 4 | 250.2 | Flash triplet |
| 3 | 24.32–24.48s | 0.200s | 5 | 251.5 | Flash triplet |
| 4 | 50.52–50.64s | 0.160s | 4 | 250.2 | Flash triplet |
| 5 | 55.08–55.16s | 0.120s | 3 | — | Quick flash |
| 6 | 59.56–59.84s | 0.320s | 8 | — | Extended wash |
| 7 | 69.04–69.16s | 0.160s | 4 | 249.8 | Flash triplet |
| 8 | 76.80–76.92s | 0.160s | 4 | 249.4 | Flash triplet |
| 9 | 79.28–79.56s | 0.320s | 8 | — | Final fade-out |

**Flash-cut triplet pattern:** 3 cuts within 0.2s (5 frames), middle frame peaks at ~250/255 brightness. Used 6 times at transformation moments.

**Standard light leak duration: 4–5 frames (0.16–0.20s)**
**Extended wash: 8 frames (0.32s)** — used for bigger narrative transitions (mountain section, ending)

### 3.3 Color Grading — Exact Values Per Shot

Each transformation has a measured color palette (dominant hex via k-means clustering):

| Act | Scene | Dominant Color 1 | Color 2 | Color 3 | Avg Brightness | Contrast |
|-----|-------|-------------------|---------|---------|----------------|----------|
| **Stonecutter** | 0001 | `#462a1c` (50%) | `#a86e43` (36%) | `#e3e1dc` (14%) | 101.4 | 65.3 |
| | 0002 | `#945e3b` (50%) | `#e4dabe` (29%) | `#3c1c13` (21%) | 122.4 | 70.0 |
| | 0004 | `#7e4f34` (56%) | `#24130f` (29%) | `#dccda2` (15%) | 88.0 | 60.4 |
| **Light leak** | 0005 | `#f99450` (62%) | `#faad6f` (30%) | `#fce2bf` (9%) | 181.1 | 18.6 |
| | 0006 | `#ffca65` (50%) | `#fff0a8` (34%) | `#fff1ec` (16%) | 222.8 | 19.7 |
| **Rich man** | 0007 | `#f7f3b6` (46%) | `#402219` (29%) | `#e2ab69` (25%) | 167.4 | 85.5 |
| | 0008 | `#0c102a` (46%) | `#dcd9ce` (33%) | `#a96e3f` (22%) | 103.1 | 88.8 |
| **King** | 0013 | `#c04b10` (41%) | `#370f06` (39%) | `#edb36a` (20%) | 90.9 | 64.3 |
| | 0014 | `#d3e5f2` (45%) | `#221e31` (30%) | `#934c3a` (25%) | 137.8 | 89.8 |
| **Sun** | 0019 | `#f9d8a7` (33%) | `#2c1608` (27%) | — | 134.1 | 78.3 |
| | 0020 | `#f0d2a3` (42%) | `#b67830` (33%) | `#39230c` (25%) | 144.0 | 74.0 |
| **Cloud** | 0022 | `#031528` (61%) | `#2b5b84` (23%) | `#a0bcd0` (17%) | 60.6 | 64.1 |
| | 0023 | `#315d8e` (42%) | `#a4bdcd` (34%) | `#031223` (25%) | 101.5 | 69.5 |
| **Wind** | 0025 | `#edefea` (47%) | `#ca845c` (30%) | `#385c8b` (23%) | 177.9 | 68.8 |
| | 0027 | `#596990` (41%) | `#cac4bc` (34%) | `#100a0a` (25%) | 112.7 | 73.3 |
| **Mountain** | 0035 | `#3a2423` (61%) | `#c9ae8b` (26%) | `#c8ebf5` (13%) | 100.9 | 77.6 |
| | 0045 | `#767c7d` (40%) | `#b4bcbb` (35%) | `#45484a` (25%) | 132.8 | 48.1 |
| **Buddha statue** | 0046 | `#232a2b` (38%) | `#94918a` (32%) | `#565855` (30%) | 88.1 | 46.6 |
| **End fade** | 0051 | `#fcfcfa` (67%) | `#fcebcd` (21%) | `#fabc9e` (12%) | 243.5 | 16.8 |

**Color summary per act:**
- **Stonecutter:** HSV ~(22, 130, 130) — desaturated warm brown
- **Rich man:** HSV ~(35, 123, 194) — golden warm
- **King:** HSV ~(13, 209, 150) — deep red/amber, high saturation
- **Sun:** HSV ~(18, 144, 177) — hot golden
- **Cloud:** HSV ~(93, 186, 93) — deep cool blue, darkest act
- **Wind:** HSV ~(40, 92, 214) — washed out, high brightness
- **Mountain:** HSV ~(52, 104, 122) — muted earthy neutral
- **End:** HSV ~(10, 23, 253) — near white, minimal saturation

### 3.4 Compositing & Scale VFX
- **Giant figure over landscape** (scene_0020): Character as the sun — composited at enormous scale over Mt. Fuji with halo/glow effect behind head
- **Cloud-figure merge** (scene_0023): Character arms spread with cloud formations shaped around him
- **Mountain-carved statue** (scene_0046): Character's face carved into mountain as a giant Buddha-like statue — VFX composite of face + mountain terrain
- **Speed/motion effects** (scene_0025, 0032): Extreme radial blur simulating superhuman speed for wind transformation

---

## 4. Typography & Text Overlays

### 4.1 Text Colors (Pixel-Sampled)

| Element | Hex | RGB | Notes |
|---------|-----|-----|-------|
| **White text** | `#f4f1e9` | (244, 241, 233) | Warm white, not pure — slight cream tint |
| **Yellow keywords** | `#eccb56` | (236, 203, 86) | Warm gold-yellow, saturated |

**White text range:** R: 212–255, G: 205–253, B: 190–252 (shifts warmer in warm scenes)
**Yellow text range:** R: 182–255, G: 148–249, B: 18–145 (shifts more orange in warm scenes, greener in cool scenes)

### 4.2 Text Style
- **Position:** Center-frame, lower third (~45–70% from top)
- **Font:** Sans-serif, bold weight, appears to be a rounded grotesque (similar to **Montserrat Bold** or **Poppins Bold**)
- **Shadow:** Present — dark surround, average shadow brightness ~82–133 (adapts to scene). Likely a **black drop shadow or stroke** with reduced opacity
- **Size:** Approximately 5–6% of frame height per text line (~100–115px at 1920px height)
- **Animation:** Text appears to **hard-cut in sync with narration** — no fade, no type-on effect. Appears on the frame the word is spoken.
- **Keyword highlighting:** One or two words per line are colored `#eccb56` yellow — always the "power noun" (rich, king, sun, cloud, wind, mountain, stone cutter)

---

## 5. Camera Motion Per Shot (Optical Flow Analysis)

### 5.1 Motion Summary

| Motion Type | Count | Scenes |
|-------------|-------|--------|
| **Static** (no significant motion) | 22 | Most dialogue/narration shots |
| **Zoom in** (slow push) | 7 | Scenes 1, 2, 4, 7, 11, 30, 40, 45 |
| **Zoom out** (slow pull) | 10 | Scenes 3, 8, 12, 13, 17, 20, 26, 36, 41, 44, 47 |
| **Tilt down** | 2 | Scenes 1, 32 |
| **Tilt up** | 2 | Scenes 3, 40 |
| **Pan** | 1 | Scene 30 (pan left) |
| **Fast motion** | 1 | Scene 30 (wind transformation — highest magnitude) |
| **Flash frame** (too short) | 10 | Scenes 6, 10, 16, 24, 25, 29, 31, 38, 48, 49 |

### 5.2 Per-Scene Detail

| Scene | Time | Duration | Motion | dX | dY | Zoom | Magnitude |
|-------|------|----------|--------|-----|-----|------|-----------|
| 1 | 1.64s | 2.00s | tilt_down + zoom_in | -0.17 | -1.20 | +0.94 | 1.22 |
| 2 | 3.92s | 1.64s | static + zoom_in | -0.06 | +0.16 | +0.71 | 0.17 |
| 3 | 5.56s | 1.28s | tilt_up + zoom_out | +0.02 | +1.12 | -1.19 | 1.13 |
| 4 | 6.84s | 2.00s | static + zoom_in | +0.01 | +0.02 | +0.65 | 0.03 |
| 7 | 10.56s | 2.00s | static + zoom_in | -0.02 | +0.00 | +0.96 | 0.02 |
| 8 | 13.16s | 2.00s | static + zoom_out | -0.00 | +0.01 | -0.91 | 0.01 |
| 12 | 17.36s | 2.00s | static + zoom_out | +0.01 | +0.04 | -1.15 | 0.04 |
| 20 | 31.68s | 2.00s | static + zoom_out | +0.00 | +0.08 | -1.29 | 0.08 |
| 26 | 44.48s | 2.00s | static + zoom_out | +0.00 | -0.03 | -1.60 | 0.03 |
| 30 | 50.68s | 2.00s | **pan_left + tilt_up + zoom_in** | +0.67 | +1.55 | +1.86 | **1.69** |
| 32 | 55.16s | 2.00s | tilt_down | -0.11 | -0.68 | -0.15 | 0.69 |
| 36 | 67.36s | 1.64s | static + zoom_out | -0.00 | -0.00 | **-2.79** | 0.00 |
| 40 | 71.84s | 0.40s | tilt_up + zoom_in | -0.02 | +1.22 | +1.23 | 1.22 |
| 44 | 72.96s | 0.24s | static + zoom_out | -0.00 | +0.00 | **-3.41** | 0.00 |

**Key patterns:**
- Narration shots use **subtle slow zoom** (push in for intimacy, pull out for reveal)
- **Strongest motion** is scene 30 (50.68s) — the wind transformation, combining pan + tilt + zoom = magnitude 1.69
- **Fastest zoom out** at scene 44 (72.96s, zoom -3.41) — the rapid recap montage
- Flash frames (10 total) are **2–3 frames long** — too short for motion, purely transitional

---

## 6. Audio Stem Separation (Demucs)

### 6.1 Stems Produced
- `vocals.wav` — Isolated narration voice
- `no_vocals.wav` — Music + SFX (accompaniment)

### 6.2 Voice vs Music Balance

| Section | Vocal Energy | Music Energy | Dominant | Notes |
|---------|-------------|-------------|----------|-------|
| 0–5s | 0.1013 | 0.0432 | **Voice** | Opening narration |
| 5–10s | 0.0993 | 0.0226 | **Voice** | Rich man introduction |
| 10–15s | 0.1221 | 0.0437 | **Voice** | First transformation |
| 15–20s | 0.0946 | 0.0495 | **Voice** | King section |
| 20–25s | 0.1053 | 0.0357 | **Voice** | Sun introduction |
| 25–30s | 0.1067 | 0.0750 | **Voice** | Music rises with sun |
| 30–35s | 0.1016 | 0.0527 | **Voice** | Cloud section |
| 35–40s | 0.0935 | 0.0425 | **Voice** | Cloud transformation |
| 40–45s | 0.1185 | 0.0760 | **Voice** | Wind — music peaks |
| 45–50s | 0.0833 | 0.0591 | **Voice** | Mountain approach |
| 50–55s | 0.0775 | 0.0306 | **Voice** | Mountain section |
| 55–60s | 0.0735 | 0.0443 | **Voice** | Mountain becomes |
| 60–65s | 0.0969 | 0.0228 | **Voice** | Stonecutter returns |
| 65–70s | 0.0935 | 0.0273 | **Voice** | Cutting the mountain |
| 70–75s | 0.0693 | 0.0372 | **Voice** | Final wish + recap |
| 75–80s | 0.0303 | 0.0620 | **Music** | CTA ("That's 1 min") |
| 80–82s | 0.0001 | 0.0284 | **Music** | Fade to silence |

**Voice dominates 88% of the video.** Music only takes over in the final 7 seconds (CTA + outro).

### 6.3 Speech Regions (36 detected)
Total speech time: ~52s out of 82.5s = **63% speech coverage**
Longest speech gap: **52.2–53.6s** (1.4s dramatic pause before "I want to be the mountain!")

### 6.4 Audio Layer Structure
```
0s            20s           40s           60s           80s
|─────────────|─────────────|─────────────|─────────────|──|
VOICE ████████████████████████████████████████████████████░░
MUSIC ░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓████████████████████████▓▓
SFX   ⚡   ⚡    ⚡   ⚡         ⚡   ⚡    ⚡   ⚡ ⚡  ⚡⚡⚡⚡ ⚡

⚡ = impact/whoosh SFX at transformation points
```

---

## 7. SFX (Sound Effects) — Detailed 4-Stem Analysis

### 7.1 Stem Energy Overview (Demucs 4-stem)
| Stem | Mean Energy | Max Energy | Active Coverage |
|------|-----------|-----------|-----------------|
| **Vocals** | 0.0896 | 0.4465 | 73.5% |
| **Other** (SFX/synths/pads) | 0.0313 | 0.2772 | 86.1% |
| **Drums** (percussive) | 0.0188 | 0.1800 | 52.6% |
| **Bass** | 0.0006 | 0.0269 | 1.1% |

**Key insight:** Bass is virtually absent — the score relies on mid-range warmth and percussion, not low-end. The "other" stem (textures/pads/SFX) runs almost continuously at 86% coverage.

### 7.2 Percussive SFX Catalog (Drums Stem — 97 events)

| SFX Type | Count | Freq Range | Description |
|----------|-------|-----------|-------------|
| **tom/body_hit** | 47 | 900–1900 Hz | Mid-frequency thumps — the "heartbeat" of each transformation |
| **thump** | 19 | 2000–2500 Hz | Muted mid-range impacts, subtler than toms |
| **mid_percussion** | 17 | 2500–4300 Hz | Brighter percussive accents, emphasize text reveals |
| **hi-hat/sizzle** | 8 | 6100–7100 Hz | Metallic shimmer — only appears 65–68s (stonecutter hammer scene) |
| **snare/crack** | 5 | 4100–5100 Hz | Sharp crack — stonecutter chisel impacts |
| **kick/deep_boom** | 1 | 664 Hz | Single deep boom at 26.1s (sun transformation) |

**High-energy percussive hits (narrative-synced):**

| Time | Type | Energy | Narrative Context |
|------|------|--------|-------------------|
| 2.30s | mid_percussion | 0.1250 | Opening stone strike — **loudest drum hit** |
| 13.20s | tom/body_hit | 0.0644 | King reveal approach |
| 15.02s | tom/body_hit | 0.1091 | **King transformation flash** |
| 18.34s | tom/body_hit | 0.0529 | "I want to be king" emphasis |
| 26.51s | tom/body_hit | 0.1015 | **Sun is stronger than any king** |
| 37.90s | tom/body_hit | 0.0633 | Cloud transformation |
| 40.38s | tom/body_hit | 0.0615 | Wind pushes cloud |
| 41.17s | tom/body_hit | 0.0641 | Wind reveal |
| 49.10s | mid_percussion | 0.1198 | **"So he thought" — mountain realization** |
| 49.22s | thump | 0.0850 | Double-hit impact for emphasis |
| 65.24s | snare/crack | 0.0504 | Stonecutter hammer strike 1 |
| 65.47s | snare/crack | 0.0547 | Stonecutter hammer strike 2 |
| 66.15s | hi-hat/sizzle | 0.0727 | Chisel ring / metallic resonance |
| 66.65s | hi-hat/sizzle | 0.0660 | Chisel ring continues |
| 67.52s | hi-hat/sizzle | 0.0701 | Final hammer ring |
| 73.22s | tom/body_hit | 0.0563 | Recap montage punctuation |
| 73.35s | mid_percussion | 0.0637 | Recap continues |

### 7.3 Texture/SFX Catalog (Other Stem — 486 events)

| SFX Type | Count | Freq Range | Description |
|----------|-------|-----------|-------------|
| **ambient_bed** | 153 | varied | Continuous background atmosphere |
| **dark_texture** | 145 | 800–2500 Hz | Warm low-mid pads, cinematic undertone |
| **noise_sweep** | 136 | 2500–3500 Hz | Transitional risers/sweeps between scenes |
| **mid_tone/pad** | 22 | 2500–3700 Hz | Sustained synth pads, score elements |
| **low_rumble** | 20 | 700–1500 Hz | Sub-harmonic rumble at transformations |
| **shimmer/riser** | 7 | 4500–5500 Hz | Bright rising tones — cloud scene only (38s) |
| **whoosh/swoosh** | 3 | >5000 Hz | High-freq whooshes — rarest, highest impact |

**Peak SFX moments (energy > 0.08):**

| Time | Type | Energy | Narrative Context |
|------|------|--------|-------------------|
| **40.28s** | dark_texture | **0.1500** | Wind pushes cloud — massive impact texture |
| **40.38s** | low_rumble | **0.1990** | **LOUDEST SFX in entire video** — wind arrival |
| **40.41s** | dark_texture | **0.1320** | Wind sustained rumble |
| 29.00s | dark_texture | 0.0864 | Sun transformation swell |
| 10.34s | mid_tone/pad | 0.0873 | Rich man transformation stinger |
| 55.12s | mid_tone/pad | 0.1075 | Mountain becoming — orchestral swell |
| 54.90s | dark_texture | 0.0990 | Mountain pre-transformation build |
| 47.42s | dark_texture | 0.0976 | Wind hits mountain — impact |
| 19.22s | dark_texture | 0.0814 | King becoming — reveal stinger |
| 73.58s | low_rumble | 0.0882 | Final cycle — low rumble of realization |

### 7.4 SFX Design Patterns

**1. Transformation Stinger Formula**
Each transformation uses a 3-layer SFX stack:
```
[tom/body_hit] + [dark_texture swell] + [light leak flash]
↑ Percussive     ↑ Sustained pad          ↑ Visual
0.1–0.15s        0.5–1.0s buildup         4–5 frames
```

**2. Stonecutter Hammer = Unique Sound Palette**
The chisel/hammer scenes (65–68s) use a distinct hi-hat/sizzle + snare/crack combo found nowhere else in the video. This metallic ringing (6000–7100 Hz) sonically sets the stonecutter apart from the orchestral warmth of other scenes.

**3. Wind Scene = Energy Peak**
The wind section at 40.3s contains the **single loudest SFX event** (energy 0.199) — a low rumble + dark texture combo creating a massive impact. This is 7x louder than average SFX energy.

**4. Low Rumble Arc**
Low rumbles (< 1500 Hz) cluster in three zones:
- 1.7–2.0s (opening weight of stone)
- 26.7–28.8s (sun's overwhelming power)
- 73.5–80.1s (ending — 16 low rumbles = "weight of realization" crescendo)

**5. Shimmer/Riser = Cloud Only**
The shimmer/riser type (4500–5500 Hz) appears exclusively at 37.9–38.3s — the cloud transformation. This bright, ethereal texture matches the visual shift to cool blue moonlit tones.

### 7.5 Audio Properties
| Property | Value |
|----------|-------|
| Tempo | **120.2 BPM** |
| Key | **G** |
| Total beats detected | 161 |
| Total audio onsets (full mix) | 296 |
| SFX events (4-stem isolated) | **260** |
| Percussive events (drums stem) | 97 |
| Texture events (other stem) | 486 |
| Avg spectral brightness | 2341 Hz (mid-range, warm) |

### 7.6 Strategic Silence

| Silent Region | Duration | Narrative Purpose |
|---------------|----------|-------------------|
| 8.4–8.6s | 0.3s | Pause before "rich man" reveal |
| 52.3–53.0s | 0.7s | Dramatic pause mid-story |
| 60.5–62.0s | 1.5s | **Longest silence** — mountain reveal, weight of realization |
| 63.9–66.0s | ~2s | Contemplative mountain section |
| 68.6–68.9s | 0.4s | Before "stonecutter cuts mountain" |
| 70.9–71.2s | 0.3s | Before final cycle reveal |
| 73.9–74.3s | 0.4s | Before resolution |
| 81.6–82.5s | 0.9s | **Fade to silence** — ending |

### 7.3 Energy Segments

| Section | Avg Energy | Peak Energy | Character |
|---------|-----------|-------------|-----------|
| 0–5s | 0.1256 | 0.4382 | Medium — opening impact |
| 5–10s | 0.1143 | 0.3914 | Medium |
| **10–15s** | **0.1508** | **0.4808** | **Highest peak — king transformation** |
| 15–20s | 0.1314 | 0.4208 | High |
| 20–25s | 0.1269 | 0.4151 | High |
| 25–30s | 0.1547 | 0.3328 | Sustained high |
| 30–35s | 0.1381 | 0.3831 | Medium-high |
| 35–40s | 0.1223 | 0.3906 | Medium |
| **40–45s** | **0.1665** | **0.4171** | **Highest avg — wind section** |
| 45–50s | 0.1268 | 0.3858 | Medium |
| 50–55s | 0.1002 | 0.3906 | Declining |
| 55–60s | 0.1076 | 0.4243 | Declining |
| 60–65s | 0.1122 | 0.3721 | Low-medium |
| 65–70s | 0.1104 | 0.3432 | Low-medium |
| 70–75s | 0.0975 | 0.3806 | Low |
| 75–80s | 0.0838 | 0.2684 | Low — winding down |
| **80–82s** | **0.0286** | **0.0648** | **Near silence** |

---

## 8. Montage / Editing Techniques

### 8.1 Cut Statistics
| Metric | Value |
|--------|-------|
| Total scene changes | **51** |
| Video duration | 82.5s |
| Average cut rate | **0.62 cuts/sec** (37 cuts/min) |
| Fastest section | 70–75s: **8 cuts in 5s** (1.6 cuts/sec) |
| Slowest section | 35–40s: **1 cut in 5s** |

### 8.2 Cut Density Map

```
Cuts/5s
  8 |                                                      ██
  7 |                                                      ██
  6 |                                                      ██
  5 |          ██                                          ██
  4 |      ████████  ████          ████      ██  ████  ████████
  3 |      ████████  ████          ████  ████████████  ████████
  2 |  ████████████  ████  ████  ████████████████████████████████
  1 |  ████████████████████████████████████████████████████████████
    +----------------------------------------------------------------
     0s   10s   20s   30s   40s   50s   60s   70s   80s
```

### 8.3 Transition Inventory (Measured)

| Transition Type | Count | Duration | Where Used |
|----------------|-------|----------|------------|
| **Light leak flash triplet** | 6 | 4–5 frames (0.16–0.20s) | @10.4s, 15.3s, 24.3s, 50.5s, 69.0s, 76.8s |
| **Extended light wash** | 3 | 8 frames (0.32s) | @55.1s, 59.6s, 79.3s |
| **Fast cut (no flash)** | 5 | 3–6 frames | @44.4s, 72.2–73.7s (recap montage) |
| **Hard cut** | ~27 | 1 frame | Between shots within same scene |
| **Fade to white** | 1 | 8+ frames | Final frame (ending) |

### 8.4 Editing Patterns

**1. Flash-Cut Triplets (Signature Technique)**
At each major transformation, three rapid cuts in 5 frames (0.2s):
- Frame 1–2: Character's current state (pre-transformation)
- Frame 3: **Peak flash** at ~250/255 brightness (amber/white light leak)
- Frame 4–5: Character in new form (post-transformation)

Creates the **"wish → flash → transformation"** visual rhythm.

**2. Cyclical Montage Structure**
The same beat repeats 7 times:
1. Character in current form → sees something stronger
2. "I want to be [X]!" (yellow text emphasis)
3. Flash-cut triplet transition
4. "And he became [X]" (reveal in new form)
5. Discovery of something stronger → repeat

**3. Accelerating Pace**
- Acts 1–3 (0–24s): ~3.4 cuts/5s — deliberate storytelling
- Acts 4–6 (24–55s): ~2.2 cuts/5s — middle section breathes
- Acts 7–8 (55–80s): ~4.2 cuts/5s — **acceleration toward climax**
- Final 5s (70–75s): **8 cuts in 5s** — rapid recap montage (flashing through all past forms)

**4. Match Cuts**
- Character always centered in frame across all identities
- Consistent eye-line direction when "seeing" something stronger
- Stone cutting motion bookends opening and closing

**5. Recap Montage (72–74s)**
At 72–74s, a **rapid-fire montage** cycles through previous identities at ~4 cuts/second (6 frames each). These are hard cuts with **no** light leaks — pure jump cuts representing the character's racing thoughts before the final realization. Strongest zoom activity (zoom values -3.41 to +0.73) in this section.

---

## 9. Music & Score Analysis

| Property | Detail |
|----------|--------|
| Tempo | 120 BPM (standard cinematic pace) |
| Key | G (warm, uplifting) |
| Style | Orchestral/cinematic — likely stock or AI-generated |
| Brightness | 2341 Hz avg (warm mid-range, not harsh) |
| Coverage | 63.8% of video has active music |
| Dynamic range | Moderate — loudest at transformation moments |

### Beat-to-Cut Correlation
120 BPM = beat every **0.5 seconds**. Many of the 51 scene changes align with beat positions, suggesting **cut-to-music editing**. The flash-cut triplets at 0.2s span nearly half a beat — landing the post-flash reveal exactly on the next beat.

---

## 10. Production Technique Summary

### What Makes This Video Effective

1. **AI generation quality** — Consistent character identity across 8+ wildly different settings
2. **Light leak transitions** — 9 precisely timed amber flashes (4–8 frames each) create visual continuity
3. **Beat-synced editing** — 120 BPM score with cuts on beats
4. **Accelerating pace** — From 1 cut/5s to 8 cuts/5s, mirrors narrative escalation
5. **Color-coded storytelling** — Each act has a distinct measured palette (from `#031528` deep blue for cloud to `#fcfcfa` white for ending)
6. **Yellow keyword highlighting** `#eccb56` — Draws eye to the power word in every line
7. **Voice-dominant mix** (2:1 ratio) — Narration drives, music supports
8. **Strategic silence** — 8 deliberate quiet moments for dramatic breathing room
9. **Cyclical structure** — Story and edit are both perfect loops

### Reproduction Pipeline
1. Write script (30 lines, ~52s of speech)
2. Record voiceover (male, calm, deliberate — or AI TTS)
3. AI image generation per scene (8 environments, consistent character face)
4. AI video generation from stills (subtle zoom motion, 2s clips)
5. Edit to 120 BPM grid — place flash-cut triplets at each transformation
6. Add light leak overlays: 4-frame amber flash (`#ffca65` → `#fff0a8` → white → scene)
7. Color grade per act (see Section 3.3 for exact hex values)
8. Add text: font ~Montserrat Bold, warm white `#f4f1e9`, keywords `#eccb56`
9. Mix audio: voice at 2x music level, whoosh SFX at each flash, fade music up at 75s
10. Add silence drops at 8 strategic points

### Files Produced

| File | Description |
|------|-------------|
| `study_video.webm` | Original downloaded video |
| `study_audio.wav` | Extracted full audio |
| `study_frames/scene_*.png` | 51 keyframes at each scene change |
| `demucs_output/.../vocals.wav` | Isolated voice stem |
| `demucs_output/.../no_vocals.wav` | Isolated music+SFX stem |
| `color_analysis.json` | Full color data per keyframe |
| `motion_analysis.json` | Optical flow data per scene |
| `transition_analysis.json` | Light leak timing data |
| `typography_analysis.json` | Text color sampling data |
| `study_audio.json` | Whisper transcript with word timestamps |
| `sfx_detailed.json` | Full 4-stem SFX catalog with spectral data |
| `demucs_output_4stem/.../drums.wav` | Isolated percussive stem |
| `demucs_output_4stem/.../other.wav` | Isolated SFX/texture/pad stem |
| `demucs_output_4stem/.../bass.wav` | Isolated bass stem |

---

*Analysis generated on 2026-02-15 using ffmpeg, Whisper, Demucs, librosa, OpenCV, and Claude Vision.*
