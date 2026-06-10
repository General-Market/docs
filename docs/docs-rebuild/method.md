# Writing method — every docs writer obeys this file

You are writing one cluster of pages from `spec.md`. The facts come from `facts-vision.md` / `facts-index.md` / `facts-gaps.md` and from the code itself — never from the old docs, never from memory.

## The register: practical thinking

Two methods combined. **max-doc** gives the structure. **eli5** gives the clarity. The technical level stays — you are not dumbing down, you are removing the fog between the reader and the real mechanism.

What that means in practice:

- **Answer first.** Every `##` heading is the reader's real question, in their words. The first sentence under it answers it. Mechanism after.
- **Plain word before the term.** The everyday word comes first; the technical term follows in the same breath and is then used freely: "your picks become a string of bits — a *bitmap*, one bit per market". After first use, use the precise term. Never baby-talk. Never write around the real mechanism.
- **Keep the depth.** Function names, byte layouts, fee math, struct fields, exact constants — all stay. What goes is the fog: scene-setting, throat-clearing, abstraction stacked on abstraction, jargon before it is earned.
- **One picture maximum per page**, only on explanation pages, only if it survives the break-test: it must behave like the real thing at the exact point that matters. If it breaks on the hard part, cut it and explain the hard part directly.
- **Walk cause and effect in short beats.** This happens → so this happens → so this follows. One idea per sentence.

## Structure rules (hard)

1. Every `##` is a question in the reader's words (reference pages may use noun headings).
2. First sentence answers the heading. No "In this section we will…".
3. No TL;DR blocks — the `gmsummary` stepper is the only summary surface.
4. Bullets for lists of 3+. Tables for comparisons of 3+ rows.
5. Time estimate on every internal link: `[Payouts](/docs/vision/payouts) (~4 min)`.
6. One Diátaxis mode per page, declared in frontmatter, contract obeyed:
   tutorial = a guided run that always works; how-to = numbered steps + outcome + its branch; reference = dry, complete, scannable; explanation = the why, no steps.
7. How-tos: context → numbered click-path → what happens, including the failure branch.
8. Every limitation on its own bolded line: **Testnet only.** **L3 USDC has 18 decimals.** Never buried.
9. Short sentences. No closing aphorisms. No "explaining life". Cut every sentence that does not teach.
10. End each page with a `Next:` line linking onward with a time estimate.

## Page skeleton

```markdown
---
title: How do I win?
description: Parimutuel scoring, the zero-sum pool, and the fee on profit.
order: 6
group: Money
mode: explanation
---

​```gmplain
One plain-words paragraph a newcomer reads first. One paragraph. No jargon.
​```

​```gmsummary
How is the pool split? :: Losers' stakes pay winners, market by market
What does it cost? :: 0.05% of profit, nothing on losses
​```

## How is the pool split?

First sentence answers it. Then the mechanism, with the real constants and code-level names.

...

​```gmseealso
[{"title": "Fees and minimums", "href": "/docs/vision/fees"}]
​```

Next: [Fees and minimums](/docs/vision/fees) (~2 min)
```

Use `gmplain` on every page (one paragraph, genuinely plain). Use `gmsummary` on every page with 3+ `##` sections — one line per section, `Heading :: ≤12-word sumup`, heading text EXACTLY matching the `##`. Use `gmnote`/`gmtip`/`gmwarning` sparingly — one or two per page. Use `gmflow` only with registry ids from spec.md. API pages: `method:` frontmatter + `gm-try` fence + request and response shapes lifted from the actual route code.

## Truth rules (hard)

- **Verify before you write.** Every constant, signature, endpoint shape, and address: grep the code, cite nothing you did not see. The fact sheets give you file:line starting points.
- **The deployed system wins.** Where contract source, bot.py, and frontend disagree, facts-gaps.md arbitrates; frontend hooks/ABIs are ground truth for what is live.
- **If you cannot verify it, you may not claim it.** Write the honest line instead ("not exposed yet", "undocumented — verified absent from the API surface") or drop the topic and note it in your report.
- **No invented numbers, no invented endpoints, no invented errors.**
- Links: only to pages that exist in spec.md's page map, with the exact slugs there. Anchors in `gmsummary` come from your own `##` text.

## Output

Write your pages to `frontend/content/docs/{section}/{slug}.md` exactly as mapped in spec.md. Then return a short report: pages written, facts you verified (with file:line), anything you could NOT verify and how you handled it, and any spec deviation (page split/merge) with the reason.
