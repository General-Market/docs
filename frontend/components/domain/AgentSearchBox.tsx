'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
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
    <div className="mb-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter wallet address..."
          className="flex-1"
          aria-label="Wallet address"
        />
        <Button type="submit" disabled={!isValid}>
          Find Rank
        </Button>
      </form>

      {isNotFound && (
        <div className="mt-2 p-3 border border-accent/50 bg-accent/10" role="alert">
          <p className="text-accent font-mono text-sm">Agent not found.</p>
          <p className="text-white/60 text-xs mt-1">
            Have you placed any portfolio bets?{' '}
            <a href="/deploy" className="text-accent hover:underline">
              Deploy an agent
            </a>
          </p>
          <button
            type="button"
            onClick={onDismissNotFound}
            className="text-white/40 text-xs mt-2 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
