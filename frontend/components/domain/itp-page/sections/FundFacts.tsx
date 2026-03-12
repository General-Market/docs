'use client'

import { useState } from 'react'
import type { SectionProps } from '../SectionRenderer'

export function FundFacts({ itpId, symbol }: SectionProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const truncate = (s: string) => s.length > 16 ? `${s.slice(0, 8)}...${s.slice(-6)}` : s

  const facts = [
    { label: 'Symbol', value: symbol },
    { label: 'Chain', value: 'Index L3 (Orbit)' },
    {
      label: 'ITP ID',
      value: truncate(itpId),
      full: itpId,
      copyable: true,
    },
  ]

  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-4">
        Fund Facts
      </h2>
      <div className="bg-white border border-border-light rounded-lg divide-y divide-border-light">
        {facts.map(f => (
          <div key={f.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-secondary">{f.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono tabular-nums text-text-primary">
                {f.value}
              </span>
              {f.copyable && (
                <button
                  onClick={() => copyToClipboard(f.full!, f.label)}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  {copied === f.label ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
