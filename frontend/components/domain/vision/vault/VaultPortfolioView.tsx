'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { VaultAssetRow, type AssetAgg } from './VaultAssetRow'
import { VaultAssetDetail } from './VaultAssetDetail'

type SortKey = 'pnl' | 'volume' | 'recent'

interface AssetsResponse {
  assets: AssetAgg[]
  total: number
  _stub?: boolean
  reason?: string
}

interface Props {
  vaultAddress: string
  vaultName: string
  sourceId: string
  /** NAV per share (float, e.g. 1.05 = $1.05/share) */
  navPerShare: number
  /** Performance since inception as decimal */
  performanceSinceInception: number
  /** TVL formatted string */
  tvlFormatted: string
}

function sortAssets(assets: AssetAgg[], key: SortKey): AssetAgg[] {
  const copy = [...assets]
  if (key === 'pnl') {
    copy.sort((a, b) => Math.abs(b.realizedPnl) - Math.abs(a.realizedPnl))
  } else if (key === 'volume') {
    copy.sort((a, b) => b.totalVolume - a.totalVolume)
  } else {
    copy.sort((a, b) => {
      if (!a.lastFillAt) return 1
      if (!b.lastFillAt) return -1
      return a.lastFillAt < b.lastFillAt ? 1 : -1
    })
  }
  return copy
}

const SORT_LABELS: Record<SortKey, string> = {
  pnl: 'PnL',
  volume: 'Volume',
  recent: 'Recent',
}

export function VaultPortfolioView({
  vaultAddress,
  vaultName,
  sourceId,
  navPerShare,
  performanceSinceInception,
  tvlFormatted,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedAssetId = searchParams.get('asset')

  const [assets, setAssets] = useState<AssetAgg[]>([])
  const [loading, setLoading] = useState(true)
  const [stub, setStub] = useState<{ reason: string } | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('pnl')

  const loadAssets = useCallback(() => {
    setLoading(true)
    fetch(`/api/vision/vault/${vaultAddress}/assets`, { signal: AbortSignal.timeout(15_000) })
      .then((r) => r.json())
      .then((data: AssetsResponse) => {
        if (data._stub) {
          setStub({ reason: data.reason ?? 'no data' })
          setAssets([])
        } else {
          setStub(null)
          setAssets(data.assets ?? [])
        }
      })
      .catch((e) => {
        setStub({ reason: e.message ?? 'fetch failed' })
        setAssets([])
      })
      .finally(() => setLoading(false))
  }, [vaultAddress])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const sorted = sortAssets(assets, sortKey)
  const selectedAsset = sorted.find((a) => a.assetId === selectedAssetId) ?? null

  function selectAsset(assetId: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (selectedAssetId === assetId) {
      params.delete('asset')
    } else {
      params.set('asset', assetId)
    }
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function clearAsset() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('asset')
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const perfSign = performanceSinceInception >= 0 ? '+' : ''
  const perfColor = performanceSinceInception >= 0 ? '#16a34a' : '#dc2626'

  return (
    <div
      style={{
        fontFamily: 'var(--apple-font-text,"SF Pro Text",Helvetica,Arial,sans-serif)',
        color: 'var(--apple-text,#1d1d1f)',
      }}
    >
      {/* Vault header stats */}
      <div
        className="px-5 py-8 lg:py-10"
        style={{ borderBottom: '1px solid var(--apple-divider,#e8e8ed)' }}
      >
        <h1
          className="font-semibold text-[var(--apple-text,#1d1d1f)]"
          style={{
            fontFamily: 'var(--apple-font-display,"SF Pro Display",Helvetica,Arial,sans-serif)',
            fontSize: 'clamp(28px, 3vw, 40px)',
            letterSpacing: 'var(--apple-track-tighter,-0.016em)',
            lineHeight: 1.1,
          }}
        >
          {vaultName}
        </h1>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-4 mt-5">
          <StatPill label="NAV" value={`$${navPerShare.toFixed(4)}`} />
          <StatPill
            label="all-time return"
            value={`${perfSign}${(performanceSinceInception * 100).toFixed(2)}%`}
            valueColor={perfColor}
          />
          <StatPill label="TVL" value={`$${tvlFormatted}`} />
          {!loading && !stub && (
            <StatPill
              label="markets touched"
              value={`${assets.length}`}
            />
          )}
        </div>
      </div>

      {/* Sort bar */}
      <div
        className="flex items-center gap-1 px-5 py-3"
        style={{ borderBottom: '1px solid var(--apple-divider,#e8e8ed)' }}
      >
        <span
          className="text-[var(--apple-text-secondary,#6e6e73)] mr-2"
          style={{ fontSize: 13 }}
        >
          sort
        </span>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            className="px-3 py-1 rounded-full text-sm transition-colors"
            style={{
              fontSize: 13,
              letterSpacing: 'var(--apple-track-tight,-0.022em)',
              background:
                sortKey === key
                  ? 'var(--apple-text,#1d1d1f)'
                  : 'var(--apple-surface,#f5f5f7)',
              color:
                sortKey === key
                  ? 'var(--apple-bg,#ffffff)'
                  : 'var(--apple-text-secondary,#6e6e73)',
            }}
          >
            {SORT_LABELS[key]}
          </button>
        ))}

        {!loading && !stub && (
          <span
            className="ml-auto text-[var(--apple-text-secondary,#6e6e73)]"
            style={{ fontSize: 13 }}
          >
            {assets.length} {assets.length === 1 ? 'market' : 'markets'}
          </span>
        )}
      </div>

      {/* Asset list */}
      {loading ? (
        <div
          className="flex items-center justify-center py-20"
          style={{ color: 'var(--apple-text-secondary,#6e6e73)', fontSize: 15 }}
        >
          loading portfolio…
        </div>
      ) : stub ? (
        <div className="px-5 py-12 text-center">
          <p
            className="text-[var(--apple-text-secondary,#6e6e73)]"
            style={{ fontSize: 17, letterSpacing: 'var(--apple-track-tight,-0.022em)' }}
          >
            no portfolio data
          </p>
          <p
            className="mt-2 text-[var(--apple-text-secondary,#6e6e73)]"
            style={{ fontSize: 13, opacity: 0.6 }}
          >
            {stub.reason}
          </p>
        </div>
      ) : assets.length === 0 ? (
        <div
          className="flex items-center justify-center py-20"
          style={{ color: 'var(--apple-text-secondary,#6e6e73)', fontSize: 15 }}
        >
          no fills recorded for this vault
        </div>
      ) : (
        <div>
          {sorted.map((asset) => (
            <div key={asset.assetId}>
              <VaultAssetRow
                asset={asset}
                selected={selectedAssetId === asset.assetId}
                onClick={() => selectAsset(asset.assetId)}
              />
              {selectedAssetId === asset.assetId && (
                <VaultAssetDetail
                  asset={asset}
                  vaultAddress={vaultAddress}
                  sourceId={sourceId}
                  onClose={clearAsset}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatPill({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        background: 'var(--apple-surface,#f5f5f7)',
        borderRadius: 'var(--apple-r-md,12px)',
        padding: '10px 16px',
        minWidth: 100,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--apple-text-secondary,#6e6e73)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: 'var(--apple-track-tight,-0.022em)',
          marginTop: 4,
          color: valueColor ?? 'var(--apple-text,#1d1d1f)',
        }}
      >
        {value}
      </span>
    </div>
  )
}
