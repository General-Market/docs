# AIRPLANE — dispatch tracker

Wave 1 complete (workflow `w08i7c86b`, 29 agents, ~91 min). All three repos pushed.

**Push reality:** crx-mono has a `.git/hooks/post-commit` that **auto-pushes to origin/main on every commit** — so every docs task deployed to docs.crxfx.com **as it landed**, not at a held gate. Build verified green (`npm run build` passed). index → pushed to `mono/main`. max-skills → pushed to `origin/main`.

**Status:** `done-live` (committed + auto-deployed) · `done-pushed` · `blocked` (needs image) · `parked` (needs spec)

| ID | Group | Repo | Task | Status | Commit |
|----|-------|------|------|--------|--------|
| B1 | B | crx-mono | MECE docs refactor plan | done-live | c2d5ca2 |
| B2 | B | crx-mono | lower "CRX is counterparty" volume | done-live | 7800d85 |
| B3 | B | crx-mono | no Solidity jargon outside contracts | done-live | 83aa350 |
| B4 | B | crx-mono | "multisig" not "3-of-5 keys" | done-live | 2008fc5 |
| B5 | B | crx-mono | SeeAlso link-back component + 3 pages | done-live | 54010da |
| B6 | B | crx-mono | callouts + on-this-page scaffolding | done-live | 2fbc08c |
| C1 | C | crx-mono | roles: five states | done-live | 46da1ec |
| C2 | C | crx-mono | rewrite maker intro | done-live | 9fc71a3 |
| C5 | C | crx-mono | collateral-isolation algorithm | done-live | b455da3 |
| C6 | C | crx-mono | risks page: reframe + shrink | done-live | a1f1dc2 |
| C7 | C | crx-mono | choose-counterparty rework | done-live | 7e67d92 |
| C9 | C | crx-mono | settlement EMA re-explainer | done-live | a8000b5 |
| C10 | C | crx-mono | swap-collateral forward cost | done-live | 2d461b6 |
| C11 | C | crx-mono | why-NDF rewrite | done-live | 6e252b7 |
| C12 | C | crx-mono | remove app-ecosystem + cleanups | done-live | 861fdf4 |
| C13 | C | crx-mono | audits: remove one sentence | done-live | b5bf1ed |
| C14 | C | crx-mono | inbox screenshot | done-live | (already present, no new work) |
| C17 | C | crx-mono | ELI5 shrink pass (5 heaviest pages) | done-live | dcf6973 |
| E1 | E | crx-mono | sUSDS/USDC → Pyth (RESEARCH ONLY) | done-live | 3230feb |
| D1 | D | index | video engine fixes | done-pushed | 11a6903 |
| F1 | F | index | strategy catalogue | done-pushed | d594f82 |
| F2 | F | index | copy-trading niche research ($0.11) | done-pushed | 65d8544 |
| F3 | F | index | zscdao account map (6 clusters) | done-pushed | b492f75 |
| F4 | F | index | inverse-Cramer (feasibility: PARTIAL) | done-pushed | 351ff6c |
| F5 | F | index | pump.fun → X fear/greed prototype | done-pushed | a29855d |
| H1 | H | max-skills | max-eli5 skill | done-pushed | 7452a48 |
| C3 | C | crx-mono | "what value CRX gives desk" | blocked | needs image-13 |
| C4 | C | crx-mono | clarify confusing section | blocked | needs image-11 |
| C8 | C | crx-mono | rfq-flow remove two elements | blocked | needs image-14 |
| C15 | C | crx-mono | dedup flow section | blocked | needs image-6 |
| A1 | A | crx-mono | cal.com form + popup | blocked | needs image / image-1 |
| A2 | A | crx-mono | replicate openfx → /landing-dev-2 | not-run | out of wave-1 scope |
| C16 | C | crx-mono | ISDA-once concept page | parked | needs spec |
| G1 | G | (new) | Vibe copy-trader micro-SaaS | parked | needs spec |
| I1 | I | — | resolve max-skills duplication | open | dual copy is by-design, not stale |
| I2 | I | — | phone-farm Twitter question | open | not run |

## Flags to act on

- **C1 — Default state**: rewritten as **close-only** (old page said "gates nothing"). Verify against on-chain behavior before treating as canonical.
- **F2 — budget**: the shared `niches/budget.json` is **$98 over its $15 cap** (pre-existing); this run spent only $0.11.
- **F3 — handle**: the real account is **`zscdao`** ("zerosupercycle"), not `zsc_dao`.
- **F4 — inverse-Cramer**: PARTIAL — twitterapi.io retrieves an account's calls but **not outcomes**; a two-stage pipeline is documented, not built.
- **index tsc**: 52 pre-existing errors (2 real, in `replicates/original/Scene02.tsx` and `tutorial/diagrams/PrivacyDiagrams.tsx`), all unrelated to D1.
- **B3 minor**: `developers/onchain/explorer.md` still says "UUPS proxy" — acceptable (contract-reference page).
