'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { BatchInfo } from '@/hooks/p2pool/useBatches'
import { usePyodide } from '@/hooks/p2pool/usePyodide'
import { useBacktest } from '@/hooks/p2pool/useBacktest'
import { TemplatePicker, STRATEGY_TEMPLATES } from './StrategyTemplates'

interface PythonEditorProps {
  batch: BatchInfo
  onBitmapGenerated?: (bitmap: Record<string, boolean>) => void
}

/**
 * Python strategy editor with:
 * - Monospace textarea with line numbers
 * - Template picker (Momentum, Contrarian, All UP, All DOWN, Random)
 * - RUN PREVIEW: executes Python in-browser via Pyodide, outputs bitmap grid
 * - BACKTEST: calls backend, displays PnL chart via recharts
 */
export function PythonEditor({ batch, onBitmapGenerated }: PythonEditorProps) {
  const defaultTemplate = STRATEGY_TEMPLATES[0]
  const [code, setCode] = useState(defaultTemplate.code)
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplate.name)

  // Preview state
  const [previewBitmap, setPreviewBitmap] = useState<Record<string, boolean> | null>(null)
  const [previewStdout, setPreviewStdout] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewExecTime, setPreviewExecTime] = useState<number | null>(null)

  // Line numbers
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  // Pyodide hook
  const { runPython, isLoading: pyodideLoading, error: pyodideError, preload } = usePyodide()

  // Backtest hook
  const backtest = useBacktest()

  const lineCount = useMemo(() => code.split('\n').length, [code])

  // Sync scroll between line numbers and textarea
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  function handleTemplateSelect(templateName: string) {
    const template = STRATEGY_TEMPLATES.find(t => t.name === templateName)
    if (template) {
      setCode(template.code)
      setSelectedTemplate(templateName)
      setPreviewBitmap(null)
      setPreviewStdout(null)
      setPreviewError(null)
      setPreviewExecTime(null)
    }
  }

  async function handleRunPreview() {
    setPreviewError(null)
    setPreviewBitmap(null)
    setPreviewStdout(null)
    setPreviewExecTime(null)

    // Build mock context for preview. Real prices/history would come from
    // batch history data, but for preview we generate synthetic data.
    const markets = batch.marketIds
    const prices: Record<string, number> = {}
    const history: Record<string, number[]> = {}
    for (const id of markets) {
      // Synthetic price around 100 with some variation
      prices[id] = 100 + (hashCode(id) % 50)
      // Synthetic history: 5 random-ish % changes
      history[id] = Array.from({ length: 5 }, (_, i) =>
        ((hashCode(id + String(i)) % 200) - 100) / 100
      )
    }

    try {
      const result = await runPython(code, { markets, prices, history })
      setPreviewBitmap(result.output)
      setPreviewStdout(result.stdout || null)
      setPreviewExecTime(result.execTime)

      if (onBitmapGenerated) {
        onBitmapGenerated(result.output)
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleBacktest() {
    backtest.mutate({ batchId: batch.id, code })
  }

  return (
    <div className="space-y-4">
      {/* Template picker */}
      <TemplatePicker selected={selectedTemplate} onSelect={handleTemplateSelect} />

      {/* Code editor with line numbers */}
      <div>
        <label className="text-xs font-mono text-text-muted block mb-2">
          Python Strategy ({batch.marketIds.length} markets)
        </label>
        <div className="flex bg-surface-dark rounded-card border border-border-medium overflow-hidden">
          {/* Line numbers gutter */}
          <div
            ref={lineNumbersRef}
            className="flex-shrink-0 py-4 pl-3 pr-2 select-none overflow-hidden
                       text-text-muted font-mono text-xs leading-[1.5rem] text-right"
            aria-hidden="true"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setCode(e.target.value)
              setSelectedTemplate('')
            }}
            onScroll={handleScroll}
            onMouseEnter={preload}
            className="flex-1 h-64 bg-transparent text-text-inverse font-mono text-xs
                       py-4 pr-4 pl-1 resize-y leading-[1.5rem]
                       focus:outline-none"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 items-center">
        <button
          onClick={handleRunPreview}
          disabled={pyodideLoading}
          className="bg-color-info text-white px-4 py-2 rounded-card text-xs font-bold
                     hover:brightness-110 transition-all disabled:opacity-50"
        >
          {pyodideLoading ? 'LOADING PYODIDE...' : 'RUN PREVIEW'}
        </button>
        <button
          onClick={handleBacktest}
          disabled={backtest.isPending}
          className="bg-terminal text-text-inverse px-4 py-2 rounded-card text-xs font-bold
                     hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {backtest.isPending ? 'RUNNING...' : 'BACKTEST'}
        </button>
        {pyodideError && (
          <span className="text-xs text-color-down font-mono">Pyodide: {pyodideError}</span>
        )}
      </div>

      {/* Preview output */}
      {previewError && (
        <div className="bg-surface-down text-color-down p-3 rounded-card font-mono text-xs whitespace-pre-wrap border border-color-down/20">
          Error: {previewError}
        </div>
      )}

      {previewBitmap && (
        <PreviewGrid
          bitmap={previewBitmap}
          stdout={previewStdout}
          execTime={previewExecTime}
          marketIds={batch.marketIds}
        />
      )}

      {/* Backtest results */}
      {backtest.error && (
        <div className="bg-surface-down text-color-down p-3 rounded-card font-mono text-xs whitespace-pre-wrap border border-color-down/20">
          Backtest error: {backtest.error.message}
        </div>
      )}

      {backtest.data && (
        <BacktestResults data={backtest.data} />
      )}
    </div>
  )
}

