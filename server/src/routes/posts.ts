import type { FastifyPluginAsync } from "fastify";
import { getDb } from "../db.js";
import { nanoid } from "nanoid";
import type { ComposeRequest } from "@clawpost/shared";

export const postsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { ai_user_id?: string; from?: string; to?: string } }>("/", async (req) => {
    const db = getDb();
    const filters: string[] = [];
    const params: any[] = [];
    if (req.query.ai_user_id) {
      filters.push("p.ai_user_id = ?");
      params.push(req.query.ai_user_id);
    }
    if (req.query.from) {
      filters.push("p.scheduled_for >= ?");
      params.push(req.query.from);
    }
    if (req.query.to) {
      filters.push("p.scheduled_for <= ?");
      params.push(req.query.to);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const posts = db
      .prepare(`SELECT p.* FROM posts p ${where} ORDER BY p.scheduled_for ASC`)
      .all(...params) as any[];

    const variantsStmt = db.prepare(`SELECT * FROM post_variants WHERE post_id = ?`);
    return posts.map((p) => ({
      ...p,
      variants: (variantsStmt.all(p.id) as any[]).map((v) => ({
        ...v,
        media_paths: JSON.parse(v.media_paths || "[]"),
      })),
    }));
  });

  app.post<{ Body: ComposeRequest }>("/", async (req, reply) => {
    const { ai_user_id, scheduled_for, variants } = req.body ?? ({} as ComposeRequest);
    if (!ai_user_id || !scheduled_for || !variants?.length) {
      reply.code(400);
      return { error: "ai_user_id, scheduled_for, and at least one variant required" };
    }
    const db = getDb();
    const postId = nanoid();
    const insertPost = db.prepare(
      `INSERT INTO posts (id, ai_user_id, scheduled_for, status) VALUES (?, ?, ?, 'scheduled')`
    );
    const insertVariant = db.prepare(
      `INSERT INTO post_variants (id, post_id, account_id, platform, body, media_paths)
       SELECT ?, ?, a.id, a.platform, ?, ? FROM accounts a WHERE a.id = ?`
    );
    const tx = db.transaction(() => {
      insertPost.run(postId, ai_user_id, scheduled_for);
      for (const v of variants) {
        insertVariant.run(nanoid(), postId, v.body, JSON.stringify(v.media_paths ?? []), v.account_id);
      }
    });
    tx();
    return { id: postId, status: "scheduled" };
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req) => {
    getDb().prepare(`DELETE FROM posts WHERE id = ?`).run(req.params.id);
    return { ok: true };
  });

  app.patch<{ Params: { id: string }; Body: { scheduled_for?: string; status?: string } }>(
    "/:id",
    async (req) => {
      const { scheduled_for, status } = req.body ?? {};
      const fields: string[] = [];
      const params: any[] = [];
      if (scheduled_for) {
        fields.push("scheduled_for = ?");
        params.push(scheduled_for);
      }
      if (status) {
        fields.push("status = ?");
        params.push(status);
      }
      if (!fields.length) return { ok: true };
      fields.push("updated_at = datetime('now')");
      params.push(req.params.id);
      getDb().prepare(`UPDATE posts SET ${fields.join(", ")} WHERE id = ?`).run(...params);
      return { ok: true };
    }
  );
};
