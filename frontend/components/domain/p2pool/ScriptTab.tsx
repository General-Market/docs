'use client'

import { useState } from 'react'
import type { BatchInfo } from '@/hooks/p2pool/useBatches'

interface ScriptTabProps {
  batch: BatchInfo
  onBitmapGenerated?: (bitmap: Record<string, boolean>) => void
}

const DEFAULT_TEMPLATE = `# P2Pool Strategy Script
# Available variables:
#   markets: list of market IDs
#   prices: dict of market_id -> current_price
#   history: dict of market_id -> list of past % changes
#
# Return: dict of market_id -> True (UP) or False (DOWN)

def strategy(markets, prices, history):
    bets = {}
    for market in markets:
        # Default: momentum -- bet UP if last tick was UP
        past = history.get(market, [])
        if len(past) > 0:
            bets[market] = past[-1] > 0
        else:
            bets[market] = True  # default UP
    return bets
`

const TEMPLATES: { name: string; description: string; code: string }[] = [
  {
    name: 'Momentum',
    description: 'Follow the trend -- bet with the last tick direction',
    code: DEFAULT_TEMPLATE,
  },
  {
    name: 'Contrarian',
    description: 'Bet against the trend -- mean reversion strategy',
    code: `def strategy(markets, prices, history):
    bets = {}
    for market in markets:
        past = history.get(market, [])
        if len(past) > 0:
            bets[market] = past[-1] < 0  # bet opposite
        else:
            bets[market] = True
    return bets
`,
  },
  {
    name: 'All UP',
    description: 'Bet UP on every market -- simple bull strategy',
    code: `def strategy(markets, prices, history):
    return {m: True for m in markets}
`,
  },
  {
    name: 'All DOWN',
    description: 'Bet DOWN on every market -- simple bear strategy',
    code: `def strategy(markets, prices, history):
    return {m: False for m in markets}
`,
  },
  {
    name: 'Random',
    description: 'Random bets -- baseline for comparison',
    code: `import random

def strategy(markets, prices, history):
    return {m: random.random() > 0.5 for m in markets}
`,
  },
]

/**
 * Script tab for 100+ market batches (or any batch when user selects SCRIPT tab).
 * Provides a Python strategy editor with template picker.
 * Full Monaco integration is Task 4.3 -- uses basic textarea for now.
 */
export function ScriptTab({ batch, onBitmapGenerated }: ScriptTabProps) {
  const [code, setCode] = useState(DEFAULT_TEMPLATE)
  const [selectedTemplate, setSelectedTemplate] = useState('Momentum')
  const [previewOutput, setPreviewOutput] = useState<string | null>(null)

  function handleTemplateSelect(templateName: string) {
    const template = TEMPLATES.find(t => t.name === templateName)
    if (template) {
      setCode(template.code)
      setSelectedTemplate(templateName)
      setPreviewOutput(null)
    }
  }

  function handleRunPreview() {
    // Placeholder: Pyodide integration is Task 4.3
    // For now, show a preview of what would happen
    const marketCount = batch.marketIds.length
    setPreviewOutput(
      `[Preview] Strategy would generate bitmap for ${marketCount} markets.\n` +
      `Pyodide runtime integration coming in Task 4.3.\n` +
      `Template: ${selectedTemplate}`
    )

    // Generate a simple default bitmap based on template name
    if (onBitmapGenerated) {
      const bitmap: Record<string, boolean> = {}
      for (const id of batch.marketIds) {
        switch (selectedTemplate) {
          case 'All UP':
            bitmap[id] = true
            break
          case 'All DOWN':
            bitmap[id] = false
            break
          default:
            bitmap[id] = true // default UP
        }
      }
      onBitmapGenerated(bitmap)
    }
  }

  return (
    <div className="space-y-4">
      {/* Template picker */}
      <div>
        <label className="text-xs font-mono text-text-muted block mb-2">
          Strategy Template
        </label>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(template => (
            <button
              key={template.name}
              onClick={() => handleTemplateSelect(template.name)}
              className={`px-3 py-1.5 rounded-card text-xs font-mono transition-colors ${
                selectedTemplate === template.name
                  ? 'bg-terminal text-text-inverse'
                  : 'bg-muted text-text-secondary hover:bg-surface hover:text-text-primary'
              }`}
              title={template.description}
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      {/* Code editor (basic textarea -- Monaco in Task 4.3) */}
      <div>
        <label className="text-xs font-mono text-text-muted block mb-2">
          Python Strategy ({batch.marketIds.length} markets)
        </label>
        <textarea
          value={code}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCode(e.target.value)}
          className="w-full h-64 bg-surface-dark text-text-inverse font-mono text-xs
                     p-4 rounded-card border border-border-medium resize-y
                     focus:outline-none focus:ring-1 focus:ring-color-info"
          spellCheck={false}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleRunPreview}
          className="bg-color-info text-white px-4 py-2 rounded-card text-xs font-bold
                     hover:brightness-110 transition-all"
        >
          RUN PREVIEW
        </button>
        <button
          className="bg-muted text-text-secondary px-4 py-2 rounded-card text-xs font-bold
                     hover:bg-surface transition-colors cursor-not-allowed opacity-60"
          disabled
          title="Save template -- coming in Task 4.3"
        >
          SAVE TEMPLATE
        </button>
      </div>

      {/* Preview output */}
      {previewOutput && (
        <div className="bg-surface-dark text-text-inverse p-3 rounded-card font-mono text-xs whitespace-pre-wrap">
          {previewOutput}
        </div>
      )}
    </div>
  )
}
