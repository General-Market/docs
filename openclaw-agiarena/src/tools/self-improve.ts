/**
 * Manual self-improvement trigger tool.
 *
 * Allows operators to invoke the improvement analysis on demand via
 * `/aa improve` rather than waiting for the periodic loop. Returns
 * a formatted summary of the analysis including win rates, suggested
 * changes, backtest results, and deployment instructions.
 */

import type { ToolDefinition, ImprovementResult } from '../types'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create the self-improvement trigger tool.
 *
 * Wires the improvement loop's `analyzeNow` method into an interactive
 * tool that operators can invoke from the chat interface.
 *
 * @param analyzeNow - Async function that runs a full improvement cycle
 * @returns Tool definition for registration with OpenClaw
 */
export function createSelfImproveTool(
  analyzeNow: () => Promise<ImprovementResult>,
): ToolDefinition {
  return {
    name: 'aa improve',
    description: 'Trigger self-improvement analysis',

    handler: async (_args, _channel) => {
      const result = await analyzeNow()
      return formatResult(result)
    },
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format an ImprovementResult into a human-readable status message.
 */
function formatResult(result: ImprovementResult): string {
  const aiPct = (result.aiWinRate * 100).toFixed(1)
  const randomPct = (result.randomWinRate * 100).toFixed(1)
  const improvePct = result.backtestImprovement >= 0
    ? `+${(result.backtestImprovement * 100).toFixed(1)}`
    : (result.backtestImprovement * 100).toFixed(1)

  const lines = [
    '[SELF-IMPROVEMENT ANALYSIS]',
    `Resolved Bets: ${result.resolvedBetCount}`,
    `AI Win Rate: ${aiPct}% vs Random: ${randomPct}%`,
    `Suggested Change: ${result.suggestedChange}`,
    `Backtest Improvement: ${improvePct}%`,
    `Status: ${result.status.toUpperCase()}`,
  ]

  if (result.status === 'proposed' && result.branchName) {
    lines.push('')
    lines.push(`Branch: ${result.branchName}`)
    lines.push('Reply /aa approve to deploy, /aa reject to discard.')
  }

  return lines.join('\n')
}
