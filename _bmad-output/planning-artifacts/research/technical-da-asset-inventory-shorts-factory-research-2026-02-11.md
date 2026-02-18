---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
workflowType: 'research'
lastStep: 2
research_type: 'technical'
research_topic: 'DA (Artistic Direction) asset inventory for YouTube Shorts factory'
research_goals: 'Complete checklist of all shared assets to pre-produce for locked artistic direction — chibi character set creation guidelines, shared SFX/music/font/color/texture library strategy, multiple options within a unified DA'
user_name: 'max'
date: '2026-02-11'
web_research_enabled: true
source_verification: true
---

# Research Report: DA Asset Inventory for YouTube Shorts Factory

**Date:** 2026-02-11
**Author:** max
**Research Type:** technical

---

## Research Overview

Comprehensive technical research into every asset category that must be pre-produced to lock down the Artistic Direction (DA) of a Remotion-based YouTube Shorts factory. The factory uses a ChibiExplainer template with 18 visual layers, 7 emotion states, and a fully programmatic render pipeline. Research covers tools, specs, best practices, and file organization across 6 asset domains.

---

## Technical Research Scope Confirmation

**Research Topic:** DA (Artistic Direction) asset inventory for YouTube Shorts factory
**Research Goals:** Complete checklist of all shared assets to pre-produce for locked artistic direction — chibi character set creation guidelines, shared SFX/music/font/color/texture library strategy, multiple options within a unified DA

**Scope Confirmed:** 2026-02-11

---

## Technology Stack Analysis

### 1. Chibi Character Set — Tools, Pipelines & Specs

#### Creation Tools

| Tool | Type | Best For | License |
|------|------|----------|---------|
| **Clip Studio Paint** | Traditional illustration | Highest quality, 3D chibi body refs, layer-based expression sheets | Paid |
| **Procreate** | iPad illustration | Quick sketching, less suited for systematic sheets | Paid |
| **Midjourney + `--cref`** | AI generation | Fastest turnaround, `--cw 100` for character consistency | Subscription |
| **Flux + ComfyUI + LoRA** | AI generation | Highest control, train LoRA on 10-15 refs, ControlNet for poses | Free/open-source |
| **PuLID Flux II** | AI consistency | Best consistency without training — injects char features from a single ref | Free/open-source |
| **Pixelcut AI** | AI expression sheet | Generates full 7-emotion sheets from text prompts | Free tier |

