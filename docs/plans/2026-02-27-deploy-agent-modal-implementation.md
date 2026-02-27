# Deploy Agent Modal — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the 5 "Deploy with AI Agent" buttons to open a modal with agent-specific Python bot setup instructions, and generate a `markets.json` for the starter repo.

**Architecture:** New `DeployAgentModal` component receives an agent ID, renders a 3-step tutorial modal (clone → configure → run). Agent-specific config stored as a static array. A Python script generates `vision-bot/markets.json` from the frontend source registry.

**Tech Stack:** React, Next.js, Tailwind CSS, Python (script)

---

### Task 1: Create DeployAgentModal component

**Files:**
- Create: `frontend/components/domain/vision/detail/DeployAgentModal.tsx`

**Step 1: Create the modal component**

```tsx
'use client'

import { useState, useCallback } from 'react'

interface AgentConfig {
  id: string
  name: string
  icon: React.ReactNode
  runStep: {
    title: string
    code: string
  }
}

const AGENTS: AgentConfig[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="12" fill="#CC785C"/>
        <path d="M14.2 6.5L8.5 17.5h2.6l1.1-2.3h4.3l1.1 2.3H20L14.2 6.5zm-.5 6.7l1.3-2.8 1.3 2.8h-2.6z" fill="#fff"/>
      </svg>
    ),
    runStep: {
      title: 'Run with Claude Code',
      code: 'claude "read AGENTS.md and start trading on Vision"',
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#18181B"/>
        <path d="M7 5v14l4-4h6L7 5z" fill="#fff"/>
      </svg>
    ),
    runStep: {
      title: 'Run with Cursor',
      code: 'Open folder in Cursor → Cmd+L → "read AGENTS.md and start trading on Vision"',
    },
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#00B4D8"/>
        <path d="M4 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <path d="M4 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".5"/>
      </svg>
    ),
    runStep: {
      title: 'Run with Windsurf',
      code: 'Open folder in Windsurf → Cascade → "read AGENTS.md and start trading on Vision"',
    },
  },
  {
    id: 'devin',
    name: 'Devin',
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#7C3AED"/>
        <circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="2"/>
        <circle cx="12" cy="12" r="1.5" fill="#fff"/>
        <path d="M12 4v3M12 17v3M4 12h3M17 12h3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    runStep: {
      title: 'Run with Devin',
      code: 'Give Devin the repo URL and prompt:\n"read AGENTS.md and start trading on Vision"',
    },
  },
  {
    id: 'cline',
    name: 'Cline',
    icon: (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#22C55E"/>
        <path d="M7 8l4 4-4 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M13 16h4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    runStep: {
      title: 'Run with Cline',
      code: 'Open in VS Code with Cline → "read AGENTS.md and start trading on Vision"',
    },
  },
]

interface DeployAgentModalProps {
  agentId: string
  onClose: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-2 right-2 rounded px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 hover:text-white hover:bg-neutral-600 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function DeployAgentModal({ agentId, onClose }: DeployAgentModalProps) {
  const agent = AGENTS.find(a => a.id === agentId)
  if (!agent) return null

  const steps = [
    {
      number: 1,
      title: 'Clone',
      code: 'git clone https://github.com/General-Market/vision-bot\ncd vision-bot',
    },
    {
      number: 2,
      title: 'Configure',
      code: 'cp .env.example .env\n# Add BOT_PRIVATE_KEY and set DEPOSIT_AMOUNT\npip install -r requirements.txt',
    },
    {
      number: 3,
      title: agent.runStep.title,
      code: agent.runStep.code,
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            {agent.icon}
            <h2 className="text-sm font-bold text-neutral-900">Deploy with {agent.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Steps */}
        <div className="px-5 py-4 space-y-4">
          {steps.map((step) => (
            <div key={step.number}>
              <p className="text-[10px] font-bold tracking-[0.1em] text-neutral-400 uppercase mb-1.5">
                {step.number}. {step.title}
              </p>
              <div className="relative rounded-lg bg-neutral-900 px-4 py-3">
                <pre className="text-[12px] font-mono text-neutral-200 whitespace-pre-wrap leading-relaxed pr-12">
                  {step.code}
                </pre>
                <CopyButton text={step.code} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Python 3.10+ · funded wallet</span>
          <a
            href="https://docs.generalmarket.io/guides/vision-bots"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-900 hover:text-neutral-600 transition-colors font-medium"
          >
            Full docs &rarr;
          </a>
        </div>
      </div>
    </div>
  )
}

export { AGENTS }
```

**Step 2: Commit**

```bash
git add frontend/components/domain/vision/detail/DeployAgentModal.tsx
git commit -m "feat: add DeployAgentModal component with agent-specific setup steps"
```

---

### Task 2: Wire StrategyList buttons to open the modal

**Files:**
- Modify: `frontend/components/domain/vision/detail/StrategyList.tsx`

**Step 1: Add state and import modal**

Add at the top of StrategyList.tsx:
```tsx
import { useState } from 'react'
import DeployAgentModal from './DeployAgentModal'
```

Update the component to include modal state and wire onClick handlers on each agent button:

