param(
  [Parameter(Mandatory = $true)]
  [string]$Tenant,
  [switch]$ClearNextCache
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $workspaceRoot "logs"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeTenant = $Tenant -replace "[^a-zA-Z0-9_-]", "-"
$logPath = Join-Path $logsDir "build-$safeTenant-$timestamp.log"
$nextCachePath = Join-Path $workspaceRoot ".next\cache"

if (-not (Test-Path -LiteralPath $logsDir)) {
  New-Item -ItemType Directory -Path $logsDir | Out-Null
}

if ($ClearNextCache -and (Test-Path -LiteralPath $nextCachePath)) {
  Write-Host "Clearing Next cache at $nextCachePath"
  Remove-Item -LiteralPath $nextCachePath -Recurse -Force
}

Write-Host "Saving build output to $logPath"

Push-Location $workspaceRoot
try {
  & cmd.exe /d /c "node scripts/with-tenant-env.mjs $Tenant build 2>&1" | Tee-Object -FilePath $logPath
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Build log saved to: $logPath"

exit $exitCode
