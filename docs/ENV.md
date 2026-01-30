# Environment variables (LLM, etc.)

## LLM: direct vs proxy

- **Direct:** Set `LLM_API_KEY` (and optional `LLM_BASE_URL`, `LLM_MODEL`). The app calls the provider directly. The key lives in `.env` or config.
- **Proxy:** Set `LLM_PROXY_URL` to your `llm-proxy/` server base URL. The app sends requests there; the proxy holds `LLM_API_KEY` and forwards to the provider. The key never ships with the app.

**Fresh installs:** The app defaults to `LLM_PROXY_URL=https://sentinelops.onrender.com`, so users get AI out of the box using your proxy (and your OpenRouter key with limits). No setup required. Users can override with their own proxy or direct key via `.env` if they want.

## Where the app loads `.env`

The app looks for `.env` in this order:

1. **Project root** – when the exe is run from `target/debug` or `target/release` (dev or local build).
2. **Next to the executable** – same folder as `SentinelOps.exe` (installed app).
3. **Config directory** – `%APPDATA%\SentinelOps\.env` on Windows, `~/Library/Application Support/SentinelOps/.env` on macOS.
4. **Current working directory** – `.env`, `../.env`, `../../.env`, `../../../.env`.
5. **User home** – `~/.env` or `~/SentinelOps/.env`.

**Development:** Keep `.env` in the project root.

**Installed app:** Put `.env` in one of these places:
- Same folder as `SentinelOps.exe`
- `%APPDATA%\SentinelOps\.env` (Windows) or `~/.config/SentinelOps/.env` (Linux)
- Your user folder as `.env` or `SentinelOps/.env`

Include `LLM_API_KEY` (direct) or `LLM_PROXY_URL` (proxy), and optionally `LLM_BASE_URL` / `LLM_MODEL`, so the AI agent works.

**If you see "Not Configured" but you have `.env` set up:** The app may not be finding your `.env`. Run the app from a terminal (or check devtools console when using `npm run tauri dev`) and look for "Loaded .env from: ..." or "No .env file found". Move `.env` to one of the locations above so the app finds it.
