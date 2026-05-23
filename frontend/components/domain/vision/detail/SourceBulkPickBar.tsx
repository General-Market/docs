'use client'

import { useCallback } from 'react'

const APPLE_BLUE = '#0071E3'
const APPLE_RED = '#FF3B30'
const APPLE_TEXT = '#1D1D1F'
const APPLE_TEXT_SECONDARY = '#86868B'
const APPLE_PANEL = '#FFFFFF'
const EASE_DEFAULT = 'cubic-bezier(0.4, 0, 0.6, 1)'
const FONT_TEXT = 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif'

type Pick = 'up' | 'down'
type Picks = Record<string, Pick>

interface SourceBulkPickBarProps {
  /** Asset IDs that are actually in the live batch — only these are pickable. */
  tradableAssetIds: string[]
  /** Wholesale replacement of the picks map — caller owns reconciliation. */
  setPicks: (next: Picks) => void
  /** Disable while approving/committing/publishing/committed. */
  disabled: boolean
}

/**
 * Above-the-chart toolbar: All UP, All DOWN, Surprise me.
 *
 * Ten markets is six taps too many before validating. The bulk buttons let
 * the user stake a portfolio in one move — and the random button is the
 * single Vision-only UX move, because sealed bets mean a random portfolio
 * is a legitimate strategy.
 */
export function SourceBulkPickBar({
  tradableAssetIds,
  setPicks,
  disabled,
}: SourceBulkPickBarProps) {
  const allUp = useCallback(() => {
    if (disabled || tradableAssetIds.length === 0) return
    const next: Picks = {}
    for (const id of tradableAssetIds) next[id] = 'up'
    setPicks(next)
  }, [disabled, tradableAssetIds, setPicks])

  const allDown = useCallback(() => {
    if (disabled || tradableAssetIds.length === 0) return
    const next: Picks = {}
    for (const id of tradableAssetIds) next[id] = 'down'
    setPicks(next)
  }, [disabled, tradableAssetIds, setPicks])

  const surprise = useCallback(() => {
    if (disabled || tradableAssetIds.length === 0) return
    const next: Picks = {}
    for (const id of tradableAssetIds) {
      next[id] = Math.random() < 0.5 ? 'up' : 'down'
    }
    setPicks(next)
  }, [disabled, tradableAssetIds, setPicks])

  if (tradableAssetIds.length === 0) return null

  return (
    <div
      role="toolbar"
      aria-label="Bulk pick"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
      }}
    >
      <BulkButton
        label="▲ All UP"
        accent={APPLE_BLUE}
        onClick={allUp}
        disabled={disabled}
      />
      <BulkButton
        label="▼ All DOWN"
        accent={APPLE_RED}
        onClick={allDown}
        disabled={disabled}
      />
      <BulkButton
        label="🎲 Surprise me"
        accent={null}
        onClick={surprise}
        disabled={disabled}
      />
    </div>
  )
}

function BulkButton({
  label,
  accent,
  onClick,
  disabled,
}: {
  label: string
  /** Border + hover tint; null for the neutral Surprise button. */
  accent: string | null
  onClick: () => void
  disabled: boolean
}) {
  const border = accent ?? 'rgba(0,0,0,0.12)'
  const color = disabled ? APPLE_TEXT_SECONDARY : (accent ?? APPLE_TEXT)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 36,
        padding: '0 14px',
        borderRadius: 980,
        background: APPLE_PANEL,
        color,
        border: `1px solid ${border}`,
        fontFamily: FONT_TEXT,
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: '-0.016em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: `background 180ms ${EASE_DEFAULT}, opacity 180ms ${EASE_DEFAULT}`,
      }}
      onMouseEnter={e => {
        if (disabled || !accent) return
        e.currentTarget.style.background = accent + '14' // ~8% alpha
      }}
      onMouseLeave={e => {
        if (disabled) return
        e.currentTarget.style.background = APPLE_PANEL
      }}
    >
      {label}
    </button>
  )
}
