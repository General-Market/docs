# YC + PH Video Analysis Report — No-Transcript Videos

**255 videos analyzed** (203 YC, 52 PH) in under 4 minutes.

---

## Summary

| Metric | Value |
|--------|-------|
| Total videos analyzed | 255 |
| Successful | 255 (100%) |
| Avg duration | 83s (median 60s) |
| Avg scene transitions | 4.1 per video |
| Avg unique text segments (OCR) | 6.9 per video |
| Videos with substantial on-screen text | 177 (69%) |
| Videos with >5 text segments | 127 (50%) |

## Duration Distribution

| Bucket | Count | Share |
|--------|-------|-------|
| <15s | 6 | 2% |
| 15-30s | 25 | 10% |
| 30-60s | 91 | 36% |
| 1-2min | 99 | 39% |
| 2-5min | 25 | 10% |
| >5min | 9 | 4% |

Most YC launch videos land between 30s and 2 minutes. The sweet spot is 60 seconds — enough to demo, too short to bore.

## Frame Type Distribution

| Type | Avg prevalence |
|------|----------------|
| simple_visual (person/scene) | 40.5% |
| dark_screen (intros/outros/transitions) | 22.0% |
| white_screen (slides/text cards) | 18.5% |
| detailed_visual (complex scenes) | 9.7% |
| text_with_visual (UI + labels) | 6.3% |
| ui_or_code (screenshots/code) | 2.1% |
| text_heavy (slides with dense text) | 1.0% |

The typical no-transcript video is 40% talking head or simple scene, 22% dark frames (logos, transitions, intros), 18% white/light backgrounds (likely text cards or product on white). Only ~9% of frames are product demos (UI/code), which explains why transcripts were absent — these are largely visual demos, not narrated walkthroughs.

## Transition Patterns

- 73 videos (36%) have **zero transitions** — single continuous shot
- 18 videos (9%) have exactly 1 transition — before/after or intro-to-content
- 34 videos (17%) have **10+ transitions** — these are polished product demos with multiple screens
- Maximum: 39 transitions (350s video — likely a full product walkthrough)

## Top Text-Rich Videos (Product Demos)

| Video ID | Company | Text Segments | Duration |
|----------|---------|---------------|----------|
| 47BL6WLZJ1g | Reflex | 64 | 350s |
| rsGrmGeP8mc | Trellus | 49 | 324s |
| DhDfHVDyGFM | HENRY | 37 | 135s |
| --MSWRhOAg8 | Venue.ink | 35 | 429s |
| c47Ch1kB0eU | Nexa Labs | 27 | 250s |
| NPm0idKktzs | QueryPie AI | 24 | 106s |

## Videos With Most Scene Transitions (Polished Demos)

| Video ID | Transitions | Duration |
|----------|-------------|----------|
| 47BL6WLZJ1g | 39 | 350s |
| lbolXe-Za0k | 22 | 100s |
| uIQkUCxhIG4 | 22 | 78s |
| 27tIG8jEAbc | 21 | 119s |
| goioQTngpSU | 20 | 121s |

## Key Findings

1. **No-transcript videos are overwhelmingly visual demos** — product UI recordings, talking-head pitches, or animated explainers. The absence of a YouTube transcript doesn't mean absence of content; it means the content is visual, not spoken (or the audio is music-only).

2. **OCR extracts usable but noisy text** — pytesseract on 360p YouTube rips captures product names, UI labels, and slide headlines, but misreads frequently. The pseudo-transcripts serve as keyword indices, not readable prose.

3. **36% are single-shot videos** — no transitions at all. These are typically screen recordings or webcam pitches. The remaining 64% have intentional editing.

4. **Dark frames dominate 22% of video time** — most videos have branded intros/outros consuming 5-10s each, which on a 60s video is significant overhead.

## Output Files

- `yc_video_analyses/` — 203 per-video JSON analyses (YC)
- `ph_video_analyses/` — 52 per-video JSON analyses (PH)
- `yc_video_analyses_master.json` — aggregated master with all YC analyses
- `yc_launches_enriched.json` — updated with `video_analysis` field on matched launches

## Per-Video JSON Schema

```json
{
  "video_id": "string (YouTube ID)",
  "status": "ok | failed",
  "duration_sec": 87.9,
  "resolution": "360x360",
  "fps": 30.0,
  "frames_analyzed": 31,
  "transition_count": 4,
  "transitions": [{"timestamp_sec": 12.0, "correlation": 0.18, "type": "hard_cut"}],
  "unique_text_segments": 11,
  "text_extractions": [{"timestamp_sec": 3.0, "text": "ProductName Dashboard"}],
  "pseudo_transcript": "concatenated unique texts | separated by pipes",
  "frame_type_distribution": {"simple_visual": 0.45, "dark_screen": 0.2},
  "scene_snapshots": [{"timestamp_sec": 0.0, "frame_type": "dark_screen", "dominant_colors_bgr": [[30,30,30]], "has_text": false}]
}
```
