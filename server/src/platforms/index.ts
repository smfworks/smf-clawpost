import type { Platform } from "@clawpost/shared";
import { getDb } from "../db.js";
import { nanoid } from "nanoid";
import { publishX } from "./x.js";
import { publishLinkedIn } from "./linkedin.js";
import { publishFacebook } from "./facebook.js";
import { publishInstagram } from "./instagram.js";
import { publishTikTok } from "./tiktok.js";

export interface PublishContext {
  variantId: string;
  accountId: string;
  platform: Platform;
  body: string;
  mediaPaths: string[];
}

export interface PublishResult {
  ok: boolean;
  externalPostId?: string;
  error?: string;
}

const PUBLISHERS: Record<Platform, (ctx: PublishContext) => Promise<PublishResult>> = {
  x: publishX,
  linkedin: publishLinkedIn,
  facebook: publishFacebook,
  instagram: publishInstagram,
  tiktok: publishTikTok,
};

export async function publishVariant(ctx: PublishContext): Promise<PublishResult> {
  const db = getDb();
  let result: PublishResult;
  try {
    result = await PUBLISHERS[ctx.platform](ctx);
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  db.prepare(
    `INSERT INTO post_attempts (id, variant_id, status, external_post_id, error_message)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    nanoid(),
    ctx.variantId,
    result.ok ? "ok" : "error",
    result.externalPostId ?? null,
    result.error ?? null
  );

  return result;
}
