import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DB_PATH = resolve(process.env.DATABASE_PATH ?? "./data/clawpost.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) throw new Error("Database not initialized — call initDb() first");
  return _db;
}

export function initDb(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  applySchema(_db);
  return _db;
}

function applySchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      api_key_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      ai_user_id TEXT NOT NULL REFERENCES ai_users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      handle TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      external_user_id TEXT NOT NULL,
      connected_at TEXT NOT NULL DEFAULT (datetime('now')),
      token_status TEXT NOT NULL DEFAULT 'active',
      UNIQUE(ai_user_id, platform, external_user_id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      ai_user_id TEXT NOT NULL REFERENCES ai_users(id) ON DELETE CASCADE,
      scheduled_for TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_posts_status_time ON posts(status, scheduled_for);

    CREATE TABLE IF NOT EXISTS post_variants (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      body TEXT NOT NULL,
      media_paths TEXT NOT NULL DEFAULT '[]',
      reply_to_external_id TEXT
    );

    CREATE TABLE IF NOT EXISTS post_attempts (
      id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
      attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL,
      external_post_id TEXT,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS oauth_state (
      state TEXT PRIMARY KEY,
      ai_user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      code_verifier TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
