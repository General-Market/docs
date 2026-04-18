import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from '@solana/web3.js'

// A stand-in for the prediction-market program we haven't deployed yet.
// Every "trade" is a real on-chain transaction, but the logic is fake —
// SystemProgram.transfer + a Memo instruction. When the real program
// arrives, mockMarket.ts disappears and the instruction encoder that
// replaces it returns the same Transaction shape.
//
// This file exists so the one-click session layer has something to sign
// against today, not when the smart contracts ship.

// Memo program — deployed on every cluster. It accepts arbitrary UTF-8
// and lands it in the transaction log, readable by any indexer or script.
export const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
)

// The "market treasury" — a fresh Keypair we generate once, pubkey hard-
// coded into the frontend. Bets settle into this wallet. In production
// this would be a PDA owned by the program, but for demo purposes a
// static keypair is enough. Nobody controls the private key — bets paid
// in are effectively locked, which makes the mock honest: it's a sink,
// not a bank. Redemption requires the real program.
export const MOCK_TREASURY = new PublicKey(
  // Generated via solana-keygen. The seed phrase was discarded on purpose —
  // bets paid in cannot be withdrawn. The mock is a sink, not a bank.
  '4Ly739WHeDNSv6T1fRzpCxzjVuCPp5GX1eUSXdgu8ros',
)

export interface MockMarket {
  id: string
  question: string
  outcomes: Array<{ id: string; label: string; impliedOdds: number }>
  closesAt: number | null
}

// Hard-coded sample markets so the UI has something to render before any
// backend exists. Odds are static; in a real system they'd update live.
export const MOCK_MARKETS: MockMarket[] = [
  {
    id: 'btc-100k-2027',
    question: 'Will BTC close above $100,000 on 2027-01-01?',
    outcomes: [
      { id: 'yes', label: 'Yes', impliedOdds: 0.62 },
      { id: 'no', label: 'No', impliedOdds: 0.38 },
    ],
    closesAt: new Date('2027-01-01T00:00:00Z').getTime(),
  },
  {
    id: 'sol-1k-2026',
    question: 'Will SOL touch $1,000 before 2027-01-01?',
    outcomes: [
      { id: 'yes', label: 'Yes', impliedOdds: 0.31 },
      { id: 'no', label: 'No', impliedOdds: 0.69 },
    ],
    closesAt: new Date('2027-01-01T00:00:00Z').getTime(),
  },
  {
    id: 'ftx-refund-2026',
    question: 'Will FTX creditors receive >80% by year end 2026?',
    outcomes: [
      { id: 'yes', label: 'Yes', impliedOdds: 0.54 },
      { id: 'no', label: 'No', impliedOdds: 0.46 },
    ],
    closesAt: new Date('2026-12-31T23:59:59Z').getTime(),
  },
  {
    id: 'eth-etf-staking',
    question: 'Will a spot ETH ETF be approved for staking in 2026?',
    outcomes: [
      { id: 'yes', label: 'Yes', impliedOdds: 0.41 },
      { id: 'no', label: 'No', impliedOdds: 0.59 },
    ],
    closesAt: null,
  },
]

export interface MockBet {
  signature: string
  marketId: string
  outcomeId: string
  amountSol: number
  timestamp: number
  bettor: string
}

// Encodes the bet into a memo the treasury (or any indexer) can parse back.
// Shape: "NSMKT/v1/<marketId>/<outcomeId>/<lamports>"
// Prefix gives us a cheap filter when scanning transaction logs later.
export function encodeBetMemo(marketId: string, outcomeId: string, lamports: number): string {
  return `NSMKT/v1/${marketId}/${outcomeId}/${lamports}`
}

export function decodeBetMemo(memo: string): { marketId: string; outcomeId: string; lamports: number } | null {
  if (!memo.startsWith('NSMKT/v1/')) return null
  const parts = memo.slice('NSMKT/v1/'.length).split('/')
  if (parts.length !== 3) return null
  const [marketId, outcomeId, lamportsStr] = parts
  const lamports = Number(lamportsStr)
  if (!Number.isFinite(lamports)) return null
  return { marketId, outcomeId, lamports }
}

// Builds the bet transaction. Signed by the session key, feePayer is the
// session key (so the user's main wallet never touches this path after
// enable). In production, `buildBetTx` would replace the SystemProgram
// transfer with a program instruction that validates the market, the
// outcome, and the amount.
export function buildBetTx(
  bettor: PublicKey,
  marketId: string,
  outcomeId: string,
  amountSol: number,
): Transaction {
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL)
  if (lamports <= 0) throw new Error('Bet amount must be positive')

  const tx = new Transaction()
  tx.add(
    SystemProgram.transfer({
      fromPubkey: bettor,
      toPubkey: MOCK_TREASURY,
      lamports,
    }),
  )
  tx.add(
    new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(encodeBetMemo(marketId, outcomeId, lamports), 'utf8'),
    }),
  )
  return tx
}

// Helper for tests / scripts that want to spin up a new treasury.
export function generateTreasuryKeypair(): Keypair {
  return Keypair.generate()
}
