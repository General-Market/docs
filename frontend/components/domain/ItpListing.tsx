'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount, useConnect, useDisconnect, usePublicClient, useWaitForTransactionReceipt } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { BRIDGE_PROXY_ABI } from '@/lib/contracts/index-protocol-abi'
import { formatUnits } from 'viem'
import { BuyItpModal } from './BuyItpModal'
import { SellItpModal } from './SellItpModal'
import { LendItpModal } from './LendItpModal'
import { ChartModal } from './ChartModal'
import { RebalanceModal } from './RebalanceModal'
import { YouTubeLite as YouTubeLiteShared, extractYouTubeId as extractYouTubeIdShared } from '@/components/ui/YouTubeLite'
import { CostBasisCard } from './CostBasisCard'
import { useItpNav } from '@/hooks/useItpNav'
import { useUserItpShares } from '@/hooks/useUserItpShares'
import { useItpMetadata } from '@/hooks/useItpMetadata'
import { useDeployerName } from '@/hooks/useDeployerName'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { hasLendingMarket } from '@/lib/contracts/morpho-markets-registry'
import blacklistedItps from '@/lib/config/blacklisted-itps.json'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { indexL3 } from '@/lib/wagmi'
import { useSSENav, type NavSnapshot } from '@/hooks/useSSE'

// ERC20 ABI for balance queries — used by ItpCard detail expansion (low priority migration)
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Known addresses to track for minted balances
const TRACKED_HOLDERS = [
  { label: 'AP (Keeper)', address: '0x20A85a164C64B603037F647eb0E0aDeEce0BE5AC' as `0x${string}` },
  { label: 'Deployer', address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}` },
  { label: 'User 1', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as `0x${string}` },
  { label: 'User 2', address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as `0x${string}` },
  { label: 'Test User', address: '0xC0D3C3ba6c2215b0cBf4375f4c280c0cc6C43850' as `0x${string}` },
  { label: 'MockBitgetVault', address: INDEX_PROTOCOL.mockBitgetVault as `0x${string}` },
]

interface ItpInfo {
  id: string
  itpId?: string
  nonce?: number
  admin: string
  name: string
  symbol: string
  createdAt: number
  source: 'index' | 'bridge'
  completed: boolean
  orbitItpId?: string
  arbAddress?: string
  totalValue?: bigint
  totalSupply?: bigint
}

export interface DeployedItpRef {
  itpId: string
  name: string
  symbol: string
}

interface ItpListingProps {
  onCreateClick?: () => void
  onLendingClick?: () => void
  onItpsLoaded?: (itps: DeployedItpRef[]) => void
}

// Test video IDs — shown on ITP cards that don't have a metadata videoUrl set
const TEST_VIDEO_IDS = [
  'bBC-nXj3Ng4',  // Bitcoin whiteboard overview (3Blue1Brown)
  'p7HKvqRI_Bo',  // How The Economic Machine Works (Ray Dalio)
  'PHe0bXAIuk0',  // How The Stock Market Works
  '41JCpzvnn_0',  // What is an ETF?
]

// Use shared YouTube components
const extractYouTubeId = extractYouTubeIdShared
const YouTubeLite = YouTubeLiteShared

/**
 * Derive ITP number from hex itp_id (e.g. "0x000...0001" -> 1).
 * Returns 0 if parsing fails.
 */
function itpIdToNumber(itpId: string): number {
  try {
    const hex = itpId.startsWith('0x') ? itpId.slice(2) : itpId
    return parseInt(hex, 16) || 0
  } catch {
    return 0
  }
}

/**
 * Convert SSE NavSnapshot[] into ItpInfo[] for the listing.
 * SSE provides: itp_id, nav_per_share, total_supply, aum_usd
 * Missing from SSE: name, symbol, creator, createdAt — derived from ITP number or filled by per-card hooks.
 */
function navSnapshotsToItpInfos(navList: NavSnapshot[]): ItpInfo[] {
  const blacklistSet = new Set((blacklistedItps as string[]).map(id => id.toLowerCase()))

  const itps: ItpInfo[] = navList
    .filter(nav => !blacklistSet.has(nav.itp_id.toLowerCase()))
    .map(nav => {
      const num = itpIdToNumber(nav.itp_id)
      return {
        id: nav.itp_id,
        itpId: nav.itp_id,
        admin: '', // Not available from SSE — shown per-card via useItpMetadata
        name: `ITP #${num}`, // Default name — overridden by per-card metadata
        symbol: `ITP${num}`,
        createdAt: 0, // Not available from SSE
        source: 'index' as const,
        completed: true,
        arbAddress: nav.arb_address ?? undefined,
        totalValue: BigInt(Math.round(nav.aum_usd * 1e18)),
        totalSupply: BigInt(nav.total_supply),
      }
    })

  // Sort by AUM descending
  itps.sort((a, b) => {
    const aVal = Number(a.totalValue || 0n)
    const bVal = Number(b.totalValue || 0n)
    return bVal - aVal
  })

  return itps
}

