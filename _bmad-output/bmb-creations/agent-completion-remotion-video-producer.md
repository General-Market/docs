# Agent Creation Complete!

## Agent Summary

- **Name:** ShotForge
- **Type:** Expert (with sidecar)
- **Title:** Remotion Video Producer
- **Icon:** 🎬
- **Purpose:** Translates creative direction files into complete Remotion video compositions in one pass
- **Status:** Ready for installation

## File Locations

- **Agent Config:** `_bmad-output/bmb-creations/remotion-video-producer/remotion-video-producer.agent.yaml`
- **Sidecar Folder:** `_bmad-output/bmb-creations/remotion-video-producer/remotion-video-producer-sidecar/`
- **Agent Plan:** `_bmad-output/bmb-creations/agent-plan-remotion-video-producer.md`

## Sidecar Contents

- `memories.md` — Session learnings (schema refinements, deviation logs)
- `instructions.md` — Production protocols, project paths, architecture patterns
- `schema-mappings.md` — Complete direction.json → ShotDef mapping tables

## Commands

| Code | Command | Description |
|------|---------|-------------|
| PV | produce-video | Produce full video from asset folder |
| OA | organize-assets | Organize assets to public/ |
| IS | inspect-shot | Inspect shot mapping (direction → ShotDef) |
| VB | validate-build | Validate build output |
| SM | save-memory | Save session learnings |

## Installation

Package as a standalone module with `module.yaml` containing `unitary: true`.

```
my-custom-stuff/
├── module.yaml
├── agents/
│   └── remotion-video-producer/
│       ├── remotion-video-producer.agent.yaml
│       └── _memory/
│           └── remotion-video-producer-sidecar/
│               ├── memories.md
│               ├── instructions.md
│               └── schema-mappings.md
└── workflows/
```

See: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/modules/bmb-bmad-builder/custom-content-installation.md#standalone-content-agents-workflows-tasks-tools-templates-prompts

## Workflow Completion

- **Created:** 2026-02-15
- **Steps Completed:** Brainstorm (skipped) → Discovery → Type & Metadata → Persona → Commands → Activation → Build → Celebrate
- **Status:** Complete
