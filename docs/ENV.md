# Environment variables (LLM, etc.)

## LLM: direct vs proxy

- **Direct:** Set `LLM_API_KEY` (and optional `LLM_BASE_URL`, `LLM_MODEL`). The app calls the provider directly. The key lives in `.env` or config.
- **Proxy:** Set `LLM_PROXY_URL` to your `llm-proxy/` server in this repo base URL. The app sends requests there; the proxy holds `LLM_API_KEY` and forwards to the provider. The key never ships with the app.

Use the proxy when you want to ship the app without users configuring keys (e.g. you deploy the proxy and set `LLM_PROXY_URL` in the app).

## Where the app loads `.env`

1. **Project root** – when the exe is run from `target/debug` or `target/release` (dev or local build).
2. **Next to the executable** – same folder as `SentinelOps.exe` (installed app).
3. **Config directory** – `%APPDATA%\SentinelOps\.env` on Windows, `~/Library/Application Support/SentinelOps/.env` on macOS.
4. **Current working directory** – `.env`, `../.env`, `../../.env`, `../../../.env`.

**Development:** Keep `.env` in the project root.

**Installed app:** Put `.env` next to `SentinelOps.exe` or in `%APPDATA%\SentinelOps\.env`.

Include `LLM_API_KEY` (direct) or `LLM_PROXY_URL` (proxy), and optionally `LLM_BASE_URL` / `LLM_MODEL`, so the AI agent works.
