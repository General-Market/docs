'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useWaitForTransactionReceipt, useSwitchChain, useWriteContract, usePublicClient } from 'wagmi'
import { decodeEventLog } from 'viem'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { INDEX_CREATE_ITP_ABI, BRIDGE_NONCE_SENTINEL } from '@/lib/contracts/index-protocol-abi'
import { useNonceCheck } from '@/hooks/useNonceCheck'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { ensureCorrectChain } from '@/hooks/useChainWrite'
import { activeChainId, indexL3 } from '@/lib/wagmi'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { getCoinGeckoUrl } from '@/lib/coingecko'
import { DATA_NODE_URL } from '@/lib/config'
import { useSSENav } from '@/hooks/useSSE'
import { useTranslations } from 'next-intl'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { SpringCard, SpringModal, SpringBackdrop, springs } from '@/components/ui/spring'

interface CoinEntry { id: string; image: string }

// Symbols to pre-select when the asset list loads, addresses resolved dynamically from deployed-assets.json
const DEFAULT_PRESELECT_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'DOT', 'LINK', 'AVAX']

/** Tiny coin logo, loads CoinGecko image with graceful fallback */
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
  const t = useTranslations('create-itp')
  const tc = useTranslations('common')
  const { address, isConnected, chainId: currentChainId } = useAccount()
  const { capture } = usePostHogTracker()
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [selectedAssets, setSelectedAssets] = useState<AssetWeight[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  const [availableAssets, setAvailableAssets] = useState<{ address: string; symbol: string }[]>([])
  const [coinMap, setCoinMap] = useState<Record<string, CoinEntry>>({})

  const { switchChainAsync } = useSwitchChain()
  const l3PublicClient = usePublicClient({ chainId: activeChainId })
  const { writeContract, writeContractAsync, data: hash, isPending, error: writeError, reset: resetWrite } = useWriteContract()
  const { data: receipt, isLoading: isConfirming, isSuccess, error: confirmError } = useWaitForTransactionReceipt({ hash, chainId: activeChainId })
  // Decoded itpId from the ITPCreated log — used to render a "View ITP" link.
  const [createdItpId, setCreatedItpId] = useState<string | null>(null)

  // Toast notifications for ITP creation (direct call on L3, no bridge)
  useTransactionNotification({
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: (writeError || confirmError) as Error | null,
    label: 'Create ITP',
    chain: 'l3',
  })

  const { hasNonceGap, pendingCount, refresh: refreshNonce } = useNonceCheck()
  const [stuckWarning, setStuckWarning] = useState(false)
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)

  // Oracle consensus polling, track L3 ITP count before/after submission
  const [itpCountBefore, setItpCountBefore] = useState<number | null>(null)
  const [consensusReached, setConsensusReached] = useState(false)
  const sseNavs = useSSENav()

  // Load full asset list from deployed-assets.json on mount
  useEffect(() => {
    fetch('/deployed-assets.json')
      .then(res => res.ok ? res.json() : Promise.reject('not found'))
      .then((data: { address: string; symbol: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          // Deduplicate by symbol, keep first occurrence
          const seen = new Set<string>()
          const unique = data.filter(a => {
            const key = a.symbol.toUpperCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          setAvailableAssets(unique)
          // Pre-select default symbols with equal weights (only if no selection yet)
          setSelectedAssets(prev => {
            if (prev.length > 0) return prev
            const preselected = DEFAULT_PRESELECT_SYMBOLS
              .map(sym => unique.find(a => a.symbol.toUpperCase() === sym))
              .filter((a): a is { address: string; symbol: string } => !!a)
            const n = preselected.length
            if (n === 0) return prev
            const w = Math.floor(100 / n)
            const remainder = 100 - w * n
            return preselected.map((a, i) => ({ ...a, weight: w + (i === 0 ? remainder : 0) }))
          })
        }
      })
      .catch(() => { /* deployed-assets.json not available, user must select manually */ })
  }, [])

  // Load symbol → {id, image} mapping for logos from static coin-map
  useEffect(() => {
    fetch('/coin-map.json', { signal: AbortSignal.timeout(10_000) })
      .then(res => res.ok ? res.json() : Promise.reject('not found'))
      .then((data: Record<string, CoinEntry>) => setCoinMap(data))
      .catch(() => { /* logos won't show, acceptable fallback */ })
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
  const hasZeroWeight = selectedAssets.some(a => a.weight === 0)
  const isValidWeights = totalWeight === 100 && !hasZeroWeight

  const filteredAssets = availableAssets.filter(
    a => a.symbol.toLowerCase().includes(searchTerm.toLowerCase()) &&
         !selectedAssets.find(s => s.address === a.address)
  )

  const addAsset = (asset: { address: string; symbol: string }) => {
    if (selectedAssets.length >= 100) return
    const updated = [...selectedAssets, { ...asset, weight: 0 }]
    setSelectedAssets(updated)
    capture('create_itp_assets_selected', {
      asset_count: updated.length,
      asset_ids: updated.map(a => a.symbol),
    })
  }

  const removeAsset = (address: string) => {
    const updated = selectedAssets.filter(a => a.address !== address)
    setSelectedAssets(updated)
    capture('create_itp_assets_selected', {
      asset_count: updated.length,
      asset_ids: updated.map(a => a.symbol),
    })
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
    capture('create_itp_weights_set', {
      asset_count: selectedAssets.length,
      weight_distribution: 'equal',
    })
  }

  const [isFetchingMcap, setIsFetchingMcap] = useState(false)

  const distributeByMcap = async () => {
    if (selectedAssets.length === 0) return
    setIsFetchingMcap(true)
    try {
      const addresses = selectedAssets.map(a => a.address).join(',')
      const res = await fetch(`${DATA_NODE_URL}/prices-by-address?addresses=${addresses}`, { signal: AbortSignal.timeout(30_000) })
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
      capture('create_itp_weights_set', {
        asset_count: selectedAssets.length,
        weight_distribution: 'mcap',
      })
    } catch {
      distributeEvenly()
    } finally {
      setIsFetchingMcap(false)
    }
  }

  const [isFetchingPrices, setIsFetchingPrices] = useState(false)
  const [unpricedAssets, setUnpricedAssets] = useState<Set<string>>(new Set())
  const [priceCheckDone, setPriceCheckDone] = useState(false)

  // Validate prices when assets change, flag unpriced ones
  useEffect(() => {
    if (selectedAssets.length === 0) { setUnpricedAssets(new Set()); setPriceCheckDone(false); return }
    setPriceCheckDone(false)
    const controller = new AbortController()
    const check = async () => {
      try {
        const addresses = selectedAssets.map(a => a.address).join(',')
        const res = await fetch(`${DATA_NODE_URL}/prices-by-address?addresses=${addresses}`, { signal: controller.signal })
        if (!res.ok) { setPriceCheckDone(true); return }
        const data = await res.json()
        const missing = new Set<string>()
        for (const a of selectedAssets) {
          const entry = (data.prices || {})[a.address.toLowerCase()]
          if (!entry || !entry.price || entry.price === '0') {
            missing.add(a.symbol)
          }
        }
        setUnpricedAssets(missing)
        setPriceCheckDone(true)
      } catch { /* abort or network error, don't block */ }
    }
    check()
    return () => controller.abort()
  }, [selectedAssets])

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (isSubmitting || isPending || isConfirming || isSuccess) return
    if (!isConnected || !name || !symbol || selectedAssets.length === 0 || !isValidWeights) {
      setTxError(t('errors.fill_all_fields'))
      return
    }
    setIsSubmitting(true)

    // Reset any stale state from previous attempts
    resetWrite()
    setTxError(null)
    setConsensusReached(false)

    // Snapshot L3 ITP count before submitting so we can detect when oracles finalize
    try {
      const res = await fetch(`/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_call',
          params: [{ to: INDEX_PROTOCOL.index, data: '0x2fa9f978' }, 'latest'],
        }),
      })
      if (res.ok) {
        const { result } = await res.json()
        setItpCountBefore(Number(BigInt(result)))
      }
    } catch { /* non-critical, consensus polling just won't work */ }

    const weights = selectedAssets.map(a => BigInt(a.weight) * BigInt(1e16))
    const assets = selectedAssets.map(a => a.address as `0x${string}`)

    // Fetch real prices from data-node (with one retry on transient 5xx)
    setIsFetchingPrices(true)
    let prices: bigint[]
    try {
      const query = `?addresses=${assets.join(',')}`
      console.log('[CreateITP] Fetching prices:', `${DATA_NODE_URL}/prices-by-address${query}`)

      let res = await fetch(`${DATA_NODE_URL}/prices-by-address${query}`, { signal: AbortSignal.timeout(30_000) })
      // Retry once on transient 5xx (data-node may be temporarily overloaded)
      if (res.status >= 500) {
        await new Promise(r => setTimeout(r, 2_000))
        res = await fetch(`${DATA_NODE_URL}/prices-by-address${query}`, { signal: AbortSignal.timeout(30_000) })
      }
      if (!res.ok) throw new Error(`price service returned ${res.status}, please retry in a moment`)
      const data = await res.json()
      console.log('[CreateITP] Price response:', data)
      const priceMap: Record<string, string> = {}
      for (const [addr, entry] of Object.entries(data.prices || {})) {
        priceMap[addr.toLowerCase()] = (entry as any).price
      }
      // Map each asset to its real price, error if any is missing or suspiciously wrong
      prices = assets.map((addr, i) => {
        const p = priceMap[addr.toLowerCase()]
        if (!p || p === '0') {
          throw new Error(`No price for ${selectedAssets[i].symbol}, asset may not be listed yet`)
        }
        const pBn = BigInt(p)
        // Sanity: price must be > $0.0001 (1e14 in 18-dec) and < $100M (1e26)
        if (pBn < BigInt('100000000000000') || pBn > BigInt('100000000000000000000000000')) {
          throw new Error(`Price for ${selectedAssets[i].symbol} looks wrong ($${Number(pBn) / 1e18}), data feed may be stale`)
        }
        return pBn
      })
    } catch (e: any) {
      setIsFetchingPrices(false)
      setTxError(t('errors.failed_prices', { message: e.message || 'price service unreachable' }))
      capture('create_itp_failed', { error_message: e.message || 'price service unreachable', step: 'fetch_prices' })
      return
    }
    setIsFetchingPrices(false)

    try {
      // L3 direct: Investment.createITP is permissionless on L3, no bridge involved.
      // Wallet must be on L3 to sign — switch if needed.
      try {
        await ensureCorrectChain(currentChainId, switchChainAsync, activeChainId, indexL3)
      } catch {
        setTxError('Please switch to the L3 chain to create an ITP')
        return
      }

      submittedSymbolRef.current = symbol

      capture('create_itp_submitted', {
        asset_count: assets.length,
        name,
      })

      console.log('[CreateITP] Submitting tx:', {
        index: INDEX_PROTOCOL.index,
        name, symbol,
        assetsCount: assets.length,
        weightsSum: weights.reduce((a, b) => a + b, 0n).toString(),
        prices: prices.map(p => p.toString()),
      })

      // Pre-simulate on the L3 public client to catch reverts before wallet prompt.
      if (l3PublicClient) {
        try {
          await l3PublicClient.simulateContract({
            address: INDEX_PROTOCOL.index,
            abi: INDEX_CREATE_ITP_ABI,
            functionName: 'createITP',
            args: [name, symbol, weights, assets, prices, BRIDGE_NONCE_SENTINEL],
            account: address,
          })
          console.log('[CreateITP] Pre-simulation passed on L3')
        } catch (simErr: any) {
          console.error('[CreateITP] Pre-simulation failed:', simErr)
          let reason = simErr.shortMessage || simErr.message || 'Simulation failed'
          if (reason.includes('0xfb25c4bc')) reason = 'Each asset must have at least 1% weight'
          else if (reason.includes('0x3432baf7')) reason = 'System is paused'
          setTxError(reason.slice(0, 300))
          capture('create_itp_failed', { error_message: reason.slice(0, 200), step: 'pre_simulate' })
          return
        }
      }

      await writeContractAsync({
        address: INDEX_PROTOCOL.index,
        abi: INDEX_CREATE_ITP_ABI,
        functionName: 'createITP',
        args: [name, symbol, weights, assets, prices, BRIDGE_NONCE_SENTINEL],
        chainId: activeChainId,
      })
    } catch (e: any) {
      console.error('[CreateITP] writeContractAsync threw:', e)
      setTxError(e.message || 'Failed to submit transaction')
      capture('create_itp_failed', { error_message: e.message || 'writeContractAsync threw', step: 'submit' })
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (writeError) {
      console.error('[CreateITP] writeError:', writeError)
      // Extract short cause from nested errors
      const msg = writeError.message || 'Transaction failed'
      const shortMsg = msg.includes('Details:') ? msg.split('Details:')[1].trim().slice(0, 200) : msg.slice(0, 200)
      setTxError(shortMsg)
      capture('create_itp_failed', { error_message: shortMsg, step: 'write' })
    }
  }, [writeError])

  useEffect(() => {
    if (confirmError) {
      console.error('[CreateITP] confirmError:', confirmError)
      setTxError(confirmError.message?.slice(0, 200) || 'Confirmation failed')
      capture('create_itp_failed', { error_message: confirmError.message?.slice(0, 200) || 'Confirmation failed', step: 'confirm' })
    }
  }, [confirmError])

  // Track success for deferred cleanup when modal closes
  const successRef = useRef(false)

  useEffect(() => {
    if (isSuccess) {
      successRef.current = true
      capture('create_itp_completed', {
        asset_count: selectedAssets.length,
        tx_hash: hash,
      })
      refreshNonce()
      setStuckWarning(false)
    }
  }, [isSuccess, refreshNonce])

  // Pull the new itpId out of the ITPCreated log. The L3-direct path emits
  // exactly one of these per tx; first match wins.
  useEffect(() => {
    if (!isSuccess || !receipt || createdItpId) return
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== INDEX_PROTOCOL.index.toLowerCase()) continue
      try {
        const decoded = decodeEventLog({
          abi: INDEX_CREATE_ITP_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'ITPCreated') {
          setCreatedItpId(decoded.args.itpId as string)
          break
        }
      } catch { /* not the ITPCreated event, keep scanning */ }
    }
  }, [isSuccess, receipt, createdItpId])

  // Reset form when finalize modal closes after a successful deploy
  useEffect(() => {
    if (!showFinalizeModal && successRef.current) {
      successRef.current = false
      setName('')
      setSymbol('')
      setSelectedAssets([])
      resetWrite()
      setItpCountBefore(null)
      setConsensusReached(false)
      setCreatedItpId(null)
    }
  }, [showFinalizeModal, resetWrite])

  // Detect stuck transactions, warn after 30s of confirming
  useEffect(() => {
    if (!isConfirming) {
      setStuckWarning(false)
      return
    }
    const timer = setTimeout(() => setStuckWarning(true), 30_000)
    return () => clearTimeout(timer)
  }, [isConfirming])

  // Wait for new ITP to appear in the SSE listing (visible to all users)
  // Match by symbol (unique, user-provided) instead of predicting ITP ID
  const submittedSymbolRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isSuccess || consensusReached) return
    const sym = submittedSymbolRef.current
    if (!sym) return
    const found = sseNavs.find(n => n.symbol?.toUpperCase() === sym.toUpperCase())
    if (found) {
      setConsensusReached(true)
      capture('create_itp_consensus_reached', { itp_id: found.itp_id, symbol: sym })
    }
  }, [isSuccess, consensusReached, sseNavs])

  const handleCancel = useCallback(() => {
    resetWrite()
    setTxError(null)
    setStuckWarning(false)
    setItpCountBefore(null)
    setConsensusReached(false)
    submittedSymbolRef.current = null
    setIsSubmitting(false)
    refreshNonce()
  }, [resetWrite, refreshNonce])

  return (
    <div id="create-itp" className="pb-10">
      {/* Section header */}
      <div className="pt-10 mb-6">
        <p className="text-label font-semibold tracking-[0.08em] uppercase text-text-muted mb-1.5">{t('heading.label')}</p>
        <h2 className="text-display font-black tracking-tight text-black leading-[1.1]">{t('heading.title')}</h2>
        <p className="text-body text-text-secondary mt-1.5">{t('heading.description')}</p>
      </div>

      {/* Collapsed toggle button */}
      {!expanded && (
        <SpringCard className="w-full bg-card rounded-xl shadow-card border border-border-light p-4">
          <button
            onClick={onToggle}
            className="w-full hover:shadow-card-hover cursor-pointer text-left flex justify-between items-center"
          >
            <div>
              <span className="text-sm text-text-secondary">{t('collapsed.description')}</span>
            </div>
            <span className="text-text-muted text-2xl">+</span>
          </button>
        </SpringCard>
      )}

      {expanded && (
        <div>
          {/* Collapse toggle */}
          <div className="flex justify-end mb-2">
            <button
              onClick={onToggle}
              className="text-text-muted hover:text-text-secondary text-2xl leading-none"
              aria-label={tc('aria.collapse')}
            >
              −
            </button>
          </div>

          <div className="space-y-4">
              {/* Two-column: Select Assets | Configure Weights */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

                {/* LEFT, Select Assets */}
                <div className="border border-border-light">
                  <div className="bg-black text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em]">
                    {t('select_assets.title', { count: selectedAssets.length })}
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-xs font-semibold text-text-muted">
                        {t('select_assets.available', { count: availableAssets.length })}
                      </label>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={tc('actions.search')}
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
                            <span className={`font-medium ${unpricedAssets.has(asset.symbol) ? 'text-red-500' : ''}`}>{asset.symbol}</span>
                            {unpricedAssets.has(asset.symbol) && <span className="text-red-400 text-[10px]">no price</span>}
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

                {/* RIGHT, Configure Weights */}
                <div className="border border-border-light">
                  <div className="bg-black text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em]">
                    {t('configure_weights.title', { count: selectedAssets.length })}
                  </div>
                  <div className="p-5">
                    {selectedAssets.length === 0 ? (
                      <p className="text-sm text-text-muted py-8 text-center">{t('configure_weights.empty')}</p>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-3">
                          <label className="text-xs font-semibold text-text-primary">
                            {t('configure_weights.total', { value: totalWeight })}
                          </label>
                          <div className="flex gap-1.5">
                            <button
                              onClick={distributeEvenly}
                              className="text-xs text-text-secondary hover:bg-card border border-border-light rounded-lg px-2.5 py-1 transition-colors"
                            >
                              {t('configure_weights.equal')}
                            </button>
                            <button
                              onClick={distributeByMcap}
                              disabled={isFetchingMcap}
                              className="text-xs text-text-secondary hover:bg-card border border-border-light rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                            >
                              {isFetchingMcap ? t('configure_weights.mcap_loading') : t('configure_weights.mcap')}
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
                                inputMode="numeric"
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
                        {(() => {
                          const missingPriceCount = priceCheckDone ? unpricedAssets.size : 0
                          const gateOpen = isValidWeights && missingPriceCount === 0
                          const reason = !isValidWeights
                            ? (hasZeroWeight ? 'No 0% weights' : t('configure_weights.must_be_100'))
                            : missingPriceCount > 0
                              ? `${missingPriceCount} asset${missingPriceCount === 1 ? ' has' : 's have'} no price — remove to continue`
                              : ''
                          return (
                            <div className={`mt-3 pt-3 border-t border-border-light flex justify-between text-sm ${gateOpen ? 'text-color-up' : 'text-color-down'}`}>
                              <span>{t('configure_weights.total', { value: totalWeight })}</span>
                              <span className="font-mono tabular-nums font-medium">{reason}</span>
                            </div>
                          )
                        })()}

                        {/* Continue to finalize */}
                        <div className="flex justify-end mt-4">
                          <button
                            onClick={() => setShowFinalizeModal(true)}
                            disabled={selectedAssets.length === 0 || !isValidWeights || (priceCheckDone && unpricedAssets.size > 0)}
                            className="bg-zinc-900 text-white font-medium rounded-lg px-6 py-2.5 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('configure_weights.continue')}
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
                  {tc('actions.cancel')}
                </button>
              )}

              {hasNonceGap && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                  <p className="font-medium">{tc('warnings.pending_tx_title')}</p>
                  <p className="text-xs mt-1">{tc('warnings.pending_tx_description', { count: pendingCount })}</p>
                </div>
              )}

              {stuckWarning && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-sm">
                  <p className="font-medium">{tc('warnings.tx_stuck_title')}</p>
                  <p className="text-xs mt-1">{tc('warnings.tx_stuck_description')}</p>
                </div>
              )}

              {txError && (
                <div className="bg-color-down/10 border border-color-down/30 rounded-lg p-3 text-color-down text-xs break-all">
                  {txError}
                </div>
              )}

              {isSuccess && (
                <div className={`${consensusReached ? 'bg-color-up/10 border-color-up/30' : 'bg-amber-500/10 border-amber-500/30'} border rounded-lg p-3 text-xs`}>
                  <p className={`font-medium ${consensusReached ? 'text-color-up' : 'text-amber-600'}`}>
                    {consensusReached ? t('success.consensus_title') : t('success.title')}
                  </p>
                  <p className={`mt-1 ${consensusReached ? 'text-color-up' : 'text-amber-600'}`}>
                    {consensusReached ? t('success.consensus_description') : t('success.description')}
                  </p>
                </div>
              )}
            </div>
        </div>
      )}

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <FinalizeItpModal
          name={name} setName={setName}
          symbol={symbol} setSymbol={setSymbol}
          selectedAssets={selectedAssets}
          onClose={() => setShowFinalizeModal(false)}
          onSubmit={handleSubmit}
          isPending={isPending}
          isConfirming={isConfirming}
          isFetchingPrices={isFetchingPrices}
          hasNonceGap={hasNonceGap}
          txError={txError}
          isSuccess={isSuccess}
          createdItpId={createdItpId}
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
  selectedAssets: AssetWeight[]
  onClose: () => void
  onSubmit: () => void
  isPending: boolean
  isConfirming: boolean
  isFetchingPrices: boolean
  hasNonceGap: boolean
  txError: string | null
  isSuccess: boolean
  createdItpId: string | null
  stuckWarning: boolean
  onCancel: () => void
}

function FinalizeItpModal({
  name, setName, symbol, setSymbol, selectedAssets,
  onClose, onSubmit, isPending, isConfirming, isFetchingPrices,
  hasNonceGap, txError, isSuccess, createdItpId, stuckWarning, onCancel,
}: FinalizeItpModalProps) {
  const t = useTranslations('create-itp')
  const tc = useTranslations('common')
  const isValidForm = name.length > 0 && symbol.length > 0
  const isDeploying = isPending || isConfirming || isFetchingPrices
  const formLocked = isDeploying || isSuccess
  // Mirror name → symbol until the user edits symbol manually. Saves a step
  // and stops the silent disabled-button trap when symbol is left blank.
  const [symbolEdited, setSymbolEdited] = useState(symbol.length > 0)
  const handleNameChange = (value: string) => {
    const next = value.slice(0, 32)
    setName(next)
    if (!symbolEdited) {
      setSymbol(next.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))
    }
  }
  const handleSymbolChange = (value: string) => {
    setSymbolEdited(true)
    setSymbol(value.toUpperCase().slice(0, 10))
  }
  const missingReason = !name.length
    ? t('finalize.name_label')
    : !symbol.length
      ? t('finalize.symbol_label')
      : null

  // Mobile: lock body scroll while the modal is open and snap the viewport to
  // top. Without this the page underneath stays where the user was scrolled and
  // a fixed-positioned modal can fall outside the visible viewport — especially
  // when the iOS URL bar is collapsed.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const prevScrollY = window.scrollY
    const prevBodyOverflow = document.body.style.overflow
    window.scrollTo({ top: 0 })
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBodyOverflow
      window.scrollTo({ top: prevScrollY })
    }
  }, [])

  const itpHref = createdItpId ? `/itp/${createdItpId}` : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <SpringBackdrop className="absolute inset-0 glass-overlay" onClick={onClose} />

      {/* Modal */}
      <SpringModal className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border-light">
          <div>
            <h3 className="text-lg font-bold text-text-primary">{t('finalize.title')}</h3>
            <p className="text-xs text-text-muted mt-0.5">{t('finalize.assets_selected', { count: selectedAssets.length })}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">×</button>
        </div>

        {/* Status panel — bounded, no negative margins, lives between header and form */}
        {(isDeploying || isSuccess) && (
          <CreateStatusPanel
            isFetchingPrices={isFetchingPrices}
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
            symbol={symbol}
          />
        )}

        {/* Form */}
        <div className={`p-6 space-y-4 transition-opacity duration-300 ${formLocked ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* Name + Symbol */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-1.5 block">{t('finalize.name_label')}</label>
              <input
                type="text" value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('finalize.name_placeholder')}
                disabled={formLocked}
                className="w-full bg-muted border border-border-medium text-text-primary rounded-lg px-4 py-2 focus:border-zinc-400 focus:outline-none disabled:text-text-muted"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-1.5 block">{t('finalize.symbol_label')}</label>
              <input
                type="text" value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                placeholder={t('finalize.symbol_placeholder')}
                disabled={formLocked}
                className="w-full bg-muted border border-border-medium text-text-primary rounded-lg px-4 py-2 focus:border-zinc-400 focus:outline-none disabled:text-text-muted"
              />
            </div>
          </div>

        </div>

        {/* Status messages, outside the greyed form area */}
        <div className="px-6 space-y-3">
          {txError && (
            <div className="bg-color-down/10 border border-color-down/30 rounded-lg p-3 text-color-down text-xs break-all">{txError}</div>
          )}
          {stuckWarning && (
            <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3 text-orange-400 text-xs">
              {t('finalize.tx_stuck')} <button onClick={onCancel} className="underline">{tc('actions.cancel')}</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-light flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 mt-3">
          <button onClick={onClose} className="text-sm text-text-muted hover:text-text-secondary transition-colors self-start">
            {tc('actions.back')}
          </button>
          {isSuccess ? (
            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              {itpHref && (
                <Link
                  href={itpHref}
                  onClick={onClose}
                  className="flex-1 sm:flex-none text-center bg-zinc-900 text-white font-medium rounded-lg px-5 py-2.5 hover:bg-zinc-800 transition-colors fluid-press"
                >
                  See my ITP →
                </Link>
              )}
              <button
                onClick={onClose}
                className={`${itpHref ? 'border border-border-medium text-text-secondary hover:text-text-primary' : 'bg-zinc-900 text-white hover:bg-zinc-800'} font-medium rounded-lg px-5 py-2.5 transition-colors fluid-press`}
              >
                {tc('actions.close')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              {missingReason && !isDeploying && (
                <span className="text-[11px] text-text-muted">{missingReason} required</span>
              )}
              <WalletActionButton
                onClick={onSubmit}
                disabled={!isValidForm || isPending || isConfirming || isFetchingPrices || hasNonceGap}
                className="bg-zinc-900 text-white font-medium rounded-lg px-6 py-2.5 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors fluid-press"
              >
                {isFetchingPrices ? t('finalize.submit_fetching') : isPending ? t('finalize.submit_pending') : isConfirming ? t('finalize.submit_confirming') : t('finalize.submit_deploy')}
              </WalletActionButton>
            </div>
          )}
        </div>
      </SpringModal>
    </div>
  )
}

/* ── Status panel ──
 * The L3-direct path is synchronous: prices → sign → submit, done. No relay,
 * no consensus wait. This panel is bounded, lives between header and form,
 * and never overflows its container. Replaces the old orbital ring.
 */
interface CreateStatusPanelProps {
  isFetchingPrices: boolean
  isPending: boolean
  isConfirming: boolean
  isSuccess: boolean
  symbol: string
}

function CreateStatusPanel({ isFetchingPrices, isPending, isConfirming, isSuccess, symbol }: CreateStatusPanelProps) {
  const reduced = useReducedMotion()
  const phaseLabel = isSuccess
    ? 'ITP deployed'
    : isConfirming
      ? 'Awaiting block confirmation'
      : isPending
        ? 'Sign the transaction in your wallet'
        : isFetchingPrices
          ? 'Fetching live prices'
          : 'Preparing'

  return (
    <div className="px-6 py-5 border-b border-border-light flex items-center gap-4">
      <div className="relative w-10 h-10 flex-shrink-0">
        {isSuccess ? (
          <motion.svg
            viewBox="0 0 40 40"
            className="w-10 h-10"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { duration: 0 } : springs.expand}
          >
            <circle cx="20" cy="20" r="18" className="fill-emerald-500" />
            <path d="M12 20 l6 6 l11 -12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </motion.svg>
        ) : (
          <svg viewBox="0 0 40 40" className="w-10 h-10 animate-spin" style={{ animationDuration: '1.6s' }}>
            <circle cx="20" cy="20" r="16" fill="none" className="stroke-zinc-200" strokeWidth="3" />
            <path d="M20 4 a16 16 0 0 1 16 16" fill="none" className="stroke-zinc-900" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-medium ${isSuccess ? 'text-emerald-700' : 'text-text-primary'}`}>
          {phaseLabel}
        </div>
        {symbol && (
          <div className="font-mono text-xs text-text-muted tabular-nums mt-0.5 truncate">
            {symbol}
          </div>
        )}
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
  const t = useTranslations('create-itp')
  return (
    <div className="space-y-4">
      {/* Name + Symbol fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-1.5">{t('skeleton.itp_name')}</p>
          <div className="w-full h-[38px] bg-muted border border-border-medium rounded-lg animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-1.5">{t('skeleton.symbol')}</p>
          <div className="w-full h-[38px] bg-muted border border-border-medium rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Two-column: Select Assets | Configure Weights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* LEFT, Select Assets */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em]">
            {t('select_assets.skeleton_title')}
          </div>
          <div className="p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-muted">, available</span>
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

        {/* RIGHT, Configure Weights */}
        <div className="border border-border-light">
          <div className="bg-black text-white px-5 py-3 text-caption font-bold uppercase tracking-[0.08em]">
            {t('configure_weights.skeleton_title')}
          </div>
          <div className="p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-text-muted">Total:,%</span>
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
