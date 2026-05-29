import type { FastifyPluginAsync } from "fastify";
import { xOAuthRoutes } from "./x.js";

export const oauthRoutes: FastifyPluginAsync = async (app) => {
  await app.register(xOAuthRoutes, { prefix: "/x" });
  // LinkedIn, Facebook, Instagram, TikTok routes follow same shape — see docs/OAUTH-SETUP.md
};
