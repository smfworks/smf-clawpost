import type { FastifyPluginAsync } from "fastify";
import { xOAuthRoutes } from "./x.js";
import { linkedinOAuthRoutes } from "./linkedin.js";
import { metaOAuthRoutes } from "./meta.js";

export const oauthRoutes: FastifyPluginAsync = async (app) => {
  await app.register(xOAuthRoutes, { prefix: "/x" });
  await app.register(linkedinOAuthRoutes, { prefix: "/linkedin" });
  await app.register(metaOAuthRoutes, { prefix: "/meta" });
  // TikTok routes follow same shape — see docs/OAUTH-SETUP.md
};
