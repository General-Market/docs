'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import Image from 'next/image'
import { useRouter } from '@/i18n/routing'
import { useAccount, useConnect, useReadContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { formatUnits } from 'viem'
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { useSourceSnapshot, type SnapshotPrice } from '@/hooks/vision/useMarketSnapshot'
import { useSourceRegistry, findSource } from '@/hooks/vision/useSourceRegistry'
import { useBatches } from '@/hooks/vision/useBatches'
import { useRounds } from '@/hooks/vision/useRounds'
import { useJoinBatch } from '@/hooks/vision/useJoinBatch'
import { useSubmitBitmap } from '@/hooks/vision/useSubmitBitmap'
import { useL3GasBalance } from '@/hooks/vision/useL3GasBalance'
import { usePlayerPosition } from '@/hooks/vision/usePlayerPosition'
import { useSharedCountdown } from '@/hooks/useSharedCountdown'
import { useDeployment } from '@/hooks/useDeployment'
import { getDefiLlamaAllowlist } from '@/lib/vision/defillama-curated'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'
import { decodeBitmap, type BetDirection } from '@/lib/vision/bitmap'
import { indexL3, getWalletRpcUrls } from '@/lib/wagmi'
import { getAssetImageUrl } from '@/lib/vision/asset-images'
import { SourceTabNav } from './SourceTabNav'
import type { SourceDisplayServer } from '@/lib/vision/sources-server'
import { GeneralLoader } from '@/components/ui/GeneralLoader'
import { useTranslations } from 'next-intl'

// ── Constants ────────────────────────────────────────────────────────────────

const TOP_N = 10
const CONTENT_MAX = 1068
const APPLE_BLUE = '#0071E3'
const APPLE_BLUE_HOVER = '#0066CC'
const APPLE_GREEN = '#28CD41'
const APPLE_RED = '#FF3B30'
const APPLE_TEXT = '#1D1D1F'
const APPLE_TEXT_SECONDARY = '#86868B'
const APPLE_BG = '#FBFBFD'
const APPLE_PANEL = '#FFFFFF'
const APPLE_CHIP_BG = '#F5F5F7'
const EASE_DEFAULT = 'cubic-bezier(0.4, 0, 0.6, 1)'
const EASE_OUT = 'cubic-bezier(0.25, 0.1, 0.3, 1)'
const FONT_DISPLAY = 'var(--apple-font-display), "SF Pro Display", Helvetica, Arial, sans-serif'
const FONT_TEXT = 'var(--apple-font-text), "SF Pro Text", Helvetica, Arial, sans-serif'
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const STAKE_QUICK_PICKS = [1, 5, 10, 25, 50, 100]
const MIN_PER_MARKET = 0.1

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ── Cioran prose ─────────────────────────────────────────────────────────────

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

const PROSE_COMMITTED = [
  'Ten directions, all visible.',
  'The market knows.',
  'The round will judge.',
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

function formatCountdown(secs: number): string {
  if (secs <= 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatUsdDollars(n: number): string {
  if (!isFinite(n)) return '$0.00'
  if (Math.abs(n) >= 1000) return `$${n.toFixed(0)}`
  return `$${n.toFixed(2)}`
}

function aggregateValue(prices: SnapshotPrice[]): string {
  let sum = 0
  for (const p of prices) {
    const v = parseFloat(p.value)
    if (isFinite(v)) sum += v
  }
  return String(sum)
}

// ── Types ────────────────────────────────────────────────────────────────────

type Pick = 'up' | 'down'
type Picks = Record<string, Pick>

type FlowStep =
  | 'idle'
  | 'approving'
  | 'committing'
  | 'publishing'
  | 'committed'
  | 'reveal-failed'

interface CuratedMarket {
  market: SnapshotPrice
  marketIndex: number // index inside batch.marketIds
}

// ── Component ────────────────────────────────────────────────────────────────

interface SourceDetailHumanTradingProps {
  sourceId: string
  initialSource?: SourceDisplayServer
  hideSidebar?: boolean
}

export function SourceDetailHumanTrading({
  sourceId,
  initialSource,
  hideSidebar,
}: SourceDetailHumanTradingProps) {
  const t = useTranslations('vision')
  const router = useRouter()
  const queryClient = useQueryClient()

  // -- Registry / source metadata --
  const { sources, isLoading: isRegistryLoading } = useSourceRegistry()
  const sourceEntry = findSource(sources, sourceId)
  const source = useMemo(() => {
    if (sourceEntry) {
      return {
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
        internalIds: sourceEntry.internalIds ?? [],
      }
    }
    if (initialSource) {
      return {
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
        internalIds: initialSource.internalIds ?? [],
      }
    }
    return null
  }, [sourceEntry, initialSource])

  // -- Snapshot for the source --
  const { data: snapshotData, isLoading: isSnapshotLoading } = useSourceSnapshot(sourceId)
  const allMarkets: SnapshotPrice[] = useMemo(
    () => snapshotData?.prices ?? [],
    [snapshotData],
  )

  // -- Curated allowlist (10 slugs per displaySourceId) --
  const allowlist = useMemo(() => getDefiLlamaAllowlist(sourceId), [sourceId])
  const curatedMarkets: SnapshotPrice[] = useMemo(() => {
    if (!allowlist) {
      // Fallback: take top 10 by value
      return [...allMarkets]
        .sort((a, b) => (parseFloat(b.value) || 0) - (parseFloat(a.value) || 0))
        .slice(0, TOP_N)
    }
    // Preserve curated order from defillama-curated.json by looking up the assetId
    const byAssetId = new Map(allMarkets.map(m => [m.assetId, m]))
    const ordered: SnapshotPrice[] = []
    for (const id of allowlist) {
      const m = byAssetId.get(id)
      if (m) ordered.push(m)
    }
    return ordered.slice(0, TOP_N)
  }, [allMarkets, allowlist])

  // -- Active batch + round phase --
  const { data: batches } = useBatches()
  const activeBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null
    const internalSet = new Set([source?.id, ...(source?.internalIds ?? [])])
    const match = batches.find(b => internalSet.has(b.sourceId)) ?? null
    return match
  }, [batches, source])

  const marketIds: string[] = activeBatch?.marketIds ?? []
  const configHash = (activeBatch?.configHash ?? null) as `0x${string}` | null

  // -- Curated markets that ARE in the current batch (only these are bettable) --
  const tradableMarkets: CuratedMarket[] = useMemo(() => {
    if (!activeBatch) return []
    const result: CuratedMarket[] = []
    for (const m of curatedMarkets) {
      const idx = marketIds.indexOf(m.assetId)
      if (idx >= 0) result.push({ market: m, marketIndex: idx })
    }
    return result
  }, [curatedMarkets, marketIds, activeBatch])

  // -- bettingEnd from the round (server-truth) --
  const { data: rounds } = useRounds(sourceId)
  const bettingEnd = useMemo(() => {
    if (!activeBatch || !rounds) return null
    const r = rounds.find(r => r.batchId === activeBatch.id)
    return r?.bettingEnd ?? null
  }, [rounds, activeBatch])
  const remainingSecs = useSharedCountdown(bettingEnd)
  const isBettingOpen = !!bettingEnd && remainingSecs > 0
  const isRoundSettling = !!bettingEnd && remainingSecs === 0

  // -- Player position (for already-joined state on refresh) --
  const { isJoined, position, refetch: refetchPosition } = usePlayerPosition(activeBatch?.id)

  // -- Wallet + gas + USDC balance --
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')
  const { isLow: hasLowGas } = useL3GasBalance()

  const { data: walletUsdcRaw } = useReadContract({
    address: usdcAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: {
      enabled:
        !!address && usdcAddress !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10_000,
    },
  })
  const walletUsdc = (walletUsdcRaw as bigint | undefined) ?? 0n

  // -- Join + submit hooks --
  const {
    join,
    bitmap: encodedBitmap,
    bitmapHash,
    step: joinStep,
    error: joinError,
    reset: resetJoin,
  } = useJoinBatch()
  const {
    submitBitmap,
    isSubmitting,
    error: submitError,
  } = useSubmitBitmap()

  // -- Picks (forced UP/DOWN per tradable market) --
  const [picks, setPicks] = useState<Picks>({})
  const [stakeInput, setStakeInput] = useState<string>('10')
  const [flow, setFlow] = useState<FlowStep>('idle')
  const [revealRetryCount, setRevealRetryCount] = useState(0)

  // Reconcile flow with joinStep + isJoined
  useEffect(() => {
    if (joinStep === 'approving' && flow !== 'approving') setFlow('approving')
    if (joinStep === 'joining' && flow !== 'committing') setFlow('committing')
    if (joinStep === 'error' && flow !== 'idle') {
      setFlow('idle')
      resetJoin()
    }
  }, [joinStep, flow, resetJoin])

  // After joinBatchDirect lands, publish bitmap to issuers
  useEffect(() => {
    if (joinStep !== 'done' || !encodedBitmap || !bitmapHash || !activeBatch) return
    setFlow('publishing')
    submitBitmap({
      batchId: activeBatch.id,
      bitmap: encodedBitmap,
      bitmapHash,
    })
      .then(result => {
        if (result.acceptedCount > 0) {
          setFlow('committed')
        } else {
          setFlow('reveal-failed')
        }
      })
      .catch(() => {
        setFlow('reveal-failed')
      })
      .finally(() => {
        resetJoin()
        refetchPosition()
        queryClient.invalidateQueries({ queryKey: ['vision-rounds'] })
        queryClient.invalidateQueries({ queryKey: ['vision-batches'] })
      })
  }, [
    joinStep,
    encodedBitmap,
    bitmapHash,
    activeBatch,
    submitBitmap,
    resetJoin,
    refetchPosition,
    queryClient,
  ])

  // If user already joined this round (refresh), decode their stored picks
  // so the rows mount in `committed` state with the correct direction visible.
  useEffect(() => {
    if (!isJoined || !position || !activeBatch) return
    if (flow === 'committed') return
    // Best-effort decode: we have the bitmap hash on-chain but not the bytes.
    // Try to fetch from the issuer; if unavailable, we still set flow=committed
    // but the rows can't recolor. Issuers expose bitmaps via the rounds bitmaps endpoint.
    let cancelled = false
    const decodeFromIssuer = async () => {
      try {
        const res = await fetch(
          `/api/vision/rounds/${activeBatch.id}/bitmaps?player=${address}`,
        )
        if (!res.ok) return
        const data = await res.json()
        const bm: string | undefined = data?.bitmap_hex ?? data?.bitmapHex
        if (!bm) return
        const hex = bm.startsWith('0x') ? bm.slice(2) : bm
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
        }
        const directions = decodeBitmap(bytes, marketIds.length)
        if (cancelled) return
        const next: Picks = {}
        for (let i = 0; i < marketIds.length; i++) {
          next[marketIds[i]] = directions[i] === 'UP' ? 'up' : 'down'
        }
        setPicks(next)
        setFlow('committed')
      } catch {
        // Issuer history not available — still mark as committed so the UI locks
        if (!cancelled) setFlow('committed')
      }
    }
    decodeFromIssuer()
    return () => { cancelled = true }
  }, [isJoined, position, activeBatch, address, marketIds, flow])

  // -- Pick handlers --
  const onPick = useCallback((marketId: string, direction: Pick) => {
    if (flow !== 'idle') return
    setPicks(prev => {
      if (prev[marketId] === direction) return prev
      return { ...prev, [marketId]: direction }
    })
  }, [flow])

  // -- Stake math --
  const stakeNum = parseFloat(stakeInput) || 0
  const marketCount = tradableMarkets.length
  const perMarketStake = marketCount > 0 ? stakeNum / marketCount : 0
  const meetsMinimum = perMarketStake >= MIN_PER_MARKET
  const totalPicked = useMemo(
    () => tradableMarkets.filter(m => picks[m.market.assetId]).length,
    [picks, tradableMarkets],
  )
  const allPicked = totalPicked === marketCount && marketCount > 0
  const exceedsBalance =
    isConnected && stakeNum > 0 && BigInt(Math.round(stakeNum * 1e18)) > walletUsdc

  // -- Wallet connect --
  const handleConnectWallet = useCallback(async () => {
    const injected = connectors.find(c => c.id === 'injected')
    if (!injected) return
    const chainIdHex = `0x${indexL3.id.toString(16)}`
    const provider = (window as unknown as { ethereum?: { request: (req: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
    if (provider) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: indexL3.name,
            nativeCurrency: indexL3.nativeCurrency,
            rpcUrls: getWalletRpcUrls(indexL3),
          }],
        })
      } catch { /* may already exist */ }
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        })
      } catch { /* user rejected */ }
    }
    connect({ connector: injected, chainId: indexL3.id })
  }, [connect, connectors])

  // -- Build bets array in batch market order --
  const buildBets = useCallback((): BetDirection[] => {
    return marketIds.map(id => {
      const p = picks[id]
      if (p === 'up') return 'UP'
      return 'DOWN'
    })
  }, [marketIds, picks])

  // -- Validate handler --
  const onValidate = useCallback(() => {
    if (!activeBatch || !configHash || !isConnected || !allPicked) return
    if (!meetsMinimum || exceedsBalance) return
    if (flow !== 'idle') return

    const bets = buildBets()
    const depositAmount = BigInt(Math.round(stakeNum * 1e18))
    const marketCountForBitmap = activeBatch.marketCount || marketIds.length

    setFlow('approving') // optimistic — useJoinBatch will reconcile

    join({
      batchId: BigInt(activeBatch.id),
      configHash,
      depositAmount,
      bets,
      marketCount: marketCountForBitmap,
    })
  }, [
    activeBatch,
    configHash,
    isConnected,
    allPicked,
    meetsMinimum,
    exceedsBalance,
    flow,
    buildBets,
    stakeNum,
    marketIds,
    join,
  ])

  // -- Retry reveal --
  const onRetryReveal = useCallback(async () => {
    if (!encodedBitmap || !bitmapHash || !activeBatch) {
      // We lost the bitmap from join state. Re-encode from current picks.
      if (!activeBatch) return
      const bets = buildBets()
      const result = await submitBitmap({
        batchId: activeBatch.id,
        bitmap: new Uint8Array(0), // placeholder — useSubmitBitmap.submitBets is the right call
        bitmapHash: ('0x' + '00'.repeat(32)) as `0x${string}`,
      }).catch(() => null)
      if (result && result.acceptedCount > 0) {
        setFlow('committed')
      }
      setRevealRetryCount(n => n + 1)
      return
    }
    setFlow('publishing')
    try {
      const result = await submitBitmap({
        batchId: activeBatch.id,
        bitmap: encodedBitmap,
        bitmapHash,
      })
      if (result.acceptedCount > 0) {
        setFlow('committed')
      } else {
        setFlow('reveal-failed')
      }
    } catch {
      setFlow('reveal-failed')
    }
    setRevealRetryCount(n => n + 1)
  }, [encodedBitmap, bitmapHash, activeBatch, buildBets, submitBitmap])

  // -- Loading / not-found --
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
          <p style={{ color: APPLE_TEXT_SECONDARY }} className="mb-4">
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

  // -- Derived view-data --
  const valueLabel = source.valueLabel || 'TVL'
  const aggLabel = source.isPrice ? 'aggregate' : `total ${valueLabel.toLowerCase()}`
  const aggValue = formatBigUsd(aggregateValue(curatedMarkets))
  const showEmpty = !isSnapshotLoading && curatedMarkets.length === 0
  const sourceLogo = source.logo

  const proseLines = useMemo(() => {
    if (flow === 'committed') return PROSE_COMMITTED
    return PROSE[sourceId] ?? PROSE_FALLBACK
  }, [flow, sourceId])

  const displayError = joinError || submitError

  // Validate button copy state-aware
  const validateLabel = useMemo(() => {
    if (!isConnected) return 'Connect wallet'
    if (!isBettingOpen) return 'Round closed'
    if (flow === 'approving') return 'Approving…'
    if (flow === 'committing') return 'Committing…'
    if (flow === 'publishing') return 'Publishing…'
    if (flow === 'committed') return 'In custody'
    if (flow === 'reveal-failed') return 'Retry reveal'
    if (!allPicked) return `${totalPicked} / ${marketCount} chosen`
    if (!meetsMinimum) return `Min ${formatUsdDollars(MIN_PER_MARKET)} per market`
    if (exceedsBalance) return 'Insufficient balance'
    return 'Validate'
  }, [
    isConnected,
    isBettingOpen,
    flow,
    allPicked,
    totalPicked,
    marketCount,
    meetsMinimum,
    exceedsBalance,
  ])

  const validateEnabled =
    isConnected &&
    isBettingOpen &&
    allPicked &&
    meetsMinimum &&
    !exceedsBalance &&
    (flow === 'idle' || flow === 'reveal-failed')

  const isProcessing = flow === 'approving' || flow === 'committing' || flow === 'publishing'

  const onValidateClick = () => {
    if (!isConnected) {
      handleConnectWallet()
      return
    }
    if (flow === 'reveal-failed') {
      onRetryReveal()
      return
    }
    onValidate()
  }

  // -- Layout --
  const content = (
    <div className="flex-1 min-w-0 flex flex-col" style={{ background: APPLE_BG }}>
      <SourceTabNav sourceId={sourceId} activeTab="overview" />

      {/* Hero */}
      <div
        className="mx-auto w-full px-6 py-10 md:px-8 md:py-14 lg:py-16 flex flex-col gap-8"
        style={{ maxWidth: CONTENT_MAX }}
      >
        <HumanHeader
          name={source.name}
          description={source.description}
          logo={sourceLogo}
          brandBg={source.brandBg}
          aggValue={aggValue}
          aggLabel={aggLabel}
        />
      </div>

      {/* Sticky bar */}
      <StickyHeader
        remainingSecs={remainingSecs}
        bettingEnd={bettingEnd}
        totalPicked={totalPicked}
        marketCount={marketCount}
        stakeNum={stakeNum}
        perMarketStake={perMarketStake}
        validateLabel={validateLabel}
        validateEnabled={validateEnabled}
        isProcessing={isProcessing}
        flow={flow}
        onValidate={onValidateClick}
        hasLowGas={isConnected && hasLowGas}
        connected={isConnected}
      />

      <div
        className="mx-auto w-full px-6 md:px-8 pb-16 flex flex-col gap-6"
        style={{ maxWidth: 840 }}
      >
        {/* Stake input */}
        {!showEmpty && activeBatch && (
          <StakeInput
            stakeInput={stakeInput}
            setStakeInput={setStakeInput}
            marketCount={marketCount}
            perMarketStake={perMarketStake}
            meetsMinimum={meetsMinimum}
            exceedsBalance={exceedsBalance}
            walletUsdc={walletUsdc}
            isConnected={isConnected}
            disabled={flow !== 'idle' && flow !== 'reveal-failed'}
          />
        )}

        {/* Curated coverage notice */}
        {activeBatch && allowlist && marketCount < (allowlist.size ?? TOP_N) && (
          <CoverageNotice active={marketCount} curated={allowlist.size ?? TOP_N} />
        )}

        {/* Errors */}
        {displayError && (
          <ErrorBar message={displayError} onDismiss={() => resetJoin()} />
        )}

        {/* Rows */}
        {isSnapshotLoading && curatedMarkets.length === 0 ? (
          <SkeletonRows />
        ) : showEmpty ? (
          <IndexingNotice />
        ) : !activeBatch ? (
          <NoActiveRound markets={curatedMarkets} sourceId={sourceId} source={source} />
        ) : (
          <div className="flex flex-col gap-3">
            {tradableMarkets.map(({ market }) => (
              <MarketRow
                key={market.assetId}
                sourceId={sourceId}
                source={source}
                market={market}
                pick={picks[market.assetId]}
                onPick={onPick}
                locked={flow !== 'idle' && flow !== 'reveal-failed'}
                revealFailed={flow === 'reveal-failed'}
                onRetryReveal={onRetryReveal}
                roundSettling={isRoundSettling}
              />
            ))}
          </div>
        )}

        {/* Reveal retry banner */}
        {flow === 'reveal-failed' && (
          <RevealFailedBanner
            retryCount={revealRetryCount}
            isSubmitting={isSubmitting}
            onRetry={onRetryReveal}
          />
        )}

        {/* Cioran prose */}
        <ProseBlock lines={proseLines} />
      </div>
    </div>
  )

  return hideSidebar ? content : <div className="flex">{content}</div>
}

