/**
 * Approve a pending bet for on-chain execution.
 *
 * Wraps the approval gate with a detailed human-readable response so the
 * operator gets full confirmation of what was approved and knows the
 * submission pipeline has been triggered.
 */

import type { ToolDefinition } from '../types'
import type { ApprovalGate } from '../safety/approval-gate'

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createApproveBetTool(
  approvalGate: ApprovalGate,
): ToolDefinition {
  return {
    name: 'aa approve',
    description: 'Approve a pending bet for execution',
    args: [
      { name: 'id', description: 'Pending bet ID', required: true },
    ],
    handler: async (args, _channel) => {
      const { id } = args

      if (!id) {
        return 'Usage: /aa approve <bet-id>'
      }

      const approved = approvalGate.approve(id)

      if (!approved) {
        return `No pending bet found with ID ${id}. It may have already been approved, rejected, or expired.`
      }

      // ---------------------------------------------------------------
      // Build detailed confirmation
      // ---------------------------------------------------------------

      const { portfolio } = approved
      const actionLabel = approved.action === 'match' ? 'MATCH' : 'PLACE'

      const lines = [
        `Bet ${id} APPROVED`,
        `Action: ${actionLabel}`,
        `Stake: ${approved.stakeWind} WIND`,
        `Positions: ${portfolio.informedCount}/${portfolio.totalCount}`,
      ]

      if (approved.matchBetId) {
        lines.push(`Matching: ${approved.matchBetId}`)
      }

      if (approved.categoryId) {
        lines.push(`Category: ${approved.categoryId}`)
      }

      lines.push(`Submitting to chain...`)

      return lines.join('\n')
    },
  }
}
