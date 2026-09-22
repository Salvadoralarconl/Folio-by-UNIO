$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$secretFile = Join-Path $projectRoot 'office\.env'
if (-not (Test-Path -LiteralPath $secretFile)) {
  $secretBytes = New-Object byte[] 48
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  $generator.GetBytes($secretBytes)
  $generator.Dispose()
  [IO.File]::WriteAllText($secretFile, 'JWT_SECRET=' + [BitConverter]::ToString($secretBytes).Replace('-',''))
}
$linuxProject = (wsl -d Ubuntu-24.04 -u root -- wslpath -a $projectRoot.Replace('\','/')).Trim()
# Keep the WSL distribution alive so localhost:8080/1421 remains reachable
# after this one-shot startup script exits.
$keeper = Start-Process -FilePath 'wsl.exe' -ArgumentList '-d Ubuntu-24.04 -u root -- tail -f /dev/null' -WindowStyle Hidden -PassThru
[IO.File]::WriteAllText((Join-Path $projectRoot 'office\.keeper.pid'), [string]$keeper.Id)
wsl -d Ubuntu-24.04 -u root -- service docker start
wsl -d Ubuntu-24.04 -u root -- docker compose --project-directory "$linuxProject/office" up -d --build --force-recreate --remove-orphans
if ($LASTEXITCODE -ne 0) { throw 'ONLYOFFICE could not start. See the output above.' }
Write-Host 'ONLYOFFICE is starting at http://localhost:8080. Initial startup can take several minutes.'
