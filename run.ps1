$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (Test-Path "$scriptDir\venv\Scripts\python.exe") {
    & "$scriptDir\venv\Scripts\python.exe" run_demo.py
} elif (Test-Path "$scriptDir\.venv\Scripts\python.exe") {
    & "$scriptDir\.venv\Scripts\python.exe" run_demo.py
} else {
    python run_demo.py
}
