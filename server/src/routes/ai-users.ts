import type { FastifyPluginAsync } from "fastify";
import { getDb } from "../db.js";
import { nanoid } from "nanoid";
import { createHash, randomBytes } from "node:crypto";

export const aiUsersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => {
    const rows = getDb().prepare(`SELECT id, display_name, avatar_url, created_at FROM ai_users ORDER BY created_at ASC`).all();
    return rows;
  });

  app.post<{ Body: { display_name: string; avatar_url?: string | null } }>("/", async (req, reply) => {
    const { display_name, avatar_url } = req.body ?? {};
    if (!display_name) {
      reply.code(400);
      return { error: "display_name required" };
    }
    const id = nanoid();
    const apiKey = randomBytes(24).toString("hex");
    const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
    getDb()
      .prepare(`INSERT INTO ai_users (id, display_name, avatar_url, api_key_hash) VALUES (?, ?, ?, ?)`)
      .run(id, display_name, avatar_url ?? null, apiKeyHash);
    return { id, display_name, api_key: apiKey, note: "store api_key now — it will not be shown again" };
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req) => {
    getDb().prepare(`DELETE FROM ai_users WHERE id = ?`).run(req.params.id);
    return { ok: true };
  });
};
