'use client'

import { useTranslations } from 'next-intl'
import { useItpMetadata } from '@/hooks/useItpMetadata'
import { useItpCreators } from '@/hooks/useItpCreators'
import type { SectionProps } from '../SectionRenderer'

const PROTOCOL_DEPLOYER = '0xc0d3ca67da45613e7c5b2d55f09b00b3c99721f4'

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/**
 * Parse a YouTube URL into an embeddable URL.
 * Handles youtube.com/watch?v=X, youtu.be/X, and youtube.com/embed/X.
 */
function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    let videoId: string | null = null

    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) {
        return url // already embeddable
      }
      videoId = u.searchParams.get('v')
    } else if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1)
    }

    if (videoId) return `https://www.youtube.com/embed/${videoId}`
    return null
  } catch {
    return null
  }
}

export function ItpMetadataSection({ itpId }: SectionProps) {
  const t = useTranslations('markets.itp_page.metadata')
  const { metadata, isLoading } = useItpMetadata(itpId as `0x${string}`)
  const { creators } = useItpCreators([itpId])

  const creator = creators.get(itpId)
  const isUnofficial = creator && creator !== PROTOCOL_DEPLOYER

  // Nothing to show for official ITPs with no metadata
  if (!isUnofficial && !metadata) return null
  if (isLoading) return null

  const embedUrl = metadata?.videoUrl ? toYouTubeEmbedUrl(metadata.videoUrl) : null

  return (
    <section className="py-8">
      {/* Community badge + creator */}
      {isUnofficial && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span
            className="inline-flex items-center"
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--apple-r-pill)',
              background: 'rgba(0,113,227,0.1)',
              color: 'var(--apple-accent, #0071e3)',
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 'var(--apple-track-loose)',
            }}
          >
            {t('community_index')}
          </span>
          <span style={{ fontFamily: 'var(--apple-font-text)', fontSize: 'var(--apple-fs-14)', color: 'var(--apple-text-secondary)', letterSpacing: 'var(--apple-track-tight)' }}>
            {t('creator')}:
            <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--apple-text)', marginLeft: 6 }}>{truncateAddress(creator)}</span>
          </span>
        </div>
      )}

      {/* Description */}
      {metadata?.description && (
        <div className="mb-8">
          <h2
            className="mb-3"
            style={{
              fontFamily: 'var(--apple-font-display)',
              fontSize: 'var(--apple-fs-24)',
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text)',
              margin: 0,
              marginBottom: 12,
            }}
          >
            {t('description_title')}
          </h2>
          <p
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-17)',
              lineHeight: 1.47,
              letterSpacing: 'var(--apple-track-tight)',
              color: 'var(--apple-text-secondary)',
            }}
          >
            {metadata.description}
          </p>
        </div>
      )}

      {/* Website link */}
      {metadata?.websiteUrl && (
        <div className="mb-8">
          <a
            href={metadata.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-14)',
              fontWeight: 500,
              color: 'var(--apple-accent, #0071e3)',
              letterSpacing: 'var(--apple-track-tight)',
            }}
          >
            {t('website')}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 1h7v7M11 1L1 11" />
            </svg>
          </a>
        </div>
      )}

      {/* YouTube embed */}
      {embedUrl && (
        <div className="mb-2">
          <h3
            className="mb-3"
            style={{
              fontFamily: 'var(--apple-font-text)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 'var(--apple-track-loose)',
              color: 'var(--apple-text-tertiary)',
            }}
          >
            {t('video')}
          </h3>
          <div className="relative w-full max-w-2xl" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={embedUrl}
              title="DTF Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              style={{ borderRadius: 'var(--apple-r-md)', border: '1px solid var(--apple-line)' }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
