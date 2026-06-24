param(
    [string]$Version
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$PackageJsonPath = Join-Path $RepoRoot "package.json"
$PackageJson = Get-Content -LiteralPath $PackageJsonPath -Raw | ConvertFrom-Json

if (-not $Version) {
    $Version = $PackageJson.version
}

$ReleaseName = "$($PackageJson.name)-v$Version"
$DistDir = Join-Path $RepoRoot "dist"
$StageDir = Join-Path $DistDir $ReleaseName
$ZipPath = Join-Path $DistDir "$ReleaseName.zip"

if (Test-Path -LiteralPath $StageDir) {
    Remove-Item -LiteralPath $StageDir -Recurse -Force
}

if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}

New-Item -ItemType Directory -Force -Path $StageDir | Out-Null

$ItemsToCopy = @(
    ".gitignore",
    "README.md",
    "package.json",
    "config",
    "scripts",
    "src"
)

foreach ($Item in $ItemsToCopy) {
    $Source = Join-Path $RepoRoot $Item
    $Destination = Join-Path $StageDir $Item
    Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}

Compress-Archive -LiteralPath $StageDir -DestinationPath $ZipPath -Force

Write-Host "Built release zip:"
Write-Host $ZipPath
