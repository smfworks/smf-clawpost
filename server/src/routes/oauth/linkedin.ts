/**
 * LinkedIn OAuth 2.0 (authorization code).
 * Docs: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 *
 * Flow:
 *   GET /oauth/linkedin/start?ai_user_id=...  → redirects to LinkedIn auth URL
 *   GET /oauth/linkedin/callback?code&state   → exchanges code, stores token, creates account row
 *
 * Scopes: openid profile w_member_social
 *   - openid + profile → /v2/userinfo (OIDC) gives us `sub` (person id) + name
 *   - w_member_social  → required to POST shares via /v2/ugcPosts
 */
import type { FastifyPluginAsync } from "fastify";
import { getDb } from "../../db.js";
import { setSecret } from "../../secrets.js";
import { nanoid } from "nanoid";
import { request } from "undici";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

const SCOPES = ["openid", "profile", "w_member_social"].join(" ");

export const linkedinOAuthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { ai_user_id: string } }>("/start", async (req, reply) => {
    const aiUserId = req.query.ai_user_id;
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!aiUserId) return reply.code(400).send({ error: "ai_user_id required" });
    if (!clientId) return reply.code(500).send({ error: "LINKEDIN_CLIENT_ID not configured in .env" });

    const state = nanoid();
    getDb()
      .prepare(`INSERT INTO oauth_state (state, ai_user_id, platform) VALUES (?, ?, 'linkedin')`)
      .run(state, aiUserId);

    const redirectUri = `${process.env.PUBLIC_BASE_URL ?? "http://localhost:5174"}/oauth/linkedin/callback`;
    const url = new URL(AUTH_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("state", state);

    return reply.redirect(url.toString());
  });

  app.get<{ Querystring: { code: string; state: string } }>("/callback", async (req, reply) => {
    const { code, state } = req.query;
    const row = getDb()
      .prepare(`SELECT * FROM oauth_state WHERE state = ? AND platform = 'linkedin'`)
      .get(state) as { ai_user_id: string } | undefined;
    if (!row) return reply.code(400).send({ error: "invalid state" });
    getDb().prepare(`DELETE FROM oauth_state WHERE state = ?`).run(state);

    const clientId = process.env.LINKEDIN_CLIENT_ID!;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET ?? "";
    const redirectUri = `${process.env.PUBLIC_BASE_URL ?? "http://localhost:5174"}/oauth/linkedin/callback`;

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenRes = await request(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const tokenJson = (await tokenRes.body.json()) as any;
    if (tokenRes.statusCode >= 300 || !tokenJson.access_token) {
      return reply.code(500).send({ error: "token exchange failed", details: tokenJson });
    }

    const meRes = await request(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const me = (await meRes.body.json()) as any;
    if (!me?.sub) return reply.code(500).send({ error: "could not fetch LinkedIn profile (userinfo)" });

    const handle = me.preferred_username ?? me.sub;
    const displayName = me.name ?? null;

    const accountId = nanoid();
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO accounts (id, ai_user_id, platform, handle, display_name, external_user_id, token_status)
         VALUES (?, ?, 'linkedin', ?, ?, ?, 'active')`
      )
      .run(accountId, row.ai_user_id, handle, displayName, me.sub);

    await setSecret(accountId, {
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      expires_at: Date.now() + (tokenJson.expires_in ?? 5184000) * 1000,
      external_user_id: me.sub,
    });

    return reply.redirect(`${process.env.WEB_BASE_URL ?? "http://localhost:5173"}/?connected=linkedin`);
  });
};
