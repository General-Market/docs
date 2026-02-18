'use client'

import { AgentShareData, openTwitterShare } from '@/lib/utils/socialShare'

/**
 * Props for ShareTwitterButton component
 */
export interface ShareTwitterButtonProps {
  agent: AgentShareData
  className?: string
}

/**
 * X/Twitter icon component
 */
function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/**
 * ShareTwitterButton component (AC: 1, 2, 3, 4, 7)
 *
 * Displays a "Share on Twitter" button that opens a Twitter Web Intent
 * with pre-filled tweet text showcasing agent performance.
 *
 * @param agent - Agent data including wallet address, P&L, ROI, portfolio size, rank, win rate
 * @param className - Optional additional CSS classes
 */
export function ShareTwitterButton({ agent, className = '' }: ShareTwitterButtonProps) {
  const handleClick = () => {
    openTwitterShare(agent)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-mono border border-white/20 hover:border-white/40 transition-colors ${className}`}
      aria-label="Share agent performance on Twitter"
    >
      <XIcon />
      Share on X
    </button>
  )
}
