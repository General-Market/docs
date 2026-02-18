import { randomUUID } from 'node:crypto';
import { PendingBet } from '../types';
import { ResearchStore } from '../research/store';

const PENDING_BET_TTL_MS = 3_600_000 // 1 hour

/**
 * Queues bets for user confirmation before execution.
 *
 * Every bet goes through the approval gate: the agent proposes, the human
 * approves or rejects. This keeps a human in the loop for all capital
 * deployment decisions.
 */
export class ApprovalGate {
  constructor(
    private store: ResearchStore,
    private sendMessage: (channel: string, text: string) => Promise<void>,
  ) {}

  /**
   * Queue a bet for approval.
   *
   * Persists the bet as `pending_approval` and sends a formatted summary
   * to the user's channel with approve/reject instructions.
   *
   * @returns The generated pending bet ID.
   */
  async queue(
    bet: Omit<PendingBet, 'id' | 'createdAt' | 'status'>,
    channel: string,
  ): Promise<string> {
    const id = randomUUID();

    const pendingBet: PendingBet = {
      ...bet,
      id,
      createdAt: Date.now(),
      status: 'pending_approval',
    };

    this.store.savePendingBet(pendingBet);

    const topConviction = bet.portfolio.positions.length > 0
      ? bet.portfolio.positions.reduce(
          (best, pos) => (pos.confidence > best.confidence ? pos : best),
          bet.portfolio.positions[0],
        )
      : null;

    const lines = [
      `--- Bet Approval Request [${id}] ---`,
      ``,
      `Action: ${bet.action.toUpperCase()}`,
      `Stake: ${bet.stakeWind} WIND`,
      `Odds: ${bet.oddsBps} bps`,
      `Summary: ${bet.summary}`,
      ``,
      `Informed positions: ${bet.portfolio.informedCount} / ${bet.portfolio.totalCount}`,
    ];

    if (topConviction) {
      lines.push(
        `Top conviction: ${topConviction.position} on ${topConviction.marketId} (confidence ${(topConviction.confidence * 100).toFixed(1)}%)`,
      );
    }

    lines.push(
      ``,
      `To approve: /approve ${id}`,
      `To reject:  /reject ${id}`,
    );

    await this.sendMessage(channel, lines.join('\n'));

    return id;
  }

  /**
   * Approve a pending bet by ID.
   *
   * @returns The approved PendingBet, or null if not found, already processed, or expired.
   */
  approve(betId: string): PendingBet | null {
    const pending = this.store.getPendingBets().find(
      (b) => b.id === betId && b.status === 'pending_approval',
    );

    if (!pending) return null;

    // Reject if the pending bet has expired
    if (Date.now() - pending.createdAt > PENDING_BET_TTL_MS) {
      this.store.updatePendingBetStatus(betId, 'rejected');
      return null;
    }

    this.store.updatePendingBetStatus(betId, 'approved');
    return { ...pending, status: 'approved' };
  }

  /**
   * Reject a pending bet by ID.
   *
   * @returns true if the bet was found and rejected, false otherwise.
   */
  reject(betId: string): boolean {
    const pending = this.store.getPendingBets().find(
      (b) => b.id === betId && b.status === 'pending_approval',
    );

    if (!pending) return false;

    this.store.updatePendingBetStatus(betId, 'rejected');
    return true;
  }

  /**
   * Get all pending bets awaiting approval (auto-rejects expired ones).
   */
  getPending(): PendingBet[] {
    this.reapExpired();
    return this.store.getPendingBets().filter(
      (b) => b.status === 'pending_approval',
    );
  }

  /**
   * Auto-reject pending bets older than PENDING_BET_TTL_MS.
   */
  private reapExpired(): void {
    const now = Date.now();
    const pending = this.store.getPendingBets().filter(
      (b) => b.status === 'pending_approval',
    );

    for (const bet of pending) {
      if (now - bet.createdAt > PENDING_BET_TTL_MS) {
        this.store.updatePendingBetStatus(bet.id, 'rejected');
      }
    }
  }
}
