/**
 * Turso database client for VPS server
 */

import { createClient, Client } from '@libsql/client';

let db: Client | null = null;
let tablesEnsured = false;

export function getDb(): Client {
  const url = process.env.TURSO_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('TURSO_URL and TURSO_AUTH_TOKEN environment variables are required');
  }

  if (!db) {
    const dbUrl = url.startsWith('libsql://')
      ? url
      : `libsql://${url.replace(/^https:\/\//, '')}`;

    db = createClient({
      url: dbUrl,
      authToken,
    });
  }

  return db;
}

export async function ensureAuthTables(): Promise<void> {
  if (tablesEnsured) return;

  const client = getDb();

  // Users table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Subscriptions table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan TEXT DEFAULT 'free',
      status TEXT DEFAULT 'active',
      lemon_customer_id TEXT,
      lemon_subscription_id TEXT,
      current_period_end TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Sessions table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Cloud-synced chats
  await client.execute(`
    CREATE TABLE IF NOT EXISTS cloud_chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      model TEXT,
      total_tokens INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      working_directory TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Chat messages
  await client.execute(`
    CREATE TABLE IF NOT EXISTS cloud_chat_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_call_id TEXT,
      tool_name TEXT,
      timestamp INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES cloud_chats(id) ON DELETE CASCADE
    )
  `);

  // Cloud-synced memories
  await client.execute(`
    CREATE TABLE IF NOT EXISTS cloud_memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      workspace_id TEXT,
      content TEXT NOT NULL,
      summary TEXT,
      type TEXT DEFAULT 'user',
      tags TEXT,
      importance REAL DEFAULT 0.5,
      access_count INTEGER DEFAULT 0,
      last_accessed_at TEXT,
      is_pinned INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Rate limiting
  await client.execute(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      identifier_type TEXT NOT NULL,
      message_count INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(identifier, date)
    )
  `);

  // Sync metadata
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      last_synced_at TEXT NOT NULL,
      client_version INTEGER DEFAULT 0,
      server_version INTEGER DEFAULT 0,
      UNIQUE(user_id, entity_type, entity_id)
    )
  `);

  // User settings
  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      settings_json TEXT NOT NULL,
      synced_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create indexes
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_cloud_chats_user ON cloud_chats(user_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_cloud_chat_messages_chat ON cloud_chat_messages(chat_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_cloud_memories_user ON cloud_memories(user_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(identifier, date)`);

  tablesEnsured = true;
}
