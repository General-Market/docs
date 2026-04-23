# MaxCut — Design

A standalone non-linear editor. Tauri shell. React UI. Remotion as paint engine and exporter. Parakeet V3 as the assistant. Sixty frames per second, because anything less is nostalgia.

We edit. The AI flags. Remotion renders. Nothing pretends to be anything it is not.

---

## 1. Premise

Remotion is not a timeline editor. Remotion Studio is a preview. Our existing compositions in `video/` were written as code and cannot be retrofitted into clips without becoming lies. So we stop pretending and build the editor ourselves.

Remotion appears in two places only:
- `@remotion/player` inside the preview pane.
- `@remotion/bundler` + `@remotion/renderer` at export time.

Everything else — timeline, waveform, snap, ripple, drag-to-move text, AI flags, sync, UI — is ours.

---

## 2. Runtime

**Tauri 2.** Rust shell, WebView frontend. Not Electron. Electron drags Chrome along; a tool does not need another browser. Tauri gives us native dialogs, Finder drag-drop, subprocess control for `ffmpeg`/`parakeet-mlx`, and a binary under 20 MB.

Tauri `main.rs` owns: file dialogs, subprocess lifecycle, filesystem writes, autosave, crash journal. The frontend never touches the disk directly.

---

## 3. Shape

```
maxcut/
├── package.json                    Vite + React + Tauri
├── tauri/
│   ├── src/main.rs                 IPC, subprocess orchestration, WAL
│   └── tauri.conf.json
├── app/src/
│   ├── editor/
│   │   ├── Timeline.tsx            tracks, playhead, zoom, virtualization
│   │   ├── TimelineClip.tsx        clip block + trim handles + fade handles
│   │   ├── TimelineText.tsx        text block
│   │   ├── TrackHeader.tsx         name, mute, solo, lock, height handle
│   │   ├── Ruler.tsx               timecode strip, tabular numbers
│   │   └── Playhead.tsx            obeys transport, never animates
│   ├── waveform/
│   │   ├── Waveform.tsx            canvas draw
│   │   ├── peaks.ts                two-tier peak streams
│   │   └── cache.ts                sidecar lookup + invalidation
│   ├── thumbnails/
│   │   ├── Strip.tsx               clip thumbnail row
│   │   └── sprite.ts               1-fps JPEG sprite cache
│   ├── snap/
│   │   ├── useSnap.ts              magnetic snap, 8 px threshold
│   │   └── targets.ts              clip edges, playhead, markers, grid, words
│   ├── ripple/
│   │   └── ripple.ts               pure math, unit-tested
│   ├── audio/
│   │   ├── crossfade.ts            equal-power, log, linear curves
│   │   ├── gainEnvelope.ts         keyframe math
│   │   ├── ducking.ts              Parakeet-driven sidechain
│   │   ├── loudness.ts             LUFS analysis + normalize
│   │   ├── zeroCross.ts            ±3 ms search on cut
│   │   └── meters.tsx              dBFS peak + true-peak master
│   ├── sync/
│   │   ├── slip.ts                 Y tool
│   │   ├── slide.ts                U tool
│   │   ├── xcorr.ts                normalized cross-correlation on peaks
│   │   ├── onset.ts                clap / transient detector
│   │   └── drift.ts                detect, badge, re-align
│   ├── preview/
│   │   ├── Preview.tsx             wraps @remotion/player
│   │   └── DraggableText.tsx       edit-mode overlay
│   ├── ai/
│   │   ├── TranscribePanel.tsx
│   │   ├── SuggestionList.tsx
│   │   ├── detectors/
│   │   │   ├── silence.ts
│   │   │   ├── filler.ts
│   │   │   └── repeat.ts           v2 only
│   │   └── TranscriptView.tsx      Descript-style word-edit → ripple
│   ├── project/
│   │   ├── schema.ts               Zod, versioned
│   │   ├── store.ts                Zustand + zundo
│   │   ├── persist.ts              autosave + WAL replay
│   │   └── migrations.ts           forward only, backup before each
│   ├── ui/
│   │   ├── tokens.css              colors, spacing, type
│   │   ├── cursors/                custom 24 px SVG cursors
│   │   └── Splitter.tsx            four-zone resizable layout
│   └── shortcuts/
│       └── keymap.ts               one table, consulted everywhere
└── remotion/
    ├── TimelineComposition.tsx     reads Project → paints frame
    ├── Root.tsx                    registers composition at project fps
    └── bundle.ts                   bundler entry for renderer
```

