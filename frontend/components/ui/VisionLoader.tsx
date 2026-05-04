'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * What remains of the old VisionLoader. The page-level skeleton stacks
 * have been retired in favour of GeneralLoader. Only the small in-table
 * TopPlayersSkeleton survives — it imitates 5 rows inside an existing
 * frame, which the unified loader cannot replace gracefully.
 */

const MESSAGES_LEADERBOARD = [
  'Ranking people who bet on grocery prices for a living.',
  'Sorting degens by train delay conviction.',
  'The scoreboard of people your parents warned you about.',
  'Who profited most from a Lufthansa delay? Loading...',
  'Tallying wins from markets that shouldn\'t exist. But do.',
  'First place predicted DB delays. Second place went to MIT.',
]

function LoaderCaption({ className }: { className?: string }) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(prev => (prev + 1) % MESSAGES_LEADERBOARD.length)
        setVisible(true)
      }, 280)
    }, 3500)
    return () => clearInterval(iv)
  }, [])

  return (
    <p className={cn(
      'font-mono text-[12px] text-text-muted transition-opacity duration-300 h-[18px]',
      visible ? 'opacity-100' : 'opacity-0',
      className,
    )}>
      {MESSAGES_LEADERBOARD[idx]}
    </p>
  )
}

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton rounded', className)} style={style} aria-hidden="true" />
}

/**
 * Used inside TopPlayers — five table rows under a header that already
 * exists in the DOM. Component-internal, not a page boundary.
 */
export function TopPlayersSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'grid grid-cols-[36px_1fr_60px_70px_80px_90px] items-center px-4 py-2.5 border-b border-border-light',
            i % 2 === 1 ? 'bg-surface/40' : '',
          )}
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <Shimmer className="h-[13px] w-4" />
          <Shimmer className="h-[12px] w-24" />
          <Shimmer className="h-[12px] w-8 ml-auto" />
          <Shimmer className="h-[12px] w-12 ml-auto" />
          <Shimmer className="h-[12px] w-10 ml-auto" />
          <Shimmer className="h-[12px] w-14 ml-auto" />
        </div>
      ))}
      <div className="flex justify-center py-3">
        <LoaderCaption className="text-[11px]" />
      </div>
    </>
  )
}
