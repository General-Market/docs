'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { useMarketRegistry, type MarketInfo } from '@/hooks/p2pool/useMarketRegistry'
import { useCreateBatch } from '@/hooks/p2pool/useCreateBatch'
import { useSetBatchMetadata } from '@/hooks/p2pool/useSetBatchMetadata'
import { useSetDeployerName } from '@/hooks/p2pool/useSetDeployerName'
import { WalletActionButton } from '@/components/ui/WalletActionButton'

// Maps to IVision.ResolutionType enum
const RESOLUTION_TYPES = [
  { value: 0, label: 'UP_0', description: 'Up (0% threshold)' },
  { value: 1, label: 'UP_30', description: 'Up (30 bps)' },
  { value: 2, label: 'UP_X', description: 'Up (custom)' },
  { value: 3, label: 'DOWN_0', description: 'Down (0% threshold)' },
  { value: 4, label: 'DOWN_30', description: 'Down (30 bps)' },
  { value: 5, label: 'DOWN_X', description: 'Down (custom)' },
  { value: 6, label: 'FLAT_0', description: 'Flat (0% threshold)' },
  { value: 7, label: 'FLAT_X', description: 'Flat (custom)' },
] as const

const TICK_DURATIONS = [
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1 hour' },
  { value: 14400, label: '4 hours' },
  { value: 86400, label: '1 day' },
] as const

type Step = 'markets' | 'configure' | 'preview' | 'confirm'
const STEPS: Step[] = ['markets', 'configure', 'preview', 'confirm']
const STEP_LABELS: Record<Step, string> = {
  markets: 'Pick Markets',
  configure: 'Configure',
  preview: 'Preview',
  confirm: 'Confirm',
}

function isCustomThresholdType(resType: number): boolean {
  return resType === 2 || resType === 5 || resType === 7 // UP_X, DOWN_X, FLAT_X
}

interface MarketConfig {
  market: MarketInfo
  resolutionType: number
  customThreshold: string // basis points as string for input
}

interface MetadataFormProps {
  batchId: bigint
  metaName: string; setMetaName: (v: string) => void
  metaDescription: string; setMetaDescription: (v: string) => void
  metaWebsite: string; setMetaWebsite: (v: string) => void
  metaVideo: string; setMetaVideo: (v: string) => void
  metaImage: string; setMetaImage: (v: string) => void
  metaDeployerName: string; setMetaDeployerName: (v: string) => void
  metaStep: 'form' | 'saving-meta' | 'saving-name' | 'done'
  setMetaStep: (v: 'form' | 'saving-meta' | 'saving-name' | 'done') => void
  setBatchMetadata: (params: any) => void
  setDeployerName: (name: string) => void
  metaPending: boolean; metaConfirming: boolean; metaSuccess: boolean; metaError: string | null
  namePending: boolean; nameConfirming: boolean; nameSuccess: boolean; nameError: string | null
  onClose: () => void
  handleReset: () => void
}

