'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
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
 * Supports USDC collateral token on Index L3 (Orbit)
 */
export function USDCBalanceCard() {
  const t = useTranslations('portfolio')
  const tc = useTranslations('common')
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
      <Card className="border-border-medium">
        <CardContent className="p-6 flex items-center justify-center min-h-[120px]">
          <p className="text-text-muted text-center">{tc('connect_wallet_to_view')}</p>
        </CardContent>
      </Card>
    )
  }

  // Disconnected state
  if (!isConnected) {
    return (
      <Card className="border-border-medium">
        <CardContent className="p-6 flex items-center justify-center min-h-[120px]">
          <p className="text-text-muted text-center">{tc('connect_wallet_to_view')}</p>
        </CardContent>
      </Card>
    )
  }

  // Loading state with skeleton
  if (isLoading) {
    return (
      <Card className="border-border-medium">
        <CardHeader>
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-8 bg-muted rounded animate-pulse" />
          <div className="h-6 bg-muted rounded animate-pulse w-2/3" />
          <div className="h-6 bg-muted rounded animate-pulse w-1/2" />
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (balanceError) {
    return (
      <Card className="border-border-medium">
        <CardHeader>
          <CardTitle>{t('usdc_balance.title', { symbol: COLLATERAL_SYMBOL })}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-color-down text-sm">{tc('failed_to_load_balance')}</p>
        </CardContent>
      </Card>
    )
  }

  // Determine if we should show $ prefix (only for USD stablecoins)
  const showDollarPrefix = COLLATERAL_SYMBOL === 'USDC' || COLLATERAL_SYMBOL === 'USDT' || COLLATERAL_SYMBOL === 'DAI'

  return (
    <Card className="border-border-medium">
      <CardHeader>
        <CardTitle>{t('usdc_balance.title', { symbol: COLLATERAL_SYMBOL })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Balance - Hero */}
        <div>
          <p className="text-text-muted text-xs mb-1">{t('usdc_balance.total_balance')}</p>
          <p className="text-text-primary text-3xl font-mono font-bold">
            {showDollarPrefix ? '$' : ''}{totalFormatted}{!showDollarPrefix ? ` ${COLLATERAL_SYMBOL}` : ''}
          </p>
        </div>

        {/* Available for Betting */}
        <div>
          <p className="text-text-muted text-xs mb-1">{t('usdc_balance.available_betting')}</p>
          <p className="text-text-primary text-xl font-mono">
            {showDollarPrefix ? '$' : ''}{availableFormatted}{!showDollarPrefix ? ` ${COLLATERAL_SYMBOL}` : ''}
          </p>
        </div>

        {/* Escrowed in Bets */}
        <div>
          <p className="text-text-muted text-xs mb-1">{t('usdc_balance.escrowed_bets')}</p>
          <p className="text-text-primary text-xl font-mono">
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
            className="text-text-muted text-xs hover:text-text-primary underline transition-colors"
          >
            {tc('view_on_explorer')}
          </a>
        </CardFooter>
      )}
    </Card>
  )
}
