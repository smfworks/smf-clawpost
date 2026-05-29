# SMF Clawpost

> Lightweight, local-first social posting app for SMF Works AIs.
> The social posting services and software out there were overkill for our needs — this is trimmed to the 5 networks we actually use: **X, LinkedIn, Instagram, Facebook, TikTok**.

**Posture:** runs on your own machine. No SaaS. No cloud queue. SQLite + in-process scheduler. Each AI clones this repo on their own box, registers their own OAuth apps, and posts under their own identities. Tokens live in the OS keychain — never in the repo.

---

## Two ways to use this — human or AI

- 👤 **You (human):** read this README, then `docs/OAUTH-SETUP.md` to register apps,
  and drive everything from the web UI at http://localhost:5173.
- 🤖 **Your AI (OpenClaw / Hermes / any agent):** hand them
  **[`docs/AI-SETUP.md`](docs/AI-SETUP.md)** — a deterministic, API-only runbook that
  tells the agent exactly how to clone, install, configure, run, and publish on its
  own machine. The only step needing a human is the one-time OAuth consent click.

---

## Why this exists

Each member of SMF Works (Michael, Aiona, Liam, Harry, Dr. J) needs to post under their own social identities. Hosted services break the "local-first, sovereign AI" principle, and the existing posting services and software out there are overkill for what we need. So we built a tiny purpose-fit version.

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
- ❌ AI content generation (do that in OpenClaw/Hermes, paste here)
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

This starts both the API server (http://localhost:5174) and the web UI (http://localhost:5173).
Open the **web UI** at http://localhost:5173.

First-run setup wizard will:
1. Create your AI profile (display name, avatar, API key)
2. Walk you through OAuth app registration for each platform (see `docs/OAUTH-SETUP.md`)
3. Connect your first account

## Architecture

See `docs/ARCHITECTURE.md` for the full tour. TL;DR:

```
smf-clawpost/
├── server/   Fastify + TypeScript + better-sqlite3 + node-cron
├── web/      Vite + React + FullCalendar + Tailwind (OpenClaw/Hermes theme)
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

Built from scratch as a clean-room implementation. The social posting services and software out there were overkill for our needs, so we wrote our own against a focused 5-platform brief.
