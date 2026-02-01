/**
 * Vercel serverless function: POST /api/auth/signup
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getDb, ensureAuthTables } from '../lib/db';
import { hashPassword, generateToken, toAuthUser } from '../lib/auth';

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
    const { email, password, name } = req.body || {};

    if (!email || !password || !name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Email, password, and name required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    const client = getDb();
    const emailLower = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await client.execute({
      sql: `SELECT id FROM users WHERE email = ?`,
      args: [emailLower],
    });

    if (existing.rows?.length > 0) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    // Create user
    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    await client.execute({
      sql: `INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`,
      args: [id, emailLower, name.trim(), passwordHash],
    });

    // Create default free subscription
    const subId = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO subscriptions (id, user_id, plan, status) VALUES (?, ?, 'free', 'active')`,
      args: [subId, id],
    });

    // Create session
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const sessionId = crypto.randomUUID();
    await client.execute({
      sql: `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
      args: [sessionId, id, token, expiresAt],
    });

    const user = { id, email: emailLower, name: name.trim(), email_verified: 0 };
    const subscription = { plan: 'free', status: 'active', current_period_end: null };

    return res.json({
      success: true,
      user: toAuthUser(user, subscription),
      token,
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create account' });
  }
}
