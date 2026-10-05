$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
try {
    if (!(Test-Path vendor/SillyTavern/package.json)) {
        git clone --no-checkout https://github.com/SillyTavern/SillyTavern.git vendor/SillyTavern
        if ($LASTEXITCODE) { throw 'Clone failed' }
        git -C vendor/SillyTavern checkout 06bde939fb1e9c4c8d8641d810f0a916b5bce127
        if ($LASTEXITCODE) { throw 'Checkout failed' }
    }
    $revision = git -C vendor/SillyTavern rev-parse HEAD
    if ($revision -ne '06bde939fb1e9c4c8d8641d810f0a916b5bce127') { throw 'Unexpected SillyTavern revision' }
    Push-Location vendor/SillyTavern
    try { npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund; if ($LASTEXITCODE) { throw 'Dependency installation failed' } } finally { Pop-Location }
    if (!(Test-Path node-mobile-modern.zip)) {
        curl.exe -L --fail https://github.com/fogtape/nodejs-mobile/releases/download/v24.21.0-0/nodejs-mobile-android-24.21.0-0.zip -o node-mobile-modern.zip
        if ($LASTEXITCODE) { throw 'Runtime download failed' }
    }
    if ((Get-FileHash node-mobile-modern.zip -Algorithm SHA256).Hash -ne 'E3CD29A1BE03405F11DD5C857AF8CD3AD13F84F1409EA648F5328F0BADA5BD76') { throw 'Runtime archive checksum mismatch' }
    Expand-Archive -LiteralPath node-mobile-modern.zip -DestinationPath runtime/node24 -Force
} finally { Pop-Location }
