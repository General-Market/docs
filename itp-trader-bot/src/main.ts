import { DRY_RUN, TICK_INTERVAL_MS, TICK_JITTER_MS } from './config.js'
import { loadOrCreateKeyring } from './keys.js'
import { startHealthServer } from './health.js'
import { runAction, type ActionKind, type ActionResult } from './actions.js'
import { pickOne } from './state.js'
import { log } from './log.js'

const ACTIONS: ActionKind[] = ['buy', 'sell', 'lend', 'borrow']

const state: { lastTick: string | null; lastAction: ActionResult | null } = {
  lastTick: null,
  lastAction: null,
}

function jitter(): number {
  return TICK_INTERVAL_MS + (Math.random() * 2 - 1) * TICK_JITTER_MS
}

async function tick(ring: ReturnType<typeof loadOrCreateKeyring>): Promise<void> {
  state.lastTick = new Date().toISOString()
  const ringPick = pickOne(ring)
  const remaining = [...ACTIONS]
  for (let attempt = 0; attempt < 4 && remaining.length > 0; attempt++) {
    const idx = Math.floor(Math.random() * remaining.length)
    const kind = remaining.splice(idx, 1)[0]!
    const res = await runAction(kind, ringPick)
    state.lastAction = res
    log.info({ ...res }, 'action')
    if (res.status === 'ok') return
    // skip + error → try a different action
  }
  log.warn({ wallet: ringPick.account.address }, 'tick fully skipped after 3 retries')
}

async function main() {
  log.info({ dryRun: DRY_RUN }, 'itp-trader-bot starting')
  const ring = loadOrCreateKeyring()
  startHealthServer(ring, state)

  if (process.argv.includes('--once')) {
    await tick(ring)
    log.info('--once complete, exiting')
    process.exit(0)
  }

  // first tick after a short delay so the health endpoint shows wallets first
  setTimeout(() => { void loop(ring) }, 5_000)
}

async function loop(ring: ReturnType<typeof loadOrCreateKeyring>): Promise<void> {
  while (true) {
    try { await tick(ring) } catch (e) { log.error({ err: String(e) }, 'tick crashed') }
    const wait = jitter()
    log.info({ next_in_s: Math.round(wait / 1000) }, 'sleeping')
    await new Promise((r) => setTimeout(r, wait))
  }
}

main().catch((e) => { log.error({ err: String(e) }, 'fatal'); process.exit(1) })
