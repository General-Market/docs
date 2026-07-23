# Posting to X via the API — tutorial

**Goal:** post a tweet from a script. ~15 min for the single-account path.

**Scope note up front:** this covers **posting**. It does **not** cover creating accounts — X has no API for that and automating signups breaks the Developer Agreement (instant app suspension). Every account is made by a human in the app/web signup. Don't build around it.

---

## TL;DR

| You want | Use | What you need |
|---|---|---|
| Post from **one** account (yours) | **OAuth 1.0a** | Consumer Key/Secret + Access Token/Secret |
| Post on behalf of **other users** who log in | **OAuth 2.0 PKCE** | Client ID + callback URL + each user's consent |
| Only **read** (search, lookups) | **Bearer Token** | nothing else — cannot post |

The Bearer Token you already have **cannot post**. Posting always speaks as a *user*, never as the app.

---

## Prerequisites (one-time, in console.x.com)

1. Open your app → **User authentication settings** → **Set up**.
2. **App permissions:** select **Read and write** (or Read + write + DM). *If this says Read-only, every post returns 403 — fix it here first.*
3. **Type of App:** "Web App, Automated App or Bot".
4. **Callback URL:** `http://localhost:3000/callback` (any URL; only used by OAuth 2.0). **Website URL:** your site or any https URL.
5. Save. **Regenerate** your tokens after changing permissions — old tokens keep the old (read-only) scope.

---

## Path A — OAuth 1.0a (single account, fastest)

This is how you post from your own account. No browser dance.

### A1. Get the two missing values

App → **Keys and tokens** → **Access Token and Secret** → **Generate**.
You now have four values:

```
API Key            (= Consumer Key)
API Key Secret     (= Consumer Secret)
Access Token
Access Token Secret
```

Confirm the Access Token shows **Read and Write** under it. If it says Read-only, you forgot step 2 above — fix permissions, regenerate.

### A2. Post — Python (recommended)

```bash
pip install requests requests-oauthlib
```

```python
# post_oauth1.py
import os
from requests_oauthlib import OAuth1Session

oauth = OAuth1Session(
    os.environ["X_CONSUMER_KEY"],
    client_secret=os.environ["X_CONSUMER_SECRET"],
    resource_owner_key=os.environ["X_ACCESS_TOKEN"],
    resource_owner_secret=os.environ["X_ACCESS_SECRET"],
)

resp = oauth.post(
    "https://api.x.com/2/tweets",
    json={"text": "Hello from the API — test post."},
)

print(resp.status_code)        # 201 = posted
print(resp.json())             # {"data":{"id":"...","text":"..."}}
if resp.status_code != 201:
    raise SystemExit(f"Failed: {resp.text}")
```

```bash
set -a; . ./.env.x; set +a   # loads X_CONSUMER_KEY etc.
python post_oauth1.py
```

`201 Created` with a tweet id = it's live. That's the whole single-account path.

### A3. Post — Node (alternative)

```bash
npm i twitter-api-v2
```

```js
// post.mjs
import { TwitterApi } from "twitter-api-v2";
const client = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY,
  appSecret: process.env.X_CONSUMER_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});
const { data } = await client.v2.tweet("Hello from the API — test post.");
console.log(data); // { id, text }
```

---

## Path B — OAuth 2.0 PKCE (post for users who authorize you)

Use this only if other people will log in and you post **as them**. More moving parts: a consent redirect, a code exchange, refresh tokens.

### B1. The flow

```
Your app  ──(1) send user to authorize URL──▶  X consent screen
X         ──(2) redirect back to callback with ?code=…──▶  Your app
Your app  ──(3) POST /2/oauth2/token  (code → access_token + refresh_token)
Your app  ──(4) POST /2/tweets  with the user's access_token
```

### B2. Scopes you must request

`tweet.read tweet.write users.read offline.access`
(`offline.access` is what returns a **refresh token** so you don't re-prompt every 2 hours.)

### B3. Minimal worked example (Python)

```bash
pip install requests-oauthlib
```

```python
# oauth2_post.py — run once, follow the printed URL
import os, base64, hashlib, re
from requests_oauthlib import OAuth2Session

CLIENT_ID    = os.environ["X_CLIENT_ID"]          # from app → OAuth 2.0 Client ID
CLIENT_SECRET= os.environ.get("X_CLIENT_SECRET")  # if app type = Confidential
REDIRECT     = "http://localhost:3000/callback"
SCOPES       = ["tweet.read", "tweet.write", "users.read", "offline.access"]

# PKCE challenge
verifier  = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
challenge = base64.urlsafe_b64encode(
    hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()

x = OAuth2Session(CLIENT_ID, redirect_uri=REDIRECT, scope=SCOPES)
auth_url, _ = x.authorization_url(
    "https://x.com/i/oauth2/authorize",
    code_challenge=challenge, code_challenge_method="S256")
print("1) Open this, approve, then paste the full redirected URL back here:\n", auth_url)
redirected = input("\nPaste the http://localhost:3000/callback?... URL: ").strip()

token = x.fetch_token(
    "https://api.x.com/2/oauth2/token",
    authorization_response=redirected,
    code_verifier=verifier,
    client_secret=CLIENT_SECRET,   # omit if Public client
)
print("access_token:",  token["access_token"][:12], "…")
print("refresh_token:", token.get("refresh_token", "<none — did you request offline.access?>"))

# Post as the user
r = x.post("https://api.x.com/2/tweets", json={"text": "Posted via OAuth 2.0 user context."})
print(r.status_code, r.json())
```

### B4. Refreshing (token lives ~2 hours)

```python
new = x.refresh_token(
    "https://api.x.com/2/oauth2/token",
    refresh_token=token["refresh_token"],
    client_id=CLIENT_ID, client_secret=CLIENT_SECRET)
```

Store the **refresh token** per user. Each refresh returns a *new* refresh token — overwrite the old one.

---

## The post endpoint, in full

`POST https://api.x.com/2/tweets`

```jsonc
{
  "text": "the post body",                    // required (unless media-only)
  "reply": { "in_reply_to_tweet_id": "123" }, // optional: make it a reply
  "media": { "media_ids": ["111","222"] },    // optional: attach uploaded media
  "poll":  { "options": ["A","B"], "duration_minutes": 1440 }
}
```

- **201** = created, returns `{ "data": { "id", "text" } }`.
- Delete: `DELETE /2/tweets/:id`.
- Media must be **uploaded first** (separate `media/upload` endpoint) to get `media_ids`. Text-only needs none.

---

## Limits, cost, gotchas

| Thing | Detail |
|---|---|
| **Auth for posting** | OAuth 1.0a **or** OAuth 2.0 user context only. Bearer = 403. |
| **Permission trap** | Read-only app → every post 403. Set Read+Write, then **regenerate tokens**. |
| **Rate limit** | Posting is capped per app/user and per access tier. 429 = back off, read `x-rate-limit-reset`. |
| **Duplicate content** | Posting the exact same text twice is rejected as duplicate. Vary it. |
| **Cost** | console.x.com is pay-per-use — each call draws from your spend cap. Set a cap + alert. |
| **Account creation** | No endpoint. Automating it = Developer Agreement violation = app suspended. |
| **Secrets** | Keep all four/five values in a gitignored `.env`. Regenerate anything that touched a screenshot or a repo. |

---

## Decision, in one line

Posting from your own account: **Path A, four keys, the Python snippet, done.** Other users posting through you: **Path B.** Creating accounts: **not a thing — don't build it.**
