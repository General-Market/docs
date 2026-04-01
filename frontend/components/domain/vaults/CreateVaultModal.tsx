'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { parseUnits } from 'viem'
import { useCreateVault } from '@/hooks/vaults/useCreateVault'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { SpringBackdrop, SpringModal, glass, ModalClose } from '@/components/ui/spring'

interface CreateVaultModalProps {
  onClose: () => void
}

export function CreateVaultModal({ onClose }: CreateVaultModalProps) {
  const { address } = useAccount()
  const { create, step, isPending, isConfirming, error, reset } = useCreateVault()

  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [feePercent, setFeePercent] = useState(20)
  const [managerInput, setManagerInput] = useState('')

  const managerAddress = (managerInput || address || '0x0000000000000000000000000000000000000000') as `0x${string}`

  // Fee rate: contract expects basis points scaled to 1e18. 20% = 20e16 = 2000...0
  // The contract uses feeRate where 1e18 = 100%, so 20% = 0.2e18 = 2e17
  const feeRate = parseUnits(String(feePercent), 16) // feePercent * 1e16

  const handleSubmit = () => {
    if (!name.trim() || !symbol.trim()) return
    create({ name: name.trim(), symbol: symbol.trim(), performanceFeeRate: feeRate, manager: managerAddress })
  }

  const busy = step === 'creating'

  return (
    <SpringBackdrop className={glass.backdrop} onClick={onClose}>
      <SpringModal
        className={`${glass.modal} max-w-md w-full relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-6">
          <ModalClose onClick={onClose} className="absolute top-4 right-4" />

          <div className="pt-8 mb-6">
            <p className="text-label font-semibold tracking-[0.08em] uppercase text-brand mb-1.5">New Vault</p>
            <h2 className="text-title font-bold text-black">Create a Managed Vault</h2>
            <p className="text-body text-text-secondary mt-1.5">
              Deploy a vault that allocates deposited USDC to Vision batches.
            </p>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Vault Name</label>
              <input
                type="text"
                placeholder="e.g. Alpha Vision Fund"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-border-light rounded-md bg-card text-text-primary
                           text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            {/* Symbol */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Symbol</label>
              <input
                type="text"
                placeholder="e.g. vALPHA"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                maxLength={10}
                className="w-full px-3 py-2 border border-border-light rounded-md bg-card text-text-primary
                           text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            {/* Performance Fee */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-text-muted">Performance Fee</label>
                <span className="text-xs font-mono tabular-nums text-text-primary font-semibold">{feePercent}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={feePercent}
                onChange={(e) => setFeePercent(Number(e.target.value))}
                className="w-full accent-brand"
              />
              <div className="flex justify-between text-micro text-text-muted mt-0.5">
                <span>0%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Manager address */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Manager Address (defaults to your wallet)</label>
              <input
                type="text"
                placeholder={address || '0x...'}
                value={managerInput}
                onChange={(e) => setManagerInput(e.target.value)}
                className="w-full px-3 py-2 border border-border-light rounded-md bg-card text-text-primary
                           text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            {/* Submit */}
            <WalletActionButton
              onClick={handleSubmit}
              disabled={busy || isConfirming || isPending || !name.trim() || !symbol.trim()}
              className="w-full py-2.5 bg-brand text-white text-sm font-bold rounded-md
                         hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {step === 'creating' ? 'Creating...'
                : isConfirming ? 'Confirming...'
                : step === 'done' ? 'Vault Created'
                : 'Create Vault'}
            </WalletActionButton>

            {error && <p className="text-xs text-color-down">{error}</p>}
            {step === 'done' && (
              <p className="text-xs text-color-up">Vault deployed. It will appear in the grid momentarily.</p>
            )}
          </div>
        </div>
      </SpringModal>
    </SpringBackdrop>
  )
}
