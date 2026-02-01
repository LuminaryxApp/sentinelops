/**
 * Authentication utilities and middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'sentinelops-dev-secret-change-in-production';

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    subscription?: {
      plan: string;
      status: string;
    };
  };
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function createToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export async function getUserFromToken(token: string): Promise<AuthenticatedRequest['user'] | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  const db = getDb();

  try {
    // Get user
    const userResult = await db.execute({
      sql: 'SELECT id, email, name FROM users WHERE id = ?',
      args: [payload.userId],
    });

    if (userResult.rows.length === 0) return null;

    const user = userResult.rows[0];

    // Get subscription
    const subResult = await db.execute({
      sql: 'SELECT plan, status FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [payload.userId],
    });

    const subscription = subResult.rows[0] || { plan: 'free', status: 'active' };

    return {
      id: user.id as string,
      email: user.email as string,
      name: user.name as string,
      subscription: {
        plan: subscription.plan as string,
        status: subscription.status as string,
      },
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Middleware to authenticate requests (optional - doesn't fail if no token)
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = await getUserFromToken(token);
    if (user) {
      req.user = user;
    }
  }

  next();
}

/**
 * Middleware to require authentication
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);
  const user = await getUserFromToken(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = user;
  next();
}
