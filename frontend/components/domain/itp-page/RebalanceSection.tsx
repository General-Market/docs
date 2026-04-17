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
    fetch('/deployed-assets.json')
      .then(res => res.ok ? res.json() : [])
      .then((data: { address: string; symbol: string }[]) => {
        if (Array.isArray(data)) setAvailableAssets(data)
      })
      .catch(() => {})
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
        if (!cancelled) setLoadError(e.message || 'Failed to load ITP state')
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
      note || 'Rebalance from ITP detail page',
    )
  }

  const isWorking = status === 'switching-chain' || status === 'requesting' || status === 'confirming'

  if (loading) return null

  return (
    <section className="py-8" data-testid="rebalance-section">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-text-primary">Rebalance</h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
          data-testid="rebalance-toggle"
        >
          {expanded ? 'Collapse' : 'Adjust Weights'}
        </button>
      </div>

      {!expanded ? (
        <p className="text-sm text-text-muted">
          You are the creator of this index. Adjust asset weights, add or remove holdings, then submit a rebalance request.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Add asset search */}
          <div className="bg-muted rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-text-secondary">
                {assets.length} assets ({availableAssets.length} available)
              </span>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search to add asset..."
              className="w-full bg-white border border-border-medium rounded px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-text-muted"
              disabled={isWorking || status === 'success'}
              data-testid="rebalance-search"
            />
            {filteredSearch.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {filteredSearch.map(asset => (
                  <button
                    key={asset.address}
                    onClick={() => addAsset(asset)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-border-medium rounded text-xs text-text-primary hover:border-zinc-500 transition-colors"
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
              className="px-3 py-1 text-xs border border-border-medium rounded text-text-secondary hover:border-zinc-500 hover:text-text-primary transition-colors"
              data-testid="rebalance-equal"
            >
              Equal Weights
            </button>
          </div>

          {/* Weight sum */}
          <div
            className={`flex justify-between items-center p-2 text-sm font-mono rounded ${
              isValid
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
            data-testid="rebalance-weight-sum"
          >
            <span>Total Weight</span>
            <span>{weightSum.toFixed(2)}%</span>
          </div>

          {/* Asset table */}
          <div className="max-h-[400px] overflow-y-auto border border-border-light rounded-lg">
            <table className="w-full text-sm" data-testid="rebalance-table">
              <thead className="sticky top-0 bg-muted">
                <tr className="text-text-muted text-xs">
                  <th className="text-left p-2">Asset</th>
                  <th className="text-right p-2">Current %</th>
                  <th className="text-right p-2">New %</th>
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset, i) => (
                  <tr
                    key={`${asset.address}-${i}`}
                    className={`border-t border-border-light ${asset.isNew ? 'bg-green-50/30' : ''}`}
                    data-testid="rebalance-row"
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-secondary">{asset.symbol}</span>
                        {asset.isNew && <span className="text-green-600 text-xs">new</span>}
                      </div>
                    </td>
                    <td className="p-2 text-right text-text-muted font-mono">
                      {asset.isNew ? '—' : `${(Number(asset.currentWeight) / 1e16).toFixed(2)}%`}
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={asset.newWeight}
                        onChange={e => updateWeight(i, e.target.value)}
                        className="w-20 bg-muted border border-border-medium rounded px-2 py-1 text-right text-text-primary font-mono text-sm focus:border-zinc-600 focus:outline-none"
                        disabled={isWorking || status === 'success'}
                        data-testid="rebalance-weight-input"
                      />
                    </td>
                    <td className="p-2 text-center">
                      {asset.isNew && !isWorking && status !== 'success' && (
                        <button
                          onClick={() => removeAsset(i)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          x
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
            <label className="text-xs text-text-secondary mb-1 block">Rebalance Note</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Reason for rebalance (optional)"
              className="w-full border border-border-medium rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-text-muted"
              disabled={isWorking || status === 'success'}
              data-testid="rebalance-note"
            />
          </div>

          {/* Status */}
          {status === 'switching-chain' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-700 text-sm">
              Switching to Settlement chain...
            </div>
          )}
          {status === 'requesting' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-700 text-sm">
              Confirm in your wallet...
            </div>
          )}
          {status === 'confirming' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-700 text-sm">
              Confirming on-chain...
            </div>
          )}
          {status === 'error' && error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm break-all">
              {error}
            </div>
          )}
          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm" data-testid="rebalance-success">
              <p className="font-medium mb-1">Rebalance request submitted.</p>
              {txHash && (
                <a
                  href={getTxUrl(txHash, 'settlement')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono break-all text-green-600 hover:text-green-800 transition-colors"
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
            className="w-full py-3 bg-zinc-900 text-white font-medium rounded-lg text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'requesting' ? 'Waiting for wallet...'
              : status === 'confirming' ? 'Confirming...'
              : status === 'success' ? 'Rebalanced!'
              : 'Request Rebalance'}
          </WalletActionButton>

          {status === 'success' && (
            <button
              onClick={reset}
              className="w-full py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </section>
  )
}
