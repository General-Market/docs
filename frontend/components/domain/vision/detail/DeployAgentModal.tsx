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
      code: 'claude "read AGENTS.md, show me markets from markets.json, and start trading on Vision"',
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
      code: 'Open folder in Cursor → Cmd+L →\n"read AGENTS.md, show me markets from markets.json, and start trading on Vision"',
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
      code: 'Open folder in Windsurf → Cascade →\n"read AGENTS.md, show me markets from markets.json, and start trading on Vision"',
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
      code: 'Give Devin the repo URL and prompt:\n"read AGENTS.md, show me markets from markets.json, and start trading on Vision"',
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
      code: 'Open in VS Code with Cline →\n"read AGENTS.md, show me markets from markets.json, and start trading on Vision"',
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
          <span>Python 3.10+ &middot; funded wallet</span>
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
