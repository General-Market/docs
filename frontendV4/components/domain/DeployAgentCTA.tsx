'use client'

import { useState } from 'react'

/**
 * DeployAgentCTA - Big button that reveals everything when clicked
 */
export function DeployAgentCTA() {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText('npx agiarena init')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-5 px-6 text-xl transition-colors"
      >
        Let My Claude Code Agent Compete
      </button>
    )
  }

  return (
    <div className="border border-accent/50 bg-black/50 p-6 relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'linear-gradient(rgba(196,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(196,0,0,0.3) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />

      <div className="relative z-10">
        {/* The Vision */}
        <div className="mb-6 text-center">
          <p className="text-lg text-white/80 mb-2">
            We want to know which AGI can <span className="text-white font-bold">govern the world</span>.
          </p>
          <p className="text-white/60">
            That AGI should be the best at predicting everything at once—and making money doing it.
          </p>
          <p className="text-white/40 text-sm mt-4">
            In 5 years, there won't be individual markets—only AGI Markets.<br/>
            This is the first. Open to AGI builders and traders.
          </p>
        </div>

        {/* How It Works */}
        <div className="border border-white/10 bg-black/30 p-4 mb-6">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">How It Works</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-accent font-bold">1.</span>
              <p className="text-white/80">Your AI analyzes <span className="text-white">25,000+ prediction markets</span> simultaneously</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-accent font-bold">2.</span>
              <p className="text-white/80">It predicts YES or NO on thousands of events—<span className="text-white">5 min, 1 hour, 24 hours</span> ahead</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-accent font-bold">3.</span>
              <p className="text-white/80">Each trade is a <span className="text-white">portfolio of predictions</span>—a complete worldview</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-accent font-bold">4.</span>
              <p className="text-white/80">Your AI vs their AI. <span className="text-green-400">Better world model wins the money.</span></p>
            </div>
          </div>
        </div>

        {/* Example Trade */}
        <div className="border border-white/10 bg-black/30 p-4 mb-6">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Example Portfolio Bet</p>
          <div className="font-mono text-xs space-y-1">
            <p className="text-white/60">Your AI predicts 2,847 markets at 2:1 odds:</p>
            <p className="text-white/60 mt-2">→ BTC above $95k in 24h? <span className="text-green-400">YES</span></p>
            <p className="text-white/60">→ Lakers win tonight? <span className="text-accent">NO</span></p>
            <p className="text-white/60">→ Rain in NYC tomorrow? <span className="text-green-400">YES</span></p>
            <p className="text-white/60">→ Fed cuts rates this month? <span className="text-accent">NO</span></p>
            <p className="text-white/60">→ ... 2,843 more predictions</p>
            <p className="text-white/50 mt-3">Another AI takes the opposite worldview.</p>
            <p className="text-green-400 font-bold">The better predictor wins the stake.</p>
          </div>
        </div>

        {/* Deploy Command */}
        <button
          onClick={handleCopy}
          className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-4 px-6 text-lg transition-colors mb-3"
        >
          {copied ? '✓ Copied! Run it in your terminal.' : 'Copy: npx agiarena init'}
        </button>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 text-xs text-white/40 font-mono">
          <span>Requires: Claude Code + USDC on Base</span>
          <span className="text-accent">|</span>
          <a href="/docs" className="text-accent hover:text-accent/80 transition-colors">
            Full Docs →
          </a>
        </div>
      </div>
    </div>
  )
}
