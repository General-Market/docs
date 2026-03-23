'use client'

import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { useDeployment } from '@/hooks/useDeployment'
import { usePoints } from '@/hooks/usePoints'
import { indexL3 } from '@/lib/wagmi'

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

function fmtCompact(v: bigint, decimals: number): string {
  const num = parseFloat(formatUnits(v, decimals))
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toFixed(2)
}

function fmtPoints(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  if (n >= 1) return Math.floor(n).toLocaleString()
  return '0'
}

export function VisionBalanceBar() {
  const t = useTranslations('vision')
  const { address, isConnected } = useAccount()
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')
  const { points } = usePoints(address)

  // Read wallet USDC balance directly (no Vision dual-balance)
  const { data: walletBalance, isLoading } = useReadContract({
    address: usdcAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && usdcAddress !== '0x0000000000000000000000000000000000000000' },
  })

  if (!isConnected) {
    return (
      <Link href="/points" className="text-label font-bold font-mono text-text-muted hover:text-black transition-colors">
        0 pts
      </Link>
    )
  }

  if (isLoading) return null

  const balance = (walletBalance as bigint | undefined) ?? 0n

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="text-caption sm:text-caption font-bold font-mono tabular-nums text-white">
        <span className="hidden sm:inline text-text-muted font-medium mr-1">{t('vision_balance_bar.balance_label')}</span>
        {fmtCompact(balance, VISION_USDC_DECIMALS)}
        <span className="hidden sm:inline text-text-muted font-medium ml-1">USDC</span>
      </span>
      <Link href="/points" className="hidden sm:inline text-label font-bold font-mono text-color-up hover:opacity-80 transition-opacity">
        {fmtPoints(points.total)} pts
      </Link>
    </div>
  )
}
