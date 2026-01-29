# In-app updates

The app checks for updates from:

`https://github.com/LuminaryxApp/sentinelops/releases/latest/download/latest.json`

**"Could not fetch a valid release JSON"** means that URL returns 404 or non-JSON (e.g. no GitHub Release exists yet, or the release has no `latest.json` asset).

## Fix: create a GitHub Release with `latest.json`

1. **Create a new release**
   - Go to [Releases](https://github.com/LuminaryxApp/sentinelops/releases) → **Create a new release**.
   - Tag: `v0.1.0` (create the tag if it doesn’t exist).
   - Title: e.g. **SentinelOps v0.1.0**.

2. **Upload assets**
   - Upload your built installer(s), e.g.:
     - `SentinelOps_0.1.0_x64-setup.exe` (from `src-tauri/target/release/bundle/nsis/`)
     - or `SentinelOps_0.1.0_x64_en-US.msi` (from `src-tauri/target/release/bundle/msi/`).

3. **Add `latest.json`**
   - **Easiest:** Upload the file **`release-assets/latest.json`** from this repo as an asset named **`latest.json`**.
   - Or create a file named `latest.json` with the content from that file (adjust URLs if your asset names differ).
   - For **NSIS zip** (if you use the zip artifact from CI): edit the `windows-x86_64.url` to  
     `https://github.com/LuminaryxApp/sentinelops/releases/download/v0.1.0/SentinelOps_0.1.0_x64-setup.nsis.zip`  
     and upload the `.nsis.zip` file from your build.

4. **Publish** the release.

After that, the in-app “Check for updates” will get valid JSON. If the release version is the same as the installed app (e.g. 0.1.0), the app will report “You’re up to date.”

## Using the release workflow

Pushing a tag `v*` (e.g. `v0.1.0`) runs the GitHub Action that:

1. Creates a draft release.
2. Builds the app on Windows, macOS, and Linux.
3. Uploads installers and generates `latest.json` with the correct URLs.
4. Publishes the release.

So you can run:

```bash
git tag v0.1.0
git push origin v0.1.0
```

and wait for the workflow to finish. It will attach the built installers and `latest.json` to the release. The workflow was updated so `upload_url` is passed correctly and `latest.json` is uploaded.

## Signing (optional)

For signed updates, set `TAURI_SIGNING_PRIVATE_KEY` (and optionally `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) when building, and set `pubkey` in `tauri.conf.json` to the public key. Then `latest.json` must include the real `signature` for each platform (from the `.sig` files Tauri generates). With `pubkey` empty, `signature` can be `""` in `latest.json`.
