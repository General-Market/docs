import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
  createApproveCheckedInstruction,
  createRevokeInstruction,
} from '@solana/spl-token'

// One-click trading primitives.
//
// A session wallet is an ephemeral Keypair generated in-browser and kept only
// in memory. The enable transaction is one user signature that does up to
// two things:
//
//   1. Fund the session key with a small amount of SOL so it can pay fees
//      and (in SOL-only demos) act as the trading collateral itself.
//   2. If a token mint is configured, approve the session key as a delegate
//      on the user's associated token account with an explicit spending cap.
//
// After that single popup, subsequent trade transactions can be signed
// locally by the session key — no wallet prompt. If a token delegate was
// set, the session can move up to spendingCap of that one mint, nothing
// more. Revoking is a separate user-signed tx.
//
// The session key never persists. Closing the tab kills it. To keep trading,
// the user re-approves with one signature. That is the cost of not storing
// long-lived signing material on disk.

export interface SessionConfig {
  // Optional — when present, the session key is delegated as a spender on
  // the user's ATA. When omitted, the session relies on SOL funding alone
  // (useful for SOL-collateral demos or Anchor programs that read SOL).
  tokenMint?: PublicKey
  userTokenAccount?: PublicKey
  spendingCap?: bigint
  mintDecimals?: number
  // SOL funding for the session key, in whole SOL. 0.02 SOL ~ 200 trades at
  // 5k lamport fees. For SOL-collateral demos, raise this to cover both
  // fees and the bet pool (e.g. 0.2 SOL for 20 bets at 0.01 SOL each).
  solFunding: number
}

export function generateSessionKeypair(): Keypair {
  return Keypair.generate()
}

// Builds the tx the user signs to enable their session. feePayer and
// recentBlockhash are set by the caller before signing.
export function buildEnableSessionTx(
  owner: PublicKey,
  session: PublicKey,
  config: SessionConfig,
): Transaction {
  const tx = new Transaction()

  const fundingLamports = Math.floor(config.solFunding * LAMPORTS_PER_SOL)
  if (fundingLamports > 0) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: session,
        lamports: fundingLamports,
      }),
    )
  }

  // Token delegation is optional — only wire it if the caller supplied a
  // mint + ATA + cap. approveChecked enforces mint/decimals match at the
  // SPL layer, catching sign-wrong-token bugs before they become funds-lost.
  if (config.tokenMint && config.userTokenAccount && config.spendingCap !== undefined && config.mintDecimals !== undefined) {
    tx.add(
      createApproveCheckedInstruction(
        config.userTokenAccount,
        config.tokenMint,
        session,
        owner,
        config.spendingCap,
        config.mintDecimals,
      ),
    )
  }

  return tx
}

// Revokes any delegation. Safe to call even if none was set — the SPL
// program treats it as a no-op on an undelegated account. Session SOL is
// not swept back; for demo amounts the dust is not worth a second tx.
export function buildDisableSessionTx(
  owner: PublicKey,
  userTokenAccount?: PublicKey,
): Transaction {
  const tx = new Transaction()
  if (userTokenAccount) {
    tx.add(createRevokeInstruction(userTokenAccount, owner))
  }
  return tx
}
