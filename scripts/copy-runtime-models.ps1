param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDir,

    [Parameter(Mandatory = $true)]
    [string]$DestinationDir
)

$ErrorActionPreference = "Stop"
$Models = @("min3", "micro19", "herowr", "max482")
$Files = @("model.txt", "model_meta.json")

$ResolvedSourceDir = Resolve-Path -LiteralPath $SourceDir -ErrorAction SilentlyContinue
if (-not $ResolvedSourceDir) {
    Write-Error "Prediction model source directory not found: $SourceDir"
}

if (Test-Path -LiteralPath $DestinationDir) {
    Remove-Item -LiteralPath $DestinationDir -Recurse -Force
}

foreach ($Model in $Models) {
    $ModelDestination = Join-Path $DestinationDir $Model
    New-Item -ItemType Directory -Force -Path $ModelDestination | Out-Null

    foreach ($File in $Files) {
        $SourceFile = Join-Path $ResolvedSourceDir.Path "$Model\$File"
        if (-not (Test-Path -LiteralPath $SourceFile)) {
            Write-Error "Required prediction model file not found: $SourceFile"
        }

        Copy-Item -LiteralPath $SourceFile -Destination (Join-Path $ModelDestination $File) -Force
    }
}
