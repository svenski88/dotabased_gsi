param(
    [string]$DotaPath
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$SourceConfig = Join-Path $RepoRoot "config\gamestate_integration_dotabased.cfg"

if (-not (Test-Path -LiteralPath $SourceConfig)) {
    Write-Error "Could not find source config: $SourceConfig"
}

$CandidateDotaPaths = @()

if ($DotaPath) {
    $CandidateDotaPaths += $DotaPath
}

$CandidateDotaPaths += @(
    "C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota",
    "C:\Program Files\Steam\steamapps\common\dota 2 beta\game\dota",
    "D:\SteamLibrary\steamapps\common\dota 2 beta\game\dota",
    "E:\SteamLibrary\steamapps\common\dota 2 beta\game\dota"
)

$ResolvedDotaPath = $CandidateDotaPaths |
    Where-Object { $_ -and (Test-Path -LiteralPath $_) } |
    Select-Object -First 1

if (-not $ResolvedDotaPath) {
    Write-Error "Could not find Dota 2. Rerun with -DotaPath set to the folder ending in 'dota 2 beta\game\dota'."
}

$TargetDir = Join-Path $ResolvedDotaPath "cfg\gamestate_integration"
$TargetConfig = Join-Path $TargetDir "gamestate_integration_dotabased.cfg"

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
Copy-Item -LiteralPath $SourceConfig -Destination $TargetConfig -Force

Write-Host "Installed GSI config:"
Write-Host $TargetConfig
Write-Host ""
Write-Host "Restart Dota 2 after changing this file."
Write-Host "Also confirm Dota 2 launch options include: -gamestateintegration"
