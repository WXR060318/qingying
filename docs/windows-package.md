# Windows 打包详细指南

本文档说明如何在 Windows 端把青影智筛 V1.2 打包为可双击运行的 portable `.exe`。当前项目不生成安装器，Windows 产物由 electron-builder 的 `portable` target 输出。

## 1. 当前打包结构

关键目录和文件：

```text
qingying-smart-screen/
├── app/electron/                         # Electron 主进程、preload、后端启动管理
├── backend/                              # FastAPI 后端源码
│   ├── requirements.txt                  # Python 依赖，包含 PyInstaller
│   └── run.py                            # PyInstaller 入口
├── frontend/                             # React/Vite 渲染进程
├── resources/
│   ├── backend/
│   │   └── win/                          # Windows 后端运行时输出目录
│   └── icons/                            # icon.png / icon.icns / icon.ico
├── scripts/
│   ├── build-backend-win.bat             # 只打包 Windows 后端
│   ├── package-win.bat                   # Windows 一键完整打包
│   └── create-icons.py                   # 生成跨平台图标
├── electron-builder.yml                  # Windows portable 配置
└── package.json                          # npm 脚本入口
```

最终 Windows 包需要包含两个部分：

- Electron 前端和主进程：`dist-electron/`、`frontend/dist/`
- PyInstaller 后端运行时：`resources/backend/win/qingying-backend-runtime/`

打包完成后，electron-builder 会把 Windows 后端运行时复制到应用内部的 `resources/backend/qingying-backend-runtime/`。Electron 启动后会查找 `qingying-backend-runtime.exe`，并自动启动本地 FastAPI 服务。

## 2. 准备 Windows 环境

建议使用 Windows 10 或 Windows 11 x64。

需要安装：

- Git
- Node.js LTS，建议 20.x
- Python 3.10 或更新版本，建议 3.11 或 3.12
- Visual C++ Redistributable 2015-2022 x64

确认命令可用：

```bat
git --version
node -v
npm -v
py --version
```

如果 `py --version` 不可用，也可以使用：

```bat
python --version
```

脚本会优先使用项目内的 `.venv\Scripts\python.exe`。如果不存在，才会回退到 `py`。

## 3. 获取项目代码

```bat
git clone git@github.com:WXR060318/qingying.git qingying-smart-screen
cd qingying-smart-screen
```

如果已经通过其他方式下载代码，进入实际项目根目录即可。项目根目录应能看到 `package.json`、`electron-builder.yml`、`backend/`、`frontend/` 和 `scripts/`。

## 4. 安装 Python 依赖

在项目根目录执行：

```bat
py -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

如果电脑上没有 `py`，改用：

```bat
python -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

这一步会安装 FastAPI、OpenCV、Pillow、pandas、openpyxl、PyInstaller 等后端运行和打包依赖。

## 5. 安装 Node/Electron 依赖

在项目根目录执行：

```bat
npm install
npm --prefix frontend install
```

如果 Electron 下载较慢或失败，可以临时设置镜像后重新安装。

PowerShell：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
npm --prefix frontend install
```

CMD：

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
npm --prefix frontend install
```

## 6. 打包前本地构建检查

建议先确认 TypeScript 和前端构建正常：

```bat
npm run build
```

该命令会执行：

```text
npm run build:electron
npm run build:renderer
```

成功后会生成：

```text
dist-electron/
frontend/dist/
```

## 7. 一键完整打包

推荐使用项目脚本：

```bat
npm run package:win
```

等价于：

```bat
scripts\package-win.bat
```

脚本会按顺序执行：

1. `scripts\create-icons.py`
   生成 `resources\icons\icon.png`、`icon.icns`、`icon.ico`。
2. `npm run build`
   构建 Electron 主进程和 React 前端。
3. `scripts\build-backend-win.bat`
   使用 PyInstaller 生成 Windows 后端运行时。
4. 检查：
   `resources\backend\win\qingying-backend-runtime\qingying-backend-runtime.exe`
5. `npx electron-builder --win portable`
   生成 Windows portable 应用。

## 8. 输出文件

后端运行时输出：

```text
resources\backend\win\qingying-backend-runtime\qingying-backend-runtime.exe
```

完整 Windows portable 输出：

```text
release\青影智筛 V1.2-win-x64.exe
```

`release/`、`build/`、`dist-electron/`、`frontend/dist/`、`resources/backend/win/qingying-backend-runtime/` 都是可重建产物，已在 `.gitignore` 中忽略。

