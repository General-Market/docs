/**
 * Operation ledger and event log parser for Phase 6 reconciliation.
 * Records all operations during chaos testing, parses on-chain events.
 */

import { ChaosOpType } from './config';
import { getLogs, EVENT_TOPICS, l3Rpc } from './helpers';
import { L3_RPC, L3_INDEX } from './config';

// ── Operation Ledger ─────────────────────────────────────────────────

export interface LedgerEntry {
  id: number;
  account: string;
  opType: ChaosOpType;
  itpId: string;
  amount: bigint;
  txHash: string | null;
  expectedRevert: boolean;
  fuzzLabel: string | null;
  succeeded: boolean | null; // null = pending
  timestamp: number;
}

export class OperationLedger {
  private entries: LedgerEntry[] = [];
  private nextId = 0;

  /** Record an operation, returns its ledger ID. */
  record(op: {
    account: string;
    opType: ChaosOpType;
    itpId: string;
    amount: bigint;
    txHash?: string;
    expectedRevert: boolean;
    fuzzLabel?: string;
  }): number {
    const id = this.nextId++;
    this.entries.push({
      id,
      account: op.account,
      opType: op.opType,
      itpId: op.itpId,
      amount: op.amount,
      txHash: op.txHash ?? null,
      expectedRevert: op.expectedRevert,
      fuzzLabel: op.fuzzLabel ?? null,
      succeeded: null,
      timestamp: Date.now(),
    });
    return id;
  }

  /** Mark operation result after receipt check. */
  markResult(id: number, succeeded: boolean, txHash?: string): void {
    const entry = this.entries[id];
    if (entry) {
      entry.succeeded = succeeded;
      if (txHash) entry.txHash = txHash;
    }
  }

  /** Get all entries. */
  getAll(): LedgerEntry[] {
    return this.entries;
  }

  /** Get entries by operation type. */
  getByType(type: ChaosOpType): LedgerEntry[] {
    return this.entries.filter(e => e.opType === type);
  }

  /** Get count of entries. */
  get length(): number {
    return this.entries.length;
  }

  /** Summary stats. */
  getSummary(): {
    total: number;
    byType: Record<ChaosOpType, number>;
    succeeded: number;
    reverted: number;
    pending: number;
    fuzzOps: number;
    fuzzCorrectReverts: number;
    fuzzIncorrectSuccesses: number;
  } {
    const byType = { buy: 0, sell: 0, create: 0, rebalance: 0, liquidate: 0 };
    let succeeded = 0, reverted = 0, pending = 0, fuzzOps = 0;
    let fuzzCorrectReverts = 0, fuzzIncorrectSuccesses = 0;

    for (const e of this.entries) {
      byType[e.opType]++;
      if (e.succeeded === true) succeeded++;
      else if (e.succeeded === false) reverted++;
      else pending++;

      if (e.expectedRevert) {
        fuzzOps++;
        if (e.succeeded === false) fuzzCorrectReverts++;
        if (e.succeeded === true) fuzzIncorrectSuccesses++;
      }
    }

    return {
      total: this.entries.length,
      byType,
      succeeded,
      reverted,
      pending,
      fuzzOps,
      fuzzCorrectReverts,
      fuzzIncorrectSuccesses,
    };
  }
}

// ── Event Parsers ────────────────────────────────────────────────────

export interface ParsedOrderSubmitted {
  orderId: bigint;
  user: string;
  itpId: string;
  pairId: string;
  side: number;
  amount: bigint;
  limitPrice: bigint;
  slippageTier: bigint;
  deadline: bigint;
  blockNumber: number;
  txHash: string;
}

export interface ParsedFillConfirmed {
  orderId: bigint;
  cycleNumber: bigint;
  fillPrice: bigint;
  fillAmount: bigint;
  blockNumber: number;
  txHash: string;
}

export interface ParsedITPCreated {
  itpId: string;
  creator: string;
  blockNumber: number;
  txHash: string;
}

export interface ParsedRebalanced {
  itpId: string;
  nav: bigint;
  blockNumber: number;
  txHash: string;
}

export interface ParsedFeeCharged {
  user: string;
  itpId: string;
  amount: bigint;
  feeType: number;
  blockNumber: number;
  txHash: string;
}

function hexToInt(hex: string): bigint {
  return BigInt('0x' + hex.replace('0x', ''));
}

function hexToAddr(hex: string): string {
  const clean = hex.replace('0x', '');
  return '0x' + clean.slice(-40).toLowerCase();
}

