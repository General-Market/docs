import type { ToolDefinition, PluginConfig } from '../types'
import type { ResearchStore } from '../research/store'
import type { BackendClient } from '../adapters/backend-client'

/**
 * Shows bot capital, active bets, P&L, and research coverage.
 *
 * Aggregates state from the local research store to give the operator
 * a single-glance overview of the bot's health and performance.
 */
export function createBotStatusTool(
  store: ResearchStore,
  backend: BackendClient,
  getConfig: () => PluginConfig,
): ToolDefinition {
  return {
    name: 'aa status',
    description: 'Capital, active bets, P&L, research coverage',
    handler: async (_args, _channel) => {
      // 1. Research coverage (only non-expired results)
      const activeResearch = store.getActiveResearch()
      const highConfidence = activeResearch.filter((r) => r.confidence >= 0.7)

      // 2. Active bets
      const activeBets = store.getBets({ status: 'active' })
      const totalDeployed = activeBets.reduce(
        (sum, b) => sum + b.stakeWind,
        0,
      )

      // 3. Pending bets awaiting approval
      const pendingBets = store.getPendingBets().filter(
        (b) => b.status === 'pending_approval',
      )

      // 4. Settled bets and cumulative P&L
      const settledBets = store.getBets({ status: 'settled' })
      const totalPnl = settledBets.reduce(
        (sum, b) => sum + (b.pnl ?? 0),
        0,
      )

      // 5. Kill switch state
      const killSwitch = store.getKillSwitch()

      // 6. Daily limit usage
      const dailyTotal = store.getDailyBetTotal()
      const config = getConfig()
      const maxDaily = config.maxDailyWind

      // 7. Dry run mode
      const dryRun = config.dryRun

      const pnlStr = totalPnl >= 0 ? `+${totalPnl.toFixed(2)}` : totalPnl.toFixed(2)

      const lines = [
        '[BOT STATUS]',
        `Kill Switch: ${killSwitch.active ? 'ON' : 'OFF'}`,
        `Research: ${activeResearch.length} markets scored (${highConfidence.length} high confidence)`,
        `Active Bets: ${activeBets.length} (total ${totalDeployed.toFixed(1)} WIND deployed)`,
        `Pending Approval: ${pendingBets.length}`,
        `Settled: ${settledBets.length} bets (P&L: ${pnlStr} WIND)`,
        `Daily Limit: ${dailyTotal.toFixed(1)}/${maxDaily.toFixed(1)} WIND used`,
        `Dry Run: ${dryRun ? 'ON' : 'OFF'}`,
      ]

      return lines.join('\n')
    },
  }
}
