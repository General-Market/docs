'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { encodeFunctionData, decodeFunctionResult } from 'viem'
import { INDEX_ABI } from '@/lib/contracts/index-protocol-abi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { L3_RPC_URL } from '@/lib/config'
import { useRebalance } from '@/hooks/useRebalance'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { getTxUrl } from '@/lib/utils/explorer'
import { loadDeployedAssets } from '@/lib/static-cache'

const L3_INDEX = INDEX_PROTOCOL.index

interface AssetRow {
  address: string
  symbol: string
  currentWeight: bigint
  newWeight: string // percentage string, user-editable
  isNew?: boolean
}

interface ItpOnChainState {
  creator: string
  assets: string[]
  weights: bigint[]
  inventory: bigint[]
  nav: bigint
  totalSupply: bigint
}

async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.result
}

async function fetchItpState(itpId: string): Promise<ItpOnChainState> {
  const calldata = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'getITPState',
    args: [itpId as `0x${string}`],
  })

  const result = await rpcCall(L3_RPC_URL, 'eth_call', [
    { to: L3_INDEX, data: calldata },
    'latest',
  ]) as `0x${string}`

  const decoded = decodeFunctionResult({
    abi: INDEX_ABI,
    functionName: 'getITPState',
    data: result,
  }) as [string, bigint, bigint, string[], bigint[], bigint[]]

  return {
    creator: decoded[0],
    totalSupply: decoded[1],
    nav: decoded[2],
    assets: decoded[3],
    weights: decoded[4],
    inventory: decoded[5],
  }
}

interface RebalanceSectionProps {
  itpId: string
  enrichment: { holdings: { symbol: string; weight: number }[] } | null
}

