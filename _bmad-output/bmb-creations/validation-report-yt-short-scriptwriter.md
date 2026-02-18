---
agentName: 'Ghostwriter'
agentType: 'expert'
agentFile: '_bmad-output/bmb-creations/yt-short-scriptwriter/yt-short-scriptwriter.agent.yaml'
validationDate: '2026-02-11'
stepsCompleted:
  - v-01-load-review.md
  - v-02a-validate-metadata.md
  - v-02b-validate-persona.md
  - v-02c-validate-menu.md
  - v-02d-validate-structure.md
  - v-02e-validate-sidecar.md
  - v-03-summary.md
---

# Validation Report: Ghostwriter

## Agent Overview

**Name:** Ghostwriter
**Type:** Expert (stand-alone + hasSidecar)
**module:** stand-alone
**hasSidecar:** true
**File:** _bmad-output/bmb-creations/yt-short-scriptwriter/yt-short-scriptwriter.agent.yaml

---

## Validation Findings

### Metadata Validation

**Status:** ✅ PASS

**Checks:**
- [x] id: kebab-case, path format correct
- [x] name: persona name (Ghostwriter), not title
- [x] title: functional description (YouTube Short Scriptwriter)
- [x] icon: single emoji (👻)
- [x] module: correct format (stand-alone)
- [x] hasSidecar: matches actual structure (true)

**Detailed Findings:**

*PASSING:*
- All 6 metadata fields present and correctly formatted
- id follows `_bmad/agents/{name}/{name}.md` convention
- name vs title distinction properly maintained
- Type indicators consistent (stand-alone + hasSidecar = Expert)

*WARNINGS:*
None

*FAILURES:*
None

---

### Persona Validation

**Status:** ✅ PASS

**Checks:**
- [x] role: specific pipeline + rubric + loop description
- [x] identity: defines character (10k scripts, zero tolerance, insider)
- [x] communication_style: speech patterns only (terse margin notes)
- [x] principles: first principle activates expert storytelling knowledge

**Detailed Findings:**

*PASSING:*
- All 4 persona fields present and populated
- Field purity maintained: role=capabilities, identity=character, communication=voice, principles=beliefs
- No bleed between fields
- 6 principles, all specific and non-generic
- First principle activates expert knowledge (viral storytelling mechanics)
- Fields are internally consistent (terse style matches zero-tolerance identity)
- Persona supports all menu items

*WARNINGS:*
None

*FAILURES:*
None

---

### Menu Validation

**Status:** ✅ PASS

**Checks:**
- [x] No reserved codes used (WS, JS, RW only)
- [x] Trigger format correct for all items
- [x] Description format correct for all items
- [x] All prompt references resolve
- [x] Expert type menu links verified (inline prompts)

**Detailed Findings:**

*PASSING:*
- 3 custom commands, all properly formatted
- Trigger format: `XX or fuzzy match on command-name` for all 3
- Description format: `[XX] description` for all 3
- All action references (#write-short, #judge-script, #rewrite-script) match defined prompts
- Commands align with agent role and purpose
- Expert agent with inline prompts (valid pattern)

*WARNINGS:*
None

*FAILURES:*
None

---

### Structure Validation

**Status:** ✅ PASS

**Agent Type:** Expert

**Checks:**
- [x] Valid YAML syntax
- [x] Consistent 2-space indentation
- [x] No duplicate keys
- [x] All required sections present (metadata, persona, critical_actions, prompts, menu)
- [x] No compiler-handled content (no frontmatter, no activation block, no auto-items)
- [x] Path format uses {project-root} literal correctly

**Detailed Findings:**

*PASSING:*
- YAML parses without errors
- All required Expert agent sections present
- No content that compiler should handle (frontmatter, activation, MH/CH/PM/DA)
- Path references use correct {project-root} variable format
- Prompts use proper XML tags (<instructions>)

*WARNINGS:*
None

*FAILURES:*
None

---

### Sidecar Validation

**Status:** ✅ PASS

**Agent Type:** Expert with sidecar

**Checks:**
- [x] Sidecar folder exists (yt-short-scriptwriter-sidecar/)
- [x] Naming follows convention ({agent-name}-sidecar)
- [x] All referenced files present (checklist.md, instructions.md)
- [x] Path format correct in critical_actions
- [x] No broken path references

**Detailed Findings:**

*PASSING:*
- Sidecar folder exists at build location
- Naming convention followed: yt-short-scriptwriter-sidecar
- checklist.md present and populated (YouTube Short Script Framework)
- instructions.md present and populated (rubric, iteration protocol, AI blacklist, output format)
- README.md present (documentation for humans)
- All critical_actions file references resolve to existing files
- Path format uses {project-root}/_bmad/_memory/yt-short-scriptwriter-sidecar/ correctly

*WARNINGS:*
- README.md not referenced in critical_actions (expected — human documentation only)

*FAILURES:*
None

---

## Overall Summary

| Section | Status |
|---------|--------|
| Metadata | ✅ PASS |
| Persona | ✅ PASS |
| Menu | ✅ PASS |
| Structure | ✅ PASS |
| Sidecar | ✅ PASS |

**Overall: ✅ ALL CHECKS PASS**
