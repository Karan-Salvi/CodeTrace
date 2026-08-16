# Credentials setup — what's needed and how to get it

Everything in the codebase is built and tested against these placeholder
values in `backend/.env`. Nothing that talks to a real third party (GitHub,
Gemini, Jina) will actually work until they're replaced with real
credentials. This doc lists exactly what's needed, why, and the concrete
steps to get each one — grounded in the actual code, not generic advice.

## Quick reference — what's currently a placeholder

| Variable | File | Status | Real value needed from |
|---|---|---|---|
| `GITHUB_CLIENT_ID` | `backend/.env` | ✅ done | GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | `backend/.env` | ✅ done | GitHub OAuth App |
| `GITHUB_APP_ID` | `backend/.env` | ⬜ still `12345` | GitHub App |
| `GITHUB_APP_SLUG` | `backend/.env` | ⬜ still `dummy-codetrace-app` | GitHub App |
| `GITHUB_APP_PRIVATE_KEY` | `backend/.env` | ⬜ still `dummy_key` | GitHub App |
| `GITHUB_WEBHOOK_SECRET` | `backend/.env` | ✅ done (self-generated) | self-generated |
| `GEMINI_API_KEY` | `backend/.env` + `worker/.env` | ⬜ still `dummy_gemini_key` | Google AI Studio |
| `JINA_API_KEY` | `backend/.env` | ⬜ still `"dummy"` | Jina AI |

Everything else in `backend/.env` (`JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `INTERNAL_API_SECRET`) is
**self-generated, not from a third party** — see the bottom section for
how to generate real values for those before any real deployment (the
current dev placeholders are fine for local-only use).

**None of this is end-user-facing.** All of it is operator config — set
once in `.env`, never seen or entered by an end user. A user only ever
sees "Log in with GitHub" and "Connect GitHub" as plain buttons; both are
just redirects to GitHub's own pages. No credential, key, or secret is
ever shown to or collected from them.

**Local dev and prod need their own separate GitHub OAuth App + GitHub
App.** The OAuth callback URL, the GitHub App's Setup URL, and its
Webhook URL are all tied to a specific origin (`localhost:3000` for dev
vs. your real prod domain) and are baked into each app's settings page on
GitHub. So this isn't "fill `.env` once" — register a second OAuth App
and a second GitHub App pointed at the prod domain when you deploy, and
put those (different) credentials in prod's `.env`. `GEMINI_API_KEY` and
`JINA_API_KEY` aren't URL-bound, so the same keys can be reused in both
environments if you want. **Section 5 below walks through the prod
version of every step.**

---

## 1. GitHub OAuth App — user login

**What it's for**: lets a user click "Log in with GitHub" and prove who
they are. This is deliberately separate from the GitHub App below —
`docs/auth.md`'s design splits "who is this person" (OAuth App) from
"which repos can we act on" (GitHub App). Confirmed in code:
`backend/src/modules/auth/services/github-oauth.service.ts` uses only
`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`, requests scope
`read:user user:email` — read-only identity, no repo access at all.

**Steps**:
1. Go to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. Copy-paste these exact values into the form:

   | Field | Value |
   |---|---|
   | Application name | `CodeTrace (dev)` |
   | Homepage URL | `http://localhost:5173` |
   | Authorization callback URL | `http://localhost:3000/auth/github/callback` |

   (Homepage URL matches `CORS_ORIGIN`'s default in
   `backend/src/config/env.ts`. Authorization callback URL must match
   exactly — it's the real route in
   `backend/src/modules/auth/routes/auth.routes.ts`.)
3. Click **Register application**.
4. Copy the **Client ID** shown on the app's page → paste into
   `backend/.env` as `GITHUB_CLIENT_ID=<paste here>`.
5. Click **Generate a new client secret** → copy it immediately (shown
   once) → paste into `backend/.env` as
   `GITHUB_CLIENT_SECRET=<paste here>`.

---

## 2. GitHub App — repository access, webhooks, PR reviews

**What it's for**: everything that touches actual repository content —
cloning for indexing, receiving push/PR webhooks, minting short-lived
installation tokens the worker uses to `git clone`. This is the bigger,
more involved setup. Confirmed in code:
`backend/src/modules/repositories/services/github-app.service.ts` signs
a JWT with `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY` to mint installation
tokens; `backend/src/modules/repositories/services/installation.service.ts`'s
`getInstallUrl()` (added this session) builds the install URL from
`GITHUB_APP_SLUG`; `backend/src/core/middlewares/webhook-signature.middleware.ts`
verifies incoming webhooks against `GITHUB_WEBHOOK_SECRET`.

A GitHub App name must be globally unique across all of GitHub, so pick
your own — the value below is a suggestion, not something you can
copy-paste verbatim if it's taken. Whatever you pick becomes the slug at
`github.com/apps/<slug>` → that exact slug is `GITHUB_APP_SLUG`.

**Webhook secret — generated for you, copy this exact value:**

```
GITHUB_WEBHOOK_SECRET=fae870a4b8057e5c9b1721ebe0e0b84cb3706df9f226f52be10e32d0d0e6654a
```

GitHub doesn't generate this one for you — you choose it and paste the
same value into both GitHub's form and `.env`. The value above is
already randomly generated; paste it into GitHub's **Webhook secret**
field, then paste the same line into `backend/.env`.

**Steps**:
1. Go to https://github.com/settings/apps/new (or **Settings → Developer
   settings → GitHub Apps → New GitHub App** if navigating manually).
