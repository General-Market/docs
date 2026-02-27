# Deploy Agent Modal — Design

## Summary

Wire the 5 "Deploy with AI Agent" buttons (Claude Code, Cursor, Windsurf, Devin, Cline) in `StrategyList.tsx` to open a modal with agent-specific setup instructions. Python-only starter repo.

## UX Flow

1. User clicks an agent button (e.g. "Claude Code")
2. Modal opens with 3 steps, tailored to that agent
3. Each step has a copy-to-clipboard button
4. Footer links to full docs

### Steps per Agent

**Step 1 — Clone** (same for all):
```
git clone https://github.com/General-Market/vision-bot
cd vision-bot
```

**Step 2 — Configure** (same for all):
```
cp .env.example .env
# Add BOT_PRIVATE_KEY and set DEPOSIT_AMOUNT
pip install -r requirements.txt
```

**Step 3 — Run** (varies per agent):
- **Claude Code**: `claude "read AGENTS.md and start trading on Vision"`
- **Cursor**: Open folder in Cursor → Cmd+L → `read AGENTS.md and start trading on Vision`
- **Windsurf**: Open folder in Windsurf → Cascade → `read AGENTS.md and start trading on Vision`
- **Devin**: Give Devin the repo URL + prompt: `read AGENTS.md and start trading on Vision`
- **Cline**: Open in VS Code with Cline → `read AGENTS.md and start trading on Vision`

## Starter Repo Contents

The existing `vision-bot/` directory serves as the starter repo. We add:

### `markets.json` (auto-generated)

Static JSON of all 75+ data sources with metadata. Auto-generated from `VISION_SOURCES` in `sources.ts`. Bots read this to understand available market types.

```json
{
  "updated_at": "2026-02-27T00:00:00Z",
  "sources": [
    {
      "id": "coingecko",
      "name": "CoinGecko Crypto",
      "category": "finance",
      "prefixes": ["crypto_"],
      "description": "Cryptocurrency market data — prices, volumes, market caps for thousands of tokens."
    }
  ],
  "total_sources": 75,
  "categories": ["finance", "economic", "regulatory", "tech", "academic", "entertainment", "geophysical", "transport", "nature", "space"]
}
```

Generation: Python script reads `sources.ts`, extracts VISION_SOURCES array, writes JSON. Run as part of build/deploy.

Bot also refreshes at runtime via `GET /vision/markets` endpoint.

### `AGENTS.md`

AI-readable instruction file. Contains:
- Vision API reference (endpoints, types)
- Contract addresses and ABIs
- Bitmap encoding spec (Python)
- Bot lifecycle: register → poll → encode → join → submit → claim
- Strategy guidelines
- `markets.json` reference for available sources

This is the "SDK" — the AI agent reads it and builds/runs the bot.

## Components

### `DeployAgentModal.tsx`
- Modal component receiving `agentId` prop
- Agent configs: `{ id, name, icon, steps[] }`
- Each step: title, code snippet, copy button
- Dark terminal-style code blocks
- Close button, backdrop click to dismiss

### `StrategyList.tsx` update
- Add `useState` for selected agent
- Wire onClick on each agent button → set state → open modal

### `scripts/generate-markets-json.py`
- Reads `frontend/lib/vision/sources.ts`
- Parses VISION_SOURCES array
- Writes `vision-bot/markets.json`

## Not in scope
- Building an actual npm SDK / `npx generalmarket init`
- Deep linking into agents
- Context-aware batch pre-filling
- TypeScript examples (Python only)