---

## 4. Data model

One document. Versioned. Zod-validated on load. Forward migrations only. A backup is written to `.maxcut/backups/` before every migration. Always.

```ts
type Project = {
  version: 1;
  meta: {
    fps: 60;                    // default. integer only. no drop-frame.
    width: 1920;
    height: 1080;
    sampleRate: 48000;
    duration: number;           // frames, derived, cached
  };
  media: Asset[];
  tracks: Track[];
  markers: Marker[];
  suggestions: CutSuggestion[];
  transcript?: Transcript;
  clipboard?: ClipSlice[];      // live in document so copy survives autosave
};

type Asset = {
  id: string;
  path: string;                 // absolute at rest; save() rewrites to relative if under project
  kind: 'video' | 'audio' | 'image' | 'text';
  duration: number;             // source frames at sourceFps
  sourceFps: number;            // may differ from project.meta.fps
  probe: FFProbe;
  peaksPath?: string;           // two-tier: 200 Hz + 1 kHz
  spritePath?: string;          // 1-fps thumbnail sprite, video only
};

type Track = {
  id: string;
  kind: 'video' | 'audio' | 'text';
  muted: boolean;
  solo: boolean;
  locked: boolean;              // ignores ripple, drag, delete
  height: number;               // px, default 56, clamp 44..140
  excludeOnExport?: boolean;    // muted ≠ deleted
  clips: Clip[];
};

type Clip = {
  id: string;
  assetId: string;
  in: number;                   // source frame
  out: number;                  // source frame
  at: number;                   // timeline frame
  linkedTo?: string[];          // other clip ids in sync group
  syncOffsetFrames?: number;    // per-clip manual nudge, can be negative
  offsetSamples?: number;       // audio sub-frame trim, ±(sampleRate/fps)
  volumeDb?: number;            // -∞..+12, default 0
  phaseInvert?: boolean;        // audio only
  audioFade?: { inMs: number; outMs: number; curve: 'equalPower'|'log'|'linear' };
  gainEnvelope?: { frame: number; db: number }[];  // relative to volumeDb
  transform?: { x, y, scale, rotate };             // v2
};

type TextBlock = {
  id: string;
  content: string;
  from: number;                 // timeline frame
  to: number;
  x: number; y: number;         // normalized 0..1
  style: TextStyle;
};

type Marker = {
  id: string;
  at: number;                   // timeline frame
  label: string;
  color: 'cyan' | 'amber' | 'red' | 'green' | 'white';
  kind: 'chapter' | 'note' | 'todo';
};

type CutSuggestion = {
  id: string;
  kind: 'silence' | 'filler' | 'repeat';
  assetId: string;
  start: number;                // source frame
  end: number;
  text: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
};

type Transcript = {
  assetId: string;
  words: { text: string; start: number; end: number; confidence: number }[];
  sentences: { start: number; end: number }[];
};
```

Every UI action is a reducer on `Project`. Remotion reads `Project` at render time. No second source of truth. Ever.

---

## 5. Editor mechanics

### 5.1 Timeline
Tracks stack vertically. Header (name, mute, solo, lock, height drag) and strip (clips, thumbnails, waveforms). Ruler at top. Playhead is a vertical line with draggable head. Horizontal zoom 1× → 100×. Virtualized: off-screen clips do not render.

