/**
 * SentinelOps API Server
 * Standalone Express server for VPS deployment
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chatCompletionsRouter } from './routes/chat';
import { authRouter } from './routes/auth';
import { chatsRouter } from './routes/chats';
import { memoriesRouter } from './routes/memories';
import { syncRouter } from './routes/sync';
import { rateLimitRouter } from './routes/rateLimit';
import { ensureAuthTables } from './lib/db';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5174',
    'http://localhost:5173',
    'https://sentinelops.org',
    'https://www.sentinelops.org',
    'http://40.160.241.52',
  ],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/chat', chatCompletionsRouter);
app.use('/api/chat', rateLimitRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/sync', syncRouter);

// Legacy route for direct proxy compatibility
app.use('/chat', chatCompletionsRouter);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    // Ensure database tables exist
    await ensureAuthTables();
    console.log('Database tables initialized');

    app.listen(PORT, () => {
      console.log(`SentinelOps API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
