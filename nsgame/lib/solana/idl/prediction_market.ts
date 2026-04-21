/**
 * TS type helper mirroring `prediction_market.json`.
 *
 * The JSON is the source of truth. This file exists so TS callers can
 * narrow account / instruction names without hauling the whole JSON into
 * their type graph. Discriminators are placeholder zeros — TODO: fill
 * from `anchor build` once the on-chain program ships.
 */

export type PredictionMarket = {
  address: 'PredMarkTBD11111111111111111111111111111111'
  metadata: {
    name: 'prediction_market'
    version: '0.1.0'
    spec: '0.1.0'
    description: string
  }
  instructions: ReadonlyArray<{
    name:
      | 'initialize_config'
      | 'upsert_source'
      | 'set_pause'
      | 'set_fee_bps'
      | 'propose_admin'
      | 'accept_admin'
      | 'withdraw_fees'
      | 'propose_oracle_signers'
      | 'activate_oracle_signers'
      | 'place_bet'
      | 'exit_bet'
      | 'batch_bets'
      | 'close_market'
      | 'resolve_market'
      | 'admin_force_resolve'
      | 'claim'
    discriminator: number[]
  }>
  accounts: ReadonlyArray<{ name: AccountName; discriminator: number[] }>
  events: ReadonlyArray<{ name: EventName; discriminator: number[] }>
}

export type AccountName =
  | 'GlobalConfig'
  | 'OracleConfig'
  | 'Source'
  | 'Market'
  | 'Position'

export type EventName =
  | 'MarketInstantiated'
  | 'BetPlaced'
  | 'BetExited'
  | 'MarketClosed'
  | 'MarketResolved'
  | 'Claimed'
  | 'OracleSignersActivated'

// Frontend-facing args. The on-chain encoding is handled by predictionMarket.ts.

export type Side = 'Yes' | 'No'

export interface PlaceBetArgs {
  sourceId: number
  closeTime: bigint
  settlementTime: bigint
  thresholdBps: number
  side: Side
  amount: bigint
}

export interface ExitBetArgs {
  side: Side
  amount: bigint
}

export interface BatchEntry {
  sourceId: number
  closeTime: bigint
  settlementTime: bigint
  thresholdBps: number
  side: Side
  amount: bigint
}
