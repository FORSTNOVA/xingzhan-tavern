$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$env:JAVA_HOME = Join-Path $env:USERPROFILE '.jdks\jbr-21.0.11'
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$gradle = Join-Path $taskRoot 'gradlew.bat'
Set-Content -LiteralPath (Join-Path $taskRoot 'local.properties') -Value ('sdk.dir=' + (($sdk -replace '\\','/') -replace ':','\:')) -Encoding ascii
Push-Location $taskRoot
try {
    node scripts/pack-tavern.mjs
    if ($LASTEXITCODE) { throw 'Asset packaging failed' }
    & $gradle --no-daemon assembleDebug lintDebug
    if ($LASTEXITCODE) { throw 'APK build failed' }
} finally { Pop-Location }
