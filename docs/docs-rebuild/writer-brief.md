# Writer brief — shared instructions for every docs writer agent

You are one writer in a parallel fleet rebuilding the General Market docs. Read, in this order:
1. `docs/docs-rebuild/spec.md` — the page map. Your cluster is named in your prompt.
2. `docs/docs-rebuild/method.md` — how to write. Non-negotiable.
3. The fact sheets: `facts-vision.md`, `facts-index.md`, `facts-gaps.md` — what is true. facts-gaps.md ARBITRATES all conflicts.

## Output

- Write each page to `frontend/content/docs/{section}/{slug}.md` exactly as mapped in spec.md (nested slugs like `vision-api/batches` mean `frontend/content/docs/developers/vision-api/batches.md`).
- ALSO save an identical mirror copy to `docs/docs-rebuild/written/{section}--{slug-with-slashes-as-dashes}.md`. A layout porter is running concurrently and could clobber a same-named file; the mirror is the recovery copy. Do not git-add anything.
- Create directories as needed.

## Fence body schemas (frozen — the components will parse exactly this)

````
```gmplain
One plain-words paragraph. No jargon. No headings.
```

```gmsummary
Exact ## heading text :: ≤12-word summary
Another ## heading text :: ≤12-word summary
```

```gmseealso
[{"title": "Page title", "href": "/docs/section/slug"}]
```

```gmcards
[{"title": "Card title", "desc": "One line.", "href": "/docs/section/slug"}]
```

```gmflow
diagram-id-from-spec-registry
```

```gmnote
One short paragraph. (same for gmtip / gmwarning)
```

```gm-try
{"method": "GET", "path": "/vision/batches", "params": [{"name": "page", "in": "query", "type": "number", "required": false, "desc": "1-based page"}], "body": null, "response": {"batches": []}}
```

```gm-shot
One-line caption of the screenshot to capture later.
```
````

- `gmsummary` heading text must match your `##` headings EXACTLY (the anchor link is derived from it).
- `gmflow` ids: ONLY the 7 in spec.md's registry.
- API reference pages: one `gm-try` per documented endpoint, placed right under that endpoint's `##`. Single-endpoint pages (bitmap, faucet) also set `method:` in frontmatter; multi-endpoint pages omit `method:`.
- Internal links: only to slugs in spec.md's page map, formatted `/docs/{section}/{slug}`, with a time estimate: `[Payouts](/docs/vision/payouts) (~4 min)`.

## Verification duties (before you write a claim)

- Grep/read the cited file yourself. The fact sheets give file:line starting points; re-verify, then cite nothing in the page itself (docs pages carry no file:line — they carry the truth).
- Amounts: always 18-decimal-honest. **L3 USDC has 18 decimals** appears bolded on every page showing an amount.
- **Testnet only.** appears bolded on every page where a reader could mistake funds for real money (tutorials, money pages, faucet, risks).
- Banned: "BLS-signed withdrawal proofs", the address `0x821D7c…` (dead), the 5-param joinBatchDirect, "Blocks" as the product name (the product is **Vision**; a **block** = one prediction batch), "TradFi", TL;DR blocks, closing aphorisms.
- If you cannot verify a claim, write the honest line or drop it — and put it in your report.

## Report (your final message)

1. Pages written (paths).
2. Facts verified (claim → file:line), max 15 lines.
3. Anything you could NOT verify and what you did instead.
4. Spec deviations (page split/merge) and why.
5. Suggestions for the verify round (what a fact-checker should re-check hardest).

## Constraints

- Work directly on main. NO worktrees, NO branches, NO git commands at all.
- Touch ONLY: your pages under `frontend/content/docs/`, your mirrors under `docs/docs-rebuild/written/`, and (Bots-A writer only) `bot.py`.
- Never modify spec.md, method.md, the fact sheets, or another cluster's pages. If you find an error in a fact sheet, report it — do not edit it.
