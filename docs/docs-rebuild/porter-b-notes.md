# Porter-B handoff — diagrams, API explorer, redirects, link checker

Status: **shipped and verified.** `npx tsc --noEmit` clean, `npm run build` green, checker green (554 links + all gm* fences across 46 pages), both target pages serve 200 from `next start` with real component markup, live Send verified in-browser (200 OK · 32 ms on `/api/vision/batches`).

## What changed

| Piece | Path |
|---|---|
| 7 registry diagrams | `frontend/components/docs/GmFlow.tsx` (stub replaced; ~520 lines, server-rendered static SVG) |
| Live API explorer | `frontend/components/docs/GmTry.tsx` (stub replaced; client component) |
| Explorer + placeholder CSS | `frontend/app/docs/docs.css` (`.gm-api-example`, `.gm-api-litnote`, `pre:has(> .gm-api)` strip; dead `.gm-try-stub` selectors removed — `.gm-flow-stub` kept as the unknown-id fallback) |
| Redirect map | `frontend/next.config.ts` (`docsRedirects()` — 92 rules) |
| Link + fence checker | `frontend/scripts/check-doc-links.mjs` |
| npm wiring | `frontend/package.json` — `check:links`, gated into `prebuild` (escape hatch `GM_SKIP_LINKS=1`) |

## GmFlow

- One shared kit (Frame/Kicker/Box/Arrow/Wrap/Pill/Note), inline-styled, palette: ink `#1d1d1f`, greys, ONE accent `#0071e3` on the reader's actor, ONE dark terminal box per diagram. ViewBox 760-wide; `.gmd-svg` CSS makes it fluid; readable down to 375 px.
- Facts checked against `facts-gaps.md`: one batch = one round (lifecycle note line), `claimRefund` grace fork, pending-slot overwrite + flip at resolution, parimutuel matched-pool/2× payout/unmatched refund, 0.05 % fee on profit only, PENDING→BATCHED→FILLED + permissionless `claimExpiredOrder`, 18↔6 decimals ×1e12, bot loop joins a NEW block id each pass.
- Unknown fence id → visible dashed placeholder (`.gm-flow-stub`), and the checker fails the build on it.

## GmTry

- Parses the frozen fence schema; renders method pill + path, per-param inputs (`in:"query"` and `in:"path"`), JSON body editor on writes, dark request panel showing the exact `METHOD /api/...` call, Send, prettified live response (status · ms), and the fence `response` as a collapsed `<details>` "Example response" — never auto-fired.
- URL rule: `/api/*` used as-is, everything else prefixed `/api`. Same-origin fetch, no CORS, no keys.
- `{name}` path params substitute into the template; Send is disabled (with a hint) until they're filled. Defensive extra: a path param declared without a `{placeholder}` makes the whole path editable — at ship time all 57 fences were placeholder-templated (a concurrent session normalized the last few), so this branch is a safety net.
- Errors handled: invalid JSON body → blocked before sending; non-JSON response → raw text; network failure → explained message.

## Redirects (92 rules, specific first, catch-alls last)

- `DOCS_PAGE_MOVES` (25 old slugs) emitted under BOTH retired prefixes `/docs/blocks` and pre-blocks `/docs/vision`; `+ /docs/blocks/risks → /docs/vision/risks`.
- Old `/docs/index/*` MDX slugs → new flat Index pages / developers pages (28 rules incl. sub-tree catch-alls).
- Legacy sub-tree catch-alls (`bots/`, `api/`, `architecture/`, `reference/`, `concepts/`, `guides/`) under both retired prefixes; final `/docs/blocks/:path* → /docs/vision`.
- **No `/docs/vision/:path*` or `/docs/index/:path*` blanket catch-all** — Next redirects run before the filesystem and would shadow the live sections. Verified live: 13 old URLs 308 to the right homes, 4 live pages stay 200.

## Checker

- Ported from CRX, adapted to `/docs/{section}/{slug}`, `[locale]`-transparent app-segment collection, `resolveHref` + github-slugger mirrors.
- EXTENDED: validates `gmflow` ids against the 7-id registry, `gm-try` bodies ({method, path}, param shape), `gmseealso` ({title, href}[]), `gmcards` (array or {cards}, title required), unclosed fences.
- First run on the corpus: **clean** (writers obeyed the brief). Teeth proven on a synthetic bad page: 8/8 failure classes caught, exit 1. Zero content edits were needed.

## Gotchas found

- Ports 3457 etc. are squatted by other sessions' servers (one answers with a `docs.crxfx.com` redirect — confusing). Probe with `lsof` before `next start`.
- `EdgeLabel` white backing rects erase the arrow in gaps < ~55 px — `Arrow` has `labelDy` to lift the label off the line (used in index-two-chain, gm-system).
- The docs content tree is being edited concurrently; gm-try fences changed shape (literal → templated paths) mid-port. Re-survey before assuming.
