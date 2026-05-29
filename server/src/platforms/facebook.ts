import type { PublishContext, PublishResult } from "./index.js";

export async function publishFacebook(_ctx: PublishContext): Promise<PublishResult> {
  return { ok: false, error: "Facebook publisher not implemented yet" };
}
