/**
 * Chat list and create API
 * GET - List user's chats
 * POST - Create new chat
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, ensureAuthTables } from '../lib/db';
import crypto from 'crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function getUserFromToken(token: string): Promise<string | null> {
  try {
    await ensureAuthTables();
    const db = getDb();

    const result = await db.execute({
      sql: `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`,
      args: [token],
    });

    return result.rows.length > 0 ? (result.rows[0].user_id as string) : null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Require authentication
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = await getUserFromToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  await ensureAuthTables();
  const db = getDb();

  try {
    // GET - List chats
    if (req.method === 'GET') {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await db.execute({
        sql: `
          SELECT
            c.id, c.title, c.model, c.total_tokens, c.total_cost,
            c.working_directory, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM cloud_chat_messages WHERE chat_id = c.id) as message_count
          FROM cloud_chats c
          WHERE c.user_id = ? AND c.deleted_at IS NULL
          ORDER BY c.updated_at DESC
          LIMIT ? OFFSET ?
        `,
        args: [userId, limit, offset],
      });

      const chats = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        model: row.model,
        totalTokens: row.total_tokens,
        totalCost: row.total_cost,
        workingDirectory: row.working_directory,
        messageCount: row.message_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return res.status(200).json({ success: true, chats });
    }

    // POST - Create chat
    if (req.method === 'POST') {
      const { id, title, model, messages, workingDirectory } = req.body;

      const chatId = id || crypto.randomUUID();
      const now = new Date().toISOString();

      // Insert chat
      await db.execute({
        sql: `
          INSERT INTO cloud_chats (id, user_id, title, model, working_directory, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [chatId, userId, title || 'New Chat', model || '', workingDirectory || null, now, now],
      });

      // Insert messages if provided
      if (messages && Array.isArray(messages)) {
        for (const msg of messages) {
          await db.execute({
            sql: `
              INSERT INTO cloud_chat_messages (id, chat_id, role, content, tool_call_id, tool_name, timestamp, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              msg.id || crypto.randomUUID(),
              chatId,
              msg.role,
              msg.content,
              msg.toolCallId || null,
              msg.toolName || null,
              msg.timestamp || Date.now(),
              now,
            ],
          });
        }
      }

      return res.status(201).json({
        success: true,
        chat: { id: chatId, title: title || 'New Chat', model, createdAt: now, updatedAt: now },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Chats API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
