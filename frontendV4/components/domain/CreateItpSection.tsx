'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { BRIDGE_PROXY_ABI } from '@/lib/contracts/index-protocol-abi'
import { useNonceCheck } from '@/hooks/useNonceCheck'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { activeChainId } from '@/lib/wagmi'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { getCoinGeckoUrl } from '@/lib/coingecko'

const DATA_NODE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

interface CoinEntry { id: string; image: string }

// Default sample assets — overridden at runtime from /deployed-assets.json if available
const DEFAULT_SAMPLE_ASSETS = [
  { address: '0x4c5859f0f772848b2d91f1d83e2fe57935348029', symbol: 'BTC' },
  { address: '0x1291be112d480055dafd8a610b7d1e203891c274', symbol: 'ETH' },
  { address: '0x5f3f1dbd7b74c6b46e8c44f98792a1daf8d69154', symbol: 'SOL' },
  { address: '0xb7278a61aa25c888815afc32ad3cc52ff24fe575', symbol: 'BNB' },
  { address: '0xcd8a1c3ba11cf5ecfa6267617243239504a98d90', symbol: 'XRP' },
  { address: '0x82e01223d51eb87e16a03e24687edf0f294da6f1', symbol: 'ADA' },
  { address: '0x2bdcc0de6be1f7d2ee689a0342d76f52e8efaba3', symbol: 'DOGE' },
  { address: '0x7969c5ed335650692bc04293b07f5bf2e7a673c0', symbol: 'DOT' },
  { address: '0x7bc06c482dead17c0e297afbc32f6e63d3846650', symbol: 'LINK' },
  { address: '0xc351628eb244ec633d5f21fbd6621e1a683b1181', symbol: 'AVAX' },
]

/** Tiny coin logo — loads CoinGecko image with graceful fallback */
function CoinLogo({ symbol, coinMap, size = 20 }: { symbol: string; coinMap: Record<string, CoinEntry>; size?: number }) {
  const entry = coinMap[symbol.toUpperCase()]
  if (!entry?.image) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-muted text-text-muted font-mono text-[9px] flex-shrink-0"
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      src={entry.image}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full flex-shrink-0 object-cover"
      onError={(e) => {
        const span = document.createElement('span')
        span.className = 'inline-flex items-center justify-center rounded-full bg-muted text-text-muted font-mono text-[9px]'
        span.style.width = `${size}px`
        span.style.height = `${size}px`
        span.textContent = symbol.slice(0, 2)
        ;(e.target as HTMLElement).replaceWith(span)
      }}
    />
  )
}

interface AssetWeight {
  address: string
  symbol: string
  weight: number
}

interface CreateItpSectionProps {
  expanded: boolean
  onToggle: () => void
  initialHoldings?: { symbol: string; weight: number }[] | null
}

