#!/usr/bin/env node
/**
 * First-run setup helper. Idempotent.
 * - Ensures ./data exists
 * - Copies .env.example -> .env if missing
 * - Prints next-step instructions
 */
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(root, "data");
const envFile = resolve(root, ".env");
const envExample = resolve(root, ".env.example");

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
  console.log("✓ created ./data");
} else {
  console.log("· ./data already exists");
}

if (!existsSync(envFile)) {
  copyFileSync(envExample, envFile);
  console.log("✓ created .env from .env.example");
} else {
  console.log("· .env already exists, leaving it alone");
}

console.log("");
console.log("Next steps:");
console.log("  1. Edit .env — pick PORT, set SECRET_BACKEND, optionally set MASTER_KEY");
console.log("  2. Register OAuth apps per platform — see docs/OAUTH-SETUP.md");
console.log("  3. npm run dev");
console.log("  4. Open http://localhost:5173");
