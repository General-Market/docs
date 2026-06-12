# The agent manual — code practices and git

**TL;DR.** Two contracts. **Code:** clean before you build, verify before you claim, elegance over haste. **Git:** every repository has one declared remote, branch, and purpose — read the map, stage your own files by explicit path, commit, push after every task. Deployment is out of scope — a separate document owns it.

---

## Part I — Code practices

### Before starting

1. **Dead code first.** Before any refactor on a file > 300 lines, remove dead props, imports, exports, and debug logs. Commit the cleanup separately.
2. **Phased execution.** Multi-file refactors split into phases of ≤ 5 files. Verify between phases. Wait for approval before the next phase.
3. **Plan ≠ build.** "Make a plan" or "think first" means plan only — no code. Given a written plan, follow it exactly. Flag real problems; don't improvise.
4. **Spec for 3+ steps.** Non-trivial features start with a written spec. The spec is the contract.

### Understanding the ask

5. **References beat descriptions.** When the user points at existing code, match its patterns exactly. Working code beats English.
6. **Raw data beats theories.** Trace the actual error log. Don't guess. No error output? Ask for it.
7. **One-word mode.** "yes" / "do it" / "push" means execute. No recap, no commentary.

### Writing the code

8. **Senior dev override.** Fix flawed architecture, duplicated state, and inconsistent patterns. Don't preserve them out of caution.
9. **Verify before claiming complete.** Run the project's type-checker and linter and fix every error. No type-checker configured? Say so explicitly.
10. **Human code.** No robotic comment blocks, no corporate descriptions of the obvious. Three senior devs would write it the same way — write that.
11. **Demand elegance.** On any non-trivial change, ask "is there a cleaner way?" If it feels hacky, do the clean version.

### Managing context

12. **Split big jobs.** More than 5 files of work → delegate in chunks of 5–8 files per sub-agent. Run long tasks in the background; don't poll.
13. **Re-read after long gaps.** After 10+ messages, don't trust your memory of file contents — context compaction silently destroys it.
14. **Compact proactively.** When you notice degradation, summarize and save a checkpoint before the wheels come off.
15. **Read budget.** Files > 500 lines: read in chunks with offset/limit, not whole.
16. **Truncation blindness.** Very large tool results get silently cut. Suspiciously few results means re-run narrower — and say when you suspect truncation.
17. **Don't break the cache prefix.** No mid-session model or tool changes — delegate to a sub-agent instead. Out of context? Write a summary to disk and fork cleanly.

### File system as state

18. **Agentic search.** Grep, tail, selective read. Save intermediate results to disk. Use shell tools (`grep`, `jq`, `awk`) for large data.

### Edit safety

19. **Re-read before every edit, re-read after.** Edits fail silently on stale content. Maximum 3 edits per file without a verify-read.
20. **One source of truth.** Never fix a display bug by duplicating state.
21. **Destructive-action safety.** Never delete a file without verifying nothing references it.
22. **No semantic search.** You have grep, not an AST. Renaming means separate sweeps for direct calls, type references, string literals, dynamic imports, re-exports, and test mocks.

### Self-improvement

23. **Log mistakes.** After any correction, append it to a `gotchas.md` and convert it into a strict rule.
24. **Bug autopsy.** After fixing, explain why the bug happened and what prevents the whole category in future.
25. **2-attempt rule.** A fix that fails twice means stop. Re-read the section top-down and name where the mental model was wrong. "Step back" means drop everything and rethink from scratch.
26. **Fresh eyes.** Testing your own output means adopting a new-user persona. Flag confusion when you feel it.

### Housekeeping

27. **Bug reports = just fix.** Trace the logs, resolve. Zero context-switching for the user.
28. **File hygiene.** Long files: suggest splitting into smaller, focused files.

---

## Part II — Git

### The repository map

The workspace may hold several repositories belonging to different projects, clients, or organizations. The map is the single source of truth for which repo is for what. Maintain it at the top of the project's agent instructions file (`AGENTS.md` / `CLAUDE.md`).

One line per repository:

| Local path | Remote | Branch | Purpose | Push policy |
|---|---|---|---|---|
| `~/work/product` | `origin` | `main` | Main product repo | Push after every task |
| `~/work/client-a` | `origin` | `main` | Client repo — separate org | Push, but **never** product code |
| `~/work/scratch` | — | — | Experiments, throwaway | Never push |

Rules for the map:

- **Name the remote and the branch explicitly.** "Push" without a target is how code lands in the wrong organization.
- **State the purpose in plain words.** One sentence. If two repos could be confused, say how they differ.
- **Mark forbidden directions.** If repo A must never receive repo B's content, write it on the line.
- **Update the map in the same commit** that moves, splits, or retires a repository.

Before any git command, confirm which repository you are standing in: `git remote -v` and `pwd`. The map tells you what is allowed there.

### After every completed task

Work that isn't pushed does not exist. Therefore:

1. `git status` — see everything that changed, including other sessions' work.
2. Stage **your** files by explicit path: `git add <file> <file>`. Never `git add -A` or `git add .` in a shared tree.
3. `git diff --cached` — confirm everything staged is yours.
4. Commit with a descriptive message.
5. `git show HEAD --stat` — confirm the commit contains exactly your files, nothing swept in from another session.
6. Push to the remote and branch declared in the map.

### Multi-session safety

Several agents may edit the same working tree at the same time. Uncommitted edits are volatile — a concurrent pull, rebase, or checkout can silently wipe them.

- **Commit early, by explicit path.** Your files are safe only once committed.
- **Pre-push check:** `git stash list` and `git diff --cached`. If you see staged work you don't recognize, leave it alone — commit only your paths.
- **New files need `git add` first.** Committing by pathspec silently skips untracked files.
- **Push rejected by a race?** `git pull --rebase --autostash`, re-verify your commit content with `git show HEAD --stat`, push again.
- **Verify on the remote by content**, not by a hook or script printing "pushed". `git log <remote>/<branch> -1` and check your change is in it.
- Do not pull or rebase over another session's dirty tree. The main agent reconciles once at the end; sub-agents only add and push their own files.

### Commit messages

- Descriptive: what changed and why, in one line. Body only when the why needs room.
- One concern per commit. Cleanup commits separate from feature commits.
- **Never add `Co-Authored-By` or any AI-attribution trailer.**

### Never

- Create a remote that is not in the map, or recreate a retired one.
- `git init` inside a subdirectory of an existing repository.
- Push one repository's content to another repository's remote.
- Force-push a shared branch.
- `git pull` / `git fetch` inside a subdirectory that another system treats as a build source — pull only at the repository root.

### Out of scope

This document covers code practices and git only. Deployment — servers, containers, CI/CD triggers, hosting — is owned by a separate document in each project. If pushing a branch happens to trigger a deploy, that is the pipeline's business, not yours: do not deploy by hand, and do not bypass the push.

The map decides where code goes. The push makes the work real.
