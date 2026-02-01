/**
 * Rate limiting utility for chat API
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import { Request } from 'express';

// Rate limits per plan (messages per day)
export const RATE_LIMITS: Record<string, number> = {
  anonymous: 5,
  free: 25,
  pro: 300,
  team: 1000,
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
}

export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
    return ips.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export async function checkRateLimit(
  identifier: string,
  identifierType: 'ip' | 'user',
  plan: string = 'anonymous'
): Promise<RateLimitResult> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const limit = RATE_LIMITS[plan] || RATE_LIMITS.anonymous;

  // Get tomorrow's date for reset time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const resetAt = tomorrow.toISOString();

  try {
    const result = await db.execute({
      sql: 'SELECT message_count FROM rate_limits WHERE identifier = ? AND date = ?',
      args: [identifier, today],
    });

    const currentCount = result.rows[0]?.message_count as number || 0;
    const remaining = Math.max(0, limit - currentCount);

    return {
      allowed: currentCount < limit,
      remaining,
      limit,
      resetAt,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request but with 0 remaining
    return {
      allowed: true,
      remaining: 0,
      limit,
      resetAt,
    };
  }
}

export async function incrementRateLimit(
  identifier: string,
  identifierType: 'ip' | 'user'
): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  try {
    // Try to update existing record
    const updateResult = await db.execute({
      sql: 'UPDATE rate_limits SET message_count = message_count + 1 WHERE identifier = ? AND date = ?',
      args: [identifier, today],
    });

    // If no rows updated, insert new record
    if (updateResult.rowsAffected === 0) {
      await db.execute({
        sql: 'INSERT INTO rate_limits (id, identifier, identifier_type, message_count, date) VALUES (?, ?, ?, 1, ?)',
        args: [uuidv4(), identifier, identifierType, today],
      });
    }
  } catch (error) {
    console.error('Rate limit increment error:', error);
  }
}

export async function getRateLimitInfo(
  identifier: string,
  plan: string = 'anonymous'
): Promise<RateLimitResult> {
  return checkRateLimit(identifier, 'ip', plan);
}
