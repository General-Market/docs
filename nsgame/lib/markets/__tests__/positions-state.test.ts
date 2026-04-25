import { describe, test, expect } from 'bun:test'
import type { PositionState } from '../positions'

// The DB-row → PositionState mapper lives in
// `app/api/positions/[wallet]/route.ts` as a private function `deriveState`.
// It is not exported, and the constraint forbids modifying source files —
// so the case-by-case tests are listed as todos. The `PositionState` type,
// however, is exported from `lib/markets/positions.ts`, and the helpers
// inside that same file (`isWon`, `isResolved`, `settleOutcome`, `safeBig`)
// are not. We assert what we can without changing exports.

describe('PositionState (type contract)', () => {
  test('every documented state is a valid PositionState string', () => {
    // Compile-time check — if any of these strings ever drift, the type
    // narrows tighter and TS rejects the assignment.
    const states: PositionState[] = [
      'open',
      'settling',
      'resolved-won',
      'resolved-lost',
      'claimed-won',
      'claimed-lost',
      'stranded-refund',
    ]
    expect(new Set(states).size).toBe(7)
  })
})

describe('deriveState (DB row → state) — function not exported from route.ts', () => {
  // The tests below describe the spec implemented by `deriveState` in
  // `app/api/positions/[wallet]/route.ts`. They are todos because the
  // function is private to the route module; CLAUDE.md's "do not modify
  // source files" constraint forbids exporting it just for tests.

  // No close_sig, close_time in the future → 'open'.
  test.todo('no close_sig and close_time in the future → open')

  // close_sig present, no resolve_sig → 'settling'.
  test.todo('close_sig present, no resolve_sig → settling')

  // No close_sig but close_time has passed → 'settling' (oracle behind).
  test.todo('no close_sig but close_time elapsed → settling')

  // resolve_sig + outcome_yes matches user's side → 'resolved-won'.
  test.todo('resolve_sig present, outcome matches user side → resolved-won')

  // resolve_sig + outcome_yes opposite to user's side → 'resolved-lost'.
  test.todo('resolve_sig present, outcome opposite to user side → resolved-lost')

  // claim_sig + claim_stranded=true → 'stranded-refund'.
  test.todo('claim_sig present, stranded=true → stranded-refund')

  // claim_sig + claim_net=0 → 'claimed-lost'.
  test.todo('claim_sig present, net=0 → claimed-lost')

  // claim_sig + claim_net>0 → 'claimed-won'.
  test.todo('claim_sig present, net>0 → claimed-won')

  // claim_sig short-circuits resolve_sig — claim wins precedence.
  test.todo('claim_sig takes precedence over resolve_sig')
})

describe('positions.ts internal helpers — not exported', () => {
  // `isWon`, `isResolved`, `settleOutcome`, `safeBig`, `formatStake` all
  // live in `lib/markets/positions.ts` as module-private functions. They
  // could be unit-tested with one extra `export` keyword, but the
  // constraint forbids it.
  test.todo('isWon: resolved-won → true, claimed-won → true, others → false')
  test.todo('isResolved: any resolved/claimed/stranded → true, open/settling → false')
  test.todo('settleOutcome: resolved-won → "won", stranded-refund → "refund", open → null')
  test.todo('safeBig: parses numeric strings, returns null for null/garbage')
})
