/**
 * TikTok OAuth 2.0 with PKCE.
 * Docs: https://developers.tiktok.com/doc/oauth-user-access-token-management
 *
 * Flow:
 *   GET /oauth/tiktok/start?ai_user_id=...  → redirects to TikTok auth URL
 *   GET /oauth/tiktok/callback?code&state   → exchanges code, stores token, creates account row
 *
 * Scopes: user.info.basic, video.upload, video.publish
 * NOTE: token form params use `client_key` (NOT client_id).
 */
import type { FastifyPluginAsync } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { getDb } from "../../db.js";
import { setSecret } from "../../secrets.js";
import { nanoid } from "nanoid";
import { request } from "undici";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USERINFO_URL =
  "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name";

const SCOPES = ["user.info.basic", "video.upload", "video.publish"].join(",");

function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("hex");
  return { verifier, challenge };
}

export const tiktokOAuthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { ai_user_id: string } }>("/start", async (req, reply) => {
    const aiUserId = req.query.ai_user_id;
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!aiUserId) return reply.code(400).send({ error: "ai_user_id required" });
    if (!clientKey) return reply.code(500).send({ error: "TIKTOK_CLIENT_KEY not configured in .env" });

    const state = nanoid();
    const { verifier, challenge } = pkcePair();
    getDb()
      .prepare(`INSERT INTO oauth_state (state, ai_user_id, platform, code_verifier) VALUES (?, ?, 'tiktok', ?)`)
      .run(state, aiUserId, verifier);

    const redirectUri = `${process.env.PUBLIC_BASE_URL ?? "http://localhost:5174"}/oauth/tiktok/callback`;
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");

    return reply.redirect(url.toString());
  });

  app.get<{ Querystring: { code: string; state: string } }>("/callback", async (req, reply) => {
    const { code, state } = req.query;
    const row = getDb()
      .prepare(`SELECT * FROM oauth_state WHERE state = ? AND platform = 'tiktok'`)
      .get(state) as { ai_user_id: string; code_verifier: string } | undefined;
    if (!row) return reply.code(400).send({ error: "invalid state" });
    getDb().prepare(`DELETE FROM oauth_state WHERE state = ?`).run(state);

    const clientKey = process.env.TIKTOK_CLIENT_KEY!;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET ?? "";
    const redirectUri = `${process.env.PUBLIC_BASE_URL ?? "http://localhost:5174"}/oauth/tiktok/callback`;

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: row.code_verifier,
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
    const meJson = (await meRes.body.json()) as any;
    const user = meJson?.data?.user;
    const openId: string = user?.open_id ?? tokenJson.open_id;
    if (!openId) return reply.code(500).send({ error: "could not fetch TikTok profile", details: meJson });

    const accountId = nanoid();
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO accounts (id, ai_user_id, platform, handle, display_name, external_user_id, token_status)
         VALUES (?, ?, 'tiktok', ?, ?, ?, 'active')`
      )
      .run(accountId, row.ai_user_id, user?.display_name ?? openId, user?.display_name ?? null, openId);

    await setSecret(accountId, {
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      expires_at: Date.now() + (tokenJson.expires_in ?? 86400) * 1000,
      external_user_id: openId,
    });

    return reply.redirect("/?connected=tiktok");
  });
};