export function RebalanceSection({ itpId, enrichment }: RebalanceSectionProps) {
  const { address } = useAccount()
  const { status, txHash, error, requestRebalance, reset } = useRebalance()

  const [assets, setAssets] = useState<AssetRow[]>([])
  const [creator, setCreator] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [availableAssets, setAvailableAssets] = useState<{ address: string; symbol: string }[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Load available assets for adding new ones
  useEffect(() => {
    loadDeployedAssets().then(setAvailableAssets)
  }, [])

  // Load ITP on-chain state
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const state = await fetchItpState(itpId)
        if (cancelled) return

        setCreator(state.creator.toLowerCase())

        // Build symbol map from enrichment + deployed assets
        const enrichmentMap = new Map<string, string>()
        if (enrichment) {
          // enrichment holdings are in weight order; match by index
          for (const h of enrichment.holdings) {
            enrichmentMap.set(h.symbol.toUpperCase(), h.symbol)
          }
        }

        // Symbol lookup from deployed-assets
        const deployedMap: Record<string, string> = {}
        for (const a of availableAssets) {
          deployedMap[a.address.toLowerCase()] = a.symbol
        }

        // Also try data-node aum-ranking for symbols
        let rankingMap: Record<string, string> = {}
        try {
          const res = await fetch('/api/dn/aum-ranking', { signal: AbortSignal.timeout(5_000) })
          if (res.ok) {
            const data = await res.json()
            if (Array.isArray(data)) {
              for (const d of data) {
                if (d.holdings) {
                  for (const h of d.holdings) {
                    if (h.address) rankingMap[h.address.toLowerCase()] = h.symbol
                  }
                }
              }
            }
          }
        } catch { /* optional */ }

        const rows: AssetRow[] = state.assets.map((addr, i) => {
          const symbol = rankingMap[addr.toLowerCase()]
            || deployedMap[addr.toLowerCase()]
            || `Asset ${i + 1}`
          return {
            address: addr,
            symbol,
            currentWeight: state.weights[i],
            newWeight: (Number(state.weights[i]) / 1e16).toFixed(2),
          }
        })

        if (!cancelled) setAssets(rows)
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message || 'Failed to load DTF state')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [itpId, enrichment, availableAssets])

  // Only visible to the ITP creator
  const isCreator = address && creator && address.toLowerCase() === creator
  if (!isCreator && !loading) return null

  const weightSum = assets.reduce((sum, a) => sum + parseFloat(a.newWeight || '0'), 0)
  const isValid = Math.abs(weightSum - 100) < 0.01 && assets.length > 0

  const hasChanges = assets.some(a => {
    const currentPct = Number(a.currentWeight) / 1e16
    const newPct = parseFloat(a.newWeight || '0')
    return Math.abs(currentPct - newPct) > 0.01 || a.isNew
  })

  function updateWeight(index: number, value: string) {
    setAssets(prev => prev.map((a, i) => i === index ? { ...a, newWeight: value } : a))
  }

  function setEqualWeights() {
    const pct = (100 / assets.length).toFixed(2)
    const perAsset = parseFloat(pct)
    const remainder = 100 - perAsset * assets.length
    setAssets(prev => prev.map((a, i) => ({
      ...a,
      newWeight: i === 0
        ? (perAsset + remainder).toFixed(2)
        : pct,
    })))
  }

  function removeAsset(index: number) {
    setAssets(prev => prev.filter((_, i) => i !== index))
  }

  function addAsset(asset: { address: string; symbol: string }) {
    setAssets(prev => [...prev, {
      address: asset.address,
      symbol: asset.symbol,
      currentWeight: 0n,
      newWeight: '0',
      isNew: true,
    }])
    setSearchTerm('')
  }

  const assetAddresses = new Set(assets.map(a => a.address.toLowerCase()))
  const filteredSearch = searchTerm.length > 0
    ? availableAssets.filter(
        a => a.symbol.toLowerCase().includes(searchTerm.toLowerCase()) &&
             !assetAddresses.has(a.address.toLowerCase())
      ).slice(0, 6)
    : []

  async function handleSubmit() {
    if (!isValid || !hasChanges) return

    const newWeights = assets.map(a => {
      const pct = parseFloat(a.newWeight)
      return BigInt(Math.round(pct * 1e16))
    })

    const newAssetRows = assets.filter(a => a.isNew)
    const removedIndices: bigint[] = []

    await requestRebalance(
      itpId,
      removedIndices,
      newAssetRows.map(a => a.address as `0x${string}`),
      newWeights,
      note || 'Rebalance from DTF detail page',
    )
  }

  const isWorking = status === 'switching-chain' || status === 'requesting' || status === 'confirming'

  if (loading) return null

  const sectionTitle = {
    fontFamily: 'var(--apple-font-display)',
    fontSize: 'clamp(24px, 2.4vw, 32px)',
    fontWeight: 600,
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text)',
    margin: 0,
  } as const

  const fieldLabel = {
    fontFamily: 'var(--apple-font-text)',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 'var(--apple-track-loose)',
    color: 'var(--apple-text-tertiary)',
  }

  const inputStyle = {
    background: 'var(--apple-panel)',
    border: '1px solid var(--apple-line)',
    borderRadius: 'var(--apple-r-sm)',
    padding: '8px 12px',
    fontFamily: 'var(--apple-font-text)',
    fontSize: 'var(--apple-fs-14)',
    letterSpacing: 'var(--apple-track-tight)',
    color: 'var(--apple-text)',
    outline: 'none',
  } as const

  const noticeBase = {
    padding: 12,
    borderRadius: 'var(--apple-r-sm)',
    fontFamily: 'var(--apple-font-text)',
    fontSize: 'var(--apple-fs-14)',
    letterSpacing: 'var(--apple-track-tight)',
  }

  return (
    <section className="py-8" data-testid="rebalance-section">
      <div className="flex items-center justify-between mb-6">
        <h2 style={sectionTitle}>Rebalance</h2>
        <button
          onClick={() => setExpanded(!expanded)}
          data-testid="rebalance-toggle"
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-14)',
            fontWeight: 500,
            color: 'var(--apple-accent, #0071e3)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: 'var(--apple-track-tight)',
          }}
        >
          {expanded ? 'Collapse' : 'Adjust Weights'}
        </button>
      </div>

      {!expanded ? (
        <p
          style={{
            fontFamily: 'var(--apple-font-text)',
            fontSize: 'var(--apple-fs-17)',
            lineHeight: 1.47,
            letterSpacing: 'var(--apple-track-tight)',
            color: 'var(--apple-text-secondary)',
            margin: 0,
          }}
        >
          You are the creator of this index. Adjust asset weights, add or remove holdings, then submit a rebalance request.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Add asset search */}
          <div
            style={{
              background: 'var(--apple-panel-2)',
              border: '1px solid var(--apple-line)',
              borderRadius: 'var(--apple-r-md)',
              padding: 16,
            }}
          >
            <div className="flex justify-between items-center mb-2">
              <span style={{ fontFamily: 'var(--apple-font-text)', fontSize: 'var(--apple-fs-12)', color: 'var(--apple-text-secondary)', letterSpacing: 'var(--apple-track-tight)' }}>
                {assets.length} assets ({availableAssets.length} available)
              </span>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search to add asset..."
              className="w-full mb-2"
              style={inputStyle}
              disabled={isWorking || status === 'success'}
              data-testid="rebalance-search"
            />
            {filteredSearch.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {filteredSearch.map(asset => (
                  <button
                    key={asset.address}
                    onClick={() => addAsset(asset)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--apple-r-pill)',
                      border: '1px solid var(--apple-line)',
                      background: 'var(--apple-panel)',
                      fontFamily: 'var(--apple-font-text)',
                      fontSize: 'var(--apple-fs-12)',
                      fontWeight: 500,
                      color: 'var(--apple-text)',
                      cursor: 'pointer',
                      transition: 'border-color 150ms var(--apple-ease-default)',
                    }}
                  >
                    + {asset.symbol}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick-set */}
          <div className="flex gap-2">
            <button
              onClick={setEqualWeights}
              data-testid="rebalance-equal"
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--apple-r-pill)',
                border: '1px solid var(--apple-line)',
                background: 'var(--apple-panel)',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-12)',
                fontWeight: 500,
                color: 'var(--apple-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Equal Weights
            </button>
          </div>

          {/* Weight sum */}
          <div
            data-testid="rebalance-weight-sum"
            className="flex justify-between items-center"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--apple-r-sm)',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-14)',
              fontVariantNumeric: 'tabular-nums',
              background: isValid ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
              color: isValid ? '#16a34a' : '#dc2626',
              border: `1px solid ${isValid ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
            }}
          >
            <span>Total Weight</span>
            <span>{weightSum.toFixed(2)}%</span>
          </div>

          {/* Asset table */}
          <div
            className="max-h-[400px] overflow-y-auto"
            style={{
              border: '1px solid var(--apple-line)',
              borderRadius: 'var(--apple-r-md)',
            }}
          >
            <table className="w-full" data-testid="rebalance-table">
              <thead
                className="sticky top-0"
                style={{ background: 'var(--apple-panel-2)' }}
              >
                <tr>
                  <th style={{ ...fieldLabel, padding: '10px 12px', textAlign: 'left' }}>Asset</th>
                  <th style={{ ...fieldLabel, padding: '10px 12px', textAlign: 'right' }}>Current %</th>
                  <th style={{ ...fieldLabel, padding: '10px 12px', textAlign: 'right' }}>New %</th>
                  <th style={{ padding: '10px 12px', width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset, i) => (
                  <tr
                    key={`${asset.address}-${i}`}
                    data-testid="rebalance-row"
                    style={{
                      borderTop: '1px solid var(--apple-line)',
                      background: asset.isNew ? 'rgba(22,163,74,0.04)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontFamily: 'var(--apple-font-text)', fontSize: 'var(--apple-fs-14)', color: 'var(--apple-text)', letterSpacing: 'var(--apple-track-tight)' }}>{asset.symbol}</span>
                        {asset.isNew && (
                          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, letterSpacing: 'var(--apple-track-loose)' }}>new</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--apple-font-text)', fontSize: 'var(--apple-fs-14)', fontVariantNumeric: 'tabular-nums', color: 'var(--apple-text-tertiary)' }}>
                      {asset.isNew ? '—' : `${(Number(asset.currentWeight) / 1e16).toFixed(2)}%`}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={asset.newWeight}
                        onChange={e => updateWeight(i, e.target.value)}
                        style={{ ...inputStyle, width: 88, textAlign: 'right', padding: '6px 10px', fontVariantNumeric: 'tabular-nums' }}
                        disabled={isWorking || status === 'success'}
                        data-testid="rebalance-weight-input"
                      />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {asset.isNew && !isWorking && status !== 'success' && (
                        <button
                          onClick={() => removeAsset(i)}
                          style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: 14, cursor: 'pointer' }}
                          aria-label="Remove asset"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Note */}
          <div>
            <label style={{ ...fieldLabel, display: 'block', marginBottom: 6 }}>Rebalance Note</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Reason for rebalance (optional)"
              className="w-full"
              style={inputStyle}
              disabled={isWorking || status === 'success'}
              data-testid="rebalance-note"
            />
          </div>

          {/* Status */}
          {status === 'switching-chain' && (
            <div style={{ ...noticeBase, background: 'rgba(0,113,227,0.08)', color: 'var(--apple-accent, #0071e3)', border: '1px solid rgba(0,113,227,0.2)' }}>
              Switching to Settlement chain...
            </div>
          )}
          {status === 'requesting' && (
            <div style={{ ...noticeBase, background: 'rgba(0,113,227,0.08)', color: 'var(--apple-accent, #0071e3)', border: '1px solid rgba(0,113,227,0.2)' }}>
              Confirm in your wallet...
            </div>
          )}
          {status === 'confirming' && (
            <div style={{ ...noticeBase, background: 'rgba(0,113,227,0.08)', color: 'var(--apple-accent, #0071e3)', border: '1px solid rgba(0,113,227,0.2)' }}>
              Confirming on-chain...
            </div>
          )}
          {status === 'error' && error && (
            <div style={{ ...noticeBase, background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', wordBreak: 'break-all' }}>
              {error}
            </div>
          )}
          {status === 'success' && (
            <div
              data-testid="rebalance-success"
              style={{ ...noticeBase, background: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.2)' }}
            >
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Rebalance request submitted.</p>
              {txHash && (
                <a
                  href={getTxUrl(txHash, 'settlement')}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all', color: '#16a34a', textDecoration: 'underline' }}
                >
                  Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              )}
            </div>
          )}

          {/* Submit */}
          <WalletActionButton
            onClick={handleSubmit}
            disabled={!isValid || !hasChanges || isWorking || status === 'success'}
            className="w-full"
            style={{
              padding: '14px 24px',
              borderRadius: 'var(--apple-r-pill)',
              background: 'var(--apple-accent, #0071e3)',
              color: '#ffffff',
              fontFamily: 'var(--apple-font-text)',
              fontSize: 'var(--apple-fs-14)',
              fontWeight: 600,
              letterSpacing: 'var(--apple-track-tight)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {status === 'requesting' ? 'Waiting for wallet...'
              : status === 'confirming' ? 'Confirming...'
              : status === 'success' ? 'Rebalanced!'
              : 'Request Rebalance'}
          </WalletActionButton>

          {status === 'success' && (
            <button
              onClick={reset}
              className="w-full"
              style={{
                padding: '10px 0',
                background: 'transparent',
                border: 'none',
                fontFamily: 'var(--apple-font-text)',
                fontSize: 'var(--apple-fs-14)',
                color: 'var(--apple-text-secondary)',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          )}
        </div>
      )}
    </section>
  )
}
