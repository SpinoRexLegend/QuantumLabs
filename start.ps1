$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $ProjectRoot '.venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $VenvPython)) {
    Write-Host 'Creating the Python environment...'
    $PythonCommand = Get-Command py -ErrorAction SilentlyContinue
    if ($PythonCommand) {
        & $PythonCommand.Source -3 -m venv (Join-Path $ProjectRoot '.venv')
    }
    else {
        $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
        if (-not $PythonCommand) {
            throw 'Python 3.10+ is required. Install it from python.org, then run start.bat again.'
        }
        & $PythonCommand.Source -m venv (Join-Path $ProjectRoot '.venv')
    }
}

$DependencyCheck = & $VenvPython -c "import fastapi, qiskit, uvicorn" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Installing Qiskit and the web server (first launch only)...'
    & $VenvPython -m pip install -r (Join-Path $ProjectRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your internet connection and run start.bat again.' }
}
Set-Location -LiteralPath $ProjectRoot
Write-Host 'QuantumLabs is starting at http://127.0.0.1:8000'
Write-Host 'Your browser will open automatically. Keep this window open while using the app.'
& $VenvPython backend\serve.py
