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
            {t.rich('deploy_agent.vision_text', { bold: (chunks) => <span className="text-text-primary font-bold">{chunks}</span> })}
          </p>
          <p className="text-text-muted">
            {t('deploy_agent.vision_subtext')}
          </p>
          <p className="text-text-muted text-sm mt-4">
            {t('deploy_agent.vision_future_1')}<br/>
            {t('deploy_agent.vision_future_2')}
          </p>
        </div>

        {/* How It Works */}
        <div className="border border-border-light bg-muted p-4 mb-6 rounded-xl">
          <p className="text-text-muted text-xs uppercase tracking-[0.08em] mb-3">{t('deploy_agent.how_it_works_label')}</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-zinc-900 font-bold">1.</span>
              <p className="text-text-secondary">{t.rich('deploy_agent.step1', { bold: (chunks) => <span className="text-text-primary">{chunks}</span> })}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-zinc-900 font-bold">2.</span>
              <p className="text-text-secondary">{t.rich('deploy_agent.step2', { bold: (chunks) => <span className="text-text-primary">{chunks}</span> })}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-zinc-900 font-bold">3.</span>
              <p className="text-text-secondary">{t.rich('deploy_agent.step3', { bold: (chunks) => <span className="text-text-primary">{chunks}</span> })}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-zinc-900 font-bold">4.</span>
              <p className="text-text-secondary">{t.rich('deploy_agent.step4', { highlight: (chunks) => <span className="text-color-up">{chunks}</span> })}</p>
            </div>
          </div>
        </div>

        {/* Example Trade */}
        <div className="border border-border-light bg-muted p-4 mb-6 rounded-xl">
          <p className="text-text-muted text-xs uppercase tracking-[0.08em] mb-3">{t('deploy_agent.example_label')}</p>
          <div className="font-mono text-xs space-y-1">
            <p className="text-text-muted">{t('deploy_agent.example_intro')}</p>
            <p className="text-text-muted mt-2">{t.rich('deploy_agent.example_btc', { up: (chunks) => <span className="text-color-up">{chunks}</span> })}</p>
            <p className="text-text-muted">{t.rich('deploy_agent.example_lakers', { down: (chunks) => <span className="text-color-down">{chunks}</span> })}</p>
            <p className="text-text-muted">{t.rich('deploy_agent.example_rain', { up: (chunks) => <span className="text-color-up">{chunks}</span> })}</p>
            <p className="text-text-muted">{t.rich('deploy_agent.example_fed', { down: (chunks) => <span className="text-color-down">{chunks}</span> })}</p>
            <p className="text-text-muted">{t('deploy_agent.example_more')}</p>
            <p className="text-text-muted mt-3">{t('deploy_agent.example_opposite')}</p>
            <p className="text-color-up font-bold">{t('deploy_agent.example_winner')}</p>
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
          <a href="https://docs.generalmarket.io" target="_blank" rel="noopener noreferrer" className="text-zinc-900 hover:text-zinc-700 transition-colors">
            {t('deploy_agent.full_docs')}
          </a>
        </div>
      </div>
    </div>
  )
}
