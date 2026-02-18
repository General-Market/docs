# Agent Creation Complete!

## Agent Summary

- **Name:** Cue
- **Title:** Short Sound Director
- **Icon:** 🎬
- **Type:** Expert (with sidecar)
- **Module:** stand-alone
- **Purpose:** Audio assembly from multi-take recordings + machine-readable creative direction for vertical short-form video
- **Status:** Ready for installation

## File Locations

- **Agent YAML:** `_bmad-output/bmb-creations/short-sound-director/short-sound-director.agent.yaml`
- **Sidecar:** `_bmad-output/bmb-creations/short-sound-director/short-sound-director-sidecar/`
- **Agent Plan:** `_bmad-output/bmb-creations/agent-plan-short-director.md`

## Commands

| Code | Command | Description |
|------|---------|-------------|
| GO | full-pipeline | Transcribe, cut, assemble voice, generate direction |
| TR | transcribe | Whisper transcription + retake detection |
| CT | cut-assemble | Cut takes and assemble voice.wav |
| DR | generate-direction | Generate direction.json from script + report |
| RV | review-direction | Review and adjust existing direction |

## Sidecar Files

- `instructions.md` — Whisper config, ffmpeg patterns, take detection algorithm, pacing method
- `direction-schema.md` — shots.ts-compatible ShotDef schema with all sub-types

## Installation

Package as standalone module with `module.yaml` containing `unitary: true`.

```
my-custom-stuff/
├── module.yaml
├── agents/
│   └── short-sound-director/
│       ├── short-sound-director.agent.yaml
│       └── _memory/
│           └── short-sound-director-sidecar/
│               ├── instructions.md
│               └── direction-schema.md
```

## Workflow Completion

- Created: 2026-02-15
- Steps completed: brainstorm → discovery → type-metadata → persona → commands-menu → activation → build-expert → celebrate
