import type { PublishContext, PublishResult } from "./index.js";
import { getSecret } from "../secrets.js";
import { request } from "undici";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

interface LinkedInToken {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  external_user_id: string;
}

const UGC_URL = "https://api.linkedin.com/v2/ugcPosts";
const REGISTER_URL = "https://api.linkedin.com/v2/assets?action=registerUpload";

function isVideo(p: string): boolean {
  return [".mp4", ".mov", ".webm"].includes(extname(p).toLowerCase());
}

/**
 * Registers and uploads a single media asset, returning its asset URN.
 * Flow: registerUpload → PUT bytes to the returned uploadUrl → reference urn:li:digitalmediaAsset.
 */
async function uploadAsset(
  token: LinkedInToken,
  localPath: string
): Promise<{ asset: string } | { error: string }> {
  const recipe = isVideo(localPath)
    ? "urn:li:digitalmediaRecipe:feedshare-video"
    : "urn:li:digitalmediaRecipe:feedshare-image";

  const regRes = await request(REGISTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: [recipe],
        owner: `urn:li:person:${token.external_user_id}`,
        serviceRelationships: [
          { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
        ],
      },
    }),
  });
  const regJson = (await regRes.body.json().catch(() => ({}))) as any;
  const uploadUrl =
    regJson?.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]
      ?.uploadUrl;
  const asset: string | undefined = regJson?.value?.asset;
  if (!uploadUrl || !asset) {
    return { error: `LinkedIn registerUpload ${regRes.statusCode}: ${JSON.stringify(regJson)}` };
  }

  const bytes = await readFile(localPath);
  const putRes = await request(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token.access_token}` },
    body: bytes,
  });
  if (putRes.statusCode >= 300) {
    return { error: `LinkedIn asset upload PUT ${putRes.statusCode}` };
  }
  return { asset };
}

/**
 * Publishes a LinkedIn share via the UGC Posts API (`POST /v2/ugcPosts`).
 * Supports text-only and a single image/video via the asset register-upload flow.
 */
export async function publishLinkedIn(ctx: PublishContext): Promise<PublishResult> {
  const token = await getSecret<LinkedInToken>(ctx.accountId);
  if (!token) return { ok: false, error: "no token in keychain for this LinkedIn account" };

  let shareMediaCategory: "NONE" | "IMAGE" | "VIDEO" = "NONE";
  let media: any[] | undefined;

  if (ctx.mediaPaths.length > 0) {
    const localPath = ctx.mediaPaths[0];
    if (/^https?:\/\//i.test(localPath)) {
      return { ok: false, error: "LinkedIn media must be a local file path (got a URL)" };
    }
    const uploaded = await uploadAsset(token, localPath);
    if ("error" in uploaded) return { ok: false, error: uploaded.error };
    shareMediaCategory = isVideo(localPath) ? "VIDEO" : "IMAGE";
    media = [{ status: "READY", media: uploaded.asset }];
    // TODO(media): LinkedIn supports multiple media; only the first asset is attached here.
  }

  const shareContent: any = {
    shareCommentary: { text: ctx.body },
    shareMediaCategory,
  };
  if (media) shareContent.media = media;

  const payload = {
    author: `urn:li:person:${token.external_user_id}`,
    lifecycleState: "PUBLISHED",
    specificContent: { "com.linkedin.ugc.ShareContent": shareContent },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
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
