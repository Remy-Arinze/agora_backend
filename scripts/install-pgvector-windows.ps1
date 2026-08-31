# Installs pgvector for the local PostgreSQL 18 Windows service.
# Run from an elevated PowerShell prompt (Run as administrator).

$ErrorActionPreference = "Stop"

$pgRoot = "C:\Program Files\PostgreSQL\18"
$zipPath = Join-Path $env:TEMP "vector.v0.8.3-pg18.zip"
$extractPath = Join-Path $env:TEMP "pgvector-pg18"
$releaseUrl = "https://github.com/andreiramani/pgvector_pgsql_windows/releases/download/0.8.3_18.4/vector.v0.8.3-pg18.zip"

if (-not (Test-Path $pgRoot)) {
  throw "PostgreSQL 18 not found at $pgRoot. Update `$pgRoot in this script for your install path."
}

Write-Host "Downloading pgvector for PostgreSQL 18..."
Invoke-WebRequest -Uri $releaseUrl -OutFile $zipPath -UseBasicParsing

if (Test-Path $extractPath) {
  Remove-Item $extractPath -Recurse -Force
}
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

Write-Host "Stopping PostgreSQL service..."
Stop-Service -Name "postgresql-x64-18" -Force

Write-Host "Installing pgvector files into $pgRoot..."
Copy-Item "$extractPath\lib\vector.dll" "$pgRoot\lib\vector.dll" -Force
Copy-Item "$extractPath\share\extension\*" "$pgRoot\share\extension\" -Force
if (Test-Path "$extractPath\include") {
  Copy-Item "$extractPath\include\*" "$pgRoot\include\" -Recurse -Force
}

Write-Host "Starting PostgreSQL service..."
Start-Service -Name "postgresql-x64-18"

Write-Host "pgvector installed. Verify with: CREATE EXTENSION vector;"
