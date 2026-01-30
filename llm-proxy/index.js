/**
 * SentinelOps LLM proxy
 * Forwards chat/completions, embeddings, and image generation to your LLM provider.
 * Set LLM_API_KEY (and optional LLM_BASE_URL, IMAGE_BASE_URL) on this server;
 * the app uses LLM_PROXY_URL and sends no API key.
 */

import express from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));

const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
const IMAGE_BASE_URL = (process.env.IMAGE_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

if (!LLM_API_KEY) {
  console.error('LLM_API_KEY is required. Set it in the environment.');
  process.exit(1);
}

function forward(url, body, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LLM_API_KEY}`,
    'HTTP-Referer': 'https://sentinelops.app',
    'X-Title': 'SentinelOps',
    ...opts.headers,
  };
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs || 120_000),
  });
}

// GET / — friendly response for browser visits
app.get('/', (req, res) => {
  res.type('text/plain').send(
    'SentinelOps LLM proxy is running.\nUse LLM_PROXY_URL in the app to point here.'
  );
});

// POST /chat/completions — same path as OpenAI-style APIs
app.post('/chat/completions', async (req, res) => {
  try {
    const r = await forward(`${LLM_BASE_URL}/chat/completions`, req.body);
    const text = await r.text();
    res.status(r.status).set('Content-Type', r.headers.get('Content-Type') || 'application/json').send(text);
  } catch (e) {
    console.error('Proxy /chat/completions error:', e.message);
    res.status(502).json({ error: { message: `Proxy error: ${e.message}` } });
  }
});

// POST /embeddings
app.post('/embeddings', async (req, res) => {
  try {
    const r = await forward(`${LLM_BASE_URL}/embeddings`, req.body);
    const text = await r.text();
    res.status(r.status).set('Content-Type', r.headers.get('Content-Type') || 'application/json').send(text);
  } catch (e) {
    console.error('Proxy /embeddings error:', e.message);
    res.status(502).json({ error: { message: `Proxy error: ${e.message}` } });
  }
});

// POST /images/generations — OpenRouter-style image API
app.post('/images/generations', async (req, res) => {
  try {
    const r = await forward(`${IMAGE_BASE_URL}/images/generations`, req.body, { timeoutMs: 180_000 });
    const text = await r.text();
    res.status(r.status).set('Content-Type', r.headers.get('Content-Type') || 'application/json').send(text);
  } catch (e) {
    console.error('Proxy /images/generations error:', e.message);
    res.status(502).json({ error: { message: `Proxy error: ${e.message}` } });
  }
});

const port = Number(process.env.PORT) || 3199;
app.listen(port, () => {
  console.log(`SentinelOps LLM proxy listening on http://localhost:${port}`);
  console.log(`  LLM_BASE_URL=${LLM_BASE_URL}`);
  console.log(`  IMAGE_BASE_URL=${IMAGE_BASE_URL}`);
});
