import http from 'node:http'
import { formatUnits } from 'viem'
import { ADDR, HEALTH_PORT } from './config.js'
import { ERC20_ABI } from './abis.js'
import { makePublic } from './clients.js'
import { log } from './log.js'
import type { Keyring } from './keys.js'
import type { ActionResult } from './actions.js'

type State = { lastTick: string | null; lastAction: ActionResult | null }

export function startHealthServer(ring: Keyring, state: State) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      try {
        const pub = makePublic()
        const wallets = await Promise.all(
          ring.map(async (k) => {
            const [gm, usdc] = await Promise.all([
              pub.getBalance({ address: k.account.address }),
              pub.readContract({ address: ADDR.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [k.account.address] }) as Promise<bigint>,
            ])
            return {
              address: k.account.address,
              gm: formatUnits(gm, 18),
              usdc: formatUnits(usdc, 18),
            }
          }),
        )
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true, last_tick: state.lastTick, last_action: state.lastAction, wallets }, null, 2))
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: String(e) }))
      }
      return
    }
    res.writeHead(404)
    res.end()
  })
  server.listen(HEALTH_PORT, '0.0.0.0', () => {
    log.info({ port: HEALTH_PORT }, 'health endpoint up')
  })
}