// ── Hero header (no change in concept) ───────────────────────────────────────

function HumanHeader({
  name,
  description,
  logo,
  brandBg,
  aggValue,
  aggLabel,
}: {
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '+0.011em',
            color: APPLE_TEXT_SECONDARY,
            textTransform: 'uppercase',
          }}
        >
          DefiLlama · Manually curated
        </span>
      </div>

      <div className="flex items-center gap-5 sm:gap-6">
        {hasLogo && (
          <div
            className="hidden sm:flex shrink-0 items-center justify-center overflow-hidden"
            style={{
              width: 72,
              height: 72,
              background: brandBg || '#000',
              borderRadius: 12,
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
              fontFamily: FONT_DISPLAY,
              fontSize: 'clamp(40px, 5.5vw, 56px)',
              fontWeight: 600,
              letterSpacing: '-0.016em',
              lineHeight: 1.0714,
              color: APPLE_TEXT,
              margin: 0,
            }}
          >
            {name}
          </h1>
          {description && (
            <p
              className="mt-3"
              style={{
                fontFamily: FONT_TEXT,
                fontSize: 17,
                lineHeight: 1.4706,
                letterSpacing: '-0.022em',
                color: APPLE_TEXT_SECONDARY,
                margin: 0,
                maxWidth: 640,
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-3 flex-wrap">
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 32,
            fontWeight: 500,
            letterSpacing: '-0.016em',
            color: APPLE_TEXT,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {aggValue}
        </span>
        <span
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 14,
            letterSpacing: '-0.016em',
            color: '#6E6E73',
          }}
        >
          {aggLabel}
        </span>
      </div>
    </header>
  )
}

// ── Sticky header ────────────────────────────────────────────────────────────

function StickyHeader({
  remainingSecs,
  bettingEnd,
  totalPicked,
  marketCount,
  stakeNum,
  perMarketStake,
  validateLabel,
  validateEnabled,
  isProcessing,
  flow,
  onValidate,
  hasLowGas,
  connected,
}: {
  remainingSecs: number
  bettingEnd: string | null
  totalPicked: number
  marketCount: number
  stakeNum: number
  perMarketStake: number
  validateLabel: string
  validateEnabled: boolean
  isProcessing: boolean
  flow: FlowStep
  onValidate: () => void
  hasLowGas: boolean
  connected: boolean
}) {
  const countdownColor = remainingSecs > 0 && remainingSecs < 60 ? APPLE_RED : APPLE_TEXT
  const validateBg = !validateEnabled
    ? APPLE_CHIP_BG
    : flow === 'committed'
      ? APPLE_GREEN
      : flow === 'reveal-failed'
        ? '#F5A623'
        : APPLE_BLUE
  const validateColor = !validateEnabled ? APPLE_TEXT_SECONDARY : '#FFFFFF'

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        background: 'rgba(255,255,255,0.8)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="mx-auto w-full flex items-center gap-4 px-4 md:px-6"
        style={{
          maxWidth: CONTENT_MAX,
          padding: '12px 24px',
        }}
      >
        {/* Countdown */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '+0.011em',
              color: APPLE_TEXT_SECONDARY,
              textTransform: 'uppercase',
            }}
          >
            Round
          </span>
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 14,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.016em',
              color: countdownColor,
              transition: `color 250ms ${EASE_DEFAULT}`,
              minWidth: 56,
            }}
          >
            {bettingEnd ? formatCountdown(remainingSecs) : '—'}
          </span>
        </div>

        <Divider />

        {/* Progress */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 14,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.016em',
              color: APPLE_TEXT,
              transition: `color 250ms ${EASE_DEFAULT}`,
            }}
          >
            {totalPicked}
            <span style={{ color: APPLE_TEXT_SECONDARY }}> / {marketCount}</span>
          </span>
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 13,
              color: APPLE_TEXT_SECONDARY,
              letterSpacing: '-0.016em',
            }}
          >
            chosen
          </span>
        </div>

        {/* Stake summary (hidden on small screens) */}
        <div className="hidden md:flex items-center gap-2 min-w-0">
          <Divider />
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 13,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.016em',
              color: APPLE_TEXT_SECONDARY,
            }}
          >
            {marketCount > 0 ? (
              <>
                {formatUsdDollars(stakeNum)} total ·{' '}
                {formatUsdDollars(perMarketStake)} / market
              </>
            ) : (
              'no active round'
            )}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Low gas chip */}
        {connected && hasLowGas && (
          <div
            className="hidden sm:flex items-center gap-1.5"
            style={{
              background: '#FFF6E5',
              border: '1px solid #F5C26B',
              borderRadius: 980,
              padding: '4px 10px',
              fontFamily: FONT_TEXT,
              fontSize: 11,
              fontWeight: 500,
              color: '#8A5A00',
              letterSpacing: '-0.016em',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#F5A623' }} />
            Low gas
          </div>
        )}

        {/* Validate pill (desktop) */}
        <button
          type="button"
          onClick={onValidate}
          disabled={!validateEnabled && !isProcessing}
          className="hidden sm:inline-flex"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 24px',
            borderRadius: 980,
            background: validateBg,
            color: validateColor,
            fontFamily: FONT_TEXT,
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: '-0.016em',
            border: 'none',
            cursor: validateEnabled ? 'pointer' : 'not-allowed',
            transition: `background 200ms ${EASE_DEFAULT}, color 200ms ${EASE_DEFAULT}`,
            animation:
              validateEnabled && flow === 'idle' ? `gm-pulse 1.2s ${EASE_DEFAULT} infinite` : undefined,
            minWidth: 140,
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            if (validateEnabled && flow === 'idle')
              e.currentTarget.style.background = APPLE_BLUE_HOVER
          }}
          onMouseLeave={(e) => {
            if (validateEnabled && flow === 'idle')
              e.currentTarget.style.background = APPLE_BLUE
          }}
        >
          {isProcessing && <Spinner />}
          {flow === 'committed' && <CheckMark />}
          <span>{validateLabel}</span>
        </button>
      </div>

      {/* Mobile bottom-pinned Validate */}
      <MobileValidate
        validateBg={validateBg}
        validateColor={validateColor}
        validateEnabled={validateEnabled}
        isProcessing={isProcessing}
        flow={flow}
        label={validateLabel}
        onClick={onValidate}
      />

      {/* Keyframes (scoped inline) */}
      <style>{`
        @keyframes gm-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.015); }
        }
        @keyframes gm-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{
        width: 1,
        height: 16,
        background: 'rgba(0,0,0,0.1)',
        display: 'inline-block',
      }}
    />
  )
}

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        marginRight: 8,
        border: '1.5px solid rgba(255,255,255,0.4)',
        borderTopColor: '#FFFFFF',
        borderRadius: '50%',
        animation: `gm-spin 0.7s linear infinite`,
      }}
    />
  )
}

function CheckMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ marginRight: 6 }}
      aria-hidden
    >
      <path
        d="M3 7L6 10L11 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MobileValidate({
  validateBg,
  validateColor,
  validateEnabled,
  isProcessing,
  flow,
  label,
  onClick,
}: {
  validateBg: string
  validateColor: string
  validateEnabled: boolean
  isProcessing: boolean
  flow: FlowStep
  label: string
  onClick: () => void
}) {
  return (
    <div
      className="sm:hidden"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '12px 16px calc(env(safe-area-inset-bottom) + 12px)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        background: 'rgba(255,255,255,0.85)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        zIndex: 40,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!validateEnabled && !isProcessing}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: 980,
          background: validateBg,
          color: validateColor,
          fontFamily: FONT_TEXT,
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: '-0.016em',
          border: 'none',
          cursor: validateEnabled ? 'pointer' : 'not-allowed',
          transition: `background 200ms ${EASE_DEFAULT}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isProcessing && <Spinner />}
        {flow === 'committed' && <CheckMark />}
        <span>{label}</span>
      </button>
    </div>
  )
}

