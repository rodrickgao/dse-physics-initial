$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

npm ci
npm run build
node --check cloudflare/worker.js
git diff --check

if (git status --porcelain) {
  throw "Working tree has uncommitted changes. Commit them before deploying."
}

$pushed = $false
for ($attempt = 1; $attempt -le 3; $attempt++) {
  git push origin main
  if ($LASTEXITCODE -eq 0) {
    $pushed = $true
    break
  }
  if ($attempt -lt 3) { Start-Sleep -Seconds (3 * $attempt) }
}
if (-not $pushed) { throw "GitHub push failed after three attempts." }

cmd /c npx wrangler deploy
if ($LASTEXITCODE -ne 0) { throw "Cloudflare deployment failed." }
