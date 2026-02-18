'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract, usePublicClient } from 'wagmi'
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
import { hasLendingMarket } from '@/lib/contracts/morpho-markets-registry'

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
}

const ITEMS_PER_PAGE = 2

export function ItpListing({ onCreateClick }: ItpListingProps) {
  const publicClient = usePublicClient()
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

        // Deduplicate: bridge-completed ITPs with orbitItpId supersede matching Index ITPs
        const bridgeItpIds = new Set(
          allItps
            .filter(itp => itp.source === 'bridge' && itp.completed && itp.itpId)
            .map(itp => itp.itpId)
        )
        const deduped = allItps.filter(itp => {
          if (itp.source === 'index' && bridgeItpIds.has(itp.itpId)) return false
          return true
        })

        setItps(deduped)
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Index Tracking Products</h2>
            <p className="text-sm text-white/50">
              {itpCount !== undefined ? `${Number(itpCount)} on Index` : ''}
              {nextNonce !== undefined && Number(nextNonce) > 0 ? ` · ${Number(nextNonce)} via Bridge` : ''}
            </p>
          </div>
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className="px-4 py-2 bg-accent text-terminal font-bold rounded hover:bg-accent/90 transition-colors"
            >
              + Create ITP
            </button>
          )}
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

interface TokenHolder {
  address: `0x${string}`
  label: string
  balance: bigint
  percentage: number
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
  const publicClient = usePublicClient()
  const [showDetails, setShowDetails] = useState(false)
  const [totalSupply, setTotalSupply] = useState<bigint>(0n)
  const [holders, setHolders] = useState<TokenHolder[]>([])
  const [loadingHolders, setLoadingHolders] = useState(false)
  const [holderError, setHolderError] = useState(false)

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

  // Fetch minted balances when details are expanded and we have an arbAddress
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
    <div className="bg-terminal-dark border border-white/10 rounded-lg p-4 hover:border-accent/50 transition-colors">
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

      <div className="text-sm text-white/50 mb-4 space-y-1">
        {itp.nonce !== undefined && <p>Request #{itp.nonce}</p>}
        <p className="truncate">Creator: {shortenAddress(itp.admin)}</p>
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

          {/* Minted Balances Section */}
          {effectiveArbAddress && (
            <div className="bg-black/20 rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-white/60 font-bold">Minted Supply</span>
                <span className="text-xs text-accent font-mono">
                  {parseFloat(formatUnits(totalSupply, 18)).toFixed(4)} {itp.symbol}
                </span>
              </div>
              {loadingHolders ? (
                <div className="text-xs text-white/40 text-center py-2">Loading holders...</div>
              ) : holderError ? (
                <div className="text-xs text-white/40 text-center py-2">Unable to fetch holders</div>
              ) : holders.length === 0 ? (
                <div className="text-xs text-white/40 text-center py-2">No tracked holders</div>
              ) : (
                <div className="space-y-1">
                  {holders.map(holder => (
                    <div key={holder.address} className="flex justify-between items-center text-xs">
                      <span className="text-white/70">{holder.label}</span>
                      <div className="flex gap-2">
                        <span className="text-white/50 font-mono">
                          {parseFloat(formatUnits(holder.balance, 18)).toFixed(2)}
                        </span>
                        <span className="text-accent w-12 text-right">{holder.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                  {/* Unaccounted balance */}
                  {(() => {
                    const accountedBalance = holders.reduce((sum, h) => sum + h.balance, 0n)
                    const unaccounted = totalSupply - accountedBalance
                    if (unaccounted > 0n && totalSupply > 0n) {
                      return (
                        <div className="flex justify-between items-center text-xs pt-1 border-t border-white/10 mt-1">
                          <span className="text-yellow-400">Other Holders</span>
                          <div className="flex gap-2">
                            <span className="text-yellow-400/70 font-mono">
                              {parseFloat(formatUnits(unaccounted, 18)).toFixed(2)}
                            </span>
                            <span className="text-yellow-400 w-12 text-right">
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
          <button
            onClick={onBuy}
            className="flex-1 py-2 bg-accent text-terminal font-bold rounded text-sm text-center hover:bg-accent/90 transition-colors"
          >
            Buy
          </button>
          <button
            onClick={onSell}
            className="flex-1 py-2 border border-white/20 text-white font-bold rounded text-sm text-center hover:border-white/40 transition-colors"
          >
            Sell
          </button>
          <button
            onClick={onChart}
            className="flex-1 py-2 border border-white/20 text-white/70 font-bold rounded text-sm text-center hover:border-accent hover:text-accent transition-colors"
          >
            Chart
          </button>
          <button
            onClick={onRebalance}
            className="flex-1 py-2 border border-white/20 text-white/70 font-bold rounded text-sm text-center hover:border-accent hover:text-accent transition-colors"
          >
            Rebalance
          </button>
          {effectiveArbAddress && hasLendingMarket(effectiveArbAddress) && (
            <button
              onClick={() => onLend(effectiveArbAddress)}
              className="flex-1 py-2 border border-accent/50 text-accent font-bold rounded text-sm text-center hover:border-accent hover:bg-accent/10 transition-colors"
            >
              Borrow
            </button>
          )}
        </div>
      )}
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
