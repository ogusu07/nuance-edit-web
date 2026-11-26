# NuanceEdit Web ローカル起動スクリプト
$ws = Split-Path -Parent $MyInvocation.MyCommand.Path
$local = "$env:LOCALAPPDATA\nuance-edit-deps"

if (!(Test-Path "$local\node_modules")) {
  New-Item -ItemType Directory -Force -Path $local | Out-Null
  Copy-Item "$ws\package.json" "$local\package.json" -Force
  Push-Location $local
  npm.cmd install --no-audit --no-fund
  Pop-Location
}

Copy-Item "$ws\index.html","$ws\tsconfig.json","$ws\vite.config.ts" $local -Force
Remove-Item "$local\src" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$ws\src" "$local\src" -Recurse -Force

Set-Location $local
Write-Host "Starting NuanceEdit Web at http://localhost:5173 ..." -ForegroundColor Amber
.\node_modules\.bin\vite.cmd --port 5173 --host
