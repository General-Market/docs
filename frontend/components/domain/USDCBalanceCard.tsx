'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import { useEscrowedAmount } from '@/hooks/useEscrowedAmount'
import { getAddressUrl } from '@/lib/utils/basescan'
import { formatUsdcAmount } from '@/lib/utils/formatters'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card'
import { COLLATERAL_SYMBOL, CHAIN_ID } from '@/lib/contracts/addresses'

/**
 * Collateral Balance Card Component
 * Displays total balance, available for betting, and escrowed amounts
 * Uses Shadcn/ui Card component with JetBrains Mono font for numbers
 * Auto-refreshes every 5 seconds via hooks
 * Supports WIND collateral token on Index L3 (Orbit)
 */
export function USDCBalanceCard() {
  const [mounted, setMounted] = useState(false)
  const { address, isConnected } = useAccount()

  // Prevent hydration mismatch by only rendering wallet-dependent UI after mount
  useEffect(() => {
    setMounted(true)
  }, [])
  const { balance, formatted: totalFormatted, isLoading: balanceLoading, isError: balanceError } = useUsdcBalance()
  const { escrowed, formatted: escrowedFormatted, isLoading: escrowLoading } = useEscrowedAmount()

  const isLoading = balanceLoading || escrowLoading

  // Calculate available = total - escrowed (escrowed is always defined as bigint)
  const available = balance !== undefined && balance >= escrowed
    ? balance - escrowed
    : BigInt(0)

  const availableFormatted = formatUsdcAmount(available)

  // SSR placeholder - render consistent skeleton during hydration
  if (!mounted) {
    return (
      <Card className="border-white/20">
        <CardContent className="p-6 flex items-center justify-center min-h-[120px]">
          <p className="text-white/60 text-center">Connect wallet to view balance</p>
        </CardContent>
      </Card>
    )
  }

  // Disconnected state
  if (!isConnected) {
    return (
      <Card className="border-white/20">
        <CardContent className="p-6 flex items-center justify-center min-h-[120px]">
          <p className="text-white/60 text-center">Connect wallet to view balance</p>
        </CardContent>
      </Card>
    )
  }

  // Loading state with skeleton
  if (isLoading) {
    return (
      <Card className="border-white/20">
        <CardHeader>
          <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-8 bg-white/10 rounded animate-pulse" />
          <div className="h-6 bg-white/10 rounded animate-pulse w-2/3" />
          <div className="h-6 bg-white/10 rounded animate-pulse w-1/2" />
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (balanceError) {
    return (
      <Card className="border-white/20">
        <CardHeader>
          <CardTitle>{COLLATERAL_SYMBOL} Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-accent text-sm">Failed to load balance. Retrying...</p>
        </CardContent>
      </Card>
    )
  }

  // Determine if we should show $ prefix (only for USD stablecoins)
  const showDollarPrefix = COLLATERAL_SYMBOL === 'USDC' || COLLATERAL_SYMBOL === 'USDT' || COLLATERAL_SYMBOL === 'DAI'

  return (
    <Card className="border-white/20">
      <CardHeader>
        <CardTitle>{COLLATERAL_SYMBOL} Balance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Balance - Hero */}
        <div>
          <p className="text-white/60 text-xs mb-1">Total Balance</p>
          <p className="text-white text-3xl font-mono font-bold">
            {showDollarPrefix ? '$' : ''}{totalFormatted}{!showDollarPrefix ? ` ${COLLATERAL_SYMBOL}` : ''}
          </p>
        </div>

        {/* Available for Betting */}
        <div>
          <p className="text-white/60 text-xs mb-1">Available for Betting</p>
          <p className="text-white text-xl font-mono">
            {showDollarPrefix ? '$' : ''}{availableFormatted}{!showDollarPrefix ? ` ${COLLATERAL_SYMBOL}` : ''}
          </p>
        </div>

        {/* Escrowed in Bets */}
        <div>
          <p className="text-white/60 text-xs mb-1">Escrowed in Bets</p>
          <p className="text-white text-xl font-mono">
            {showDollarPrefix ? '$' : ''}{escrowedFormatted}{!showDollarPrefix ? ` ${COLLATERAL_SYMBOL}` : ''}
          </p>
        </div>
      </CardContent>

      {/* Verify on Explorer Link */}
      {address && (
        <CardFooter>
          <a
            href={getAddressUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 text-xs hover:text-white underline transition-colors"
          >
            View on Explorer
          </a>
        </CardFooter>
      )}
    </Card>
  )
}
