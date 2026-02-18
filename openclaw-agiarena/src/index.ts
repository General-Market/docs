import type { OpenClawApi, PluginConfig, ToolDefinition } from './types'
import { ResearchStore } from './research/store'
import { BackendClient } from './adapters/backend-client'
import { ChainBridge } from './adapters/chain-bridge'
import { ApprovalGate } from './safety/approval-gate'
import { CapitalLimiter } from './safety/capital-limiter'
import { CircuitBreaker } from './safety/circuit-breaker'
import { createBotStatusTool } from './tools/bot-status'
import { createKillSwitchTool, createResumeTool } from './tools/kill-switch'
import { createGetScoresTool } from './tools/get-scores'
import { DiscoveryCoordinator } from './research/sources'
import { createDiscoveryService } from './services/discovery'
import { createResearchPipeline } from './services/research-pipeline'
import { createDiscoverMarketsTool, createResearchMarketTool } from './tools/discover-markets'
import { createPlaceBetTool } from './tools/place-bet'
import { createMatchBetTool } from './tools/match-bet'
import { createApproveBetTool } from './tools/approve-bet'
import { createBetExecutor } from './services/bet-executor'
import { createBetMonitor } from './services/bet-monitor'
import { createImprovementLoop } from './services/improvement-loop'
import { createSelfImproveTool } from './tools/self-improve'

// ============================================================================
// Default config — mirrors openclaw.plugin.json defaults
// ============================================================================

const DEFAULT_CONFIG: PluginConfig = {
  backendUrl: 'http://localhost:3001',
  dataNodeUrl: 'http://localhost:8200',
  chainRpc: 'https://index.rpc.zeeve.net',
  chainId: 111222333,
  dryRun: true,
  maxBetWind: 1.0,
  maxDailyWind: 10.0,
  discoveryIntervalMin: 30,
  maxResearchMarkets: 200,
  autoApproveThreshold: 0,
  circuitBreakerDrawdownPct: 15,
  circuitBreakerConsecutiveLosses: 5,
  circuitBreakerCooldownMin: 60,
  improvementIntervalHours: 48,
}

// ============================================================================
// Config helpers
// ============================================================================

function loadConfig(api: OpenClawApi): PluginConfig {
  const config = { ...DEFAULT_CONFIG }

  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof PluginConfig)[]) {
    const val = api.getConfig<unknown>(key)
    if (val !== undefined && val !== null) {
      ;(config as Record<string, unknown>)[key] = val
    }
  }

  // Private key always comes from env, never from config file
  const envKey = process.env.AA_PRIVATE_KEY
  if (envKey) {
    config.privateKey = envKey
  }

  return config
}

// ============================================================================
// Config update tool
// ============================================================================

function createConfigTool(api: OpenClawApi, config: PluginConfig): ToolDefinition {
  return {
    name: 'aa config',
    description: 'Update plugin config: /aa config <key> <value>',
    args: [
      { name: 'key', description: 'Config key to update', required: true },
      { name: 'value', description: 'New value', required: true },
    ],
    handler: async (args, _channel) => {
      const { key, value } = args

      if (!key || !value) {
        return 'Usage: /aa config <key> <value>'
      }

      if (!(key in DEFAULT_CONFIG)) {
        const validKeys = Object.keys(DEFAULT_CONFIG).join(', ')
        return `Unknown config key "${key}". Valid keys: ${validKeys}`
      }

      // Coerce value to the correct type based on the default
      const defaultVal = DEFAULT_CONFIG[key as keyof PluginConfig]
      let coerced: unknown

      if (typeof defaultVal === 'boolean') {
        if (value === 'true') coerced = true
        else if (value === 'false') coerced = false
        else return `Config "${key}" expects a boolean (true/false), got "${value}"`
      } else if (typeof defaultVal === 'number') {
        const num = Number(value)
        if (Number.isNaN(num)) return `Config "${key}" expects a number, got "${value}"`
        coerced = num
      } else {
        coerced = value
      }

      api.setConfig(key, coerced)
      ;(config as unknown as Record<string, unknown>)[key] = coerced

      return `Config updated: ${key} = ${String(coerced)}`
    },
  }
}

