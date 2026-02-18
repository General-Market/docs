/**
 * Periodic self-improvement service.
 *
 * Analyzes historical bet performance, uses Claude to hypothesize
 * calibrator parameter changes, backtests the hypothesis, and reports
 * whether the change would improve win rate. Runs on a configurable
 * interval (default 48h) or can be triggered manually.
 */

import type { ServiceDefinition, ImprovementResult } from '../types'
import type { ResearchStore } from '../research/store'
import { backtest, backtestWithStrategy } from '../strategy/backtester'
import type { CalibrateFn } from '../strategy/backtester'
import Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum number of resolved bets required before analysis runs. */
const MIN_RESOLVED_BETS = 10

/** Improvement threshold in percentage points to propose a change. */
const IMPROVEMENT_THRESHOLD = 0.03

/** Default model for hypothesis generation. */
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514'

/** Maximum tokens for Claude response. */
const MAX_TOKENS = 512

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SuggestedChange {
  parameterName: string
  oldValue: string
  newValue: string
  reasoning: string
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildAnalysisPrompt(
  aiWinRate: number,
  randomWinRate: number,
  profitLoss: number,
  totalBets: number,
): string {
  return `Here are the current bot performance stats:
- AI-researched positions win rate: ${(aiWinRate * 100).toFixed(1)}%
- Random positions win rate: ${(randomWinRate * 100).toFixed(1)}%
- Overall P&L: ${profitLoss.toFixed(4)} WIND
- Total resolved bets: ${totalBets}

The current calibration function is:
calibrate(rawProb, confidence, marketPrice) {
  const scaleFactor = 0.1 + confidence * 0.85
  const calibrated = 0.5 + (rawProb - 0.5) * scaleFactor
  const anchorWeight = confidence < 0.6 ? 0.4 : 0.1
  return calibrated * (1 - anchorWeight) + marketPrice * anchorWeight
}

Suggest ONE specific parameter change to improve calibration.
Return ONLY valid JSON:
{"parameterName":"scaleFactor","oldValue":"0.1 + confidence * 0.85","newValue":"0.15 + confidence * 0.80","reasoning":"..."}`
}

// ---------------------------------------------------------------------------
// Claude API interaction
// ---------------------------------------------------------------------------

/**
 * Ask Claude to hypothesize a calibrator parameter change.
 * Returns the parsed suggestion or null if the response is unparseable.
 */
async function hypothesize(
  client: Anthropic,
  model: string,
  aiWinRate: number,
  randomWinRate: number,
  profitLoss: number,
  totalBets: number,
): Promise<SuggestedChange | null> {
  const prompt = buildAnalysisPrompt(aiWinRate, randomWinRate, profitLoss, totalBets)

  try {
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    })

    // Extract text content from response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    const raw = textBlock.text.trim()

    // Parse JSON -- handle potential markdown code fences
    const jsonStr = raw.startsWith('{')
      ? raw
      : raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')

    const parsed = JSON.parse(jsonStr) as SuggestedChange

    // Validate required fields
    if (
      typeof parsed.parameterName !== 'string' ||
      typeof parsed.oldValue !== 'string' ||
      typeof parsed.newValue !== 'string' ||
      typeof parsed.reasoning !== 'string'
    ) {
      console.error('[improvement-loop] Invalid suggestion structure:', parsed)
      return null
    }

    return parsed
  } catch (err) {
    console.error(
      '[improvement-loop] Failed to get hypothesis from Claude:',
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

// ---------------------------------------------------------------------------
// Custom calibrator builder
// ---------------------------------------------------------------------------

/**
 * Build a custom calibration function from a suggested parameter change.
 *
 * Interprets the parameterName to determine which part of the calibrator
 * to modify, and constructs a new function with the suggested values.
 * Falls back to the original calibrator if the parameter is unrecognized.
 */
function buildCustomCalibrator(suggestion: SuggestedChange): CalibrateFn {
  const { parameterName, newValue } = suggestion

  return (rawProb: number, confidence: number, marketPrice: number): number => {
    // Default parameter values (matching current production calibrator)
    let scaleBase = 0.1
    let scaleMultiplier = 0.85
    let anchorThreshold = 0.6
    let anchorLow = 0.4
    let anchorHigh = 0.1

    // Apply the suggested change based on parameter name
    switch (parameterName.toLowerCase()) {
      case 'scalefactor':
      case 'scale_factor':
      case 'scale': {
        // Parse the new scale expression: expect "X + confidence * Y"
        const scaleMatch = newValue.match(
          /([0-9.]+)\s*\+\s*confidence\s*\*\s*([0-9.]+)/,
        )
        if (scaleMatch) {
          scaleBase = parseFloat(scaleMatch[1])
          scaleMultiplier = parseFloat(scaleMatch[2])
        }
        break
      }

      case 'anchorweight':
      case 'anchor_weight':
      case 'anchor': {
        // Parse anchor values: could be threshold change, or weight change
        const anchorMatch = newValue.match(/([0-9.]+)/)
        if (anchorMatch) {
          const val = parseFloat(anchorMatch[1])
          // Heuristic: if < 1, it's a weight; if >= 1, it's likely a
          // threshold but still < 1 in valid range
          if (val <= 1) anchorLow = val
        }
        break
      }

      case 'anchorthreshold':
      case 'anchor_threshold': {
        const threshMatch = newValue.match(/([0-9.]+)/)
        if (threshMatch) {
          anchorThreshold = parseFloat(threshMatch[1])
        }
        break
      }

      case 'anchorlow':
      case 'anchor_low': {
        const lowMatch = newValue.match(/([0-9.]+)/)
        if (lowMatch) {
          anchorLow = parseFloat(lowMatch[1])
        }
        break
      }

      case 'anchorhigh':
      case 'anchor_high': {
        const highMatch = newValue.match(/([0-9.]+)/)
        if (highMatch) {
          anchorHigh = parseFloat(highMatch[1])
        }
        break
      }

      default:
        // Unrecognized parameter -- log and use defaults
        console.warn(
          `[improvement-loop] Unrecognized parameter "${parameterName}", using default calibrator`,
        )
    }

    // Reconstruct the calibrator with (possibly) modified parameters
    const scaleFactor = scaleBase + confidence * scaleMultiplier
    const calibrated = 0.5 + (rawProb - 0.5) * scaleFactor
    const anchorWeight = confidence < anchorThreshold ? anchorLow : anchorHigh

    return calibrated * (1 - anchorWeight) + marketPrice * anchorWeight
  }
}

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------

/**
 * Run a single improvement analysis cycle.
 *
 * Steps:
 * 1. ANALYZE  - Backtest current strategy against resolved bets
 * 2. HYPOTHESIZE - Ask Claude for a parameter change suggestion
 * 3. BACKTEST - Simulate the suggested change against historical data
 * 4. EVALUATE - Compare new vs current performance
 */
async function runAnalysis(
  store: ResearchStore,
  client: Anthropic,
  model: string,
): Promise<ImprovementResult> {
  const now = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // 1. ANALYZE: Get current performance baseline
  const current = backtest(store)

  console.log(
    `[improvement-loop] Current: ${current.totalBets} bets, ` +
    `AI win=${(current.aiWinRate * 100).toFixed(1)}%, ` +
    `random win=${(current.randomWinRate * 100).toFixed(1)}%, ` +
    `P&L=${current.profitLoss.toFixed(4)} WIND`,
  )

  // Guard: not enough data for meaningful analysis
  if (current.totalBets < MIN_RESOLVED_BETS) {
    console.log(
      `[improvement-loop] Only ${current.totalBets} resolved bets ` +
      `(need ${MIN_RESOLVED_BETS}). Skipping analysis.`,
    )

    return {
      analysisDate: now,
      resolvedBetCount: current.totalBets,
      aiWinRate: current.aiWinRate,
      randomWinRate: current.randomWinRate,
      suggestedChange: 'Insufficient data for analysis',
      backtestImprovement: 0,
      branchName: null,
      status: 'failed',
    }
  }

  // 2. HYPOTHESIZE: Ask Claude for a suggestion
  const suggestion = await hypothesize(
    client,
    model,
    current.aiWinRate,
    current.randomWinRate,
    current.profitLoss,
    current.totalBets,
  )

  if (!suggestion) {
    return {
      analysisDate: now,
      resolvedBetCount: current.totalBets,
      aiWinRate: current.aiWinRate,
      randomWinRate: current.randomWinRate,
      suggestedChange: 'Claude returned unparseable response',
      backtestImprovement: 0,
      branchName: null,
      status: 'failed',
    }
  }

  const changeDescription =
    `${suggestion.parameterName}: ${suggestion.oldValue} -> ${suggestion.newValue} ` +
    `(${suggestion.reasoning})`

  console.log(`[improvement-loop] Suggestion: ${changeDescription}`)

  // 3. BACKTEST: Simulate the suggested change
  const customCalibrator = buildCustomCalibrator(suggestion)
  const hypothetical = backtestWithStrategy(store, customCalibrator)

  // 4. EVALUATE: Compare win rates
  const improvement = hypothetical.overallWinRate - current.overallWinRate

  console.log(
    `[improvement-loop] Backtest: ` +
    `current=${(current.overallWinRate * 100).toFixed(1)}% -> ` +
    `hypothetical=${(hypothetical.overallWinRate * 100).toFixed(1)}% ` +
    `(delta=${(improvement * 100).toFixed(1)}pp)`,
  )

  const isImproved = improvement > IMPROVEMENT_THRESHOLD
  const dateSuffix = now.replace(/-/g, '')

  return {
    analysisDate: now,
    resolvedBetCount: current.totalBets,
    aiWinRate: current.aiWinRate,
    randomWinRate: current.randomWinRate,
    suggestedChange: changeDescription,
    backtestImprovement: improvement,
    branchName: isImproved ? `strategy/improve-${dateSuffix}` : null,
    status: isImproved ? 'proposed' : 'failed',
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create the self-improvement loop service.
 *
 * Periodically analyzes historical performance, generates calibrator
 * improvement hypotheses via Claude, backtests them, and reports
 * results through the onImprovement callback.
 *
 * The returned object satisfies ServiceDefinition (start/stop lifecycle)
 * and exposes an `analyzeNow()` method for on-demand analysis.
 *
 * @param store          - Research store with bet history
 * @param config         - Loop configuration (intervalHours)
 * @param onImprovement  - Optional callback invoked with each analysis result
 * @returns Service + analyzeNow handle
 */
export function createImprovementLoop(
  store: ResearchStore,
  config: { intervalHours: number; model?: string },
  onImprovement?: (result: ImprovementResult) => void,
): ServiceDefinition & {
  /** Trigger improvement analysis immediately. */
  analyzeNow(): Promise<ImprovementResult>
} {
  let intervalHandle: ReturnType<typeof setInterval> | null = null
  const client = new Anthropic()
  const model = config.model ?? DEFAULT_CLAUDE_MODEL

  const intervalMs = config.intervalHours * 60 * 60 * 1000

  async function analyzeNow(): Promise<ImprovementResult> {
    console.log('[improvement-loop] Running analysis...')

    try {
      const result = await runAnalysis(store, client, model)
      onImprovement?.(result)
      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`[improvement-loop] Analysis failed: ${errorMsg}`)

      const fallback: ImprovementResult = {
        analysisDate: new Date().toISOString().slice(0, 10),
        resolvedBetCount: 0,
        aiWinRate: 0,
        randomWinRate: 0,
        suggestedChange: `Analysis error: ${errorMsg}`,
        backtestImprovement: 0,
        branchName: null,
        status: 'failed',
      }

      onImprovement?.(fallback)
      return fallback
    }
  }

  return {
    name: 'improvement-loop',

    async start(): Promise<void> {
      console.log(
        `[improvement-loop] Starting (interval=${config.intervalHours}h)`,
      )

      // Run initial analysis after a short delay to let other services
      // initialize first
      setTimeout(() => {
        void analyzeNow()
      }, 5_000)

      intervalHandle = setInterval(() => {
        void analyzeNow()
      }, intervalMs)
    },

    async stop(): Promise<void> {
      console.log('[improvement-loop] Stopping')
      if (intervalHandle !== null) {
        clearInterval(intervalHandle)
        intervalHandle = null
      }
    },

    analyzeNow,
  }
}
