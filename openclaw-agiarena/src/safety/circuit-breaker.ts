import { CircuitBreakerState, BetRecord } from '../types';
import { ResearchStore } from '../research/store';

interface CircuitBreakerConfig {
  /** Maximum drawdown percentage before tripping (default 15) */
  drawdownPct: number;
  /** Number of consecutive losses before tripping (default 5) */
  consecutiveLosses: number;
  /** Cooldown period in minutes before auto-reset (default 60) */
  cooldownMin: number;
}

/**
 * Auto-halts trading on drawdown or consecutive losses.
 *
 * The circuit breaker monitors settled bet outcomes and trips when:
 * - Cumulative PnL as a percentage of capital deployed exceeds the
 *   drawdown threshold, or
 * - A streak of consecutive losing bets reaches the configured limit.
 *
 * Once tripped, all trading is paused until the cooldown period expires
 * (auto-reset) or a manual reset is issued.
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = {
    tripped: false,
    trippedAt: null,
    reason: null,
    cooldownUntil: null,
  };

  constructor(
    private store: ResearchStore,
    private config: CircuitBreakerConfig,
  ) {}

  /**
   * Check if trading is allowed.
   *
   * If the breaker is tripped but the cooldown has expired, it auto-resets
   * and returns allowed.
   */
  check(): { allowed: boolean; reason?: string } {
    if (!this.state.tripped) {
      return { allowed: true };
    }

    // Auto-reset after cooldown
    if (this.state.cooldownUntil !== null && Date.now() >= this.state.cooldownUntil) {
      this.reset();
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: this.state.reason ?? 'Circuit breaker tripped',
    };
  }

  /**
   * Evaluate recent bet results and trip if thresholds are exceeded.
   *
   * Should be called after each bet settles.
   */
  evaluate(): void {
    const settledBets = this.store
      .getBets({ status: 'settled' })
      .filter((b) => isSameDay(b.settledAt ?? b.createdAt, Date.now()));

    if (settledBets.length === 0) return;

    // --- Drawdown check ---
    const totalDeployed = settledBets.reduce((sum, b) => sum + b.stakeWind, 0);

    if (totalDeployed > 0) {
      const totalPnl = settledBets.reduce((sum, b) => sum + (b.pnl ?? 0), 0);
      const drawdownPct = Math.abs(Math.min(0, totalPnl)) / totalDeployed * 100;

      if (drawdownPct >= this.config.drawdownPct) {
        this.trip(
          `Drawdown ${drawdownPct.toFixed(1)}% exceeds threshold of ${this.config.drawdownPct}%`,
        );
        return;
      }
    }

    // --- Consecutive losses check ---
    const sorted = [...settledBets].sort((a, b) => {
      const aTime = a.settledAt ?? a.createdAt;
      const bTime = b.settledAt ?? b.createdAt;
      return bTime - aTime; // most recent first
    });

    let consecutiveLosses = 0;
    for (const bet of sorted) {
      if (bet.pnl !== null && bet.pnl < 0) {
        consecutiveLosses++;
      } else {
        break;
      }
    }

    if (consecutiveLosses >= this.config.consecutiveLosses) {
      this.trip(
        `${consecutiveLosses} consecutive losses (threshold: ${this.config.consecutiveLosses})`,
      );
    }
  }

  /**
   * Get the current circuit breaker state.
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Force reset the circuit breaker, clearing the tripped state.
   */
  reset(): void {
    this.state = {
      tripped: false,
      trippedAt: null,
      reason: null,
      cooldownUntil: null,
    };
  }

  /**
   * Trip the circuit breaker with a reason and start the cooldown timer.
   */
  private trip(reason: string): void {
    const now = Date.now();
    this.state = {
      tripped: true,
      trippedAt: now,
      reason,
      cooldownUntil: now + this.config.cooldownMin * 60 * 1000,
    };
  }
}

/**
 * Check whether two timestamps fall on the same calendar day (UTC).
 */
function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
}
