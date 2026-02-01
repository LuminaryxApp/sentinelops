/**
 * Chats CRUD routes
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../lib/db';
import { requireAuth, AuthenticatedRequest } from '../lib/auth';

export const chatsRouter = Router();

// Require auth for all chat routes
chatsRouter.use(requireAuth);

// List chats
chatsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT id, title, model, total_tokens, total_cost, created_at, updated_at
            FROM cloud_chats
            WHERE user_id = ? AND deleted_at IS NULL
            ORDER BY updated_at DESC
            LIMIT 100`,
      args: [req.user!.id],
    });

    res.json({ chats: result.rows });
  } catch (error) {
    console.error('List chats error:', error);
    res.status(500).json({ error: 'Failed to list chats' });
  }
});

// Create chat
chatsRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, title, model } = req.body;
    const chatId = id || uuidv4();

    const db = getDb();
    await db.execute({
      sql: `INSERT INTO cloud_chats (id, user_id, title, model) VALUES (?, ?, ?, ?)`,
      args: [chatId, req.user!.id, title || 'New Chat', model || 'meta-llama/llama-3.2-3b-instruct:free'],
    });

    res.status(201).json({
      id: chatId,
      title: title || 'New Chat',
      model: model || 'meta-llama/llama-3.2-3b-instruct:free',
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Get single chat with messages
chatsRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();

    // Get chat
    const chatResult = await db.execute({
      sql: `SELECT * FROM cloud_chats WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      args: [req.params.id, req.user!.id],
    });

    if (chatResult.rows.length === 0) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    // Get messages
    const messagesResult = await db.execute({
      sql: `SELECT * FROM cloud_chat_messages WHERE chat_id = ? ORDER BY timestamp ASC`,
      args: [req.params.id],
    });

    res.json({
      chat: chatResult.rows[0],
      messages: messagesResult.rows,
    });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to get chat' });
  }
});

// Update chat
chatsRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, model, total_tokens, total_cost } = req.body;

    const db = getDb();

    // Build update query dynamically
    const updates: string[] = [];
    const args: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      args.push(title);
    }
    if (model !== undefined) {
      updates.push('model = ?');
      args.push(model);
    }
    if (total_tokens !== undefined) {
      updates.push('total_tokens = ?');
      args.push(total_tokens);
    }
    if (total_cost !== undefined) {
      updates.push('total_cost = ?');
      args.push(total_cost);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push("updated_at = datetime('now')");
    args.push(req.params.id, req.user!.id);

    await db.execute({
      sql: `UPDATE cloud_chats SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      args,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

// Delete chat (soft delete)
chatsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: `UPDATE cloud_chats SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user!.id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Add message to chat
chatsRouter.post('/:id/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, role, content, tool_call_id, tool_name, timestamp } = req.body;

    if (!role || !content) {
      res.status(400).json({ error: 'Role and content are required' });
      return;
    }

    const db = getDb();

    // Verify chat ownership
    const chatResult = await db.execute({
      sql: `SELECT id FROM cloud_chats WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user!.id],
    });

    if (chatResult.rows.length === 0) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    const messageId = id || uuidv4();
    await db.execute({
      sql: `INSERT INTO cloud_chat_messages (id, chat_id, role, content, tool_call_id, tool_name, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [messageId, req.params.id, role, content, tool_call_id || null, tool_name || null, timestamp || Date.now()],
    });

    // Update chat's updated_at
    await db.execute({
      sql: `UPDATE cloud_chats SET updated_at = datetime('now') WHERE id = ?`,
      args: [req.params.id],
    });

    res.status(201).json({ id: messageId });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Get messages for chat
chatsRouter.get('/:id/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();

    // Verify chat ownership
    const chatResult = await db.execute({
      sql: `SELECT id FROM cloud_chats WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user!.id],
    });

    if (chatResult.rows.length === 0) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    const messagesResult = await db.execute({
      sql: `SELECT * FROM cloud_chat_messages WHERE chat_id = ? ORDER BY timestamp ASC`,
      args: [req.params.id],
    });

    res.json({ messages: messagesResult.rows });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});
