'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Link, useRouter } from '@/i18n/routing'
import { useSourceSnapshot, type SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { SourceTabNav } from './SourceTabNav'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { useTranslations } from 'next-intl'
import { GeneralLoader } from '@/components/ui/GeneralLoader'

interface SourceDetailHumanTradingProps {
  sourceId: string
  initialSource?: SourceDisplayServer
  /**
   * When true, parent (AppShell) already renders SourceSidebarApple, so this
   * component is just a content column.
   */
  hideSidebar?: boolean
}

const TOP_N = 10
const CONTENT_MAX = 1068 // apple.com wide-marketing column

// ── Cioran prose per defillama sub-category. Setup, pivot, knife. ────────────
// Fallback covers any source not listed.
const PROSE: Record<string, string[]> = {
  'defillama-lending': [
    'Lending is the quiet engine. Capital deposited yesterday earns rent tonight.',
    'The interesting question is which protocol survives the next stress test — not which posts the largest TVL today.',
    'Pick the one you would still trust in a drawdown.',
  ],
  'defillama-dexs': [
    'A DEX is a market that exists because no one was watching.',
    'Volume tells you how many people agreed to pretend the orderbook was thick.',
    'The protocol that still has fees in a flat week is the one that matters.',
  ],
  'defillama-derivatives': [
    'Perps are conviction with extra steps.',
    'Open interest measures how confident the room is — never how correct.',
    'Trade the venue, not the trader.',
  ],
  'defillama-liquid-staking': [
    'Staking turned into a derivative the moment it had a token.',
    'Yield is the prize for waiting; liquidity is the prize for not.',
    'Pick the one whose discount peg you would survive.',
  ],
  'defillama-bridges': [
    'Bridges are where capital stops being yours for a few minutes.',
    'Volume here is not a feature — it is exposure.',
    'The one with the smallest unexplained outage wins.',
  ],
  'defillama-launchpad': [
    'Launchpads are factories for things that will not exist next year.',
    'Volume measures hope. Hope is priced.',
    'Trade the floor, not the ceiling.',
  ],
  'defillama-prediction-market': [
    'Prediction markets sell certainty about uncertainty.',
    'The interesting figure is not the volume — it is the spread between belief and outcome.',
    'Pick the venue that pays out without arguing.',
  ],
  'defillama-rwa': [
    'Real-world assets are the part of crypto that does not believe in itself.',
    'TVL measures how much off-chain reality the chain dared touch.',
    'Pick the issuer who answers the phone.',
  ],
  'defillama-onchain-capital-allocator': [
    'A capital allocator is a manager who admitted it in the smart contract.',
    'Returns matter; methodology matters more.',
    'Trust the rules; the discretion is what kills.',
  ],
  'defillama-risk-curators': [
    'Risk curators are the actuaries DeFi pretends not to need.',
    'Their TVL is a measure of whose judgment the market borrowed.',
    'Pick the one who has been wrong least cheaply.',
  ],
  'defillama-ai-agents': [
    'AI agents are a category that wrote its own headline.',
    'Their TVL is a polite estimate of how much capital agreed to be experimented on.',
    'Trade the protocol whose pause button still works.',
  ],
  'defillama-privacy': [
    'Privacy protocols are the only category whose users disappear when measured.',
    'TVL here is a courtesy figure.',
    'Pick the one that is still legal where you live.',
  ],
  'defillama-telegram-bot': [
    'Trading from a chat window is a confession dressed as convenience.',
    'TVL here is rarely the point — it is the volume that pays the bills.',
    'Pick the bot that still replies after a bad week.',
  ],
  'defillama-trading-app': [
    'Trading apps are interfaces over things you do not own.',
    'They make custody feel optional. It is not.',
    'Pick the one whose deposit address has not changed in a year.',
  ],
  'defillama-interface': [
    'An interface is whoever managed to put a button on someone else’s smart contract first.',
    'No custody, no TVL — only traffic.',
    'The interesting question is which one will still resolve to a domain next quarter.',
  ],
  'defillama-wallets': [
    'A wallet is a contract that takes responsibility for your wrong decisions.',
    'TVL here is just trust, denominated.',
    'Pick the one whose recovery flow you have actually tested.',
  ],
  'defillama-top-chains': [
    'Chains compete to be the place where capital chooses to sit still.',
    'TVL is the only honest scoreboard, and even it lies on weekends.',
    'Pick the chain you would still use if its token went to zero.',
  ],
}

const PROSE_FALLBACK = [
  'A market is a place where opinions become numbers.',
  'These ten are the ones the curator could defend in writing.',
  'The rest were not asked.',
]

// ── Formatting helpers ───────────────────────────────────────────────────────

function formatBigUsd(value: string | null): string {
  if (!value) return '—'
  const n = parseFloat(value)
  if (!isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function formatChange(pct: string | null): { text: string; positive: boolean | null } {
  if (pct == null) return { text: '—', positive: null }
  const n = parseFloat(pct)
  if (!isFinite(n)) return { text: '—', positive: null }
  const sign = n > 0 ? '+' : ''
  return { text: `${sign}${n.toFixed(2)}%`, positive: n === 0 ? null : n > 0 }
}

// Synthesize a deterministic 7-point line shape from a market's 24h change %.
// Not historical truth — a visual proxy. When the data-node ships per-protocol
// history, swap this for real points.
function synthesizeSparkline(assetId: string, changePct: string | null): number[] {
  const pct = parseFloat(changePct ?? '0') || 0
  // Seed a tiny PRNG from assetId so each card has a stable wiggle.
  let seed = 0
  for (let i = 0; i < assetId.length; i++) seed = (seed * 31 + assetId.charCodeAt(i)) | 0
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const slope = Math.max(-25, Math.min(25, pct)) / 25 // -1..1
  const points: number[] = []
  for (let i = 0; i < 7; i++) {
    const t = i / 6
    const trend = slope * t
    const noise = (rand() - 0.5) * 0.35
    points.push(trend + noise)
  }
  return points
}

function sparklinePath(values: number[], w: number, h: number): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 2
  const innerH = h - pad * 2
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = pad + (1 - (v - min) / range) * innerH
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

// ── Top-section aggregate. Sum of values across surfaced markets. ────────────
function aggregateValue(prices: SnapshotPrice[]): string {
  let sum = 0
  for (const p of prices) {
    const v = parseFloat(p.value)
    if (isFinite(v)) sum += v
  }
  return String(sum)
}

// ── ui_rank lives in the asset metadata which the snapshot endpoint does not
// currently flatten into SnapshotPrice. We read it defensively in case a
// future endpoint adds it, then fall back to value-desc ordering.
function readUiRank(p: SnapshotPrice): number | null {
  const anyP = p as unknown as { ui_rank?: number; uiRank?: number; metadata?: { ui_rank?: number } }
  const raw = anyP.ui_rank ?? anyP.uiRank ?? anyP.metadata?.ui_rank
  if (typeof raw === 'number' && raw > 0) return raw
  return null
}

// ── Component ────────────────────────────────────────────────────────────────

export function SourceDetailHumanTrading({
  sourceId,
  initialSource,
  hideSidebar,
}: SourceDetailHumanTradingProps) {
  const t = useTranslations('vision')
  const router = useRouter()

  const { sources, isLoading: isRegistryLoading } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)

  const source = sourceEntry
    ? {
        id: sourceEntry.sourceId,
        name: sourceEntry.name,
        description: sourceEntry.description,
        category: sourceEntry.category,
        logo: sourceEntry.logo,
        brandBg: sourceEntry.brandBg,
        prefixes: sourceEntry.prefixes,
        valueLabel: sourceEntry.valueLabel,
        valueUnit: sourceEntry.valueUnit,
        isPrice: sourceEntry.isPrice,
      }
    : initialSource
      ? {
          id: initialSource.sourceId,
          name: initialSource.name,
          description: initialSource.description,
          category: initialSource.category,
          logo: initialSource.logo,
          brandBg: initialSource.brandBg,
          prefixes: initialSource.prefixes,
          valueLabel: initialSource.valueLabel,
          valueUnit: initialSource.valueUnit,
          isPrice: initialSource.isPrice,
        }
      : null

  const { data, isLoading: isSnapshotLoading } = useSourceSnapshot(sourceId)
  const allMarkets: SnapshotPrice[] = useMemo(() => data?.prices ?? [], [data])

  // Curate: prefer ui_rank ascending; fall back to value desc. Truncate at TOP_N.
  const curated = useMemo(() => {
    const withRank = allMarkets.map(m => ({ m, rank: readUiRank(m) }))
    const hasRanks = withRank.some(x => x.rank !== null)
    const sorted = [...withRank].sort((a, b) => {
      if (hasRanks) {
        const ar = a.rank ?? Number.POSITIVE_INFINITY
        const br = b.rank ?? Number.POSITIVE_INFINITY
        if (ar !== br) return ar - br
      }
      const av = parseFloat(a.m.value) || 0
      const bv = parseFloat(b.m.value) || 0
      return bv - av
    })
    return sorted.slice(0, TOP_N).map(x => x.m)
  }, [allMarkets])

  if (isRegistryLoading && !initialSource) {
    return <GeneralLoader height="70vh" />
  }

  if (!source) {
    return (
      <div className="px-6 lg:px-12 py-12">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl font-black text-black mb-2">
            {t('source_detail.source_not_found')}
          </h1>
          <p className="text-text-secondary mb-4">
            {t('source_detail.source_not_found_description', { sourceId })}
          </p>
          <button
            onClick={() => router.push('/')}
            className="text-[13px] font-bold text-black underline hover:no-underline"
          >
            {t('common_labels.back_to_sources')}
          </button>
        </div>
      </div>
    )
  }

  const valueLabel = source.valueLabel || 'TVL'
  const aggLabel = source.isPrice ? 'aggregate' : `total ${valueLabel.toLowerCase()}`
  const aggValue = formatBigUsd(aggregateValue(curated))
  const proseLines = PROSE[sourceId] ?? PROSE_FALLBACK

  const showSnapshotEmpty = !isSnapshotLoading && curated.length === 0

  const content = (
    <div className="flex-1 min-w-0 flex flex-col">
      <SourceTabNav sourceId={sourceId} activeTab="overview" />

      <div
        className="mx-auto w-full px-6 py-10 md:px-8 md:py-14 lg:py-16 flex flex-col gap-10"
        style={{ maxWidth: CONTENT_MAX }}
      >
        {/* Top: eyebrow, source name, one-line dim description, curated badge */}
        <HumanHeader
          sourceId={source.id}
          name={source.name}
          description={source.description}
          logo={source.logo}
          brandBg={source.brandBg}
          aggValue={aggValue}
          aggLabel={aggLabel}
        />

        {/* Card grid */}
        {isSnapshotLoading && curated.length === 0 ? (
          <SkeletonGrid />
        ) : showSnapshotEmpty ? (
          <IndexingNotice />
        ) : (
          <div className="flex flex-col gap-3">
            {curated.map(m => (
              <MarketCard
                key={m.assetId}
                sourceId={sourceId}
                market={m}
                prefixes={source.prefixes}
                valueLabel={valueLabel}
                isPrice={source.isPrice}
              />
            ))}
            {curated.length < TOP_N && (
              <SparseNotice count={curated.length} />
            )}
          </div>
        )}

        {/* Cioran prose tail */}
        <ProseBlock lines={proseLines} />
      </div>
    </div>
  )

  if (hideSidebar) return content

  // When the page didn't slot a sidebar (defensive — current /source page always passes hideSidebar)
  return <div className="flex">{content}</div>
}

// ── Header ───────────────────────────────────────────────────────────────────

function HumanHeader({
  sourceId,
  name,
  description,
  logo,
  brandBg,
  aggValue,
  aggLabel,
}: {
  sourceId: string
  name: string
  description: string
  logo: string
  brandBg: string
  aggValue: string
  aggLabel: string
}) {
  const [logoBroken, setLogoBroken] = useState(false)
  const hasLogo = !!logo && !logoBroken

  return (
    <header className="flex flex-col gap-5">
      {/* eyebrow */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          style={{
            fontFamily: 'var(--apple-font-text), ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '+0.011em',
            color: 'var(--apple-text-tertiary)',
            textTransform: 'uppercase',
          }}
        >
          DefiLlama · Manually curated
        </span>
        <span
          aria-label="Top 10 by TVL, hand-picked"
          style={{
            fontFamily: 'var(--apple-font-text), ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '+0.011em',
            color: 'var(--apple-text-tertiary)',
            border: '1px solid var(--apple-line)',
            borderRadius: 'var(--apple-r-pill, 980px)',
            padding: '4px 10px',
            textTransform: 'lowercase',
          }}
        >
          top 10 · by tvl
        </span>
      </div>

      {/* h1 + brand mark */}
      <div className="flex items-center gap-5 sm:gap-6">
        {hasLogo && (
          <div
            className="hidden sm:flex shrink-0 items-center justify-center overflow-hidden"
            style={{
              width: 72,
              height: 72,
              background: brandBg || '#000',
              borderRadius: 'var(--apple-r-md, 12px)',
            }}
            aria-hidden
          >
            <Image
              src={logo}
              alt=""
              width={120}
              height={56}
              className="max-h-[56px] max-w-[80%] object-contain"
              priority
              onError={() => setLogoBroken(true)}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1
            style={{
              fontFamily: 'var(--apple-font-display), "SF Pro Display", Helvetica, Arial, sans-serif',
              fontSize: 'clamp(40px, 5.5vw, 56px)',
              fontWeight: 600,
              letterSpacing: '-0.016em',
              lineHeight: 1.0714,
              color: 'var(--apple-text, #1D1D1F)',
              margin: 0,
            }}
          >
            {name}
          </h1>
          {description && (
            <p
              className="mt-3"
              style={{
                fontFamily: 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif',
                fontSize: 17,
                lineHeight: 1.4706,
                letterSpacing: '-0.022em',
                color: 'var(--apple-text-tertiary, #86868B)',
                margin: 0,
                maxWidth: 640,
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {/* aggregate strip */}
      <div
        className="flex items-baseline gap-3 flex-wrap"
        aria-label={`${aggLabel} ${aggValue}`}
      >
        <span
          style={{
            fontFamily: 'var(--apple-font-display), "SF Pro Display", Helvetica, Arial, sans-serif',
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: '-0.016em',
            color: 'var(--apple-text, #1D1D1F)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {aggValue}
        </span>
        <span
          style={{
            fontFamily: 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif',
            fontSize: 14,
            letterSpacing: '-0.016em',
            color: 'var(--apple-text-secondary, #6E6E73)',
          }}
        >
          {aggLabel}
        </span>
      </div>

      <div style={{ display: 'none' }} data-source-id={sourceId} aria-hidden />
    </header>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function MarketCard({
  sourceId,
  market,
  prefixes,
  valueLabel,
  isPrice,
}: {
  sourceId: string
  market: SnapshotPrice
  prefixes: string[]
  valueLabel: string
  isPrice: boolean
}) {
  const [imgErr, setImgErr] = useState(false)
  const imgSrc =
    !imgErr && (market.imageUrl || getAssetImageUrl(sourceId, market.assetId, prefixes))
  const href = `/source/${sourceId}/market/${encodeURIComponent(market.assetId)}`
  const change = formatChange(market.changePct)
  const points = useMemo(
    () => synthesizeSparkline(market.assetId, market.changePct),
    [market.assetId, market.changePct],
  )
  const sparkW = 96
  const sparkH = 36
  const path = sparklinePath(points, sparkW, sparkH)
  const strokeColor =
    change.positive === true
      ? 'rgb(52,199,89)'
      : change.positive === false
        ? 'rgb(255,59,48)'
        : 'var(--apple-text-tertiary, #86868B)'

  const name = market.name || market.symbol || market.assetId
  const category = (market.category ?? '').toLowerCase()

  const formattedValue = formatBigUsd(market.value)
  const subValue = isPrice
    ? 'price'
    : `${formattedValue.replace(/^\$/, '$')} ${valueLabel.toLowerCase()}`.toLowerCase()

  return (
    <article
      className="group"
      style={{
        background: 'var(--apple-panel, #FFFFFF)',
        border: '1px solid var(--apple-line, rgba(0,0,0,0.08))',
        borderRadius: 'var(--apple-r-md, 12px)',
        padding: '20px 24px',
        transition:
          'border-color 200ms cubic-bezier(0.4, 0, 0.6, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.6, 1), transform 200ms cubic-bezier(0.4, 0, 0.6, 1)',
      }}
    >
      <div className="flex items-center gap-5">
        {/* Left: logo + identity */}
        <div className="flex items-center gap-4 min-w-0" style={{ flex: '0 1 280px' }}>
          <div
            className="shrink-0 inline-flex items-center justify-center overflow-hidden"
            style={{
              width: 48,
              height: 48,
              background: '#F5F5F7',
              borderRadius: 999,
            }}
            aria-hidden
          >
            {imgSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgSrc}
                alt=""
                width={48}
                height={48}
                className="object-cover w-full h-full"
                loading="lazy"
                onError={() => setImgErr(true)}
              />
            ) : (
              <span
                style={{
                  fontFamily: 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif',
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--apple-text, #1D1D1F)',
                  lineHeight: 1,
                }}
              >
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div
              className="truncate"
              style={{
                fontFamily:
                  'var(--apple-font-display), "SF Pro Display", Helvetica, Arial, sans-serif',
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: '-0.016em',
                lineHeight: 1.1666,
                color: 'var(--apple-text, #1D1D1F)',
              }}
            >
              {name}
            </div>
            {category && (
              <div
                className="mt-1 truncate"
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11,
                  letterSpacing: '+0.011em',
                  color: 'var(--apple-text-tertiary, #86868B)',
                  textTransform: 'lowercase',
                }}
              >
                {category}
              </div>
            )}
          </div>
        </div>

        {/* Center: value */}
        <div className="hidden md:flex flex-col items-start" style={{ flex: '1 1 auto' }}>
          <div
            style={{
              fontFamily:
                'var(--apple-font-display), "SF Pro Display", Helvetica, Arial, sans-serif',
              fontSize: 36,
              fontWeight: 400,
              letterSpacing: '-0.016em',
              lineHeight: 1,
              color: 'var(--apple-text, #1D1D1F)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formattedValue}
          </div>
          <div
            className="mt-2"
            style={{
              fontFamily: 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif',
              fontSize: 12,
              letterSpacing: '-0.016em',
              color: 'var(--apple-text-secondary, #6E6E73)',
              textTransform: 'lowercase',
            }}
          >
            {subValue}
          </div>
        </div>

        {/* Right: change + sparkline */}
        <div className="hidden lg:flex flex-col items-end gap-2" style={{ flex: '0 0 auto' }}>
          <span
            style={{
              fontFamily: 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '-0.016em',
              fontVariantNumeric: 'tabular-nums',
              color:
                change.positive === true
                  ? 'rgb(52,199,89)'
                  : change.positive === false
                    ? 'rgb(255,59,48)'
                    : 'var(--apple-text-tertiary, #86868B)',
            }}
          >
            {change.text}
          </span>
          <svg
            width={sparkW}
            height={sparkH}
            viewBox={`0 0 ${sparkW} ${sparkH}`}
            role="img"
            aria-label="7-day trend"
          >
            <line
              x1="0"
              x2={sparkW}
              y1={sparkH / 2}
              y2={sparkH / 2}
              stroke="var(--apple-line, rgba(0,0,0,0.06))"
              strokeWidth="1"
            />
            {path && (
              <path
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>

        {/* Far right: Trade pill */}
        <div className="shrink-0">
          <Link
            href={href}
            aria-label={`Trade ${name}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 24px',
              borderRadius: 980,
              background: '#0071E3',
              color: '#FFFFFF',
              fontFamily: 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif',
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: '-0.016em',
              textDecoration: 'none',
              transition: 'background 200ms cubic-bezier(0.4, 0, 0.6, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#0066CC'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#0071E3'
            }}
          >
            Trade
          </Link>
        </div>
      </div>

      {/* Mobile-only: value below */}
      <div className="md:hidden mt-4 flex items-baseline justify-between gap-3">
        <div
          style={{
            fontFamily:
              'var(--apple-font-display), "SF Pro Display", Helvetica, Arial, sans-serif',
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: '-0.016em',
            color: 'var(--apple-text, #1D1D1F)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formattedValue}
        </div>
        <span
          style={{
            fontFamily: 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '-0.016em',
            fontVariantNumeric: 'tabular-nums',
            color:
              change.positive === true
                ? 'rgb(52,199,89)'
                : change.positive === false
                  ? 'rgb(255,59,48)'
                  : 'var(--apple-text-tertiary, #86868B)',
          }}
        >
          {change.text}
        </span>
      </div>
    </article>
  )
}

// ── Skeletons & empty states ─────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--apple-panel, #FFFFFF)',
            border: '1px solid var(--apple-line, rgba(0,0,0,0.08))',
            borderRadius: 'var(--apple-r-md, 12px)',
            padding: '20px 24px',
            height: 120,
            opacity: 0.6,
          }}
        >
          <div className="flex items-center gap-5 h-full">
            <span
              className="skeleton shrink-0 rounded-full"
              style={{ width: 48, height: 48 }}
            />
            <span className="skeleton flex-1 h-[18px] rounded" />
            <span className="skeleton w-[140px] h-[28px] rounded" />
            <span className="skeleton w-[88px] h-[36px]" style={{ borderRadius: 980 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function IndexingNotice() {
  return (
    <div
      style={{
        background: 'var(--apple-panel, #FFFFFF)',
        border: '1px solid var(--apple-line, rgba(0,0,0,0.08))',
        borderRadius: 'var(--apple-r-md, 12px)',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif',
          fontSize: 17,
          letterSpacing: '-0.022em',
          color: 'var(--apple-text-secondary, #6E6E73)',
          margin: 0,
          lineHeight: 1.4706,
        }}
      >
        Markets indexing. Check back tomorrow.
      </p>
    </div>
  )
}

function SparseNotice({ count }: { count: number }) {
  return (
    <p
      className="mt-2"
      style={{
        fontFamily: 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif',
        fontSize: 13,
        letterSpacing: '-0.016em',
        color: 'var(--apple-text-tertiary, #86868B)',
        textAlign: 'center',
        margin: '8px 0 0',
      }}
    >
      {count} {count === 1 ? 'market' : 'markets'}, hand-picked. The rest of the field had no
      measurable backing.
    </p>
  )
}

function ProseBlock({ lines }: { lines: string[] }) {
  return (
    <section
      style={{
        borderTop: '1px solid var(--apple-line, rgba(0,0,0,0.08))',
        paddingTop: 32,
        maxWidth: 734,
      }}
    >
      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            fontFamily: 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif',
            fontSize: 17,
            lineHeight: 1.4706,
            letterSpacing: '-0.022em',
            color:
              i === lines.length - 1
                ? 'var(--apple-text, #1D1D1F)'
                : 'var(--apple-text-secondary, #6E6E73)',
            margin: i === 0 ? 0 : '12px 0 0',
          }}
        >
          {line}
        </p>
      ))}
    </section>
  )
}