## 9. 只打包后端

如果只想验证 PyInstaller 后端：

```bat
scripts\build-backend-win.bat
```

成功后检查：

```bat
dir resources\backend\win\qingying-backend-runtime
```

目录中应包含：

```text
qingying-backend-runtime.exe
_internal\
```

可以单独启动后端做健康检查：

```bat
set QINGYING_BACKEND_PORT=8766
set QINGYING_USER_DATA_DIR=%TEMP%\qingying-packaged-test
resources\backend\win\qingying-backend-runtime\qingying-backend-runtime.exe
```

另开一个终端执行：

```bat
curl http://127.0.0.1:8766/health
```

返回健康状态后，说明后端运行时可用。

## 10. 验证完整 exe

双击运行：

```text
release\青影智筛 V1.2-win-x64.exe
```

重点检查：

- 应用能正常打开。
- 首页后端状态能从启动中变为已连接。
- 可以新建项目。
- 可以导入包含 `jpg/jpeg/png/webp` 的文件夹。
- 可以执行图片分析。
- 可以导出图片和 `筛选报告.xlsx`。

Windows 用户数据目录：

```text
C:\Users\用户名\AppData\Roaming\青影智筛\
```

日志通常在：

```text
C:\Users\用户名\AppData\Roaming\青影智筛\logs\
```

如果应用界面提示后端启动失败，优先查看该目录下的日志。

## 11. 清理后重新打包

如果需要从干净状态重新打包，可以删除这些可重建目录：

```bat
rmdir /s /q build
rmdir /s /q dist-electron
rmdir /s /q frontend\dist
rmdir /s /q resources\backend\win\qingying-backend-runtime
rmdir /s /q release
```

然后重新执行：

```bat
npm run package:win
```

一般不需要删除 `.venv`、`node_modules` 或 `frontend\node_modules`。只有依赖损坏或想完整重装时再删除它们。

## 12. 发布前检查清单

发布前建议逐项确认：

- `package.json` 版本号是 `1.2.0`。
- `frontend/package.json` 版本号是 `1.2.0`。
- `backend/app/main.py` API 版本号是 `1.2.0`。
- `electron-builder.yml` 中 `productName` 是 `青影智筛 V1.2`。
- `electron-builder.yml` 中 `portable.artifactName` 是 `青影智筛 V1.2-win-${arch}.${ext}`。
- `resources\icons\icon.ico` 存在。
- `resources\backend\win\qingying-backend-runtime\qingying-backend-runtime.exe` 存在。
- `release\青影智筛 V1.2-win-x64.exe` 可以在一台干净 Windows 机器上启动。

## 13. 常见问题

### PyInstaller 不能在 macOS 直接生成 Windows exe

Windows 发行包必须在 Windows 机器或 Windows CI 上构建。不要把 macOS 生成的后端运行时放进 Windows 包。

### `Windows backend executable was not generated.`

说明 `scripts\build-backend-win.bat` 没有生成：

```text
resources\backend\win\qingying-backend-runtime\qingying-backend-runtime.exe
```

处理方式：

```bat
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
scripts\build-backend-win.bat
```

如果仍失败，查看 PyInstaller 输出中缺失的 Python 包或 DLL。

### Electron 下载失败

设置 Electron 镜像后重新执行 `npm install`：

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
```

### 应用启动后后端连接失败

先查看日志：

```text
C:\Users\用户名\AppData\Roaming\青影智筛\logs\
```

再确认 portable 包内部确实包含后端运行时。可以解压或检查 electron-builder 产物目录，目标结构应包含：

```text
resources\backend\qingying-backend-runtime\qingying-backend-runtime.exe
```

### 端口被占用

默认后端端口是 `8765`。如果被占用，应用会尝试寻找可用端口，也可以在设置页修改后端端口。

### Windows 安全提示或杀毒软件拦截

当前项目未配置 Windows 代码签名。首次运行 portable `.exe` 时，Windows SmartScreen 或杀毒软件可能提示风险。正式分发前建议配置代码签名证书。

### 中文路径或文件名异常

项目当前使用中文产品名和中文产物名。如果某些 CI、压缩工具或杀毒软件对中文路径兼容性不好，可以临时把仓库放在纯英文路径下构建，例如：

```text
C:\work\qingying-smart-screen
```

不要手动改动源码中的产品名，除非同步更新 `electron-builder.yml` 和文档。
