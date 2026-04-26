import { NextRequest } from 'next/server'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

// Dev-only SOL airdrop. The wallet rejects bets when the user has no SOL
// for the network fee, even if their USDC balance is healthy. This route
// asks the public devnet faucet for a small amount of SOL on the user's
// behalf. Hard-gated to devnet via the genesis hash.

const AIRDROP_LAMPORTS = Math.floor(0.05 * LAMPORTS_PER_SOL)
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'

const COOLDOWN_MS = 60_000
type CooldownStore = Map<string, number>
const globalAny = globalThis as unknown as {
  __solFaucetCooldown?: CooldownStore
  __solFaucetConnection?: Connection
  __solFaucetGenesisVerified?: boolean
}
const cooldown: CooldownStore =
  globalAny.__solFaucetCooldown ?? (globalAny.__solFaucetCooldown = new Map())

function resolveRpcUrl(): string {
  // The public devnet RPC handles airdrops natively. Helius and most
  // third-party endpoints disable requestAirdrop, so prefer the official
  // endpoint here regardless of what the dapp uses for reads.
  return process.env.FAUCET_SOL_RPC_URL ?? 'https://api.devnet.solana.com'
}

function getConnection(): Connection {
  if (!globalAny.__solFaucetConnection) {
    globalAny.__solFaucetConnection = new Connection(resolveRpcUrl(), {
      commitment: 'confirmed',
      disableRetryOnRateLimit: true,
    })
  }
  return globalAny.__solFaucetConnection
}

async function ensureDevnet(connection: Connection): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'devnet') return true
  if (globalAny.__solFaucetGenesisVerified) return true
  try {
    const genesis = await connection.getGenesisHash()
    const ok = genesis === DEVNET_GENESIS
    if (ok) globalAny.__solFaucetGenesisVerified = true
    return ok
  } catch {
    return false
  }
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function validatePubkey(input: unknown): PublicKey | null {
  if (typeof input !== 'string') return null
  try {
    const pk = new PublicKey(input)
    if (pk.toBytes().length !== 32) return null
    return pk
  } catch {
    return null
  }
}

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
    }

    const address = (body as { address?: unknown } | null)?.address
    const userPubkey = validatePubkey(address)
    if (!userPubkey) {
      return Response.json({ ok: false, error: 'Invalid wallet address.' }, { status: 400 })
    }

    const ip = clientIp(req)
    const last = cooldown.get(ip) ?? 0
    const now = Date.now()
    const wait = COOLDOWN_MS - (now - last)
    if (wait > 0) {
      return Response.json(
        { ok: false, error: `Cooldown. Try again in ${Math.ceil(wait / 1000)}s.` },
        { status: 429 },
      )
    }

    const connection = getConnection()
    const onDevnet = await ensureDevnet(connection)
    if (!onDevnet) {
      return Response.json(
        { ok: false, error: 'Faucet is devnet-only.' },
        { status: 403 },
      )
    }

    try {
      const signature = await connection.requestAirdrop(userPubkey, AIRDROP_LAMPORTS)
      // Don't block on confirmation — the public faucet is slow and the UI
      // already polls balance. Returning the signature is enough for the
      // user to track it on an explorer.
      cooldown.set(ip, now)
      return Response.json({ ok: true, signature, lamports: AIRDROP_LAMPORTS })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/429|Too Many Requests|rate limited|airdrop limit/i.test(msg)) {
        return Response.json(
          {
            ok: false,
            error: 'Devnet faucet is rate-limited. Try again in a minute.',
          },
          { status: 429 },
        )
      }
      return Response.json({ ok: false, error: msg }, { status: 500 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[faucet/sol] unhandled', e)
    return Response.json({ ok: false, error: `Faucet error: ${msg}` }, { status: 500 })
  }
}