export function ItpListing({ onCreateClick, onLendingClick, onItpsLoaded }: ItpListingProps) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnectPending } = useConnect()
  const { disconnect } = useDisconnect()

  const injectedConnector = connectors.find(c => c.id === 'injected')

  const handleWalletClick = async () => {
    if (isConnected) {
      disconnect()
    } else if (injectedConnector) {
      const chainIdHex = `0x${indexL3.id.toString(16)}`
      const provider = (window as any).ethereum
      if (provider) {
        try { await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: chainIdHex, chainName: indexL3.name, nativeCurrency: indexL3.nativeCurrency, rpcUrls: [indexL3.rpcUrls.default.http[0]] }] }) } catch {}
        try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] }) } catch {}
      }
      connect({ connector: injectedConnector, chainId: indexL3.id })
    }
  }

  // ── SSE-driven ITP list (replaces getItpCount + getITP loop + bridge loop + getLogs) ──
  const navList = useSSENav()
  const loading = navList.length === 0
  const [buyModal, setBuyModal] = useState<{ itpId: string; videoUrl: string } | null>(null)
  const [sellModal, setSellModal] = useState<{ itpId: string; videoUrl: string } | null>(null)
  const [lendModalItp, setLendModalItp] = useState<ItpInfo | null>(null)
  const [chartModalItp, setChartModalItp] = useState<{ itpId: string; name: string; createdAt?: number } | null>(null)
  const [rebalanceModalItp, setRebalanceModalItp] = useState<{ itpId: string; name: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  // Derive ITP list from SSE nav snapshots
  const itps = useMemo(() => navSnapshotsToItpInfos(navList), [navList])

  // Notify parent of loaded ITPs
  useEffect(() => {
    if (onItpsLoaded && itps.length > 0) {
      onItpsLoaded(
        itps
          .filter(itp => itp.itpId)
          .map(itp => ({ itpId: itp.itpId!, name: itp.name, symbol: itp.symbol }))
      )
    }
  }, [itps, onItpsLoaded])

  const activeItps = itps.filter(i => i.source === 'index' || i.completed)
  const pendingItps = itps.filter(i => i.source !== 'index' && !i.completed)
  const [showAll, setShowAll] = useState(false)
  const displayedItps = showAll ? itps : itps.slice(0, 6)

  return (
    <>
      {/* Hero Band */}
      <div className="hero-band">
        <div className="hero-band-inner">
          <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted mb-2">
            Index Tracking Products
          </div>
          <h2 className="text-[28px] md:text-[42px] font-black tracking-[-0.03em] text-black leading-[1.1] mb-2">
            Markets
          </h2>
          <p className="text-[16px] text-text-secondary max-w-[600px]">
            Explore decentralized index products. Each ITP tracks a basket of crypto assets with live NAV pricing and on-chain settlement.
          </p>
        </div>
      </div>

      {/* Filter Bar — mockup: padding 20px 48px */}
      <div className="py-5 px-6 lg:px-12 border-b border-border-light">
        <div className="max-w-site mx-auto flex items-center gap-3 flex-wrap">
          <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-primary mr-1">Filters</span>
          <button
            onClick={() => { setCurrentPage(0); setShowAll(false) }}
            className={`filter-pill ${currentPage === 0 ? 'active' : ''}`}
          >
            All ({itps.length})
          </button>
          <button className="filter-pill">Active ({activeItps.length})</button>
          <button className="filter-pill">Pending ({pendingItps.length})</button>
          <input
            type="text"
            placeholder="Search funds by name or ticker..."
            className="flex-1 min-w-0 md:min-w-[200px] max-w-[320px] border-2 border-border-light rounded-full px-4 py-[9px] text-[13px] text-text-primary placeholder-text-muted focus:outline-none focus:border-black transition-colors"
          />
          <select className="ml-auto border border-border-light rounded-md px-3.5 py-2 text-[12px] font-medium text-text-secondary bg-white focus:outline-none cursor-pointer">
            <option>Sort: AUM High &rarr; Low</option>
            <option>Sort: AUM Low &rarr; High</option>
            <option>Sort: Newest</option>
            <option>Sort: Name A-Z</option>
          </select>
        </div>
      </div>

      {/* Section Bar */}
      <div className="px-6 lg:px-12">
        <div className="max-w-site mx-auto">
          <div className="section-bar">
            <div>
              <div className="section-bar-title">Data View</div>
              <div className="section-bar-value">Fund Overview — Live NAV</div>
            </div>
            <div className="section-bar-right">
              {showAll ? `Showing all ${itps.length} products` : `Showing ${Math.min(6, itps.length)} of ${itps.length} products`}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading ITPs...</div>
      ) : itps.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-muted mb-4">No ITPs created yet</p>
        </div>
      ) : (
        <>
          {/* Fund Cards Grid — mockup: .fund-grid padding: 24px 48px */}
          <div className="px-6 lg:px-12 py-6">
            <div className="max-w-site mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border border-border-light">
                {displayedItps.map((itp, idx) => (
                  <ItpCard
                    key={itp.id}
                    itp={itp}
                    index={idx}
                    onBuy={() => {
                      if (!itp.itpId) return
                      const vid = TEST_VIDEO_IDS[idx % TEST_VIDEO_IDS.length]
                      setBuyModal({ itpId: itp.itpId, videoUrl: `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1` })
                    }}
                    onSell={() => {
                      if (!itp.itpId) return
                      const vid = TEST_VIDEO_IDS[idx % TEST_VIDEO_IDS.length]
                      setSellModal({ itpId: itp.itpId, videoUrl: `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1` })
                    }}
                    onLend={(arbAddr) => setLendModalItp({ ...itp, arbAddress: arbAddr })}
                    onChart={() => itp.itpId && setChartModalItp({ itpId: itp.itpId, name: itp.name || `ITP #${itp.nonce ?? itp.id}`, createdAt: itp.createdAt })}
                    onRebalance={() => itp.itpId && setRebalanceModalItp({ itpId: itp.itpId, name: itp.name || `ITP #${itp.nonce ?? itp.id}` })}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Show All button — mockup: .show-more padding: 16px 48px 32px */}
          {!showAll && itps.length > 6 && (
            <div className="pt-4 pb-8 text-center">
              <button
                onClick={() => setShowAll(true)}
                className="inline-flex items-center gap-2 px-8 py-3 border-2 border-black rounded-md text-[13px] font-bold text-black hover:bg-black hover:text-white transition-colors"
              >
                Show All {itps.length} Funds
              </button>
            </div>
          )}
        </>
      )}

      {buyModal && (
        <BuyItpModal itpId={buyModal.itpId} videoUrl={buyModal.videoUrl} onClose={() => setBuyModal(null)} />
      )}
      {sellModal && (
        <SellItpModal itpId={sellModal.itpId} videoUrl={sellModal.videoUrl} onClose={() => setSellModal(null)} />
      )}
      {lendModalItp && (
        <LendItpModal itpInfo={lendModalItp} isOpen={true} onClose={() => setLendModalItp(null)} />
      )}
      {chartModalItp && (
        <ChartModal itpId={chartModalItp.itpId} itpName={chartModalItp.name} createdAt={chartModalItp.createdAt} onClose={() => setChartModalItp(null)} />
      )}
      {rebalanceModalItp && (
        <RebalanceModal itpId={rebalanceModalItp.itpId} itpName={rebalanceModalItp.name} onClose={() => setRebalanceModalItp(null)} />
      )}
    </>
  )
}

