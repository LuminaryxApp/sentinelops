/**
 * Authentication routes
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../lib/db';
import { createToken, requireAuth, AuthenticatedRequest, getUserFromToken } from '../lib/auth';

export const authRouter = Router();

// Sign up
authRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      res.status(400).json({ error: 'Email, name, and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const db = getDb();

    // Check if user exists
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });

    if (existing.rows.length > 0) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db.execute({
      sql: 'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)',
      args: [userId, email.toLowerCase(), name, passwordHash],
    });

    // Create free subscription
    await db.execute({
      sql: 'INSERT INTO subscriptions (id, user_id, plan, status) VALUES (?, ?, ?, ?)',
      args: [uuidv4(), userId, 'free', 'active'],
    });

    // Create token
    const token = createToken({ userId, email: email.toLowerCase() });

    res.status(201).json({
      token,
      user: {
        id: userId,
        email: email.toLowerCase(),
        name,
        subscription: { plan: 'free', status: 'active' },
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Sign in
authRouter.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const db = getDb();

    // Get user
    const result = await db.execute({
      sql: 'SELECT id, email, name, password_hash FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash as string);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Get subscription
    const subResult = await db.execute({
      sql: 'SELECT plan, status FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [user.id],
    });

    const subscription = subResult.rows[0] || { plan: 'free', status: 'active' };

    // Create token
    const token = createToken({
      userId: user.id as string,
      email: user.email as string,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscription: {
          plan: subscription.plan,
          status: subscription.status,
        },
      },
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

// Get current user
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// Validate token
authRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ valid: false });
      return;
    }

    const user = await getUserFromToken(token);

    if (!user) {
      res.status(401).json({ valid: false });
      return;
    }

    res.json({ valid: true, user });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});
