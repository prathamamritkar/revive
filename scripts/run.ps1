$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
Set-Location $projectRoot

if (Test-Path "$projectRoot\venv\Scripts\python.exe") {
    & "$projectRoot\venv\Scripts\python.exe" run_demo.py
} elseif (Test-Path "$projectRoot\.venv\Scripts\python.exe") {
    & "$projectRoot\.venv\Scripts\python.exe" run_demo.py
} else {
    python run_demo.py
}