```tsx
export default function StrategyList({ bitmapEditor, sourceId, marketIds }: StrategyListProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  const handleApply = useCallback(
    (strategy: Strategy) => {
      bitmapEditor.applyStrategy(() => {
        return strategy.apply(marketIds)
      })
    },
    [bitmapEditor, marketIds],
  )

  return (
    <div className="mt-4 space-y-3">
      {/* Strategies — compact row */}
      {/* ... existing strategy buttons unchanged ... */}

      {/* AI agent deploy buttons — compact grid */}
      <div>
        <h3 className="text-[9px] font-bold tracking-[0.12em] text-[#999] uppercase mb-1.5">
          Deploy with AI Agent
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {/* Claude Code */}
          <button type="button" onClick={() => setSelectedAgent('claude-code')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-[11px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors">
            {/* ... svg unchanged ... */}
            Claude Code
          </button>
          {/* Cursor */}
          <button type="button" onClick={() => setSelectedAgent('cursor')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-[11px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors">
            {/* ... svg unchanged ... */}
            Cursor
          </button>
          {/* Windsurf */}
          <button type="button" onClick={() => setSelectedAgent('windsurf')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-[11px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors">
            {/* ... svg unchanged ... */}
            Windsurf
          </button>
          {/* Devin */}
          <button type="button" onClick={() => setSelectedAgent('devin')} className="flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-[11px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors">
            {/* ... svg unchanged ... */}
            Devin
          </button>
          {/* Cline — spans full width */}
          <button type="button" onClick={() => setSelectedAgent('cline')} className="col-span-2 flex items-center gap-2 rounded-md border border-[#18181B] px-2 py-1.5 text-[11px] font-bold text-[#52525b] hover:bg-[#18181B] hover:text-white transition-colors">
            {/* ... svg unchanged ... */}
            Cline
          </button>
        </div>
      </div>

      {/* Deploy Agent Modal */}
      {selectedAgent && (
        <DeployAgentModal
          agentId={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  )
}
```

The key change: each button gets `onClick={() => setSelectedAgent('<agent-id>')}` and the modal renders conditionally at the bottom.

**Step 2: Commit**

```bash
git add frontend/components/domain/vision/detail/StrategyList.tsx
git commit -m "feat: wire agent buttons to open DeployAgentModal"
```

---

### Task 3: Generate markets.json for the starter repo

**Files:**
- Create: `scripts/generate-markets-json.py`
- Create: `vision-bot/markets.json` (output)

**Step 1: Write the generation script**

```python
#!/usr/bin/env python3
"""Generate vision-bot/markets.json from frontend/lib/vision/sources.ts."""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

SOURCES_TS = Path(__file__).resolve().parent.parent / "frontend" / "lib" / "vision" / "sources.ts"
OUTPUT = Path(__file__).resolve().parent.parent / "vision-bot" / "markets.json"


def parse_sources() -> list[dict]:
    """Extract VISION_SOURCES array entries from TypeScript source."""
    text = SOURCES_TS.read_text()

    # Match each { ... } object inside VISION_SOURCES array
    pattern = re.compile(
        r"\{\s*"
        r"id:\s*'([^']+)'\s*,\s*"
        r"name:\s*'([^']+)'\s*,\s*"
        r"description:\s*'([^']+)'\s*,\s*"
        r"category:\s*'([^']+)'\s*,\s*"
        r"logo:\s*'[^']*'\s*,\s*"
        r"brandBg:\s*(?:'[^']*'|\"[^\"]*\")\s*,\s*"
        r"prefixes:\s*\[([^\]]*)\]",
        re.DOTALL,
    )

    sources = []
    for m in pattern.finditer(text):
        prefixes_raw = m.group(5)
        prefixes = re.findall(r"'([^']+)'", prefixes_raw)
        sources.append({
            "id": m.group(1),
            "name": m.group(2),
            "category": m.group(4),
            "prefixes": prefixes,
            "description": m.group(3),
        })
    return sources


def main():
    sources = parse_sources()
    categories = sorted(set(s["category"] for s in sources))

    output = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_sources": len(sources),
        "categories": categories,
        "sources": sources,
    }

    OUTPUT.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Wrote {len(sources)} sources to {OUTPUT}")


if __name__ == "__main__":
    main()
```

**Step 2: Run the script**

```bash
python3 scripts/generate-markets-json.py
```

Expected: `Wrote 75 sources to .../vision-bot/markets.json`

**Step 3: Verify output**

```bash
python3 -c "import json; d = json.load(open('vision-bot/markets.json')); print(f'{d[\"total_sources\"]} sources, {len(d[\"categories\"])} categories')"
```

Expected: `75 sources, 10 categories` (approximate)

**Step 4: Commit**

```bash
git add scripts/generate-markets-json.py vision-bot/markets.json
git commit -m "feat: add markets.json generation script for vision bot starter"
```

---

### Task 4: Create AGENTS.md in vision-bot

**Files:**
- Create: `vision-bot/AGENTS.md`

**Step 1: Write the AI-readable instruction file**

This file is what AI agents read when given the prompt "read AGENTS.md and start trading on Vision". It should contain:
- What Vision is (1 paragraph)
- Contract address, chain, USDC decimals
- API endpoints (from `docs/skills/vision-api.md`)
- Bitmap encoding (Python, from `docs/skills/vision-bot.md`)
- Bot lifecycle: register → poll → encode → join → submit → claim
- Reference to `markets.json` for available sources
- Reference to `bot.py` as working implementation
- .env vars needed

Assemble from existing docs — `docs/skills/vision-bot.md` and `docs/skills/vision-api.md` are the source of truth. Combine into a single flat markdown file optimized for LLM consumption (no nested links, everything inline).

**Step 2: Commit**

```bash
git add vision-bot/AGENTS.md
git commit -m "feat: add AGENTS.md for AI agent onboarding"
```

---

### Task 5: Verify end-to-end locally

**Step 1: Run the frontend dev server**

```bash
cd frontend && npm run dev
```

**Step 2: Navigate to a Vision source detail page**

Open a source page that shows the StrategyList component (e.g. `/vision/coingecko`).

**Step 3: Click each agent button**

Verify:
- Modal opens with correct agent name and icon
- 3 steps render with correct code
- Copy buttons work
- Close button and backdrop click dismiss the modal
- All 5 agents show correct step 3

**Step 4: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: deploy agent modal polish"
```
