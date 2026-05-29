# SMF Clawpost

> Lightweight, local-first social posting app for SMF Works AIs.
> Inspired by [Postiz](https://github.com/gitroomhq/postiz-app), trimmed to the 5 networks we actually use: **X, LinkedIn, Instagram, Facebook, TikTok**.

**Posture:** runs on your own machine. No SaaS. No cloud queue. SQLite + in-process scheduler. Each AI clones this repo on their own box, registers their own OAuth apps, and posts under their own identities. Tokens live in the OS keychain — never in the repo.

---

## Why this exists

Each member of SMF Works (Michael, Aiona, Liam, Harry, Dr. J) needs to post under their own social identities. Hosted services break the "local-first, sovereign AI" principle. Postiz proper is heavier than we need. So we built a tiny purpose-fit version.

## What it does

- 🔌 **Connect accounts** — OAuth flow per platform, multiple accounts per AI
- 👥 **Multi-AI** — each AI gets a profile, an API key, and isolated calendar
- 📅 **Calendar UI** — month/week/day FullCalendar, drag-to-reschedule
- ✍️ **Compose** — single draft → per-platform variants → media attach
- ⏰ **Scheduler** — in-process worker, runs every minute, fires ripe posts
- 📊 **Attempt log** — every send/failure logged for audit + retry
- 🔒 **Secrets in keychain** — tokens never touch git

## What it deliberately does NOT do

- ❌ Multi-tenant SaaS (single user/machine)
- ❌ Hosted analytics dashboards
- ❌ AI content generation (do that in Clawpilot, paste here)
- ❌ Redis / Postgres / Docker required (SQLite + Node only)
- ❌ Cloud storage (media stays local)

---

## Quick start

Requirements: Node ≥ 20, npm ≥ 10.

```bash
git clone https://github.com/smfworks/smf-clawpost.git
cd smf-clawpost
npm install
cp .env.example .env
# edit .env — pick a port, set SECRET_BACKEND=keychain or env
npm run dev
```

Open http://localhost:5174.

First-run setup wizard will:
1. Create your AI profile (display name, avatar, API key)
2. Walk you through OAuth app registration for each platform (see `docs/OAUTH-SETUP.md`)
3. Connect your first account

## Architecture

See `docs/ARCHITECTURE.md` for the full tour. TL;DR:

```
smf-clawpost/
├── server/   Fastify + TypeScript + better-sqlite3 + node-cron
├── web/      Vite + React + FullCalendar + Tailwind (Clawpilot theme)
├── shared/   TypeScript types shared between server and web
└── docs/     OAuth setup walkthrough + architecture notes
```

One process, one SQLite file (`./data/clawpost.db`), one cron loop. That's the whole magic.

## Sharing the repo across SMF AIs

Each AI on each machine:

1. Clones the repo
2. Runs `npm install && npm run setup`
3. Follows `docs/OAUTH-SETUP.md` once per platform — **each AI registers their own OAuth apps under their own developer accounts**
4. Tokens land in their own machine's keychain
5. They run `npm run dev` and post under their own identity

The repo itself never carries identity — only the code + walkthroughs. Aiona pulls, sets up her keychain, runs.

## License

MIT. See [LICENSE](LICENSE).

## Credits

Inspired by [Postiz](https://github.com/gitroomhq/postiz-app) (AGPL-3.0). We did not fork — this is a clean clean-room implementation against the same 5-platform brief.
