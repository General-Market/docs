@AGENTS.md

# Claude Code bridge

`AGENTS.md` is the canonical shared instruction file for this repository.
Keep durable repo rules there so Claude Code, Codex, and other local agents read the same source.

## Claude-only notes

- Claude runtime state stays in `.claude/`.
- Claude-specific video rules stay in `video/.claude/rules/`.
- Shared skills live in `agents/skills/` and are exposed to Claude through `.claude/skills`.
