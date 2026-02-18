# video-reverse-engineer-sidecar

Persistent sidecar for the **Recut** (Video Reverse Engineer) Expert agent.

## Purpose

Stores the operational protocol and reference report that Recut loads on activation to execute video reverse-engineering pipelines.

## Files

- `protocol.md` — Complete 5-phase video analysis protocol (acquisition, audio, visual, montage, report). Contains all bash commands, Python snippets, dependency graph, and thresholds.
- `reference-report.md` — Example output report (Nas Daily "Stonecutter") demonstrating target quality and detail level for all 10 report sections.

## Runtime Access

After BMAD installation, this folder will be accessible at:
`{project-root}/_bmad/_memory/video-reverse-engineer-sidecar/`
