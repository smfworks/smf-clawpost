import cron from "node-cron";
import { getDb } from "./db.js";
import { publishVariant } from "./platforms/index.js";

/**
 * Runs every minute. Finds posts whose scheduled_for has passed and status is 'scheduled',
 * locks them to 'publishing', publishes each variant, and records results.
 */
export function startScheduler() {
  cron.schedule("* * * * *", () => {
    void tick().catch((err) => console.error("[scheduler] tick failed", err));
  });
  console.log("[scheduler] started, ticking every minute");
}

async function tick() {
  const db = getDb();
  const ripe = db
    .prepare(
      `SELECT id FROM posts
       WHERE status = 'scheduled' AND scheduled_for <= datetime('now')
       ORDER BY scheduled_for ASC
       LIMIT 10`
    )
    .all() as { id: string }[];

  if (ripe.length === 0) return;

  const lock = db.prepare(`UPDATE posts SET status = 'publishing', updated_at = datetime('now') WHERE id = ? AND status = 'scheduled'`);
  const finish = db.prepare(`UPDATE posts SET status = ?, updated_at = datetime('now') WHERE id = ?`);
  const variantsStmt = db.prepare(`SELECT * FROM post_variants WHERE post_id = ?`);

  for (const { id: postId } of ripe) {
    const res = lock.run(postId);
    if (res.changes === 0) continue;

    const variants = variantsStmt.all(postId) as Array<{
      id: string;
      account_id: string;
      platform: string;
      body: string;
      media_paths: string;
    }>;

    let anyFail = false;
    for (const v of variants) {
      const result = await publishVariant({
        variantId: v.id,
        accountId: v.account_id,
        platform: v.platform as any,
        body: v.body,
        mediaPaths: JSON.parse(v.media_paths || "[]"),
      });
      if (!result.ok) anyFail = true;
    }

    finish.run(anyFail ? "failed" : "published", postId);
  }
}
