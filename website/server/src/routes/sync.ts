/**
 * Sync routes for bidirectional data sync
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../lib/db';
import { requireAuth, AuthenticatedRequest } from '../lib/auth';

export const syncRouter = Router();

// Require auth for all sync routes
syncRouter.use(requireAuth);

interface SyncEntity {
  type: 'chat' | 'memory' | 'settings';
  id: string;
  data: any;
  updatedAt: string;
  clientVersion: number;
}

// Push local changes to server
syncRouter.post('/push', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { entities } = req.body as { entities: SyncEntity[] };

    if (!Array.isArray(entities)) {
      res.status(400).json({ error: 'Entities array is required' });
      return;
    }

    const db = getDb();
    const results: { id: string; success: boolean; serverVersion?: number; error?: string }[] = [];

    for (const entity of entities) {
      try {
        // Get current server version
        const metaResult = await db.execute({
          sql: `SELECT server_version FROM sync_metadata
                WHERE user_id = ? AND entity_type = ? AND entity_id = ?`,
          args: [req.user!.id, entity.type, entity.id],
        });

        const serverVersion = (metaResult.rows[0]?.server_version as number) || 0;

        // Simple last-write-wins conflict resolution
        // If client version is newer or equal, accept the change
        if (entity.clientVersion >= serverVersion) {
          const newServerVersion = serverVersion + 1;

          // Apply the change based on entity type
          if (entity.type === 'chat') {
            await syncChat(db, req.user!.id, entity.id, entity.data);
          } else if (entity.type === 'memory') {
            await syncMemory(db, req.user!.id, entity.id, entity.data);
          } else if (entity.type === 'settings') {
            await syncSettings(db, req.user!.id, entity.data);
          }

          // Update sync metadata
          await db.execute({
            sql: `INSERT INTO sync_metadata (id, user_id, entity_type, entity_id, last_synced_at, client_version, server_version)
                  VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
                  ON CONFLICT(user_id, entity_type, entity_id)
                  DO UPDATE SET last_synced_at = datetime('now'), client_version = ?, server_version = ?`,
            args: [
              uuidv4(), req.user!.id, entity.type, entity.id,
              entity.clientVersion, newServerVersion,
              entity.clientVersion, newServerVersion,
            ],
          });

          results.push({ id: entity.id, success: true, serverVersion: newServerVersion });
        } else {
          // Client has stale data, reject
          results.push({
            id: entity.id,
            success: false,
            serverVersion,
            error: 'Conflict: server has newer version',
          });
        }
      } catch (error) {
        results.push({
          id: entity.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Sync push error:', error);
    res.status(500).json({ error: 'Failed to push changes' });
  }
});

// Pull server changes since timestamp
syncRouter.post('/pull', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { since, types = ['chat', 'memory', 'settings'] } = req.body;
    const db = getDb();

    const changes: { type: string; id: string; data: any; serverVersion: number; updatedAt: string }[] = [];

    // Pull chats
    if (types.includes('chat')) {
      let sql = `SELECT c.*, GROUP_CONCAT(m.id) as message_ids
                 FROM cloud_chats c
                 LEFT JOIN cloud_chat_messages m ON m.chat_id = c.id
                 WHERE c.user_id = ?`;
      const args: any[] = [req.user!.id];

      if (since) {
        sql += ' AND c.updated_at > ?';
        args.push(since);
      }

      sql += ' GROUP BY c.id ORDER BY c.updated_at DESC';

      const chatsResult = await db.execute({ sql, args });

      for (const chat of chatsResult.rows) {
        // Get messages for this chat
        const messagesResult = await db.execute({
          sql: `SELECT * FROM cloud_chat_messages WHERE chat_id = ? ORDER BY timestamp ASC`,
          args: [chat.id],
        });

        // Get server version
        const metaResult = await db.execute({
          sql: `SELECT server_version FROM sync_metadata WHERE user_id = ? AND entity_type = 'chat' AND entity_id = ?`,
          args: [req.user!.id, chat.id],
        });

        changes.push({
          type: 'chat',
          id: chat.id as string,
          data: {
            ...chat,
            messages: messagesResult.rows,
          },
          serverVersion: (metaResult.rows[0]?.server_version as number) || 0,
          updatedAt: chat.updated_at as string,
        });
      }
    }

    // Pull memories
    if (types.includes('memory')) {
      let sql = `SELECT * FROM cloud_memories WHERE user_id = ?`;
      const args: any[] = [req.user!.id];

      if (since) {
        sql += ' AND updated_at > ?';
        args.push(since);
      }

      sql += ' ORDER BY updated_at DESC';

      const memoriesResult = await db.execute({ sql, args });

      for (const memory of memoriesResult.rows) {
        const metaResult = await db.execute({
          sql: `SELECT server_version FROM sync_metadata WHERE user_id = ? AND entity_type = 'memory' AND entity_id = ?`,
          args: [req.user!.id, memory.id],
        });

        changes.push({
          type: 'memory',
          id: memory.id as string,
          data: memory,
          serverVersion: (metaResult.rows[0]?.server_version as number) || 0,
          updatedAt: memory.updated_at as string,
        });
      }
    }

    // Pull settings
    if (types.includes('settings')) {
      const settingsResult = await db.execute({
        sql: `SELECT * FROM user_settings WHERE user_id = ?`,
        args: [req.user!.id],
      });

      if (settingsResult.rows.length > 0) {
        const settings = settingsResult.rows[0];
        const metaResult = await db.execute({
          sql: `SELECT server_version FROM sync_metadata WHERE user_id = ? AND entity_type = 'settings' AND entity_id = 'user_settings'`,
          args: [req.user!.id],
        });

        changes.push({
          type: 'settings',
          id: 'user_settings',
          data: JSON.parse(settings.settings_json as string),
          serverVersion: (metaResult.rows[0]?.server_version as number) || 0,
          updatedAt: settings.synced_at as string,
        });
      }
    }

    res.json({
      changes,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    res.status(500).json({ error: 'Failed to pull changes' });
  }
});

// Helper: Sync a chat
async function syncChat(db: any, userId: string, chatId: string, data: any): Promise<void> {
  const { title, model, total_tokens, total_cost, messages, deleted_at } = data;

  // Upsert chat
  await db.execute({
    sql: `INSERT INTO cloud_chats (id, user_id, title, model, total_tokens, total_cost, deleted_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            title = ?, model = ?, total_tokens = ?, total_cost = ?, deleted_at = ?, updated_at = datetime('now')`,
    args: [
      chatId, userId, title || 'Untitled', model, total_tokens || 0, total_cost || 0, deleted_at || null,
      title || 'Untitled', model, total_tokens || 0, total_cost || 0, deleted_at || null,
    ],
  });

  // Sync messages if provided
  if (messages && Array.isArray(messages)) {
    for (const msg of messages) {
      await db.execute({
        sql: `INSERT INTO cloud_chat_messages (id, chat_id, role, content, tool_call_id, tool_name, timestamp)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                role = ?, content = ?, tool_call_id = ?, tool_name = ?, timestamp = ?`,
        args: [
          msg.id, chatId, msg.role, msg.content, msg.tool_call_id || null, msg.tool_name || null, msg.timestamp,
          msg.role, msg.content, msg.tool_call_id || null, msg.tool_name || null, msg.timestamp,
        ],
      });
    }
  }
}

// Helper: Sync a memory
async function syncMemory(db: any, userId: string, memoryId: string, data: any): Promise<void> {
  const { workspace_id, content, summary, type, tags, importance, is_pinned, metadata, deleted_at } = data;

  await db.execute({
    sql: `INSERT INTO cloud_memories (id, user_id, workspace_id, content, summary, type, tags, importance, is_pinned, metadata, deleted_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            workspace_id = ?, content = ?, summary = ?, type = ?, tags = ?, importance = ?, is_pinned = ?, metadata = ?, deleted_at = ?, updated_at = datetime('now')`,
    args: [
      memoryId, userId, workspace_id || null, content, summary || null, type || 'user',
      tags ? JSON.stringify(tags) : null, importance ?? 0.5, is_pinned ? 1 : 0,
      metadata ? JSON.stringify(metadata) : null, deleted_at || null,
      workspace_id || null, content, summary || null, type || 'user',
      tags ? JSON.stringify(tags) : null, importance ?? 0.5, is_pinned ? 1 : 0,
      metadata ? JSON.stringify(metadata) : null, deleted_at || null,
    ],
  });
}

// Helper: Sync settings
async function syncSettings(db: any, userId: string, data: any): Promise<void> {
  await db.execute({
    sql: `INSERT INTO user_settings (id, user_id, settings_json, synced_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            settings_json = ?, synced_at = datetime('now')`,
    args: [uuidv4(), userId, JSON.stringify(data), JSON.stringify(data)],
  });
}
