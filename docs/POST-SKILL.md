# The `/post` Clawpilot skill

A companion Clawpilot skill that schedules posts through this server's API. It lives
outside the repo (it's a user-level Clawpilot skill), at:

```
C:\Users\mgann\.copilot\m-skills\post\
  SKILL.md            ← full flow / source of truth
  scripts\post.mjs    ← convenience API wrapper
```

## What it does

Invoked as `/post {draft text}`, it walks the user through:

1. **Persona** — `GET /api/ai-users`, pick which AI to post as.
2. **Accounts** — `GET /api/accounts?ai_user_id=...`, multi-select targets.
3. **Content** — confirm body, with per-platform character-limit warnings
   (X 280, LinkedIn 3000, Instagram 2200, Facebook none, TikTok 2200) and media
   rules (Instagram needs a public https URL; TikTok needs a video).
4. **Schedule** — default 5 minutes from now (ISO 8601).
5. **Preview + confirm** — shows persona, accounts, exact body, time, warnings.
6. **Schedule** — `POST /api/posts` (one variant per account).
7. **Report** — returns the post id and when it will fire.

## Safety

The skill only **schedules**; the Clawpost scheduler fires posts at their time.
It reminds the user that Clawpost will not post live to any platform until the
per-platform "first-send nod" has been given.

## Helper script

```
node scripts/post.mjs ai-users
node scripts/post.mjs accounts <ai_user_id>
node scripts/post.mjs schedule <ai_user_id> "<body>" <account_id,...> [iso_time]
```

Reads `CLAWPOST_BASE` (default `http://127.0.0.1:5174`).
