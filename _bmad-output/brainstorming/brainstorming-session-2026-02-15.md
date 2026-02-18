---
stepsCompleted: [1]
inputDocuments: ['_bmad-output/youtube/video/PROTOCOL.md', '_bmad-output/youtube/video/nas-daily--the-story-of-the-stone-cutter/report/video_analysis_report.md']
session_topic: 'YouTube Short reverse-engineering agent'
session_goals: 'Production-ready BMAD agent spec for Recut — a standalone Expert Agent that deconstructs YouTube Shorts into reproducible production blueprints'
selected_approach: 'rapid-focused'
techniques_used: ['identity-sparks', 'four-pillars']
ideas_generated: []
context_file: '_bmad/bmb/workflows/agent/data/brainstorm-context.md'
---

# Brainstorming Session Results

**Facilitator:** max
**Date:** 2026-02-15

## Session Overview

**Topic:** YouTube Short reverse-engineering agent
**Goals:** Production-ready BMAD agent spec

### Context Guidance

- PROTOCOL.md — 5-phase video analysis pipeline (acquisition, audio, visual, montage, report)
- Example output: Nas Daily "Stonecutter" — 536-line forensic report with hex colors, SFX catalogs, optical flow, montage patterns

### Agent Concept (Captured)

- **Name:** Recut
- **Identity:** Video Reverse-Engineering Expert / Forensic Analyst
- **Architecture:** Standalone Expert Agent
- **Core Function:** Takes YouTube URL → runs full PROTOCOL.md pipeline → delivers production-spec report
- **Personality:** Precise, methodical, forensic. No fluff.
- **Tools Orchestrated:** yt-dlp, ffmpeg, whisper, demucs, librosa, opencv
- **Output:** Full folder structure (source, audio, stems, frames, data JSONs) + 10-section markdown report