2. Copy-paste these exact values into the form. Note the "Create GitHub
   App" form has **two different, easy-to-confuse fields** — a
   **"Redirect URI"** under "Identifying and authorizing users" (leave
   blank, unused by this codebase) and a separate **"Setup URL"** further
   down under "Post installation" (the one that matters, filled in
   below):

   | Field | Value |
   |---|---|
   | GitHub App name | `codetrace-<yourname>-dev` (must be unique — adjust if taken) |
   | Homepage URL | `http://localhost:5173` |
   | Redirect URI (under "Identifying and authorizing users") | leave blank |
   | Request user authorization (OAuth) during installation | leave **unchecked** |
   | Setup URL (under "Post installation") | `http://localhost:3000/repositories/installation-callback` |
   | Redirect on update | ✅ checked |
   | Webhook → Active | ✅ checked |
   | Webhook URL | `http://localhost:3000/webhooks/github` (see tunnel note below) |
   | Webhook secret | `fae870a4b8057e5c9b1721ebe0e0b84cb3706df9f226f52be10e32d0d0e6654a` |

   The Setup URL is the real route built this session
   (`backend/src/modules/repositories/routes/repositories.routes.ts`) —
   get this wrong (or fill in "Redirect URI" instead by mistake) and
   "connect a repository" breaks at the final step, since GitHub
   redirects the user's browser to the Setup URL specifically after they
   approve the install — the codebase's install flow
   (`backend/src/modules/repositories/services/installation.service.ts`'s
   `getInstallUrl()`) doesn't use OAuth-during-install at all, so
   "Redirect URI" and that checkbox are both genuinely unused here.
   **GitHub cannot reach `localhost` directly** for the Webhook URL — see
   the tunnel callout below, or you'll only get login/connect working,
   not live push/PR webhooks.
3. **Permissions** (under "Repository permissions") — set exactly what
   the app actually uses, nothing broader:

   | Permission | Access |
   |---|---|
   | Contents | Read-only |
   | Metadata | Read-only (mandatory on every App) |
   | Pull requests | Read-only |

   (Confirmed against `backend/src/modules/webhooks/services/webhook-dispatcher.service.ts`'s
   `handlePullRequestEvent` — no write permission is used anywhere.)
4. **Subscribe to events** (only shows once Webhook is Active): check
   **Push**, **Pull request**, and **Installation** — these three are the
   only event types the backend actually handles
   (`handlePushEvent`, `handlePullRequestEvent`, `handleInstallationEvent`
   in the same file).
5. **Where can this GitHub App be installed?**: "Only on this account"
   is fine for dev/personal use.
6. Click **Create GitHub App**.
7. On the resulting app page, copy the **App ID** (a number, top of the
   page) → paste into `backend/.env` as `GITHUB_APP_ID=<paste here>`.
8. Copy the slug you actually ended up with (check the URL bar,
   `github.com/apps/<slug>`) → `backend/.env` as
   `GITHUB_APP_SLUG=<paste here>`.
9. Scroll to **Private keys** → **Generate a private key** → downloads a
   `.pem` file. Open it in a text editor, copy the **entire contents
   including the `-----BEGIN`/`-----END` lines**, replace real newlines
   with `\n`, and paste as one line:
   ```
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
   ```
   Verify it worked by starting the backend and triggering an index —
   no JWT-signing error in the logs means the key parsed correctly.

