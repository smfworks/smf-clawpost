import type { PublishContext, PublishResult } from "./index.js";
import { getSecret } from "../secrets.js";
import { request } from "undici";

const GRAPH = "https://graph.facebook.com/v21.0";

interface FacebookToken {
  access_token: string;
  external_user_id: string; // page id
  page_name?: string | null;
}

/**
 * Publishes a Facebook Page feed post via `POST /{page_id}/feed`.
 * Uses the stored Page access token. Photo/video upload is implemented in Chunk 4
 * (/{page_id}/photos and /{page_id}/videos).
 */
export async function publishFacebook(ctx: PublishContext): Promise<PublishResult> {
  const token = await getSecret<FacebookToken>(ctx.accountId);
  if (!token) return { ok: false, error: "no token in keychain for this Facebook account" };

  if (ctx.mediaPaths.length > 0) {
    // TODO(media): single image → POST /{page_id}/photos with `source` (multipart) or `url`.
    // Video → POST /{page_id}/videos. See Chunk 4.
    return { ok: false, error: "Facebook media upload not implemented yet (text-only first pass)" };
  }

  const url = new URL(`${GRAPH}/${token.external_user_id}/feed`);
  url.searchParams.set("message", ctx.body);
  url.searchParams.set("access_token", token.access_token);

  const res = await request(url.toString(), { method: "POST" });
  const json = (await res.body.json().catch(() => ({}))) as any;
  if (res.statusCode >= 200 && res.statusCode < 300 && json?.id) {
    return { ok: true, externalPostId: json.id };
  }
  return { ok: false, error: `Facebook API ${res.statusCode}: ${JSON.stringify(json)}` };
}