interface TokenHolder {
  address: `0x${string}`
  label: string
  balance: bigint
  percentage: number
}

interface ItpCardProps {
  itp: ItpInfo
  index: number
  onBuy: () => void
  onSell: () => void
  onLend: (arbAddress: string) => void
  onChart: () => void
  onRebalance: () => void
}

function ItpCard({ itp, index, onBuy, onSell, onLend, onChart, onRebalance }: ItpCardProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [showDetails, setShowDetails] = useState(false)
  const [totalSupply, setTotalSupply] = useState<bigint>(0n)
  const [holders, setHolders] = useState<TokenHolder[]>([])
  const [loadingHolders, setLoadingHolders] = useState(false)
  const [holderError, setHolderError] = useState(false)
  const [showEditMeta, setShowEditMeta] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editVideo, setEditVideo] = useState('')

  const { metadata, refetch: refetchMetadata } = useItpMetadata(itp.itpId as `0x${string}` | undefined)
  const { name: deployerName } = useDeployerName(itp.admin as `0x${string}` | undefined)
  const { writeContractAsync, data: txHash, isPending: isWriting } = useChainWriteContract()
  const { isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  // Refetch metadata after tx confirms
  useEffect(() => {
    if (isTxConfirmed) {
      refetchMetadata()
      setShowEditMeta(false)
    }
  }, [isTxConfirmed, refetchMetadata])

  const isDeployer = address && itp.admin && address.toLowerCase() === itp.admin.toLowerCase()

  const handleEditMeta = useCallback(() => {
    setEditDesc(metadata?.description ?? '')
    setEditUrl(metadata?.websiteUrl ?? '')
    setEditVideo(metadata?.videoUrl ?? '')
    setShowEditMeta(true)
  }, [metadata])

  const handleSaveMeta = useCallback(async () => {
    if (!itp.itpId) return
    try {
      await writeContractAsync({
        address: INDEX_PROTOCOL.bridgeProxy,
        abi: BRIDGE_PROXY_ABI,
        functionName: 'setItpMetadata',
        args: [itp.itpId as `0x${string}`, editDesc, editUrl, editVideo],
      })
    } catch {
      // User rejected or tx failed
    }
  }, [writeContractAsync, itp.itpId, editDesc, editUrl, editVideo])

  const { navPerShare, totalAssetCount, pricedAssetCount, isLoading: isNavLoading } = useItpNav(itp.itpId)
  const { shares: userShares } = useUserItpShares(
    itp.itpId as `0x${string}` | undefined,
    address as `0x${string}` | undefined
  )

  // arbAddress is now provided via SSE NAV payload (resolved in data-node poll_nav)
  const effectiveArbAddress = itp.arbAddress ?? undefined

  const isActive = itp.source === 'index' || itp.completed

  const createdDate = itp.createdAt > 0 ? new Date(itp.createdAt * 1000) : null
  const timeAgo = createdDate ? getTimeAgo(createdDate) : ''

  const shortenAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'N/A'

  // Fetch minted balances when details are expanded (low priority migration to REST)
  useEffect(() => {
    // Skip if conditions not met
    if (!showDetails || !effectiveArbAddress) return

    let cancelled = false

    async function fetchHolders() {
      // Ensure publicClient is ready
      if (!publicClient) {
        setHolderError(true)
        return
      }

      setLoadingHolders(true)
      setHolderError(false)

      try {
        const tokenAddr = effectiveArbAddress as `0x${string}`

        // Get total supply with error handling
        let supply: bigint
        try {
          supply = await publicClient.readContract({
            address: tokenAddr,
            abi: ERC20_ABI,
            functionName: 'totalSupply',
          })
        } catch {
          if (!cancelled) {
            setHolderError(true)
            setLoadingHolders(false)
          }
          return
        }

        if (cancelled) return
        if (supply === 0n) {
          setLoadingHolders(false)
          return
        }

        setTotalSupply(supply)

        // Get balances for tracked addresses
        const holderData: TokenHolder[] = []
        for (const tracked of TRACKED_HOLDERS) {
          if (cancelled) return
          try {
            const balance = await publicClient.readContract({
              address: tokenAddr,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [tracked.address],
            })
            if (balance > 0n) {
              holderData.push({
                address: tracked.address,
                label: tracked.label,
                balance,
                percentage: supply > 0n ? Number((balance * 10000n) / supply) / 100 : 0,
              })
            }
          } catch {
            // Skip if can't read balance
          }
        }
        if (!cancelled) {
          setHolders(holderData.sort((a, b) => Number(b.balance - a.balance)))
        }
      } catch {
        if (!cancelled) {
          setHolderError(true)
        }
      }
      if (!cancelled) {
        setLoadingHolders(false)
      }
    }

    fetchHolders()
    return () => { cancelled = true }
  }, [showDetails, publicClient, effectiveArbAddress])

  return (
    <div id={itp.itpId ? `itp-card-${itp.itpId}` : undefined} className="bg-white border-r border-b border-border-light overflow-hidden">
      {/* Video — click-to-play YouTube thumbnail */}
      {(() => {
        const rawUrl = metadata?.videoUrl
        const videoId = rawUrl ? extractYouTubeId(rawUrl) : TEST_VIDEO_IDS[index % TEST_VIDEO_IDS.length]
        if (!videoId) return null
        return <YouTubeLite videoId={videoId} title={itp.name || 'ITP'} />
      })()}

      {/* Card content — mockup: .fund-body padding: 16px 20px */}
      <div className="px-5 py-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-[16px] font-extrabold text-black tracking-[-0.01em]">{itp.name || `ITP #${itp.nonce ?? itp.id}`}</h3>
          {deployerName && <p className="text-[11px] text-text-muted">by {deployerName}</p>}
          <p className="text-[12px] text-text-muted font-mono font-medium">${itp.symbol || 'N/A'}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-[6px] h-[6px] rounded-full ${isActive ? 'bg-color-up' : 'bg-text-muted'}`} />
          <span className={`text-[11px] font-semibold ${isActive ? 'text-color-up' : 'text-text-muted'}`}>{isActive ? 'Active' : 'Pending'}</span>
        </div>
      </div>

      {/* Metrics Row — mockup: .fund-metrics border-t/b, .fund-metric padding: 10px 0, value 15px/700 */}
      {isActive && (
        <div className="grid grid-cols-3 border-t border-b border-border-light -mx-5 px-5">
          <div className="py-2.5 pr-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">NAV / Share</div>
            {isNavLoading || navPerShare === 0 ? (
              <span className="text-sm text-text-muted animate-pulse">...</span>
            ) : (
              <span className="text-[15px] font-bold text-black font-mono tabular-nums">${navPerShare.toFixed(4)}</span>
            )}
          </div>
          <div className="py-2.5 px-3 border-l border-border-light">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">Assets</div>
            <span className="text-[15px] font-bold text-black font-mono tabular-nums">{totalAssetCount || '—'}</span>
          </div>
          <div className="py-2.5 pl-3 border-l border-border-light">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5">Balance</div>
            <span className="text-[15px] font-bold text-black font-mono tabular-nums">
              {address && userShares > 0n ? parseFloat(formatUnits(userShares, 18)).toFixed(2) : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Action links — mockup: .fund-actions padding-top: 12px, .fund-action padding: 6px 0, separator margin: 0 10px */}
      {itp.itpId && isActive && (
        <div className="pt-3 flex items-center flex-wrap">
          <WalletActionButton onClick={onBuy} className="text-[12px] font-bold uppercase tracking-[0.04em] text-brand-dark hover:text-brand transition-colors py-1.5">Buy</WalletActionButton>
          <span className="mx-2.5 text-border-light font-normal">|</span>
          <WalletActionButton onClick={onSell} className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:text-brand transition-colors py-1.5">Sell</WalletActionButton>
          <span className="mx-2.5 text-border-light font-normal">|</span>
          <button onClick={onChart} className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:text-brand transition-colors py-1.5">Chart</button>
          <span className="mx-2.5 text-border-light font-normal">|</span>
          <WalletActionButton onClick={onRebalance} className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:text-brand transition-colors py-1.5">Rebalance</WalletActionButton>
          {effectiveArbAddress && hasLendingMarket(effectiveArbAddress) && (
            <>
              <span className="mx-2.5 text-border-light font-normal">|</span>
              <WalletActionButton onClick={() => onLend(effectiveArbAddress)} className="text-[12px] font-bold uppercase tracking-[0.04em] text-black hover:text-brand transition-colors py-1.5">Borrow</WalletActionButton>
            </>
          )}
        </div>
      )}

      {/* Pending fill status */}
      {itp.itpId && !isActive && (
        <div className="pt-2 text-[11px] text-text-muted uppercase tracking-wider">Pending Fill</div>
      )}

      {/* Expandable details toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="mt-2 text-[11px] text-text-muted hover:text-text-primary transition-colors underline"
      >
        {showDetails ? 'Hide Details' : 'Details'}
      </button>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-border-light space-y-3 text-xs">
          {/* Description + website */}
          {metadata?.description && (
            <p className="text-text-muted line-clamp-3">{metadata.description}</p>
          )}
          {metadata?.websiteUrl && (
            <a
              href={metadata.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-700 hover:text-zinc-900 block truncate"
            >
              {metadata.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          )}

          <div className="text-text-muted space-y-0.5">
            {itp.nonce !== undefined && <p>Request #{itp.nonce}</p>}
            {itp.admin && <p className="truncate">Creator: {shortenAddress(itp.admin)}</p>}
            {timeAgo && <p>{timeAgo}</p>}
          </div>

          {isDeployer && !showEditMeta && (
            <button
              onClick={handleEditMeta}
              className="text-zinc-700 hover:text-zinc-900 underline"
            >
              Edit ITP Info
            </button>
          )}
          {showEditMeta && (
            <div className="bg-muted rounded p-3 space-y-2">
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Description (max 280 chars / ~50 words)"
                className="w-full bg-card border border-border-medium rounded px-2 py-1 text-xs text-text-primary placeholder-text-muted focus:border-zinc-600 outline-none resize-none"
              />
              <input
                type="text"
                value={editUrl}
                onChange={e => setEditUrl(e.target.value)}
                maxLength={128}
                placeholder="Website URL (max 128)"
                className="w-full bg-card border border-border-medium rounded px-2 py-1 text-xs text-text-primary placeholder-text-muted focus:border-zinc-600 outline-none"
              />
              <input
                type="text"
                value={editVideo}
                onChange={e => setEditVideo(e.target.value)}
                maxLength={256}
                placeholder="YouTube URL (max 256)"
                className="w-full bg-card border border-border-medium rounded px-2 py-1 text-xs text-text-primary placeholder-text-muted focus:border-zinc-600 outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveMeta}
                  disabled={isWriting}
                  className="px-3 py-1 bg-zinc-900 text-white text-xs font-semibold rounded hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  {isWriting ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowEditMeta(false)}
                  className="px-3 py-1 border border-border-medium text-text-secondary text-xs rounded hover:border-zinc-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {effectiveArbAddress && (
            <div className="bg-muted rounded p-2 font-mono space-y-1">
              <span className="text-text-muted">Arbitrum ERC20:</span>
              <p className="text-text-secondary break-all">{effectiveArbAddress}</p>
            </div>
          )}

          {itp.itpId && (
            <div className="bg-muted rounded p-2 font-mono">
              <span className="text-text-muted">ITP ID:</span>
              <p className="text-text-secondary break-all">{itp.itpId.slice(0, 22)}...{itp.itpId.slice(-8)}</p>
            </div>
          )}

          {/* Cost Basis / Position */}
          {itp.itpId && isActive && (
            <CostBasisCard itpId={itp.itpId} />
          )}

          {/* Minted Balances Section */}
          {effectiveArbAddress && (
            <div className="bg-muted rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-text-secondary font-medium">Minted Supply</span>
                <span className="text-text-primary font-mono">
                  {parseFloat(formatUnits(totalSupply, 18)).toFixed(4)} {itp.symbol}
                </span>
              </div>
              {loadingHolders ? (
                <div className="text-text-muted text-center py-2">Loading holders...</div>
              ) : holderError ? (
                <div className="text-text-muted text-center py-2">Unable to fetch holders</div>
              ) : holders.length === 0 ? (
                <div className="text-text-muted text-center py-2">No tracked holders</div>
              ) : (
                <div className="space-y-1">
                  {holders.map(holder => (
                    <div key={holder.address} className="flex justify-between items-center">
                      <span className="text-text-secondary">{holder.label}</span>
                      <div className="flex gap-2">
                        <span className="text-text-muted font-mono">
                          {parseFloat(formatUnits(holder.balance, 18)).toFixed(2)}
                        </span>
                        <span className="text-text-primary w-12 text-right font-mono">{holder.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                  {/* Unaccounted balance */}
                  {(() => {
                    const accountedBalance = holders.reduce((sum, h) => sum + h.balance, 0n)
                    const unaccounted = totalSupply - accountedBalance
                    if (unaccounted > 0n && totalSupply > 0n) {
                      return (
                        <div className="flex justify-between items-center pt-1 border-t border-border-light mt-1">
                          <span className="text-color-warning">Other Holders</span>
                          <div className="flex gap-2">
                            <span className="text-color-warning/70 font-mono">
                              {parseFloat(formatUnits(unaccounted, 18)).toFixed(2)}
                            </span>
                            <span className="text-color-warning w-12 text-right">
                              {(Number((unaccounted * 10000n) / totalSupply) / 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Technical Details */}
          <div className="font-mono text-text-muted space-y-0.5">
            {itp.nonce !== undefined && <p>Nonce: {itp.nonce}</p>}
            <p>Source: {itp.source === 'index' ? 'Index.sol (L3)' : 'BridgeProxy'}</p>
            {itp.admin && <p>Admin: {itp.admin}</p>}
            {createdDate && <p>Created: {createdDate.toISOString()}</p>}
            {effectiveArbAddress && <p className="break-all">Arb Address: {effectiveArbAddress}</p>}
            {itp.itpId && <p className="break-all">ITP ID: {itp.itpId}</p>}
          </div>
        </div>
      )}

      </div>{/* end p-6 wrapper */}
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
