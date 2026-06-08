# AIRPLANE — work program

This file was a flat dump. It is now ordered MECE by **surface and repo**, so work can be
dispatched without two agents touching the same files. Every item keeps its original number as
`(#N)` for traceability. Empty/idea-only items are parked at the bottom.

## Orchestration rules (read before dispatching anything)

- **Every docs subagent follows the `/max-doc` skill.** No exceptions in Groups B and C.
- **One subagent per task.** More tasks than slots → queue them; do not widen a task across agents.
- **No agent pushes.** Each agent works, runs its own verify, and **commits but does NOT `git push`**.
  The orchestrator pushes **once per repo** after every agent in that repo has finished and verification passes.
- **crx-mono is push-collision-prone and worktrees are forbidden there.** Group B/C/A/E agents that
  touch `crx-mono` run **serially** (one at a time), each committing with `git commit --only -- <paths>`.
  Group D/F (index repo) and Group G (separate projects) may run in parallel with crx-mono and each other.
- **Progress lives in [`AIRPLANE-tracker.md`](AIRPLANE-tracker.md).** Each agent flips its own row to
  `doing` on start and `done` on finish, with a one-line note. If anything stops, the tracker is the source of truth.
- **Verification is its own pass.** After build agents finish, verification agents (combined, several
  tasks each) confirm the work, then the orchestrator does the coordinated pushes.

## Blockers to resolve before dispatch

- **Missing screenshots.** `image*.png` referenced below do not exist on disk. Tasks that point only at
  an image are marked **[IMG]** — they need the image, or a decision to act from text + live source.
  To supply one: take the screenshot (Cmd-Ctrl-Shift-4 copies the region to the clipboard), then run
  `./shot 7` from the repo root to write `image-7.png` next to this file. Bare `./shot` writes `image.png`.
  A plain `.md` file silently drops a pasted image — never paste into the doc; paste into `./shot`.
