import { describe, test, expect } from 'bun:test'
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js'
import {
  NS_MARKET_PROGRAM_ID,
  deriveMarketPda,
  deriveBetPda,
  buildCreateMarketTx,
  buildPlaceBetTx,
  buildResolveMarketTx,
  buildRedeemTx,
} from '../lib/solana/nsMarketProgram'

// These tests exercise the pure-function portion of the ns-market client:
// PDA derivations and instruction-data encoders. No RPC, no devnet, no
// wallet — if these change shape, Rust-side decoding will break.

const FIXED_OWNER = new PublicKey('JB3RPZYmMx9YyJr9Hxe3ymDkdWsJx6UkuGoxKX5xdvb1')

describe('NS_MARKET_PROGRAM_ID', () => {
  test('matches the deployed devnet program', () => {
    expect(NS_MARKET_PROGRAM_ID.toBase58()).toBe('4zwmmKAL83VQADqRwfXERvPU2e1K3vcPpqPN7DmTR7MT')
  })
})

describe('deriveMarketPda', () => {
  test('is deterministic for the same market_id', () => {
    const [a] = deriveMarketPda('btc-100k-2027')
    const [b] = deriveMarketPda('btc-100k-2027')
    expect(a.equals(b)).toBe(true)
  })

  test('different market_ids give different PDAs', () => {
    const [a] = deriveMarketPda('btc-100k-2027')
    const [b] = deriveMarketPda('sol-1k-2026')
    expect(a.equals(b)).toBe(false)
  })

  test('returns a PDA owned by ns-market', () => {
    const [pda, bump] = deriveMarketPda('test-market')
    expect(bump).toBeGreaterThanOrEqual(0)
    expect(bump).toBeLessThanOrEqual(255)
    // PDA pubkey falls off the ed25519 curve — PublicKey.isOnCurve returns false.
    expect(PublicKey.isOnCurve(pda.toBuffer())).toBe(false)
  })
})

describe('deriveBetPda', () => {
  test('is deterministic for same bettor + nonce', () => {
    const [a] = deriveBetPda(FIXED_OWNER, 42n)
    const [b] = deriveBetPda(FIXED_OWNER, 42n)
    expect(a.equals(b)).toBe(true)
  })

  test('different nonces give different PDAs', () => {
    const [a] = deriveBetPda(FIXED_OWNER, 1n)
    const [b] = deriveBetPda(FIXED_OWNER, 2n)
    expect(a.equals(b)).toBe(false)
  })

  test('different bettors give different PDAs even with same nonce', () => {
    const other = Keypair.generate().publicKey
    const [a] = deriveBetPda(FIXED_OWNER, 999n)
    const [b] = deriveBetPda(other, 999n)
    expect(a.equals(b)).toBe(false)
  })

  test('handles u64 nonce up to max safely', () => {
    const maxU64 = (1n << 64n) - 1n
    const [pda, bump] = deriveBetPda(FIXED_OWNER, maxU64)
    expect(PublicKey.isOnCurve(pda.toBuffer())).toBe(false)
    expect(bump).toBeGreaterThanOrEqual(0)
  })
})

describe('buildCreateMarketTx', () => {
  test('returns a Transaction with the derived market pubkey', () => {
    const { tx, marketPda } = buildCreateMarketTx(FIXED_OWNER, 'test-1', 'Will X happen?')
    expect(tx.instructions).toHaveLength(1)
    const ix = tx.instructions[0]
    expect(ix.programId.equals(NS_MARKET_PROGRAM_ID)).toBe(true)
    expect(ix.keys[1].pubkey.equals(marketPda)).toBe(true)
    expect(ix.keys[1].isWritable).toBe(true)
    expect(ix.keys[1].isSigner).toBe(false)
    expect(ix.keys[0].isSigner).toBe(true) // authority
    expect(ix.keys[2].pubkey.equals(SystemProgram.programId)).toBe(true)
  })

  test('rejects empty or too-long market_id', () => {
    expect(() => buildCreateMarketTx(FIXED_OWNER, '', 'q')).toThrow()
    expect(() => buildCreateMarketTx(FIXED_OWNER, 'x'.repeat(33), 'q')).toThrow()
  })

  test('rejects question longer than 200 bytes', () => {
    expect(() => buildCreateMarketTx(FIXED_OWNER, 'ok', 'y'.repeat(201))).toThrow()
  })
})