### 5.2 Cuts
Razor tool (`C` at playhead) splits every clip under the playhead on unlocked tracks. `Opt-C` splits audio only — creates a detached audio clip, preserves video continuity. `Shift-C` on a linked pair splits video only — the J-cut / L-cut primitive, which is half the reason podcasters exist.

### 5.3 Trim
Drag edge. Left edge adjusts `in + at`. Right edge adjusts `out`. Clamped to source bounds. Frame-quantized by default. **`Opt-drag` on audio trim = sample-accurate**, written to `offsetSamples`.

### 5.4 Ripple
Shorten clip N by Δf → every clip at `> at` on the same track (and its linked group) shifts by −Δf. Ripple delete collapses the gap. **`Opt` disables ripple.** Locked tracks never ripple. Ripple only crosses tracks for members of the same sync group.

Pure function, unit tested:
```ts
ripple(clips: Clip[], anchor: number, delta: number): Clip[]
```

### 5.5 Magnetic snap
Drag edge or playhead → collect targets:
- clip edges on any track
- playhead
- markers (all kinds)
- frame grid
- transcript word boundaries (when transcript exists)
- **zero-crossings** within ±3 ms — audio trim only, auto-enabled

Snap within 8 px. Visual snap line flashes at the locked coordinate. **`Opt`** disables snap. **`Shift`** restricts to frame grid only. **`Z`** restricts to zero-crossings on audio.

### 5.6 Link / detach
Video and audio imported from the same source form a sync group. Moving one moves the group. `Cmd-L` toggles link on the selection. `Cmd-Opt-L` detaches audio from video permanently (needed for B-roll over VO). Groups are N-ary, not pairs: camera + two mics = one group.

### 5.7 Slip / Slide
- **Slip** `Y` + drag: shifts source `in`/`out` inside the clip. `at` and duration stay.
- **Slide** `U` + drag: shifts `at`. Neighbors compensate. Source bounds stay.
- Both operate on sync groups atomically.

### 5.8 Selection model
Single-click selects a clip. `Cmd-click` extends. `Shift-click` ranges on the same track. Rubber-band drag selects across tracks. `Cmd-A` selects everything. `Cmd-Shift-A` selects all on the active track. `I` / `O` set in/out of a timeline range.

### 5.9 Range operations (Pro Tools verbs)
With a range defined by `I`/`O`:
- **Extract** (`Del`) — remove within range on unlocked tracks, ripple subsequent clips to close the gap.
- **Lift** (`Opt-Del`) — remove within range, leave a gap.
- **Duplicate** (`Cmd-D`) — insert a copy immediately after the range.

### 5.10 Text drag
Edit-mode overlay on the preview. Each `TextBlock` draws a hidden drag handle at its bounding box. Drag updates `x`, `y` in normalized coordinates so 1080p → 4K does not murder your layouts. Toggle with `T`. Hidden during playback and render.

### 5.11 Nudge
`←` / `→` = ±1 frame. `Shift-←` / `Shift-→` = ±10 frames. `,` / `.` = audio-only ±1 frame relative to video inside a sync group. `Shift-,` / `Shift-.` = ±10.

### 5.12 Copy / paste
`Cmd-C` copies selection to `Project.clipboard`. `Cmd-V` pastes at playhead. Clipboard survives autosave and crash.

### 5.13 Undo / redo
Zustand + `zundo`. Every reducer that mutates `Project` is snapshotted. `Cmd-Z` / `Cmd-Shift-Z`. Stack depth 500. Playhead moves and selection changes are not undoable. AI accept/reject is.

---

## 6. Waveform & thumbnails

**Peaks** are written as two-tier sidecars on import:
- `200 Hz` (5 ms) — used below 1 px/frame zoom.
- `1 kHz` (1 ms) — used at higher zoom, when sample-accurate trim becomes visible.

Format: int16 min/max pairs, binary, cached in `.maxcut/peaks/<assetId>.{200|1000}.peaks`. Recomputed only if source mtime changes. Canvas draws peaks per-clip by slicing `peaks[in*ratio..out*ratio]`. Offscreen canvas + `drawImage` for smooth scrolling.

