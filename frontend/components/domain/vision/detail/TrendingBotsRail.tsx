'use client'

import { useTrendingBots } from '@/hooks/vision/useTrendingBots'
import type { BotEntry } from '@/hooks/vision/useTrendingBots'

interface TrendingBotsRailProps {
  sourceId: string
}

function formatRelativeDate(isoDate: string | null): string {
  if (!isoDate) return 'last edited unknown'
  const diff = Date.now() - new Date(isoDate).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'last edited today'
  if (days === 1) return 'last edited 1 day ago'
  if (days < 30) return `last edited ${days} days ago`
  const months = Math.floor(days / 30)
  if (months === 1) return 'last edited 1 month ago'
  return `last edited ${months} months ago`
}

function BotCard({ bot }: { bot: BotEntry }) {
  return (
    <a
      href={bot.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="bot-card"
      aria-label={`View ${bot.name} on GitHub`}
    >
      <div className="bot-card__body">
        <h3 className="bot-card__name">{bot.name}</h3>
        {bot.description && (
          <p className="bot-card__description">{bot.description}</p>
        )}
      </div>
      <div className="bot-card__footer">
        <span className="bot-card__date">{formatRelativeDate(bot.lastCommitAt)}</span>
        <span className="bot-card__cta">View on GitHub →</span>
      </div>

      <style jsx>{`
        .bot-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: var(--apple-panel, #ffffff);
          border: 1px solid var(--apple-line, rgba(0, 0, 0, 0.08));
          border-radius: var(--apple-r-md, 12px);
          padding: 24px;
          text-decoration: none;
          color: inherit;
          transition:
            transform 240ms cubic-bezier(0.4, 0, 0.6, 1),
            box-shadow 240ms cubic-bezier(0.4, 0, 0.6, 1),
            filter 240ms cubic-bezier(0.4, 0, 0.6, 1);
          min-height: 160px;
        }
        .bot-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
          filter: brightness(0.98);
          text-decoration: none;
        }
        .bot-card__body {
          flex: 1;
          margin-bottom: 20px;
        }
        .bot-card__name {
          font-family: "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.016em;
          line-height: 1.2105;
          color: var(--apple-text, #1d1d1f);
          margin: 0 0 8px 0;
        }
        .bot-card__description {
          font-family: "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
          font-size: 14px;
          letter-spacing: -0.005em;
          line-height: 1.4286;
          color: var(--apple-text-secondary, #6e6e73);
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .bot-card__footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .bot-card__date {
          font-family: "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
          font-size: 12px;
          letter-spacing: 0em;
          color: var(--apple-text-tertiary, #86868b);
        }
        .bot-card__cta {
          font-family: "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
          font-size: 14px;
          letter-spacing: -0.005em;
          color: var(--apple-accent, #0071e3);
          white-space: nowrap;
        }
      `}</style>
    </a>
  )
}

function FallbackCard({ sourceId }: { sourceId: string }) {
  const fallbackUrl = `https://github.com/General-Market/vision-bot-examples/tree/main/${sourceId}`
  return (
    <a
      href={fallbackUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fallback-card"
      aria-label="View bot examples on GitHub"
    >
      <span className="fallback-cta">View bot examples on GitHub →</span>

      <style jsx>{`
        .fallback-card {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--apple-panel, #ffffff);
          border: 1px solid var(--apple-line, rgba(0, 0, 0, 0.08));
          border-radius: var(--apple-r-md, 12px);
          padding: 32px 24px;
          text-decoration: none;
          grid-column: 1 / -1;
          transition: filter 240ms cubic-bezier(0.4, 0, 0.6, 1);
        }
        .fallback-card:hover {
          filter: brightness(0.98);
        }
        .fallback-cta {
          font-family: "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
          font-size: 17px;
          letter-spacing: -0.022em;
          color: var(--apple-accent, #0071e3);
        }
      `}</style>
    </a>
  )
}

function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-name" />
      <div className="skeleton-desc" />
      <div className="skeleton-footer" />

      <style jsx>{`
        .skeleton-card {
          background: var(--apple-panel, #ffffff);
          border: 1px solid var(--apple-line, rgba(0, 0, 0, 0.08));
          border-radius: var(--apple-r-md, 12px);
          padding: 24px;
          min-height: 160px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .skeleton-name,
        .skeleton-desc,
        .skeleton-footer {
          background: var(--apple-line, rgba(0, 0, 0, 0.06));
          border-radius: 4px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        .skeleton-name { height: 20px; width: 60%; }
        .skeleton-desc { height: 14px; width: 90%; margin-top: 4px; }
        .skeleton-footer { height: 12px; width: 40%; margin-top: auto; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export function TrendingBotsRail({ sourceId }: TrendingBotsRailProps) {
  const { bots, isStub, isLoading } = useTrendingBots(sourceId)

  const showFallback = isStub && bots.length === 0
  const hasBots = !isLoading && !showFallback && bots.length > 0
  const isEmpty = !isLoading && !showFallback && bots.length === 0

  return (
    <section className="bots-rail">
      <h2 className="bots-rail__heading">bots</h2>

      <div className="bots-rail__grid">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        {showFallback && <FallbackCard sourceId={sourceId} />}
        {hasBots && bots.map((bot) => <BotCard key={bot.path} bot={bot} />)}
        {isEmpty && <FallbackCard sourceId={sourceId} />}
      </div>

      <style jsx>{`
        .bots-rail {
          width: 100%;
        }
        .bots-rail__heading {
          font-family: "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
          font-size: 21px;
          font-weight: 600;
          letter-spacing: -0.016em;
          line-height: 1.1904;
          color: var(--apple-text, #1d1d1f);
          margin: 0 0 20px 0;
        }
        .bots-rail__grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 768px) {
          .bots-rail__grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .bots-rail__grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      `}</style>
    </section>
  )
}
