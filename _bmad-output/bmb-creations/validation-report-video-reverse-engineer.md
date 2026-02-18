---
agentName: 'Recut'
agentType: 'expert'
agentFile: '_bmad-output/bmb-creations/video-reverse-engineer/video-reverse-engineer.agent.yaml'
validationDate: '2026-02-15'
stepsCompleted:
  - v-01-load-review.md
---

# Validation Report: Recut (Video Reverse Engineer)

## Agent Overview

**Name:** Recut
**Type:** Expert (standalone with sidecar)
**module:** stand-alone
**hasSidecar:** true
**File:** `_bmad-output/bmb-creations/video-reverse-engineer/video-reverse-engineer.agent.yaml`

---

## Agent Structure Summary

**Persona:** ~850 characters across 4 fields (role, identity, communication_style, principles)
**Commands:** 4 menu items (AN, PC, RP, VR)
**Critical Actions:** 3 actions (load protocol, load reference, verify tools)
**Prompts:** 4 prompts (analyze-video, check-prereqs, rerun-phase, view-report)
**Sidecar Files:** 3 (protocol.md, reference-report.md, README.md)

---

## Validation Findings

### Metadata Validation

**Status:** PASS

**Checks:**
- [x] id: kebab-case, correct path format `_bmad/agents/{name}/{name}.md`
- [x] name: clear persona name (`Recut`), distinct from title
- [x] title: concise function description (`Video Reverse Engineer`), derives correct filename
- [x] icon: single appropriate emoji (`🔬`)
- [x] module: correct format (`stand-alone`)
- [x] hasSidecar: `true`, matches actual sidecar folder at build location

**Detailed Findings:**

*PASSING:*
- All 6 required fields present and non-empty
- id follows `_bmad/agents/{agent-name}/{agent-name}.md` convention
- name is persona name, not filename or title
- title derives correct filename: `video-reverse-engineer.agent.yaml`
- icon is single emoji, representative of forensic analysis
- module uses correct lowercase hyphenated format
- hasSidecar correctly indicates Expert agent with sidecar
- No conflicting type indicators

*WARNINGS:*
None

*FAILURES:*
None

### Persona Validation

**Status:** PASS

**Checks:**
- [x] role: specific ("video reverse-engineering specialist"), not generic
- [x] identity: defines character ("forensic analyst, crime scene metaphor")
- [x] communication_style: speech patterns only ("terse and clinical, lab report with a pulse")
- [x] principles: first principle activates expert knowledge (cinematography, audio engineering, color science, spectral analysis, editorial rhythm)

**Detailed Findings:**

*PASSING:*
- All 4 persona fields present and populated
- Role: pure function, no personality/voice/beliefs bleed
- Identity: pure character, vivid "crime scene" metaphor, no capabilities bleed
- Communication style: pure voice, passes read-aloud test, no forbidden words
- Principles: 5 total (within 3-7 range), first activates expert domain knowledge
- All principles are beliefs/philosophy, not tasks or job description
- No field overlap — each field stays in its lane
- Cross-field consistency: all reinforce forensic/reproduction philosophy
- Role aligns with menu commands (AN, PC, RP, VR)
- Communication style matches expert user expectations (data, not pleasantries)

*WARNINGS:*
None

*FAILURES:*
None

### Menu Validation

**Status:** PASS

**Checks:**
- [x] Trigger format: `XX or fuzzy match on command-name` — all 4 items
- [x] Description format: `[XX] Display text` — all 4 items
- [x] No reserved codes used (MH, CH, PM, DA avoided)
- [x] Unique trigger codes: AN, PC, RP, VR
- [x] All handlers reference valid prompt IDs
- [x] Expert agent link validation: prompts reference sidecar via `{project-root}/_bmad/_memory/`

**Detailed Findings:**

*PASSING:*
- Menu section properly formatted YAML with 4 items
- All triggers follow `XX or fuzzy match on command-name` convention
- All descriptions follow `[XX] Display text` convention
- Trigger codes AN, PC, RP, VR — all unique, no reserved codes
- All 4 handlers use `action: '#prompt-id'` referencing defined prompts
- All 4 prompt IDs exist (analyze-video, check-prereqs, rerun-phase, view-report)
- Prompts use XML tags (`<instructions>`, `<process>`, `<output_format>`)
- Menu aligns with agent purpose: pipeline execution, prereqs, re-run, report browsing
- Core capabilities fully covered — all 5 phases via AN, individual via RP
- Not overloaded — 4 items, lean and focused
- Expert agent: prompts reference sidecar protocol via correct path format
- No prohibited patterns, no security vulnerabilities
- Consistent naming conventions throughout

*WARNINGS:*
None

*FAILURES:*
None

### Structure Validation

**Status:** PASS

**Agent Type:** Expert (standalone, hasSidecar: true)

**Checks:**
- [x] Valid YAML syntax, parses without errors
- [x] Consistent 2-space indentation throughout
- [x] All required sections present (metadata, persona, critical_actions, prompts, menu)
- [x] Field types correct (strings, arrays, boolean)
- [x] Expert-specific: hasSidecar flag, critical_actions load sidecar files
- [x] No compiler-handled content present (no frontmatter, activation XML, MH/CH/PM/DA)

**Detailed Findings:**

*PASSING:*
- YAML parses cleanly, no syntax errors
- 2-space indentation consistent across all 144 lines
- Special characters properly handled
- No duplicate keys in any section
- All 5 required sections present and populated
- hasSidecar is boolean `true`, not string
- Arrays use proper dash formatting
- Path references use `{project-root}/_bmad/_memory/` format for sidecar
- Output paths use `{output_folder}` variable
- critical_actions load 2 sidecar files + verify tools
- No compiler-handled content duplicated

*WARNINGS:*
None

*FAILURES:*
None

### Sidecar Validation

**Status:** PASS

**Agent Type:** Expert (standalone with sidecar)

**Checks:**
- [x] Sidecar folder exists at `video-reverse-engineer-sidecar/`
- [x] Naming follows `{agent-name}-sidecar` convention
- [x] All critical_actions referenced files present (protocol.md, reference-report.md)
- [x] Path format correct: `{project-root}/_bmad/_memory/video-reverse-engineer-sidecar/`
- [x] No broken path references, no orphaned files

**Detailed Findings:**

*PASSING:*
- Sidecar folder exists, accessible, readable
- Naming: `video-reverse-engineer-sidecar/` follows convention
- 3 files: protocol.md (12KB/320 lines), reference-report.md (29KB/536 lines), README.md (746B)
- critical_actions reference 1: `protocol.md` — exists, complete 5-phase protocol
- critical_actions reference 2: `reference-report.md` — exists, complete 10-section example report
- Path format uses `{project-root}/_bmad/_memory/` for runtime access
- No broken references, no orphaned references
- README documents sidecar purpose and runtime path
- Both content files are complete (not placeholders)

*WARNINGS:*
None

*FAILURES:*
None