**Thumbnails**: ffmpeg seek + downscale to 64 px JPEG sprite sheet, one frame per second, sidecar at `.maxcut/thumbs/<assetId>.webp`. Strip renders as `background-image` with `background-position` offset. Cheap. Essential at 60 fps where visual trim without thumbnails is guesswork.

**Audio scrubbing**: dragging playhead plays `max(50 ms, 3 frames)` at the target frame via WebAudio. At 60 fps, three frames is exactly 50 ms — the lower bound preserves audibility. Granular, not full playback. Pitch-preserved is a v2 problem; the minimum viable is pitch-varying and we admit so.

---

## 7. Audio editing — the part that ruins editors

An NLE lives or dies by its audio. This section exists because one sentence about peaks was a betrayal.

### 7.1 Crossfades at every cut
Default **2-frame equal-power crossfade** on both sides of every cut on an audio track. Zero configuration, zero clicks. Fade length per clip edge is editable via visible corner handles — two small triangles, drag inward to extend. Curves: `equalPower` (default), `log`, `linear`. `Cmd-F` applies a custom fade length to the selection.

### 7.2 Zero-crossing snap
On `C` cut or trim on an audio clip, snap to the nearest zero-crossing within ±3 ms. Hold `Z` to enforce, `Opt` to disable. Eliminates the click that no amount of fade length will fully hide.

### 7.3 Per-clip gain (dB)
Inspector exposes `volumeDb` as a slider with ticks at −∞, −20, −12, −6, 0, +6, +12. Tabular numbers. `J` / `K` on a selected clip nudges ±0.5 dB. No mystery, no normalization magic by default.

### 7.4 Gain envelope (the only keyframe in v1)
One polyline per clip. `P` toggles pen tool. Click on the waveform to drop keyframes. Drag to shape. `Opt-click` deletes. The envelope is additive to `volumeDb`. No bezier handles — linear segments only. Anything more is a keyframe system in disguise.

### 7.5 Ducking
Right-click music track → **Duck to…** → pick a voice track. The system reads the voice track's Parakeet word timestamps and writes a `gainEnvelope` on the music: −12 dB under each word, 150 ms attack, 400 ms release. No DSP, no sidechain; just envelope keyframes. User can edit the result. The transcript already paid for this.

### 7.6 Fade handles on the clip strip
Two triangular grab targets at each clip corner. Drag inward = fade length in frames. Always visible. Draggable even while a fade is zero — a 1 px nub at the corner. The Pro Tools convention; stop inventing.

### 7.7 Loudness target
Export dialog exposes **Match loudness to:** `Off`, `-16 LUFS` (podcast), `-14 LUFS` (streaming). Implemented as two-pass ffmpeg `loudnorm` post-render. Zero cost during edit.

### 7.8 Per-clip normalize
Right-click clip → **Normalize peak to −3 dBFS**. One-pass ffmpeg. Writes `volumeDb`. Undoable. Saves a thousand manual nudges.

### 7.9 Phase invert
`Shift-I` on a selected audio clip inverts polarity. Stored as `phaseInvert: true`. Two mics on one source will thank you.

### 7.10 Audio-only tracks
Music, SFX, ambience, voiceover, safety dupe. First-class. Imported from the media bin directly to an audio track. No video peer. Default project has **4 audio tracks**. Users add more with `Cmd-T`.

### 7.11 Solo / mute semantics
Solo is exclusive across tracks. `Shift-click` a solo button to stack multiple solos. `Opt-click` clears all solos. Muted tracks are excluded from preview; at export they are included unless the track has `excludeOnExport`. One user confusion retired.

### 7.12 Meters
One master dBFS peak meter, always visible, top-right. Per-track peak meters in each track header, 4 px wide strip. Red at ≥ −1 dBFS, amber −6 to −1, green below. True-peak detection is a v1.1 problem.

