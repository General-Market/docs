'use client'

import { useEffect, useRef } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { indexL3 } from '@/lib/wagmi'
import { useL3GasBalance } from '@/hooks/vision/useL3GasBalance'
import { useDeployment } from '@/hooks/useDeployment'
import { useWaitlistStatus } from '@/hooks/useWaitlistStatus'

const FAUCET_ENABLED = process.env.NEXT_PUBLIC_FAUCET_ENABLED === 'true'
const COOLDOWN_MS = 24 * 60 * 60 * 1000

const ERC20_BALANCE_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const

const lsKey = (addr: string) => `auto-faucet-${addr.toLowerCase()}`

/**
 * Silently top up a freshly connected wallet on L3.
 *
 * Mounted once at the app root. When the wallet is connected and either L3 GM
 * gas is below the low threshold or L3 USDC is zero, POST /api/faucet once and
 * stamp localStorage so the same address isn't dripped again for 24h. The
 * manual faucet buttons in BatchEntryPanel / BuyItpModal / HeaderBalanceBar
 * remain — this just removes the requirement that the user find one. Mobile,
 * which has no header faucet button at all, becomes self-serving.
 */
export function useAutoFaucet() {
  const { address, isConnected } = useAccount()
  const { isLow, isLoading: isGasLoading, refetch: refetchGas } = useL3GasBalance()
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')
  const { whitelisted } = useWaitlistStatus()

  const { data: usdcBalanceRaw, refetch: refetchUsdc } = useReadContract({
    address: usdcAddress,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: indexL3.id,
    query: {
      enabled: !!address && usdcAddress !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 15_000,
    },
  })

  const inFlight = useRef(false)

  useEffect(() => {
    if (!FAUCET_ENABLED) return
    if (!isConnected || !address) return
    if (isGasLoading) return
    if (inFlight.current) return
    if (whitelisted !== true) return

    const usdcBalance = (usdcBalanceRaw as bigint | undefined) ?? 0n
    const needsGas = isLow
    const needsUsdc = usdcBalance === 0n
    if (!needsGas && !needsUsdc) return

    try {
      const last = window.localStorage.getItem(lsKey(address))
      if (last) {
        const ts = Number(last)
        if (Number.isFinite(ts) && Date.now() - ts < COOLDOWN_MS) return
      }
    } catch {
      // private mode / restricted localStorage — fall through and try anyway.
    }

    inFlight.current = true
    void (async () => {
      try {
        const res = await fetch('/api/faucet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, amount: '1000', scope: 'vision' }),
        })
        const data = await res.json().catch(() => ({}))
        const ok = res.ok
          && data?.success
          && !data?.vision?.usdc?.error
          && !data?.vision?.gas?.error
        if (ok) {
          try { window.localStorage.setItem(lsKey(address), String(Date.now())) } catch { /* ignore */ }
          setTimeout(() => { refetchUsdc(); refetchGas() }, 2_000)
          setTimeout(() => { refetchUsdc(); refetchGas() }, 6_000)
        }
      } catch {
        // Network error or faucet down. The manual button paths still exist;
        // nothing to do here. Next page nav reruns the effect.
      } finally {
        inFlight.current = false
      }
    })()
  }, [address, isConnected, isLow, isGasLoading, usdcBalanceRaw, refetchGas, refetchUsdc, whitelisted])
}
