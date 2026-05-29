import type { PublishContext, PublishResult } from "./index.js";

export async function publishLinkedIn(_ctx: PublishContext): Promise<PublishResult> {
  return { ok: false, error: "LinkedIn publisher not implemented yet" };
}