_Sources: [Midjourney --cref docs](https://docs.midjourney.com/hc/en-us/articles/32162917505293-Character-Reference), [PuLID Flux II](https://www.runcomfy.com/comfyui-workflows/pulid-flux-ii-in-comfyui-consistent-character-ai-generation), [CSP Chibi Drawing](https://tips.clip-studio.com/en-us/articles/4953), [FluxGym LoRA Training](https://learn.thinkdiffusion.com/make-your-character-style-lora-stand-out-easy-lora-training-with-fluxgym/)_

#### 7-Emotion Expression Guide

| Emotion | Eyebrows | Eyes | Mouth | Body Cues |
|---------|----------|------|-------|-----------|
| **neutral** | Relaxed, even | Normal open | Small smile or flat | Standing straight |
| **excited** | Raised high | Wide, sparkles/stars | Wide grin | Arms up, fists pumped |
| **confused** | One raised, one low | Swirly/dot pupils | Wavy "o" | Head tilt, question mark |
| **panicking** | Raised, wavy | Wide, shrunk pupils | Jagged open | Arms flailing, sweat drops |
| **happy** | Slightly raised | Closed arcs (^_^) | Wide smile | Slight lean forward |
| **sad** | Inner corners up | Teary, half-closed | Downturned | Shoulders drooped |
| **angry** | V-shape, furrowed | Sharp, small pupils | Teeth-baring | Clenched fists, vein pop |

_Source: [CSP Chibi Emoji Guide](https://tips.clip-studio.com/en-us/articles/10502)_

#### Recommended Pipeline (3 options)

**Pipeline A — Flux + LoRA + ComfyUI** (highest quality, most control):
1. Write detailed character description (proportions, colors, outfit, hair)
2. Generate reference sheet with Flux (`chibi character sheet, multiple expressions`)
3. Refine in Clip Studio Paint — standardize proportions, fix inconsistencies
4. Train LoRA with FluxGym/Kohya SS: 10-15 images, rank 32, lr 1e-4, 1500-2000 steps
5. Generate 7 expressions with LoRA (0.9-1.0 strength) + ControlNet OpenPose per emotion
6. Post-process: `rembg` for background removal, anti-alias outline, optimize PNGs

**Pipeline B — Midjourney `--cref`** (fastest):
1. Generate base character, use best result as `--cref` with `--cw 100`
2. Prompt each expression variant separately
3. Clean up in CSP/Procreate, remove backgrounds, standardize sizing

**Pipeline C — PuLID Flux II** (best consistency, no training):
1. Create one "golden" reference chibi
2. PuLID injects character features from ref into each new generation
3. Combine with ControlNet for pose/expression control
4. Batch generate all 7 emotions

#### File Specs

| Property | Value |
|----------|-------|
| **Format** | PNG-32 (24-bit color + 8-bit alpha) |
| **Individual sprite resolution** | 800-1080px wide, 1200-1600px tall |
| **Master render** | Export at 2x intended display size for smooth Remotion scaling |
| **Background** | Transparent (rembg for AI output, manual for illustration) |
| **Anti-aliasing** | 0.5-1px same-color outline around contours |
| **Compression** | Lossless (OptiPNG, pngcrush, TinyPNG) — 70-80% reduction |
| **Naming** | `neutral.png`, `excited.png`, `confused.png`, etc. |
| **Anchor point** | All expressions share same center-of-mass for seamless swap |
| **Total set size** | 3-10MB unoptimized, 1-3MB optimized |
| **Safe zone** | Avoid top 15% and bottom 20% of 1080x1920 frame (YouTube UI overlays) |

_Sources: [YouTube Shorts Safe Zone 2026](https://kreatli.com/guides/youtube-shorts-safe-zone), [Remotion Output Scaling](https://www.remotion.dev/docs/scaling), [PNG Optimization 2025](https://unifiedimagetools.com/en/articles/png-optimization-advanced-2025)_

---

### 2. Typography System

#### Recommended Font Stack (2 fonts max)

| Role | Font | Weight | Size (1080x1920) | License |
|------|------|--------|-------------------|---------|
| **Primary Caption** | Montserrat | ExtraBold/Black (800-900) | 60-80px | SIL OFL (Google Fonts) |
| **UI / Watermark** | Montserrat (or Inter) | Medium (500) | 24px | SIL OFL |

Montserrat is the #1 most-used caption font — found in 1.2M+ videos. All-caps, word-by-word pop, heavy stroke is the dominant 2025-2026 style (the "Hormozi style").

_Sources: [ZapCap Best Font for Shorts 2026](https://zapcap.ai/blog/best-font-for-youtube-shorts-in-year/), [SendShort Best TikTok Fonts](https://sendshort.ai/guides/tiktok-font/), [Submagic Best Subtitle Fonts](https://www.submagic.co/blog/best-font-for-subtitle)_

#### Caption Style Specs (2025-2026 standard)

| Property | Value |
|----------|-------|
| Font size | 60-80px on 1080x1920 |
| Font weight | 700-900 (Bold to Black) |
| Case | ALL CAPS |
| Stroke | Black outline, 2-4px |
| Words per chunk | 1-3 at a time |
| Animation | Pop-in/scale on active word; color highlight |
| Highlight colors | Yellow (#FFD700), Green (#00FF88), or brand accent |
| Position | Center or upper third (avoid bottom 20%) |

#### Font File Strategy for Remotion

**Bundle `.woff2` files locally** — do NOT rely on Google Fonts CDN at render time.

| Approach | Reliability | Recommendation |
|----------|-------------|----------------|
| `@remotion/fonts` + local `.woff2` | Highest — zero network dependency | **Use this for production** |
| `@remotion/google-fonts` | Medium — network dependent | Dev/prototyping only |

Download needed weights from Google Fonts, convert TTF to WOFF2 (`woff2_compress`), store in `public/shared/fonts/`. Remotion's `loadFont()` auto-blocks render until loaded.

**Licensing**: SIL OFL fonts are fully cleared for commercial video. No attribution required in rendered output. Bundling in software is explicitly permitted.

_Sources: [Remotion Fonts Docs](https://www.remotion.dev/docs/fonts), [SIL OFL FAQ](https://openfontlicense.org/ofl-faq/), [Google Fonts FAQ](https://developers.google.com/fonts/faq)_

---

### 3. SFX Library

#### Essential Categories & Variant Counts

**Tier 1 — Core (every video):**

| Category | Variants | Description |
|----------|----------|-------------|
| Whoosh / Swoosh | 8-12 | Light, medium, heavy, reverse, tonal |
| Impact / Hit | 8-10 | Bass thud, cinematic boom, punch, slap, metallic |
| Pop / Bubble | 6-8 | Soft pop, crisp pop, cartoon pop, bubble |
| Riser / Build | 4-6 | Short 1s, medium 2s, long 3-4s, reverse |
| Stinger / Hit+Tail | 4-6 | Orchestral, electronic, comedic, dark |
| Sparkle / Magic | 4-6 | Highlight, transformation moments |

**Tier 2 — Emphasis:**

| Category | Variants | Description |
|----------|----------|-------------|
| Notification / Ding | 4-6 | Bell, chime, phone ping, cash register |
| Error / Fail | 4-6 | Buzzer, vinyl scratch, sad trombone, boing |
| Success / Achievement | 3-5 | Fanfare, cha-ching, level-up chime |
| Record Scratch | 2-3 | Comedy beats, subverted expectations |

**Tier 3 — Atmosphere:**

| Category | Variants | Description |
|----------|----------|-------------|
| Glitch / Digital | 4-6 | Tech content, transitions |
| Crowd / Cheering | 3-4 | Applause, gasp, laughter |
| Ambient Drones | 3-4 | Dark, ethereal, sci-fi |

**Total library: ~80-120 SFX files.**

#### Audio Specs

| Property | Value |
|----------|-------|
| Format | WAV (PCM) — lossless |
| Sample rate | 48 kHz (video standard) |
| Bit depth | 16-bit |
| Channels | Mono (SFX) / Stereo (music) |
| Peak normalize | -3 dBFS per SFX file |
| SFX loudness | -20 to -18 LUFS |
| Music bed loudness | -16 to -14 LUFS |
| Final mix (YouTube) | -14 LUFS integrated, -1.5 dBTP true peak |

#### Sources Strategy

| Source | Use For | License |
|--------|---------|---------|
| **Freesound.org** (400K+) | Raw material, unique sounds | CC (varies per file) |
| **Pixabay Audio** (90K+) | Ready-to-use, no attribution | Pixabay License |
| **Artlist** ($199/yr) | Premium, **lifetime usage rights** | Subscription |
| **Soundstripe** ($135/yr) | Budget premium, lifetime rights | Subscription |

Recommendation: Build core from free sources, subscribe to one paid service (Artlist or Soundstripe for lifetime rights). **Download and cache locally** — never depend on API calls at render time.

_Sources: [Uppbeat SFX Guide](https://uppbeat.io/blog/sound-effects/sound-effects-youtubers-use), [Remotion Audio Docs](https://www.remotion.dev/docs/using-audio), [LUFS Targets 2025](https://clickyapps.com/creator/video/guides/lufs-targets-2025)_

#### Audio Branding

Every factory should lock down:
1. **Sonic logo** (2-4s) — plays at start or end of every video
2. **Signature transition** — ONE main whoosh/impact + 2-3 pitch-shifted variants
3. **2-3 hero music tracks** — become associated with your channel
4. **Consistent VO processing chain** — same EQ, compression, reverb across all shorts
5. **Branded SFX palette** — limit to 10-15 "go-to" sounds for cohesion

_Sources: [Bensound Audio Identity Guide](https://www.bensound.com/blog/sound-design-strategy/how-to-develop-a-consistent-audio-identity/), [Soundstripe Sonic Branding](https://www.soundstripe.com/blogs/what-is-sonic-branding-7-steps-to-create-an-audio-branding-strategy)_

---

### 4. Music Bed Library

#### Recommended Size: 30-50 tracks

| Energy \ Mood | Positive/Upbeat | Neutral/Chill | Dark/Dramatic | Comedic/Quirky |
|---------------|-----------------|---------------|---------------|----------------|
| **High** (120+ BPM) | 4-5 | 2-3 | 3-4 | 2-3 |
| **Medium** (90-120 BPM) | 4-5 | 3-4 | 2-3 | 2-3 |
| **Low** (<90 BPM) | 2-3 | 3-4 | 2-3 | 1-2 |

Each track needs: full version (30-60s), 15s edit, loop point, mood/energy metadata tags.

Key genres to cover: Lo-fi/Chill Hop, Trap/Hip-Hop, Cinematic/Epic, Quirky/Playful, EDM/Dance, Acoustic/Indie.

_Sources: [Soundstripe Music for Shorts](https://www.soundstripe.com/blogs/best-royalty-free-music-for-youtube-shorts), [Alibi Music for Shorts](https://alibimusic.com/blog/royalty-free-music-and-sfx-the-secret-to-boosting-tiktok-reels-and-shorts-performance)_

---

### 5. Color Palette & Design Token System

#### Emotion-to-Color Mapping

Based on film color psychology research:

| Emotion | Hue Family | Temperature | Saturation |
|---------|-----------|-------------|------------|
| happy | Yellow / Warm Gold | Warm | High |
| sad | Blue / Desaturated Cool | Cool | Low-Medium |
| angry | Red / Deep Orange | Hot | High |
| neutral | Teal / Soft Blue-Gray | Cool | Low-Medium |
| confused | Deep Purple / Indigo | Cool | Medium-Low |
| excited | Magenta / Electric | Warm-Cool Mix | Very High |
| panicking | Red / Dark Orange | Hot | High |

**Cohesion rules**: All moods share a common neutral base (same off-black, off-white, mid-gray). All moods live in the same saturation band. Accent colors are offset 30 degrees from their primary on the color wheel.

_Sources: [No Film School Color Psychology](https://nofilmschool.com/color-psychology-in-film), [Filmbaker Color in Video](https://www.filmbaker.com/blog/the-role-of-color-in-video-production-how-to-evoke-emotions-and-convey-meaning)_

#### Design Tokens: JSON Config, NOT Hardcoded

Remotion's `getInputProps()` reads JSON at render time. Zod schema validation enforces structure. This enables:
- Render same template with 7 mood variants — zero code duplication
- A/B test visual styles via config changes, not code changes
- Batch rendering from datasets (the standard Remotion factory pattern)

**Token structure per mood:**

```json
{
  "colors": { "primary", "secondary", "accent", "background", "text", "gradientStops" },
  "grain": { "intensity", "size", "animated", "blendMode" },
  "particles": { "type", "count", "speed", "opacity", "color" },
  "vignette": { "intensity", "radius" },
  "motion": { "entranceEasing", "exitEasing", "standardEasing", "durations", "stagger" },
  "typography": { "headingFont", "bodyFont", "headingWeight", "letterSpacing" }
}
```

_Sources: [Remotion inputProps](https://www.remotion.dev/docs/passing-props), [Remotion Dataset Render](https://www.remotion.dev/docs/dataset-render), [Design Tokens & Theming 2025](https://materialui.co/blog/design-tokens-and-theming-scalable-ui-2025)_

---

### 6. Textures, Grain & Overlays

#### 2025-2026 Aesthetic: "Intentional Imperfection"

The dominant trend is raw, authentic texture — grain, dust, scratches, light leaks. Clean/sterile is out.

| Effect | Recommended Range | Notes |
|--------|-------------------|-------|
| Film grain | 8-15% opacity (subtle), 15-25% (vintage) | Animated per-frame noise preferred |
| Vignette | 20-40% intensity, 0.6-0.8 radius | Radial gradient, transparent center to black edges |
| Particles | 20-60 count, 10-20% opacity | Dust (analog nostalgia), bokeh (dreamy), light leak (warmth) |
| Color grade | CSS filter chain or FFmpeg LUT | Mood-specific LUTs in `.cube` format |

**Post-render pipeline**: `ffmpeg -vf lut3d=file=mood.cube` for production-grade color grading. Create one `.cube` LUT per emotion.

_Sources: [Envato Motion Trends 2026](https://elements.envato.com/learn/video-motion-design-trends), [Renderforest Design Trends 2026](https://www.renderforest.com/blog/design-trends-in-2026), [GDJ Creative Trends 2026](https://graphicdesignjunction.com/2026/01/video-and-motion-creative-trends-2026/)_

---

### 7. Emoji & Sticker Set

**Use custom SVG emoji** — Unicode renders differently per device/OS. Custom SVGs guarantee pixel-perfect consistency in rendered MP4.

Recommended approach:
- Create 20-30 base SVG emoji/stickers matching your color palette
- Each emoji has mood variants (same shape, fill color from mood tokens)
- Render at 2-3x for crisp display on 1080p vertical video
- Tools: Figma, Adobe Illustrator, or Dreamina (CapCut AI sticker packs)

_Sources: [Magnt YouTube Branding Guide](https://magnt.com/youtube-branding-guide), [Dreamina Sticker Packs](https://dreamina.capcut.com/resource/sticker-pack)_

---

### 8. Motion Design Tokens

Motion is part of the DA spec. Define as JSON tokens:

**Easing curves:**
```json
{
  "standard": "cubic-bezier(0.4, 0.0, 0.2, 1)",
  "decelerate": "cubic-bezier(0.0, 0.0, 0.2, 1)",
  "accelerate": "cubic-bezier(0.4, 0.0, 1, 1)",
  "expressive": "cubic-bezier(0.4, 0.14, 0.3, 1)",
  "bounce": "cubic-bezier(0.34, 1.56, 0.64, 1)"
}
```

**Duration scale:**
```json
{ "instant": 100, "fast": 200, "normal": 350, "slow": 500, "dramatic": 800 }
```

**Entrance/exit patterns:**
- `fadeUp`: opacity 0 + y:20 -> visible, decelerate easing
- `scaleIn`: opacity 0 + scale:0.85 -> visible, expressive easing
- `slideLeft`: opacity 0 + x:100 -> visible, decelerate easing

**Stagger delays:** tight (40ms), normal (80ms), loose (150ms)

Use expressive easing for "animate-in", productive/accelerate for "animate-out".

_Sources: [Material Design 3 Motion Tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs), [Carbon Design Motion](https://carbondesignsystem.com/elements/motion/overview/), [DesignSystems.com Motion Guide](https://www.designsystems.com/5-steps-for-including-motion-design-in-your-system/)_

---

## Technology Adoption Trends

### What's Current (2025-2026)

- **Token-driven video factories** are the standard pattern — Remotion `inputProps` + dataset rendering
- **AI-assisted character creation** (LoRA, PuLID, Midjourney --cref) dramatically reduces character production time
- **"Intentional imperfection"** aesthetic dominates — grain, dust, organic motion over polish
- **Kinetic typography** (word-by-word animated captions) is the competitive differentiator
- **Audio branding** (sonic logos, signature transitions) increases brand recognition by 46% (Nielsen)
- **LUT-based post-processing** ensures color consistency at scale — AI LUT generation is viable
- **Custom SVG emoji** for brand consistency over Unicode

### Emerging

- Flux + ComfyUI replacing Stable Diffusion for character generation
- ElevenLabs Sound Effects V2 (48kHz AI SFX) narrowing the gap with sourced SFX
- CSS `linear()` easing enabling spring physics natively
- Coded/generative motion replacing hand-keyframed motion graphics

---

## Integration Patterns Analysis

### Asset Loading in Remotion

**`staticFile()`** is the canonical mechanism. Files go in `public/`, referenced via `staticFile("path/to/file")`. Key rules:

| Asset Type | Component | Format | Notes |
|-----------|-----------|--------|-------|
| Chibi PNGs | `<Img src={staticFile(...)} />` | PNG-32 | Auto-blocks render until loaded |
| Audio (voice, music) | `<Audio src={staticFile(...)} />` | WAV/MP3 | WAV for SFX, MP3 for long tracks |
| Fonts | `@remotion/fonts` `loadFont()` | WOFF2 | Auto-blocks render; local > CDN |
| JSON data | `calculateMetadata` or `delayRender()` | JSON | Fetch via `staticFile()` URL |

**Gotchas:**
- v4.0+ auto-encodes filenames — do NOT pre-encode
- Assets added after `bundle()` are NOT available at render time
- Large `public/` folders slow bundling (copies everything)
- No Node.js `fs` access in components — browser environment only

_Sources: [Remotion staticFile()](https://www.remotion.dev/docs/staticfile), [Remotion Assets](https://www.remotion.dev/docs/assets)_

---

### Design Token Flow: inputProps Pattern

The **bundle-once-render-many** pattern is the standard for video factories:

```
Theme JSON → CLI --props / API inputProps → getInputProps() → React component tree
```

**CLI usage:**
```bash
npx remotion render MyShort out/video.mp4 --props=./themes/neon-night.json
```

**Programmatic batch rendering:**
```typescript
const bundleLocation = await bundle({ entryPoint: "./src/index.ts" });

for (const config of renderQueue) {
  const composition = await selectComposition({
    serveUrl: bundleLocation, id: "MyShort", inputProps: config,
  });
  await renderMedia({
    serveUrl: bundleLocation, composition, codec: "h264",
    outputLocation: `out/${config.id}.mp4`, inputProps: config,
  });
}
```

**Critical:** Pass `inputProps` to BOTH `selectComposition()` and `renderMedia()`. Use `calculateMetadata` to derive duration/dimensions from props. All props must be JSON-serializable.

**Performance rules:**
- Bundle once, render many — `bundle()` is the expensive step
- Reuse browser instances via `puppeteerInstance` across renders
- Do NOT render multiple videos in parallel on one machine — each `renderMedia()` saturates CPU
- Use `npx remotion benchmark` to tune `concurrency`

_Sources: [Remotion inputProps](https://www.remotion.dev/docs/terminology/input-props), [Remotion Dataset Render](https://www.remotion.dev/docs/dataset-render), [Remotion bundle()](https://www.remotion.dev/docs/bundle)_

---

### Asset Creation Pipelines

#### Chibi Pipeline: AI Generation → Render-Ready

```
ComfyUI/Midjourney → raw PNGs → rembg (session reuse) → pngquant + oxipng → public/shared/characters/
```

- **rembg**: Use `new_session("isnet-general-use")` for anime/chibi style, reuse session across batch
- **Optimization**: pngquant (lossy palette reduction) then oxipng (lossless encoding) — best combined compression
- **Naming**: `neutral.png`, `excited.png`, etc. — maps directly to `emotionToFile` record in ChibiController

#### Audio Pipeline: Voice → Captions → Scene Plan

```
voice-raw.wav → DeepFilterNet → ffmpeg trim → Pedalboard FX → voice.wav
                                                    ↓
                                        Whisper.cpp transcribe()
                                                    ↓
                                            captions.json
                                                    ↓
                                    Scene plan generation (AI)
                                                    ↓
                                          scene-plan.json
```

- **Whisper.cpp**: Remotion has first-party support via `@remotion/install-whisper-cpp` — provides word-level timestamps
- **Caption format**: `{ text, startMs, endMs, confidence }` per word
- **Scene plan**: Bridges audio timing to visual composition — segments with emotion, keywords, energy, transitions

#### Music Analysis Pipeline

```
music.mp3 → librosa → music_analysis.json → compileEffectEvents() → visual effect events
```

`music_analysis.json` contains: BPM, beat timestamps, onset times, energy curve, energy peaks, duration. The `compileEffectEvents()` function cross-references segments + beats + energy to produce shake, zoom, flash, emoji, speed line, and SFX events — the "brain" of the composition.

_Sources: [Remotion Whisper.cpp](https://www.remotion.dev/docs/install-whisper-cpp/), [rembg](https://github.com/danielgatis/rembg), [Spotify Pedalboard](https://github.com/spotify/pedalboard)_

---

### Post-Render Pipeline

```
Remotion renderMedia() → intermediate.mp4 → FFmpeg → final.mp4
                                                ↓
                              Remotion renderStill() → thumbnail.png
```

**FFmpeg post-processing chain (two-pass):**

| Filter | Purpose |
|--------|---------|
| `lut3d=file=mood.cube` | Mood-specific color grading |
| `unsharp=5:5:0.8` | Sharpening |
| `loudnorm` (2-pass) | EBU R128 normalization to -14 LUFS |
| `-movflags +faststart` | Progressive web playback |
| `-crf 18 -preset slow` | High quality H.264 encoding |

**Thumbnail**: Use `renderStill()` with a dedicated `<Thumbnail>` composition (custom layout, larger text) rather than FFmpeg frame extraction.

_Sources: [Remotion renderMedia()](https://www.remotion.dev/docs/renderer/render-media), [FFmpeg loudnorm](http://k.ylo.ph/2016/04/04/loudnorm.html), [FFmpeg LUT guide](https://gabor.heja.hu/blog/2024/12/10/using-ffmpeg-to-color-correct-color-grade-a-video-lut-hald-clut/)_

---

### Binary Asset Management

| Strategy | Best For | Versioned? |
|----------|----------|------------|
| **Git LFS** | Teams < 10GB assets, need versioning alongside code | Yes |
| **Cloud bucket** (S3/R2) | > 10GB, shared across repos | Manual (folder prefixes) |
| **Local + .gitignore** | Solo dev, prototyping | No |
| **Hybrid** (recommended) | Production factories | Partial |

**Hybrid recommendation:**
- Git LFS: fonts, icons, small shared assets (< 10MB each)
- Cloud bucket: music, backgrounds, large audio files
- .gitignore: generated/preprocessed output, `out/` directory

---

### Factory Directory Structure (Recommended)

```
shorts-factory/
├── src/
│   ├── lib/
│   │   ├── components/     # Shared visual components (18 layers)
│   │   ├── hooks/          # useBeatSync, useCaptions, etc.
│   │   ├── templates/      # ChibiExplainer master template
│   │   ├── types/          # ShortConfig, ScenePlan, MusicAnalysis
│   │   └── utils/          # colorPalettes, easing, frameConvert
│   └── shorts/             # Per-short entry points + config
├── public/
│   ├── shared/             # DA-LOCKED ASSETS (shared across ALL shorts)
│   │   ├── characters/     # Chibi PNGs (per character × 7 emotions)
│   │   ├── fonts/          # Bundled .woff2 files
│   │   ├── sfx/            # 80-120 branded SFX (WAV, 48kHz, mono)
│   │   ├── music/          # 30-50 curated tracks (mood/energy tagged)
│   │   ├── emojis/         # Custom SVG emoji set
│   │   └── brand/          # Sonic logo, watermark assets
│   └── shorts/<id>/        # PER-SHORT ASSETS
│       ├── voice.wav, captions.json, scene-plan.json
│       ├── music.mp3, music_analysis.json
│       └── (optional custom assets)
├── themes/                 # Design token JSON configs (1 per mood)
├── luts/                   # FFmpeg .cube LUT files (1 per mood)
├── scripts/                # Python audio/image + TS render pipelines
└── out/                    # Render output (gitignored)
```

**Key principle:** `public/shared/` is the DA — change it once, every future short inherits it. `public/shorts/<id>/` is per-episode content. `themes/` + `luts/` define the visual identity as data, not code.

---

### Full Production Pipeline (End-to-End)

```
1. ASSET CREATION (once, DA-locked)
   Characters → rembg → optimize → public/shared/characters/
   Fonts → woff2_compress → public/shared/fonts/
   SFX → normalize → public/shared/sfx/
   Music → tag → public/shared/music/
   Emoji → SVG design → public/shared/emojis/
   Themes → JSON configs → themes/
   LUTs → color grade → luts/

2. PER-SHORT PRODUCTION
   Voice recording → DeepFilterNet → trim → Pedalboard → voice.wav
   Whisper transcribe → captions.json
   AI scene planning → scene-plan.json
   Music selection → librosa → music_analysis.json

3. RENDER
   bundle() once → renderMedia() per short → intermediate.mp4
   renderStill() → thumbnail.png
   FFmpeg LUT + loudnorm + faststart → final.mp4
```

_Sources: [Remotion SSR](https://www.remotion.dev/docs/ssr-node), [Remotion public dir](https://www.remotion.dev/docs/terminology/public-dir)_

---

## Architectural Patterns and Design

### Three-Layer Token Hierarchy

The DA is structured as a **three-layer token system** (per [Martin Fowler's design token architecture](https://martinfowler.com/articles/design-token-based-ui-architecture.html)):

**Layer 1 — Primitive tokens** (raw values, no semantics):
```
colors: { blue900: '#1a237e', orange500: '#ff9800', ... }
durations: { fast: 10, medium: 20, slow: 40 }  // frames
easings: { bouncy: 'spring(1,80,10)', smooth: 'ease-in-out' }
```

**Layer 2 — Semantic tokens** (mood-specific decisions):
```
energeticMood.text.accent = primitives.colors.orange500
calmMood.motion.entryDuration = primitives.durations.slow
```

**Layer 3 — Component tokens** (where semantics bind to components):
```
titleCard.animateInFrames = theme.motion.entryDuration
captionRenderer.highlightColor = theme.text.accent
```

**The token interface IS the DA contract.** Any mood conforming to the `SemanticTheme` type can be plugged in without changing component code. In Remotion, tokens flow to `spring()`/`interpolate()` params, React styles, `<Sequence>` durations, volume curves, and character expression selection.

_Sources: [Martin Fowler Design Tokens](https://martinfowler.com/articles/design-token-based-ui-architecture.html), [Supernova.io Token Architecture](https://www.supernova.io/blog/scalable-token-architecture-principles), [Nathan Curtis Tokens in DS](https://medium.com/eightshapes-llc/tokens-in-design-systems-25dd82d58421)_

---

### Zod Schema Validation for Video Configs

Remotion has **first-class Zod integration**. Attach a schema to a `<Composition>` and get:
- Type-safe `inputProps` with `z.infer<>`
- Visual form editor in Remotion Studio (Cmd+J) — dropdowns for enums, color pickers for `zColor()`, multiline for `zTextarea()`
- Non-developers can produce videos via the Studio UI with zero code changes

```typescript
const videoConfigSchema = z.object({
  theme: z.object({
    mood: z.enum(['neutral','excited','confused','panicking','happy','sad','angry']),
    primaryColor: zColor(),
    accentColor: zColor(),
  }),
  character: z.object({
    id: z.string(),   // chibi character ID
    size: z.number().default(500),
  }),
  captionStyle: z.enum(['bold-stroke','minimal','neon']),
});
```

**Best practices:**
- One Zod schema per composition — derive TS types with `z.infer<>`
- `z.enum()` for constrained choices → Studio renders dropdowns
- `zColor()` for colors → Studio renders picker
- `.default()` on optional fields so defaultProps are always complete

_Sources: [Remotion Schemas](https://www.remotion.dev/docs/schemas), [Remotion Visual Editing](https://www.remotion.dev/docs/visual-editing), [@remotion/zod-types](https://www.remotion.dev/docs/zod-types/)_

---

### Master Template Architecture

The ChibiExplainer is a **master template** — one composition handles all variants through props. This is the standard pattern for video factories:

| Approach | Pros | Cons |
|----------|------|------|
| **Monolithic master template** | One form, one render button, non-dev friendly | Risk of "god component" |
| **Composition-of-compositions** | Cleaner separation, testable scenes | Must combine manually, more wiring |
| **Hybrid (recommended)** | Individual scenes for dev/preview + master for production | Best of both |

```tsx
// Root.tsx — Hybrid: individual scenes + master template
<>
  {/* Dev preview */}
  <Composition id="intro-scene" component={IntroScene} ... />
  <Composition id="caption-test" component={CaptionTest} ... />

  {/* Production — master template */}
  <Composition id="full-short" component={ChibiExplainer}
    schema={videoConfigSchema}
    calculateMetadata={deriveFromProps}
    defaultProps={defaultConfig} />
</>
```

_Sources: [Remotion Series](https://www.remotion.dev/docs/series), [Remotion Reusability](https://www.remotion.dev/docs/reusability), [Remotion Combining Compositions](https://www.remotion.dev/docs/miscellaneous/snippets/combine-compositions)_

---

### Registry Pattern: Open/Closed for New Variants

To add new characters, moods, or emotions **without touching existing code**, use registries:

**Mood registry:**
```typescript
const moodRegistry = new Map<string, MoodConfig>();
export function registerMood(id: string, config: MoodConfig) {
  moodRegistry.set(id, config);
}
// Add new mood = one function call, zero changes to existing code
registerMood('nostalgic', { tokens: nostalgicTokens, ... });
```

**Character manifest + auto-discovery:**
```json
// public/shared/characters/chibi-fox/manifest.json
{
  "id": "chibi-fox",
  "displayName": "Foxie",
  "bodySize": { "width": 400, "height": 500 },
  "supportedEmotions": ["neutral","excited","confused","panicking","happy","sad","angry"],
  "assets": {
    "neutral": "./neutral.png",
    "excited": "./excited.png",
    ...
  }
}
```

**Adding a new character = zero code changes:**
1. Create `public/shared/characters/chibi-penguin/` directory
2. Drop 7 emotion PNGs following naming convention
3. Create `manifest.json` conforming to schema
4. Registry auto-discovers it

_Sources: [OCP in React](https://cekrem.github.io/posts/open-closed-principle-in-react/), [DZone Open-Closed Principle](https://dzone.com/articles/the-openclosed-principle)_

---

### Content vs Presentation Separation

The factory splits cleanly into three concerns:

```
CONTENT (what to say)          PRESENTATION (how it looks)      TEMPLATE (structure)
─────────────────────          ──────────────────────────       ─────────────────────
Script / voiceover             Mood / theme tokens              Scene definitions
Music track selection          Color palette                    Component tree
Scene ordering                 Typography                       Animation choreography
Caption text                   Motion profiles                  Layout rules
                               Character + emotion              Format (9:16, 1:1)
                               Effects (particles, grain)
```

This enables:
- **Same script, multiple visual styles** — render in "neon" and "pastel" moods
- **A/B testing** — same content, different themes, measure engagement
- **Batch rendering** — 1 content payload × N presentations = N videos
- **Team separation** — content team writes scripts, design team iterates themes

_Sources: [W3C Content/Presentation Separation](https://www.w3.org/2001/tag/doc/contentPresentation-26.html), [Smartly.io Million Videos/Month](https://www.smartly.io/blog/how-we-built-a-video-templating-system-capable-of-producing-a-million-videos-a-month)_

---

### Data Architecture: Theme JSON Structure

Each mood is a standalone JSON file in `themes/`:

```json
// themes/excited.json
{
  "id": "excited",
  "colors": {
    "gradient": ["#ff6b35", "#f7c59f", "#efefd0"],
    "accent": "#ff0a54",
    "captionHighlight": "#ffff00",
    "text": "#ffffff",
    "background": "#1a0a00"
  },
  "particles": { "count": 45, "color": "rgba(255,200,50,0.18)", "speed": 0.5 },
  "grain": { "intensity": 0.10, "animated": true },
  "vignette": { "intensity": 0.35, "radius": 0.7 },
  "motion": {
    "entrance": "cubic-bezier(0.0,0.0,0.2,1)",
    "exit": "cubic-bezier(0.4,0.0,1,1)",
    "entranceDuration": 200,
    "stagger": 60
  },
  "audio": { "duckingLevel": 0.14, "sfxVolume": 0.6 },
  "lut": "excited.cube"
}
```

**7 theme files** (one per emotion) + **1 Zod schema** = the complete DA definition as data. Changing the DA = editing JSON, not code.

---

## Implementation Approaches and Technology Adoption

### Implementation Roadmap (Phased)

#### Phase 0: Foundation (Days 1-3) — BLOCKS EVERYTHING

| Asset | Why First | Output |
|-------|-----------|--------|
| **Design Token System** | Every other asset references these. Without tokens, all choices drift. | 7 theme `.json` files |
| **Font Selection + Bundling** | Typography drives layout math. Changing fonts later breaks every layer. | 2-3 `.woff2` files |

**Tokens first because:** Moods cascade into everything — which LUT, which SFX set, which music bed, which emoji variant. Starting characters before tokens = repainting when palette changes.

#### Phase 1: Core Visual Identity (Days 4-14)

| Asset | Dependency | Output |
|-------|------------|--------|
| **Chibi Character Set** (7 emotions × N characters) | Token color palette | PNG-32 sprites |
| **Custom Emoji/Sticker Set** (20-30 SVGs) | Token palette + character style | SVG files |

Characters and emojis in same phase enforces shared style.

#### Phase 2: Audio Layer (Days 10-21, overlaps Phase 1)

| Asset | Dependency | Output |
|-------|------------|--------|
| **SFX Library** (80-120 files) | Mood definitions from tokens | WAV, -14 LUFS |
| **Music Bed Library** (30-50 tracks) | Mood definitions + duration spec | WAV/MP3, -14 LUFS |

Audio begins once mood definitions exist. Runs parallel with character art.

#### Phase 3: Post-Processing (Days 18-25, overlaps Phase 2)

| Asset | Dependency | Output |
|-------|------------|--------|
| **LUT Files** (7 mood `.cube` files) | Final token colors + rendered sample frames | 7 `.cube` files |

LUTs last because they must be calibrated against actual rendered output.

```
Critical Path:
Tokens + Fonts (Phase 0)
    |
    +---> Characters + Emojis (Phase 1)
    |         |
    |         +---> LUTs (Phase 3) — needs rendered frames
    |
    +---> SFX + Music (Phase 2) — parallel track

Total: ~25 days serial / ~18-20 days with 2 people
```

---

### Time Estimates

| Asset Category | Hours | Calendar Days (solo) |
|----------------|-------|---------------------|
| Design Tokens (7 JSONs) | 11-16 | 2-3 |
| Font Bundling | 7-11 | 1-2 |
| Characters (3 chars × 7 emotions, AI+cleanup) | 18-30 | 4-6 |
| Emojis/Stickers (20-30 SVGs) | 13-19 | 3-4 |
| SFX Library (80-120 WAVs) | 16-24 | 3-5 |
| Music Beds (30-50 tracks) | 15-23 | 3-5 |
| LUTs (7 `.cube` files) | 9-15 | 2-3 |
| **TOTAL** | **89-138** | **18-28 serial / 14-20 parallel** |

---

### Cost Optimization

| Scenario | Monthly | Annual | Stack |
|----------|---------|--------|-------|
| **Minimum Viable** | ~$30 | ~$360 | Midjourney Standard + free audio (Pixabay/Freesound) + DaVinci Resolve (free) + Procreate ($13 one-time) |
| **Recommended** | ~$42 | ~$500 | Midjourney Standard + Epidemic Sound ($10/mo) + DaVinci Resolve (free) + CSP PRO ($50 one-time) |
| **Professional** | ~$85 | ~$1,020 | Midjourney Pro ($60/mo) + Artlist ($17/mo) + DaVinci Resolve (free) + CSP EX ($8/mo) |

_Sources: [Midjourney Plans](https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans), [Artlist vs Epidemic Sound](https://www.epidemicsound.com/blog/artlist-vs-epidemic-sound/), [CSP Pricing](https://tekpon.com/software/clip-studio-paint/pricing/)_

---

### Risk Assessment and Mitigation

| Pitfall | What Goes Wrong | Prevention |
|---------|----------------|------------|
| **Inconsistent character style** | Line weight, proportions drift between emotions when generated in separate sessions | Generate ALL 7 emotions in one session with `--cref --cw 100 --sref`. Create character model sheet first. |
| **Audio level mismatches** | SFX from different sources arrive at -6 to -24 LUFS. YouTube re-normalizes unpredictably | Batch normalize ALL assets to -14 LUFS / -1.5 dBTP with `ffmpeg loudnorm` before they enter the library |
| **Font rendering drift** | Text shifts position between Studio preview and Lambda/Docker render | Bundle `.woff2` locally. Use `loadFont()` with `delayRender` guards. NEVER use `font-display: swap` in Remotion |
| **Color shift from LUT** | Token color `#FF6B6B` becomes `#E85555` after LUT post-processing | Create LUTs LAST against actual Remotion frames. Set `colorspace=bt709`. Reject LUT if Delta-E > 5 on brand colors |
| **Over-engineering tokens** | 2 weeks building multi-tier token system before rendering a single video | Start flat (1 JSON per theme). Render 7 test videos first. Add abstraction layers only when 3+ templates share tokens |

---

### Quality Gates (DA "Done" Criteria)

**Do NOT start mass production until all gates pass:**

**Gate 1 — Token Completeness:**
- [ ] All 7 theme JSONs parse without error
- [ ] No hardcoded values in template — everything traces to a token
- [ ] Switching theme produces visually distinct but coherent output

**Gate 2 — Character Consistency:**
- [ ] All 7 emotions side-by-side: identical proportions, line weight, palette (only expression changes)
- [ ] 5-second emotion-cycling animation: no jarring style shifts
- [ ] Clean background removal on all variants (no halo/fringe)

**Gate 3 — Audio Integration:**
- [ ] All SFX/music within 1 LUFS of -14 target
- [ ] No true peaks > -1.5 dBTP
- [ ] Balanced mix on: laptop speakers, earbuds, phone speaker
- [ ] Music bed loop points seamless (no click at join)

**Gate 4 — Font Rendering:**
- [ ] Local dev render vs production render: Delta-E < 2 on text regions
- [ ] No fallback font frames (check `--log=verbose`)
- [ ] Caption text legible on 6-inch phone screen

**Gate 5 — LUT / Color Pipeline:**
- [ ] Brand colors shift Delta-E < 5 after LUT
- [ ] Chibi skin tones remain natural
- [ ] All 7 mood LUTs produce visually distinct results

**Gate 6 — End-to-End Smoke Test:**
- [ ] 7 complete Shorts rendered (one per mood), using all layers
- [ ] Render time < 60s per Short (factory viability)
- [ ] Passes YouTube Shorts upload validation (1080x1920, <60s, H.264, AAC)
- [ ] Watchable on phone: "Would I watch this for 15 seconds?"

**Gate 7 — Asset Manifest:**
- [ ] Every asset has unique filename following naming convention
- [ ] Manifest JSON lists all assets with metadata
- [ ] No orphan assets (everything referenced by at least one config)
- [ ] Total library < 500MB (reasonable CI/CD times)

---

## Technical Research Recommendations

### Complete DA Asset Checklist (FINAL)

```
public/shared/                              SHARED DA-LOCKED ASSETS
├── characters/
│   ├── chibi-{name}/                       Per character (multiple characters)
│   │   ├── manifest.json                   Character config + supported emotions
│   │   ├── neutral.png                     PNG-32, 800-1080px wide, transparent
│   │   ├── excited.png
│   │   ├── confused.png
│   │   ├── panicking.png
│   │   ├── happy.png
│   │   ├── sad.png
│   │   └── angry.png
│   └── (more characters...)
├── fonts/
│   ├── Montserrat-ExtraBold.woff2          Primary caption font
│   └── Montserrat-Medium.woff2             UI/watermark font
├── sfx/                                    80-120 files total
│   ├── whoosh/                             8-12 variants
│   │   ├── whoosh-light-01.wav             WAV, 48kHz, 16-bit, mono
│   │   ├── whoosh-medium-01.wav            Normalized -14 LUFS, -3 dBFS peak
│   │   └── ...
│   ├── impact/                             8-10 variants
│   ├── pop/                                6-8 variants
│   ├── riser/                              4-6 variants
│   ├── stinger/                            4-6 variants
│   ├── sparkle/                            4-6 variants
│   ├── notification/                       4-6 variants
│   ├── error/                              4-6 variants
│   ├── success/                            3-5 variants
│   ├── glitch/                             4-6 variants
│   └── crowd/                              3-4 variants
├── music/                                  30-50 tracks
│   ├── high-energy/
│   │   ├── upbeat-pop-01.mp3               Stereo, -14 LUFS
│   │   ├── upbeat-pop-01-15s.mp3           15s edit
│   │   └── upbeat-pop-01-meta.json         { bpm, mood, energy, key, genre }
│   ├── chill/
│   ├── cinematic/
│   ├── quirky/
│   └── ...
├── emojis/                                 20-30 custom SVGs
│   ├── fire.svg                            Parameterized fill, viewBox-normalized
│   ├── heart.svg
│   ├── sparkle.svg
│   └── ...
├── brand/
│   ├── sonic-logo.wav                      2-4s audio logo
│   ├── transition-main.wav                 Signature transition
│   ├── transition-alt-1.wav                Pitch-shifted variant
│   └── watermark.png                       Channel watermark
└── textures/                               (optional, if baking procedural)
    ├── grain-overlay.png
    └── dust-particles.png

themes/                                     7 DESIGN TOKEN JSON FILES
├── neutral.json                            { colors, particles, grain, vignette,
├── excited.json                              motion, audio, typography, lut }
├── confused.json
├── panicking.json
├── happy.json
├── sad.json
└── angry.json

luts/                                       7 FFMPEG .CUBE LUT FILES
├── neutral.cube
├── excited.cube
├── confused.cube
├── panicking.cube
├── happy.cube
├── sad.cube
└── angry.cube
```

### Asset Count Summary

| Category | Count | Format | Size Estimate |
|----------|-------|--------|---------------|
| Chibi PNGs | 7 per character × N characters | PNG-32, transparent | 1-3 MB per set |
| Fonts | 2-3 files | WOFF2 | 60-150 KB |
| SFX | 80-120 | WAV, 48kHz, mono | 50-100 MB |
| Music Beds | 30-50 (+ 15s edits) | MP3, stereo | 100-250 MB |
| Custom Emoji | 20-30 | SVG | < 1 MB |
| Brand Audio | 3-5 | WAV | 2-5 MB |
| Theme JSONs | 7 | JSON | < 50 KB |
| LUT Files | 7 | .cube | 1-5 MB |
| **TOTAL** | **~200-300 files** | Mixed | **~200-400 MB** |

### Technology Stack Recommendations

| Layer | Tool | Why |
|-------|------|-----|
| Video engine | Remotion v4 | Already in use; `inputProps` + Zod = factory pattern |
| Character gen | Midjourney `--cref` + CSP cleanup | Best consistency; Flux/LoRA for budget option |
| Audio source | Epidemic Sound ($10/mo) + Freesound.org | Lifetime rights + CC library |
| Audio processing | FFmpeg + Pedalboard + DeepFilterNet | Already in pipeline |
| Transcription | @remotion/install-whisper-cpp | First-party, word-level timestamps |
| Color grading | DaVinci Resolve (free) → `.cube` export | Professional grade, zero cost |
| Font management | @remotion/fonts + local .woff2 | Zero network dependency |
| Schema validation | Zod + @remotion/zod-types | Visual Studio editing for non-devs |
| Post-processing | FFmpeg (lut3d + loudnorm + faststart) | Already in pipeline |
| Asset storage | Git LFS (small) + cloud bucket (large) | Hybrid approach |

---

## Research Complete

This research document covers the full DA asset inventory for a YouTube Shorts factory:

1. **Technology Stack** — 8 asset domains with tools, specs, and best practices
2. **Integration Patterns** — End-to-end pipeline from asset creation to final render
3. **Architectural Patterns** — Token hierarchy, Zod schemas, registry pattern, content/presentation split
4. **Implementation Roadmap** — Phased plan, time estimates, costs, pitfalls, quality gates

**The DA is defined by ~200-300 files across 7 categories, structured as data (JSON tokens + LUTs) not code, taking 14-20 working days to produce with a budget of $360-$1,020/year.**
