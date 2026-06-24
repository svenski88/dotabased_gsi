param(
    [string]$HostAddress = $env:DOTABASED_GSI_HOST,
    [string]$Port = $env:DOTABASED_GSI_PORT
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js was not found on PATH. Install Node.js 18 or newer, then run this script again."
}

if ($HostAddress) {
    $env:DOTABASED_GSI_HOST = $HostAddress
}

if ($Port) {
    $env:DOTABASED_GSI_PORT = $Port
}

Push-Location $RepoRoot
try {
    Write-Host "Starting DotaBASED GSI Bridge..."
    Write-Host "Press Ctrl+C to stop."
    node src/server.js
}
finally {
    Pop-Location
}
