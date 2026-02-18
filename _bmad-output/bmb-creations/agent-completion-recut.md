## Agent Creation Complete!

### Agent Summary

- **Name:** Recut
- **Type:** Expert (standalone, sidecar)
- **Purpose:** Reverse-engineer YouTube Shorts into reproducible production blueprints
- **Status:** Ready for validation

### File Locations

- **Agent Config:** `_bmad-output/bmb-creations/video-reverse-engineer/video-reverse-engineer.agent.yaml`
- **Sidecar:** `_bmad-output/bmb-creations/video-reverse-engineer/video-reverse-engineer-sidecar/`
- **Agent Plan:** `_bmad-output/bmb-creations/agent-plan-recut.md`

### Installation

Package as standalone module with `module.yaml` containing `unitary: true`.
See: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/modules/bmb-bmad-builder/custom-content-installation.md#standalone-content-agents-workflows-tasks-tools-templates-prompts

### Quick Start

1. Create a module folder
2. Add module.yaml with `unitary: true`
3. Place agent in `agents/video-reverse-engineer/` structure
4. Include sidecar folder in `_memory/video-reverse-engineer-sidecar/`
5. Install via BMAD installer
