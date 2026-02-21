'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useConnect, useDisconnect, useReadContract, usePublicClient, useWaitForTransactionReceipt } from 'wagmi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { BRIDGE_PROXY_ABI, BRIDGED_ITP_FACTORY_ABI } from '@/lib/contracts/index-protocol-abi'
import { toHex, formatUnits } from 'viem'
import { BuyItpModal } from './BuyItpModal'
import { SellItpModal } from './SellItpModal'
import { LendItpModal } from './LendItpModal'
import { ChartModal } from './ChartModal'
import { RebalanceModal } from './RebalanceModal'
import { CostBasisCard } from './CostBasisCard'
import { useItpNav } from '@/hooks/useItpNav'
import { useUserItpShares } from '@/hooks/useUserItpShares'
import { useItpMetadata } from '@/hooks/useItpMetadata'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { hasLendingMarket } from '@/lib/contracts/morpho-markets-registry'
import blacklistedItps from '@/lib/config/blacklisted-itps.json'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { truncateAddress } from '@/lib/utils/address'
import { indexL3 } from '@/lib/wagmi'

// ERC20 ABI for balance queries
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

const INDEX_ITP_ABI = [
  {
    inputs: [],
    name: 'getItpCount',
    outputs: [{ name: 'count', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'itpId', type: 'bytes32' }],
    name: 'getITP',
    outputs: [{
      name: 'itp',
      type: 'tuple',
      components: [
        { name: 'name', type: 'bytes32' },
        { name: 'symbol', type: 'bytes32' },
        { name: 'creator', type: 'address' },
        { name: 'createdAt', type: 'uint256' },
        { name: 'feeRate', type: 'uint256' },
        { name: 'status', type: 'uint256' },
        { name: 'totalSupply', type: 'uint256' },
        { name: 'totalValue', type: 'uint256' },
        { name: 'assetCount', type: 'uint256' },
      ],
    }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

function bytes32ToString(b32: string): string {
  try {
    if (!b32 || b32 === '0x' || b32 === '0x0000000000000000000000000000000000000000000000000000000000000000') return ''
    // Manual hex-to-ASCII: take pairs of hex chars, convert to char codes, skip nulls
    const hex = b32.startsWith('0x') ? b32.slice(2) : b32
    let result = ''
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16)
      if (code === 0) break // null terminator
      if (code >= 32 && code < 127) result += String.fromCharCode(code)
    }
    return result
  } catch {
    return ''
  }
}

interface ItpListingProps {
  onCreateClick?: () => void
  onLendingClick?: () => void
}

const ITEMS_PER_PAGE = 2

export function ItpListing({ onCreateClick, onLendingClick }: ItpListingProps) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnectPending } = useConnect()
  const { disconnect } = useDisconnect()
  const publicClient = usePublicClient()

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
  const [itps, setItps] = useState<ItpInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buyModalItpId, setBuyModalItpId] = useState<string | null>(null)
  const [sellModalItpId, setSellModalItpId] = useState<string | null>(null)
  const [lendModalItp, setLendModalItp] = useState<ItpInfo | null>(null)
  const [chartModalItp, setChartModalItp] = useState<{ itpId: string; name: string; createdAt?: number } | null>(null)
  const [rebalanceModalItp, setRebalanceModalItp] = useState<{ itpId: string; name: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  const { data: nextNonce, refetch: refetchNonce } = useReadContract({
    address: INDEX_PROTOCOL.bridgeProxy,
    abi: BRIDGE_PROXY_ABI,
    functionName: 'nextCreationNonce',
    query: {
      enabled: !!publicClient,
      retry: false,
    },
  })

  const { data: itpCount, refetch: refetchItpCount } = useReadContract({
    address: INDEX_PROTOCOL.index,
    abi: INDEX_ITP_ABI,
    functionName: 'getItpCount',
    query: {
      enabled: !!publicClient,
      retry: false,
    },
  })

  useEffect(() => {
    async function fetchAllItps() {
      if (!publicClient) {
        setLoading(false)
        return
      }

      try {
        const allItps: ItpInfo[] = []

        const count = Number(itpCount || 0)
        for (let i = 1; i <= count; i++) {
          try {
            const itpId = toHex(i, { size: 32 })
            const data = await publicClient.readContract({
              address: INDEX_PROTOCOL.index,
              abi: INDEX_ITP_ABI,
              functionName: 'getITP',
              args: [itpId],
            })

            const itp = data as any
            allItps.push({
              id: itpId,
              itpId: itpId,
              admin: itp.creator,
              name: bytes32ToString(itp.name),
              symbol: bytes32ToString(itp.symbol),
              createdAt: Number(itp.createdAt),
              source: 'index',
              completed: true,
              totalValue: BigInt(itp.totalValue || 0),
              totalSupply: BigInt(itp.totalSupply || 0),
            })
          } catch (e) {
            console.warn(`Failed to fetch Index ITP ${i}:`, e)
          }
        }

        const nonceNum = Number(nextNonce || 0)
        for (let i = 0; i < nonceNum; i++) {
          try {
            const data = await publicClient.readContract({
              address: INDEX_PROTOCOL.bridgeProxy,
              abi: BRIDGE_PROXY_ABI,
              functionName: 'getPendingCreation',
              args: [BigInt(i)],
            }) as unknown as [string, string, string, bigint[], string[], bigint[], bigint, boolean]

            if (data[0] === '0x0000000000000000000000000000000000000000') continue

            const itpInfo: ItpInfo = {
              id: `bridge-${i}`,
              nonce: i,
              admin: data[0],
              name: data[1],
              symbol: data[2],
              createdAt: Number(data[6]),
              source: 'bridge',
              completed: data[7],
            }

            if (data[7]) {
              try {
                const logs = await publicClient.getLogs({
                  address: INDEX_PROTOCOL.bridgeProxy,
                  event: {
                    type: 'event',
                    name: 'ItpCreated',
                    inputs: [
                      { indexed: true, name: 'orbitItpId', type: 'bytes32' },
                      { indexed: true, name: 'bridgedItpAddress', type: 'address' },
                      { indexed: true, name: 'nonce', type: 'uint256' },
                      { indexed: false, name: 'admin', type: 'address' },
                    ],
                  },
                  args: { nonce: BigInt(i) },
                  fromBlock: 0n,
                  toBlock: 'latest',
                })

                if (logs.length > 0) {
                  const log = logs[0]
                  itpInfo.orbitItpId = log.topics[1] as string
                  itpInfo.itpId = log.topics[1] as string
                  itpInfo.arbAddress = `0x${log.topics[2]?.slice(-40)}`
                }
              } catch (e) {
                console.warn(`Failed to fetch ItpCreated event for nonce ${i}:`, e)
              }
            }

            allItps.push(itpInfo)
          } catch (e) {
            console.warn(`Failed to fetch BridgeProxy ITP ${i}:`, e)
          }
        }

        // Fetch totalSupply for bridge ITPs with arbAddress (for AUM sorting)
        for (const itp of allItps) {
          if (itp.source === 'bridge' && itp.completed && itp.arbAddress) {
            try {
              const supply = await publicClient.readContract({
                address: itp.arbAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'totalSupply',
              })
              itp.totalSupply = supply
            } catch { /* skip */ }
          }
        }

        // Deduplicate: bridge-completed ITPs with orbitItpId supersede matching Index ITPs
        // Merge AUM data from Index ITPs into bridge ITPs
        const indexItpMap = new Map<string, ItpInfo>()
        for (const itp of allItps) {
          if (itp.source === 'index' && itp.itpId) indexItpMap.set(itp.itpId, itp)
        }
        const bridgeItpIds = new Set(
          allItps
            .filter(itp => itp.source === 'bridge' && itp.completed && itp.itpId)
            .map(itp => itp.itpId)
        )
        for (const itp of allItps) {
          if (itp.source === 'bridge' && itp.itpId && indexItpMap.has(itp.itpId)) {
            const indexItp = indexItpMap.get(itp.itpId)!
            itp.totalValue = indexItp.totalValue
            if (!itp.totalSupply) itp.totalSupply = indexItp.totalSupply
          }
        }
        const deduped = allItps.filter(itp => {
          if (itp.source === 'index' && bridgeItpIds.has(itp.itpId)) return false
          return true
        })

        // Filter out blacklisted ITPs
        const blacklistSet = new Set((blacklistedItps as string[]).map(id => id.toLowerCase()))
        const filtered = deduped.filter(itp => {
          if (itp.itpId && blacklistSet.has(itp.itpId.toLowerCase())) return false
          return true
        })

        // Sort by AUM (totalValue) descending — active ITPs first, then pending
        filtered.sort((a, b) => {
          const aActive = a.source === 'index' || a.completed
          const bActive = b.source === 'index' || b.completed
          if (aActive !== bActive) return aActive ? -1 : 1
          const aVal = Number(a.totalValue || 0n)
          const bVal = Number(b.totalValue || 0n)
          return bVal - aVal
        })

        setItps(filtered)
        setError(null)
      } catch (e: any) {
        console.error('Failed to fetch ITPs:', e)
        setError(e.message || 'Failed to fetch ITPs')
      } finally {
        setLoading(false)
      }
    }

    fetchAllItps()
  }, [nextNonce, itpCount, publicClient])

  useEffect(() => {
    const interval = setInterval(() => {
      refetchNonce()
      refetchItpCount()
    }, 10000)
    return () => clearInterval(interval)
  }, [refetchNonce, refetchItpCount])

  return (
    <>
      <div className="bg-terminal-dark/50 border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <h2 className="text-xl font-bold text-white">Index Tracking Products</h2>
          <button
            onClick={handleWalletClick}
            disabled={isConnectPending}
            className="px-3 py-2 bg-black border border-white/30 text-white font-mono text-sm rounded hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
          >
            {isConnected && address ? truncateAddress(address) : isConnectPending ? 'Connecting...' : 'Connect Wallet'}
          </button>
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className="px-4 py-2 bg-accent text-terminal font-bold rounded hover:bg-accent/90 transition-colors"
            >
              + Create ITP
            </button>
          )}
          {onLendingClick && (
            <button
              onClick={onLendingClick}
              className="px-3 py-2 bg-accent text-terminal font-bold rounded text-sm hover:bg-accent/90 transition-colors"
            >
              Lending
            </button>
          )}
          <a
            href="https://discord.gg/xsfgzwR6"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-accent text-terminal font-bold rounded text-sm hover:bg-accent/90 transition-colors"
          >
            Support
          </a>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-white/50">Loading ITPs...</div>
        ) : itps.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/50 mb-4">No ITPs created yet</p>
            {onCreateClick && (
              <button onClick={onCreateClick} className="text-accent hover:text-accent/80">
                Create the first ITP →
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {itps.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE).map(itp => (
                <ItpCard
                  key={itp.id}
                  itp={itp}
                  onBuy={() => itp.itpId && setBuyModalItpId(itp.itpId)}
                  onSell={() => itp.itpId && setSellModalItpId(itp.itpId)}
                  onLend={(arbAddr) => setLendModalItp({ ...itp, arbAddress: arbAddr })}
                  onChart={() => itp.itpId && setChartModalItp({ itpId: itp.itpId, name: itp.name || `ITP #${itp.nonce ?? itp.id}`, createdAt: itp.createdAt })}
                  onRebalance={() => itp.itpId && setRebalanceModalItp({ itpId: itp.itpId, name: itp.name || `ITP #${itp.nonce ?? itp.id}` })}
                />
              ))}
            </div>

            {itps.length > ITEMS_PER_PAGE && (
              <div className="flex justify-center items-center gap-4 mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="px-3 py-1 text-sm font-mono border border-white/20 rounded text-white/70 hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <span className="text-xs text-white/50 font-mono">
                  {currentPage + 1} / {Math.ceil(itps.length / ITEMS_PER_PAGE)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(itps.length / ITEMS_PER_PAGE) - 1, p + 1))}
                  disabled={currentPage >= Math.ceil(itps.length / ITEMS_PER_PAGE) - 1}
                  className="px-3 py-1 text-sm font-mono border border-white/20 rounded text-white/70 hover:border-accent hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {buyModalItpId && (
        <BuyItpModal itpId={buyModalItpId} onClose={() => setBuyModalItpId(null)} />
      )}
      {sellModalItpId && (
        <SellItpModal itpId={sellModalItpId} onClose={() => setSellModalItpId(null)} />
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

interface ItpCardProps {
  itp: ItpInfo
  onBuy: () => void
  onSell: () => void
  onLend: (arbAddress: string) => void
  onChart: () => void
  onRebalance: () => void
}

function ItpCard({ itp, onBuy, onSell, onLend, onChart, onRebalance }: ItpCardProps) {
  const { address } = useAccount()
  const [showDetails, setShowDetails] = useState(false)
  const [showEditMeta, setShowEditMeta] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editVideo, setEditVideo] = useState('')

  const { metadata, refetch: refetchMetadata } = useItpMetadata(itp.itpId as `0x${string}` | undefined)
  const { writeContractAsync, data: txHash, isPending: isWriting } = useChainWriteContract()
  const { isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  // Refetch metadata after tx confirms
  useEffect(() => {
    if (isTxConfirmed) {
      refetchMetadata()
      setShowEditMeta(false)
    }
  }, [isTxConfirmed, refetchMetadata])

  const isDeployer = address && address.toLowerCase() === itp.admin.toLowerCase()

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

  // Resolve bridged ERC20 address from BridgedItpFactory for ITPs without arbAddress
  const { data: resolvedArbAddress } = useReadContract({
    address: INDEX_PROTOCOL.bridgedItpFactory,
    abi: BRIDGED_ITP_FACTORY_ABI,
    functionName: 'deployedItps',
    args: itp.itpId ? [itp.itpId as `0x${string}`] : undefined,
    query: {
      enabled: !!itp.itpId && !itp.arbAddress,
    },
  })

  // Use existing arbAddress or the resolved one from factory
  const effectiveArbAddress = itp.arbAddress ?? (
    resolvedArbAddress && resolvedArbAddress !== '0x0000000000000000000000000000000000000000'
      ? resolvedArbAddress
      : undefined
  )

  const isActive = itp.source === 'index' || itp.completed
  const statusColor = isActive ? 'text-green-400' : 'text-yellow-400'
  const statusBg = isActive ? 'bg-green-500/20' : 'bg-yellow-500/20'
  const statusText = itp.source === 'index' ? 'Active (L3)' : itp.completed ? 'Active (Bridged)' : 'Pending Consensus'

  const createdDate = new Date(itp.createdAt * 1000)
  const timeAgo = getTimeAgo(createdDate)

  const shortenAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'N/A'

  return (
    <div className="bg-terminal-dark border border-white/10 rounded-lg overflow-hidden hover:border-accent/50 transition-colors">
      {/* Video embed — flush top, full width (only if videoUrl set) */}
      {metadata?.videoUrl && (
        <div className="aspect-video bg-black">
          <iframe
            src={metadata.videoUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={`${itp.name || 'ITP'} video`}
          />
        </div>
      )}

      {/* Card content */}
      <div className="p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold text-white">{itp.name || `ITP #${itp.nonce ?? itp.id}`}</h3>
          <p className="text-accent font-mono">${itp.symbol || 'N/A'}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${statusColor} ${statusBg}`}>
          {statusText}
        </span>
      </div>

      {isActive && (
        <div className="bg-black/30 rounded p-3 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/50">NAV / Share</span>
            {isNavLoading || navPerShare === 0 ? (
              <span className="text-sm text-white/40 animate-pulse">Loading...</span>
            ) : (
              <span className="text-lg font-bold text-accent font-mono">${navPerShare.toFixed(6)}</span>
            )}
          </div>
          {totalAssetCount > 0 && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-white/40">{totalAssetCount} assets</span>
              <span className="text-xs text-white/40">{pricedAssetCount}/{totalAssetCount} priced</span>
            </div>
          )}
          {address && userShares > 0n && (
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
              <span className="text-xs text-white/50">Your Balance</span>
              <span className="text-sm font-bold text-white font-mono">
                {parseFloat(formatUnits(userShares, 18)).toFixed(4)} {itp.symbol || 'shares'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Description + website */}
      {metadata?.description && (
        <p className="text-xs text-white/60 mb-2 line-clamp-3">{metadata.description}</p>
      )}
      {metadata?.websiteUrl && (
        <a
          href={metadata.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:text-accent/80 mb-2 block truncate"
        >
          {metadata.websiteUrl.replace(/^https?:\/\//, '')}
        </a>
      )}

      <div className="text-sm text-white/50 mb-4 space-y-1">
        {itp.nonce !== undefined && <p>Request #{itp.nonce}</p>}
        <p className="truncate">Creator: {shortenAddress(itp.admin)}</p>
        {isDeployer && !showEditMeta && (
          <button
            onClick={handleEditMeta}
            className="text-xs text-accent hover:text-accent/80 underline"
          >
            Edit ITP Info
          </button>
        )}
        {showEditMeta && (
          <div className="bg-black/30 rounded p-3 space-y-2 mt-1">
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Description (max 280 chars / ~50 words)"
              className="w-full bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-white/30 focus:border-accent outline-none resize-none"
            />
            <input
              type="text"
              value={editUrl}
              onChange={e => setEditUrl(e.target.value)}
              maxLength={128}
              placeholder="Website URL (max 128)"
              className="w-full bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-white/30 focus:border-accent outline-none"
            />
            <input
              type="text"
              value={editVideo}
              onChange={e => setEditVideo(e.target.value)}
              maxLength={256}
              placeholder="YouTube URL (max 256)"
              className="w-full bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-white/30 focus:border-accent outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveMeta}
                disabled={isWriting}
                className="px-3 py-1 bg-accent text-terminal text-xs font-bold rounded hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {isWriting ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowEditMeta(false)}
                className="px-3 py-1 border border-white/20 text-white/70 text-xs rounded hover:border-white/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <p>{timeAgo}</p>
      </div>

      {effectiveArbAddress && (
        <div className="bg-black/30 rounded p-3 mb-4 text-xs font-mono space-y-2">
          <div>
            <span className="text-white/40">Arbitrum ERC20:</span>
            <p className="text-accent break-all">{effectiveArbAddress}</p>
          </div>
        </div>
      )}

      {itp.itpId && (
        <div className="bg-black/30 rounded p-3 mb-4 text-xs font-mono">
          <span className="text-white/40">ITP ID:</span>
          <p className="text-white/60 break-all">{itp.itpId.slice(0, 22)}...{itp.itpId.slice(-8)}</p>
        </div>
      )}

      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full py-2 border border-white/20 rounded text-white/70 text-sm hover:border-white/40 transition-colors"
      >
        {showDetails ? 'Hide Details' : 'View Details'}
      </button>

      {showDetails && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
          {/* Cost Basis / Position */}
          {itp.itpId && isActive && (
            <CostBasisCard itpId={itp.itpId} />
          )}

          {/* Technical Details */}
          <div className="text-xs font-mono text-white/40 space-y-1">
            {itp.nonce !== undefined && <p>Nonce: {itp.nonce}</p>}
            <p>Source: {itp.source === 'index' ? 'Index.sol (L3)' : 'BridgeProxy'}</p>
            <p>Admin: {itp.admin}</p>
            <p>Created: {createdDate.toISOString()}</p>
            {effectiveArbAddress && <p className="break-all">Arb Address: {effectiveArbAddress}</p>}
            {itp.itpId && <p className="break-all">ITP ID: {itp.itpId}</p>}
          </div>
        </div>
      )}

      {itp.itpId && isActive && (
        <div className="mt-3 flex gap-2">
          <WalletActionButton
            onClick={onBuy}
            className="flex-1 py-2 bg-accent text-terminal font-bold rounded text-sm text-center hover:bg-accent/90 transition-colors"
          >
            Buy
          </WalletActionButton>
          <WalletActionButton
            onClick={onSell}
            className="flex-1 py-2 border border-white/20 text-white font-bold rounded text-sm text-center hover:border-white/40 transition-colors"
          >
            Sell
          </WalletActionButton>
          <button
            onClick={onChart}
            className="flex-1 py-2 border border-white/20 text-white/70 font-bold rounded text-sm text-center hover:border-accent hover:text-accent transition-colors"
          >
            Chart
          </button>
          <WalletActionButton
            onClick={onRebalance}
            className="flex-1 py-2 border border-white/20 text-white/70 font-bold rounded text-sm text-center hover:border-accent hover:text-accent transition-colors"
          >
            Rebalance
          </WalletActionButton>
          {effectiveArbAddress && hasLendingMarket(effectiveArbAddress) && (
            <WalletActionButton
              onClick={() => onLend(effectiveArbAddress)}
              className="flex-1 py-2 border border-accent/50 text-accent font-bold rounded text-sm text-center hover:border-accent hover:bg-accent/10 transition-colors"
            >
              Borrow
            </WalletActionButton>
          )}
        </div>
      )}
      </div>{/* end p-4 wrapper */}
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
