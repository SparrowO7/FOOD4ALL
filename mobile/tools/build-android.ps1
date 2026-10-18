param([string]$JavaHome = 'C:\Program Files\Android\Android Studio\jbr',
      [string]$AndroidSdk = "$env:LOCALAPPDATA\Android\Sdk")
$ErrorActionPreference = 'Stop'
$mobileRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path $mobileRoot -Parent
if (!(Test-Path "$JavaHome\bin\java.exe")) { throw 'Java 21 is required. Pass -JavaHome.' }
if (!(Test-Path $AndroidSdk)) { throw 'Android SDK is required. Pass -AndroidSdk.' }
if (!(Test-Path "$mobileRoot\.env.local")) { throw 'Configure mobile/.env.local from .env.example first.' }
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidSdk
$env:GRADLE_USER_HOME = Join-Path $mobileRoot '.tools/gradle'
$buildTemp = Join-Path $mobileRoot '.tools/tmp'
New-Item -ItemType Directory -Force $buildTemp | Out-Null
# Windows Unix-domain sockets fail when the inherited sandbox TEMP path is too long.
$env:JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir="' + $buildTemp + '" -Djava.io.tmpdir="' + $buildTemp + '"'
Set-Content "$mobileRoot\android\local.properties" ('sdk.dir=' + $AndroidSdk.Replace('\','/'))
Push-Location $mobileRoot
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Mobile web build failed.' }
    & npx.cmd --no-install cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Native sync failed.' }
    Push-Location android
    try {
        & .\gradlew.bat :app:assembleDebug --console=plain --max-workers=4
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    } finally { Pop-Location }
    $artifactDir = Join-Path $repoRoot 'artifacts'
    New-Item -ItemType Directory -Force $artifactDir | Out-Null
    $apk = Join-Path $artifactDir 'Food4All-India-Pilot-0.2.0.apk'
    Copy-Item 'android/app/build/outputs/apk/debug/app-debug.apk' $apk -Force
    Get-FileHash $apk -Algorithm SHA256 | Format-List
    Write-Host "APK: $apk"
} finally { Pop-Location }
