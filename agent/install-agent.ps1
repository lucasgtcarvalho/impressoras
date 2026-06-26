param(
  [string]$ServerUrl = "http://SEU_IP:8080/api/v1",
  [string]$ActivationCode = "",
  [string]$InstallDir = "$env:ProgramFiles\PrintMonitor\Agent",
  [switch]$SelfContained = $true
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "PrintMonitor Agent - Instalação"

function Write-Color {
  param([string]$Color, [string]$Text)
  Write-Host $Text -ForegroundColor $Color
}

Write-Color Cyan "========================================"
Write-Color Cyan "  PrintMonitor Agent - Instalação"
Write-Color Cyan "========================================"
""

# 1. Verificar .NET SDK
$dotnet = Get-Command "dotnet" -ErrorAction SilentlyContinue
if (-not $dotnet) {
  Write-Color Yellow "[!] .NET SDK não encontrado."
  $choice = Read-Host "    Deseja baixar e instalar o .NET 8 SDK? (S/N)"
  if ($choice -eq "S") {
    Write-Color Green "[*] Baixando .NET 8 SDK..."
    $url = "https://dotnet.microsoft.com/download/dotnet/scripts/v1/dotnet-install.ps1"
    Invoke-WebRequest -Uri $url -OutFile "$env:TEMP\dotnet-install.ps1"
    & "$env:TEMP\dotnet-install.ps1" -Channel 8.0
    $env:Path += ";$env:ProgramFiles\dotnet"
    Write-Color Green "[OK] SDK instalado"
  } else {
    Write-Color Red "[!] Instalação cancelada. Instale o .NET 8 SDK manualmente."
    exit 1
  }
}

$version = dotnet --version
Write-Color Green "[OK] .NET SDK $version"

# 2. Coletar configurações
""
Write-Color Cyan "--- Configuração do Agente ---"
""

if (-not $ServerUrl -or $ServerUrl -eq "http://SEU_IP:8080/api/v1") {
  $ServerUrl = Read-Host "URL do servidor (ex: http://200.50.254.37:8080/api/v1)"
}
if (-not $ActivationCode) {
  $ActivationCode = Read-Host "Código de ativação do cliente"
}

# 3. Encontrar o diretório do projeto
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Join-Path $scriptDir "PrintMonitor.Agent"

if (-not (Test-Path $projectDir)) {
  Write-Color Red "[!] Diretório 'PrintMonitor.Agent' não encontrado em $scriptDir"
  Write-Color Yellow "    Copie a pasta 'agent' completa e execute este script de dentro dela."
  exit 1
}

# 4. Verificar fonte NuGet
$nugetSource = dotnet nuget list source 2>$null
if ($nugetSource -notmatch "nuget\.org") {
  Write-Color Yellow "  Adicionando nuget.org como fonte de pacotes..."
  dotnet nuget add source "https://api.nuget.org/v3/index.json" -n "nuget.org" 2>$null
}

# 5. Publicar
""
Write-Color Cyan "[*] Compilando agente..."
Remove-Item -Path "$projectDir\publish" -Recurse -Force -ErrorAction SilentlyContinue

$pubArgs = @(
  "publish", $projectDir,
  "-c", "Release",
  "-r", "win-x64",
  "-o", "$projectDir\publish"
)
if ($SelfContained) {
  $pubArgs += "--self-contained", "true"
}

& dotnet $pubArgs
if ($LASTEXITCODE -ne 0) {
  Write-Color Red "[!] Erro na compilação"
  exit 1
}
Write-Color Green "[OK] Compilação concluída"

# 5. Copiar para diretório de instalação
""
Write-Color Cyan "[*] Instalando em $InstallDir ..."

# Parar serviço se existir
$svc = Get-Service "PrintMonitor Agent" -ErrorAction SilentlyContinue
if ($svc) {
  Write-Color Yellow "  Parando serviço existente..."
  Stop-Service "PrintMonitor Agent" -Force -ErrorAction SilentlyContinue
  sc.exe delete "PrintMonitor Agent" 2>$null
  Start-Sleep -Seconds 2
}

# Remover instalação anterior
Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

Copy-Item -Path "$projectDir\publish\*" -Destination $InstallDir -Recurse -Force

# 7. Configurar appsettings.json
$configPath = Join-Path $InstallDir "appsettings.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$config.Agent.ServerUrl = $ServerUrl.TrimEnd('/')
$config.Agent.ActivationCode = $ActivationCode
$config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8

Write-Color Green "[OK] Configuração salva"

# 8. Instalar serviço Windows
""
Write-Color Cyan "[*] Instalando serviço Windows..."

$exePath = Join-Path $InstallDir "PrintMonitor.Agent.exe"
if (-not (Test-Path $exePath)) {
  Write-Color Red "[!] Executável não encontrado: $exePath"
  exit 1
}

sc.exe create "PrintMonitor Agent" binPath="$exePath" start=auto DisplayName="PrintMonitor Agent"
sc.exe failure "PrintMonitor Agent" reset=86400 actions=restart/5000/restart/10000/restart/30000
sc.exe start "PrintMonitor Agent"

Start-Sleep -Seconds 3

$svc = Get-Service "PrintMonitor Agent" -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
  Write-Color Green "[OK] Serviço instalado e rodando!"
} else {
  Write-Color Yellow "[!] Serviço instalado mas pode não estar rodando."
  Write-Color Yellow "    Verifique em services.msc ou execute: Get-Service 'PrintMonitor Agent'"
}

# 9. Resumo
""
Write-Color Cyan "========================================"
Write-Color Cyan "  Instalação Concluída"
Write-Color Cyan "========================================"
""
Write-Color Green "  Servidor:  $ServerUrl"
Write-Color Green "  Ativação:  $ActivationCode"
Write-Color Green "  Diretório: $InstallDir"
Write-Color Green "  Logs:      $InstallDir\logs\"
""
Write-Color Cyan "  Comandos úteis:"
Write-Color Gray "    Get-Service 'PrintMonitor Agent'"
Write-Color Gray "    Get-Content '$InstallDir\logs\agent-.log' -Tail 50"
Write-Color Gray "    Restart-Service 'PrintMonitor Agent'"
