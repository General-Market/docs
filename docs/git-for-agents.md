# Git for agents

**TL;DR.** Every repository in the workspace has one declared remote, one declared branch, and one declared purpose. Read the repository map before your first git command. After every completed task: stage your own files by explicit path, commit, push to the declared remote. Never cross repositories. Deployment is out of scope — a separate document owns it.

## The repository map

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

## After every completed task

Work that isn't pushed does not exist. Therefore:

1. `git status` — see everything that changed, including other sessions' work.
2. Stage **your** files by explicit path: `git add <file> <file>`. Never `git add -A` or `git add .` in a shared tree.
3. `git diff --cached` — confirm everything staged is yours.
4. Commit with a descriptive message.
5. `git show HEAD --stat` — confirm the commit contains exactly your files, nothing swept in from another session.
6. Push to the remote and branch declared in the map.

## Multi-session safety

Several agents may edit the same working tree at the same time. Uncommitted edits are volatile — a concurrent pull, rebase, or checkout can silently wipe them.

- **Commit early, by explicit path.** Your files are safe only once committed.
- **Pre-push check:** `git stash list` and `git diff --cached`. If you see staged work you don't recognize, leave it alone — commit only your paths.
- **New files need `git add` first.** Committing by pathspec silently skips untracked files.
- **Push rejected by a race?** `git pull --rebase --autostash`, re-verify your commit content with `git show HEAD --stat`, push again.
- **Verify on the remote by content**, not by a hook or script printing "pushed". `git log <remote>/<branch> -1` and check your change is in it.
- Do not pull or rebase over another session's dirty tree. The main agent reconciles once at the end; sub-agents only add and push their own files.

## Commit messages

- Descriptive: what changed and why, in one line. Body only when the why needs room.
- One concern per commit. Cleanup commits separate from feature commits.
- **Never add `Co-Authored-By` or any AI-attribution trailer.**

## Never

- Create a remote that is not in the map, or recreate a retired one.
- `git init` inside a subdirectory of an existing repository.
- Push one repository's content to another repository's remote.
- Force-push a shared branch.
- `git pull` / `git fetch` inside a subdirectory that another system treats as a build source — pull only at the repository root.

## Out of scope

This document covers git only. Deployment — servers, containers, CI/CD triggers, hosting — is owned by a separate document in each project. If pushing a branch happens to trigger a deploy, that is the pipeline's business, not yours: do not deploy by hand, and do not bypass the push.

The map decides where code goes. The push makes the work real.