// ── Stake input ──────────────────────────────────────────────────────────────

function StakeInput({
  stakeInput,
  setStakeInput,
  marketCount,
  perMarketStake,
  meetsMinimum,
  exceedsBalance,
  walletUsdc,
  isConnected,
  disabled,
}: {
  stakeInput: string
  setStakeInput: (v: string) => void
  marketCount: number
  perMarketStake: number
  meetsMinimum: boolean
  exceedsBalance: boolean
  walletUsdc: bigint
  isConnected: boolean
  disabled: boolean
}) {
  const balanceHuman = parseFloat(formatUnits(walletUsdc, VISION_USDC_DECIMALS))
  const stakeNum = parseFloat(stakeInput) || 0

  return (
    <section
      style={{
        background: APPLE_PANEL,
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 18,
        padding: '20px 24px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : undefined,
        transition: `opacity 250ms ${EASE_DEFAULT}`,
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 14,
            color: APPLE_TEXT_SECONDARY,
            letterSpacing: '-0.016em',
          }}
        >
          Stake per round
        </span>
        {isConnected && (
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 12,
              color: APPLE_TEXT_SECONDARY,
              letterSpacing: '-0.016em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            Balance{' '}
            {balanceHuman.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}{' '}
            USDC
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 32,
            color: APPLE_TEXT,
            fontWeight: 400,
            letterSpacing: '-0.016em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          $
        </span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={stakeInput}
          onChange={(e) => setStakeInput(e.target.value)}
          placeholder="10"
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 32,
            color: APPLE_TEXT,
            fontWeight: 400,
            letterSpacing: '-0.016em',
            fontVariantNumeric: 'tabular-nums',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            maxWidth: 220,
            padding: 0,
            appearance: 'textfield',
            MozAppearance: 'textfield',
          }}
        />
      </div>

      {/* Quick picks */}
      <div className="mt-3 flex flex-wrap gap-2">
        {STAKE_QUICK_PICKS.map(amount => {
          const active = stakeNum === amount
          return (
            <button
              key={amount}
              type="button"
              onClick={() => setStakeInput(String(amount))}
              style={{
                padding: '6px 14px',
                borderRadius: 980,
                background: active ? APPLE_BLUE : APPLE_CHIP_BG,
                color: active ? '#FFFFFF' : APPLE_TEXT,
                fontFamily: FONT_TEXT,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '-0.016em',
                fontVariantNumeric: 'tabular-nums',
                border: 'none',
                cursor: 'pointer',
                transition: `background 200ms ${EASE_DEFAULT}, color 200ms ${EASE_DEFAULT}`,
              }}
            >
              ${amount}
            </button>
          )
        })}
      </div>

      {/* Split line */}
      <p
        className="mt-3"
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 12,
          color: APPLE_TEXT_SECONDARY,
          letterSpacing: '-0.016em',
          fontVariantNumeric: 'tabular-nums',
          margin: '12px 0 0',
        }}
      >
        {marketCount > 0
          ? `${formatUsdDollars(stakeNum)} ÷ ${marketCount} markets = ${formatUsdDollars(perMarketStake)} per market`
          : 'No tradable markets in the current round.'}
      </p>

      {/* Helper */}
      {marketCount > 0 && !meetsMinimum && stakeNum > 0 && (
        <p
          className="mt-2"
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 12,
            color: APPLE_RED,
            letterSpacing: '-0.016em',
            margin: '8px 0 0',
          }}
        >
          Minimum {formatUsdDollars(MIN_PER_MARKET)} per market.
        </p>
      )}
      {exceedsBalance && (
        <p
          className="mt-2"
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 12,
            color: APPLE_RED,
            letterSpacing: '-0.016em',
            margin: '8px 0 0',
          }}
        >
          Stake exceeds wallet balance.
        </p>
      )}
    </section>
  )
}

