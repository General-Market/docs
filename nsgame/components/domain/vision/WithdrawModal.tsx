'use client'

import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { VISION_ABI } from '@/lib/contracts/vision-abi'
import { indexL3 } from '@/lib/wagmi'
import { VISION_USDC_DECIMALS } from '@/lib/vision/constants'
import { useDeployment } from '@/hooks/useDeployment'
import { SpringModal, SpringBackdrop, glass, ModalClose } from '@/components/ui/spring'
import { useTranslations } from 'next-intl'

interface WithdrawModalProps {
  batchId: number
  onClose: () => void
}

/**
 * Round-based settlement modal.
 *
 * In the round model, settleBatch() sends USDC directly to player wallets.
 * This modal shows the round result. No manual claim or withdraw needed.
 */
export function WithdrawModal({ batchId, onClose }: WithdrawModalProps) {
  const t = useTranslations('vision')
  const { address, isConnected } = useAccount()
  const { getAddress } = useDeployment()
  const visionAddress = getAddress('Vision')

  // Read on-chain position
  const { data: position } = useReadContract({
    address: visionAddress,
    abi: VISION_ABI,
    functionName: 'getPosition',
    args: address ? [BigInt(batchId), address] : undefined,
    chainId: indexL3.id,
    query: { enabled: !!address && visionAddress !== '0x0000000000000000000000000000000000000000' },
  })

  const pos = position as {
    bitmapHash: string
    configHash: string
    joinTimestamp: bigint
    totalDeposited: bigint
  } | undefined

  const totalDeposited = pos?.totalDeposited ?? 0n

  return (
    <SpringBackdrop className={glass.backdrop} onClick={onClose}>
      <SpringModal className={`${glass.modal} max-w-md w-full`} onClick={e => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {t('withdraw_modal.title_choose', { id: batchId })}
            </h2>
            <ModalClose onClick={onClose} />
          </div>

          {!isConnected ? (
            <div className={`${glass.section} p-8 text-center`}>
              <p className="text-text-secondary">{t('withdraw_modal.connect_wallet')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Position overview */}
              <div className={`${glass.section} p-4 space-y-3`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{t('withdraw_modal.total_deposited')}</span>
                  <span className="text-lg font-bold text-text-primary tabular-nums font-mono">
                    {totalDeposited > 0n ? parseFloat(formatUnits(totalDeposited, VISION_USDC_DECIMALS)).toFixed(2) : '0.00'} USDC
                  </span>
                </div>
              </div>

              {/* Round-based settlement notice */}
              <div className={`${glass.section} p-4`}>
                <p className="text-sm text-text-secondary">
                  Settlement sends USDC directly to your wallet when the round ends. No manual claim needed.
                </p>
              </div>

              <button
                onClick={onClose}
                className={glass.cancel}
              >
                {t('withdraw_modal.close')}
              </button>
            </div>
          )}
        </div>
      </SpringModal>
    </SpringBackdrop>
  )
}
