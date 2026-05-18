'use client'

import { type ReactNode } from 'react'

export type CitationKind = 'paper' | 'data' | 'article' | 'concept'

interface CitationCardProps {
  kind: CitationKind
  title: string
  meta: string
  detail?: string
  href?: string
  highlight?: boolean
  compact?: boolean
}

export function CitationCard({
  kind,
  title,
  meta,
  detail,
  href,
  highlight,
  compact,
}: CitationCardProps) {
  const accent = highlight ? '#2997ff' : 'rgba(255,255,255,0.7)'
  const surface = highlight
    ? 'rgba(41,151,255,0.08)'
    : 'rgba(255,255,255,0.04)'
  const border = highlight
    ? 'rgba(41,151,255,0.28)'
    : 'rgba(255,255,255,0.08)'

  const inner: ReactNode = (
    <>
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: compact ? 28 : 40,
          height: compact ? 28 : 40,
          borderRadius: 8,
          background: highlight ? 'rgba(41,151,255,0.18)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${border}`,
          color: accent,
        }}
        aria-hidden
      >
        {kind === 'paper' ? <PaperIcon /> : kind === 'data' ? <DataIcon /> : kind === 'article' ? <ArticleIcon /> : <ConceptIcon />}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="truncate"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: compact ? '12.5px' : 'var(--apple-fs-14)',
            fontWeight: 600,
            letterSpacing: 'var(--apple-track-tight)',
            color: highlight ? '#ffffff' : 'rgba(255,255,255,0.92)',
            lineHeight: 1.25,
          }}
        >
          {title}
        </div>
        <div
          className="truncate"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: '11px',
            letterSpacing: '0.005em',
            color: 'rgba(255,255,255,0.5)',
            marginTop: 2,
          }}
        >
          {meta}
        </div>
        {detail && !compact && (
          <div
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11.5px',
              color: 'rgba(255,255,255,0.6)',
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            {detail}
          </div>
        )}
      </div>

      {href && (
        <div
          className="shrink-0 self-start"
          style={{
            color: 'rgba(255,255,255,0.45)',
            marginTop: compact ? 4 : 6,
          }}
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5h5v5M19 5L10 14M5 8v11h11" />
          </svg>
        </div>
      )}
    </>
  )

  const sharedClass = 'group flex items-start gap-3 transition-colors'
  const sharedStyle = {
    background: surface,
    border: `1px solid ${border}`,
    borderRadius: 12,
    padding: compact ? '8px 10px' : '12px 14px',
    textDecoration: 'none' as const,
  }

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={sharedClass}
        style={sharedStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = highlight
            ? 'rgba(41,151,255,0.14)'
            : 'rgba(255,255,255,0.07)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = surface
        }}
      >
        {inner}
      </a>
    )
  }

  return (
    <div className={sharedClass} style={sharedStyle}>
      {inner}
    </div>
  )
}

function PaperIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6M9 9h2" />
    </svg>
  )
}

function DataIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}

function ArticleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v14H4zM4 9h16M8 13h8M8 17h5" />
    </svg>
  )
}

function ConceptIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8M8 12h8" />
    </svg>
  )
}