// --- Sub-components ---

interface PreviewGridProps {
  bitmap: Record<string, boolean>
  stdout: string | null
  execTime: number | null
  marketIds: string[]
}

/**
 * Renders the strategy output as a compact color-coded grid.
 */
function PreviewGrid({ bitmap, stdout, execTime, marketIds }: PreviewGridProps) {
  const upCount = marketIds.filter(id => bitmap[id] === true).length
  const downCount = marketIds.filter(id => bitmap[id] === false).length
  const unset = marketIds.length - upCount - downCount

  return (
    <div className="bg-surface-dark rounded-card border border-border-medium p-3 space-y-3">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs font-mono">
        <span className="text-color-up">{upCount} UP</span>
        <span className="text-color-down">{downCount} DOWN</span>
        {unset > 0 && <span className="text-text-muted">{unset} unset</span>}
        {execTime !== null && (
          <span className="text-text-muted ml-auto">{execTime}ms</span>
        )}
      </div>

      {/* Grid: small colored squares */}
      <div className="flex flex-wrap gap-[2px]">
        {marketIds.map(id => {
          const bet = bitmap[id]
          const bg =
            bet === true ? 'bg-color-up' :
            bet === false ? 'bg-color-down' :
            'bg-border-medium'
          return (
            <div
              key={id}
              className={`w-3 h-3 rounded-[2px] ${bg}`}
              title={`${id}: ${bet === true ? 'UP' : bet === false ? 'DOWN' : '?'}`}
            />
          )
        })}
      </div>

      {/* Stdout capture */}
      {stdout && (
        <div className="text-text-inverse font-mono text-xs whitespace-pre-wrap pt-2 border-t border-border-medium">
          {stdout}
        </div>
      )}
    </div>
  )
}

interface BacktestResultsProps {
  data: {
    winRate: number
    pnlCurve: { tick: number; pnl: number }[]
    totalPnl: number
  }
}

/**
 * Renders backtest results: stats summary + PnL curve chart.
 */
function BacktestResults({ data }: BacktestResultsProps) {
  const pnlPositive = data.totalPnl >= 0

  return (
    <div className="bg-muted rounded-card border border-border-light p-4 space-y-4">
      {/* Stats row */}
      <div className="flex gap-6">
        <div>
          <span className="text-[10px] text-text-muted font-mono block">Win Rate</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            {(data.winRate * 100).toFixed(1)}%
          </span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">Total PnL</span>
          <span className={`text-sm font-mono font-bold ${pnlPositive ? 'text-color-up' : 'text-color-down'}`}>
            {pnlPositive ? '+' : ''}{data.totalPnl.toFixed(4)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted font-mono block">Ticks</span>
          <span className="text-sm font-mono font-bold text-text-primary">
            {data.pnlCurve.length}
          </span>
        </div>
      </div>

      {/* PnL chart */}
      {data.pnlCurve.length > 0 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.pnlCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis
                dataKey="tick"
                tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#999' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#999' }}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181B',
                  border: '1px solid #D4D4D8',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#FFF',
                }}
              />
              <ReferenceLine y={0} stroke="#999" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke={pnlPositive ? '#16A34A' : '#DC2626'}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// --- Helpers ---

/** Deterministic hash for generating synthetic test data */
function hashCode(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}
