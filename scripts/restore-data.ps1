param([Parameter(Mandatory=$true)][string]$Backup)
$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $Backup).Path
docker compose cp $resolved api:/tmp/folio-restore.tgz
docker compose exec -T api sh -c 'rm -rf /data/* && tar -xzf /tmp/folio-restore.tgz -C /data && rm /tmp/folio-restore.tgz'
docker compose restart api
Write-Host 'Folio data restored and the API restarted.'
