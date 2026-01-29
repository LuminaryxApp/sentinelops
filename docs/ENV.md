# Environment variables (LLM, etc.)

For **development** (e.g. `npm run tauri:dev`), the app loads `.env` from the project root.

For the **installed app** (built .exe), the app looks for `.env` in this order:

1. **Next to the executable** – e.g. same folder as `SentinelOps.exe`
2. **Config directory** – e.g. `%APPDATA%\SentinelOps\.env` on Windows, `~/Library/Application Support/SentinelOps/.env` on macOS
3. **Current working directory** – `.env`, `../.env`, `../../.env`

Put your `.env` (with `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, etc.) in one of those places so the AI agent and other features work after install.
