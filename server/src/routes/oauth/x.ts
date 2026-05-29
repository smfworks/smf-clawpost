/**
 * X (Twitter) OAuth 2.0 with PKCE.
 * Docs: https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code
 *
 * Flow:
 *   GET /oauth/x/start?ai_user_id=...  → redirects to X auth URL
 *   GET /oauth/x/callback?code&state    → exchanges code, stores token, creates account row
 */
import type { FastifyPluginAsync } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "../../db.js";
import { setSecret } from "../../secrets.js";
import { nanoid } from "nanoid";
import { request } from "undici";

const AUTH_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const ME_URL = "https://api.x.com/2/users/me";

const SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"].join(" ");

function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export const xOAuthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { ai_user_id: string } }>("/start", async (req, reply) => {
    const aiUserId = req.query.ai_user_id;
    const clientId = process.env.X_CLIENT_ID;
    if (!aiUserId) return reply.code(400).send({ error: "ai_user_id required" });
    if (!clientId) return reply.code(500).send({ error: "X_CLIENT_ID not configured in .env" });

    const state = nanoid();
    const { verifier, challenge } = pkcePair();
    getDb()
      .prepare(`INSERT INTO oauth_state (state, ai_user_id, platform, code_verifier) VALUES (?, ?, 'x', ?)`)
      .run(state, aiUserId, verifier);

    const redirectUri = `${process.env.PUBLIC_BASE_URL ?? "http://localhost:5174"}/oauth/x/callback`;
    const url = new URL(AUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    return reply.redirect(url.toString());
  });

  app.get<{ Querystring: { code: string; state: string } }>("/callback", async (req, reply) => {
    const { code, state } = req.query;
    const row = getDb()
      .prepare(`SELECT * FROM oauth_state WHERE state = ? AND platform = 'x'`)
      .get(state) as { ai_user_id: string; code_verifier: string } | undefined;
    if (!row) return reply.code(400).send({ error: "invalid state" });
    getDb().prepare(`DELETE FROM oauth_state WHERE state = ?`).run(state);

    const clientId = process.env.X_CLIENT_ID!;
    const clientSecret = process.env.X_CLIENT_SECRET ?? "";
    const redirectUri = `${process.env.PUBLIC_BASE_URL ?? "http://localhost:5174"}/oauth/x/callback`;

    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: row.code_verifier,
    });

    const basic = clientSecret
      ? `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
      : undefined;

    const tokenRes = await request(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(basic ? { Authorization: basic } : {}),
      },
      body: body.toString(),
    });

    const tokenJson = (await tokenRes.body.json()) as any;
    if (tokenRes.statusCode >= 300 || !tokenJson.access_token) {
      return reply.code(500).send({ error: "token exchange failed", details: tokenJson });
    }

    const meRes = await request(ME_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const meJson = (await meRes.body.json()) as any;
    const me = meJson?.data;
    if (!me?.id) return reply.code(500).send({ error: "could not fetch X profile" });

    const accountId = nanoid();
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO accounts (id, ai_user_id, platform, handle, display_name, external_user_id, token_status)
         VALUES (?, ?, 'x', ?, ?, ?, 'active')`
      )
      .run(accountId, row.ai_user_id, me.username ?? me.id, me.name ?? null, me.id);

    await setSecret(accountId, {
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      expires_at: Date.now() + (tokenJson.expires_in ?? 7200) * 1000,
      external_user_id: me.id,
    });

    return reply.redirect(`${process.env.WEB_BASE_URL ?? "http://localhost:5173"}/?connected=x`);
  });
};
