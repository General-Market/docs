# X manager brief — set up 16 accounts + posting keys

**What I need from you, in one line:** create the 16 accounts below, brand each one exactly as specified, then send me back a **posting Access Token + Secret** (Read **and** Write) for each. Time: ~10–15 min per account.

This brief has three parts: (1) what to hand back, (2) the per-account checklist, (3) the keys setup. The full technical reference is in [`posting-tutorial.md`](../posting-tutorial.md) — you only need Path A.

---

## 0. The deliverable — fill this and send it back

For each account, I need the four values that let a script post as it. Return this table (or the filled `keys.csv`):

| id | handle | Access Token | Access Token Secret |
|---|---|---|---|
| en-liqmaps | @liqhunter | … | … |
| … | … | … | … |

The **Consumer Key / Secret** are shared (one app, mine — see §3), so you don't send those per account. You only send the **per-account Access Token + Secret**.

**Never put these in a screenshot, chat image, or shared doc.** Paste them as text into the encrypted channel I gave you. Anything that touches an image gets regenerated and is wasted work.

---

## 1. The 16 accounts

Brand each one from `accounts-16.json` — display name, @handle, bio, pfp, banner are all specified there. Don't improvise the copy; it's tuned per language.

| id | handle | Display name | Lang | Niche |
|---|---|---|---|---|
| en-liqmaps | @liqhunter | Liquidity Hunter | EN | liquidation maps |
| en-fundingarb | @carry_desk | Carry Desk | EN | funding arb |
| en-gemfinder | @earlyornever | early or never | EN | gem finder |
| en-launches | @mintradar | MINT RADAR | EN | new launches |
| cn-liqmaps | @chazhen_liq | 插针猎人 Liq | CN | liquidation maps |
| cn-fundingarb | @feilv_yuki | 费率搬砖姐 Yuki | CN | funding arb |
| cn-gemfinder | @maifu_alpha | 埋伏哥 · 链上吸筹 | CN | gem finder |
| cn-launches | @daxin_day1 | 打新雷达 Day1 | CN | new launches |
| kr-liqmaps | @liqmap_kim | 청산맵 김씨 | KR | liquidation maps |
| kr-fundingarb | @funding_zupzup | 펀딩비 줍줍 | KR | funding arb |
| kr-gemfinder | @prepump_note | 떡상전 선취매 노트 | KR | gem finder |
| kr-launches | @day1_launch | 신규런칭 데이원 | KR | new launches |
| jp-liqmaps | @liqmap_jp | 清算マップ職人 | JP | liquidation maps |
| jp-fundingarb | @fr_arb_memo | FR裁定メモ | JP | funding arb |
| jp-gemfinder | @gem_neko_x | 草コイン発掘ねこ | JP | gem finder |
| jp-launches | @day1_mint_jp | 新規ミントDay1勢 | JP | new launches |

Handles are first-choice. If one is taken, append a number or underscore and **tell me the final handle** — the table you return is the source of truth.

---

## 2. Per-account checklist (repeat ×16)

1. **Sign up** a new X account — separate email per account. (X has no API for account creation; this step is manual, by hand.)
2. **Brand it** from `accounts-16.json`: set display name, @handle, bio, upload pfp, upload banner.
3. **Verify** email + add a phone if X prompts (needed before developer/API access on many accounts).
4. **Authorize posting** — one of two routes, see §3. End state: a Read+Write Access Token + Secret for this account.
5. **Record** the token pair in the deliverable table against the right `id`.

### Fleet hygiene — state this plainly

Sixteen new accounts behaving alike is exactly what X's anti-spam watches for. To keep them alive:

- **Separate email per account.** Don't reuse.
- **Don't post identical content across accounts** — the JSON already gives each a distinct voice and format; keep it that way.
- **Warm up** — let each account sit a few days, follow/like normally, before it starts posting on a schedule.
- **Don't create all 16 from the same IP in one hour.** Space them out.
- This is content-operation fleet management, not botting — but X can't tell the difference if they all look identical on day one. The distinctiveness is the protection.

---

## 3. Keys setup — two routes, pick one

The goal each time: a **Read+Write Access Token + Secret** for that account.

### Route A — one shared app, each account authorizes it (recommended)

One developer app (mine, "MAXOTC", already created on console.x.com). Each of the 16 accounts signs into that app once via OAuth and grants it posting rights → you get that account's token pair. One billing, one app, 16 tokens.

- I provide: the app's Consumer Key/Secret + a sign-in link.
- You do, per account: open the link **while logged into that account**, click **Authorize app**, copy the returned token + secret.
- This is the 3-legged OAuth flow; I'll give you a one-click page that spits out the two values. You just paste them back.

### Route B — each account is its own developer account

Each account enrolls in the developer portal itself and generates its own keys.

- Per account: sign up at **console.x.com** with that account → create Project + App → **User authentication settings** → set **Read and Write** → **Keys and tokens** → Generate **Access Token + Secret**.
- More billing surface (each account is its own pay-per-use line) and more setup, but fully isolated.

**Default to Route A** unless I tell you otherwise — one bill, far less setup. I'll send the authorize link.

### The one trap that wastes an hour

Whichever route: the app's permission must be **Read and Write** *before* the token is generated. If it's Read-only, the token silently can't post (every attempt returns HTTP 403). If that happens: flip to Read+Write, then **regenerate** the token — the old one keeps the old permission.

---

## 4. What happens after you send the tokens back

I load the 16 token pairs into the posting scripts (`posting-tutorial.md`, Path A). From there everything — display name, bio, and pfp changes, plus the scheduled posts — runs by API. Your job ends at handing over a working Read+Write token per account.

**One-line recap:** make the 16 accounts, brand them from the JSON, get me a Read+Write Access Token + Secret each (Route A), send them as text not images.
