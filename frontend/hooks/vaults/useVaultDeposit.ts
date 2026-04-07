'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { useChainWriteContract, ensureCorrectChain } from '@/hooks/useChainWrite'
import { useTransactionNotification } from '@/hooks/useTransactionNotification'
import { VISION_VAULT_ABI } from '@/lib/contracts/vault-abi'
import { useDeployment } from '@/hooks/useDeployment'
import { indexL3 } from '@/lib/wagmi'
import { useSwitchChain } from 'wagmi'

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

type Step = 'idle' | 'approving' | 'depositing' | 'claiming' | 'done' | 'error'

export interface UseVaultDepositReturn {
  deposit: (vaultAddress: `0x${string}`, amount: bigint) => void
  step: Step
  isPending: boolean
  isConfirming: boolean
  error: string | null
  reset: () => void
}

function parseError(err: Error): string {
  const msg = err.message || ''
  if (msg.includes('User rejected') || msg.includes('user rejected')) return 'Transaction rejected in wallet.'
  if (msg.includes('ERC20InsufficientBalance') || msg.includes('transfer amount exceeds balance'))
    return 'Insufficient USDC balance.'
  if (msg.includes('ERC20InsufficientAllowance') || msg.includes('allowance'))
    return 'USDC allowance too low. Try again.'
  return msg.replace(/^ContractFunctionRevertedError:\s*/, '').slice(0, 200) || 'Transaction reverted.'
}

export function useVaultDeposit(): UseVaultDepositReturn {
  const { address, chainId: currentChainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { getAddress } = useDeployment()
  const usdcAddress = getAddress('L3_WUSDC')

  const [step, setStep] = useState<Step>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pendingVault, setPendingVault] = useState<`0x${string}` | null>(null)
  const [pendingAmount, setPendingAmount] = useState<bigint>(0n)

  const approveHandled = useRef(false)
  const depositHandled = useRef(false)
  const claimHandled = useRef(false)

  // Approve tx
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useChainWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash, chainId: indexL3.id })

  // RequestDeposit tx
  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositPending,
    error: depositError,
    reset: resetDeposit,
  } = useChainWriteContract()
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } =
    useWaitForTransactionReceipt({ hash: depositHash, chainId: indexL3.id })

  // ClaimDeposit tx — mints shares for the pending request
  const {
    writeContract: writeClaim,
    data: claimHash,
    isPending: isClaimPending,
    error: claimError,
    reset: resetClaim,
  } = useChainWriteContract()
  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } =
    useWaitForTransactionReceipt({ hash: claimHash, chainId: indexL3.id })

  // Read allowance for the pending vault
  const { data: allowance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && pendingVault ? [address, pendingVault] : undefined,
    query: { enabled: !!address && !!pendingVault },
  })

  useTransactionNotification({
    hash: depositHash,
    isPending: isDepositPending,
    isConfirming: isDepositConfirming,
    isSuccess: isDepositSuccess,
    error: depositError,
    label: 'Vault deposit',
  })

  const deposit = useCallback(
    async (vaultAddress: `0x${string}`, amount: bigint) => {
      if (!address) return

      try {
        await ensureCorrectChain(currentChainId, switchChainAsync)
      } catch {
        setErrorMsg('Could not switch to Index L3.')
        setStep('error')
        return
      }

      setPendingVault(vaultAddress)
      setPendingAmount(amount)
      setErrorMsg(null)
      approveHandled.current = false
      depositHandled.current = false
      claimHandled.current = false

      // Check allowance
      const currentAllowance = (allowance as bigint | undefined) ?? 0n
      if (currentAllowance < amount) {
        setStep('approving')
        writeApprove({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [vaultAddress, amount],
        })
        return
      }

      // Allowance sufficient — deposit directly
      setStep('depositing')
      writeDeposit({
        address: vaultAddress,
        abi: VISION_VAULT_ABI,
        functionName: 'requestDeposit',
        args: [amount, address, address],
      })
    },
    [address, currentChainId, switchChainAsync, allowance, writeApprove, writeDeposit, usdcAddress],
  )

  // Approve success -> requestDeposit
  useEffect(() => {
    if (!isApproveSuccess || approveHandled.current || !pendingVault || !address) return
    approveHandled.current = true
    setStep('depositing')
    resetApprove()
    writeDeposit({
      address: pendingVault,
      abi: VISION_VAULT_ABI,
      functionName: 'requestDeposit',
      args: [pendingAmount, address, address],
    })
  }, [isApproveSuccess, pendingVault, pendingAmount, address, writeDeposit, resetApprove])

  // RequestDeposit success -> claimDeposit (mints shares)
  useEffect(() => {
    if (!isDepositSuccess || depositHandled.current || !pendingVault || !address) return
    depositHandled.current = true
    setStep('claiming')
    resetDeposit()
    writeClaim({
      address: pendingVault,
      abi: VISION_VAULT_ABI,
      functionName: 'claimDeposit',
      args: [address, address],
    })
  }, [isDepositSuccess, pendingVault, address, writeClaim, resetDeposit])

  // Claim success -> done
  useEffect(() => {
    if (!isClaimSuccess || claimHandled.current) return
    claimHandled.current = true
    setStep('done')
    resetClaim()
  }, [isClaimSuccess, resetClaim])

  // Error handling
  useEffect(() => {
    if (approveError) {
      setErrorMsg(parseError(approveError))
      setStep('error')
      resetApprove()
    }
  }, [approveError, resetApprove])

  useEffect(() => {
    if (depositError) {
      setErrorMsg(parseError(depositError))
      setStep('error')
      resetDeposit()
    }
  }, [depositError, resetDeposit])

  useEffect(() => {
    if (claimError) {
      setErrorMsg(parseError(claimError))
      setStep('error')
      resetClaim()
    }
  }, [claimError, resetClaim])

  const reset = useCallback(() => {
    setStep('idle')
    setErrorMsg(null)
    setPendingVault(null)
    setPendingAmount(0n)
    approveHandled.current = false
    depositHandled.current = false
    claimHandled.current = false
    resetApprove()
    resetDeposit()
    resetClaim()
  }, [resetApprove, resetDeposit, resetClaim])

  return {
    deposit,
    step,
    isPending: isApprovePending || isDepositPending || isClaimPending,
    isConfirming: isApproveConfirming || isDepositConfirming || isClaimConfirming,
    error: errorMsg,
    reset,
  }
}
