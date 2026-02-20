'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePublicClient, useBalance } from 'wagmi'
import { formatEther, formatUnits } from 'viem'
import { INDEX_PROTOCOL, COLLATERAL_TOKEN_ADDRESS, COLLATERAL_SYMBOL, COLLATERAL_DECIMALS } from '@/lib/contracts/addresses'
import { useApBalances } from '@/hooks/useApBalances'

// AP address from index-system.env
const AP_ADDRESS = '0x20A85a164C64B603037F647eb0E0aDeEce0BE5AC' as `0x${string}`
const AP_URL = process.env.NEXT_PUBLIC_AP_URL || 'http://localhost:9100'

// Pagination config
const ITEMS_PER_PAGE = 25

// ERC20 balanceOf ABI
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export function APBalanceCard() {
  const publicClient = usePublicClient()
  const [collateralBalance, setCollateralBalance] = useState<bigint>(0n)
  const [loading, setLoading] = useState(true)
  const [apHealth, setApHealth] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  // Vault balances via hook
  const { assets: vaultAssets, totalUsdValue, totalTokenCount, isLoading: vaultLoading, refresh: refreshVault } = useApBalances()

  // Pagination
  const totalPages = Math.ceil(vaultAssets.length / ITEMS_PER_PAGE)
  const paginatedAssets = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE
    return vaultAssets.slice(start, start + ITEMS_PER_PAGE)
  }, [vaultAssets, currentPage])

  // Fetch native balance
  const { data: nativeBalance, refetch: refetchNative } = useBalance({
    address: AP_ADDRESS,
  })

  // Check AP health endpoint
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(`${AP_URL}/health`)
        if (res.ok) {
          const data = await res.json()
          setApHealth(data.status || 'unknown')
        } else {
          setApHealth('unhealthy')
        }
      } catch {
        setApHealth('offline')
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 10000)
    return () => clearInterval(interval)
  }, [])

  // Fetch collateral token balance
  useEffect(() => {
    async function fetchCollateral() {
      if (!publicClient) return
      try {
        const balance = await publicClient.readContract({
          address: COLLATERAL_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [AP_ADDRESS],
        })
        setCollateralBalance(balance)
      } catch {
        // Token may not exist
      }
      setLoading(false)
    }
    fetchCollateral()
    const interval = setInterval(fetchCollateral, 15000)
    return () => clearInterval(interval)
  }, [publicClient])

  // Refresh native every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => { refetchNative() }, 10000)
    return () => clearInterval(interval)
  }, [refetchNative])

  const healthColor = apHealth === 'healthy' ? 'text-color-up' : apHealth === 'offline' ? 'text-color-down' : 'text-color-warning'
  const healthBg = apHealth === 'healthy' ? 'bg-surface-up' : apHealth === 'offline' ? 'bg-surface-down' : 'bg-surface-warning'

  return (
    <div className="bg-white rounded-xl shadow-card p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${healthColor} ${healthBg}`}>
            {apHealth || 'checking...'}
          </span>
          <button
            onClick={refreshVault}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            title="Refresh balances"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* AP Address */}
      <div className="text-xs text-text-muted mb-4 font-mono">
        Address: {AP_ADDRESS}
      </div>

      {/* Balances */}
      <div className="space-y-3">
        {/* Native Balance */}
        <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-text-secondary">Native (Gas)</p>
            <p className="text-xs text-text-muted">ETH</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-text-primary font-mono tabular-nums">
              {nativeBalance ? parseFloat(formatEther(nativeBalance.value)).toFixed(4) : '...'}
            </p>
            <p className="text-xs text-text-muted">{nativeBalance?.symbol || 'ETH'}</p>
          </div>
        </div>

        {/* Collateral Token */}
        {collateralBalance > 0n && (
          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-text-secondary">{COLLATERAL_SYMBOL}</p>
              <p className="text-xs text-text-muted truncate" style={{ maxWidth: '150px' }}>{COLLATERAL_TOKEN_ADDRESS}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-text-primary font-mono tabular-nums">
                {parseFloat(formatUnits(collateralBalance, COLLATERAL_DECIMALS)).toFixed(4)}
              </p>
              <p className="text-xs text-text-muted">{COLLATERAL_SYMBOL}</p>
            </div>
          </div>
        )}
      </div>

      {/* Vault Token Balances */}
      <div className="mt-6 pt-4 border-t border-border-light">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-text-primary">
            MockBitgetVault Holdings
            {totalTokenCount > 0 && <span className="text-text-muted font-normal ml-2">({totalTokenCount} tokens)</span>}
          </h3>
          {totalUsdValue > 0 && (
            <span className="text-sm font-bold text-zinc-900 font-mono tabular-nums">${totalUsdValue.toFixed(2)}</span>
          )}
        </div>

        <div className="text-xs text-text-muted mb-3 font-mono">
          Vault: {INDEX_PROTOCOL.mockBitgetVault}
        </div>

        {vaultLoading ? (
          <div className="text-center py-4 text-text-secondary text-sm">Loading vault balances...</div>
        ) : vaultAssets.length === 0 ? (
          <div className="text-center py-4 text-text-secondary text-sm">No assets in vault</div>
        ) : (
          <div className="space-y-0">
            {/* Table header */}
            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-text-secondary bg-muted px-3 py-2 rounded-t-lg">
              <span>Asset</span>
              <span className="text-right">Balance</span>
              <span className="text-right">Price</span>
              <span className="text-right">USD Value</span>
            </div>
            {paginatedAssets.map((asset, idx) => (
              <div key={asset.address} className={`grid grid-cols-4 gap-2 items-center px-3 py-2.5 text-sm border-b border-border-light ${idx % 2 === 1 ? 'bg-muted/50' : ''}`}>
                <span className="text-text-primary font-medium">{asset.symbol}</span>
                <span className="text-right text-text-secondary font-mono tabular-nums">{parseFloat(formatUnits(asset.balance, 18)).toFixed(4)}</span>
                <span className="text-right text-text-muted font-mono tabular-nums">
                  {asset.price > 0n ? `$${parseFloat(formatUnits(asset.price, 18)).toFixed(2)}` : '-'}
                </span>
                <span className="text-right text-text-primary font-bold font-mono tabular-nums">
                  {asset.usdValue > 0 ? `$${asset.usdValue.toFixed(2)}` : '-'}
                </span>
              </div>
            ))}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center pt-3 border-t border-border-light">
                <span className="text-xs text-text-muted">
                  Page {currentPage + 1} of {totalPages} ({vaultAssets.length} assets)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="px-3 py-1 text-xs bg-muted text-text-primary rounded-md disabled:opacity-30 disabled:cursor-not-allowed hover:bg-border-light transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="px-3 py-1 text-xs bg-muted text-text-primary rounded-md disabled:opacity-30 disabled:cursor-not-allowed hover:bg-border-light transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
