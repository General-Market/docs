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
    // Only take first 10 (CreateITP limit)
    const capped = mapped.slice(0, 10)
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
    if (selectedAssets.length >= 10) return
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
    <div id="create-itp" className="bg-terminal-dark/50 border border-white/10 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full p-4 flex justify-between items-center text-left"
      >
        <div>
          <h2 className="text-xl font-bold text-white">Create ITP</h2>
          <p className="text-sm text-white/50">Create an Index Tracking Product with custom weights</p>
        </div>
        <span className="text-accent text-2xl">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 border-t border-white/10">
          {!isConnected ? (
            <div className="bg-terminal border border-white/10 rounded-lg p-8 text-center">
              <p className="text-white/70">Connect your wallet to create an ITP</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70 mb-2">ITP Name (max 32)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 32))}
                    placeholder="e.g., DeFi Blue Chips"
                    className="w-full bg-terminal border border-white/20 rounded px-4 py-2 text-white focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-2">Symbol (max 10)</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="e.g., DEFI"
                    className="w-full bg-terminal border border-white/20 rounded px-4 py-2 text-white focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-terminal border border-white/10 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-white/70">Select Assets ({selectedAssets.length}/10 from {availableAssets.length})</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="bg-terminal-dark border border-white/20 rounded px-3 py-1 text-sm text-white w-32"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {filteredAssets.slice(0, 8).map(asset => (
                    <div key={asset.address} className="relative group">
                      <button
                        onClick={() => addAsset(asset)}
                        className="px-3 py-1 pr-7 bg-terminal-dark border border-white/20 rounded text-sm text-white hover:border-accent transition-colors"
                      >
                        + {asset.symbol}
                      </button>
                      <a
                        href={getCoinGeckoUrl(asset.symbol)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="absolute top-0 right-0 px-1.5 py-1 text-white/30 hover:text-accent text-xs transition-colors"
                        title={`View ${asset.symbol} on CoinGecko`}
                      >
                        ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {selectedAssets.length > 0 && (
                <div className="bg-terminal border border-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-white/70">Asset Weights</span>
                    <button onClick={distributeEvenly} className="text-xs text-accent hover:text-accent/80">
                      Distribute Evenly
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedAssets.map(asset => (
                      <div key={asset.address} className="flex items-center gap-3">
                        <span className="w-14 text-white font-mono text-sm">{asset.symbol}</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={asset.weight}
                          onChange={(e) => updateWeight(asset.address, Number(e.target.value))}
                          className="flex-1 accent-accent"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={asset.weight}
                          onChange={(e) => updateWeight(asset.address, Number(e.target.value))}
                          className="w-14 bg-terminal-dark border border-white/20 rounded px-2 py-1 text-white text-center text-sm"
                        />
                        <span className="text-white/50 text-sm">%</span>
                        <button onClick={() => removeAsset(asset.address)} className="text-red-400 hover:text-red-300">×</button>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-3 pt-3 border-t border-white/10 flex justify-between text-sm ${isValidWeights ? 'text-green-400' : 'text-red-400'}`}>
                    <span>Total:</span>
                    <span className="font-bold">{totalWeight}% {isValidWeights ? '✓' : '(must be 100%)'}</span>
                  </div>
                </div>
              )}

              {hasNonceGap && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                  <p className="font-bold">Pending Transactions Detected</p>
                  <p className="text-xs mt-1">You have {pendingCount} pending transaction(s). New transactions may get stuck.</p>
                </div>
              )}

              <WalletActionButton
                onClick={handleSubmit}
                disabled={!name || !symbol || selectedAssets.length === 0 || !isValidWeights || isPending || isConfirming || isFetchingPrices || hasNonceGap}
                className="w-full py-3 bg-accent text-terminal font-bold rounded-lg hover:bg-accent/90 disabled:bg-white/20 disabled:text-white/50 disabled:cursor-not-allowed transition-colors"
              >
                {isFetchingPrices ? 'Fetching prices...' : isPending ? 'Waiting for wallet...' : isConfirming ? 'Confirming...' : 'Create ITP Request'}
              </WalletActionButton>

              {(isPending || isConfirming) && (
                <button
                  onClick={handleCancel}
                  className="w-full text-center text-sm text-white/50 hover:text-white/80 py-2 transition-colors"
                >
                  Cancel
                </button>
              )}

              {stuckWarning && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                  <p className="font-bold">Transaction may be stuck</p>
                  <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
                </div>
              )}

              {txError && (
                <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-400 text-sm break-all">
                  {txError}
                </div>
              )}

              {isSuccess && (
                <div className="bg-green-500/20 border border-green-500/50 rounded p-3 text-green-400 text-sm">
                  <p className="font-bold">ITP Request Created!</p>
                  <p className="text-xs mt-1">Waiting for issuer consensus...</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
