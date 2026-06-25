param(
    [string]$Version
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$PackageJson = Get-Content -LiteralPath (Join-Path $RepoRoot "package.json") -Raw | ConvertFrom-Json

if (-not $Version) {
    $Version = $PackageJson.version
}

$BuildDir = Join-Path $RepoRoot "dist\build\node-exe"
$BundlePath = Join-Path $BuildDir "server.cjs"
$SeaConfigPath = Join-Path $BuildDir "sea-config.json"
$SeaBlobPath = Join-Path $BuildDir "dotabased-gsi.blob"
$ExePath = Join-Path $BuildDir "dotabased-gsi.exe"
$NodeCommand = Get-Command node -ErrorAction Stop
$NpxCommand = Get-Command npx.cmd -ErrorAction Stop
$NodeExe = $NodeCommand.Source

if (-not $NodeExe.EndsWith(".exe", [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Error "Could not resolve node.exe from PATH. Found: $NodeExe"
}

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

if (Test-Path -LiteralPath $BuildDir) {
    Remove-Item -LiteralPath $BuildDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null

Write-Host "Bundling Node server..."
Invoke-NativeChecked `
    -FilePath $NpxCommand.Source `
    -Arguments @("--yes", "esbuild@latest", (Join-Path $RepoRoot "src\server.js"), "--bundle", "--platform=node", "--format=cjs", "--log-level=error", "--outfile=$BundlePath") `
    -FailureMessage "Failed to bundle the Node server with esbuild. Check npm/npx network access and retry."

$SeaConfig = @{
    main = $BundlePath
    output = $SeaBlobPath
    disableExperimentalSEAWarning = $true
    useSnapshot = $false
    useCodeCache = $false
} | ConvertTo-Json -Depth 4

Set-Content -LiteralPath $SeaConfigPath -Value $SeaConfig -Encoding UTF8

Write-Host "Building Node SEA blob..."
Invoke-NativeChecked `
    -FilePath $NodeExe `
    -Arguments @("--experimental-sea-config", $SeaConfigPath) `
    -FailureMessage "Failed to build the Node SEA blob."

Copy-Item -LiteralPath $NodeExe -Destination $ExePath -Force

$SignTool = Get-Command signtool -ErrorAction SilentlyContinue
if ($SignTool) {
    Write-Host "Removing Node signature before injection..."
    Invoke-NativeChecked `
        -FilePath $SignTool.Source `
        -Arguments @("remove", "/s", $ExePath) `
        -FailureMessage "Failed to remove the Node executable signature before SEA injection."
}
else {
    Write-Host "signtool not found; continuing with unsigned injection."
}

Write-Host "Injecting SEA blob..."
Invoke-NativeChecked `
    -FilePath $NpxCommand.Source `
    -Arguments @("--yes", "postject@latest", $ExePath, "NODE_SEA_BLOB", $SeaBlobPath, "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2") `
    -FailureMessage "Failed to inject the SEA blob with postject. Check npm/npx network access and retry."

Write-Host "Built Node executable:"
Write-Host $ExePath
