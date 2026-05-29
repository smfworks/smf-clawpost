import type { PublishContext, PublishResult } from "./index.js";
import { getSecret } from "../secrets.js";
import { request } from "undici";

interface LinkedInToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  external_user_id: string;
}

const UGC_URL = "https://api.linkedin.com/v2/ugcPosts";

/**
 * Publishes a LinkedIn share via the UGC Posts API (`POST /v2/ugcPosts`).
 * Text-only for the first pass; image/video upload is implemented in Chunk 4
 * via the asset register-upload flow (see `// TODO(media)` below).
 */
export async function publishLinkedIn(ctx: PublishContext): Promise<PublishResult> {
  const token = await getSecret<LinkedInToken>(ctx.accountId);
  if (!token) return { ok: false, error: "no token in keychain for this LinkedIn account" };

  if (ctx.mediaPaths.length > 0) {
    // TODO(media): implement assetRegisterUpload + PUT bytes + reference the
    // returned asset URN with shareMediaCategory 'IMAGE' | 'VIDEO'. See Chunk 4.
    return { ok: false, error: "LinkedIn media upload not implemented yet (text-only first pass)" };
  }

  const payload = {
    author: `urn:li:person:${token.external_user_id}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: ctx.body },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const res = await request(UGC_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.body.json().catch(() => ({}))) as any;
  if (res.statusCode === 201 && json?.id) {
    return { ok: true, externalPostId: json.id };
  }
  return { ok: false, error: `LinkedIn API ${res.statusCode}: ${JSON.stringify(json)}` };
}
