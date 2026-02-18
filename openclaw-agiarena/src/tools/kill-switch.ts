import type { ToolDefinition } from '../types'
import type { ResearchStore } from '../research/store'

/**
 * Emergency stop -- halts all automated activity immediately.
 *
 * Sets the kill switch active with a reason string. While active, no new
 * discovery, research, or bet execution will proceed.
 */
export function createKillSwitchTool(store: ResearchStore): ToolDefinition {
  return {
    name: 'aa stop',
    description: 'Emergency kill switch — halts all automated activity',
    handler: async (_args, _channel) => {
      store.setKillSwitch(true, 'Manual kill via /aa stop')
      return 'Kill switch ACTIVATED. All automated activity halted. Use /aa resume to restart.'
    },
  }
}

/**
 * Resume automated activity after a kill switch or circuit breaker trip.
 *
 * Clears the kill switch flag so background services can resume normal
 * operation.
 */
export function createResumeTool(store: ResearchStore): ToolDefinition {
  return {
    name: 'aa resume',
    description: 'Resume after kill switch',
    handler: async (_args, _channel) => {
      store.setKillSwitch(false)
      return 'Kill switch DEACTIVATED. Automated activity resumed.'
    },
  }
}
