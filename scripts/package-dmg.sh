#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="$ROOT_DIR/release/mac-arm64/青影智筛.app"

cd "$ROOT_DIR"

if [ ! -d "$APP_PATH" ]; then
  echo "未找到已打包的 .app：$APP_PATH"
  echo "请先运行：npm run package:mac"
  exit 1
fi

npx electron-builder --mac dmg --prepackaged "$APP_PATH"
