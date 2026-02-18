/**
 * SQLite-backed research cache and bet journal.
 *
 * Uses better-sqlite3 for synchronous, fast local storage. Tables are
 * created on construction so the store is immediately usable.
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3'
import type {
  ResearchResult,
  BetRecord,
  PendingBet,
  KillSwitchState,
  BetAction,
  PortfolioPosition,
  Portfolio,
} from '../types'

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

export class ResearchStore {
  private readonly db: DatabaseType
  private cleanupHandle: ReturnType<typeof setInterval> | null = null

  constructor(dbPath: string = 'data/plugin.db') {
    this.db = new Database(dbPath)

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')

    this.initTables()
  }

  // -----------------------------------------------------------------------
  // Research
  // -----------------------------------------------------------------------

  /** Insert or update a research result keyed by marketId. */
  upsertResearch(result: ResearchResult): void {
    const stmt = this.db.prepare(`
      INSERT INTO research (market_id, source, question, prob_yes, confidence, reasoning, sources, researched_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(market_id) DO UPDATE SET
        source = excluded.source,
        question = excluded.question,
        prob_yes = excluded.prob_yes,
        confidence = excluded.confidence,
        reasoning = excluded.reasoning,
        sources = excluded.sources,
        researched_at = excluded.researched_at,
        expires_at = excluded.expires_at
    `)

    stmt.run(
      result.marketId,
      result.source,
      result.question,
      result.probYes,
      result.confidence,
      result.reasoning,
      JSON.stringify(result.sources),
      result.researchedAt,
      result.expiresAt
    )
  }

  /** Retrieve a single research result by marketId, or null if missing. */
  getResearch(marketId: string): ResearchResult | null {
    const row = this.db.prepare(
      'SELECT * FROM research WHERE market_id = ?'
    ).get(marketId) as ResearchRow | undefined

    return row ? this.rowToResearch(row) : null
  }

  /** Return all non-expired research results. */
  getActiveResearch(): ResearchResult[] {
    const now = Date.now()
    const rows = this.db.prepare(
      'SELECT * FROM research WHERE expires_at > ? ORDER BY researched_at DESC'
    ).all(now) as ResearchRow[]

    return rows.map((r) => this.rowToResearch(r))
  }

  /** Return all research results (including expired). */
  getAllResearch(): ResearchResult[] {
    const rows = this.db.prepare(
      'SELECT * FROM research ORDER BY researched_at DESC'
    ).all() as ResearchRow[]

    return rows.map((r) => this.rowToResearch(r))
  }

  /** Return top N non-expired research results ordered by confidence descending. */
  getTopResearch(limit: number): ResearchResult[] {
    const now = Date.now()
    const rows = this.db.prepare(
      'SELECT * FROM research WHERE expires_at > ? ORDER BY confidence DESC LIMIT ?'
    ).all(now, limit) as ResearchRow[]

    return rows.map((r) => this.rowToResearch(r))
  }

  /** Remove all expired research entries. */
  cleanExpired(): void {
    const now = Date.now()
    this.db.prepare('DELETE FROM research WHERE expires_at <= ?').run(now)
  }

  // -----------------------------------------------------------------------
  // Bets
  // -----------------------------------------------------------------------

  /** Save a finalized bet record. */
  saveBet(record: BetRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO bets (id, bet_id, action, stake_wind, odds_bps, positions, informed_count, total_count, tx_hash, status, pnl, created_at, settled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        bet_id = excluded.bet_id,
        action = excluded.action,
        stake_wind = excluded.stake_wind,
        odds_bps = excluded.odds_bps,
        positions = excluded.positions,
        informed_count = excluded.informed_count,
        total_count = excluded.total_count,
        tx_hash = excluded.tx_hash,
        status = excluded.status,
        pnl = excluded.pnl,
        created_at = excluded.created_at,
        settled_at = excluded.settled_at
    `)

    stmt.run(
      record.id,
      record.betId,
      record.action,
      record.stakeWind,
      record.oddsBps,
      JSON.stringify(record.positions),
      record.informedCount,
      record.totalCount,
      record.txHash,
      record.status,
      record.pnl,
      record.createdAt,
      record.settledAt
    )
  }

  /** Retrieve bets, optionally filtered by status. */
  getBets(filter?: { status?: string }): BetRecord[] {
    let sql = 'SELECT * FROM bets'
    const params: unknown[] = []

    if (filter?.status) {
      sql += ' WHERE status = ?'
      params.push(filter.status)
    }

    sql += ' ORDER BY created_at DESC'

    const rows = this.db.prepare(sql).all(...params) as BetRow[]
    return rows.map((r) => this.rowToBet(r))
  }

  /** Update a bet's status and optionally its PnL. */
  updateBetStatus(id: string, status: string, pnl?: number): void {
    if (pnl !== undefined) {
      this.db.prepare(
        'UPDATE bets SET status = ?, pnl = ?, settled_at = ? WHERE id = ?'
      ).run(status, pnl, Date.now(), id)
    } else {
      this.db.prepare('UPDATE bets SET status = ? WHERE id = ?').run(status, id)
    }
  }

  // -----------------------------------------------------------------------
  // Pending bets
  // -----------------------------------------------------------------------

  /** Save a pending bet awaiting approval. */
  savePendingBet(bet: PendingBet): void {
    const stmt = this.db.prepare(`
      INSERT INTO pending_bets (id, action, portfolio, stake_wind, odds_bps, category_id, summary, match_bet_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        action = excluded.action,
        portfolio = excluded.portfolio,
        stake_wind = excluded.stake_wind,
        odds_bps = excluded.odds_bps,
        category_id = excluded.category_id,
        summary = excluded.summary,
        match_bet_id = excluded.match_bet_id,
        status = excluded.status,
        created_at = excluded.created_at
    `)

    stmt.run(
      bet.id,
      bet.action,
      JSON.stringify(bet.portfolio),
      bet.stakeWind,
      bet.oddsBps,
      bet.categoryId ?? null,
      bet.summary,
      bet.matchBetId ?? null,
      bet.status,
      bet.createdAt
    )
  }

  /** Retrieve all pending bets (any status). */
  getPendingBets(): PendingBet[] {
    const rows = this.db.prepare(
      'SELECT * FROM pending_bets ORDER BY created_at DESC'
    ).all() as PendingBetRow[]

    return rows.map((r) => this.rowToPendingBet(r))
  }

  /** Update a pending bet's status. */
  updatePendingBetStatus(id: string, status: string): void {
    this.db.prepare('UPDATE pending_bets SET status = ? WHERE id = ?').run(status, id)
  }

  // -----------------------------------------------------------------------
  // Kill switch
  // -----------------------------------------------------------------------

  /** Read the current kill switch state. */
  getKillSwitch(): KillSwitchState {
    const row = this.db.prepare(
      'SELECT * FROM kill_switch WHERE id = 1'
    ).get() as KillSwitchRow | undefined

    if (!row) {
      return { active: false, activatedAt: null, reason: null }
    }

    return {
      active: row.active === 1,
      activatedAt: row.activated_at,
      reason: row.reason,
    }
  }

  /** Activate or deactivate the kill switch. */
  setKillSwitch(active: boolean, reason?: string): void {
    this.db.prepare(`
      INSERT INTO kill_switch (id, active, activated_at, reason)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        active = excluded.active,
        activated_at = excluded.activated_at,
        reason = excluded.reason
    `).run(
      active ? 1 : 0,
      active ? Date.now() : null,
      reason ?? null
    )
  }

  // -----------------------------------------------------------------------
  // Config
  // -----------------------------------------------------------------------

  /** Read a config value by key, or null if not set. */
  getConfig(key: string): string | null {
    const row = this.db.prepare(
      'SELECT value FROM config WHERE key = ?'
    ).get(key) as { value: string } | undefined

    return row?.value ?? null
  }

  /** Set a config value (upsert). */
  setConfig(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO config (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value)
  }

  // -----------------------------------------------------------------------
  // Aggregates
  // -----------------------------------------------------------------------

  /** Sum of stake_wind for bets created today (UTC midnight boundary). */
  getDailyBetTotal(): number {
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const startMs = todayStart.getTime()

    const row = this.db.prepare(
      'SELECT COALESCE(SUM(stake_wind), 0) AS total FROM bets WHERE created_at >= ?'
    ).get(startMs) as { total: number }

    return row.total
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Start periodic cleanup of expired research entries. */
  startCleanupSchedule(): void {
    this.stopCleanupSchedule()
    this.cleanupHandle = setInterval(() => this.cleanExpired(), CLEANUP_INTERVAL_MS)
  }

  /** Stop the periodic cleanup schedule. */
  stopCleanupSchedule(): void {
    if (this.cleanupHandle !== null) {
      clearInterval(this.cleanupHandle)
      this.cleanupHandle = null
    }
  }

  /** Close the database connection. */
  close(): void {
    this.stopCleanupSchedule()
    this.db.close()
  }

  // -----------------------------------------------------------------------
  // Internal: table initialization
  // -----------------------------------------------------------------------

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS research (
        market_id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        question TEXT NOT NULL,
        prob_yes REAL NOT NULL,
        confidence REAL NOT NULL,
        reasoning TEXT NOT NULL,
        sources TEXT NOT NULL,
        researched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bets (
        id TEXT PRIMARY KEY,
        bet_id TEXT,
        action TEXT NOT NULL,
        stake_wind REAL NOT NULL,
        odds_bps INTEGER NOT NULL,
        positions TEXT NOT NULL,
        informed_count INTEGER NOT NULL,
        total_count INTEGER NOT NULL,
        tx_hash TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        pnl REAL,
        created_at INTEGER NOT NULL,
        settled_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS pending_bets (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        portfolio TEXT NOT NULL,
        stake_wind REAL NOT NULL,
        odds_bps INTEGER NOT NULL,
        category_id TEXT,
        summary TEXT NOT NULL,
        match_bet_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending_approval',
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS kill_switch (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        active INTEGER NOT NULL DEFAULT 0,
        activated_at INTEGER,
        reason TEXT
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }

  // -----------------------------------------------------------------------
  // Internal: row mappers
  // -----------------------------------------------------------------------

  private rowToResearch(row: ResearchRow): ResearchResult {
    return {
      marketId: row.market_id,
      source: row.source as ResearchResult['source'],
      question: row.question,
      probYes: row.prob_yes,
      confidence: row.confidence,
      reasoning: row.reasoning,
      sources: JSON.parse(row.sources) as string[],
      researchedAt: row.researched_at,
      expiresAt: row.expires_at,
    }
  }

  private rowToBet(row: BetRow): BetRecord {
    return {
      id: row.id,
      betId: row.bet_id,
      action: row.action as BetAction,
      stakeWind: row.stake_wind,
      oddsBps: row.odds_bps,
      positions: JSON.parse(row.positions) as PortfolioPosition[],
      informedCount: row.informed_count,
      totalCount: row.total_count,
      txHash: row.tx_hash,
      status: row.status as BetRecord['status'],
      pnl: row.pnl,
      createdAt: row.created_at,
      settledAt: row.settled_at,
    }
  }

  private rowToPendingBet(row: PendingBetRow): PendingBet {
    return {
      id: row.id,
      action: row.action as BetAction,
      portfolio: JSON.parse(row.portfolio) as Portfolio,
      stakeWind: row.stake_wind,
      oddsBps: row.odds_bps,
      categoryId: row.category_id ?? undefined,
      summary: row.summary,
      matchBetId: row.match_bet_id ?? undefined,
      status: row.status as PendingBet['status'],
      createdAt: row.created_at,
    }
  }
}

// ---------------------------------------------------------------------------
// Internal row types (SQLite column shapes)
// ---------------------------------------------------------------------------

interface ResearchRow {
  market_id: string
  source: string
  question: string
  prob_yes: number
  confidence: number
  reasoning: string
  sources: string
  researched_at: number
  expires_at: number
}

interface BetRow {
  id: string
  bet_id: string
  action: string
  stake_wind: number
  odds_bps: number
  positions: string
  informed_count: number
  total_count: number
  tx_hash: string
  status: string
  pnl: number | null
  created_at: number
  settled_at: number | null
}

interface PendingBetRow {
  id: string
  action: string
  portfolio: string
  stake_wind: number
  odds_bps: number
  category_id: string | null
  summary: string
  match_bet_id: string | null
  status: string
  created_at: number
}

interface KillSwitchRow {
  id: number
  active: number
  activated_at: number | null
  reason: string | null
}
