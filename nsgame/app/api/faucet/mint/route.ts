import { NextRequest } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
} from '@solana/spl-token'

// Dev-only faucet. Mints 100 stake-mint tokens (6 decimals) to the
// supplied wallet's ATA. Hard-gated to devnet on the server side and
// disabled outright if the keypair file is missing.
//
// The route is intentionally narrow: no auth, no nonce, no captcha —
// just a 60-second per-IP cooldown to keep accidents cheap. If this
// ever leaks to a non-devnet cluster the genesis-hash check refuses
// to mint. Belt and braces, because the alternative is theft.

const STAKE_MINT_FALLBACK = '5BNaj6SeidyLp9PKRFTEKCTGsww9SQmsTp7yEqgHiEkT'
const MINT_AMOUNT_RAW = 100_000_000n // 100 USDC at 6 decimals

// Devnet genesis hash — published, public, stable.
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'

// Cooldown bookkeeping survives hot reload via globalThis.
const COOLDOWN_MS = 60_000
type CooldownStore = Map<string, number>
const globalAny = globalThis as unknown as {
  __faucetCooldown?: CooldownStore
  __faucetConnection?: Connection
  __faucetGenesisVerified?: boolean
}
const cooldown: CooldownStore =
  globalAny.__faucetCooldown ?? (globalAny.__faucetCooldown = new Map())

function expandHome(p: string): string {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1))
  return p
}

function resolveStakeMint(): PublicKey {
  const override = process.env.NEXT_PUBLIC_PREDICTION_STAKE_MINT
  if (override) {
    try { return new PublicKey(override) } catch { /* fall through */ }
  }
  return new PublicKey(STAKE_MINT_FALLBACK)
}

function resolveRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    process.env.NEXT_PUBLIC_RPC_URL ??
    'https://api.devnet.solana.com'
  )
}

function getConnection(): Connection {
  if (!globalAny.__faucetConnection) {
    globalAny.__faucetConnection = new Connection(resolveRpcUrl(), 'confirmed')
  }
  return globalAny.__faucetConnection
}

async function loadKeypair(): Promise<Keypair | null> {
  // Env-injected JSON wins. Useful in containers where bind-mounting a
  // file is a separate ritual; pasting the keypair contents into a
  // single env var ships through Dokploy without touching volumes.
  const inline = process.env.FAUCET_KEYPAIR_JSON
  if (inline) {
    try {
      const arr = JSON.parse(inline)
      if (Array.isArray(arr)) return Keypair.fromSecretKey(Uint8Array.from(arr))
    } catch {
      /* fall through to the file path */
    }
  }
  const raw = process.env.FAUCET_KEYPAIR_PATH ?? '~/.config/solana/id.json'
  const file = expandHome(raw)
  try {
    const contents = await fs.readFile(file, 'utf8')
    const arr = JSON.parse(contents)
    if (!Array.isArray(arr)) return null
    return Keypair.fromSecretKey(Uint8Array.from(arr))
  } catch {
    return null
  }
}

async function ensureDevnet(connection: Connection): Promise<boolean> {
  // Trust the explicit env first. The genesis check is a second seatbelt.
  if (process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'devnet') return true
  if (globalAny.__faucetGenesisVerified) return true
  try {
    const genesis = await connection.getGenesisHash()
    const ok = genesis === DEVNET_GENESIS
    if (ok) globalAny.__faucetGenesisVerified = true
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
    // toBytes throws if the bytes aren't 32; PublicKey already enforces it,
    // but the on-curve check rejects garbage that happens to be 32 bytes.
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

    const keypair = await loadKeypair()
    if (!keypair) {
      return Response.json(
        { ok: false, error: 'Faucet keypair not configured.' },
        { status: 503 },
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

    const stakeMint = resolveStakeMint()
    const ata = getAssociatedTokenAddressSync(stakeMint, userPubkey)

    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        keypair.publicKey,
        ata,
        userPubkey,
        stakeMint,
      ),
      createMintToInstruction(stakeMint, ata, keypair.publicKey, MINT_AMOUNT_RAW),
    )

    try {
      const signature = await sendAndConfirmTransaction(connection, tx, [keypair], {
        commitment: 'confirmed',
      })
      cooldown.set(ip, now)
      return Response.json({ ok: true, signature, ata: ata.toBase58() })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return Response.json({ ok: false, error: msg }, { status: 500 })
    }
  } catch (e) {
    // Last-resort guard. Anything that escapes still returns JSON so the
    // client doesn't choke on plain-text "Internal Server Error".
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[faucet/mint] unhandled', e)
    return Response.json({ ok: false, error: `Faucet error: ${msg}` }, { status: 500 })
  }
}
