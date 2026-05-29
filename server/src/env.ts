/**
 * Loads environment variables from the repo-root .env.
 *
 * Must be imported before any module that reads process.env at import time
 * (e.g. db.ts, secrets.ts). When run via `npm --workspace server`, the process
 * cwd is the server/ workspace, so the default `dotenv/config` (which loads
 * ./.env relative to cwd) never finds the root .env. Resolving the path
 * relative to this module works for both src (tsx) and dist (built) layouts,
 * since both server/src and server/dist sit two levels below the repo root.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../.env") });
