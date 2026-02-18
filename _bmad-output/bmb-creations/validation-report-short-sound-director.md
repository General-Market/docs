---
agentName: 'short-sound-director'
agentType: 'expert'
agentFile: '_bmad-output/bmb-creations/short-sound-director/short-sound-director.agent.yaml'
validationDate: '2026-02-15'
stepsCompleted:
  - v-01-load-review.md
  - v-02a-validate-metadata.md
  - v-02b-validate-persona.md
  - v-02c-validate-menu.md
  - v-02d-validate-structure.md
  - v-02e-validate-sidecar.md
---

# Validation Report: short-sound-director

## Agent Overview

**Name:** Cue
**Title:** Short Sound Director
**Type:** Expert (stand-alone + hasSidecar)
**module:** stand-alone
**hasSidecar:** true
**File:** `_bmad-output/bmb-creations/short-sound-director/short-sound-director.agent.yaml`

---

## Validation Findings

### Metadata Validation

**Status:** ✅ PASS

**Checks:**
- [x] id: `_bmad/agents/short-sound-director/short-sound-director.md` — kebab-case, matches filename pattern
- [x] name: `Cue` — persona name, distinct from title
- [x] title: `Short Sound Director` — concise functional description
- [x] icon: `🎬` — single emoji, representative of direction/production
- [x] module: `stand-alone` — correct format
- [x] hasSidecar: `true` — matches actual sidecar folder with 2 files

**Detailed Findings:**

*PASSING:*
- All 6 required fields present and non-empty
- id path format correct (`_bmad/agents/{name}/{name}.md`)
- name ("Cue") is persona name, not job title — field purity maintained
- title determines filename correctly: `short-sound-director.agent.yaml`
- hasSidecar: true confirmed — sidecar folder contains instructions.md + direction-schema.md
- No conflicting type indicators (stand-alone Expert)

*WARNINGS:* None

*FAILURES:* None

### Persona Validation

**Status:** ✅ PASS

**Checks:**
- [x] role: specific ("audio engineer + creative director"), not generic
- [x] identity: defines character (veteran editor, conviction, defaults-not-questions)
- [x] communication_style: speech patterns only (terse, timecodes, [?] markers)
- [x] principles: first principle activates expert knowledge (audio post-production + short-form direction)

**Detailed Findings:**

*PASSING:*
- All 4 persona fields present and populated
- Field purity maintained — no cross-contamination between fields
- Role: pure capabilities, no personality words
- Identity: pure character (veteran, conviction), no job duties
- Communication style: pure voice (terse, timecodes, production shorthand), no forbidden words
- Principles: 5 total (within 3-7 range), first is expert activator
- Each principle is a belief, not a task — passes "obvious test"
- All fields aligned and consistent — persona supports all 5 menu commands
- No contradictions between principles

*WARNINGS:* None

*FAILURES:* None

### Menu Validation

**Status:** ✅ PASS

**Checks:**
- [x] Trigger format: all 5 items use `XX or fuzzy match on command-name`
- [x] Description format: all 5 items use `[XX] Description`
- [x] No reserved codes (MH/CH/PM/DA) used
- [x] All trigger codes unique (GO, TR, CT, DR, RV)
- [x] All `#prompt-id` references resolve to existing prompts
- [x] Expert agent menu links: inline `#id` action handlers (correct pattern)

**Detailed Findings:**

*PASSING:*
- 5 menu items + 5 corresponding prompts — all cross-referenced correctly
- Prompts use `<instructions>` + `<process>` XML tags consistently
- GO covers full pipeline; TR/CT/DR split for granular re-runs; RV for iteration
- All commands align with role capabilities (audio + direction)
- Descriptions concise, actionable, consistent style
- No prohibited patterns, security issues, or conflicts

*WARNINGS:* None

*FAILURES:* None

### Structure Validation

**Status:** ⚠️ PASS WITH WARNINGS

**Agent Type:** Expert

**Checks:**
- [x] YAML parses without errors
- [x] 2-space indentation consistent throughout
- [x] No duplicate keys
- [x] Compiler compliance: no frontmatter, no activation XML, no auto-injected menu items
- [x] `agent.metadata.hasSidecar: true`
- [x] `agent.critical_actions` exists (3 actions, minimum met)
- [x] Sidecar paths use `{project-root}/_bmad/_memory/` format (literal)
- [x] No relative or absolute paths in critical_actions
- [x] 5 prompts, all with unique id + content fields
- [x] Filename matches kebab-case convention

**Detailed Findings:**

*PASSING:*
- Valid YAML syntax with consistent 2-space indentation
- All required Expert agent sections present (metadata, persona, critical_actions, prompts, menu)
- All sidecar path references use correct `{project-root}/_bmad/_memory/short-sound-director-sidecar/` format
- No compiler-injected content duplicated
- File naming convention followed

*WARNINGS:*
- ⚠️ No memory reference patterns in communication_style — justified: agent has no memories.md (stateless per short, no cross-session context)
- ⚠️ No `memories.md` load in critical_actions — justified: each short is independent, no session history
- ⚠️ No domain restriction ("ONLY read/write in sidecar") — justified: agent must read/write in working directory for input files and output artifacts

*FAILURES:* None

### Sidecar Validation

**Status:** ✅ PASS

**Agent Type:** Expert (stand-alone + hasSidecar)

**Checks:**
- [x] Sidecar folder exists at build path
- [x] Folder naming: `short-sound-director-sidecar` (matches `{agent-name}-sidecar`)
- [x] `instructions.md` present — Whisper config, ffmpeg patterns, take detection algorithm
- [x] `direction-schema.md` present — shots.ts-compatible ShotDef schema
- [x] `README.md` present — sidecar documentation
- [x] critical_action[1] references `instructions.md` — file exists
- [x] critical_action[2] references `direction-schema.md` — file exists
- [x] No orphaned references (all referenced files exist)
- [x] Path format: `{project-root}/_bmad/_memory/short-sound-director-sidecar/` (correct)

**Detailed Findings:**

*PASSING:*
- 3 files in sidecar folder, all referenced or documented
- instructions.md: comprehensive workflow details (Whisper flags, ffmpeg cut patterns, take detection algorithm, pacing analysis, style constraints)
- direction-schema.md: complete ShotDef interface with all sub-types, color constants, layout constants, and 7 direction rules
- All critical_actions correctly resolve to existing sidecar files
- No orphaned or unreferenced files

*WARNINGS:* None

*FAILURES:* None
