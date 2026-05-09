'use client'

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'

const ROWS: Array<{ id: string; name: string; iconId: string }> = [
  { id: 'polymarket', name: 'Polymarket', iconId: 'polymarket' },
  { id: 'defillama', name: 'DefiLlama', iconId: 'defillama' },
  { id: 'equities', name: 'NYSE', iconId: 'nasdaq' },
  { id: 'sports', name: 'Sports', iconId: 'sports' },
  { id: 'twitch', name: 'Twitch', iconId: 'twitch' },
  { id: 'github', name: 'GitHub', iconId: 'github' },
]

export function Watchlist() {
  const [fresh, setFresh] = useState<Set<string>>(new Set())

  useEffect(() => {
    const ctl = new AbortController()
    fetch('/api/source-activity', { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { fresh?: string[] } | null) => {
        if (!data?.fresh) return
        setFresh(new Set(data.fresh))
      })
      .catch(() => {})
    return () => ctl.abort()
  }, [])

  return (
    <div
      style={{
        borderTop: '1px solid var(--apple-line)',
        marginTop: 12,
        paddingTop: 12,
      }}
    >
      <p
        style={{
          fontFamily: 'var(--apple-font-text)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-loose)',
          color: 'var(--apple-text-tertiary)',
          textTransform: 'uppercase',
          margin: '0 0 4px 8px',
        }}
      >
        Watchlist
      </p>
      {ROWS.map((w) => (
        <WatchRow key={w.id} item={w} fresh={fresh.has(w.id)} />
      ))}
      <Link
        href={'/explorer' as never}
        className="flex items-center gap-3 px-2 py-2 rounded-[8px] transition-colors duration-200 hover:bg-[rgba(0,0,0,0.04)]"
        style={{
          color: 'var(--apple-text-tertiary)',
          fontFamily: 'var(--apple-font-text)',
          fontSize: 13,
          letterSpacing: 'var(--apple-track-tight)',
          fontWeight: 500,
          textDecoration: 'none',
          transitionTimingFunction: 'var(--apple-ease-default)',
        }}
      >
        <span
          aria-hidden
          className="inline-flex items-center justify-center"
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            background: 'rgba(0,0,0,0.04)',
            fontSize: 14,
            color: 'var(--apple-text-tertiary)',
            lineHeight: 1,
          }}
        >
          ›
        </span>
        <span>Browse all sources</span>
      </Link>
    </div>
  )
}

function WatchRow({
  item,
  fresh,
}: {
  item: { id: string; name: string; iconId: string }
  fresh: boolean
}) {
  const [broken, setBroken] = useState(false)
  return (
    <Link
      href={`/source/${item.id}` as never}
      className="flex items-center gap-3 px-2 py-2 rounded-[8px] transition-colors duration-200 hover:bg-[rgba(0,0,0,0.04)]"
      style={{
        color: 'var(--apple-text-secondary)',
        fontFamily: 'var(--apple-font-text)',
        fontSize: 'var(--apple-fs-14)',
        letterSpacing: 'var(--apple-track-tight)',
        fontWeight: 500,
        textDecoration: 'none',
        transitionTimingFunction: 'var(--apple-ease-default)',
      }}
    >
      <span
        className="relative shrink-0 inline-flex items-center justify-center overflow-hidden"
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          background: '#f5f5f7',
        }}
      >
        {!broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/source-imgs/icons/${item.iconId}.png`}
            alt=""
            width={24}
            height={24}
            loading="lazy"
            onError={() => setBroken(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--apple-text)',
              lineHeight: 1,
            }}
          >
            {item.name.charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span className="flex-1 truncate">{item.name}</span>
      {fresh && (
        <span
          aria-label="Recent activity"
          title="Recent activity"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: '#0071e3',
            flexShrink: 0,
          }}
        />
      )}
    </Link>
  )
}