function MetadataForm({
  batchId,
  metaName, setMetaName,
  metaDescription, setMetaDescription,
  metaWebsite, setMetaWebsite,
  metaVideo, setMetaVideo,
  metaImage, setMetaImage,
  metaDeployerName, setMetaDeployerName,
  metaStep, setMetaStep,
  setBatchMetadata, setDeployerName,
  metaPending, metaConfirming, metaSuccess, metaError,
  namePending, nameConfirming, nameSuccess, nameError,
  onClose, handleReset,
}: MetadataFormProps) {
  const hasAnyMeta = metaName || metaDescription || metaWebsite || metaVideo || metaImage

  // Progress through the two-tx flow
  if (metaStep === 'saving-meta' && metaSuccess && metaDeployerName) {
    // First tx done, fire second
    setMetaStep('saving-name')
    setDeployerName(metaDeployerName)
  } else if (metaStep === 'saving-meta' && metaSuccess && !metaDeployerName) {
    setMetaStep('done')
  } else if (metaStep === 'saving-name' && nameSuccess) {
    setMetaStep('done')
  }

  const handleSave = () => {
    if (hasAnyMeta) {
      setMetaStep('saving-meta')
      setBatchMetadata({
        batchId,
        name: metaName,
        description: metaDescription,
        websiteUrl: metaWebsite,
        videoUrl: metaVideo,
        imageUrl: metaImage,
      })
    } else if (metaDeployerName) {
      setMetaStep('saving-name')
      setDeployerName(metaDeployerName)
    }
  }

  const inputClass = 'w-full bg-card border border-border-medium rounded-lg px-4 py-2 text-text-primary text-sm font-mono focus:border-zinc-600 focus:outline-none'

  if (metaStep === 'done') {
    return (
      <div className="space-y-4">
        <div className="bg-surface-up border border-color-up/30 rounded-lg p-4 text-color-up text-center">
          <p className="font-medium">Details Saved!</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleReset} className="flex-1 py-3 bg-terminal text-text-inverse font-medium rounded-lg text-sm hover:opacity-90 transition-opacity">
            Create Another
          </button>
          <button onClick={onClose} className="flex-1 py-3 border border-border-medium text-text-secondary font-medium rounded-lg text-sm hover:border-zinc-500 hover:text-text-primary transition-colors">
            Close
          </button>
        </div>
      </div>
    )
  }

  const isSaving = metaPending || metaConfirming || namePending || nameConfirming
  const activeError = metaError || nameError

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Add Batch Details (optional)</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-text-muted block mb-1">Name (max 64 chars)</label>
          <input value={metaName} onChange={e => setMetaName(e.target.value)} maxLength={64} placeholder="My Trading Strategy" className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Description (max 280 chars)</label>
          <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} maxLength={280} placeholder="A brief description..." rows={2} className={inputClass + ' resize-none'} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Website URL</label>
          <input value={metaWebsite} onChange={e => setMetaWebsite(e.target.value)} maxLength={128} placeholder="https://..." className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Video URL (YouTube)</label>
          <input value={metaVideo} onChange={e => setMetaVideo(e.target.value)} maxLength={256} placeholder="https://youtube.com/watch?v=..." className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Image URL</label>
          <input value={metaImage} onChange={e => setMetaImage(e.target.value)} maxLength={256} placeholder="https://..." className={inputClass} />
        </div>
        <div className="border-t border-border-light pt-3">
          <label className="text-xs text-text-muted block mb-1">Your Display Name (max 64 chars)</label>
          <input value={metaDeployerName} onChange={e => setMetaDeployerName(e.target.value)} maxLength={64} placeholder="Your name or alias" className={inputClass} />
        </div>
      </div>

      {activeError && (
        <div className="bg-surface-down border border-color-down/30 rounded-lg p-3 text-color-down text-sm break-all">
          {activeError}
        </div>
      )}

      {isSaving && (
        <div className="bg-color-info/10 border border-color-info/30 rounded-lg p-3 text-color-info text-sm">
          {metaPending || namePending ? 'Confirm in your wallet...' : 'Waiting for confirmation...'}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || (!hasAnyMeta && !metaDeployerName)}
          className="flex-1 py-3 bg-terminal text-text-inverse font-medium rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Details'}
        </button>
        <button
          onClick={onClose}
          disabled={isSaving}
          className="flex-1 py-3 border border-border-medium text-text-secondary font-medium rounded-lg text-sm hover:border-zinc-500 hover:text-text-primary transition-colors disabled:opacity-40"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

interface CreateBatchModalProps {
  onClose: () => void
}

export function CreateBatchModal({ onClose }: CreateBatchModalProps) {
  const t = useTranslations('p2pool')
  const { isConnected } = useAccount()
  const { markets, isLoading: marketsLoading } = useMarketRegistry()
  const {
    createBatch,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    batchId,
    error: txError,
    reset: resetTx,
  } = useCreateBatch()

  const {
    setBatchMetadata,
    isPending: metaPending,
    isConfirming: metaConfirming,
    isSuccess: metaSuccess,
    error: metaError,
  } = useSetBatchMetadata()

  const {
    setDeployerName,
    isPending: namePending,
    isConfirming: nameConfirming,
    isSuccess: nameSuccess,
    error: nameError,
  } = useSetDeployerName()

  // Metadata form state
  const [showMetaForm, setShowMetaForm] = useState(false)
  const [metaName, setMetaName] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [metaWebsite, setMetaWebsite] = useState('')
  const [metaVideo, setMetaVideo] = useState('')
  const [metaImage, setMetaImage] = useState('')
  const [metaDeployerName, setMetaDeployerName] = useState('')
  const [metaStep, setMetaStep] = useState<'form' | 'saving-meta' | 'saving-name' | 'done'>('form')

  const [step, setStep] = useState<Step>('markets')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [selectedMarketIds, setSelectedMarketIds] = useState<Set<string>>(new Set())
  const [marketConfigs, setMarketConfigs] = useState<Map<string, { resolutionType: number; customThreshold: string }>>(new Map())
  const [tickDuration, setTickDuration] = useState(3600) // default 1 hour

  // Extract unique sources from markets
  const sources = useMemo(() => {
    return [...new Set(markets.map(m => m.source))].sort()
  }, [markets])

  // Filtered markets by source + search
  const filteredMarkets = useMemo(() => {
    let result = markets
    if (selectedSource) {
      result = result.filter(m => m.source === selectedSource)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)
      )
    }
    return result
  }, [markets, selectedSource, searchQuery])

  // Build selected market configs for display
  const selectedConfigs = useMemo((): MarketConfig[] => {
    return markets
      .filter((m) => selectedMarketIds.has(m.id))
      .map((m) => {
        const config = marketConfigs.get(m.id) || { resolutionType: 0, customThreshold: '0' }
        return { market: m, ...config }
      })
  }, [markets, selectedMarketIds, marketConfigs])

  const toggleMarket = useCallback((marketId: string) => {
    setSelectedMarketIds((prev) => {
      const next = new Set(prev)
      if (next.has(marketId)) {
        next.delete(marketId)
      } else {
        next.add(marketId)
      }
      return next
    })
  }, [])

  const selectAllVisible = useCallback(() => {
    setSelectedMarketIds((prev) => {
      const next = new Set(prev)
      filteredMarkets.forEach(m => next.add(m.id))
      return next
    })
  }, [filteredMarkets])

  const unselectAllVisible = useCallback(() => {
    setSelectedMarketIds((prev) => {
      const next = new Set(prev)
      filteredMarkets.forEach(m => next.delete(m.id))
      return next
    })
  }, [filteredMarkets])

  const updateMarketConfig = useCallback((marketId: string, field: 'resolutionType' | 'customThreshold', value: string | number) => {
    setMarketConfigs((prev) => {
      const next = new Map(prev)
      const current = next.get(marketId) || { resolutionType: 0, customThreshold: '0' }
      next.set(marketId, { ...current, [field]: value })
      return next
    })
  }, [])

  const canAdvance = useMemo((): boolean => {
    switch (step) {
      case 'markets':
        return selectedMarketIds.size > 0
      case 'configure':
        // Every selected market must have valid config
        return selectedConfigs.every((c) => {
          if (isCustomThresholdType(c.resolutionType)) {
            const val = parseInt(c.customThreshold, 10)
            return !isNaN(val) && val > 0
          }
          return true
        })
      case 'preview':
        return true
      case 'confirm':
        return false // confirm step uses its own button
    }
  }, [step, selectedMarketIds, selectedConfigs])

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }, [step])

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }, [step])

  const handleSubmit = useCallback(() => {
    const marketIds = selectedConfigs.map((c) => c.market.id)
    const resolutionTypes = selectedConfigs.map((c) => c.resolutionType)
    const customThresholds = selectedConfigs.map((c) =>
      isCustomThresholdType(c.resolutionType) ? parseInt(c.customThreshold, 10) || 0 : 0
    )

    createBatch({
      marketIds,
      resolutionTypes,
      tickDuration,
      customThresholds,
    })
  }, [selectedConfigs, tickDuration, createBatch])

  const handleReset = useCallback(() => {
    resetTx()
    setStep('markets')
    setSelectedMarketIds(new Set())
    setMarketConfigs(new Map())
    setTickDuration(3600)
    setSearchQuery('')
    setSelectedSource('')
  }, [resetTx])

  const stepIndex = STEPS.indexOf(step)

  // Format price change
  const formatChange = (change: number) => {
    const prefix = change >= 0 ? '+' : ''
    return `${prefix}${change.toFixed(2)}%`
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border-light rounded-xl shadow-modal max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">{t('create_modal.title')}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none">
              &times;
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    i === stepIndex
                      ? 'bg-terminal text-text-inverse'
                      : i < stepIndex
                        ? 'bg-surface-up text-color-up'
                        : 'bg-muted text-text-muted'
                  }`}
                >
                  <span className="tabular-nums">{i + 1}</span>
                  <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 h-px ${i < stepIndex ? 'bg-color-up' : 'bg-border-light'}`} />
                )}
              </div>
            ))}
          </div>

          {!isConnected ? (
            <div className="bg-muted border border-border-light rounded-xl p-8 text-center">
              <p className="text-text-secondary">{t('create_modal.connect_wallet')}</p>
            </div>
          ) : (
            <>
              {/* Step 1: Pick Markets */}
              {step === 'markets' && (
                <div className="space-y-4">
                  {/* Source dropdown */}
                  <div className="bg-muted border border-border-light rounded-xl p-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2 block">
                        Source
                      </label>
                      <select
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value)}
                        className="w-full bg-card border border-border-medium rounded-lg px-4 py-2 text-text-primary text-sm font-mono focus:border-zinc-600 focus:outline-none appearance-none"
                      >
                        <option value="">All Sources</option>
                        {sources.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2 block">
                        Search
                      </label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or ID..."
                        className="w-full bg-card border border-border-medium rounded-lg px-4 py-2 text-text-primary text-sm font-mono focus:border-zinc-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Select All / Unselect All + count */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllVisible}
                      className="px-3 py-1.5 border border-border-medium text-text-secondary text-xs font-medium rounded-lg hover:border-zinc-500 hover:text-text-primary transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={unselectAllVisible}
                      className="px-3 py-1.5 border border-border-medium text-text-secondary text-xs font-medium rounded-lg hover:border-zinc-500 hover:text-text-primary transition-colors"
                    >
                      Unselect All
                    </button>
                    <span className="text-xs text-text-muted ml-auto">
                      {selectedMarketIds.size} selected{filteredMarkets.length !== markets.length ? ` / ${filteredMarkets.length} shown` : ''}
                    </span>
                  </div>

                  {marketsLoading ? (
                    <div className="py-8 text-center text-text-muted text-sm">Loading markets...</div>
                  ) : filteredMarkets.length === 0 ? (
                    <div className="py-8 text-center text-text-muted text-sm">
                      {markets.length === 0 ? 'No active markets available' : 'No markets match your filter'}
                    </div>
                  ) : (
                    <div className="max-h-[360px] overflow-y-auto border border-border-light rounded-lg">
                      {filteredMarkets.map((market) => {
                        const isSelected = selectedMarketIds.has(market.id)
                        return (
                          <button
                            key={market.id}
                            onClick={() => toggleMarket(market.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 border-b border-border-light last:border-b-0 text-left transition-colors ${
                              isSelected ? 'bg-surface-up' : 'hover:bg-card-hover'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-terminal border-terminal'
                                    : 'border-border-medium'
                                }`}
                              >
                                {isSelected && (
                                  <svg className="w-3 h-3 text-text-inverse" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-text-primary">{market.name}</p>
                                <p className="text-xs text-text-muted font-mono">{market.source} / {market.id}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono tabular-nums text-text-primary">
                                ${market.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <p className={`text-xs font-mono tabular-nums ${
                                market.change24h >= 0 ? 'text-color-up' : 'text-color-down'
                              }`}>
                                {formatChange(market.change24h)}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Configure */}
              {step === 'configure' && (
                <div className="space-y-4">
                  {/* Tick Duration */}
                  <div className="bg-muted border border-border-light rounded-xl p-4">
                    <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3 block">
                      Tick Duration
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TICK_DURATIONS.map((td) => (
                        <button
                          key={td.value}
                          onClick={() => setTickDuration(td.value)}
                          className={`px-3 py-2 rounded-lg border text-sm font-mono transition-colors ${
                            tickDuration === td.value
                              ? 'border-terminal text-text-inverse bg-terminal'
                              : 'border-border-medium text-text-muted hover:border-zinc-500'
                          }`}
                        >
                          {td.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Per-market resolution type */}
                  <div className="bg-muted border border-border-light rounded-xl p-4">
                    <label className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3 block">
                      Resolution Type per Market
                    </label>
                    <div className="max-h-[320px] overflow-y-auto space-y-3">
                      {selectedConfigs.map((config) => {
                        const needsCustom = isCustomThresholdType(config.resolutionType)
                        return (
                          <div key={config.market.id} className="bg-card border border-border-light rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-text-primary">{config.market.name}</p>
                              <p className="text-xs text-text-muted font-mono">{config.market.id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={config.resolutionType}
                                onChange={(e) => updateMarketConfig(config.market.id, 'resolutionType', parseInt(e.target.value, 10))}
                                className="flex-1 bg-muted border border-border-medium rounded-lg px-3 py-2 text-sm text-text-primary font-mono focus:border-zinc-600 focus:outline-none appearance-none"
                              >
                                {RESOLUTION_TYPES.map((rt) => (
                                  <option key={rt.value} value={rt.value}>
                                    {rt.label} -- {rt.description}
                                  </option>
                                ))}
                              </select>
                              {needsCustom && (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={config.customThreshold}
                                    onChange={(e) => updateMarketConfig(config.market.id, 'customThreshold', e.target.value)}
                                    placeholder="bps"
                                    min="1"
                                    className="w-20 bg-muted border border-border-medium rounded-lg px-2 py-2 text-sm text-text-primary font-mono tabular-nums text-right focus:border-zinc-600 focus:outline-none"
                                  />
                                  <span className="text-xs text-text-muted">bps</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {step === 'preview' && (
                <div className="space-y-4">
                  <div className="bg-muted border border-border-light rounded-xl p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-3">Batch Summary</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Markets</span>
                        <span className="text-text-primary font-mono tabular-nums">{selectedConfigs.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">Tick Duration</span>
                        <span className="text-text-primary font-mono tabular-nums">
                          {TICK_DURATIONS.find((t) => t.value === tickDuration)?.label ?? `${tickDuration}s`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-border-light rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr className="text-text-muted text-xs">
                          <th className="text-left p-3">Market</th>
                          <th className="text-left p-3">Resolution</th>
                          <th className="text-right p-3">Threshold</th>
                          <th className="text-right p-3">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedConfigs.map((config) => {
                          const rt = RESOLUTION_TYPES.find((r) => r.value === config.resolutionType)
                          const needsCustom = isCustomThresholdType(config.resolutionType)
                          return (
                            <tr key={config.market.id} className="border-t border-border-light hover:bg-card-hover">
                              <td className="p-3">
                                <p className="text-text-primary font-medium">{config.market.name}</p>
                                <p className="text-xs text-text-muted font-mono">{config.market.source}</p>
                              </td>
                              <td className="p-3 font-mono text-text-secondary">{rt?.label ?? '?'}</td>
                              <td className="p-3 text-right font-mono tabular-nums text-text-secondary">
                                {needsCustom ? `${config.customThreshold} bps` : '--'}
                              </td>
                              <td className="p-3 text-right">
                                <span className="font-mono tabular-nums text-text-primary">
                                  ${config.market.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Step 4: Confirm */}
              {step === 'confirm' && (
                <div className="space-y-4">
                  {!isSuccess ? (
                    <>
                      <div className="bg-muted border border-border-light rounded-xl p-4 text-center">
                        <p className="text-sm text-text-secondary mb-1">
                          You are creating a batch with <span className="font-bold text-text-primary">{selectedConfigs.length}</span> market{selectedConfigs.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-text-muted">
                          Tick duration: {TICK_DURATIONS.find((t) => t.value === tickDuration)?.label ?? `${tickDuration}s`}
                        </p>
                      </div>

                      {isPending && (
                        <div className="bg-color-info/10 border border-color-info/30 rounded-lg p-3 text-color-info text-sm">
                          {t('create_modal.step_confirm.confirm_wallet')}
                        </div>
                      )}

                      {isConfirming && (
                        <div className="bg-color-info/10 border border-color-info/30 rounded-lg p-3 text-color-info text-sm">
                          <p>Transaction submitted, waiting for confirmation...</p>
                          {txHash && (
                            <p className="text-xs font-mono mt-1 text-color-info/60 break-all">Tx: {txHash}</p>
                          )}
                        </div>
                      )}

                      {txError && (
                        <div className="bg-surface-down border border-color-down/30 rounded-lg p-3 text-color-down text-sm break-all">
                          {txError}
                        </div>
                      )}

                      <WalletActionButton
                        onClick={handleSubmit}
                        disabled={isPending || isConfirming}
                        className="w-full py-3 bg-terminal text-text-inverse font-medium rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isPending
                          ? t('create_modal.step_confirm.button.waiting')
                          : isConfirming
                            ? t('create_modal.step_confirm.button.confirming')
                            : t('create_modal.step_confirm.button.create_batch')}
                      </WalletActionButton>
                    </>
                  ) : !showMetaForm ? (
                    <>
                      <div className="bg-surface-up border border-color-up/30 rounded-lg p-4 text-color-up text-center">
                        <p className="font-medium text-lg mb-1">{t('create_modal.step_confirm.success.title')}</p>
                        {batchId !== null && (
                          <p className="text-sm font-mono">Batch ID: #{batchId.toString()}</p>
                        )}
                        {txHash && (
                          <p className="text-xs font-mono mt-2 text-color-up/70 break-all">Tx: {txHash}</p>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowMetaForm(true)}
                          className="flex-1 py-3 bg-terminal text-text-inverse font-medium rounded-lg text-sm hover:opacity-90 transition-opacity"
                        >
                          Add Details
                        </button>
                        <button
                          onClick={onClose}
                          className="flex-1 py-3 border border-border-medium text-text-secondary font-medium rounded-lg text-sm hover:border-zinc-500 hover:text-text-primary transition-colors"
                        >
                          Skip
                        </button>
                      </div>
                    </>
                  ) : (
                    <MetadataForm
                      batchId={batchId!}
                      metaName={metaName} setMetaName={setMetaName}
                      metaDescription={metaDescription} setMetaDescription={setMetaDescription}
                      metaWebsite={metaWebsite} setMetaWebsite={setMetaWebsite}
                      metaVideo={metaVideo} setMetaVideo={setMetaVideo}
                      metaImage={metaImage} setMetaImage={setMetaImage}
                      metaDeployerName={metaDeployerName} setMetaDeployerName={setMetaDeployerName}
                      metaStep={metaStep} setMetaStep={setMetaStep}
                      setBatchMetadata={setBatchMetadata}
                      setDeployerName={setDeployerName}
                      metaPending={metaPending} metaConfirming={metaConfirming} metaSuccess={metaSuccess} metaError={metaError}
                      namePending={namePending} nameConfirming={nameConfirming} nameSuccess={nameSuccess} nameError={nameError}
                      onClose={onClose}
                      handleReset={handleReset}
                    />
                  )}
                </div>
              )}

              {/* Navigation buttons */}
              {step !== 'confirm' && (
                <div className="flex gap-3 mt-6">
                  {stepIndex > 0 && (
                    <button
                      onClick={goBack}
                      className="px-4 py-2.5 border border-border-medium text-text-secondary font-medium rounded-lg text-sm hover:border-zinc-500 hover:text-text-primary transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={goNext}
                    disabled={!canAdvance}
                    className="flex-1 py-2.5 bg-terminal text-text-inverse font-medium rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {stepIndex === STEPS.length - 2 ? t('create_modal.nav.review_confirm') : t('create_modal.nav.next')}
                  </button>
                </div>
              )}

              {/* Back button on confirm step when tx not yet submitted */}
              {step === 'confirm' && !isPending && !isConfirming && !isSuccess && (
                <button
                  onClick={goBack}
                  className="w-full text-center text-sm text-text-muted hover:text-text-primary py-2 mt-2 transition-colors"
                >
                  {t('create_modal.nav.back_to_preview')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
