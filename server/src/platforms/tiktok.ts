import type { PublishContext, PublishResult } from "./index.js";
import { getSecret } from "../secrets.js";
import { request } from "undici";

const API = "https://open.tiktokapis.com/v2";

interface TikTokToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  external_user_id: string;
}

/**
 * Publishes a video to TikTok via the Content Posting API.
 * TikTok has NO text-only posts — a video file is required.
 *
 * Full flow (Direct Post):
 *   1. POST /post/publish/video/init/   → returns { publish_id, upload_url }
 *   2. PUT the video bytes to upload_url (chunked)            ← see TODO(media)
 *   3. POST /post/publish/status/fetch/ → poll until PUBLISH_COMPLETE
 */
export async function publishTikTok(ctx: PublishContext): Promise<PublishResult> {
  const token = await getSecret<TikTokToken>(ctx.accountId);
  if (!token) return { ok: false, error: "no token in keychain for this TikTok account" };

  const videoPath = ctx.mediaPaths[0];
  if (!videoPath) {
    return { ok: false, error: "TikTok requires a video; use media pipeline (coming in next chunk)" };
  }

  // 1. Initialize the upload. We declare FILE_UPLOAD source so we receive an upload_url.
  const initRes = await request(`${API}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: ctx.body?.slice(0, 2200) ?? "",
        privacy_level: "SELF_ONLY",
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        // TODO(media): set real video_size, chunk_size, total_chunk_count from the
        // file on disk at videoPath before sending. Placeholder values below.
        video_size: 0,
        chunk_size: 0,
        total_chunk_count: 1,
      },
    }),
  });
  const initJson = (await initRes.body.json().catch(() => ({}))) as any;
  if (initRes.statusCode >= 300 || !initJson?.data?.publish_id) {
    return { ok: false, error: `TikTok init ${initRes.statusCode}: ${JSON.stringify(initJson)}` };
  }
  const publishId: string = initJson.data.publish_id;

  // 2. TODO(media): PUT the video bytes (from videoPath) to initJson.data.upload_url
  //    using Content-Range chunked uploads. Until implemented, we cannot complete a post.

  // 3. Status check (init + status wired; actual upload is the missing step).
  const statusRes = await request(`${API}/post/publish/status/fetch/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const statusJson = (await statusRes.body.json().catch(() => ({}))) as any;

  return {
    ok: false,
    error:
      "TikTok upload step not implemented (TODO(media)): init + status calls are wired, but the video byte upload (PUT to upload_url) is still a stub. publish_id=" +
      publishId +
      " status=" +
      JSON.stringify(statusJson?.data ?? statusJson),
  };
}
