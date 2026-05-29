import type { PublishContext, PublishResult } from "./index.js";
import { getSecret } from "../secrets.js";
import { request } from "undici";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

const GRAPH = "https://graph.facebook.com/v21.0";

interface FacebookToken {
  access_token: string;
  external_user_id: string; // page id
  page_name?: string | null;
}

function isVideo(p: string): boolean {
  return [".mp4", ".mov", ".webm"].includes(extname(p).toLowerCase());
}

/**
 * Publishes a Facebook Page post via `POST /{page_id}/feed`.
 * With media, posts a single photo (/{page_id}/photos) or video (/{page_id}/videos).
 * A media path may be a local file (multipart upload) or a public https URL.
 */
export async function publishFacebook(ctx: PublishContext): Promise<PublishResult> {
  const token = await getSecret<FacebookToken>(ctx.accountId);
  if (!token) return { ok: false, error: "no token in keychain for this Facebook account" };

  if (ctx.mediaPaths.length > 0) {
    const mediaPath = ctx.mediaPaths[0];
    const video = isVideo(mediaPath);
    const edge = video ? "videos" : "photos";
    const url = new URL(`${GRAPH}/${token.external_user_id}/${edge}`);
    url.searchParams.set("access_token", token.access_token);

    if (/^https?:\/\//i.test(mediaPath)) {
      // Public URL: photos accept `url`, videos accept `file_url`.
      url.searchParams.set(video ? "file_url" : "url", mediaPath);
      if (ctx.body) url.searchParams.set(video ? "description" : "message", ctx.body);
      const res = await request(url.toString(), { method: "POST" });
      const json = (await res.body.json().catch(() => ({}))) as any;
      if (res.statusCode >= 200 && res.statusCode < 300 && (json?.id || json?.post_id)) {
        return { ok: true, externalPostId: json.post_id ?? json.id };
      }
      return { ok: false, error: `Facebook media API ${res.statusCode}: ${JSON.stringify(json)}` };
    }

    // Local file: multipart upload via `source`.
    const bytes = await readFile(mediaPath);
    const form = new FormData();
    form.set("source", new Blob([bytes]), basename(mediaPath));
    if (ctx.body) form.set(video ? "description" : "message", ctx.body);
    const res = await request(url.toString(), { method: "POST", body: form });
    const json = (await res.body.json().catch(() => ({}))) as any;
    if (res.statusCode >= 200 && res.statusCode < 300 && (json?.id || json?.post_id)) {
      return { ok: true, externalPostId: json.post_id ?? json.id };
    }
    return { ok: false, error: `Facebook media API ${res.statusCode}: ${JSON.stringify(json)}` };
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