### 7.13 Sub-frame audio trim
Frame-quantized trim gives 16.67 ms resolution — audible. `Opt-drag` on an audio clip edge writes `offsetSamples`, resolution down to one sample at 48 kHz (20.8 µs). The preview renders the offset exactly; export honors it via ffmpeg `atrim` with sample indices.

---

## 8. Sync tools

Sync is its own section because without it editors lie about alignment and blame the user.

### 8.1 Slip / Slide
Covered in §5.7. Y and U.

### 8.2 Manual offset
Every clip has `syncOffsetFrames`. `,` / `.` nudges audio relative to its video peer in the sync group. `Shift-,` / `Shift-.` for ±10 frames. A visible offset badge appears on the clip when non-zero (amber).

### 8.3 Waveform auto-align
Select two audio clips (or an audio + the audio track of a video clip). `Cmd-Shift-A`. System computes normalized cross-correlation on peak streams over a ±5 s window, locates argmax, applies the offset to the secondary clip. Reports the offset in ms. If correlation < 0.3, refuses and says so — bluntly. Peaks already exist; this is free.

### 8.4 Clap / transient alignment
For DSLR + field recorder workflows. `Cmd-Shift-K`. Detects the first transient ≥ −12 dBFS with a rising edge > 20 dB in 5 ms. Marks both selected clips. Aligns marks. One keystroke, one clap, one edit session saved.

### 8.5 Drift detection
When a cut within a sync group affects the video but not the audio (because the user held `Opt-L` earlier), the pair is tagged **drifted**. Red chain icon on both clips, numeric offset in frames. `Cmd-Shift-R` runs a 2-second cross-correlation at the drift point and restores alignment. One click back to truth.

### 8.6 Sync group, not pair
`linkedTo: string[]` already supports it. Ripple and slip treat the group atomically — drag the camera clip, both mics follow; trim the camera clip, all three ripple together.

### 8.7 LTC / SMPTE timecode
Out of v1. Refused.

---

## 9. AI flow — Parakeet V3

1. Import video/audio.
2. Click **Transcribe** on a clip or **Transcribe All** in the AI panel.
3. Tauri spawns ffmpeg → 16 kHz mono WAV.
4. Tauri spawns `parakeet-mlx transcribe out.wav --json --timestamps word`.
5. Parse word-level JSON → `Transcript`.
6. Detectors:
   - **Silence** — RMS under threshold for ≥ 300 ms between words. Confidence = duration.
   - **Filler** — dictionary: `um, uh, like, you know, sort of, I mean, right?, so...`. Editable.
   - **Repeat** — v2. Real repetition detection needs phonetic distance, not word match.
7. Suggestions render as **amber outline blocks** on the clip + entries in the side panel.
8. Per suggestion: **Preview** (play 2 s context), **Accept** (apply ripple cut), **Reject** (dismiss), **Edit bounds** (drag handles).
9. Bulk: *Accept all silences > 1 s*, *Accept all fillers*, *Reject all*. Every action is undoable.

**Transcript panel — Descript pattern.** Words laid out as text. Selecting highlights timeline range. **Deleting a word performs a ripple cut.** Editing a word writes a subtitle overlay. This is the single highest-leverage feature in the product and it is free because Parakeet already gives us word-level timestamps.

---

## 10. Render — output via Remotion

**Export** → IPC to Tauri → Node subprocess:
1. Bundles `remotion/TimelineComposition.tsx` via `@remotion/bundler`.
2. Calls `renderMedia({ composition, inputProps: project, codec: 'h264', fps: project.meta.fps })`.
3. Writes MP4 to user-chosen path.
4. Streams progress back via IPC. **Cancel** kills the subprocess cleanly and deletes the partial file.
5. If loudness target is set, runs post-pass ffmpeg `loudnorm`.

