/**
 * Chat completion proxy route
 * Proxies requests to OpenRouter with rate limiting
 */

import { Router, Response } from 'express';
import fetch from 'node-fetch';
import { AuthenticatedRequest, optionalAuth } from '../lib/auth';
import { checkRateLimit, incrementRateLimit, getClientIP } from '../lib/rateLimit';

export const chatCompletionsRouter = Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

chatCompletionsRouter.post('/completions', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Determine identifier and plan for rate limiting
    const identifier = req.user?.id || getClientIP(req);
    const identifierType = req.user ? 'user' : 'ip';
    const plan = req.user?.subscription?.plan || 'anonymous';

    // Check rate limit
    const rateLimit = await checkRateLimit(identifier, identifierType as 'user' | 'ip', plan);

    if (!rateLimit.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: plan === 'anonymous'
          ? 'You have reached your daily limit. Sign in for 25 messages/day or upgrade to Pro for 300.'
          : `You have reached your daily limit of ${rateLimit.limit} messages. Upgrade for more.`,
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAt: rateLimit.resetAt,
      });
      return;
    }

    const { model, messages, temperature, max_tokens, stream = true } = req.body;

    // Prepare request to OpenRouter
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      res.status(500).json({ error: 'OpenRouter API key not configured' });
      return;
    }

    const requestBody = {
      model: model || 'meta-llama/llama-3.2-3b-instruct:free',
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens ?? 4096,
      stream,
    };

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterKey}`,
        'HTTP-Referer': 'https://sentinelops.org',
        'X-Title': 'SentinelOps',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      res.status(response.status).json({
        error: 'Upstream API error',
        message: 'Failed to process request',
      });
      return;
    }

    // Increment rate limit on successful request
    await incrementRateLimit(identifier, identifierType as 'user' | 'ip');

    if (stream && response.body) {
      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining - 1));

      // Pipe the response
      response.body.pipe(res);

      response.body.on('error', (err) => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      // Non-streaming response
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error('Chat completion error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
