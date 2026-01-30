# Create GitHub release v0.1.0 and upload installer + latest.json
# If not logged in, run first: & $ghExe auth login

$ErrorActionPreference = "Stop"
# repoRoot = parent of scripts folder = SentinelOps
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$tag = "v0.1.0"
$installer = Join-Path $repoRoot "src-tauri\target\release\bundle\nsis\SentinelOps_0.1.0_x64-setup.exe"
$latestJson = Join-Path $repoRoot "release-assets\latest.json"

# Use gh from PATH or default install path
$ghExe = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghExe) {
    $defaultPath = "${env:ProgramFiles}\GitHub CLI\gh.exe"
    if (Test-Path $defaultPath) { $ghExe = $defaultPath } else {
        Write-Host "GitHub CLI (gh) not found. Install: winget install GitHub.cli"
        exit 1
    }
} else { $ghExe = $ghExe.Source }

$auth = & $ghExe auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in to GitHub. Run: & '$ghExe' auth login"
    exit 1
}

if (-not (Test-Path $installer)) {
    Write-Host "Installer not found: $installer"
    Write-Host "From the SentinelOps folder run: npm run tauri:build"
    exit 1
}
if (-not (Test-Path $latestJson)) {
    Write-Host "latest.json not found: $latestJson"
    exit 1
}

# Create release (or reuse existing) and upload assets
Write-Host "Creating release $tag and uploading assets..."
& $ghExe release create $tag $installer $latestJson --repo LuminaryxApp/sentinelops --title "SentinelOps v0.1.0" --notes "Initial release. Download the installer for your platform below."
if ($LASTEXITCODE -eq 0) {
    Write-Host "Done. Update check in the app should now work."
} else {
    # Release might already exist - try uploading assets only
    Write-Host "Release may already exist. Uploading assets..."
    & $ghExe release upload $tag $installer $latestJson --repo LuminaryxApp/sentinelops --clobber
}
