$ErrorActionPreference = 'Stop'
$backupDirectory = Join-Path $PSScriptRoot '..\backups'
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$containerArchive = '/tmp/folio-data-' + $stamp + '.tgz'
$output = Join-Path $backupDirectory ('folio-data-' + $stamp + '.tgz')
docker compose exec -T api tar -czf $containerArchive -C /data .
docker compose cp ('api:' + $containerArchive) $output
docker compose exec -T api rm -f $containerArchive
Write-Host "Backup created: $output"
