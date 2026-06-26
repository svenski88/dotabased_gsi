param(
    [string]$Version,
    [string]$PredictionDir,
    [switch]$SkipPredictionModels
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$PackageJson = Get-Content -LiteralPath (Join-Path $RepoRoot "package.json") -Raw | ConvertFrom-Json

if (-not $Version) {
    $Version = $PackageJson.version
}

$ReleaseName = "$($PackageJson.name)-v$Version-windows-x64"
$DistDir = Join-Path $RepoRoot "dist"
$StageDir = Join-Path $DistDir $ReleaseName
$ZipPath = Join-Path $DistDir "$ReleaseName.zip"
$NodeExe = Join-Path $RepoRoot "dist\build\node-exe\dotabased-gsi.exe"
$ScorerBundle = Join-Path $RepoRoot "dist\build\scorer\dist\scorer"

& (Join-Path $PSScriptRoot "build-node-exe.ps1") -Version $Version
& (Join-Path $PSScriptRoot "build-scorer-exe.ps1")

if (Test-Path -LiteralPath $StageDir) {
    Remove-Item -LiteralPath $StageDir -Recurse -Force
}

if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
}

New-Item -ItemType Directory -Force -Path $StageDir | Out-Null

Copy-Item -LiteralPath $NodeExe -Destination (Join-Path $StageDir "dotabased-gsi.exe") -Force
Copy-Item -LiteralPath $ScorerBundle -Destination (Join-Path $StageDir "scorer") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "README.md") -Destination (Join-Path $StageDir "README.md") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "dotabased-gsi.env.example") -Destination (Join-Path $StageDir "dotabased-gsi.env.example") -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "config") -Destination (Join-Path $StageDir "config") -Recurse -Force

$ReleaseScriptsDir = Join-Path $StageDir "scripts"
New-Item -ItemType Directory -Force -Path $ReleaseScriptsDir | Out-Null
Copy-Item -LiteralPath (Join-Path $RepoRoot "scripts\install-gsi-config.ps1") -Destination $ReleaseScriptsDir -Force
Copy-Item -LiteralPath (Join-Path $RepoRoot "scripts\start-dotabased-gsi-exe.bat") -Destination (Join-Path $StageDir "start-dotabased-gsi.bat") -Force

if (-not $SkipPredictionModels) {
    if (-not $PredictionDir) {
        $PredictionDir = Join-Path $RepoRoot "dotaprediction"
    }

    $ResolvedPredictionDir = Resolve-Path -LiteralPath $PredictionDir -ErrorAction SilentlyContinue
    if (-not $ResolvedPredictionDir) {
        Write-Error "Prediction model directory not found: $PredictionDir"
    }

    & (Join-Path $PSScriptRoot "copy-runtime-models.ps1") `
        -SourceDir $ResolvedPredictionDir.Path `
        -DestinationDir (Join-Path $StageDir "dotaprediction")
}
else {
    Write-Host "Prediction models were not included because -SkipPredictionModels was provided."
}

Compress-Archive -LiteralPath $StageDir -DestinationPath $ZipPath -Force

Write-Host "Built Windows executable release:"
Write-Host $ZipPath