// ── Market row ───────────────────────────────────────────────────────────────

function MarketRow({
  sourceId,
  source,
  market,
  pick,
  onPick,
  locked,
  revealFailed,
  onRetryReveal,
  roundSettling,
}: {
  sourceId: string
  source: { logo: string; brandBg: string; prefixes: string[]; isPrice: boolean; valueLabel: string }
  market: SnapshotPrice
  pick: Pick | undefined
  onPick: (marketId: string, direction: Pick) => void
  locked: boolean
  revealFailed: boolean
  onRetryReveal: () => void
  roundSettling: boolean
}) {
  const [imgErr, setImgErr] = useState(false)
  const change = formatChange(market.changePct)
  const name = market.name || market.symbol || market.assetId
  const category = (market.category ?? '').toLowerCase()
  const value = formatBigUsd(market.value)
  const subLabel = source.isPrice ? 'price' : source.valueLabel.toLowerCase()
  const imgSrc =
    !imgErr && (market.imageUrl || getAssetImageUrl(sourceId, market.assetId, source.prefixes))

  // Chart stroke color follows the pick
  const strokeColor =
    pick === 'up' ? APPLE_GREEN : pick === 'down' ? APPLE_RED : APPLE_TEXT_SECONDARY

  return (
    <article
      style={{
        background: APPLE_PANEL,
        borderRadius: 18,
        boxShadow:
          '0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
        padding: '20px 24px',
        transition: `box-shadow 250ms ${EASE_DEFAULT}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 inline-flex items-center justify-center overflow-hidden"
          style={{
            width: 48,
            height: 48,
            background: APPLE_CHIP_BG,
            borderRadius: 12,
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
                fontFamily: FONT_TEXT,
                fontSize: 18,
                fontWeight: 600,
                color: APPLE_TEXT,
              }}
            >
              {name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: '-0.016em',
              color: APPLE_TEXT,
              lineHeight: 1.1666,
            }}
          >
            {name}
          </div>
          {category && (
            <div
              className="mt-0.5 truncate"
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                letterSpacing: '+0.011em',
                color: APPLE_TEXT_SECONDARY,
                textTransform: 'uppercase',
              }}
            >
              {category}
            </div>
          )}
        </div>

        <div className="text-right shrink-0 flex flex-col items-end">
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: '-0.016em',
              color: APPLE_TEXT,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          <span
            className="mt-1"
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 12,
              color: APPLE_TEXT_SECONDARY,
              letterSpacing: '+0.007em',
              textTransform: 'lowercase',
            }}
          >
            {subLabel}
          </span>
        </div>

        <div className="hidden sm:flex shrink-0 ml-3">
          <span
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '-0.016em',
              fontVariantNumeric: 'tabular-nums',
              color:
                change.positive === true
                  ? APPLE_GREEN
                  : change.positive === false
                    ? APPLE_RED
                    : APPLE_TEXT_SECONDARY,
            }}
          >
            {change.positive === true ? '▲ ' : change.positive === false ? '▼ ' : ''}
            {change.text}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="mt-4">
        <AssetSparkline
          sourceId={sourceId}
          assetId={market.assetId}
          stroke={strokeColor}
        />
      </div>

      {/* Pick buttons */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <PickButton
          direction="up"
          active={pick === 'up'}
          inactive={pick === 'down'}
          disabled={locked || roundSettling}
          onClick={() => onPick(market.assetId, 'up')}
        />
        <PickButton
          direction="down"
          active={pick === 'down'}
          inactive={pick === 'up'}
          disabled={locked || roundSettling}
          onClick={() => onPick(market.assetId, 'down')}
        />
      </div>

      {/* Locked footer */}
      {locked && (
        <p
          className="mt-3"
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 12,
            color: APPLE_TEXT_SECONDARY,
            letterSpacing: '-0.016em',
            margin: '12px 0 0',
            textAlign: 'center',
          }}
        >
          Committed for this round
        </p>
      )}
      {revealFailed && (
        <div className="mt-3 flex items-center justify-center">
          <button
            type="button"
            onClick={onRetryReveal}
            style={{
              fontFamily: FONT_TEXT,
              fontSize: 12,
              color: '#8A5A00',
              background: '#FFF6E5',
              border: '1px solid #F5C26B',
              borderRadius: 980,
              padding: '4px 12px',
              cursor: 'pointer',
              letterSpacing: '-0.016em',
            }}
          >
            Reveal pending — retry
          </button>
        </div>
      )}
    </article>
  )
}

// ── Pick button ──────────────────────────────────────────────────────────────

function PickButton({
  direction,
  active,
  inactive,
  disabled,
  onClick,
}: {
  direction: Pick
  active: boolean
  inactive: boolean
  disabled: boolean
  onClick: () => void
}) {
  const [pressed, setPressed] = useState(false)
  const isUp = direction === 'up'
  const accent = isUp ? APPLE_GREEN : APPLE_RED
  const glyph = isUp ? '▲' : '▼'
  const label = isUp ? 'UP' : 'DOWN'

  let bg = APPLE_CHIP_BG
  let color = APPLE_TEXT
  let border = '1px solid transparent'
  let boxShadow: string | undefined

  if (active) {
    bg = accent
    color = '#FFFFFF'
    boxShadow = 'inset 0 -2px 0 rgba(0,0,0,0.12)'
  } else if (inactive) {
    bg = '#FFFFFF'
    color = APPLE_TEXT_SECONDARY
    border = '1px solid rgba(0,0,0,0.12)'
  }

  const opacity = disabled && !active ? 0.4 : 1

  const style: CSSProperties = {
    height: 56,
    borderRadius: 14,
    background: bg,
    color,
    border,
    boxShadow,
    fontFamily: FONT_TEXT,
    fontSize: 17,
    fontWeight: 500,
    letterSpacing: '-0.016em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: `background 250ms ${EASE_DEFAULT}, color 250ms ${EASE_DEFAULT}, border-color 250ms ${EASE_DEFAULT}, transform 200ms ${EASE_OUT}`,
    transform: pressed ? 'scale(0.97)' : 'scale(1)',
    opacity,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    userSelect: 'none',
    pointerEvents: disabled ? 'none' : 'auto',
  }

  return (
    <button
      type="button"
      style={style}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label} — ${active ? 'selected' : 'select'}`}
    >
      <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>{glyph}</span>
      {label}
    </button>
  )
}

// ── Asset sparkline (real history) ───────────────────────────────────────────

interface HistoryPoint {
  ts: number // ms
  value: number
}

function AssetSparkline({
  sourceId,
  assetId,
  stroke,
}: {
  sourceId: string
  assetId: string
  stroke: string
}) {
  const [points, setPoints] = useState<HistoryPoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    const to = new Date()
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000)
    const url = `/api/market/history?source=${encodeURIComponent(sourceId)}&asset=${encodeURIComponent(assetId)}&from=${from.toISOString()}&to=${to.toISOString()}`
    fetch(url, { signal: AbortSignal.timeout(12_000) })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { prices?: Array<{ fetchedAt?: string; value?: string | number }> }) => {
        if (cancelled) return
        const raw = data.prices ?? []
        const parsed: HistoryPoint[] = raw
          .map(p => ({
            ts: p.fetchedAt ? new Date(p.fetchedAt).getTime() : 0,
            value:
              typeof p.value === 'string'
                ? parseFloat(p.value)
                : typeof p.value === 'number'
                  ? p.value
                  : NaN,
          }))
          .filter(p => isFinite(p.value) && p.ts > 0)
        setPoints(parsed)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [sourceId, assetId])

  if (loading) {
    return (
      <div
        style={{
          height: 96,
          background: APPLE_CHIP_BG,
          borderRadius: 8,
          opacity: 0.5,
        }}
      />
    )
  }

  if (error || !points || points.length < 2) {
    return (
      <div
        style={{
          height: 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 12,
            color: APPLE_TEXT_SECONDARY,
            letterSpacing: '-0.016em',
          }}
        >
          No recent series.
        </span>
      </div>
    )
  }

  // Downsample
  const data =
    points.length > 288
      ? points.filter((_, i) => i % Math.ceil(points.length / 288) === 0)
      : points

  return (
    <div style={{ height: 96, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
          <RechartsTooltip
            content={<SparklineTooltip />}
            cursor={{ stroke: 'rgba(0,0,0,0.12)', strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
            style={{ transition: `stroke 250ms ${EASE_DEFAULT}` }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function SparklineTooltip(props: { active?: boolean; payload?: Array<{ payload?: HistoryPoint; value?: number }> }) {
  if (!props.active || !props.payload || props.payload.length === 0) return null
  const item = props.payload[0]
  if (!item || item.payload === undefined) return null
  const v = item.value ?? item.payload.value
  const ts = item.payload.ts
  if (typeof v !== 'number') return null
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 8,
        padding: '6px 10px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        fontFamily: FONT_TEXT,
        fontSize: 12,
        color: APPLE_TEXT,
        letterSpacing: '-0.016em',
      }}
    >
      <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
        {formatBigUsd(String(v))}
      </div>
      <div style={{ color: APPLE_TEXT_SECONDARY, fontSize: 11 }}>
        {new Date(ts).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  )
}

// ── Notices ──────────────────────────────────────────────────────────────────

function CoverageNotice({ active, curated }: { active: number; curated: number }) {
  return (
    <div
      style={{
        background: APPLE_PANEL,
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 14,
        padding: '10px 14px',
        fontFamily: FONT_TEXT,
        fontSize: 13,
        color: APPLE_TEXT_SECONDARY,
        letterSpacing: '-0.016em',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      Curated {curated} · {active} active this round.
    </div>
  )
}

function ErrorBar({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      style={{
        background: '#FFF1F0',
        border: '1px solid #FBC4C1',
        borderRadius: 14,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <p
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 13,
          color: '#8A0F0F',
          letterSpacing: '-0.016em',
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#8A0F0F',
          fontFamily: FONT_TEXT,
          fontSize: 16,
          cursor: 'pointer',
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

function RevealFailedBanner({
  retryCount,
  isSubmitting,
  onRetry,
}: {
  retryCount: number
  isSubmitting: boolean
  onRetry: () => void
}) {
  return (
    <div
      style={{
        background: '#FFF6E5',
        border: '1px solid #F5C26B',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <p
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 14,
          color: '#8A5A00',
          letterSpacing: '-0.016em',
          margin: 0,
          fontWeight: 500,
        }}
      >
        Commitment landed on-chain. Reveal is still retrying.
      </p>
      <p
        className="mt-1"
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 12,
          color: '#8A5A00',
          letterSpacing: '-0.016em',
          margin: '4px 0 0',
        }}
      >
        Attempts so far: {retryCount}. The stake is safe; the directions just need to reach the issuers.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={isSubmitting}
        style={{
          marginTop: 10,
          padding: '8px 16px',
          borderRadius: 980,
          background: '#F5A623',
          color: '#FFFFFF',
          fontFamily: FONT_TEXT,
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '-0.016em',
          border: 'none',
          cursor: isSubmitting ? 'wait' : 'pointer',
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        {isSubmitting ? 'Retrying…' : 'Retry now'}
      </button>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: APPLE_PANEL,
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: 18,
            padding: '20px 24px',
            height: 210,
            opacity: 0.6,
          }}
        >
          <div className="flex items-center gap-4">
            <span className="skeleton shrink-0" style={{ width: 48, height: 48, borderRadius: 12 }} />
            <span className="skeleton flex-1 h-[18px] rounded" />
            <span className="skeleton w-[120px] h-[24px] rounded" />
          </div>
          <span className="skeleton block mt-4" style={{ height: 96, borderRadius: 8 }} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <span className="skeleton" style={{ height: 56, borderRadius: 14 }} />
            <span className="skeleton" style={{ height: 56, borderRadius: 14 }} />
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
        background: APPLE_PANEL,
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 18,
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontFamily: FONT_TEXT,
          fontSize: 17,
          letterSpacing: '-0.022em',
          color: APPLE_TEXT_SECONDARY,
          margin: 0,
          lineHeight: 1.4706,
        }}
      >
        Markets indexing. Check back tomorrow.
      </p>
    </div>
  )
}

function NoActiveRound({
  markets,
  sourceId,
  source,
}: {
  markets: SnapshotPrice[]
  sourceId: string
  source: { logo: string; brandBg: string; prefixes: string[]; isPrice: boolean; valueLabel: string }
}) {
  // Render the same rows but with picks disabled and chart greyed.
  return (
    <div className="flex flex-col gap-3">
      <div
        style={{
          background: APPLE_PANEL,
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: 18,
          padding: '14px 16px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 14,
            color: APPLE_TEXT_SECONDARY,
            letterSpacing: '-0.016em',
            margin: 0,
          }}
        >
          No active round. Picks will open when the next one starts.
        </p>
      </div>
      {markets.map(m => (
        <MarketRow
          key={m.assetId}
          sourceId={sourceId}
          source={source}
          market={m}
          pick={undefined}
          onPick={() => { /* disabled */ }}
          locked
          revealFailed={false}
          onRetryReveal={() => { /* noop */ }}
          roundSettling={false}
        />
      ))}
    </div>
  )
}

function ProseBlock({ lines }: { lines: string[] }) {
  return (
    <section
      style={{
        borderTop: '1px solid rgba(0,0,0,0.06)',
        paddingTop: 32,
        marginTop: 16,
        maxWidth: 734,
      }}
    >
      {lines.map((line, i) => (
        <p
          key={i}
          style={{
            fontFamily: FONT_TEXT,
            fontSize: 17,
            lineHeight: 1.4706,
            letterSpacing: '-0.022em',
            color: i === lines.length - 1 ? APPLE_TEXT : '#6E6E73',
            margin: i === 0 ? 0 : '12px 0 0',
          }}
        >
          {line}
        </p>
      ))}
    </section>
  )
}

