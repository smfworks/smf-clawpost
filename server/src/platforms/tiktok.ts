import type { PublishContext, PublishResult } from "./index.js";

export async function publishTikTok(_ctx: PublishContext): Promise<PublishResult> {
  return { ok: false, error: "TikTok publisher not implemented yet" };
}
