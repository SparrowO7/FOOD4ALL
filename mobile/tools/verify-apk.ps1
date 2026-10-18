param([string]$Apk = (Join-Path $PSScriptRoot '../../artifacts/Food4All-India-Pilot-0.2.0.apk'),
      [string]$AndroidSdk = "$env:LOCALAPPDATA\Android\Sdk",
      [string]$JavaHome = 'C:\Program Files\Android\Android Studio\jbr')
$ErrorActionPreference='Stop'
$env:JAVA_HOME=$JavaHome
$Apk=(Resolve-Path -LiteralPath $Apk).Path
$buildTools=Join-Path $AndroidSdk 'build-tools/36.0.0'
& "$buildTools/apksigner.bat" verify --verbose $Apk
if($LASTEXITCODE -ne 0){throw 'APK signature verification failed.'}
$badging=& "$buildTools/aapt.exe" dump badging $Apk
if($LASTEXITCODE -ne 0){throw 'APK manifest could not be read.'}
$badging | Select-String "package:|sdkVersion:|targetSdkVersion:|application-label:|native-code:"
if(!($badging -match "name='org.food4all.pilot'")){throw 'Unexpected application ID.'}
if(!($badging -match "sdkVersion:'26'")){throw 'Unexpected minimum Android version.'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead($Apk)
try {
    $entry=$zip.GetEntry('assets/capacitor.config.json')
    if(!$entry){throw 'Missing bundled Capacitor configuration.'}
    $reader=[IO.StreamReader]::new($entry.Open())
    try{$config=$reader.ReadToEnd() | ConvertFrom-Json}finally{$reader.Dispose()}
    if($config.server.url){throw 'APK is loading a remote development server.'}
    if(!$zip.GetEntry('assets/public/index.html')){throw 'Missing local application screens.'}
    Write-Output 'Bundled screens verified; no remote server.url.'
}finally{$zip.Dispose()}
Get-FileHash -LiteralPath $Apk -Algorithm SHA256 | Format-List