export function parseOrderSubmitted(log: { topics: string[]; data: string; blockNumber: string; transactionHash: string }): ParsedOrderSubmitted {
  const data = log.data.replace('0x', '');
  return {
    orderId: hexToInt(log.topics[1]),
    user: hexToAddr(log.topics[2]),
    itpId: log.topics[3],
    pairId: '0x' + data.slice(0, 64),
    side: Number(hexToInt('0x' + data.slice(64, 128))),
    amount: hexToInt('0x' + data.slice(128, 192)),
    limitPrice: hexToInt('0x' + data.slice(192, 256)),
    slippageTier: hexToInt('0x' + data.slice(256, 320)),
    deadline: hexToInt('0x' + data.slice(320, 384)),
    blockNumber: Number(hexToInt(log.blockNumber)),
    txHash: log.transactionHash,
  };
}

export function parseFillConfirmed(log: { topics: string[]; data: string; blockNumber: string; transactionHash: string }): ParsedFillConfirmed {
  const data = log.data.replace('0x', '');
  return {
    orderId: hexToInt(log.topics[1]),
    cycleNumber: hexToInt(log.topics[2]),
    fillPrice: hexToInt('0x' + data.slice(0, 64)),
    fillAmount: hexToInt('0x' + data.slice(64, 128)),
    blockNumber: Number(hexToInt(log.blockNumber)),
    txHash: log.transactionHash,
  };
}

export function parseITPCreated(log: { topics: string[]; data: string; blockNumber: string; transactionHash: string }): ParsedITPCreated {
  return {
    itpId: log.topics[1],
    creator: hexToAddr(log.topics[2]),
    blockNumber: Number(hexToInt(log.blockNumber)),
    txHash: log.transactionHash,
  };
}

export function parseRebalanced(log: { topics: string[]; data: string; blockNumber: string; transactionHash: string }): ParsedRebalanced {
  const data = log.data.replace('0x', '');
  // NAV is the last uint256 in the data (after dynamic array encoding)
  // For simplicity, we'll read it from the end
  const words = [];
  for (let i = 0; i < data.length; i += 64) {
    words.push(data.slice(i, i + 64));
  }
  const nav = words.length > 0 ? hexToInt('0x' + words[words.length - 1]) : 0n;
  return {
    itpId: log.topics[1],
    nav,
    blockNumber: Number(hexToInt(log.blockNumber)),
    txHash: log.transactionHash,
  };
}

export function parseFeeCharged(log: { topics: string[]; data: string; blockNumber: string; transactionHash: string }): ParsedFeeCharged {
  const data = log.data.replace('0x', '');
  return {
    user: hexToAddr(log.topics[1]),
    itpId: log.topics[2],
    amount: hexToInt('0x' + data.slice(0, 64)),
    feeType: Number(hexToInt('0x' + data.slice(64, 128))),
    blockNumber: Number(hexToInt(log.blockNumber)),
    txHash: log.transactionHash,
  };
}

// ── Batch event parsing ──────────────────────────────────────────────

export interface ParsedEvents {
  ordersSubmitted: ParsedOrderSubmitted[];
  fillsConfirmed: ParsedFillConfirmed[];
  itpsCreated: ParsedITPCreated[];
  rebalances: ParsedRebalanced[];
  feesCharged: ParsedFeeCharged[];
}

/** Parse all relevant events from L3 Index contract between two blocks. */
export async function parseEventsInRange(
  fromBlock: number,
  toBlock: number,
): Promise<ParsedEvents> {
  const from = '0x' + fromBlock.toString(16);
  const to = '0x' + toBlock.toString(16);

  // Fetch all event types in parallel
  const [orderLogs, fillLogs, createLogs, rebalanceLogs, feeLogs] = await Promise.all([
    getLogs(L3_RPC, L3_INDEX, [EVENT_TOPICS.OrderSubmitted], from, to).catch(() => []),
    getLogs(L3_RPC, L3_INDEX, [EVENT_TOPICS.FillConfirmed], from, to).catch(() => []),
    getLogs(L3_RPC, L3_INDEX, [EVENT_TOPICS.ITPCreated], from, to).catch(() => []),
    getLogs(L3_RPC, L3_INDEX, [EVENT_TOPICS.Rebalanced], from, to).catch(() => []),
    getLogs(L3_RPC, L3_INDEX, [EVENT_TOPICS.FeeCharged], from, to).catch(() => []),
  ]);

  return {
    ordersSubmitted: orderLogs.map(parseOrderSubmitted),
    fillsConfirmed: fillLogs.map(parseFillConfirmed),
    itpsCreated: createLogs.map(parseITPCreated),
    rebalances: rebalanceLogs.map(parseRebalanced),
    feesCharged: feeLogs.map(parseFeeCharged),
  };
}
