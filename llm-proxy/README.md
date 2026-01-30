# SentinelOps LLM Proxy

Backend proxy for LLM requests. The **SentinelOps app** sends requests here (no API key); this server forwards them to your LLM provider with `LLM_API_KEY`. The key never ships with the app.

## Env vars (on the proxy server)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_API_KEY` | Yes | — | Your OpenRouter/OpenAI/etc. API key |
| `LLM_BASE_URL` | No | `https://openrouter.ai/api/v1` | Base URL for chat and embeddings |
| `IMAGE_BASE_URL` | No | `https://openrouter.ai/api/v1` | Base URL for image generation |
| `PORT` | No | `3199` | Server port |

## Run locally

```bash
cd llm-proxy
npm install
LLM_API_KEY=sk-... npm start
```

## App config

In the **SentinelOps app**, set the proxy URL (env or build-time):

- **Env:** `LLM_PROXY_URL=http://localhost:3199` (dev) or `https://your-proxy.example.com` (production).
- No `LLM_API_KEY` in the app when using the proxy.

## Deploy

Deploy `llm-proxy` to any Node host (Railway, Render, Fly.io, etc.), set `LLM_API_KEY` and optional `LLM_BASE_URL` / `IMAGE_BASE_URL`, then set `LLM_PROXY_URL` in the app to your proxy URL.

## Endpoints

- `POST /chat/completions` — OpenAI-style chat
- `POST /embeddings` — OpenAI-style embeddings
- `POST /images/generations` — OpenRouter-style image generation