describe('buildPlaceBetTx', () => {
  test('derives the same PDAs the program will', () => {
    const { tx, betPda, marketPda, nonce } = buildPlaceBetTx(FIXED_OWNER, 'btc-100k-2027', 0, 0.01, 123n)
    const [derivedMarket] = deriveMarketPda('btc-100k-2027')
    const [derivedBet] = deriveBetPda(FIXED_OWNER, 123n)
    expect(marketPda.equals(derivedMarket)).toBe(true)
    expect(betPda.equals(derivedBet)).toBe(true)
    expect(nonce).toBe(123n)
    expect(tx.instructions).toHaveLength(1)
    expect(tx.instructions[0].keys).toHaveLength(4)
  })

  test('encodes args with correct byte layout', () => {
    const { tx } = buildPlaceBetTx(FIXED_OWNER, 'm', 1, 0.001, 7n)
    const data = tx.instructions[0].data
    // 8 discriminator + 8 nonce + 1 outcome + 8 amount = 25 bytes
    expect(data.length).toBe(25)
    // nonce at offset 8 (after discriminator), little-endian u64
    const nonce = data.readBigUInt64LE(8)
    expect(nonce).toBe(7n)
    // outcome at offset 16
    expect(data.readUInt8(16)).toBe(1)
    // amount at offset 17, little-endian u64, 0.001 SOL = 1_000_000 lamports
    const amount = data.readBigUInt64LE(17)
    expect(amount).toBe(BigInt(0.001 * LAMPORTS_PER_SOL))
  })

  test('rejects invalid outcome', () => {
    // 2 is not assignable; runtime guard also throws
    expect(() => buildPlaceBetTx(FIXED_OWNER, 'm', 2 as unknown as 0 | 1, 0.01)).toThrow()
  })

  test('rejects zero or negative amount', () => {
    expect(() => buildPlaceBetTx(FIXED_OWNER, 'm', 0, 0)).toThrow()
    expect(() => buildPlaceBetTx(FIXED_OWNER, 'm', 0, -0.01)).toThrow()
  })

  test('auto-nonce is unique enough', () => {
    // Two back-to-back calls should not collide (timestamp + random has
    // more than enough entropy for same-tick calls at typical throughput).
    const a = buildPlaceBetTx(FIXED_OWNER, 'm', 0, 0.01).nonce
    const b = buildPlaceBetTx(FIXED_OWNER, 'm', 0, 0.01).nonce
    expect(a).not.toBe(b)
  })
})

describe('buildResolveMarketTx', () => {
  test('encodes winning_outcome as single byte', () => {
    const { tx } = buildResolveMarketTx(FIXED_OWNER, 'mx', 1)
    const data = tx.instructions[0].data
    expect(data.length).toBe(9) // 8 discriminator + 1 outcome
    expect(data.readUInt8(8)).toBe(1)
  })

  test('authority is signer, market is writable', () => {
    const { tx } = buildResolveMarketTx(FIXED_OWNER, 'mx', 0)
    const keys = tx.instructions[0].keys
    expect(keys[0].isSigner).toBe(true)
    expect(keys[0].isWritable).toBe(false)
    expect(keys[1].isSigner).toBe(false)
    expect(keys[1].isWritable).toBe(true)
  })
})

describe('buildRedeemTx', () => {
  test('bet PDA matches deriveBetPda', () => {
    const [marketPda] = deriveMarketPda('mx')
    const { betPda } = buildRedeemTx(FIXED_OWNER, marketPda, FIXED_OWNER, 555n)
    const [expected] = deriveBetPda(FIXED_OWNER, 555n)
    expect(betPda.equals(expected)).toBe(true)
  })

  test('accounts order: bettor, bet, market, authority', () => {
    const [marketPda] = deriveMarketPda('mx')
    const { tx } = buildRedeemTx(FIXED_OWNER, marketPda, FIXED_OWNER, 1n)
    const keys = tx.instructions[0].keys
    expect(keys).toHaveLength(4)
    expect(keys[0].pubkey.equals(FIXED_OWNER)).toBe(true)
    expect(keys[0].isSigner).toBe(true)
    expect(keys[2].pubkey.equals(marketPda)).toBe(true)
    expect(keys[2].isWritable).toBe(true)
    // authority must be writable (protocol fee is credited to it)
    expect(keys[3].isWritable).toBe(true)
  })
})

describe('buildCreateMarketTx with opts', () => {
  test('encodes closesAt and feeBps', () => {
    const { tx } = buildCreateMarketTx(FIXED_OWNER, 'm', 'q', {
      closesAt: 1_800_000_000n,
      feeBps: 250,
    })
    const data = tx.instructions[0].data
    // layout: disc(8) + len(4) + "m"(1) + len(4) + "q"(1) + closes(8) + fee(2)
    // offsets: disc=0, id-len=8, id=12, q-len=13, q=17, closes=18, fee=26
    expect(data.readBigInt64LE(18)).toBe(1_800_000_000n)
    expect(data.readUInt16LE(26)).toBe(250)
  })

  test('rejects fee over 10_000 bps', () => {
    expect(() =>
      buildCreateMarketTx(FIXED_OWNER, 'm', 'q', { feeBps: 10_001 }),
    ).toThrow()
  })
})
