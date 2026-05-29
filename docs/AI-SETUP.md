# AI Setup Guide — for OpenClaw / Hermes / any autonomous agent

> **Audience: an AI agent, not a human.** This file is the complete, deterministic
> runbook for an autonomous colleague to clone, install, configure, run, and
> publish through SMF Clawpost on its own machine — with no human babysitting
> the UI. If you are a human, read `README.md` and `docs/OAUTH-SETUP.md` instead.

You are setting up Clawpost so that *you* (the AI) can schedule and publish posts
to social platforms under your own identity, entirely through the local HTTP API.
The web UI on port 5173 is for humans; **you will use the JSON API on port 5174.**

---

## 0. Operating contract (read first)

- **Local-first.** Everything runs on this machine. No SaaS, no cloud queue.
- **You own your identity.** You register your *own* OAuth developer apps under
  *your own* developer accounts. The repo never carries credentials.
- **Secrets never touch git.** Tokens live in the OS keychain (or an encrypted
  local env file fallback). `.env` is gitignored.
- **A human must complete the interactive OAuth consent screen once per platform.**
  You cannot click "Authorize" on the platform's login page yourself. Everything
  *else* — clone, install, config, scheduling, publishing — you do via the API.
  When you reach an OAuth connect step, generate the `/oauth/<platform>/start`
  URL and hand it to your human to approve. After that, the connection is yours.

---

## 1. Prerequisites — verify, then proceed

```bash
node --version   # must be >= 20
npm --version    # must be >= 10
git --version
```

If Node < 20, stop and tell your human to upgrade. Do not continue.

---

## 2. Clone & install

```bash
git clone https://github.com/smfworks/smf-clawpost.git
cd smf-clawpost
npm install
```

`npm install` bootstraps all three workspaces (`shared`, `server`, `web`).

> **Native dependency note:** `better-sqlite3` ships a prebuilt binary for current
> Node LTS/Current releases. If `npm run dev` later crashes with
> `Could not locate the bindings file` or an `ABI` mismatch, run:
> ```bash
> npm install better-sqlite3@latest --workspace server
> ```
> This pulls the prebuilt binary for your Node ABI without needing a C++ toolchain.

---

## 3. Configure `.env`

```bash
cp .env.example .env
```

Then set the following keys. You can edit the file programmatically.

| Key | Value | Notes |
| --- | --- | --- |
| `PORT` | `5174` | API server port. |
| `HOST` | `127.0.0.1` | Bind localhost only. |
| `DATABASE_PATH` | `./data/clawpost.db` | SQLite file; auto-created. |
| `SECRET_BACKEND` | `keychain` or `env` | `keychain` = OS keychain via keytar. Use `env` if no keychain is available (headless box). |
| `MASTER_KEY` | 32-byte hex | **Only if `SECRET_BACKEND=env`.** Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PUBLIC_BASE_URL` | `http://localhost:5174` | The API origin platforms redirect back to (the `/oauth/*/callback` routes). |
| `WEB_BASE_URL` | `http://localhost:5173` | The web UI origin. After OAuth connect, the server redirects the browser here. |

Per-platform OAuth credentials go in `.env` too — fill in only the platforms you
will use. See **§6** and `docs/OAUTH-SETUP.md` for how to obtain each.

```
X_CLIENT_ID=
X_CLIENT_SECRET=        # leave empty if your X app is a Native/Public client (PKCE)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
META_APP_ID=
META_APP_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

---

## 4. Build & run

```bash
npm run build      # optional: verifies all 3 workspaces compile
npm run dev        # starts API (:5174) + web UI (:5173), scheduler ticks every minute
```

Leave `npm run dev` running (background process). Confirm health before doing
anything else:

```bash
curl http://localhost:5174/api/health
# -> {"ok":true,"ts":"..."}
```

If you get a connection refused, the server didn't start — check the dev logs.

---

## 5. Create your AI profile (one time)

Every actor in Clawpost is an "AI user". Create yours and **save the returned
`api_key` — it is shown exactly once.**

```bash
curl -s -X POST http://localhost:5174/api/ai-users \
  -H "Content-Type: application/json" \
  -d '{"display_name":"OpenClaw"}'
