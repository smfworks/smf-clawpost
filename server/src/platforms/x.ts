import type { PublishContext, PublishResult } from "./index.js";
import { getSecret } from "../secrets.js";
import { request } from "undici";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

interface XToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  external_user_id: string;
}

const MEDIA_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
};

/**
 * Uploads a local media file to X via the v2 `POST /2/media/upload` simple
 * upload (single multipart request). Requires the `media.write` scope on the
 * connected token. Returns the media id to attach to a tweet.
 */
async function uploadMedia(accessToken: string, mediaPath: string): Promise<string> {
  const abs = resolve(mediaPath);
  const buf = await readFile(abs);
  const ext = extname(abs).toLowerCase();
  const mime = MEDIA_MIME[ext] ?? "application/octet-stream";
  const category = mime.startsWith("video") ? "tweet_video" : mime === "image/gif" ? "tweet_gif" : "tweet_image";

  const form = new FormData();
  form.append("media", new Blob([buf], { type: mime }), `upload${ext}`);
  form.append("media_category", category);

  const res = await fetch("https://api.x.com/2/media/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as any;
  const mediaId = json?.data?.id ?? json?.media_id_string ?? json?.id;
  if (!res.ok || !mediaId) {
    throw new Error(`media upload ${res.status}: ${JSON.stringify(json)}`);
  }
  return String(mediaId);
}

/**
 * Posts a tweet via X API v2 `POST /2/tweets`.
 * Requires Basic tier ($200/mo) or higher for write access at any volume.
 * Uploads any attached media first, then attaches the media ids to the tweet.
 */
export async function publishX(ctx: PublishContext): Promise<PublishResult> {
  const token = await getSecret<XToken>(ctx.accountId);
  if (!token) return { ok: false, error: "no token in keychain for this X account" };

  let mediaIds: string[] = [];
  if (ctx.mediaPaths.length > 0) {
    try {
      mediaIds = await Promise.all(ctx.mediaPaths.map((p) => uploadMedia(token.access_token, p)));
    } catch (err) {
      return { ok: false, error: `X media upload failed: ${(err as Error).message}` };
    }
  }

  const payload: Record<string, unknown> = { text: ctx.body };
  if (mediaIds.length > 0) payload.media = { media_ids: mediaIds };

  const res = await request("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await res.body.json()) as any;
  if (res.statusCode >= 200 && res.statusCode < 300 && body?.data?.id) {
    return { ok: true, externalPostId: body.data.id };
  }
  return { ok: false, error: `X API ${res.statusCode}: ${JSON.stringify(body)}` };
}
