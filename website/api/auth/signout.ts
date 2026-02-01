/**
 * Vercel serverless function: POST /api/auth/signout
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../lib/db';
import { extractToken } from '../lib/auth';

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
    const token = extractToken(req);
    if (token) {
      const client = getDb();
      await client.execute({ 
        sql: `DELETE FROM sessions WHERE token = ?`, 
        args: [token] 
      });
    }
    return res.json({ success: true });
  } catch (err: any) {
    console.error('Signout error:', err);
    return res.json({ success: true }); // Always succeed
  }
}
