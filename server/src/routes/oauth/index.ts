import type { FastifyPluginAsync } from "fastify";
import { xOAuthRoutes } from "./x.js";
import { linkedinOAuthRoutes } from "./linkedin.js";
import { metaOAuthRoutes } from "./meta.js";
import { tiktokOAuthRoutes } from "./tiktok.js";

export const oauthRoutes: FastifyPluginAsync = async (app) => {
  await app.register(xOAuthRoutes, { prefix: "/x" });
  await app.register(linkedinOAuthRoutes, { prefix: "/linkedin" });
  await app.register(metaOAuthRoutes, { prefix: "/meta" });
  await app.register(tiktokOAuthRoutes, { prefix: "/tiktok" });
};
