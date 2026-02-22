'use client'

import type { BatchInfo } from '@/hooks/p2pool/useBatches'
import { PythonEditor } from './PythonEditor'

interface ScriptTabProps {
  batch: BatchInfo
  onBitmapGenerated?: (bitmap: Record<string, boolean>) => void
}

/**
 * Script tab for 100+ market batches (or any batch when user selects SCRIPT tab).
 * Provides a Python strategy editor with Pyodide runtime, template picker,
 * preview (bitmap grid), and backtest (PnL chart).
 */
export function ScriptTab({ batch, onBitmapGenerated }: ScriptTabProps) {
  return (
    <PythonEditor
      batch={batch}
      onBitmapGenerated={onBitmapGenerated}
    />
  )
}
