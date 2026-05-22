'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAccount } from 'wagmi'
import { usePostHogTracker } from '@/hooks/usePostHog'
import { useMarketRegistry, type MarketInfo } from '@/hooks/vision/useMarketRegistry'
import { useCreateBatch } from '@/hooks/vision/useCreateBatch'
import { useSetBatchMetadata } from '@/hooks/vision/useSetBatchMetadata'
import { useSetDeployerName } from '@/hooks/vision/useSetDeployerName'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { getTxUrl } from '@/lib/utils/explorer'
import { SpringModal, SpringBackdrop, glass, ModalClose } from '@/components/ui/spring'

// Maps to IVision.ResolutionType enum (see resolver.rs for full logic).
// FLAT_X (value 7) intentionally omitted — stationary markets resolve as
// up_0/down_0 instead so the parimutuel never collapses to a full refund.
const RESOLUTION_TYPES = [
  { value: 0, label: 'UP_0', description: 'Up (any positive)' },
  { value: 1, label: 'UP_30', description: 'Up (> 0.3%)' },
  { value: 2, label: 'UP_X', description: 'Up (custom threshold)' },
  { value: 3, label: 'DOWN_0', description: 'Down (any negative)' },
  { value: 4, label: 'DOWN_30', description: 'Down (> 0.3%)' },
  { value: 5, label: 'DOWN_X', description: 'Down (custom threshold)' },
  { value: 6, label: 'FLAT_0', description: 'Flat (exactly 0)' },
  { value: 8, label: 'UP_300', description: 'Up (> 3%)' },
  { value: 9, label: 'UP_3000', description: 'Up (> 30%)' },
  { value: 10, label: 'DOWN_300', description: 'Down (> 3%)' },
  { value: 11, label: 'DOWN_3000', description: 'Down (> 30%)' },
  { value: 12, label: 'FLAT_300', description: 'Flat (< 3%)' },
  { value: 13, label: 'FLAT_3000', description: 'Flat (< 30%)' },
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
// Step labels are rendered using t() below

function isCustomThresholdType(resType: number): boolean {
  return resType === 2 || resType === 5 // UP_X, DOWN_X
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
  const t = useTranslations('vision')
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

  const inputClass = glass.inputSm

  if (metaStep === 'done') {
    return (
      <div className="space-y-4">
        <div className={`${glass.success} p-4 text-color-up text-center`}>
          <p className="font-medium">{t('create_modal_meta.details_saved')}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleReset} className={`flex-1 ${glass.ctaUp}`}>
            {t('common_labels.create_another')}
          </button>
          <button onClick={onClose} className={`flex-1 ${glass.ctaSecondary}`}>
            {t('common_labels.close')}
          </button>
        </div>
      </div>
    )
  }

  const isSaving = metaPending || metaConfirming || namePending || nameConfirming
  const activeError = metaError || nameError

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">{t('create_modal_meta.add_details')}</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-text-muted block mb-1">{t('create_modal_meta.name_label')}</label>
          <input value={metaName} onChange={e => setMetaName(e.target.value)} maxLength={64} placeholder={t('create_modal_meta.name_placeholder')} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">{t('create_modal_meta.description_label')}</label>
          <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} maxLength={280} placeholder={t('create_modal_meta.description_placeholder')} rows={2} className={inputClass + ' resize-none'} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">{t('create_modal_meta.website_label')}</label>
          <input value={metaWebsite} onChange={e => setMetaWebsite(e.target.value)} maxLength={128} placeholder="https://..." className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">{t('create_modal_meta.video_label')}</label>
          <input value={metaVideo} onChange={e => setMetaVideo(e.target.value)} maxLength={256} placeholder="https://youtube.com/watch?v=..." className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">{t('create_modal_meta.image_label')}</label>
          <input value={metaImage} onChange={e => setMetaImage(e.target.value)} maxLength={256} placeholder="https://..." className={inputClass} />
        </div>
        <div className="border-t border-black/[0.06] pt-3">
          <label className="text-xs text-text-muted block mb-1">{t('create_modal_meta.display_name_label')}</label>
          <input value={metaDeployerName} onChange={e => setMetaDeployerName(e.target.value)} maxLength={64} placeholder={t('create_modal_meta.display_name_placeholder')} className={inputClass} />
        </div>
      </div>

      {activeError && (
        <div className="bg-surface-down border border-color-down/30 rounded-lg p-3 text-color-down text-sm break-all">
          {activeError}
        </div>
      )}

      {isSaving && (
        <div className="bg-color-info/10 border border-color-info/30 rounded-lg p-3 text-color-info text-sm">
          {metaPending || namePending ? t('create_modal_meta.confirm_wallet') : t('create_modal_meta.waiting_confirmation')}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || (!hasAnyMeta && !metaDeployerName)}
          className={`flex-1 ${glass.ctaUp}`}
        >
          {isSaving ? t('create_modal_meta.saving') : t('create_modal_meta.save_details')}
        </button>
        <button
          onClick={onClose}
          disabled={isSaving}
          className={`flex-1 ${glass.ctaSecondary} disabled:opacity-40`}
        >
          {t('common_labels.skip')}
        </button>
      </div>
    </div>
  )
}

