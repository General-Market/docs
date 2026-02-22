'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

export interface MicroStep {
  label: string
  txHash?: string
  explorerUrl?: string
  chain?: 'arb' | 'l3'
}

export interface VisibleStep {
  label: string
}

interface TransactionStepperProps {
  visibleSteps: VisibleStep[]        // always 3 items
  microSteps: MicroStep[]            // 8-10 items
  currentMicroStep: number           // 0-indexed into microSteps
  isDone: boolean
  /** Maps visible step index (0-2) to the range of micro-step indices it covers: [startInclusive, endExclusive) */
  stepRanges: [number, number][]
  txRefs?: { label: string; value: string; explorerUrl?: string }[]
  error?: string
}

function truncateHash(hash: string): string {
  if (hash.length <= 10) return hash
  return `${hash.slice(0, 6)}..${hash.slice(-4)}`
}

/**
 * 3+1 Transaction Stepper with animated micro-step labels.
 *
 * Shows 4 visible nodes: 3 numbered steps + a final checkmark.
 * Between steps, an animated label area cycles through intermediary micro-steps.
 */
export function TransactionStepper({
  visibleSteps,
  microSteps,
  currentMicroStep,
  isDone,
  stepRanges,
  txRefs,
  error,
}: TransactionStepperProps) {
  const tc = useTranslations('common')
  const [displayedLabel, setDisplayedLabel] = useState('')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevMicroRef = useRef(currentMicroStep)

  // Animate micro-step label transitions
  useEffect(() => {
    if (isDone) {
      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setDisplayedLabel(microSteps.length > 0 ? microSteps[microSteps.length - 1]?.label ?? '' : '')
        setIsTransitioning(false)
      }, 150)
      return () => clearTimeout(timer)
    }

    const step = microSteps[currentMicroStep]
    if (!step) return

    if (prevMicroRef.current !== currentMicroStep) {
      // Fade out, swap, fade in
      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setDisplayedLabel(step.label)
        setIsTransitioning(false)
        prevMicroRef.current = currentMicroStep
      }, 150)
      return () => clearTimeout(timer)
    } else {
      setDisplayedLabel(step.label)
    }
  }, [currentMicroStep, isDone, microSteps])

  // Determine which visible step is active based on micro-step ranges
  const activeVisibleStep = isDone
    ? visibleSteps.length
    : stepRanges.findIndex(([start, end]) => currentMicroStep >= start && currentMicroStep < end)

  // Calculate connector fill ratio: how far through the current visible step's micro-steps we are
  const getConnectorFill = (connectorIndex: number): number => {
    if (isDone) return 1
    if (activeVisibleStep > connectorIndex) return 1
    if (activeVisibleStep < connectorIndex) return 0

    const [start, end] = stepRanges[connectorIndex] ?? [0, 1]
    const total = end - start
    if (total <= 0) return 0
    const progress = currentMicroStep - start
    return Math.min(1, Math.max(0, progress / total))
  }

  // Collect completed tx hashes for display — include current step's tx too
  const completedTxLinks = microSteps
    .filter((ms, i) => i <= currentMicroStep && ms.txHash && ms.explorerUrl)
    .map(ms => ({ label: ms.label, hash: ms.txHash!, explorerUrl: ms.explorerUrl!, chain: ms.chain }))

  const nodes = [...visibleSteps.map((s, i) => ({ label: s.label, index: i })), { label: tc('stepper.done'), index: visibleSteps.length }]

  return (
    <div className="bg-muted border border-border-light rounded-xl p-5">
      {/* Step circles + connectors — centered layout */}
      <div className="flex items-center">
        {nodes.map((node, i) => {
          const isLast = i === nodes.length - 1
          const isDoneNode = isLast
          const stepDone = isDone ? true : activeVisibleStep > i
          const stepCurrent = !isDone && activeVisibleStep === i && !isDoneNode
          const stepDoneNode = isDone && isDoneNode

          return (
            <div key={i} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
              {/* Node: circle + label stacked */}
              <div className="flex flex-col items-center" style={{ width: 48 }}>
                {/* Circle */}
                <div className="relative">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      stepDone || stepDoneNode
                        ? 'bg-zinc-900 text-white'
                        : stepCurrent
                        ? 'bg-zinc-900 text-white ring-2 ring-zinc-400'
                        : 'bg-white text-text-muted border-2 border-border-light'
                    }`}
                  >
                    {isDoneNode ? (
                      <svg className={`w-4 h-4 ${stepDoneNode ? '' : 'text-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : stepDone ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : stepCurrent ? (
                      <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {stepCurrent && (
                    <span className="absolute inset-0 rounded-full animate-ping bg-zinc-600/20" />
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-[10px] mt-1.5 text-center leading-tight font-medium whitespace-nowrap ${
                    stepDone || stepDoneNode || stepCurrent
                      ? 'text-text-primary'
                      : 'text-text-muted'
                  }`}
                >
                  {node.label}
                </span>
              </div>

              {/* Connector line between circles */}
              {!isLast && (
                <div className="relative h-0.5 flex-1 -mx-0.5" style={{ marginTop: -12 }}>
                  <div className="absolute inset-0 bg-border-light rounded-full" />
                  <div
                    className="absolute inset-y-0 left-0 bg-zinc-900 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${getConnectorFill(i) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Animated micro-step label area */}
      <div className="mt-4 pt-3 border-t border-border-light min-h-[28px] flex items-center justify-center">
        {isDone ? (
          <p className="text-sm font-medium text-color-up text-center">
            {displayedLabel || tc('stepper.complete')}
          </p>
        ) : (
          <p
            className={`text-sm text-text-muted text-center transition-opacity duration-300 ${
              isTransitioning ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {displayedLabel}
          </p>
        )}
      </div>

      {/* Completed tx hash links */}
      {completedTxLinks.length > 0 && (
        <div className="mt-2 flex justify-center gap-3 flex-wrap text-[10px] font-mono text-text-muted">
          {completedTxLinks.map((tx, i) => (
            <a
              key={i}
              href={tx.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors flex items-center gap-1"
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${tx.chain === 'arb' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
              {truncateHash(tx.hash)}
            </a>
          ))}
        </div>
      )}

      {/* Tx refs (order IDs) */}
      {txRefs && txRefs.length > 0 && (
        <div className="mt-2 flex justify-center gap-4 text-[10px] font-mono text-text-muted">
          {txRefs.map((ref, i) => (
            ref.explorerUrl ? (
              <a key={i} href={ref.explorerUrl} target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors">
                {ref.label} {ref.value}
              </a>
            ) : (
              <span key={i}>{ref.label} {ref.value}</span>
            )
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 bg-surface-down border border-color-down/30 rounded-lg p-3 text-color-down">
          <p className="text-sm break-all">{error}</p>
        </div>
      )}
    </div>
  )
}
