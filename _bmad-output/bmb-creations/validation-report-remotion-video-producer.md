---
agentName: 'remotion-video-producer'
agentType: 'expert'
agentFile: '_bmad-output/bmb-creations/remotion-video-producer/remotion-video-producer.agent.yaml'
validationDate: '2026-02-15'
stepsCompleted:
  - v-01-load-review.md
  - v-02a-validate-metadata.md
  - v-02b-validate-persona.md
  - v-02c-validate-menu.md
  - v-02d-validate-structure.md
  - v-02e-validate-sidecar.md
  - v-03-summary.md
---

# Validation Report: ShotForge (Remotion Video Producer)

## Agent Overview

**Name:** ShotForge
**Type:** Expert (stand-alone)
**module:** stand-alone
**hasSidecar:** true
**File:** _bmad-output/bmb-creations/remotion-video-producer/remotion-video-producer.agent.yaml

---

## Validation Findings

### Metadata Validation

**Status:** ✅ PASS

**Checks:**
- [x] id: `_bmad/agents/remotion-video-producer/remotion-video-producer.md` — kebab-case, unique path
- [x] name: `ShotForge` — creative persona name, not a job title
- [x] title: `Remotion Video Producer` — concise functional description, determines filename
- [x] icon: `🎬` — single emoji, visually representative (clapperboard)
- [x] module: `stand-alone` — correct format, lowercase hyphenated
- [x] hasSidecar: `true` — matches actual sidecar folder structure

**Detailed Findings:**

*PASSING:*
- All 6 required metadata fields present and non-empty
- id path format matches naming convention
- name vs title properly distinguished (persona name vs functional role)
- Icon is single emoji appropriate to domain
- Agent type indicators consistent (stand-alone + hasSidecar:true = Expert)

*WARNINGS:* None

*FAILURES:* None

---

### Persona Validation

**Status:** ⚠️ WARNING (1 non-blocking issue)

**Checks:**
- [x] role: specific video post-production specialist, not generic
- [x] identity: defines seasoned engineer character with filmmaker sensibility
- [x] communication_style: speech patterns only — terse, production-floor cadence
- [x] principles: first principle activates expert knowledge (composition theory, pacing, color grading, audio mixing)

**Detailed Findings:**

*PASSING:*
- **Role**: Specific to Remotion + direction file translation. Aligns with PV/IS/OA/VB menu items. Achievable within LLM capabilities. Not too broad, not too narrow.
- **Identity**: Clear character (frame-obsessed post-production engineer). Not generic or cliched. Provides behavioral context.
- **Communication Style**: Describes HOW agent talks (terse cadence, production jargon, status updates). Reading aloud: sounds like a voice description. No forbidden identity/philosophy words in speech description.
- **Principles**: 5 principles (within 3-7 range). First activates expert knowledge domain. Each is a belief, not a task. Not obvious for the role. No overlaps with other persona fields.
- **Field Separation**: role=capabilities, identity=character, communication_style=speech, principles=philosophy. Clean separation verified.

*WARNINGS:*
- ⚠️ **communication_style missing memory reference patterns** — Expert agents should include patterns like "Last time you mentioned..." or "I've noticed patterns..." per expert-agent-validation.md. This helps the agent reference sidecar memories naturally in conversation.

*FAILURES:* None

---

### Menu Validation

**Status:** ✅ PASS

**Checks:**
- [x] Trigger format: all use `XX or fuzzy match on command-name` pattern
- [x] Description format: all start with `[XX]` matching trigger code
- [x] Command names clear and descriptive
- [x] Command descriptions specific and actionable
- [x] Agent type appropriate menu links verified

**Detailed Findings:**

*PASSING:*
- 5 menu items, all with trigger + action + description
- Trigger codes unique: PV, OA, IS, VB, SM
- No reserved codes used (MH, CH, PM, DA)
- Prompt references valid: `#produce-video` → prompt id `produce-video` exists; `#inspect-shot` → prompt id `inspect-shot` exists
- SM action references sidecar with correct `{project-root}/_bmad/_memory/` format
- 2 prompts defined with `id` and `content` fields, IDs unique
- Prompts use proper XML tags (`<instructions>`, `<process>`, `<output_format>`)
- Core capabilities covered: produce (PV), assets (OA), debug (IS), validate (VB), memory (SM)
- All items align with agent's role and target user

*WARNINGS:* None

*FAILURES:* None

---

### Structure Validation

**Status:** ✅ PASS

**Agent Type:** Expert

**Checks:**
- [x] Valid YAML syntax — parses without errors
- [x] Consistent 2-space indentation throughout
- [x] All required sections present: metadata, persona, critical_actions, prompts, menu
- [x] Field types correct: metadata strings, principles array, critical_actions array, menu array
- [x] No duplicate keys
- [x] Expert-specific: hasSidecar true, critical_actions present, sidecar paths correct

**Detailed Findings:**

*PASSING:*
- YAML parses cleanly, no syntax errors
- All Expert agent required sections present
- No compiler-injected content (no frontmatter, no activation XML, no MH/CH/PM/DA, no rules)
- File named correctly: `remotion-video-producer.agent.yaml` (lowercase, hyphenated)
- Multi-line strings use proper YAML `|` block scalar notation
- Principles formatted as YAML array with `-` list items

*WARNINGS:* None

*FAILURES:* None

---

### Sidecar Validation

**Status:** ⚠️ WARNING (1 intentional deviation)

**Agent Type:** Expert with sidecar

**Checks:**
- [x] Sidecar folder exists: `remotion-video-producer-sidecar/`
- [x] Folder naming follows convention: `{agent-name}-sidecar`
- [x] All referenced files present (memories.md, instructions.md, schema-mappings.md)
- [x] All paths use `{project-root}/_bmad/_memory/remotion-video-producer-sidecar/` format
- [x] No broken path references

**Detailed Findings:**

*PASSING:*
- Sidecar folder exists with correct naming convention
- 4 files present: memories.md, instructions.md, schema-mappings.md, README.md
- All critical_actions reference correct sidecar path format (`{project-root}/_bmad/_memory/`)
- No relative paths, no absolute hardcoded paths
- 4 critical_actions (exceeds minimum of 3)
- memories.md: structured starter with section headings (acceptable for new agent)
- instructions.md: fully populated with project paths, architecture patterns, standards, parallel strategy
- schema-mappings.md: fully populated with all enum mappings, camera decomposition, VFX flattening, SFX volume heuristics, defaults
- README.md: documents sidecar purpose and runtime access path
- SM menu action correctly references `{project-root}/_bmad/_memory/remotion-video-producer-sidecar/memories.md`

*WARNINGS:*
- ⚠️ **No file access restriction** — Expert agents typically include `ONLY read/write files in {project-root}/_bmad/_memory/{sidecar-folder}/` in critical_actions. **Intentionally omitted** because this agent must read from production asset folders and write to the Remotion project directory, both outside the sidecar. Documented deviation.

*FAILURES:* None

---

## Validation Summary

| Section | Status | Issues |
|---------|--------|--------|
| Metadata | ✅ PASS | 0 |
| Persona | ⚠️ WARNING | 1 (missing memory reference patterns) |
| Menu | ✅ PASS | 0 |
| Structure | ✅ PASS | 0 |
| Sidecar | ⚠️ WARNING | 1 (no file access restriction — intentional) |

**Overall: ⚠️ 2 WARNINGS, 0 FAILURES**

Both warnings are non-blocking:
1. Memory reference patterns can be added to communication_style
2. File access restriction intentionally omitted for operational needs
