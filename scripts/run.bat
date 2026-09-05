@echo off
title Revive — Autonomous Demo Engine
cd /d "%~dp0\.."
if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe run_demo.py
) else if exist ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe run_demo.py
) else (
    python run_demo.py
)
pause