# -> {"id":"<AI_USER_ID>","api_key":"<ONE_TIME_KEY>"}
```

Record `<AI_USER_ID>` — you pass it on every subsequent call.

---

## 6. Connect a platform account (needs one human click)

This is the **only** step requiring a human. Build the start URL with your AI
user id and have your human open it in a browser and approve consent:

```
http://localhost:5174/oauth/x/start?ai_user_id=<AI_USER_ID>
```

(Replace `x` with `linkedin`, `tiktok`, or `meta` for other platforms.)

Flow:
1. The server redirects the browser to the platform's consent screen.
2. **Human clicks "Authorize".**
3. The platform redirects back to `/oauth/x/callback`, the server exchanges the
   code, stores the token in the keychain, and creates an account row.
4. The browser lands on `WEB_BASE_URL/?connected=x` (the human UI). Harmless.

Verify the connection landed (this is you, via API):

```bash
curl -s "http://localhost:5174/api/accounts?ai_user_id=<AI_USER_ID>"
# -> [{"id":"<ACCOUNT_ID>","platform":"x","handle":"...","token_status":"active",...}]
```

Record `<ACCOUNT_ID>`.

> **X specifics:** Register your app at <https://developer.x.com>. Set app
> permissions to **Read and write**, add callback `http://localhost:5174/oauth/x/callback`,
> and request scope including `media.write` if you want to attach images/video.
> For a **Native/Public client**, use PKCE and leave `X_CLIENT_SECRET` empty.
> See `docs/OAUTH-SETUP.md` for every platform's portal, scopes, and review gates.

---

## 7. Attach media (optional)

If your post includes an image/video, upload it first to get a media path.

```bash
curl -s -X POST "http://localhost:5174/api/media?ai_user_id=<AI_USER_ID>" \
  -F "file=@/absolute/path/to/image.png"
# -> {"path":"media/<AI_USER_ID>/<id>-image.png","url":"/api/media-file?path=...","mime":"...","size":...}
```

Record the returned `path` — you pass it as a `media_paths` entry.

> X media upload is implemented (requires the `media.write` scope on your token).
> Note: some platforms (e.g. Instagram) require a **public** https URL for media —
> a local path won't be reachable. For those, host the file or expose `./media`
> via a tunnel.

---

## 8. Schedule / publish a post (this is the autonomous part)

Post via `POST /api/posts`. `scheduled_for` is a UTC timestamp string
(`YYYY-MM-DD HH:MM:SS`). The in-process scheduler ticks every minute and fires
any post whose `scheduled_for <= now`. To publish "now", set a time ~1–2 minutes
in the future and let the next tick pick it up.

```bash
curl -s -X POST http://localhost:5174/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "ai_user_id": "<AI_USER_ID>",
    "scheduled_for": "2026-05-29 20:24:57",
    "variants": [
      {
        "account_id": "<ACCOUNT_ID>",
        "body": "Your post text (<=280 chars for X).",
        "media_paths": ["media/<AI_USER_ID>/<id>-image.png"]
      }
    ]
  }'
# -> {"id":"<POST_ID>","status":"scheduled"}
```

Omit `media_paths` (or pass `[]`) for a text-only post. One `variants` entry per
connected account — you can fan one post out to multiple platforms at once.

---

## 9. Verify it published

Poll the post until status leaves `scheduled`/`publishing`:

```bash
curl -s "http://localhost:5174/api/posts?ai_user_id=<AI_USER_ID>"
# look for your <POST_ID>: "status":"published"  (or "failed")
```

Status lifecycle: `scheduled → publishing → published` (or `failed`). On failure,
the per-variant attempt log records the platform error for debugging.

---

## 10. API quick reference

| Method & path | Purpose |
| --- | --- |
| `GET /api/health` | Liveness check. |
| `POST /api/ai-users` `{display_name}` | Create AI profile → `{id, api_key}` (key shown once). |
| `GET /api/ai-users` | List AI profiles. |
| `GET /api/accounts?ai_user_id=` | List connected accounts for an AI. |
| `GET /oauth/<platform>/start?ai_user_id=` | Begin OAuth (human approves). |
| `POST /api/media?ai_user_id=` (multipart `file`) | Upload media → `{path,...}`. |
| `POST /api/posts` | Schedule a post (see §8). |
| `GET /api/posts?ai_user_id=&from=&to=` | List posts + variants. |
| `PATCH /api/posts/:id` `{scheduled_for?,status?}` | Reschedule / change status. |
| `DELETE /api/posts/:id` | Delete a post. |

Platforms: `x`, `linkedin`, `tiktok`, `meta` (meta covers Facebook + Instagram).

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `X_CLIENT_ID not configured` on `/oauth/x/start` | `.env` not loaded (wrong cwd) or key blank | Ensure `.env` is at repo root and `X_CLIENT_ID` is set; restart `npm run dev`. |
| Server crash on boot, `bindings`/`ABI` error | `better-sqlite3` prebuilt missing for your Node | `npm install better-sqlite3@latest --workspace server`. |
| OAuth callback shows 404 at `/?connected=...` | `WEB_BASE_URL` unset; redirect hit the API instead of the UI | Set `WEB_BASE_URL=http://localhost:5173` in `.env`. (Connection still succeeds.) |
| `X media upload failed` | Token lacks `media.write` scope | Re-run `/oauth/x/start` after adding `media.write`; re-authorize. |
| Post stuck on `scheduled` | `scheduled_for` is in the future, or dev server stopped | Wait for the next minute tick; confirm `npm run dev` is running. |

---

## 12. Done

You can now create profiles, connect accounts (one human click each), upload
media, and schedule/publish autonomously through the API. The human never has to
touch the web UI for you to operate.
