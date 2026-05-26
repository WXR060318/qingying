#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_BIN="$ROOT_DIR/.venv/bin/python"

if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

mkdir -p "$ROOT_DIR/resources/backend/mac" "$ROOT_DIR/build/pyinstaller-mac"
export PYINSTALLER_CONFIG_DIR="$ROOT_DIR/build/pyinstaller-cache"
mkdir -p "$PYINSTALLER_CONFIG_DIR"

"$PYTHON_BIN" -m PyInstaller \
  --noconfirm \
  --clean \
  --onedir \
  --name qingying-backend-runtime \
  --paths "$ROOT_DIR/backend" \
  --distpath "$ROOT_DIR/resources/backend/mac" \
  --workpath "$ROOT_DIR/build/pyinstaller-mac/work" \
  --specpath "$ROOT_DIR/build/pyinstaller-mac" \
  "$ROOT_DIR/backend/run.py"

chmod +x "$ROOT_DIR/resources/backend/mac/qingying-backend-runtime/qingying-backend-runtime"