interface CreateBatchModalProps {
  onClose: () => void
}

export function CreateBatchModal({ onClose }: CreateBatchModalProps) {
  const t = useTranslations('vision')
  const { isConnected } = useAccount()
  const { capture } = usePostHogTracker()
  const { markets, isLoading: marketsLoading } = useMarketRegistry()

  // Track modal open on mount
  useEffect(() => {
    capture('vision_batch_create_started')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
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

  // Track successful batch creation
  useEffect(() => {
    if (isSuccess && batchId !== null) {
      capture('vision_batch_created', { batch_id: batchId.toString(), tx_hash: txHash })
    }
  }, [isSuccess, batchId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <SpringBackdrop className={glass.backdrop} onClick={onClose}>
      <SpringModal
        className={`${glass.modal} max-w-2xl w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">{t('create_modal.title')}</h2>
            <ModalClose onClick={onClose} />
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    i === stepIndex
                      ? 'bg-black/80 text-white'
                      : i < stepIndex
                        ? 'bg-emerald-50/80 text-color-up'
                        : 'bg-black/[0.04] text-text-muted'
                  }`}
                >
                  <span className="tabular-nums">{i + 1}</span>
                  <span className="hidden sm:inline">{t(`create_modal.steps.${s}`)}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 h-px ${i < stepIndex ? 'bg-color-up' : 'bg-black/[0.06]'}`} />
                )}
              </div>
            ))}
          </div>

          {!isConnected ? (
            <div className={`${glass.section} p-8 text-center`}>
              <p className="text-text-secondary">{t('create_modal.connect_wallet')}</p>
            </div>
          ) : (
            <>
              {/* Step 1: Pick Markets */}
              {step === 'markets' && (
                <div className="space-y-4">
                  {/* Source dropdown */}
                  <div className={`${glass.section} p-4 space-y-3`}>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-2 block">
                        {t('common_labels.source')}
                      </label>
                      <select
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value)}
                        className={`${glass.inputSm} appearance-none`}
                      >
                        <option value="">{t('create_modal.step_markets.all_sources')}</option>
                        {sources.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-2 block">
                        {t('common_labels.search')}
                      </label>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('create_modal.step_markets.search_placeholder')}
                        className={glass.inputSm}
                      />
                    </div>
                  </div>

                  {/* Select All / Unselect All + count */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllVisible}
                      className="px-3 py-1.5 border border-black/10 text-text-secondary text-xs font-medium rounded-lg hover:border-black/20 hover:text-text-primary transition-colors"
                    >
                      {t('common_labels.select_all')}
                    </button>
                    <button
                      onClick={unselectAllVisible}
                      className="px-3 py-1.5 border border-black/10 text-text-secondary text-xs font-medium rounded-lg hover:border-black/20 hover:text-text-primary transition-colors"
                    >
                      {t('common_labels.unselect_all')}
                    </button>
                    <span className="text-xs text-text-muted ml-auto">
                      {filteredMarkets.length !== markets.length ? t('create_modal.step_markets.selected_shown', { selected: selectedMarketIds.size.toString(), shown: filteredMarkets.length.toString() }) : t('create_modal.step_markets.selected_count', { selected: selectedMarketIds.size.toString() })}
                    </span>
                  </div>

                  {marketsLoading ? (
                    <div className="py-8 text-center text-text-muted text-sm">{t('create_modal.step_markets.loading_markets')}</div>
                  ) : filteredMarkets.length === 0 ? (
                    <div className="py-8 text-center text-text-muted text-sm">
                      {markets.length === 0 ? t('create_modal.step_markets.no_active_markets') : t('create_modal.step_markets.no_markets_match')}
                    </div>
                  ) : (
                    <div className="max-h-[360px] overflow-y-auto border border-black/[0.06] rounded-xl">
                      {filteredMarkets.map((market) => {
                        const isSelected = selectedMarketIds.has(market.id)
                        return (
                          <button
                            key={market.id}
                            onClick={() => toggleMarket(market.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 border-b border-black/[0.04] last:border-b-0 text-left transition-colors ${
                              isSelected ? 'bg-surface-up' : 'hover:bg-card-hover'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-black/80 border-black/80'
                                    : 'border-black/15'
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
                  <div className={`${glass.section} p-4`}>
                    <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-3 block">
                      {t('common_labels.tick_duration')}
                    </label>
                    <div className="flex flex-wrap gap-2 fluid-btn-group">
                      {TICK_DURATIONS.map((td) => (
                        <button
                          key={td.value}
                          onClick={() => setTickDuration(td.value)}
                          className={`px-3 py-2 rounded-lg border text-sm font-mono transition-colors ${
                            tickDuration === td.value
                              ? 'border-black/80 text-white bg-black/80'
                              : 'border-black/10 text-text-muted hover:border-black/20'
                          }`}
                        >
                          {td.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Per-market resolution type */}
                  <div className={`${glass.section} p-4`}>
                    <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-3 block">
                      {t('common_labels.resolution_type_per_market')}
                    </label>
                    <div className="max-h-[320px] overflow-y-auto space-y-3">
                      {selectedConfigs.map((config) => {
                        const needsCustom = isCustomThresholdType(config.resolutionType)
                        return (
                          <div key={config.market.id} className="bg-white/60 border border-black/[0.06] rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-text-primary">{config.market.name}</p>
                              <p className="text-xs text-text-muted font-mono">{config.market.id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={config.resolutionType}
                                onChange={(e) => updateMarketConfig(config.market.id, 'resolutionType', parseInt(e.target.value, 10))}
                                className="flex-1 bg-white/80 border border-black/10 rounded-lg px-3 py-2 text-sm text-text-primary font-mono focus:border-black/25 focus:outline-none appearance-none"
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
                                    inputMode="numeric"
                                    value={config.customThreshold}
                                    onChange={(e) => updateMarketConfig(config.market.id, 'customThreshold', e.target.value)}
                                    placeholder="bps"
                                    min="1"
                                    className="w-20 bg-white/80 border border-black/10 rounded-lg px-2 py-2 text-sm text-text-primary font-mono tabular-nums text-right focus:border-black/25 focus:outline-none"
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
                  <div className={`${glass.section} p-4`}>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted mb-3">{t('create_modal.step_preview.batch_summary')}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">{t('create_modal.step_preview.markets_label')}</span>
                        <span className="text-text-primary font-mono tabular-nums">{selectedConfigs.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-muted">{t('create_modal.step_configure.tick_duration_label')}</span>
                        <span className="text-text-primary font-mono tabular-nums">
                          {TICK_DURATIONS.find((t) => t.value === tickDuration)?.label ?? `${tickDuration}s`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-black/[0.06] rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-black/[0.03]">
                        <tr className="text-text-muted text-xs">
                          <th className="text-left p-3">{t('create_modal.step_preview.table.market')}</th>
                          <th className="text-left p-3">{t('create_modal.step_preview.table.resolution')}</th>
                          <th className="text-right p-3">{t('create_modal.step_preview.table.threshold')}</th>
                          <th className="text-right p-3">{t('create_modal.step_preview.table.price')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedConfigs.map((config) => {
                          const rt = RESOLUTION_TYPES.find((r) => r.value === config.resolutionType)
                          const needsCustom = isCustomThresholdType(config.resolutionType)
                          return (
                            <tr key={config.market.id} className="border-t border-black/[0.04] hover:bg-black/[0.02]">
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
                      <div className={`${glass.section} p-4 text-center`}>
                        <p className="text-sm text-text-secondary mb-1">
                          {t('create_modal_confirm.creating_batch_text', { count: selectedConfigs.length, plural: selectedConfigs.length !== 1 ? 's' : '' })}
                        </p>
                        <p className="text-xs text-text-muted">
                          {t('create_modal_confirm.tick_duration_text', { duration: TICK_DURATIONS.find((t) => t.value === tickDuration)?.label ?? `${tickDuration}s` })}
                        </p>
                      </div>

                      {isPending && (
                        <div className="bg-color-info/10 border border-color-info/30 rounded-lg p-3 text-color-info text-sm">
                          {t('create_modal.step_confirm.confirm_wallet')}
                        </div>
                      )}

                      {isConfirming && (
                        <div className="bg-color-info/10 border border-color-info/30 rounded-lg p-3 text-color-info text-sm">
                          <p>{t('create_modal_meta.tx_submitted')}</p>
                          {txHash && (
                            <a
                              href={getTxUrl(txHash, 'l3')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono mt-1 text-color-info/60 break-all hover:text-color-info transition-colors block"
                            >
                              Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
                            </a>
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
                        className={`${glass.ctaUp} fluid-press`}
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
                      <div className={`${glass.success} p-4 text-color-up text-center`}>
                        <p className="font-medium text-lg mb-1">{t('create_modal.step_confirm.success.title')}</p>
                        {batchId !== null && (
                          <p className="text-sm font-mono">{t('create_modal_confirm.batch_id_text', { id: batchId.toString() })}</p>
                        )}
                        {txHash && (
                          <a
                            href={getTxUrl(txHash, 'l3')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono mt-2 text-color-up/70 break-all hover:text-color-up transition-colors block"
                          >
                            Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
                          </a>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowMetaForm(true)}
                          className={`flex-1 ${glass.ctaUp}`}
                        >
                          {t('common_labels.add_details')}
                        </button>
                        <button
                          onClick={onClose}
                          className={`flex-1 ${glass.ctaSecondary}`}
                        >
                          {t('common_labels.skip')}
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
                      className="px-4 py-2.5 border border-black/10 text-text-secondary font-medium rounded-xl text-sm hover:border-black/20 hover:text-text-primary transition-colors"
                    >
                      {t('common_labels.back')}
                    </button>
                  )}
                  <button
                    onClick={goNext}
                    disabled={!canAdvance}
                    className="flex-1 py-2.5 bg-black/80 text-white font-medium rounded-xl text-sm hover:bg-black/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {stepIndex === STEPS.length - 2 ? t('create_modal.nav.review_confirm') : t('create_modal.nav.next')}
                  </button>
                </div>
              )}

              {/* Back button on confirm step when tx not yet submitted */}
              {step === 'confirm' && !isPending && !isConfirming && !isSuccess && (
                <button
                  onClick={goBack}
                  className={`${glass.cancel} mt-2`}
                >
                  {t('create_modal.nav.back_to_preview')}
                </button>
              )}
            </>
          )}
        </div>
      </SpringModal>
    </SpringBackdrop>
  )
}
