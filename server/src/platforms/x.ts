import type { PublishContext, PublishResult } from "./index.js";
import { getSecret } from "../secrets.js";
import { request } from "undici";

interface XToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  external_user_id: string;
}

/**
 * Posts a tweet via X API v2 `POST /2/tweets`.
 * Requires Basic tier ($200/mo) or higher for write access at any volume.
 * Media upload (v1.1 endpoint) is intentionally TODO — handle text-only first.
 */
export async function publishX(ctx: PublishContext): Promise<PublishResult> {
  const token = await getSecret<XToken>(ctx.accountId);
  if (!token) return { ok: false, error: "no token in keychain for this X account" };

  if (ctx.mediaPaths.length > 0) {
    return { ok: false, error: "X media upload not implemented yet (text-only MVP)" };
  }

  const res = await request("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.access_token}`,
    },
    body: JSON.stringify({ text: ctx.body }),
  });

  const body = (await res.body.json()) as any;
  if (res.statusCode >= 200 && res.statusCode < 300 && body?.data?.id) {
    return { ok: true, externalPostId: body.data.id };
  }
  return { ok: false, error: `X API ${res.statusCode}: ${JSON.stringify(body)}` };
}
