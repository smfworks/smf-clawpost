import type { PublishContext, PublishResult } from "./index.js";
import { getSecret } from "../secrets.js";
import { request } from "undici";

const GRAPH = "https://graph.facebook.com/v21.0";

interface InstagramToken {
  access_token: string; // page token works for IG publishing
  external_user_id: string; // ig business account id
  page_id?: string;
}

/**
 * Publishes to an Instagram Business account via the two-step container flow:
 *   1. POST /{ig_business_id}/media          → returns a creation_id (container)
 *   2. POST /{ig_business_id}/media_publish  → publishes the container
 *
 * Instagram REQUIRES media (image or video) and the image_url must be a PUBLIC,
 * internet-reachable URL — a local file path will not work. Text-only posts are
 * not supported by the IG API. See Chunk 4 notes about hosting/tunneling.
 */
export async function publishInstagram(ctx: PublishContext): Promise<PublishResult> {
  const token = await getSecret<InstagramToken>(ctx.accountId);
  if (!token) return { ok: false, error: "no token in keychain for this Instagram account" };

  if (ctx.mediaPaths.length === 0) {
    return {
      ok: false,
      error: "Instagram requires an image or video; media pipeline coming",
    };
  }

  // TODO(media): IG requires a PUBLIC image_url/video_url. Local paths in
  // ctx.mediaPaths must be exposed via a hosted CDN or tunnel first. Once a
  // public URL is available, set image_url below.
  const imageUrl = ctx.mediaPaths[0];
  if (!/^https?:\/\//i.test(imageUrl)) {
    return {
      ok: false,
      error:
        "Instagram requires a PUBLIC media URL (https://). Local file paths are not reachable by Meta — host the file or use a tunnel.",
    };
  }

  // 1. Create container
  const containerUrl = new URL(`${GRAPH}/${token.external_user_id}/media`);
  containerUrl.searchParams.set("image_url", imageUrl);
  if (ctx.body) containerUrl.searchParams.set("caption", ctx.body);
  containerUrl.searchParams.set("access_token", token.access_token);

  const containerRes = await request(containerUrl.toString(), { method: "POST" });
  const containerJson = (await containerRes.body.json().catch(() => ({}))) as any;
  if (containerRes.statusCode >= 300 || !containerJson?.id) {
    return { ok: false, error: `IG container ${containerRes.statusCode}: ${JSON.stringify(containerJson)}` };
  }

  // 2. Publish container
  const publishUrl = new URL(`${GRAPH}/${token.external_user_id}/media_publish`);
  publishUrl.searchParams.set("creation_id", containerJson.id);
  publishUrl.searchParams.set("access_token", token.access_token);

  const publishRes = await request(publishUrl.toString(), { method: "POST" });
  const publishJson = (await publishRes.body.json().catch(() => ({}))) as any;
  if (publishRes.statusCode >= 200 && publishRes.statusCode < 300 && publishJson?.id) {
    return { ok: true, externalPostId: publishJson.id };
  }
  return { ok: false, error: `IG publish ${publishRes.statusCode}: ${JSON.stringify(publishJson)}` };
}
