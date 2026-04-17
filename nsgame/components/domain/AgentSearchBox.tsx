'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { isValidAddress } from '@/lib/utils/address'

interface AgentSearchBoxProps {
  onSearch: (address: string) => void
  isNotFound?: boolean
  onDismissNotFound?: () => void
}

/**
 * AgentSearchBox component for finding agent rankings
 * Displays "Find My Agent" search box above leaderboard
 * AC1, AC3, AC5: Search box with validation, not found state, Dev Arena theme
 */
export function AgentSearchBox({ onSearch, isNotFound, onDismissNotFound }: AgentSearchBoxProps) {
  const t = useTranslations('common')
  const [address, setAddress] = useState('')
  const dismissTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-dismiss not found message after 5 seconds
  useEffect(() => {
    if (isNotFound && onDismissNotFound) {
      dismissTimeoutRef.current = setTimeout(() => {
        onDismissNotFound()
      }, 5000)
    }

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current)
      }
    }
  }, [isNotFound, onDismissNotFound])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmedAddress = address.trim()
    if (trimmedAddress && isValidAddress(trimmedAddress)) {
      onSearch(trimmedAddress)
    }
  }

  const isValid = isValidAddress(address.trim())

  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t('agent_search.placeholder')}
          className="flex-1 px-4 py-2 rounded-full border-2 border-zinc-900 bg-white text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-black/10"
          aria-label="Wallet address"
        />
        <button
          type="submit"
          disabled={!isValid}
          className="px-5 py-2 rounded-full border-2 border-zinc-900 bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {t('agent_search.find_rank')}
        </button>
      </form>

      {isNotFound && (
        <div className="mt-3 p-3 border border-color-down/50 bg-surface-down" role="alert">
          <p className="text-color-down text-sm">{t('agent_search.not_found')}</p>
          <p className="text-text-muted text-xs mt-1">
            {t('agent_search.not_found_hint')}{' '}
            <a href="/deploy" className="text-zinc-900 hover:underline font-semibold">
              {t('agent_search.deploy_agent')}
            </a>
          </p>
          <button
            type="button"
            onClick={onDismissNotFound}
            className="text-text-muted text-xs mt-2 hover:text-text-primary"
          >
            {t('agent_search.dismiss')}
          </button>
        </div>
      )}
    </div>
  )
}