**Tunneling localhost for real webhook delivery** (only needed once you
want live push/PR webhooks working, not just login/connect): use
`ngrok http 3000` (or `cloudflared tunnel`) and put the resulting public
HTTPS URL as the **Webhook URL** instead of `localhost:3000`. Without
this, GitHub can't deliver webhook events to your machine — the Setup URL
redirect (browser-driven, not server-to-server) still works fine over
plain `localhost` since it's the user's own browser making that request,
not GitHub's servers.

---

## 3. Gemini API key — embeddings + chat LLM

**What it's for**: both the worker's embedding generation
(`worker/src/embedding/embedder.py`) and the backend's chat completion
(`backend/src/modules/chat/services/llm.service.ts`) call Gemini. Same
key, used in two places — confirmed both `backend/.env` and
`worker/.env`-equivalent config (`GEMINI_API_KEY`, per
`worker/src/config.py`) need it.

**Steps**:
1. Go to https://aistudio.google.com/apikey (Google AI Studio).
2. Sign in with a Google account.
3. Click **Create API key** → pick or create a Google Cloud project when
   prompted (a free-tier project works for dev).
4. Copy the generated key → paste it as the **same value** into both:
   ```
   backend/.env      -> GEMINI_API_KEY=<paste here>
   worker/.env        -> GEMINI_API_KEY=<paste here>
   ```

No separate setup needed for `EMBEDDING_MODEL_VERSION` — leave it as
`gemini-embedding-001-1536` (already correctly set in both files), it
just needs a valid key to actually call that model.

---

## 4. Jina AI API key — reranking

**What it's for**: the retrieval pipeline's reranking step
(`backend/src/modules/retrieval/services/reranker.service.ts`, added
this session) calls Jina's hosted cross-encoder reranker
(`https://api.jina.ai/v1/rerank`) to narrow the ~20 RRF-merged candidates
down to the final 5-8 shown to the LLM.

**Steps**:
1. Go to https://jina.ai/reranker/ or directly https://jina.ai/api-dashboard/ .
2. Sign up / log in.
3. Generate an API key from the dashboard (Jina's free tier includes a
   meaningful number of reranking calls, enough for dev).
4. Copy the key → paste into `backend/.env` as `JINA_API_KEY=<paste here>`.

Note: `reranker.service.ts` already has a built-in graceful fallback — if
this key is missing/invalid or the call fails, chat/PR-review still work
by falling back to plain RRF order instead of failing outright. So this
one is lower-priority than GitHub/Gemini if you want to get something
running fastest, but reranking quality won't be real until it's set.

---

## Self-generated secrets — not from any provider

These don't come from a website — generated with `openssl rand -hex ...`
already, ready to paste directly into `backend/.env`, replacing the
current `dev-only-change-me-*` placeholders:

```
JWT_ACCESS_SECRET=540068051e68e74b2bfb80d0f8b2dc136e31a2b0cafe86269ad21ae628a825fc
JWT_REFRESH_SECRET=949b44cb8da3d1a726a790e8ef4851fde0709379e41b55c93b4616d5dc5ce17e
TOKEN_ENCRYPTION_KEY=b497b20ccfcccd32bd924c9b308f8c10
INTERNAL_API_SECRET=d9a5aace6155cb0d2dccb02ed10d39f4891fbd7ddbd3500ef1db1fa9d5a02ccf
```

`INTERNAL_API_SECRET` must be the **exact same value** in both
`backend/.env` and `worker/.env` — it's a shared secret the worker uses
to authenticate its calls back to the backend's internal
installation-token endpoint
(`backend/src/core/middlewares/internal-auth.middleware.ts` on the
receiving side). So paste that same line into `worker/.env` too.

`GITHUB_WEBHOOK_SECRET` is also self-chosen — already generated above in
the GitHub App section (same value, `fae870a4...`) — not generated by
GitHub, you pick it and enter the same value in both the GitHub App's
webhook config and `backend/.env`.

