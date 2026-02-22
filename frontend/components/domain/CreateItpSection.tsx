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
import { DATA_NODE_URL } from '@/lib/config'
import { useDeployerName } from '@/hooks/useDeployerName'

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
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [issuerName, setIssuerName] = useState('')
  const [selectedAssets, setSelectedAssets] = useState<AssetWeight[]>(() => {
    const n = DEFAULT_SAMPLE_ASSETS.length
    const w = Math.floor(100 / n)
    const remainder = 100 - w * n
    return DEFAULT_SAMPLE_ASSETS.map((a, i) => ({ ...a, weight: w + (i === 0 ? remainder : 0) }))
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [availableAssets, setAvailableAssets] = useState<{ address: string; symbol: string }[]>(DEFAULT_SAMPLE_ASSETS)
  const [coinMap, setCoinMap] = useState<Record<string, CoinEntry>>({})
  const { name: existingDeployerName, refetch: refetchDeployerName } = useDeployerName(address as `0x${string}` | undefined)
  const needsIssuerName = isConnected && !existingDeployerName

  const { writeContract, data: hash, isPending, error: writeError, reset: resetWrite } = useChainWriteContract()
  const { isLoading: isConfirming, isSuccess, error: confirmError } = useWaitForTransactionReceipt({ hash, chainId: activeChainId })
  const { hasNonceGap, pendingCount, refresh: refreshNonce } = useNonceCheck()
  const [stuckWarning, setStuckWarning] = useState(false)
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)

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

  const [isFetchingMcap, setIsFetchingMcap] = useState(false)

  const distributeByMcap = async () => {
    if (selectedAssets.length === 0) return
    setIsFetchingMcap(true)
    try {
      const addresses = selectedAssets.map(a => a.address).join(',')
      const res = await fetch(`${DATA_NODE_URL}/prices-by-address?addresses=${addresses}`, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      const priceMap: Record<string, number> = {}
      for (const [addr, entry] of Object.entries(data.prices || {})) {
        priceMap[addr.toLowerCase()] = parseFloat((entry as any).price) / 1e18
      }
      // Use price as a rough MCap proxy (higher price = larger cap for same-supply tokens)
      const withPrices = selectedAssets.map(a => ({
        ...a,
        price: priceMap[a.address.toLowerCase()] || 0,
      }))
      const totalPrice = withPrices.reduce((s, a) => s + a.price, 0)
      if (totalPrice === 0) { distributeEvenly(); return }
      const weighted = withPrices.map(a => ({
        ...a,
        weight: Math.max(1, Math.floor((a.price / totalPrice) * 100)),
      }))
      // Fix rounding
      const sum = weighted.reduce((s, a) => s + a.weight, 0)
      if (sum !== 100 && weighted.length > 0) {
        weighted[0].weight += 100 - sum
      }
      setSelectedAssets(weighted.map(({ price: _, ...rest }) => rest))
    } catch {
      distributeEvenly()
    } finally {
      setIsFetchingMcap(false)
    }
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
      // If deployer hasn't set their name yet, set it first
      if (needsIssuerName && issuerName.trim()) {
        console.log('[CreateITP] Setting deployer name:', issuerName.trim())
        writeContract({
          address: INDEX_PROTOCOL.bridgeProxy,
          abi: BRIDGE_PROXY_ABI,
          functionName: 'setDeployerName',
          args: [issuerName.trim()],
        })
        // Note: the deployer name tx will be confirmed separately.
        // For simplicity, we proceed with the create call — user can retry if name tx fails.
        refetchDeployerName()
      }

      console.log('[CreateITP] Submitting tx:', {
        bridgeProxy: INDEX_PROTOCOL.bridgeProxy,
        name, symbol,
        assetsCount: assets.length,
        weightsSum: weights.reduce((a, b) => a + b, 0n).toString(),
        prices: prices.map(p => p.toString()),
        metadata: { description, websiteUrl, videoUrl },
      })
      writeContract({
        address: INDEX_PROTOCOL.bridgeProxy,
        abi: BRIDGE_PROXY_ABI,
        functionName: 'requestCreateItp',
        args: [name, symbol, weights, assets, prices, { description, websiteUrl, videoUrl }],
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
      setDescription('')
      setWebsiteUrl('')
      setVideoUrl('')
      setIssuerName('')
      setSelectedAssets([])
      setStuckWarning(false)
      refetchDeployerName()
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
    <div id="create-itp" className="pb-10">
      {/* Section header */}
      <div className="pt-10 mb-6">
        <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-1.5">Deploy New Product</p>
        <h2 className="text-[32px] font-black tracking-[-0.02em] text-black leading-[1.1]">Create</h2>
        <p className="text-[14px] text-text-secondary mt-1.5">Build a custom index product. Select assets, set weights, and deploy on-chain.</p>
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
          <div className="flex justify-end mb-2">
            <button
              onClick={onToggle}
              className="text-text-muted hover:text-text-secondary text-2xl leading-none"
              aria-label="Collapse"
            >
              −
            </button>
          </div>

          {!isConnected ? (
            <div className="border border-border-light p-5">
              <CreateSkeleton coinMap={coinMap} />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Two-column: Select Assets | Configure Weights */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

                {/* LEFT — Select Assets */}
                <div className="border border-border-light">
                  <div className="bg-black text-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em]">
                    Select Assets ({selectedAssets.length}/100)
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-xs font-semibold text-text-muted">
                        {availableAssets.length} available
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
                </div>

                {/* RIGHT — Configure Weights */}
                <div className="border border-border-light">
                  <div className="bg-black text-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em]">
                    Configure Weights ({selectedAssets.length} assets)
                  </div>
                  <div className="p-5">
                    {selectedAssets.length === 0 ? (
                      <p className="text-sm text-text-muted py-8 text-center">Select assets to configure weights</p>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-3">
                          <label className="text-xs font-semibold text-text-primary">
                            Total: {totalWeight}%
                          </label>
                          <div className="flex gap-1.5">
                            <button
                              onClick={distributeEvenly}
                              className="text-xs text-text-secondary hover:bg-card border border-border-light rounded-lg px-2.5 py-1 transition-colors"
                            >
                              Equal
                            </button>
                            <button
                              onClick={distributeByMcap}
                              disabled={isFetchingMcap}
                              className="text-xs text-text-secondary hover:bg-card border border-border-light rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                            >
                              {isFetchingMcap ? 'Loading...' : 'MCap'}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5 max-h-80 overflow-y-auto">
                          {selectedAssets.map(asset => (
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
                        <div className={`mt-3 pt-3 border-t border-border-light flex justify-between text-sm ${isValidWeights ? 'text-color-up' : 'text-color-down'}`}>
                          <span>Total:</span>
                          <span className="font-mono tabular-nums font-medium">{totalWeight}% {isValidWeights ? '' : '(must be 100%)'}</span>
                        </div>

                        {/* Continue to finalize */}
                        <div className="flex justify-end mt-4">
                          <button
                            onClick={() => setShowFinalizeModal(true)}
                            disabled={selectedAssets.length === 0 || !isValidWeights}
                            className="bg-zinc-900 text-white font-medium rounded-lg px-6 py-2.5 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Continue →
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Status messages below the grid */}
              {(isPending || isConfirming) && (
                <button
                  onClick={handleCancel}
                  className="w-full text-center text-sm text-text-muted hover:text-text-secondary py-2 transition-colors"
                >
                  Cancel
                </button>
              )}

              {hasNonceGap && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                  <p className="font-medium">Pending Transactions Detected</p>
                  <p className="text-xs mt-1">You have {pendingCount} pending transaction(s). New transactions may get stuck.</p>
                </div>
              )}

              {stuckWarning && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                  <p className="font-medium">Transaction may be stuck</p>
                  <p className="text-xs mt-1">Not confirmed after 30s. You can cancel and try again.</p>
                </div>
              )}

              {txError && (
                <div className="bg-color-down/10 border border-color-down/30 rounded-lg p-3 text-color-down text-xs break-all">
                  {txError}
                </div>
              )}

              {isSuccess && (
                <div className="bg-color-up/10 border border-color-up/30 rounded-lg p-3 text-color-up text-xs">
                  <p className="font-medium">ITP Request Created!</p>
                  <p className="mt-1">Waiting for issuer consensus...</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <FinalizeItpModal
          name={name} setName={setName}
          symbol={symbol} setSymbol={setSymbol}
          description={description} setDescription={setDescription}
          websiteUrl={websiteUrl} setWebsiteUrl={setWebsiteUrl}
          videoUrl={videoUrl} setVideoUrl={setVideoUrl}
          issuerName={issuerName} setIssuerName={setIssuerName}
          needsIssuerName={needsIssuerName}
          selectedAssets={selectedAssets}
          onClose={() => setShowFinalizeModal(false)}
          onSubmit={handleSubmit}
          isPending={isPending}
          isConfirming={isConfirming}
          isFetchingPrices={isFetchingPrices}
          hasNonceGap={hasNonceGap}
          txError={txError}
          isSuccess={isSuccess}
          stuckWarning={stuckWarning}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}

/* ── Finalize Modal ── */
interface FinalizeItpModalProps {
  name: string; setName: (v: string) => void
  symbol: string; setSymbol: (v: string) => void
  description: string; setDescription: (v: string) => void
  websiteUrl: string; setWebsiteUrl: (v: string) => void
  videoUrl: string; setVideoUrl: (v: string) => void
  issuerName: string; setIssuerName: (v: string) => void
  needsIssuerName: boolean
  selectedAssets: AssetWeight[]
  onClose: () => void
  onSubmit: () => void
  isPending: boolean
  isConfirming: boolean
  isFetchingPrices: boolean
  hasNonceGap: boolean
  txError: string | null
  isSuccess: boolean
  stuckWarning: boolean
  onCancel: () => void
}

function FinalizeItpModal({
  name, setName, symbol, setSymbol, description, setDescription,
  websiteUrl, setWebsiteUrl, videoUrl, setVideoUrl,
  issuerName, setIssuerName, needsIssuerName, selectedAssets,
  onClose, onSubmit, isPending, isConfirming, isFetchingPrices,
  hasNonceGap, txError, isSuccess, stuckWarning, onCancel,
}: FinalizeItpModalProps) {
  const isValidForm = name.length > 0 && symbol.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border-light">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Finalize ITP</h3>
            <p className="text-xs text-text-muted mt-0.5">{selectedAssets.length} assets selected</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Name + Symbol */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5 block">Name (max 32)</label>
              <input
                type="text" value={name}
                onChange={(e) => setName(e.target.value.slice(0, 32))}
                placeholder="e.g., DeFi Blue Chips"
                className="w-full bg-muted border border-border-medium text-text-primary rounded-lg px-4 py-2 focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5 block">Symbol (max 10)</label>
              <input
                type="text" value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="e.g., DEFI"
                className="w-full bg-muted border border-border-medium text-text-primary rounded-lg px-4 py-2 focus:border-zinc-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Issuer Name */}
          {needsIssuerName && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5 block">Issuer Name (max 64)</label>
              <input
                type="text" value={issuerName}
                onChange={(e) => setIssuerName(e.target.value.slice(0, 64))}
                placeholder="e.g., Vanguard Labs"
                className="w-full bg-muted border border-border-medium text-text-primary rounded-lg px-4 py-2 focus:border-zinc-400 focus:outline-none"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5 block">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 280))}
              placeholder="Brief description shown on ITP cards"
              rows={2}
              className="w-full bg-muted border border-border-medium text-text-primary rounded-lg px-4 py-2 focus:border-zinc-400 focus:outline-none resize-none"
            />
            <span className="text-[10px] text-text-muted">{description.length}/280</span>
          </div>

          {/* Website + Video */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5 block">Website (optional)</label>
              <input
                type="url" value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value.slice(0, 128))}
                placeholder="https://yoursite.io"
                className="w-full bg-muted border border-border-medium text-text-primary rounded-lg px-4 py-2 focus:border-zinc-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5 block">Video (optional)</label>
              <input
                type="url" value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value.slice(0, 256))}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-muted border border-border-medium text-text-primary rounded-lg px-4 py-2 focus:border-zinc-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Status messages */}
          {txError && (
            <div className="bg-color-down/10 border border-color-down/30 rounded-lg p-3 text-color-down text-xs break-all">{txError}</div>
          )}
          {stuckWarning && (
            <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-xs">
              Transaction may be stuck. <button onClick={onCancel} className="underline">Cancel</button>
            </div>
          )}
          {isSuccess && (
            <div className="bg-color-up/10 border border-color-up/30 rounded-lg p-3 text-color-up text-xs">
              <p className="font-medium">ITP Request Created!</p>
              <p className="mt-1">Waiting for issuer consensus...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-light flex justify-between items-center">
          <button onClick={onClose} className="text-sm text-text-muted hover:text-text-secondary transition-colors">
            Back
          </button>
          <WalletActionButton
            onClick={onSubmit}
            disabled={!isValidForm || isPending || isConfirming || isFetchingPrices || hasNonceGap}
            className="bg-zinc-900 text-white font-medium rounded-lg px-6 py-2.5 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isFetchingPrices ? 'Fetching prices...' : isPending ? 'Waiting for wallet...' : isConfirming ? 'Confirming...' : 'Finalize & Deploy'}
          </WalletActionButton>
        </div>
      </div>
    </div>
  )
}

/* ── Skeleton ── */
function Bone({ w = 'w-20', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-border-light rounded animate-pulse`} />
}

const SKELETON_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'DOT', 'LINK', 'AVAX']

function CreateSkeleton({ coinMap }: { coinMap: Record<string, CoinEntry> }) {
  return (
    <div className="space-y-4">
      {/* Name + Symbol fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5">ITP Name (max 32)</p>
          <div className="w-full h-[38px] bg-muted border border-border-medium rounded-lg animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5">Symbol (max 10)</p>
          <div className="w-full h-[38px] bg-muted border border-border-medium rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Two-column: Select Assets | Configure Weights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* LEFT — Select Assets */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em]">
            Select Assets (0/100)
          </div>
          <div className="p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-muted">— available</span>
              <div className="w-32 h-[30px] bg-card border border-border-medium rounded-lg animate-pulse" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SKELETON_SYMBOLS.map(sym => (
                <span key={sym} className="inline-flex items-center gap-1.5 bg-card text-text-primary border border-border-light rounded-lg px-2.5 py-1.5 text-xs opacity-50">
                  <CoinLogo symbol={sym} coinMap={coinMap} size={18} />
                  <span className="font-medium">{sym}</span>
                </span>
              ))}
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="h-[30px] bg-border-light rounded-lg animate-pulse" style={{ width: `${56 + (i % 3) * 12}px` }} />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Configure Weights */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em]">
            Configure Weights
          </div>
          <div className="p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-muted">Total: —%</span>
              <Bone w="w-28" h="h-6" />
            </div>
            <div className="space-y-1.5">
              {SKELETON_SYMBOLS.slice(0, 5).map(sym => (
                <div key={sym} className="flex items-center gap-2 bg-card rounded-lg px-2 py-1.5 border border-border-light opacity-50">
                  <CoinLogo symbol={sym} coinMap={coinMap} size={18} />
                  <span className="w-12 text-text-primary font-mono text-xs">{sym}</span>
                  <div className="flex-1 h-1.5 bg-border-light rounded animate-pulse" />
                  <Bone w="w-12" h="h-5" />
                  <span className="text-text-muted text-xs">%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
