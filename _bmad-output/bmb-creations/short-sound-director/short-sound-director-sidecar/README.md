# short-sound-director-sidecar

Sidecar folder for the **Cue** (Short Sound Director) Expert agent.

## Purpose

Stores workflow instructions, direction schema reference, and knowledge files
for the audio assembly and creative direction pipeline.

## Files

- `instructions.md` — Whisper config, ffmpeg cut patterns, take detection algorithm, pacing analysis method, style constraints
- `direction-schema.md` — shots.ts-compatible JSON schema (ShotDef interface, sub-types, direction rules)

## Runtime Access

After BMAD installation, this folder is accessible at:
`{project-root}/_bmad/_memory/short-sound-director-sidecar/`
