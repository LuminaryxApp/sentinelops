/**
 * Chat completions proxy API
 * Proxies requests to sentinelops.onrender.com with rate limiting and SSE streaming
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, ensureAuthTables } from '../lib/db';
import { checkRateLimit, incrementRateLimit, getClientIP, type Plan } from '../lib/rateLimit';

const PROXY_URL = 'https://sentinelops.onrender.com/chat/completions';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

async function getUserFromToken(token: string): Promise<{ id: string; plan: Plan } | null> {
  try {
    await ensureAuthTables();
    const db = getDb();

    // Find session
    const sessionResult = await db.execute({
      sql: `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`,
      args: [token],
    });

    if (sessionResult.rows.length === 0) return null;

    const userId = sessionResult.rows[0].user_id as string;

    // Get subscription
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      .end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    // Check authentication
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let identifier: string;
    let identifierType: 'ip' | 'user';
    let plan: Plan = 'anonymous';

    if (token) {
      const user = await getUserFromToken(token);
      if (user) {
        identifier = user.id;
        identifierType = 'user';
        plan = user.plan;
      } else {
        // Invalid token, treat as anonymous
        identifier = getClientIP(new Headers(req.headers as Record<string, string>));
        identifierType = 'ip';
      }
    } else {
      // Anonymous user
      identifier = getClientIP(new Headers(req.headers as Record<string, string>));
      identifierType = 'ip';
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(identifier, identifierType, plan);

    if (!rateLimit.allowed) {
      res.setHeader('X-RateLimit-Limit', rateLimit.limit.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', rateLimit.resetAt.toISOString());

      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: plan === 'anonymous'
          ? 'You have reached the daily limit. Sign up for free to get 25 messages/day, or upgrade to Pro for 300 messages/day.'
          : plan === 'free'
          ? 'You have reached your daily limit. Upgrade to Pro for 300 messages/day.'
          : 'Daily limit reached. Your limit resets at midnight.',
        limit: rateLimit.limit,
        remaining: 0,
        resetAt: rateLimit.resetAt.toISOString(),
      });
    }

    // Parse request body
    const body = req.body as ChatRequest;

    if (!body.messages || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Build proxy request
    const proxyBody = {
      model: body.model || 'meta-llama/llama-3.1-8b-instruct:free',
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 4096,
      stream: body.stream ?? true,
    };

    // Make request to proxy
    const proxyResponse = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sentinelops.org',
        'X-Title': 'SentinelOps Web',
      },
      body: JSON.stringify(proxyBody),
    });

    if (!proxyResponse.ok) {
      const errorText = await proxyResponse.text();
      return res.status(proxyResponse.status).json({
        error: 'Proxy error',
        message: errorText,
      });
    }

    // Increment rate limit on successful request
    await incrementRateLimit(identifier, identifierType);

    // Handle streaming response
    if (body.stream !== false && proxyResponse.body) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-RateLimit-Limit', rateLimit.limit.toString());
      res.setHeader('X-RateLimit-Remaining', (rateLimit.remaining - 1).toString());

      // Stream the response
      const reader = proxyResponse.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (streamError) {
        console.error('Stream error:', streamError);
      } finally {
        res.end();
      }
    } else {
      // Non-streaming response
      const data = await proxyResponse.json();
      res.setHeader('X-RateLimit-Limit', rateLimit.limit.toString());
      res.setHeader('X-RateLimit-Remaining', (rateLimit.remaining - 1).toString());
      return res.status(200).json(data);
    }
  } catch (error) {
    console.error('Chat completion error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
