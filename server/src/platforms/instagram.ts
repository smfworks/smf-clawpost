import type { PublishContext, PublishResult } from "./index.js";

export async function publishInstagram(_ctx: PublishContext): Promise<PublishResult> {
  return { ok: false, error: "Instagram publisher not implemented yet" };
}
