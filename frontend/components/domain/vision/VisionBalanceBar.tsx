'use client'

import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { VISION_USDC_DECIMALS, VISION_ADDRESS } from '@/lib/vision/constants'
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { useDeployment } from '@/hooks/useDeployment'
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

export function VisionBalanceBar() {
  const t = useTranslations('vision')
  const { address, isConnected } = useAccount()
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')

  // Read wallet USDC balance directly (no Vision dual-balance)
  const { data: walletBalance, isLoading } = useReadContract({
    address: usdcAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && usdcAddress !== '0x0000000000000000000000000000000000000000' },
  })

  const balance = (walletBalance as bigint | undefined) ?? 0n
  const fmtBal = (v: bigint) => parseFloat(formatUnits(v, VISION_USDC_DECIMALS)).toFixed(2)

  if (!isConnected) {
    return (
      <Link href="/points" className="text-label font-bold font-mono text-text-muted hover:text-black transition-colors">
        0 pts
      </Link>
    )
  }

  if (isLoading) return null

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="text-caption sm:text-caption font-bold font-mono tabular-nums text-black">
        <span className="hidden sm:inline text-text-muted font-medium mr-1">{t('vision_balance_bar.balance_label')}</span>
        {fmtBal(balance)}
        <span className="hidden sm:inline text-text-muted font-medium ml-1">USDC</span>
      </span>
      <Link href="/points" className="hidden sm:inline text-label font-bold font-mono text-color-up hover:opacity-80 transition-opacity">
        pts
      </Link>
    </div>
  )
}