- **Idea-only items** (#2, #12, #16) need a spec before they are dispatchable.
- **Spend / irreversible**: #13 (Twitter API budget), #11 (contracts/oracle), #12 (new SaaS), #1/#3
  (live marketing site). Confirm scope before these run.

---

## Group A — Live web surfaces · `crx-mono/frontend` (serial within crx-mono)

### A1 (#1) Replace CTAs with a cal.com form + delayed call popup  **[IMG: image.png, image-1.png]**
On `crxfx.com` and `docs.crxfx.com`, replace all CTAs with a form like the mockup that leads to cal.com.
After 5 seconds, show a popup with a CTA to book a call.

### A2 (#3) Replicate openfx.com/product blocks onto `/landing-dev-2`  **[IMG: image-2.png]**
Replicate the things shown from <https://www.openfx.com/product> and put them on `https://crxfx.com/landing-dev-2`.

---

## Group B — Docs: structure & global passes · `crx-mono/frontend/content` · `/max-doc` (serial)

These run **first** and **in order** — they set the rules the per-page edits (Group C) follow.

### B1 (#4) MECE refactor plan for all docs
Using `/max-doc`, make a plan to refactor all docs much shorter under the MECE principle. **[IMG: image-4.png]**
This is the umbrella plan; Group C executes against it.

### B2 (#31) Lower the "CRX is a counterparty" volume
Scan the whole docs. We lean too hard on "CRX is a counterparty" — we get it. Treat with MECE; say it once, well.

### B3 (#7) No raw Solidity jargon outside the contracts section
Global check: do not use pure Solidity jargon (e.g. "beacon proxy") anywhere except the smart-contract
details section. Fix the offending page **[IMG: image-8.png]** and sweep the rest.

### B4 (#9) Never say "3–5 keys" — say "multisig"
On `learn/governance/operator`, drop the "3–5 keys" wording; keep it at "we run a multisig". Global check
across all docs that we never say the key count.

### B5 (#35) Replace repeated deep technical blocks with link-backs
Scan all docs. Where a page repeats deep technical detail not vital to that page's flow, cut it and link
back to the in-depth section with a full-row blue link + right arrow (style ref: "Data Migration guide →"
from <https://docs.twenty.com/getting-started/quickstart>). Example target to link to:
`learn/governance/operator`.

### B6 (#36) Add retention scaffolding (numbers, summaries, callouts)
Add numbered steps in tutorials, a short summary of each part at the top of the page, and inline callout
components so docs aren't plain `.md`. Style refs **[IMG: image-20.png, image-21.png]** from
<https://docs.twenty.com/getting-started/quickstart>. Scan the whole repo for where these fit.

---

## Group C — Docs: per-page edits · `crx-mono/frontend/content` · `/max-doc` (serial)

Each maps to a source file under `crx-mono/frontend/content/`. The `file://crxfx-docs-offline/...`
path in each item is the rendered preview of that source.

### C1 (#6) Roles page — the five account states
`maker/desk/concepts/roles`. Explain that there are five states:
- **In review** — someone submitted an ISDA (can be upgraded to Taker or Maker)
- **Taker** — ECP who performed an ISDA
- **Maker** — different credit-risk rules than Taker
- **SD** — counterparty of all counterparties
- **Default** — account defaulted; cannot open new positions (close-only)

Extend `roles.html` with all five, then have other pages link back here for roles. **[IMG: image-7.png]**

### C2 (#19) Rewrite the maker introduction  **[IMG: image-9.png]**
The current intro to maker is unusable — you can't even understand it. Write a much better one.

### C3 (#24) Reframe a maker value section  **[IMG: image-13.png]**
This should read more like "what value does CRX give the desk?".

### C4 (#21) Clarify a confusing section  **[IMG: image-11.png]**
Too confusing — make it much cleaner.

### C5 (#23) Collateral-isolation algorithm, not "second / third / 4th"  **[IMG: image-12.png]**
The "second / third / fourth" framing reads weird. Instead show the algorithm with CRX's current contract
setup: if sUSDS fails as collateral but you (as a maker) never engaged sUSDS, you are untouched and every
one of your trades stays cleanly collateralized.

### C6 (#10) `learn/resources/risks` — reframe and shrink
Keep talking about our best practices. Make the text smaller overall. Do **not** frame it as "we are the
risk" — frame it as everything we do to secure the use case. Example: talk about Pyth risk and how we
reduce it; show how Pyth secures its price feed and who uses it (institutionals → more trustable). In the
**Liquidation Risk** section, talk about the cascade (note: we already covered this elsewhere — link instead of repeat).

### C7 (#25) `taker/tutorials/choose-counterparty` — fix the weird page
This page is just weird. Rework it.

### C8 (#26) `taker/concepts/rfq-flow` — remove two elements  **[IMG: image-14.png]**
Remove the two things shown.

### C9 (#27) `taker/concepts/settlement` — add an EMA re-explainer
Add a re-explainer about the EMA here; it's interesting.

### C10 (#28) `taker/tutorials/swap-collateral` — forward cost + underlying note  **[IMG: image-15.png]**
Add a small computation of the % cost for a 1-month forward. Add a comment on the underlying — e.g. sUSDS:
what makes it safe — note we can also add USDY (backed by bonds), compare both models, and link back to the
section saying collateral risks are isolated in the CRX model.

### C11 (#29) `taker/deliverable-forwards/get-started` — why NDF is the missing product  **[IMG: image-16.png]**
Replace the current content. Explain why NDF is the product your customer is missing — hedging volatility
(and other hedging types) makes it an expensive premium.

### C12 (#30) `get-started/resources/app-ecosystem` — remove the page + cleanups  **[IMG: image-17.png, image-18.png]**
Remove `app-ecosystem`. Also remove where we talk too much about `/explorer`, and don't include `/onboarding`.

### C13 (#32) `get-started/resources/audits` — remove one sentence
Remove: "In-house practice carries the weight in the meantime: invariant testing, fuzzing, unit tests, and
multi-round adversarial review against the canonical model in contracts/src/."

### C14 (#34) `maker/desk/concepts/inbox` — add an in-app screenshot  **[IMG: image-19.png]**
Add an in-app screen showing what the inbox text is describing.

### C15 (#5) Find and reconsider a duplicated flow section  **[IMG: image-6.png]**
Reformulate this part — we probably already made a flow for this section. Verify where it is; we might remove it.

### C16 (#2) ISDA-once concept page  *(idea — needs spec)*
Document the idea: do one ISDA with CRX, and CRX makes ISDA agreements with new counterparties for you.

### C17 (#22) ELI5 shrink pass over every paragraph  *(depends on H1/#20)*
Once the ELI5 skill exists, go paragraph by paragraph: "how do I say this shorter and simpler?"

---

## Group D — Video engine · `index/video` (parallel-safe with crx-mono)

### D1 (#8) Fix `WalkthroughTaker.mp4` engine behaviours
Source: `/Users/maxguillabert/Downloads/WalkthroughTaker.mp4`. Fix in the engine, not just this render:
- **0:07** — click happens, nothing visibly happens, explanation comes after. Engine should show the
  affordance/explanation **before** the interaction, not after the click.
- **0:09 / 0:14 / all tab switches** — it clicks itself open onto the same page. The CRX↔Fireblocks tab
  switch is wrong: the previous page should be the CRX app and the click lands on the Fireblocks page (and
  vice-versa). Engine must **load the next page before clicking** so this can't go wrong.
- **0:17** — the price field shows a leading `0`. Engine must always use the **real props**, never a placeholder above the real value.
- **0:24** — clicking the calendar reloads the page; it's an in-page action and should not. Engine must
  distinguish **in-page action** vs **navigation that reloads**. Same defect at 0:17 on amount-validate.

---

## Group E — Contracts & oracles · `crx-mono/contracts` (serial within crx-mono)

### E1 (#11) Move sUSDS and USDC onto Pyth feeds (or find the right oracle)
Update sUSDS and USDC to also price off Pyth if possible. If no Pyth feed exists, find the right oracle
(Uniswap TWAP, Sky, etc.). Target the same rule already stated for EURC/USDT: "price off live Pyth USD
feeds, around the clock, no closed-session gate; a price older than ten minutes is valued at zero, not
trusted stale."

---

## Group F — Marketing / Twitter research · `index/marketing` (parallel among themselves)

Reference shape for outputs: `marketing/niche-research/outlier-pass-2.md`. **#13 spends Twitter API budget — confirm first.**

### F1 (#17) Strategy catalogue from `outlier-pass-2.md`
Analyze `marketing/niche-research/outlier-pass-2.md`. List every strategy for finding the kind of
strategies/accounts it surfaces that we have **not** yet run on twitterapi.io and could.

### F2 (#13) Copy-trading niche research, $1 budget, multi-language
Spend ~$1 via twitterapi.io to understand the copy-trading game across all asset classes, in EN/CH/KR/JP.
Find repeatable post patterns. Produce an `outlier-pass-2`-style doc per copy-trading sub-niche, focused on
ones applicable to Vibe as simple software — "you can copy this guy who made x/y/z, here's the framework".

### F3 (#14) Map of `zsc_dao`-associated accounts
With twitterapi.io, build a full map of all `zsc_dao`-associated accounts — Polymarket shilling, side apps
built on Polymarket, and related clusters.

### F4 (#15) Inverse-Cramer account discovery for Vibe shorting
Find accounts whose calls reliably go south, so "you can short their call — and look, it works." Verify the
account-discovery method is feasible on twitterapi.io.

### F5 (#18) Trending pump.fun pair → X fear/greed index
Prototype: take the latest trending pair on pump.fun and build a fear/greed gauge from all `$`-cashtag
mentions on X.

---

## Group G — New builds (separate projects)

### G1 (#12) Copy-trader micro-SaaS on top of Vibe  *(idea — needs spec)*
Build a copy-trader micro-SaaS on top of Vibe. Goal: use it as marketing.

---

## Group H — New skills · `max-skills` repo

### H1 (#20) ELI5 skill (like `/max-marketing`, `/max-doc`)
Build an ELI5 skill. Use codex to pull best-performing Reddit ELI5 posts and understand how they work; pull
some frameworks from the internet. **Blocks C17 (#22).**

---

## Group I — Housekeeping & open questions

### I1 (#40) Resolve the `max-skills` duplication
`max-skills` exists in `~/Downloads/max-skills`; the index has none under `agents/skills/`. Confirm which is
the live source, delete the stale copy. (Recon suggests `~/Downloads/max-skills` is live and loaded as plugins.)

### I2 (#41) Phone-farm question for Twitter  *(research question)*
A phone farm posting clips to multi-account YouTube/TikTok/Instagram is recommended. Is Twitter the same, or
is it a lot more permissive if you buy premium (each account posting different clips)? Answer, don't build.

---

## Parked — idea-only, not dispatchable yet

- **(#16) Idea** — empty.
- **(#33)** — number skipped, no content.

---

## Blocked on missing images

None of the `image*.png` files exist on disk. Below, every image-referencing task split by whether work
can start anyway.

### Hard-blocked — the image is the *only* thing that identifies the target. Do not dispatch until provided.

| ID | Task | Why it needs the image |
|----|------|------------------------|
| C4 (#21) | "Clarify confusing section" | No page, no path — only `image-11.png` says which section. |
| C8 (#26) | rfq-flow "remove two elements" | Page is known, but only `image-14.png` shows *which two*. |
| C15 (#5) | "reformulate this part / we already made a flow" | Only `image-6.png` shows which part; hint is weak. |
| C3 (#24) | "what value CRX gives the desk?" | Page/section unknown without `image-13.png`. |
| A1 (#1) | cal.com form design | Function is clear from text; the *form layout* needs `image.png` / `image-1.png`. |

### Soft-blocked — image only refines; a subagent can start from text + live source / the web.

| ID | Task | Fallback without the image |
|----|------|----------------------------|
| A2 (#3) | Replicate openfx blocks | Read <https://www.openfx.com/product> directly. |
| B1 (#4) | MECE refactor plan | Plan is text-driven; `image-4.png` is an example only. |
| B3 (#7) | No Solidity jargon | Grep for "beacon proxy" and jargon across `content/`. |
| B6 (#36) | Retention scaffolding | Style refs are the public Twenty docs. |
| C1 (#6) | Roles five-state page | Full five-state text is given here. |
| C2 (#19) | Rewrite maker intro | Target = maker intro page; read the source. |
| C5 (#23) | Collateral-isolation algorithm | Full algorithm text is given; grep "second"/"third". |
| C10 (#28) | swap-collateral forward cost | Full instruction text is given. |
| C11 (#29) | Why-NDF rewrite | Full instruction text is given. |
| C12 (#30) | Remove app-ecosystem + cleanups | Pages and removals named in text. |
| C14 (#34) | Inbox in-app screenshot | Generate the screenshot from the live app; image only shows intent. |