**These are one-time-use values generated for this conversation.** They
work fine for local dev right now, but generate a fresh, different set
with the same commands before any real deployment — never reuse
dev-generated secrets in prod:

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 16   # TOKEN_ENCRYPTION_KEY (needs >= 32 chars, hex-16 gives 32)
openssl rand -hex 32   # INTERNAL_API_SECRET (needs >= 16 chars)
openssl rand -hex 32   # GITHUB_WEBHOOK_SECRET (paired with prod's separate GitHub App)
```

---

## 5. Doing all of this again for prod

Everything above walks through **local dev** (`localhost` URLs). When you
deploy, you need a **second, separate** GitHub OAuth App and GitHub App —
not a reuse of the dev ones — because the callback/Setup/Webhook URLs are
baked into each app's GitHub settings page and can't point at two
different origins at once.

**What's reusable across dev and prod, what isn't:**

| Credential | Reuse dev value in prod? |
|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | ❌ new OAuth App, new values |
| `GITHUB_APP_ID` / `GITHUB_APP_SLUG` / `GITHUB_APP_PRIVATE_KEY` | ❌ new GitHub App, new values |
| `GITHUB_WEBHOOK_SECRET` | ❌ new value (paired with the new GitHub App) |
| `GEMINI_API_KEY` | ✅ same key works (not URL-bound) |
| `JINA_API_KEY` | ✅ same key works (not URL-bound) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `TOKEN_ENCRYPTION_KEY` / `INTERNAL_API_SECRET` | ❌ generate fresh — never reuse dev-generated secrets in prod |

**Before starting**: know your real prod URLs first. You need both:
- Your **frontend's** real prod URL (e.g. `https://app.codetrace.dev`) —
  this project has no prod domain configured yet
  (`infra/nginx/nginx.prod.conf` is currently an empty placeholder file),
  so this is whatever domain you're actually pointing DNS at when you
  deploy.
- Your **backend's** real prod URL (e.g. `https://api.codetrace.dev`, or
  the same domain on a different path/port depending on how you deploy
  `infra/docker-compose.single-vm.yml`).

Substitute those two for every `http://localhost:5173` and
`http://localhost:3000` below — same steps as sections 1 and 2 above,
different URLs:

### 5a. Prod OAuth App

Repeat section 1's steps at https://github.com/settings/developers with:

| Field | Value |
|---|---|
| Application name | `CodeTrace` (drop the "(dev)" suffix, or name it however you distinguish prod) |
| Homepage URL | `<your prod frontend URL>` |
| Authorization callback URL | `<your prod backend URL>/auth/github/callback` |

Copy the resulting Client ID/Secret into **prod's** `backend/.env` (not
the dev one you already filled in) as `GITHUB_CLIENT_ID` /
`GITHUB_CLIENT_SECRET`.

### 5b. Prod GitHub App

Repeat section 2's steps at https://github.com/settings/apps/new with:

| Field | Value |
|---|---|
| GitHub App name | a new unique name, e.g. `codetrace-<yourname>-prod` |
| Homepage URL | `<your prod frontend URL>` |
| Setup URL | `<your prod backend URL>/repositories/installation-callback` |
| Webhook URL | `<your prod backend URL>/webhooks/github` — real HTTPS domain, so **no tunnel needed this time**, GitHub can reach it directly |
| Webhook secret | generate a fresh one: `openssl rand -hex 32` (do not reuse the dev value `fae870a4...`) |

Same Permissions (Contents/Metadata/Pull requests, all Read-only) and
same Subscribe to events (Push, Pull request, Installation target) as
dev.

**"Where can this GitHub App be installed?"**: set to **"Any account"**
for prod — this is what actually lets other people's GitHub accounts
install the App and connect their own repos, not just yours. (This is a
GitHub-level installation restriction, unrelated to the event checkboxes
or permissions above.)

Copy the resulting App ID / slug / private key into **prod's**
`backend/.env` as `GITHUB_APP_ID` / `GITHUB_APP_SLUG` /
`GITHUB_APP_PRIVATE_KEY`, same format as the dev steps.

### 5c. Prod secrets

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 16   # TOKEN_ENCRYPTION_KEY
openssl rand -hex 32   # INTERNAL_API_SECRET — must match exactly between prod backend/.env and prod worker/.env
```

`CORS_ORIGIN` in prod `backend/.env` must be your real prod **frontend**
URL (`https://app.codetrace.dev`, no trailing slash) — not
`http://localhost:5173`. Get this wrong and every authenticated request
from the real frontend gets CORS-blocked (see the reasoning comment
already in `backend/src/config/env.ts` for why this can't be a wildcard).

`VITE_API_URL` / `VITE_WS_URL` in the frontend's prod env must point at
your real prod backend URL — `https://` / `wss://`, not `http://`/`ws://`.

---

## After updating `.env`

Restart the backend (`npm run dev` in `backend/` — now correctly loads
`.env` automatically as of this session's `dotenv` fix, no flags needed)
and the worker. Then the real end-to-end flow becomes testable: log in
with a real GitHub account, install the GitHub App on a real repo,
connect it, trigger an index, and get a real chat answer grounded in
real Gemini embeddings + a real reranked result set.
