/**
 * Get current rate limit status for user/IP
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, ensureAuthTables } from '../lib/db';
import { getRateLimitInfo, getClientIP, RATE_LIMITS, type Plan } from '../lib/rateLimit';

async function getUserFromToken(token: string): Promise<{ id: string; plan: Plan } | null> {
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

    const plan = (subResult.rows[0]?.plan as Plan) || 'free';

    return { id: userId, plan };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let identifier: string;
    let plan: Plan = 'anonymous';

    if (token) {
      const user = await getUserFromToken(token);
      if (user) {
        identifier = user.id;
        plan = user.plan;
      } else {
        identifier = getClientIP(new Headers(req.headers as Record<string, string>));
      }
    } else {
      identifier = getClientIP(new Headers(req.headers as Record<string, string>));
    }

    const info = await getRateLimitInfo(identifier, plan);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return res.status(200).json({
      ...info,
      plan,
      resetAt: tomorrow.toISOString(),
    });
  } catch (error) {
    console.error('Rate limit check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
