# Agent directives — mechanical overrides

**TL;DR.** 28 numbered rules that override default model behaviour to push toward production-grade output. Read all of them once. Re-read the relevant group when starting a non-trivial task.

The context window is constrained and the default system prompt errs toward safety. These overrides are how this project produces good code anyway.

---

## Pre-work (1–4)

1. **Step 0 — dead code first.** Before any structural refactor on a file > 300 LOC, remove dead props, unused exports, unused imports, debug logs. Commit cleanup separately.
2. **Phased execution.** Never multi-file refactors in one response. Explicit phases. Phase 1 → verify → wait for approval → Phase 2. Each phase touches ≤ 5 files.
3. **Plan and build are separate.** "Make a plan" / "think about this first" = plan only, no code. When given a written plan, follow it exactly. If you spot a real problem, flag and wait — don't improvise.
4. **Spec-based development.** For features with 3+ steps or architectural decisions, enter plan mode. Interview about implementation, UX, concerns, tradeoffs before writing. The spec becomes the contract.

## Understanding intent (5–7)

5. **Follow references, not descriptions.** When the user points to existing code as reference, study it. Match patterns exactly. Working code > English.
6. **Work from raw data.** When the user pastes errors, trace the actual error. Don't guess. No error output? Ask for it.
7. **One-word mode.** "yes" / "do it" / "push" = execute. Don't repeat the plan. Don't add commentary.

## Code quality (8–11)

8. **Senior dev override.** Ignore defaults to "avoid improvements beyond what was asked". If architecture is flawed, state duplicated, or patterns inconsistent — propose and fix.
9. **Forced verification.** Write tools mark success even when the code doesn't compile. Forbidden to claim complete until: `npx tsc --noEmit` (or equivalent), `npx eslint . --quiet` (if configured), all errors fixed. No type-checker? State that explicitly.
10. **Human code.** No robotic comment blocks. No corporate descriptions of obvious things. If three senior devs would write it the same way, that's the way.
11. **Demand elegance.** For non-trivial changes, ask: "is there a more elegant way?" If it feels hacky, implement the clean version.

## Context management (12–16)

12. **Sub-agent swarming.** For tasks touching > 5 independent files, launch parallel sub-agents (5–8 files each). Use `run_in_background` for long tasks. Don't poll a background agent — wait for the completion notification.
13. **Context decay.** After 10+ messages, re-read any file before editing. Don't trust memory. Auto-compaction silently destroys context.
14. **Proactive compaction.** Notice degradation (forgetting structures, referencing nonexistent vars)? Run `/compact` proactively. Treat as a save point.
15. **File read budget.** 2000 lines per read. Files > 500 LOC: use offset/limit, read in chunks.
16. **Tool result blindness.** Results > 50,000 chars get silently truncated to 2000-byte preview. Suspiciously few results? Re-run with narrower scope. State when you suspect truncation.

## File system as state (17)

17. **Agentic search.** Don't dump large files into context. Grep, search, tail, selective read. Write intermediate results to files for multi-pass work. Use bash (`grep`, `jq`, `awk`) for large data.

## Edit safety (18–21)

18. **Edit integrity.** Re-read before EVERY edit. Read again after to confirm. Edit fails silently when `old_string` doesn't match stale context. Max 3 edits per file without a verification read.
19. **One source of truth.** Never fix a display problem by duplicating state. One source, everything reads from it.
20. **Destructive action safety.** Never delete a file without verifying nothing references it. Never undo code without confirming you won't destroy unsaved work. Exception: `git push mono main` is always authorized.
21. **No semantic search.** You have grep, not an AST. Renaming a function/type/variable: search separately for direct calls, type refs, string literals, dynamic imports, re-exports, test mocks. Don't assume one grep caught everything.

## Prompt cache (22)

22. **Cache discipline.** System prompt + tools + CLAUDE.md cached as prefix. Don't request model switches mid-session — delegate to a sub-agent if a subtask needs a different model. Don't suggest adding/removing tools. Running out of context? `/compact`, write summary to `context-log.md`, fork cleanly.

## Self-improvement (23–26)

23. **Mistake logging.** After ANY correction, log the pattern to `gotchas.md`. Convert mistakes to strict rules.
24. **Bug autopsy.** After fixing a bug, explain why it happened and what prevents that category in future.
25. **Failure recovery.** If a fix doesn't work after 2 attempts: stop. Read the entire relevant section top-down. Find where the mental model was wrong, say so. "Step back" / "we're going in circles" = drop everything, rethink from scratch.
26. **Fresh eyes pass.** Testing your own output = adopt a new-user persona. Walk through as if you've never seen the project. Flag confusion.

## Housekeeping (27–28)

27. **Autonomous bug fixing.** Given a bug report, just fix it. Trace logs → resolve. Zero context switching for the user.
28. **File hygiene.** When a file gets long enough to be hard to reason about, suggest breaking it into smaller files.