// ============================================================================
// Plugin entry point
// ============================================================================

export async function register(api: OpenClawApi): Promise<void> {
  // 1. Load config
  const config = loadConfig(api)

  // 2. Initialize core infrastructure
  const store = new ResearchStore('data/plugin.db')
  const backend = new BackendClient(config.backendUrl)

  // 3. Initialize chain bridge
  const chain = new ChainBridge({
    rpcUrl: config.chainRpc,
    chainId: config.chainId,
    privateKey: config.privateKey,
    dryRun: config.dryRun,
    agiArenaCoreAddress: '0x0000000000000000000000000000000000000000',
    windTokenAddress: '0x0000000000000000000000000000000000000000',
  })

  // 4. Initialize safety modules
  const sendMessage = (channel: string, text: string) => api.sendMessage(channel, text)

  const approvalGate = new ApprovalGate(store, sendMessage)
  const capitalLimiter = new CapitalLimiter(store, {
    maxBetWind: config.maxBetWind,
    maxDailyWind: config.maxDailyWind,
  })
  const circuitBreaker = new CircuitBreaker(store, {
    drawdownPct: config.circuitBreakerDrawdownPct,
    consecutiveLosses: config.circuitBreakerConsecutiveLosses,
    cooldownMin: config.circuitBreakerCooldownMin,
  })

  // 5. Register implemented tools
  api.registerTool(createBotStatusTool(store, backend, () => config))
  api.registerTool(createKillSwitchTool(store))
  api.registerTool(createResumeTool(store))
  api.registerTool(createGetScoresTool(store))

  // 6. Initialize discovery + research pipeline
  const discoveryCoordinator = new DiscoveryCoordinator(backend)
  const researchPipeline = createResearchPipeline(
    store,
    { maxWorkers: 3, maxMarkets: config.maxResearchMarkets },
  )

  // Register Phase B tools
  api.registerTool(createDiscoverMarketsTool(discoveryCoordinator, (markets) => researchPipeline.enqueue(markets)))
  api.registerTool(createResearchMarketTool((market) => researchPipeline.researchOne(market)))

  // Register Phase C tools
  api.registerTool(createPlaceBetTool(store, approvalGate))
  api.registerTool(createMatchBetTool(store, backend, approvalGate))
  api.registerTool(createApproveBetTool(approvalGate))

  // Reject uses the approval gate directly
  api.registerTool({
    name: 'aa reject',
    description: 'Reject a pending bet',
    args: [{ name: 'id', description: 'Pending bet ID', required: true }],
    handler: async (args, _channel) => {
      const { id } = args
      if (!id) return 'Usage: /aa reject <bet-id>'

      const rejected = approvalGate.reject(id)
      if (!rejected) return `No pending bet found with ID "${id}".`

      return `Bet ${id} REJECTED.`
    },
  })

  // Phase D: Self-improvement
  const improvementLoop = createImprovementLoop(
    store,
    { intervalHours: config.improvementIntervalHours, model: config.claudeModel },
  )
  api.registerTool(createSelfImproveTool(improvementLoop.analyzeNow))

  // Config update tool
  api.registerTool(createConfigTool(api, config))

  // 7. Register background services
  const discoveryService = createDiscoveryService(
    discoveryCoordinator,
    store,
    { intervalMin: config.discoveryIntervalMin },
    (markets) => researchPipeline.enqueue(markets),
  )
  api.registerService(discoveryService)
  api.registerService(researchPipeline)

  const betExecutor = createBetExecutor(
    store,
    chain,
    capitalLimiter,
    circuitBreaker,
    { dryRun: config.dryRun },
  )
  api.registerService(betExecutor)

  const betMonitor = createBetMonitor(
    store,
    backend,
    circuitBreaker,
  )
  api.registerService(betMonitor)

  api.registerService(improvementLoop)

  // 8. Start cleanup schedule and register shutdown hooks
  store.startCleanupSchedule()

  const shutdown = () => {
    store.close()
  }
  process.once('exit', shutdown)
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  console.log('[agiarena] openclaw-agiarena plugin registered')
}
