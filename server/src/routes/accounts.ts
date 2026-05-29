import type { FastifyPluginAsync } from "fastify";
import { getDb } from "../db.js";
import { deleteSecret } from "../secrets.js";

export const accountsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { ai_user_id?: string } }>("/", async (req) => {
    const db = getDb();
    if (req.query.ai_user_id) {
      return db.prepare(`SELECT * FROM accounts WHERE ai_user_id = ? ORDER BY platform, handle`).all(req.query.ai_user_id);
    }
    return db.prepare(`SELECT * FROM accounts ORDER BY platform, handle`).all();
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req) => {
    await deleteSecret(req.params.id);
    getDb().prepare(`DELETE FROM accounts WHERE id = ?`).run(req.params.id);
    return { ok: true };
  });
};
