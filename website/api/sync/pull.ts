/**
 * Sync Pull API - Client fetches server changes since timestamp
 * Returns chats, memories, and settings that have been updated
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, ensureAuthTables } from '../lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

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

  if (req.method !== 'GET') {
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
    const since = req.query.since as string || '1970-01-01T00:00:00.000Z';
    const now = new Date().toISOString();

    // Fetch updated chats
    const chatsResult = await db.execute({
      sql: `
        SELECT id, title, model, total_tokens, total_cost, working_directory, created_at, updated_at, deleted_at
        FROM cloud_chats
        WHERE user_id = ? AND updated_at > ?
        ORDER BY updated_at DESC
        LIMIT 100
      `,
      args: [user.id, since],
    });

    const chats = [];
    for (const row of chatsResult.rows) {
      // Fetch messages for each chat
      const messagesResult = await db.execute({
        sql: `
          SELECT id, role, content, tool_call_id, tool_name, timestamp
          FROM cloud_chat_messages
          WHERE chat_id = ?
          ORDER BY timestamp ASC
        `,
        args: [row.id],
      });

      chats.push({
        id: row.id,
        title: row.title,
        model: row.model,
        totalTokens: row.total_tokens,
        totalCost: row.total_cost,
        workingDirectory: row.working_directory,
        messages: messagesResult.rows.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          toolCallId: m.tool_call_id,
          toolName: m.tool_name,
          timestamp: m.timestamp,
        })),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deleted: !!row.deleted_at,
      });
    }

    // Fetch updated memories
    const memoriesResult = await db.execute({
      sql: `
        SELECT id, workspace_id, content, summary, type, tags, importance, is_pinned, metadata, created_at, updated_at, deleted_at
        FROM cloud_memories
        WHERE user_id = ? AND updated_at > ?
        ORDER BY updated_at DESC
        LIMIT 100
      `,
      args: [user.id, since],
    });

    const memories = memoriesResult.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      content: row.content,
      summary: row.summary,
      type: row.type,
      tags: row.tags ? JSON.parse(row.tags as string) : [],
      importance: row.importance,
      isPinned: !!row.is_pinned,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deleted: !!row.deleted_at,
    }));

    // Fetch settings
    const settingsResult = await db.execute({
      sql: `SELECT settings_json, synced_at FROM user_settings WHERE user_id = ? AND synced_at > ?`,
      args: [user.id, since],
    });

    const settings = settingsResult.rows.length > 0
      ? JSON.parse(settingsResult.rows[0].settings_json as string)
      : null;

    return res.status(200).json({
      success: true,
      data: {
        chats,
        memories,
        settings,
      },
      since,
      syncedAt: now,
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
