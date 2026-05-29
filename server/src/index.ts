import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { initDb } from "./db.js";
import { startScheduler } from "./scheduler.js";
import { aiUsersRoutes } from "./routes/ai-users.js";
import { accountsRoutes } from "./routes/accounts.js";
import { postsRoutes } from "./routes/posts.js";
import { mediaRoutes } from "./routes/media.js";
import { oauthRoutes } from "./routes/oauth/index.js";

const PORT = Number(process.env.PORT ?? 5174);
const HOST = process.env.HOST ?? "127.0.0.1";

async function main() {
  initDb();

  const app = Fastify({ logger: { level: "info" } });

  await app.register(cors, {
    origin: [`http://localhost:5173`, `http://localhost:${PORT}`, `http://${HOST}:${PORT}`],
    credentials: true,
  });

  await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } });

  app.get("/api/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(aiUsersRoutes, { prefix: "/api/ai-users" });
  await app.register(accountsRoutes, { prefix: "/api/accounts" });
  await app.register(postsRoutes, { prefix: "/api/posts" });
  await app.register(mediaRoutes, { prefix: "/api" });
  await app.register(oauthRoutes, { prefix: "/oauth" });

  startScheduler();

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Clawpost server listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
