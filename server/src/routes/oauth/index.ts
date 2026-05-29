import type { FastifyPluginAsync } from "fastify";
import { xOAuthRoutes } from "./x.js";
import { linkedinOAuthRoutes } from "./linkedin.js";

export const oauthRoutes: FastifyPluginAsync = async (app) => {
  await app.register(xOAuthRoutes, { prefix: "/x" });
  await app.register(linkedinOAuthRoutes, { prefix: "/linkedin" });
  // Facebook, Instagram, TikTok routes follow same shape — see docs/OAUTH-SETUP.md
};
