'use client'

import { useState, useCallback } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'
import { useTranslations } from 'next-intl'
import { useDeployment } from '@/hooks/useDeployment'
import { indexL3 } from '@/lib/wagmi'

const isFaucetEnabled = process.env.NEXT_PUBLIC_FAUCET_ENABLED === 'true'

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

export function VisionBalanceBar() {
  const t = useTranslations('vision')
  const { address, isConnected } = useAccount()
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')

  // Read wallet USDC balance directly (no Vision dual-balance)
  const { data: walletBalance, isLoading, refetch } = useReadContract({
    address: usdcAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && usdcAddress !== '0x0000000000000000000000000000000000000000', refetchInterval: 15_000 },
  })

  const balance = (walletBalance as bigint | undefined) ?? 0n

  const faucetKey = address ? `faucet_used_${address.toLowerCase()}` : ''
  const alreadyUsed = typeof window !== 'undefined' && !!faucetKey && !!localStorage.getItem(faucetKey)
  const [faucetState, setFaucetState] = useState<'idle' | 'loading' | 'done' | 'error'>(alreadyUsed ? 'done' : 'idle')
  const handleFaucet = useCallback(async () => {
    if (!address || faucetState === 'loading' || alreadyUsed) return
    setFaucetState('loading')
    try {
      const res = await fetch('/api/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, amount: '1000', gas: true }),
      })
      if (!res.ok) throw new Error()
      localStorage.setItem(faucetKey, '1')
      setFaucetState('done')
      setTimeout(() => refetch(), 2000)
    } catch {
      setFaucetState('error')
      setTimeout(() => setFaucetState('idle'), 3000)
    }
  }, [address, faucetState, refetch, alreadyUsed, faucetKey])

  if (!isConnected) return null
  if (isLoading) return null

  const canFaucet = isFaucetEnabled && balance === 0n

  return (
    <div className="relative group flex items-center gap-1.5 sm:gap-2">
      <span
        className={`text-caption sm:text-caption font-bold font-mono tabular-nums text-white ${canFaucet ? 'cursor-pointer' : ''}`}
        onClick={canFaucet ? handleFaucet : undefined}
      >
        <span className="hidden sm:inline text-text-muted font-medium mr-1">{t('vision_balance_bar.balance_label')}</span>
        <span className="group-hover:hidden">
          {fmtCompact(balance, VISION_USDC_DECIMALS)}
          <span className="hidden sm:inline text-text-muted font-medium ml-1">USDC</span>
        </span>
        {canFaucet && (
          <span className={`hidden group-hover:inline text-[11px] font-semibold ${
            faucetState === 'loading' ? 'text-zinc-400'
              : faucetState === 'done' ? 'text-emerald-300'
              : faucetState === 'error' ? 'text-red-300'
              : 'text-emerald-300'
          }`}>
            {faucetState === 'loading' ? 'Minting...'
              : faucetState === 'done' ? '1K USDC + gas sent'
              : faucetState === 'error' ? 'Failed — retry'
              : 'Get test USDC + gas'}
          </span>
        )}
      </span>
    </div>
  )
}
