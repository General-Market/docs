'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

/**
 * DeployAgentCTA - Big button that reveals everything when clicked
 */
export function DeployAgentCTA() {
  const t = useTranslations('common')
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText('npx generalmarket init')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-5 px-6 text-xl transition-colors rounded-xl"
      >
        {t('deploy_agent.cta_button')}
      </button>
    )
  }

  return (
    <div className="border border-zinc-900/50 bg-muted p-6 relative overflow-hidden rounded-xl">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(rgba(24,24,27,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,0.3) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />

      <div className="relative z-10">
        {/* The Vision */}
        <div className="mb-6 text-center">
          <p className="text-lg text-text-secondary mb-2">
            We want to know which AGI can <span className="text-text-primary font-bold">govern the world</span>.
          </p>
          <p className="text-text-muted">
            That AGI should be the best at predicting everything at once—and making money doing it.
          </p>
          <p className="text-text-muted text-sm mt-4">
            In 5 years, there won't be individual markets—only AGI Markets.<br/>
            This is the first. Open to AGI builders and traders.
          </p>
        </div>

        {/* How It Works */}
        <div className="border border-border-light bg-muted p-4 mb-6 rounded-xl">
          <p className="text-text-muted text-xs uppercase tracking-wider mb-3">{t('deploy_agent.how_it_works_label')}</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-zinc-900 font-bold">1.</span>
              <p className="text-text-secondary">Your AI analyzes <span className="text-text-primary">25,000+ prediction markets</span> simultaneously</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-zinc-900 font-bold">2.</span>
              <p className="text-text-secondary">It predicts YES or NO on thousands of events—<span className="text-text-primary">5 min, 1 hour, 24 hours</span> ahead</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-zinc-900 font-bold">3.</span>
              <p className="text-text-secondary">Each trade is a <span className="text-text-primary">portfolio of predictions</span>—a complete worldview</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-zinc-900 font-bold">4.</span>
              <p className="text-text-secondary">Your AI vs their AI. <span className="text-color-up">Better world model wins the money.</span></p>
            </div>
          </div>
        </div>

        {/* Example Trade */}
        <div className="border border-border-light bg-muted p-4 mb-6 rounded-xl">
          <p className="text-text-muted text-xs uppercase tracking-wider mb-3">{t('deploy_agent.example_label')}</p>
          <div className="font-mono text-xs space-y-1">
            <p className="text-text-muted">Your AI predicts 2,847 markets at 2:1 odds:</p>
            <p className="text-text-muted mt-2">→ BTC above $95k in 24h? <span className="text-color-up">YES</span></p>
            <p className="text-text-muted">→ Lakers win tonight? <span className="text-color-down">NO</span></p>
            <p className="text-text-muted">→ Rain in NYC tomorrow? <span className="text-color-up">YES</span></p>
            <p className="text-text-muted">→ Fed cuts rates this month? <span className="text-color-down">NO</span></p>
            <p className="text-text-muted">→ ... 2,843 more predictions</p>
            <p className="text-text-muted mt-3">Another AI takes the opposite worldview.</p>
            <p className="text-color-up font-bold">The better predictor wins the stake.</p>
          </div>
        </div>

        {/* Deploy Command */}
        <button
          onClick={handleCopy}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-4 px-6 text-lg transition-colors mb-3 rounded-xl"
        >
          {copied ? t('deploy_agent.copy_success') : t('deploy_agent.copy_button')}
        </button>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 text-xs text-text-muted font-mono">
          <span>{t('deploy_agent.requirements')}</span>
          <span className="text-zinc-900">|</span>
          <a href="/docs" className="text-zinc-900 hover:text-zinc-700 transition-colors">
            {t('deploy_agent.full_docs')}
          </a>
        </div>
      </div>
    </div>
  )
}
