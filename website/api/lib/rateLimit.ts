/**
 * Rate limiting utility for AI chat API
 * Limits by IP for anonymous users, by user_id for authenticated users
 */

import { getDb, ensureAuthTables } from './db';

// Daily message limits by plan
export const RATE_LIMITS = {
  anonymous: 5,
  free: 25,
  pro: 300,
  team: 1000,
} as const;

export type Plan = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

/**
 * Check and update rate limit for a user or IP
 */
export async function checkRateLimit(
  identifier: string,
  identifierType: 'ip' | 'user',
  plan: Plan = 'anonymous'
): Promise<RateLimitResult> {
  await ensureAuthTables();
  const db = getDb();

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const limit = RATE_LIMITS[plan] || RATE_LIMITS.anonymous;

  // Get tomorrow at midnight for reset time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // Check current usage
  const result = await db.execute({
    sql: `SELECT message_count FROM rate_limits WHERE identifier = ? AND date = ?`,
    args: [identifier, today],
  });

  const currentCount = result.rows.length > 0
    ? (result.rows[0].message_count as number)
    : 0;

  const remaining = Math.max(0, limit - currentCount);
  const allowed = currentCount < limit;

  return {
    allowed,
    remaining,
    limit,
    resetAt: tomorrow,
  };
}

/**
 * Increment the rate limit counter after a successful request
 */
export async function incrementRateLimit(
  identifier: string,
  identifierType: 'ip' | 'user'
): Promise<void> {
  await ensureAuthTables();
  const db = getDb();

  const today = new Date().toISOString().split('T')[0];
  const id = `${identifierType}_${identifier}_${today}`;

  // Upsert: insert or update the count
  await db.execute({
    sql: `
      INSERT INTO rate_limits (id, identifier, identifier_type, message_count, date)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(identifier, date) DO UPDATE SET
        message_count = message_count + 1
    `,
    args: [id, identifier, identifierType, today],
  });
}

/**
 * Get rate limit info without incrementing
 */
export async function getRateLimitInfo(
  identifier: string,
  plan: Plan = 'anonymous'
): Promise<{ used: number; limit: number; remaining: number }> {
  await ensureAuthTables();
  const db = getDb();

  const today = new Date().toISOString().split('T')[0];
  const limit = RATE_LIMITS[plan] || RATE_LIMITS.anonymous;

  const result = await db.execute({
    sql: `SELECT message_count FROM rate_limits WHERE identifier = ? AND date = ?`,
    args: [identifier, today],
  });

  const used = result.rows.length > 0
    ? (result.rows[0].message_count as number)
    : 0;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Extract client IP from request headers (Vercel)
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