**Presets (v1):**
- **1080p 60** (default): 1920×1080, 60 fps, H.264, AAC 192 kbps.
- **1080p 30**: for platforms that still pretend.
- Integer fps only. Anyone needing 59.94 can send angry emails to a different address.

**Captions export:** transcript → SRT or VTT in one pass. Free. Ships v1.

**Chapter export:** markers with `kind: 'chapter'` embed as MP4 chapter atoms.

Preview quality: **`renderQuality="low"` while scrubbing by default at 60 fps**, full quality when idle. Large projects (300+ clips) may need the low mode always — we provide the toggle and let the machine decide.

---

## 11. UI design system

§3 says "plain CSS modules". That is a build choice, not a design. Here is the design.

**The sit.** Resolve is a cockpit for someone paid by the hour. Descript is a Google Doc with a playhead. Premiere is a civil servant. CapCut is a birthday cake. **MaxCut sits where Linear meets Logic Pro.** Dense where the eye needs density, quiet everywhere else. A tool a designer trusts before breakfast.

### 11.1 Palette
Graphite, not black. No gradients.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0E0F12` | canvas |
| `--panel` | `#15171B` | side panels |
| `--track` | `#1C1F25` | timeline strip |
| `--divider` | `#2A2E36` | hairlines |
| `--fg` | `#E8ECF1` | primary text |
| `--fg-dim` | `#8A91A0` | labels, secondary |
| `--accent` | `#6EC1E4` | playhead, selection, snap lines |
| `--accent-warm` | `#E8A24B` | AI suggestions only |
| `--red` | `#E8657A` | destructive, clipping, drift |
| `--clip-video` | `#3D424D` | graphite |
| `--clip-audio` | `#2E5968` | dim cyan |
| `--clip-text` | `#504431` | warm off-white bar |

Color is information, not decoration. One accent for state. Amber is reserved for AI — users learn "amber = robot proposed this" within one minute.

### 11.2 Typography
Two faces.
- **Inter Tight** for UI — sizes 11, 12, 13, 14. Nothing above 14 except modal titles.
- **JetBrains Mono** for timecode, numbers, envelope keyframes. Tabular lining figures — digits do not jitter as the playhead runs.

Track headers: uppercase 10 px with +0.08 em tracking. No bold unless selected.

### 11.3 Density
- Ruler height: 22 px.
- Track header: 28 px.
- Clip strip default: 56 px, clamp 44..140, drag to resize.
- Toolbar: 40 px.
- Panel chrome: never thicker than 32 px.
- Spacing: 4 / 8 / 12 / 16 px. No other values.

### 11.4 Clip chrome
1 px hairline top and bottom. **No shadows. No rounded corners beyond 2 px.** A clip is a rectangle of time. Selected = 2 px inset stroke in `--accent`, no outer halo. AI suggestion = 1 px `--accent-warm` dashed outline with no fill. Drifted = 1 px `--red` chain icon in the corner.

### 11.5 Focus states
1 px inner ring in `--accent`. Keyboard focus visible everywhere. No default browser outline survives. Every interaction is reachable by keyboard alone.

### 11.6 Cursors — one per tool
Custom SVG, 24 px, 1.5 px stroke, white with 1 px `--bg` drop to read on any surface.

| Tool | Key | Cursor |
|---|---|---|
| Select | — | arrow |
| Trim left | hover edge | `]\|` |
| Trim right | hover edge | `\|[` |
| Ripple trim | `Shift` + trim | doubled bracket |
| Razor | `C` | razor + 1 px tick |
| Slip | `Y` | double arrow inside filmstrip |
| Slide | `U` | double arrow between walls |
| Pen (gain envelope) | `P` | pencil tip |
| Zoom | `Z` | magnifier + / − |
| Pan | space-hold over timeline | hand |
| Text | `T` | I-beam, preview overlay only |

### 11.7 Motion
- 120 ms ease-out for panel transitions.
- 60 ms for hover states.
- **Zero** for anything the playhead or a clip touches. Timelines do not animate. They obey.

