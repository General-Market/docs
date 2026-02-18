import { ResearchStore } from '../research/store';

interface CapitalLimiterConfig {
  /** Maximum stake per individual bet in WIND */
  maxBetWind: number;
  /** Maximum total stake across all bets in a 24h window in WIND */
  maxDailyWind: number;
}

/**
 * Enforces per-bet and daily WIND capital caps.
 *
 * Acts as a hard ceiling on capital deployment. No bet can exceed the
 * per-bet limit, and cumulative daily exposure cannot exceed the daily
 * limit. Both limits are dynamically configurable.
 */
export class CapitalLimiter {
  private config: CapitalLimiterConfig;

  constructor(
    private store: ResearchStore,
    config: CapitalLimiterConfig,
  ) {
    this.config = { ...config };
  }

  /**
   * Check if a bet of the given size is allowed under current limits.
   *
   * Evaluation order:
   * 1. Per-bet cap -- reject if stakeWind exceeds maxBetWind
   * 2. Daily cap  -- reject if daily total + stakeWind exceeds maxDailyWind
   */
  check(stakeWind: number): { allowed: boolean; reason?: string } {
    if (stakeWind > this.config.maxBetWind) {
      return {
        allowed: false,
        reason: `Stake ${stakeWind} WIND exceeds per-bet limit of ${this.config.maxBetWind} WIND`,
      };
    }

    const dailyTotal = this.store.getDailyBetTotal();

    if (dailyTotal + stakeWind > this.config.maxDailyWind) {
      const remaining = Math.max(0, this.config.maxDailyWind - dailyTotal);
      return {
        allowed: false,
        reason: `Daily limit would be exceeded: ${dailyTotal} WIND deployed today + ${stakeWind} WIND = ${dailyTotal + stakeWind} WIND (limit: ${this.config.maxDailyWind} WIND, remaining: ${remaining} WIND)`,
      };
    }

    return { allowed: true };
  }

  /**
   * Update configuration dynamically.
   *
   * Partial updates are merged with the existing config.
   */
  updateConfig(config: Partial<CapitalLimiterConfig>): void {
    if (config.maxBetWind !== undefined) {
      this.config.maxBetWind = config.maxBetWind;
    }
    if (config.maxDailyWind !== undefined) {
      this.config.maxDailyWind = config.maxDailyWind;
    }
  }
}
