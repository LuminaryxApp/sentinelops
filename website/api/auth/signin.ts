/**
 * Vercel serverless function: POST /api/auth/signin
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getDb, ensureAuthTables } from '../lib/db';
import { verifyPassword, generateToken, toAuthUser, rowToObject } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    await ensureAuthTables();
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const client = getDb();
    const userRs = await client.execute({
      sql: `SELECT id, email, name, password_hash, email_verified FROM users WHERE email = ?`,
      args: [email.toLowerCase()],
    });

    if (!userRs.rows?.length) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const row = userRs.rows[0];
    const user = rowToObject(userRs.columns || [], row);

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Get subscription
    const subRs = await client.execute({
      sql: `SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      args: [user.id],
    });

    const subRow = subRs.rows?.[0];
    const subscription = subRow 
      ? rowToObject(subRs.columns || [], subRow)
      : { plan: 'free', status: 'active', current_period_end: null };

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const sessionId = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
      args: [sessionId, user.id, token, expiresAt],
    });

    return res.json({
      success: true,
      user: toAuthUser(user, subscription),
      token,
    });
  } catch (err: any) {
    console.error('Signin error:', err);
    return res.status(500).json({ success: false, error: 'Failed to sign in' });
  }
}
