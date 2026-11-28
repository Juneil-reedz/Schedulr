# Builds the Microsoft Store package (.msix) from the Schedulr program that `tauri build` made.
# The Store signs the package itself, so this one is left unsigned: upload it in Partner Center
# (Packages), don't install it directly.
#
#   pwsh scripts/msix/build.ps1 -Exe src-tauri/target/release/schedulr.exe -Version 1.2.3 -Out dist/Schedulr_1.2.3.0_x64.msix
param(
  [Parameter(Mandatory)] [string] $Exe,
  [Parameter(Mandatory)] [string] $Version,
  [Parameter(Mandatory)] [string] $Out
)
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$work = Join-Path ([IO.Path]::GetTempPath()) "schedulr-msix"
$stage = Join-Path $work "package"
Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null

# The Store wants four parts (1.2.3 -> 1.2.3.0).
$v = ($Version -split "[-+]")[0]
while (($v -split "\.").Count -lt 4) { $v += ".0" }

Copy-Item $Exe (Join-Path $stage "Schedulr.exe")
Copy-Item (Join-Path $here "Assets") (Join-Path $stage "Assets") -Recurse
(Get-Content (Join-Path $here "AppxManifest.xml") -Raw).Replace("__VERSION__", $v) |
  Set-Content (Join-Path $stage "AppxManifest.xml") -Encoding utf8

# The newest Windows SDK tools on this machine.
$sdk = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.*\x64\makeappx.exe" |
  Sort-Object { [version]($_.Directory.Parent.Name) } -Descending | Select-Object -First 1
if (-not $sdk) { throw "The Windows SDK (makeappx.exe) was not found." }
$makeappx = $sdk.FullName
$makepri = Join-Path $sdk.DirectoryName "makepri.exe"
Write-Host "Windows SDK tools: $($sdk.DirectoryName)"

# resources.pri lets Windows pick the right size of each icon (crisp taskbar and Start icons).
$cfg = Join-Path $work "priconfig.xml"
& $makepri createconfig /cf $cfg /dq en-US /pv 10.0.0 /o
if ($LASTEXITCODE) { throw "makepri createconfig failed" }
# One index for every icon size (the default splits sizes into files meant for bundles).
[xml]$x = Get-Content $cfg
$x.resources.SelectNodes("//packaging") | ForEach-Object { $_.ParentNode.RemoveChild($_) | Out-Null }
$x.Save($cfg)
& $makepri new /pr $stage /cf $cfg /mn (Join-Path $stage "AppxManifest.xml") /of (Join-Path $stage "resources.pri") /o
if ($LASTEXITCODE) { throw "makepri new failed" }

New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
& $makeappx pack /d $stage /p $Out /o
if ($LASTEXITCODE) { throw "makeappx pack failed" }
Get-ChildItem $stage -Filter "resources*.pri" | ForEach-Object { Write-Host "Included $($_.Name)" }
Write-Host "Built $Out (version $v)"
