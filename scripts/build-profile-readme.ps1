# Jak w GitHub Actions: font → inject statystyk → readme-aura z readme.source.build.md + NotoSans.
# Ustaw PROFILE_OWNER (i opcjonalnie GITHUB_TOKEN), potem:
#   .\scripts\build-profile-readme.ps1

$ErrorActionPreference = "Stop"
if (-not $env:PROFILE_OWNER) {
  $env:PROFILE_OWNER = "jakubkalinski0"
  Write-Host "PROFILE_OWNER not set; using $($env:PROFILE_OWNER)"
}
Set-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
node scripts/ensure-readme-font.mjs
node scripts/inject-profile-line-stats.mjs
npx readme-aura build --source readme.source.build.md --fonts-dir .github/fonts
Write-Host "Done. Commit README.md + .github/assets/*.svg together before push."