Tooltips fade in at 60 ms after 400 ms hover. Modals use no motion — appear, dismiss with `Esc`.

### 11.8 Layout
Four persistent zones separated by draggable splitters:
- **Top-left**: media bin.
- **Top-right**: preview (Remotion Player).
- **Right rail**: inspector / AI panel / transcript (tabbed).
- **Bottom**: timeline (full width).

No floating palettes. No tab-within-tab. One modal at a time.

---

## 12. Keyboard shortcuts

One table. `shortcuts/keymap.ts`. Rebindable. Full keyboard operation is a v1 promise, not a v2 aspiration.

| Key | Action |
|---|---|
| `Space` | play / pause |
| `J K L` | reverse / pause / forward shuttle |
| `I O` | set in / out of range |
| `← →` | nudge selection ±1 frame |
| `Shift-← →` | nudge ±10 frames |
| `, .` | audio sync nudge ±1 frame |
| `Shift-, .` | audio sync nudge ±10 frames |
| `C` | split at playhead (all unlocked) |
| `Opt-C` | split audio only |
| `Shift-C` | split video only (J/L-cut) |
| `Del` | extract (ripple delete range) |
| `Opt-Del` | lift (leave gap) |
| `Cmd-D` | duplicate selection |
| `Cmd-C / Cmd-V` | copy / paste at playhead |
| `Cmd-A` | select all |
| `Cmd-Shift-A` | waveform auto-align selection |
| `Cmd-Shift-K` | clap-align selection |
| `Cmd-Shift-R` | re-sync drifted group |
| `Cmd-L` | toggle link |
| `Cmd-Opt-L` | detach audio from video |
| `Cmd-T` | add track |
| `Cmd-F` | apply fade length to selection |
| `Y` | slip tool |
| `U` | slide tool |
| `P` | pen (gain envelope) |
| `T` | text edit mode |
| `Z` | zero-crossing snap on audio |
| `M` | drop marker at playhead |
| `↑ ↓` | previous / next marker |
| `Shift-I` | invert phase on audio clip |
| `Cmd-Z / Cmd-Shift-Z` | undo / redo |
| `Cmd-S / Cmd-Shift-S` | save / save as |
| `Opt` (held) | disable ripple + disable snap |
| `Shift` (held) | snap to frame grid only |

---

## 13. Persistence & recovery

- Project file: `*.maxcut.json` — pretty-printed JSON.
- Autosave: every 5 s, only if the document is dirty.
- **Write-ahead log**: every reducer action appended to `.maxcut/wal.jsonl`, fsync every 500 ms. On crash, replay from last full autosave.
- **Save-as + versions**: rolling last 20 autosaves in `.maxcut/history/`. Opened via `Cmd-Shift-H`.
- **Pre-migration backup**: on every schema migration, copy the project to `.maxcut/backups/<timestamp>.maxcut.json`. Never deleted automatically.
- **Path portability**: on save, paths under the project folder are stored relative; others absolute. On load, missing files trigger a **Relink** modal listing each with a file-picker.
- **Close intent**: Tauri `beforeUnload` flushes autosave before allowing exit.

---

## 14. Scope v1

**In.**
- Tauri shell, single project file, WAL autosave.
- Default 4 audio tracks, 1 video, 1 text. Dynamic add/remove.
- Cuts, trim, ripple, ripple delete, slip, slide, drag text, magnetic snap, zero-crossing snap.
- Clip linking + detach, sync groups, waveform auto-align, clap align, drift re-sync.
- Crossfades, gain in dB, gain envelope, fade handles, phase invert, per-clip normalize, ducking.
- Waveforms (two-tier), thumbnails (1 fps sprites), audio scrubbing, peak meters.
- Parakeet transcribe + silence + filler detection + transcript-text editing.
- Captions export (SRT/VTT), chapter export, 1080p60 + 1080p30 H.264 presets.
- LUFS normalization at export.
- Undo/redo, full keyboard operation, save-as, version history, relink modal.

