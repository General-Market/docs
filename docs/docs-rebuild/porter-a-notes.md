# Porter-A handoff — core docs system ported

Status: **shipped and verified.** `npx tsc --noEmit` clean, `npm run build` green, all five sections render at `/docs/{section}` with writer content flowing through the fence pipeline.

## What exists now (in `frontend/`)

| Piece | Path |
|---|---|
| Content loader | `lib/docslib.ts` (reads `content/docs/{section}/*.md`), `lib/docslib-pure.ts` |
| Section registry + pager | `lib/handbook-sections.ts` (`DOCS_BASE = "/docs"`, `sectionPath()`), `lib/handbook.ts` (+ `docsCorpus()` for Ask-AI) |
| Shell + article + fence map | `app/docs/_shared.tsx` |
| Routes | `app/docs/page.tsx` (→ /docs/get-started), `app/docs/[section]/layout.tsx`, `app/docs/[section]/[[...slug]]/page.tsx` |
| Theme | `app/docs/docs.css` (~4,090 lines, light, accent `#0071e3`) |
| Components | `components/docs/`: DocsSidebar, DocsSearch, TocRail, ReadingRail, ArticleSummary, Callout, SeeAlso, cards.tsx (`GmCards`), GmShotPlaceholder, CodeBlock, **GmFlow (STUB)**, **GmTry (STUB)** |
| Tabs/mobile | `components/handbook/`: HandbookTabs, HandbookSectionMenu, HandbookMobileBar |
| Ask AI | `components/docs/DocsAskPanel.tsx` wired into the shell; `app/api/docs/ask/route.ts` retrieval now reads `docsCorpus()` |

## Fence map (implemented in `markdownComponents()` in `app/docs/_shared.tsx`)

`gmplain`→Callout(plain) · `gmsummary`→ArticleSummary · `gmseealso`→SeeAlso · `gmcards`→GmCards · `gmflow`→GmFlow stub · `gmnote`/`gmtip`/`gmwarning`→Callout · `gm-try`→GmTry stub · `gm-shot`→GmShotPlaceholder. CRX-only fences dropped.

`gmcards` accepts BOTH a bare JSON array of cards and the `{ "cols"?, "wide"?, "cards": [...] }` wrapper (writers already author bare arrays). `icon` is optional; unknown icons fall back to BookOpen.

## Porter-B TODO

1. **`GmFlow`** (`components/docs/GmFlow.tsx`) — replace the stub with the 7 registry diagrams. Diagram CSS classes were ported as `.gmd-*` in docs.css (from CRX `.crxd-*`), ready to use.
2. **`GmTry`** (`components/docs/GmTry.tsx`) — live API explorer. `_shared.tsx` `ApiReferenceArticle` already extracts the `gm-try` fence and renders the panel-first layout; API-page CSS is ported (`.gm-api-*`, `.docs-api-*`). CRX source: `components/docs/ApiExplorer.tsx`.
3. **Redirects** in `next.config.ts` — the stale `/docs/vision → /docs/blocks/*` redirects were REMOVED (they shadowed the new section). Full old→new map per spec still to wire.
4. **Link checker.**

## Gotchas found

- **Docs pages render dynamically at runtime, not SSG** — the root `app/layout.tsx` calls next-intl `getLocale()`/`getMessages()` (request headers), which deopts every child route. Same was true of the old docs. `generateStaticParams` is in place; pages go static for free if the root layout ever stops reading headers.
- Middleware already excludes `docs` from locale rewriting — `/docs` needs no locale handling.
- ESLint is not configured in this repo (no eslint.config); `tsc` is the only gate.
- CRX `DocsEditor` was NOT ported (depends on CRX-only `/api/docs/raw|save` routes).
- Old MDX content moved to `docs/docs-rebuild/old-content/{blocks,index,snippets}` — source material, do not git-add.
- New deps: `react-markdown@^10`, `rehype-slug@^6`, `highlightjs-solidity@^2`, `lucide-react`.
- Fonts: docs body/display = Geist Sans (`--font-geist-sans`), code = JetBrains Mono (`--font-jetbrains-mono`) — pinned inside the `.docs-root` token block.
