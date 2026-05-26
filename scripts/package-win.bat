@echo off
setlocal

set ROOT_DIR=%~dp0..
set PYTHON_BIN=%ROOT_DIR%\.venv\Scripts\python.exe
if not exist "%PYTHON_BIN%" set PYTHON_BIN=py

cd /d "%ROOT_DIR%"
"%PYTHON_BIN%" scripts\create-icons.py
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
call scripts\build-backend-win.bat
if errorlevel 1 exit /b 1
if not exist "%ROOT_DIR%\resources\backend\win\qingying-backend-runtime\qingying-backend-runtime.exe" (
  echo Windows backend executable was not generated.
  exit /b 1
)
call npx electron-builder --win portable
if errorlevel 1 exit /b 1

endlocal
