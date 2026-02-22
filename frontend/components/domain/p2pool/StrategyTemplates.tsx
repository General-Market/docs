'use client'

export interface StrategyTemplate {
  name: string
  description: string
  code: string
}

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    name: 'Momentum',
    description: 'Follow the trend -- bet with the last tick direction',
    code: `# Momentum strategy
# Bets UP if the last tick was UP, DOWN otherwise

def strategy(markets, prices, history):
    bets = {}
    for market in markets:
        past = history.get(market, [])
        if len(past) > 0:
            bets[market] = past[-1] > 0
        else:
            bets[market] = True  # default UP
    return bets
`,
  },
  {
    name: 'Contrarian',
    description: 'Bet against the trend -- mean reversion strategy',
    code: `# Contrarian (mean reversion) strategy
# Bets opposite to the last tick direction

def strategy(markets, prices, history):
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
    code: `# All UP -- simple directional bull bet

def strategy(markets, prices, history):
    return {m: True for m in markets}
`,
  },
  {
    name: 'All DOWN',
    description: 'Bet DOWN on every market -- simple bear strategy',
    code: `# All DOWN -- simple directional bear bet

def strategy(markets, prices, history):
    return {m: False for m in markets}
`,
  },
  {
    name: 'Random',
    description: 'Random bets -- baseline for comparison',
    code: `# Random strategy -- use as a baseline
import random

def strategy(markets, prices, history):
    return {m: random.random() > 0.5 for m in markets}
`,
  },
]

interface TemplatePickerProps {
  selected: string
  onSelect: (templateName: string) => void
}

/**
 * Horizontal button row to pick a strategy template.
 */
export function TemplatePicker({ selected, onSelect }: TemplatePickerProps) {
  return (
    <div>
      <label className="text-xs font-mono text-text-muted block mb-2">
        Strategy Template
      </label>
      <div className="flex flex-wrap gap-2">
        {STRATEGY_TEMPLATES.map(template => (
          <button
            key={template.name}
            onClick={() => onSelect(template.name)}
            className={`px-3 py-1.5 rounded-card text-xs font-mono transition-colors ${
              selected === template.name
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
  )
}
