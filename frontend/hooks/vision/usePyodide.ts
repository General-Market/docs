'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// Pyodide type declarations (minimal, for the subset we use)
interface PyodideInterface {
  runPython(code: string): unknown
  globals: {
    get(name: string): unknown
    set(name: string, value: unknown): void
    delete(name: string): void
  }
  toPy(obj: unknown): unknown
}

// Singleton: one Pyodide instance across the entire app
let pyodideInstance: PyodideInterface | null = null
let pyodideLoadingPromise: Promise<PyodideInterface> | null = null

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/'

/**
 * Load pyodide.js script tag into DOM (once).
 */
function loadPyodideScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if ((window as unknown as Record<string, unknown>).loadPyodide) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = `${PYODIDE_CDN}pyodide.js`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Pyodide script from CDN'))
    document.head.appendChild(script)
  })
}

/**
 * Initialize and cache the Pyodide WASM runtime (singleton).
 */
async function initPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance

  if (pyodideLoadingPromise) return pyodideLoadingPromise

  pyodideLoadingPromise = (async () => {
    await loadPyodideScript()

    const loadPyodide = (window as unknown as Record<string, unknown>).loadPyodide as
      (opts: { indexURL: string }) => Promise<PyodideInterface>

    if (!loadPyodide) {
      throw new Error('loadPyodide not found on window after script load')
    }

    const pyodide = await loadPyodide({ indexURL: PYODIDE_CDN })
    pyodideInstance = pyodide
    return pyodide
  })()

  try {
    return await pyodideLoadingPromise
  } catch (err) {
    pyodideLoadingPromise = null
    throw err
  }
}

export interface RunPythonResult {
  /** Parsed output from the strategy function */
  output: Record<string, boolean>
  /** Any stdout/print output captured */
  stdout: string
  /** Execution time in ms */
  execTime: number
}

/**
 * Hook that provides lazy Pyodide loading and a `runPython` helper.
 *
 * Pyodide is loaded from CDN on first `runPython` call (not on mount),
 * keeping the initial page load fast.
 */
export function usePyodide() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  /**
   * Execute a Python strategy function with injected market context.
   *
   * @param code - Python code defining `strategy(markets, prices, history)`
   * @param context - { markets: string[], prices: Record<string, number>, history: Record<string, number[]> }
   * @returns RunPythonResult with the bitmap output
   */
  const runPython = useCallback(async (
    code: string,
    context: {
      markets: string[]
      prices: Record<string, number>
      history: Record<string, number[]>
    }
  ): Promise<RunPythonResult> => {
    setIsLoading(true)
    setError(null)

    try {
      const pyodide = await initPyodide()
      const start = performance.now()

      // Inject context as JSON string, parse in Python
      const contextJson = JSON.stringify(context)

      // Wrapper that injects context, runs strategy, captures output
      const wrapper = `
import json, sys
from io import StringIO

_ctx = json.loads('''${contextJson.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}''')
markets = _ctx["markets"]
prices = _ctx["prices"]
history = _ctx["history"]

_stdout_capture = StringIO()
sys.stdout = _stdout_capture

${code}

_result = strategy(markets, prices, history)
sys.stdout = sys.__stdout__
_captured_output = _stdout_capture.getvalue()

# Convert result to JSON
json.dumps({"output": _result, "stdout": _captured_output})
`

      const rawResult = pyodide.runPython(wrapper) as string
      const parsed = JSON.parse(rawResult)
      const execTime = Math.round(performance.now() - start)

      if (mountedRef.current) {
        setIsLoading(false)
      }

      return {
        output: parsed.output as Record<string, boolean>,
        stdout: parsed.stdout as string,
        execTime,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (mountedRef.current) {
        setError(message)
        setIsLoading(false)
      }
      throw err
    }
  }, [])

  /**
   * Eagerly load Pyodide (e.g., on hover or user interaction).
   * Does not throw -- just sets loading/error state.
   */
  const preload = useCallback(async () => {
    if (pyodideInstance) return
    setIsLoading(true)
    setError(null)
    try {
      await initPyodide()
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  return {
    isLoading,
    error,
    isReady: !!pyodideInstance,
    runPython,
    preload,
  }
}
