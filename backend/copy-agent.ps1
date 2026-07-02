# Copy agent publish output to public/agent/ for download endpoint
$src = Join-Path $PSScriptRoot "..\agent\publish"
$dst = Join-Path $PSScriptRoot "public\agent"

if (-not (Test-Path $src)) {
    Write-Host "ERRO: Agent publish directory not found at $src"
    Write-Host "Build the agent first: cd ../agent/PrintMonitor.Agent && dotnet publish -c Release"
    exit 1
}

New-Item -ItemType Directory -Path $dst -Force | Out-Null

Get-ChildItem $src -File | Where-Object { $_.Name -ne 'PrintMonitor.Agent.pdb' } | ForEach-Object {
    Copy-Item $_.FullName -Destination $dst -Force
}

$count = (Get-ChildItem $dst).Count
Write-Host "Copied $count files from agent/publish to backend/public/agent/"
