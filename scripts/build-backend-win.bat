@echo off
setlocal

set ROOT_DIR=%~dp0..
set PYTHON_BIN=%ROOT_DIR%\.venv\Scripts\python.exe
if not exist "%PYTHON_BIN%" set PYTHON_BIN=py

if not exist "%ROOT_DIR%\resources\backend" mkdir "%ROOT_DIR%\resources\backend"
if not exist "%ROOT_DIR%\resources\backend\win" mkdir "%ROOT_DIR%\resources\backend\win"
if not exist "%ROOT_DIR%\build\pyinstaller-win" mkdir "%ROOT_DIR%\build\pyinstaller-win"
set PYINSTALLER_CONFIG_DIR=%ROOT_DIR%\build\pyinstaller-cache
if not exist "%PYINSTALLER_CONFIG_DIR%" mkdir "%PYINSTALLER_CONFIG_DIR%"

"%PYTHON_BIN%" -m PyInstaller ^
  --noconfirm ^
  --clean ^
  --onedir ^
  --name qingying-backend-runtime ^
  --paths "%ROOT_DIR%\backend" ^
  --distpath "%ROOT_DIR%\resources\backend\win" ^
  --workpath "%ROOT_DIR%\build\pyinstaller-win\work" ^
  --specpath "%ROOT_DIR%\build\pyinstaller-win" ^
  "%ROOT_DIR%\backend\run.py"

endlocal
