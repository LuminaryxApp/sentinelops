/**
 * Vercel serverless function: GET /api/auth/me
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, ensureAuthTables } from '../lib/db';
import { extractToken, toAuthUser, rowToObject } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    await ensureAuthTables();
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const client = getDb();
    const sessionRs = await client.execute({
      sql: `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`,
      args: [token],
    });

    if (!sessionRs.rows?.length) {
      return res.status(401).json({ success: false, error: 'Session expired' });
    }

    const session = rowToObject(sessionRs.columns || [], sessionRs.rows[0]);
    const userId = session.user_id;

    // Get user
    const userRs = await client.execute({
      sql: `SELECT id, email, name, email_verified FROM users WHERE id = ?`,
      args: [userId],
    });

    if (!userRs.rows?.length) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const user = rowToObject(userRs.columns || [], userRs.rows[0]);

    // Get subscription
    const subRs = await client.execute({
      sql: `SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      args: [userId],
    });

    const subRow = subRs.rows?.[0];
    const subscription = subRow 
      ? rowToObject(subRs.columns || [], subRow)
      : { plan: 'free', status: 'active', current_period_end: null };

    return res.json({
      success: true,
      user: toAuthUser(user, subscription),
    });
  } catch (err: any) {
    console.error('Me error:', err);
    return res.status(500).json({ success: false, error: 'Failed to get user' });
  }
}
