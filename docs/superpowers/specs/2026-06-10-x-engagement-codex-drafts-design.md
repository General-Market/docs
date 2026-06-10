# Codex reply drafts in the Engagement Queue — design

**Date:** 2026-06-10
**Status:** approved, ready to plan
**Surface:** `docs/x-targeting/x_articles/ui/server.mjs` (the "X Research Ops" UI on VPS3 `159.195.77.160:3010`)

## TL;DR

Add a **"Draft reply"** button to each Engagement Queue row. On click it spawns **codex** (network on, web search) on VPS3, writes a data-led reply tweet, and shows it editable + copyable. Drafts are cached to disk keyed by tweet id, so a row is never drafted twice unless you ask. No posting — draft + copy only.

This plugs the two existing halves together:

| Half | What it is | Where |
|---|---|---|
| "Find answers" | Engagement Queue — 15 daily data-led reply *targets* (who + their source tweet). Never drafts the reply. | `engagement_queue/find_engagement_queue.py` → UI |
| "Codex key" | codex CLI (ChatGPT login, no API key), same auth family-chat / docs-AI use. | `/opt/docsai/.codex` |

The wire that is missing: the reply text itself. Codex writes it.

## Decisions (locked)

- **Surface:** Engagement Queue replies only. No Article Radar drafts.
- **Timing:** on-demand per row (a button), never batch.
- **Data depth:** codex runs with **network on** (live web search) so replies can cite fresh funding / OI / price.
- **Posting:** none. Draft + copy-to-clipboard. Posting is a separate spec (needs OAuth 1.0a write tokens + a deliberate ToS decision). The queue finder is explicitly "does not post or like."

## Architecture

The UI server already spawns a child process for `POST /api/engagement/refresh`. The draft endpoint is its twin.

| Piece | Responsibility |
|---|---|
| `POST /api/engagement/draft` | Body `{date, target, tweet_id, force?}`. Resolve the row in `queue.jsonl`; if cached and not `force`, return cache; else build prompt → spawn codex → append to cache → return `{ok, draft, cached}`. |
| `GET /api/engagement/drafts?date&target` | Return all cached drafts for a date/target as `{tweet_id: draft}` so the UI can pre-fill on load in one fetch. |
| `runCodexDraft(prompt)` in `server.mjs` | Spawn codex with the **exact flags from family-chat `server.js` `runCodex()`** (see below). Prompt via stdin, answer read from the `-o` file. |
| `engagement_queue/reply_prompt.md` | Persona + rules for the reply. Editable without code change. |
| `<date>/<target>/drafts.jsonl` | Cache. One JSON line per draft: `{tweet_id, draft, created_at, model}`. |

### Codex invocation — copied from the working reference

`/Users/maxguillabert/Downloads/family-chat/server.js` `runCodex()` (lines 243–315). Match it exactly:

```
codex exec -m gpt-5.5 --skip-git-repo-check \
  --sandbox workspace-write \
  -c sandbox_workspace_write.network_access=true \
  -c tools.web_search=true \
  -o <ansFile> -C <WORKSPACE>
```

- Prompt is written to `child.stdin`, then `end()`.
- Answer is read from `<ansFile>` (the `-o` output — clean text, no token-delta noise), then the file is unlinked.
- `env: { PATH, HOME: /opt/docsai, CODEX_HOME: /opt/docsai/.codex }`.
- `<WORKSPACE>` = a writable scratch dir the radar service owns (e.g. `x_articles/ui/.codex-scratch`), created on boot. Codex needs a writable workspace under `--sandbox workspace-write`.
- Timeout: SIGTERM at ~45s, SIGKILL grace after. Resolve `{ok:false, reason}` on spawn error / timeout / empty.

### Prompt shape

`runCodexDraft` composes: contents of `reply_prompt.md` + the resolved row's `text` (source tweet), `handle`, `name`, `followers`, and any metric fields present, plus an instruction to web-search current numbers when the tweet makes a market claim. `reply_prompt.md` carries the durable rules:

- Reply in the **same language** as the source tweet.
- **≤ 280 characters.** One reply, no thread.
- **Data-led:** lead with a number or a concrete observation. Web-search to verify before citing.
- No hashtags. No "great point." No emojis unless the source uses them.
- Sound like a sharp market-native peer, not a brand account.
- Output the reply text **only** — no preamble, no quotes around it.

## Data flow

```
[Draft reply] click
  → POST /api/engagement/draft {date,target,tweet_id}
    → drafts.jsonl has tweet_id (and not force)?
        yes → return {ok, draft, cached:true}
        no  → read row from queue.jsonl by tweet_id
              → prompt = reply_prompt.md + row context
              → spawn codex (network on, ~10–20s)
              → append {tweet_id, draft, created_at, model} to drafts.jsonl
              → return {ok, draft, cached:false}
  → UI renders draft in an editable <textarea> + char count + [Copy] + [Regenerate]

page load
  → GET /api/engagement/drafts?date&target  (alongside the existing queue load)
  → rows with a cached draft render pre-filled
```

## UI changes (all inside `server.mjs`, no build step)

- Engagement table gets a **"Draft reply"** affordance per row (a new cell or an expander under the row).
  - Collapsed state: a `Draft reply` button.
  - After generation: an editable `<textarea>` (live char count, red past 280) + `Copy` + `Regenerate`.
- Button shows the existing `.spinner` / `.loading` state while codex runs.
- On load, the drafts fetch pre-fills rows that already have a cached draft.
- Reuse existing CSS tokens (`.refreshButton`, `.spinner`, `.muted`, Apple type stack already in the file). No new design language.

## Error handling

| Case | Behaviour |
|---|---|
| Codex spawn fails / times out (~45s cap) | Row shows "draft failed — retry," button re-enables. `{ok:false, reason}` contract, mirrors `/refresh`. No crash. |
| `tweet_id` not in queue | HTTP 400 `{error}`. |
| Draft > 280 chars | Returned anyway, char count red. You trim in the textarea before copying. |
| `drafts.jsonl` unreadable line | Skipped (same tolerant `readJsonl` already in the file). |

## Deploy dependency (the one thing to confirm on the box)

The radar UI systemd service (`x-article-radar-ui.service`) runs as **root**, `WorkingDirectory=/root/index`. Codex needs an authenticated home. Point the spawn at **`/opt/docsai/.codex`** (the family-chat / docs-AI login — the "codex key") via `HOME`/`CODEX_HOME`.

**Confirm on VPS3 before shipping:** `/opt/docsai/.codex` is readable by root and `codex exec` succeeds from that home. If not, fall back to root's own `~/.codex` login. Make the homes overridable via service env (`CODEX_HOME`, `CODEX_HOME_DIR`, `CODEX_BIN`, `CODEX_MODEL`) with the `/opt/docsai` values as defaults — the install script sets them.

## Testing

1. **Local dry-run.** Stub codex with a fake script (`CODEX_BIN=./fake-codex`) that reads stdin and writes a fixed string to the `-o` file. Verify: endpoint resolves, `drafts.jsonl` append + cache hit on second call, UI renders textarea / char count / copy, `force` regenerates.
2. **VPS3 live.** One real draft on a live queue row. Confirm web-search fires (status lines) and the reply cites fresh numbers. Confirm cache hit on reload.

## Scope held out (YAGNI)

- No posting (separate spec).
- No Article Radar drafts.
- No batch pre-generation.
- No per-account voice profiles beyond the single editable `reply_prompt.md` (add later if needed).

## Files touched

- `docs/x-targeting/x_articles/ui/server.mjs` — new endpoints + UI.
- `docs/x-targeting/engagement_queue/reply_prompt.md` — new, the prompt rules.
- `docs/x-targeting/x_articles/install_vps3_ui.sh` — add `CODEX_*` env defaults to the service unit.
