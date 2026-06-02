<#
.SYNOPSIS
  Seed AWS SSM Parameter Store (/pushit-frontend/prod/*, eu-west-1) from a .env.

.DESCRIPTION
  Source de vérité de la config front prod = SSM. La config front est PUBLIQUE
  -> tout en String (pas de SecureString). Requiert l'AWS CLI configurée avec
  ssm:PutParameter. Idempotent (--overwrite).

  Après seed, appliquer sur le serveur (cf. CLAUDE.md) :
    sudo systemctl restart pushit-frontend-runtime-fetch
    (ou déclencher un déploiement — la CI re-fetch automatiquement)

.EXAMPLE
  ./deploy/seed-parameter-store.ps1 ./prod.env
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$EnvFile
)
$ErrorActionPreference = "Stop"

$SsmPrefix = "/pushit-frontend/prod"
$AwsRegion = "eu-west-1"

if (-not (Test-Path -LiteralPath $EnvFile)) { throw "No such file: $EnvFile" }

foreach ($line in Get-Content -LiteralPath $EnvFile) {
    if ($line -match '^\s*$' -or $line -match '^\s*#') { continue }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { continue }

    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1)
    if ([string]::IsNullOrWhiteSpace($key)) { continue }

    Write-Host "  put $SsmPrefix/$key  (String)"
    aws ssm put-parameter `
        --name "$SsmPrefix/$key" `
        --value "$value" `
        --type "String" `
        --overwrite `
        --region $AwsRegion | Out-Null
}

Write-Host "Done. Seeded $SsmPrefix/* in $AwsRegion."
Write-Host "Apply on the server:"
Write-Host "  sudo systemctl restart pushit-frontend-runtime-fetch"
Write-Host "  (or trigger a deploy - CI re-fetches automatically)"