export function CreateItpSection({ expanded, onToggle, initialHoldings }: CreateItpSectionProps) {
  const { address, isConnected } = useAccount()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [selectedAssets, setSelectedAssets] = useState<AssetWeight[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [availableAssets, setAvailableAssets] = useState<{ address: string; symbol: string }[]>(DEFAULT_SAMPLE_ASSETS)
  const [coinMap, setCoinMap] = useState<Record<string, CoinEntry>>({})

  const { writeContract, data: hash, isPending, error: writeError, reset: resetWrite } = useChainWriteContract()
  const { isLoading: isConfirming, isSuccess, error: confirmError } = useWaitForTransactionReceipt({ hash, chainId: activeChainId })
  const { hasNonceGap, pendingCount, refresh: refreshNonce } = useNonceCheck()
  const [stuckWarning, setStuckWarning] = useState(false)

  // Load full asset list from deployed-assets.json on mount
  useEffect(() => {
    fetch('/deployed-assets.json')
      .then(res => res.ok ? res.json() : Promise.reject('not found'))
      .then((data: { address: string; symbol: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableAssets(data)
        }
      })
      .catch(() => {
        // Fall back to DEFAULT_SAMPLE_ASSETS (already set as initial state)
      })
  }, [])

  // Load symbol → {id, image} mapping for logos from static coin-map
  useEffect(() => {
    fetch('/coin-map.json', { signal: AbortSignal.timeout(10_000) })
      .then(res => res.ok ? res.json() : Promise.reject('not found'))
      .then((data: Record<string, CoinEntry>) => setCoinMap(data))
      .catch(() => { /* logos won't show — acceptable fallback */ })
  }, [])

  // Pre-populate from backtester when initialHoldings changes
  useEffect(() => {
    if (!initialHoldings || initialHoldings.length === 0 || availableAssets.length === 0) return

    const mapped: AssetWeight[] = []
    for (const h of initialHoldings) {
      const asset = availableAssets.find(a => a.symbol.toUpperCase() === h.symbol.toUpperCase())
      if (asset) {
        mapped.push({ address: asset.address, symbol: asset.symbol, weight: Math.round(h.weight) })
      }
    }
    // Only take first 100 (CreateITP limit)
    const capped = mapped.slice(0, 100)
    if (capped.length > 0) {
      // Normalize weights to sum to 100
      const rawSum = capped.reduce((s, a) => s + a.weight, 0)
      if (rawSum > 0) {
        const normalized = capped.map((a, i) => {
          const w = Math.floor((a.weight / rawSum) * 100)
          return { ...a, weight: w }
        })
        // Fix rounding: distribute remainder to first asset
        const normalizedSum = normalized.reduce((s, a) => s + a.weight, 0)
        if (normalizedSum !== 100 && normalized.length > 0) {
          normalized[0].weight += 100 - normalizedSum
        }
        setSelectedAssets(normalized)
      }
    }
  }, [initialHoldings, availableAssets])

  const totalWeight = selectedAssets.reduce((sum, a) => sum + a.weight, 0)
  const isValidWeights = totalWeight === 100

  const filteredAssets = availableAssets.filter(
    a => a.symbol.toLowerCase().includes(searchTerm.toLowerCase()) &&
         !selectedAssets.find(s => s.address === a.address)
  )

  const addAsset = (asset: { address: string; symbol: string }) => {
    if (selectedAssets.length >= 100) return
    setSelectedAssets([...selectedAssets, { ...asset, weight: 0 }])
  }

  const removeAsset = (address: string) => {
    setSelectedAssets(selectedAssets.filter(a => a.address !== address))
  }

  const updateWeight = (address: string, weight: number) => {
    setSelectedAssets(selectedAssets.map(a =>
      a.address === address ? { ...a, weight: Math.min(100, Math.max(0, weight)) } : a
    ))
  }

  const distributeEvenly = () => {
    if (selectedAssets.length === 0) return
    const evenWeight = Math.floor(100 / selectedAssets.length)
    const remainder = 100 - (evenWeight * selectedAssets.length)
    setSelectedAssets(selectedAssets.map((a, i) => ({
      ...a,
      weight: evenWeight + (i === 0 ? remainder : 0)
    })))
  }

  const [isFetchingPrices, setIsFetchingPrices] = useState(false)

  const handleSubmit = async () => {
    if (!isConnected || !name || !symbol || selectedAssets.length === 0 || !isValidWeights) {
      setTxError('Please fill in all fields and ensure weights sum to 100%')
      return
    }

    // Reset any stale state from previous attempts
    resetWrite()
    setTxError(null)
    const weights = selectedAssets.map(a => BigInt(a.weight) * BigInt(1e16))
    const assets = selectedAssets.map(a => a.address as `0x${string}`)

    // Fetch real prices from AP proxy
    setIsFetchingPrices(true)
    let prices: bigint[]
    try {
      const query = `?addresses=${assets.join(',')}`
      console.log('[CreateITP] Fetching prices:', `${DATA_NODE_URL}/prices-by-address${query}`)
      const res = await fetch(`${DATA_NODE_URL}/prices-by-address${query}`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`AP returned ${res.status}`)
      const data = await res.json()
      console.log('[CreateITP] Price response:', data)
      const priceMap: Record<string, string> = {}
      for (const [addr, entry] of Object.entries(data.prices || {})) {
        priceMap[addr.toLowerCase()] = (entry as any).price
      }
      // Map each asset to its real price — error if any is missing
      prices = assets.map((addr, i) => {
        const p = priceMap[addr.toLowerCase()]
        if (!p || p === '0') {
          throw new Error(`No price for ${selectedAssets[i].symbol} (${addr})`)
        }
        return BigInt(p)
      })
    } catch (e: any) {
      setIsFetchingPrices(false)
      setTxError(`Failed to fetch prices: ${e.message || 'AP unreachable'}`)
      return
    }
    setIsFetchingPrices(false)

    try {
      console.log('[CreateITP] Submitting tx:', {
        bridgeProxy: INDEX_PROTOCOL.bridgeProxy,
        name, symbol,
        assetsCount: assets.length,
        weightsSum: weights.reduce((a, b) => a + b, 0n).toString(),
        prices: prices.map(p => p.toString()),
      })
      writeContract({
        address: INDEX_PROTOCOL.bridgeProxy,
        abi: BRIDGE_PROXY_ABI,
        functionName: 'requestCreateItp',
        args: [name, symbol, weights, assets, prices],
      })
    } catch (e: any) {
      console.error('[CreateITP] writeContract threw:', e)
      setTxError(e.message || 'Failed to submit transaction')
    }
  }

  useEffect(() => {
    if (writeError) {
      console.error('[CreateITP] writeError:', writeError)
      // Extract short cause from nested errors
      const msg = writeError.message || 'Transaction failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)
    }
  }, [writeError])

  useEffect(() => {
    if (confirmError) {
      console.error('[CreateITP] confirmError:', confirmError)
      setTxError(confirmError.message?.slice(0, 200) || 'Confirmation failed')
    }
  }, [confirmError])

  useEffect(() => {
    if (isSuccess) {
      refreshNonce()
      setName('')
      setSymbol('')
      setSelectedAssets([])
      setStuckWarning(false)
    }
  }, [isSuccess, refreshNonce])

  // Detect stuck transactions — warn after 30s of confirming
  useEffect(() => {
    if (!isConfirming) {
      setStuckWarning(false)
      return
    }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isConfirming])

  const handleCancel = useCallback(() => {
    resetWrite()
    setTxError(null)
    setStuckWarning(false)
    refreshNonce()
  }, [resetWrite, refreshNonce])

  return (
    <div id="create-itp">
      {/* Section header — always visible */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-2">Create Index</p>
        <h2 className="text-2xl font-semibold text-text-primary mb-6">Create ITP</h2>
      </div>

      {/* Collapsed toggle button */}
      {!expanded && (
        <button
          onClick={onToggle}
          className="w-full bg-card rounded-xl shadow-card border border-border-light p-4 hover:shadow-card-hover cursor-pointer text-left flex justify-between items-center"
        >
          <div>
            <span className="text-sm text-text-secondary">Create an Index Tracking Product with custom weights</span>
          </div>
          <span className="text-text-muted text-2xl">+</span>
        </button>
      )}

      {expanded && (
        <div>
          {/* Collapse toggle */}
          <div className="flex justify-end mb-4">
            <button
              onClick={onToggle}
              className="text-text-muted hover:text-text-secondary text-2xl leading-none"
              aria-label="Collapse"
            >
              −
            </button>
          </div>

          <div className="bg-card rounded-xl shadow-card border border-border-light p-8">
            {!isConnected ? (
              <div className="py-8 text-center">
                <p className="text-text-secondary">Connect your wallet to create an ITP</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Name + Symbol */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5 block">
                      ITP Name (max 32)
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, 32))}
                      placeholder="e.g., DeFi Blue Chips"
                      className="w-full bg-muted border border-border-medium text-text-primary rounded-lg px-4 py-2 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5 block">
                      Symbol (max 10)
                    </label>
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))}
                      placeholder="e.g., DEFI"
                      className="w-full bg-muted border border-border-medium text-text-primary rounded-lg px-4 py-2 focus:border-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Asset selector */}
                <div className="bg-muted border border-border-light rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                      Select Assets ({selectedAssets.length}/100 from {availableAssets.length})
                    </label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search..."
                      className="bg-card border border-border-medium rounded-lg px-3 py-1 text-sm text-text-primary w-32 focus:outline-none focus:border-zinc-400"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
                    {filteredAssets.map(asset => (
                      <span key={asset.address} className="inline-flex items-center gap-1.5 bg-card text-text-primary border border-border-light rounded-lg px-2.5 py-1.5 text-xs hover:border-border-medium hover:shadow-sm transition-all">
                        <button
                          onClick={() => addAsset(asset)}
                          className="inline-flex items-center gap-1.5"
                        >
                          <CoinLogo symbol={asset.symbol} coinMap={coinMap} size={18} />
                          <span className="font-medium">{asset.symbol}</span>
                        </button>
                        <a
                          href={getCoinGeckoUrl(asset.symbol)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-text-muted hover:text-text-primary transition-colors"
                          title={`View ${asset.symbol} on CoinGecko`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                          </svg>
                        </a>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Asset weights — horizontal scrollable columns of 10 */}
                {selectedAssets.length > 0 && (
                  <div className="bg-muted border border-border-light rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                        Asset Weights ({selectedAssets.length} assets)
                      </label>
                      <button
                        onClick={distributeEvenly}
                        className="text-xs text-text-secondary hover:bg-card border border-border-light rounded-lg px-2.5 py-1 transition-colors"
                      >
                        Distribute Evenly
                      </button>
                    </div>
                    <div className="overflow-x-auto pb-2">
                      <div className="flex gap-4" style={{ minWidth: 'min-content' }}>
                        {/* Split assets into columns of 10 */}
                        {Array.from({ length: Math.ceil(selectedAssets.length / 10) }, (_, colIdx) => (
                          <div key={colIdx} className="flex-shrink-0 space-y-1.5" style={{ width: '360px' }}>
                            {selectedAssets.slice(colIdx * 10, (colIdx + 1) * 10).map(asset => (
                              <div key={asset.address} className="flex items-center gap-2 bg-card rounded-lg px-2 py-1.5 border border-border-light">
                                <CoinLogo symbol={asset.symbol} coinMap={coinMap} size={18} />
                                <span className="w-12 text-text-primary font-mono text-xs tabular-nums truncate">{asset.symbol}</span>
                                <a
                                  href={getCoinGeckoUrl(asset.symbol)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
                                  title={`View ${asset.symbol} on CoinGecko`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                                  </svg>
                                </a>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={asset.weight}
                                  onChange={(e) => updateWeight(asset.address, Number(e.target.value))}
                                  className="flex-1 accent-zinc-900"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={asset.weight}
                                  onChange={(e) => updateWeight(asset.address, Number(e.target.value))}
                                  className="w-12 bg-muted border border-border-medium rounded px-1.5 py-0.5 text-text-primary text-center text-xs font-mono tabular-nums focus:outline-none focus:border-zinc-400"
                                />
                                <span className="text-text-muted text-xs">%</span>
                                <button
                                  onClick={() => removeAsset(asset.address)}
                                  className="text-text-muted hover:text-color-down transition-colors text-xs ml-auto"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={`mt-3 pt-3 border-t border-border-light flex justify-between text-sm ${isValidWeights ? 'text-color-up' : 'text-color-down'}`}>
                      <span>Total:</span>
                      <span className="font-mono tabular-nums font-medium">{totalWeight}% {isValidWeights ? '✓' : '(must be 100%)'}</span>
                    </div>
                  </div>
                )}

                {/* Nonce gap warning */}
                {hasNonceGap && (
                  <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                    <p className="font-medium">Pending Transactions Detected</p>
                    <p className="text-xs mt-1">You have {pendingCount} pending transaction(s). New transactions may get stuck.</p>
                  </div>
                )}

                {/* Submit */}
                <WalletActionButton
                  onClick={handleSubmit}
                  disabled={!name || !symbol || selectedAssets.length === 0 || !isValidWeights || isPending || isConfirming || isFetchingPrices || hasNonceGap}
                  className="w-full py-2.5 bg-zinc-900 text-white font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isFetchingPrices ? 'Fetching prices...' : isPending ? 'Waiting for wallet...' : isConfirming ? 'Confirming...' : 'Create ITP Request'}
                </WalletActionButton>

                {(isPending || isConfirming) && (
                  <button
                    onClick={handleCancel}
                    className="w-full text-center text-sm text-text-muted hover:text-text-secondary py-2 transition-colors"
                  >
                    Cancel
                  </button>
                )}

                {/* Stuck transaction warning */}
                {stuckWarning && (
                  <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                    <p className="font-medium">Transaction may be stuck</p>
                    <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
                  </div>
                )}

                {/* Error */}
                {txError && (
                  <div className="bg-color-down/10 border border-color-down/30 rounded-lg p-3 text-color-down text-xs break-all">
                    {txError}
                  </div>
                )}

                {/* Success */}
                {isSuccess && (
                  <div className="bg-color-up/10 border border-color-up/30 rounded-lg p-3 text-color-up text-xs">
                    <p className="font-medium">ITP Request Created!</p>
                    <p className="mt-1">Waiting for issuer consensus...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
