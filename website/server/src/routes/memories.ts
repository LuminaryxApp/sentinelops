/**
 * Memories CRUD routes
 */

import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../lib/db';
import { requireAuth, AuthenticatedRequest } from '../lib/auth';

export const memoriesRouter = Router();

// Require auth for all memory routes
memoriesRouter.use(requireAuth);

// List memories
memoriesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { workspace_id, type, search } = req.query;
    const db = getDb();

    let sql = `SELECT id, workspace_id, content, summary, type, tags, importance, is_pinned, created_at, updated_at
               FROM cloud_memories
               WHERE user_id = ? AND deleted_at IS NULL`;
    const args: any[] = [req.user!.id];

    if (workspace_id) {
      sql += ' AND workspace_id = ?';
      args.push(workspace_id);
    }

    if (type) {
      sql += ' AND type = ?';
      args.push(type);
    }

    if (search) {
      sql += ' AND (content LIKE ? OR summary LIKE ?)';
      const searchTerm = `%${search}%`;
      args.push(searchTerm, searchTerm);
    }

    sql += ' ORDER BY is_pinned DESC, importance DESC, updated_at DESC LIMIT 200';

    const result = await db.execute({ sql, args });
    res.json({ memories: result.rows });
  } catch (error) {
    console.error('List memories error:', error);
    res.status(500).json({ error: 'Failed to list memories' });
  }
});

// Create memory
memoriesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, workspace_id, content, summary, type, tags, importance, is_pinned, metadata } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const memoryId = id || uuidv4();
    const db = getDb();

    await db.execute({
      sql: `INSERT INTO cloud_memories (id, user_id, workspace_id, content, summary, type, tags, importance, is_pinned, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        memoryId,
        req.user!.id,
        workspace_id || null,
        content,
        summary || null,
        type || 'user',
        tags ? JSON.stringify(tags) : null,
        importance ?? 0.5,
        is_pinned ? 1 : 0,
        metadata ? JSON.stringify(metadata) : null,
      ],
    });

    res.status(201).json({ id: memoryId });
  } catch (error) {
    console.error('Create memory error:', error);
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

// Get single memory
memoriesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT * FROM cloud_memories WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      args: [req.params.id, req.user!.id],
    });

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }

    // Update access count
    await db.execute({
      sql: `UPDATE cloud_memories SET access_count = access_count + 1, last_accessed_at = datetime('now') WHERE id = ?`,
      args: [req.params.id],
    });

    res.json({ memory: result.rows[0] });
  } catch (error) {
    console.error('Get memory error:', error);
    res.status(500).json({ error: 'Failed to get memory' });
  }
});

// Update memory
memoriesRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content, summary, type, tags, importance, is_pinned, metadata } = req.body;
    const db = getDb();

    const updates: string[] = [];
    const args: any[] = [];

    if (content !== undefined) {
      updates.push('content = ?');
      args.push(content);
    }
    if (summary !== undefined) {
      updates.push('summary = ?');
      args.push(summary);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      args.push(type);
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      args.push(JSON.stringify(tags));
    }
    if (importance !== undefined) {
      updates.push('importance = ?');
      args.push(importance);
    }
    if (is_pinned !== undefined) {
      updates.push('is_pinned = ?');
      args.push(is_pinned ? 1 : 0);
    }
    if (metadata !== undefined) {
      updates.push('metadata = ?');
      args.push(JSON.stringify(metadata));
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push("updated_at = datetime('now')");
    args.push(req.params.id, req.user!.id);

    await db.execute({
      sql: `UPDATE cloud_memories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      args,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Update memory error:', error);
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

// Delete memory (soft delete)
memoriesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = getDb();
    await db.execute({
      sql: `UPDATE cloud_memories SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user!.id],
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete memory error:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// Search memories
memoriesRouter.post('/search', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, workspace_id, type, limit = 50 } = req.body;

    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const db = getDb();
    const searchTerm = `%${query}%`;

    let sql = `SELECT id, workspace_id, content, summary, type, tags, importance, is_pinned, created_at
               FROM cloud_memories
               WHERE user_id = ? AND deleted_at IS NULL
               AND (content LIKE ? OR summary LIKE ? OR tags LIKE ?)`;
    const args: any[] = [req.user!.id, searchTerm, searchTerm, searchTerm];

    if (workspace_id) {
      sql += ' AND workspace_id = ?';
      args.push(workspace_id);
    }

    if (type) {
      sql += ' AND type = ?';
      args.push(type);
    }

    sql += ' ORDER BY is_pinned DESC, importance DESC, updated_at DESC LIMIT ?';
    args.push(Math.min(limit, 100));

    const result = await db.execute({ sql, args });
    res.json({ memories: result.rows });
  } catch (error) {
    console.error('Search memories error:', error);
    res.status(500).json({ error: 'Failed to search memories' });
  }
});
