/**
 * Sync Push API - Client pushes local changes to server
 * Handles chats, memories, and settings sync
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, ensureAuthTables } from '../lib/db';
import crypto from 'crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface SyncPayload {
  chats?: Array<{
    id: string;
    title: string;
    model: string;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp: number;
      toolCallId?: string;
      toolName?: string;
    }>;
    totalTokens?: number;
    totalCost?: number;
    workingDirectory?: string;
    createdAt: number;
    updatedAt: number;
    deleted?: boolean;
  }>;
  memories?: Array<{
    id: string;
    content: string;
    summary?: string;
    type: string;
    workspaceId?: string;
    tags?: string[];
    importance?: number;
    isPinned?: boolean;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    deleted?: boolean;
  }>;
  settings?: Record<string, unknown>;
  lastSyncedAt?: string;
}

async function getUserFromToken(token: string): Promise<{ id: string; plan: string } | null> {
  try {
    await ensureAuthTables();
    const db = getDb();

    const sessionResult = await db.execute({
      sql: `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`,
      args: [token],
    });

    if (sessionResult.rows.length === 0) return null;

    const userId = sessionResult.rows[0].user_id as string;

    const subResult = await db.execute({
      sql: `SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active'`,
      args: [userId],
    });

    const plan = (subResult.rows[0]?.plan as string) || 'free';

    return { id: userId, plan };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await getUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Only Pro/Team users can sync
  if (user.plan === 'free') {
    return res.status(403).json({ error: 'Sync requires Pro or Team subscription' });
  }

  await ensureAuthTables();
  const db = getDb();

  try {
    const payload = req.body as SyncPayload;
    const now = new Date().toISOString();
    const results = { chats: 0, memories: 0, settings: false };

    // Sync chats
    if (payload.chats && Array.isArray(payload.chats)) {
      for (const chat of payload.chats) {
        if (chat.deleted) {
          // Soft delete
          await db.execute({
            sql: `UPDATE cloud_chats SET deleted_at = ? WHERE id = ? AND user_id = ?`,
            args: [now, chat.id, user.id],
          });
        } else {
          // Upsert chat
          await db.execute({
            sql: `
              INSERT INTO cloud_chats (id, user_id, title, model, total_tokens, total_cost, working_directory, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                model = excluded.model,
                total_tokens = excluded.total_tokens,
                total_cost = excluded.total_cost,
                working_directory = excluded.working_directory,
                updated_at = excluded.updated_at
            `,
            args: [
              chat.id,
              user.id,
              chat.title,
              chat.model || '',
              chat.totalTokens || 0,
              chat.totalCost || 0,
              chat.workingDirectory || null,
              new Date(chat.createdAt).toISOString(),
              new Date(chat.updatedAt).toISOString(),
            ],
          });

          // Delete existing messages and re-insert
          await db.execute({
            sql: `DELETE FROM cloud_chat_messages WHERE chat_id = ?`,
            args: [chat.id],
          });

          for (const msg of chat.messages || []) {
            await db.execute({
              sql: `
                INSERT INTO cloud_chat_messages (id, chat_id, role, content, tool_call_id, tool_name, timestamp, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `,
              args: [
                msg.id || crypto.randomUUID(),
                chat.id,
                msg.role,
                msg.content,
                msg.toolCallId || null,
                msg.toolName || null,
                msg.timestamp,
                now,
              ],
            });
          }
        }
        results.chats++;
      }
    }

    // Sync memories
    if (payload.memories && Array.isArray(payload.memories)) {
      for (const memory of payload.memories) {
        if (memory.deleted) {
          await db.execute({
            sql: `UPDATE cloud_memories SET deleted_at = ? WHERE id = ? AND user_id = ?`,
            args: [now, memory.id, user.id],
          });
        } else {
          await db.execute({
            sql: `
              INSERT INTO cloud_memories (id, user_id, workspace_id, content, summary, type, tags, importance, is_pinned, metadata, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                content = excluded.content,
                summary = excluded.summary,
                type = excluded.type,
                tags = excluded.tags,
                importance = excluded.importance,
                is_pinned = excluded.is_pinned,
                metadata = excluded.metadata,
                updated_at = excluded.updated_at
            `,
            args: [
              memory.id,
              user.id,
              memory.workspaceId || null,
              memory.content,
              memory.summary || null,
              memory.type || 'user',
              JSON.stringify(memory.tags || []),
              memory.importance || 0.5,
              memory.isPinned ? 1 : 0,
              memory.metadata ? JSON.stringify(memory.metadata) : null,
              memory.createdAt,
              memory.updatedAt,
            ],
          });
        }
        results.memories++;
      }
    }

    // Sync settings
    if (payload.settings) {
      await db.execute({
        sql: `
          INSERT INTO user_settings (id, user_id, settings_json, synced_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            settings_json = excluded.settings_json,
            synced_at = excluded.synced_at
        `,
        args: [
          crypto.randomUUID(),
          user.id,
          JSON.stringify(payload.settings),
          now,
        ],
      });
      results.settings = true;
    }

    // Update sync metadata
    await db.execute({
      sql: `
        INSERT INTO sync_metadata (id, user_id, entity_type, entity_id, last_synced_at, server_version)
        VALUES (?, ?, 'all', 'all', ?, 1)
        ON CONFLICT(user_id, entity_type, entity_id) DO UPDATE SET
          last_synced_at = excluded.last_synced_at,
          server_version = server_version + 1
      `,
      args: [crypto.randomUUID(), user.id, now],
    });

    return res.status(200).json({
      success: true,
      synced: results,
      syncedAt: now,
    });
  } catch (error) {
    console.error('Sync push error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
