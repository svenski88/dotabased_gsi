param(
    [string]$Python = $env:DOTABASED_PYTHON
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")

if (-not $Python) {
    $Python = "python"
}

$BuildRoot = Join-Path $RepoRoot "dist\build\scorer"
$DistPath = Join-Path $BuildRoot "dist"
$WorkPath = Join-Path $BuildRoot "work"
$SpecPath = Join-Path $BuildRoot "spec"
$ScorerPath = Join-Path $RepoRoot "src\scorer.py"

function Invoke-NativeChecked {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$FailureMessage
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        Write-Error $FailureMessage
    }
}

if (Test-Path -LiteralPath $BuildRoot) {
    Remove-Item -LiteralPath $BuildRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $BuildRoot | Out-Null

Write-Host "Checking Python packaging dependencies..."
$PreviousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& $Python -c "import PyInstaller, lightgbm, numpy" *> $null
$DependencyCheckExitCode = $LASTEXITCODE
$ErrorActionPreference = $PreviousErrorActionPreference

if ($DependencyCheckExitCode -ne 0) {
    Write-Error "Missing Python build dependencies. Install them in the build environment with: $Python -m pip install pyinstaller lightgbm numpy"
}

Write-Host "Building scorer executable with PyInstaller..."
Invoke-NativeChecked `
    -FilePath $Python `
    -Arguments @("-m", "PyInstaller", "--noconfirm", "--clean", "--onedir", "--name", "scorer", "--distpath", $DistPath, "--workpath", $WorkPath, "--specpath", $SpecPath, "--collect-all", "lightgbm", "--collect-all", "numpy", $ScorerPath) `
    -FailureMessage "PyInstaller failed to build scorer.exe."

Write-Host "Built scorer bundle:"
Write-Host (Join-Path $DistPath "scorer")
