/**
 * Rate limit info route
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, optionalAuth } from '../lib/auth';
import { getRateLimitInfo, getClientIP } from '../lib/rateLimit';

export const rateLimitRouter = Router();

rateLimitRouter.get('/rate-limit', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const identifier = req.user?.id || getClientIP(req);
    const plan = req.user?.subscription?.plan || 'anonymous';

    const info = await getRateLimitInfo(identifier, plan);

    res.json({
      limit: info.limit,
      remaining: info.remaining,
      resetAt: info.resetAt,
      plan,
    });
  } catch (error) {
    console.error('Rate limit info error:', error);
    res.status(500).json({ error: 'Failed to get rate limit info' });
  }
});
