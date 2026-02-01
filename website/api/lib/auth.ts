/**
 * Authentication utilities for Vercel API routes
 */

import crypto from 'crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.createHash('sha256').update(Buffer.concat([salt, Buffer.from(password, 'utf8')])).digest();
  return Buffer.concat([salt, hash]).toString('base64');
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const decoded = Buffer.from(storedHash, 'base64');
    const salt = decoded.subarray(0, 16);
    const storedHashBytes = decoded.subarray(16);
    const hash = crypto.createHash('sha256').update(Buffer.concat([salt, Buffer.from(password, 'utf8')])).digest();
    return hash.length === storedHashBytes.length && hash.equals(storedHashBytes);
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function extractToken(req: { headers: { authorization?: string } }): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function toAuthUser(user: any, subscription: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: Boolean(user.email_verified),
    subscription: {
      plan: subscription?.plan || 'free',
      status: subscription?.status || 'active',
      expiresAt: subscription?.current_period_end || null,
    },
  };
}

export function rowToObject(columns: string[], row: any): Record<string, any> {
  const obj: Record<string, any> = {};
  (columns || []).forEach((col, i) => {
    const val = Array.isArray(row) ? row[i] : row?.[col];
    obj[col] = val?.value ?? val;
  });
  return obj;
}
