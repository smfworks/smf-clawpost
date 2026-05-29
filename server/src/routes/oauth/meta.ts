/**
 * Meta (Facebook + Instagram) OAuth 2.0 — one app covers both.
 * Docs: https://developers.facebook.com/docs/facebook-login / Graph API v21.0
 *
 * Flow:
 *   GET /oauth/meta/start?ai_user_id=...&target=facebook|instagram → redirects to FB dialog
 *   GET /oauth/meta/callback?code&state                            → exchange, discover pages/IG, store accounts
 *
 * One row is inserted per Facebook Page (target=facebook) or per Page that has a
 * linked Instagram Business account (target=instagram). The Page access token is
 * what we store and use for publishing in BOTH cases — for IG the page token is
 * the credential used against the IG Business account id.
 *
 * NOTE: the `target` (facebook|instagram) is stashed in the oauth_state.code_verifier
 * column, which is otherwise unused for Meta (Meta uses no PKCE here).
 */
import type { FastifyPluginAsync } from "fastify";
import { getDb } from "../../db.js";
import { setSecret } from "../../secrets.js";
import { nanoid } from "nanoid";
import { request } from "undici";

const GRAPH = "https://graph.facebook.com/v21.0";
const AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth";
const TOKEN_URL = `${GRAPH}/oauth/access_token`;

const SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

type Target = "facebook" | "instagram";

export const metaOAuthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { ai_user_id: string; target?: Target } }>("/start", async (req, reply) => {
    const aiUserId = req.query.ai_user_id;
    const target: Target = req.query.target === "instagram" ? "instagram" : "facebook";
    const appId = process.env.META_APP_ID;
    if (!aiUserId) return reply.code(400).send({ error: "ai_user_id required" });
    if (!appId) return reply.code(500).send({ error: "META_APP_ID not configured in .env" });

    const state = nanoid();
    getDb()
      .prepare(`INSERT INTO oauth_state (state, ai_user_id, platform, code_verifier) VALUES (?, ?, 'meta', ?)`)
      .run(state, aiUserId, target);

    const redirectUri = `${process.env.PUBLIC_BASE_URL ?? "http://localhost:5174"}/oauth/meta/callback`;
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES);

    return reply.redirect(url.toString());
  });

  app.get<{ Querystring: { code: string; state: string } }>("/callback", async (req, reply) => {
    const { code, state } = req.query;
    const row = getDb()
      .prepare(`SELECT * FROM oauth_state WHERE state = ? AND platform = 'meta'`)
      .get(state) as { ai_user_id: string; code_verifier: string } | undefined;
    if (!row) return reply.code(400).send({ error: "invalid state" });
    getDb().prepare(`DELETE FROM oauth_state WHERE state = ?`).run(state);

    const target: Target = row.code_verifier === "instagram" ? "instagram" : "facebook";
    const appId = process.env.META_APP_ID!;
    const appSecret = process.env.META_APP_SECRET ?? "";
    const redirectUri = `${process.env.PUBLIC_BASE_URL ?? "http://localhost:5174"}/oauth/meta/callback`;

    // 1. Exchange code → short-lived user token
    const tokenUrl = new URL(TOKEN_URL);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenRes = await request(tokenUrl.toString());
    const tokenJson = (await tokenRes.body.json()) as any;
    if (tokenRes.statusCode >= 300 || !tokenJson.access_token) {
      return reply.code(500).send({ error: "token exchange failed", details: tokenJson });
    }

    // 2. Exchange short-lived → long-lived user token
    const llUrl = new URL(TOKEN_URL);
    llUrl.searchParams.set("grant_type", "fb_exchange_token");
    llUrl.searchParams.set("client_id", appId);
    llUrl.searchParams.set("client_secret", appSecret);
    llUrl.searchParams.set("fb_exchange_token", tokenJson.access_token);
    const llRes = await request(llUrl.toString());
    const llJson = (await llRes.body.json()) as any;
    const userToken: string = llJson.access_token ?? tokenJson.access_token;

    // 3. List Pages (each entry carries its own Page access token)
    const pagesRes = await request(`${GRAPH}/me/accounts?access_token=${encodeURIComponent(userToken)}`);
    const pagesJson = (await pagesRes.body.json()) as any;
    const pages: any[] = pagesJson?.data ?? [];
    if (pages.length === 0) {
      return reply.code(400).send({ error: "no Facebook Pages found for this account", details: pagesJson });
    }

    const db = getDb();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO accounts (id, ai_user_id, platform, handle, display_name, external_user_id, token_status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`
    );

    let created = 0;
    for (const page of pages) {
      const pageId: string = page.id;
      const pageToken: string = page.access_token;

      // Discover Page details + linked IG Business account
      const detailRes = await request(
        `${GRAPH}/${pageId}?fields=instagram_business_account,name,username&access_token=${encodeURIComponent(pageToken)}`
      );
      const detail = (await detailRes.body.json()) as any;

      if (target === "facebook") {
        const accountId = nanoid();
        const handle = detail.username || detail.name || pageId;
        insert.run(accountId, row.ai_user_id, "facebook", handle, detail.name ?? null, pageId);
        await setSecret(accountId, {
          access_token: pageToken,
          external_user_id: pageId,
          page_name: detail.name ?? null,
        });
        created++;
      } else {
        const ig = detail.instagram_business_account;
        if (!ig?.id) continue;
        // Fetch IG username for a friendly handle
        const igRes = await request(
          `${GRAPH}/${ig.id}?fields=username&access_token=${encodeURIComponent(pageToken)}`
        );
        const igJson = (await igRes.body.json()) as any;
        const accountId = nanoid();
        insert.run(accountId, row.ai_user_id, "instagram", igJson.username ?? ig.id, detail.name ?? null, ig.id);
        await setSecret(accountId, {
          access_token: pageToken,
          external_user_id: ig.id,
          page_id: pageId,
        });
        created++;
      }
    }

    if (created === 0 && target === "instagram") {
      return reply
        .code(400)
        .send({ error: "no Instagram Business account linked to any of your Pages" });
    }

    return reply.redirect(`${process.env.WEB_BASE_URL ?? "http://localhost:5173"}/?connected=${target}`);
  });
};