**Out.**
- Transitions (other than audio crossfade). Color grading. Keyframe animation beyond gain envelope and text position. Effects racks. Plugins (VST, AU).
- Multicam. Proxy transcodes. Nested timelines. Collaboration.
- LTC / SMPTE timecode sync. Drop-frame. 23.976 / 29.97 / 59.94.
- Repetition detection in AI. True-peak meters. Pitch-preserved shuttle.
- Templates, asset library, favorites.
- iPad, mobile, second-screen preview (don't prevent it; don't support it).

---

## 15. Refusals

Written so the v2 conversation is short.

| Feature | Reason for refusal |
|---|---|
| Transition library (wipes, spins) | Every editor drowns here |
| Color grading & scopes | Adjacent product, adjacent year |
| Keyframe animation for transforms | Gain envelope and text drag are the only keyframeable things in v1 |
| Plugin / VST / AU system | A plugin ABI is a forever promise |
| Multicam | Two synced cameras = one clap-align |
| Proxy transcodes | Deferred to v1.1 — documented top pain |
| Cloud collaboration | Different product |
| Templates & asset library | A file picker is a file picker |
| Drop-frame / NTSC fractions | Integer fps only. Say so in the export dialog |
| Mobile / iPad | Every pixel here assumes a mouse and a keyboard |
| "Auto-edit my whole video" AI | We ship the scalpel, not the ghost |
| Render queue | One render at a time. UI stub reserved for v1.1 |
| Screen reader support | Out of scope; say so honestly |

---

## 16. Stack

- **Shell**: Tauri 2 (Rust).
- **UI**: Vite + React 19 + TypeScript + Zustand + Zundo + Zod.
- **Preview**: `@remotion/player` 4.0.438 (pinned, matches `video/`).
- **Export**: `@remotion/bundler` + `@remotion/renderer`, same version.
- **Audio/video**: `ffmpeg` and `ffprobe` via Tauri subprocess; `fluent-ffmpeg` in the Node render process.
- **Transcription**: `parakeet-mlx` subprocess.
- **Styling**: plain CSS modules + design tokens in one file. No Tailwind.
- **Fonts**: Inter Tight + JetBrains Mono, bundled locally, no web fetch.
- **Tests**: Vitest for ripple / snap / xcorr / onset / detectors. Playwright for smoke.

---

## 17. Estimate

| Phase | Days |
|---|---|
| Tauri scaffold, schema, Player preview | 2 |
| Timeline + ruler + zoom + playhead + virtualization | 3 |
| Waveform (two-tier peaks) + thumbnails | 2 |
| Snap + ripple + trim + selection + copy/paste | 3 |
| Audio: crossfade + gain dB + envelope + fade handles + phase + zero-cross | 3 |
| Sync: slip + slide + xcorr + clap + drift detection | 3 |
| Ducking + loudness normalize + meters | 2 |
| Text drag overlay | 1 |
| Parakeet pipeline + detectors + suggestion panel | 2 |
| Transcript view + text-driven editing + captions export | 2 |
| Render subprocess + progress IPC + cancel | 1 |
| Persistence + autosave + WAL + relink modal | 2 |
| UI tokens + cursors + shortcuts | 2 |
| **Total** | **~28 working days — six weeks with life** |

Every estimate is a lie, but this is the shape of the lie.

---

## 18. First two days

1. `cargo create-tauri-app maxcut`. Pin versions.
2. Wire a blank Vite+React UI inside it.
3. Install `@remotion/player`. Render a placeholder `TimelineComposition` at 60 fps painting the frame number.
4. Define `Project` schema in Zod. Write a fixture with one video clip, one audio track, one text block. Load it. Render it. Play it.
5. Ship a static one-track timeline drawing clip rectangles — no interaction. Ruler. Playhead.

If that takes longer than two days, the estimate was wrong and we replan. If it takes less, we have already lied to ourselves about something else.

Everything after is commentary.
