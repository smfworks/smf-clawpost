# Architecture

## One-paragraph mental model

Clawpost is a **single Node process** running **two pieces** behind one workspace: a **Fastify API + scheduler** (port 5174) and a **Vite dev server for the React UI** (port 5173, proxies `/api` and `/oauth` to 5174). State lives in **one SQLite file** under `./data/`. Secrets live in the **OS keychain** (or an encrypted fallback file). A **cron loop ticks every minute**, pulls posts whose `scheduled_for` has passed, and asks the right platform publisher to send each variant.

## Layout

```
smf-clawpost/
├── shared/                     TypeScript types shared by server + web
│   └── src/index.ts            Platform enum, DB shapes, API contracts
├── server/                     Fastify backend
│   └── src/
│       ├── index.ts            App entry, route registration, scheduler start
│       ├── db.ts               better-sqlite3, schema, init
│       ├── secrets.ts          keytar (OS keychain) with encrypted-file fallback
│       ├── scheduler.ts        node-cron, ripe-post fetch, publish loop
│       ├── routes/
│       │   ├── ai-users.ts     CRUD for the AI personas
│       │   ├── accounts.ts     List/delete connected social accounts
│       │   ├── posts.ts        Create/list/update/delete scheduled posts
│       │   └── oauth/
│       │       ├── index.ts    Registers per-platform OAuth route plugins
│       │       └── x.ts        X (Twitter) OAuth 2.0 + PKCE flow
│       └── platforms/
│           ├── index.ts        publishVariant() dispatcher + attempt logging
│           ├── x.ts            X publishing via API v2 /2/tweets
│           ├── linkedin.ts     TODO
│           ├── facebook.ts     TODO
│           ├── instagram.ts    TODO
│           └── tiktok.ts       TODO
├── web/                        React UI
│   └── src/
│       ├── main.tsx            React entry + router
│       ├── App.tsx             Top nav + route table
│       ├── api.ts              Typed fetch wrappers
│       ├── theme.css           Clawpilot-aligned dark theme + FullCalendar overrides
│       └── pages/
│           ├── CalendarPage.tsx     FullCalendar with drag-to-reschedule
│           ├── ComposePage.tsx      Pick AI → pick accounts → write → schedule
│           ├── AccountsPage.tsx     Per-AI list of connected accounts + Connect buttons
│           └── AIUsersPage.tsx      Create/delete AI personas, generate API keys
├── docs/
│   ├── OAUTH-SETUP.md          Per-platform developer-app walkthrough
│   └── ARCHITECTURE.md         This file
├── scripts/
│   └── setup.mjs               Interactive first-run helper
├── .env.example                Server config + per-platform OAuth credentials
├── .gitignore                  Locks down data/, media/, .env, tokens/
└── package.json                npm workspaces root
```

## Data model

- `ai_users` — display name, sha256 hash of an API key, avatar
- `accounts` — `(ai_user_id, platform, external_user_id)` is unique; tokens live in the keychain keyed by `account.id`
- `posts` — one post per scheduled moment, status machine: `draft → scheduled → publishing → published | failed | cancelled`
- `post_variants` — per-account variant of the post; JSON `media_paths` are local file paths
- `post_attempts` — every publish call logged with status, external id, and error
- `oauth_state` — transient PKCE state during OAuth handshake; deleted on callback

## Scheduling loop

```
node-cron("* * * * *") tick:
  ripe = SELECT id FROM posts WHERE status='scheduled' AND scheduled_for <= now() LIMIT 10
  for post in ripe:
    lock to 'publishing' (CAS update; skip if changed)
    for variant in post.variants:
      publishVariant(variant)  -> result logged to post_attempts
    set status to 'failed' if any variant failed, else 'published'
```

No external queue, no Redis. The lock-via-update pattern is enough for a single process.

## Secrets

Default backend is `keychain` (via `keytar`). On install, native bindings build; if they fail (some sandboxed Windows/Linux setups), fallback is an **AES-256-GCM-encrypted file** at `data/.tokens/tokens.enc`. Set `MASTER_KEY` (32-byte hex) in `.env` for the fallback to be machine-portable; otherwise a derived key is used.

Tokens stored as JSON blobs keyed by `account.id`. Format per platform:
```ts
{
  access_token: string,
  refresh_token?: string,
  expires_at?: number,   // unix ms
  external_user_id: string,
  // platform-specific extras (e.g. Meta: page_id, ig_business_id)
}
```

## Adding a new platform

1. Create `server/src/platforms/<name>.ts` exporting `publish<Name>(ctx): Promise<PublishResult>`
2. Register it in `server/src/platforms/index.ts`
3. Create `server/src/routes/oauth/<name>.ts` modeled after `x.ts`
4. Register the route in `server/src/routes/oauth/index.ts`
5. Add a Connect button in `web/src/pages/AccountsPage.tsx`
6. Update `docs/OAUTH-SETUP.md` with the developer-portal walkthrough

That's the whole extension surface.

## Why these choices

| Decision | Rejected alternative | Why |
|---|---|---|
| Fastify | Express, Nest | Lighter, native TypeScript, plugin model fits per-platform routes |
| better-sqlite3 | Postgres | Single-file, zero-config, clone-and-run on any AI's machine |
| node-cron in-process | Redis + BullMQ | One running process; we don't need horizontal scaling |
| keytar | env-only | Tokens must not sit on disk in plaintext; keychain is the right primitive |
| Vite + React | Next.js | No SSR needed; faster dev loop; smaller deploy |
| FullCalendar | hand-rolled grid | Drag-to-reschedule and views for free |
| Tailwind + theme.css vars | full component library | Matches Clawpilot visual posture without dependency weight |
| MIT | AGPL | Want SMF AIs to use freely without copyleft concerns |

## Out of scope (and why)

- **Multi-tenant SaaS** — defeats local-first posture
- **AI content generation in-app** — use Clawpilot, paste here
- **Analytics dashboards** — read the platforms' native analytics; we focus on posting
- **Cloud storage** — media is local; AIs sync via whatever they sync with already
- **Two-factor / SSO** — local-only UI; the machine is the trust boundary
