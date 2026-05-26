# 青影智筛 V1.2

青影智筛 V1.2 是一款面向校园活动、会议、讲座、志愿活动、团学活动等场景的本地桌面端照片智能初筛与素材管理工具。

项目定位是：AI 辅助粗筛、分类、去重和归档，不替代人工审美与最终判断。第三版重点是整理现有功能并交付可双击运行的桌面应用，支持 macOS `.app` 和 Windows portable `.exe` 打包。

## 技术栈

- 前端：React、TypeScript、Vite、Tailwind CSS、lucide-react
- 桌面端：Electron、electron-builder、安全 preload IPC
- 后端：Python、FastAPI、Uvicorn、SQLAlchemy、SQLite
- 图像处理：OpenCV、Pillow、ImageHash、numpy
- 导出：pandas、openpyxl
- 后端打包：PyInstaller

## 目录结构

```text
qingying-smart-screen/
├── app/electron/              # 第三版 Electron 主进程、preload、后端管理
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI 入口
│   │   ├── database.py        # SQLite 连接，写入用户数据目录
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── routers/           # 项目、图片、分析、相似、导出、设置、AI 接口
│   │   └── services/          # 图像质量、相似聚类、导出、配置、日志
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/renderer/          # React 桌面界面
│   ├── package.json
│   └── vite.config.ts
├── resources/
│   ├── backend/
│   │   ├── mac/               # macOS PyInstaller 输出 qingying-backend-runtime/
│   │   └── win/               # Windows PyInstaller 输出 qingying-backend-runtime/
│   └── icons/                 # 打包图标
├── scripts/
│   ├── build-backend-mac.sh
│   ├── build-backend-win.bat
│   ├── package-mac.sh
│   ├── package-win.bat
│   └── create-icons.py
├── electron-builder.yml
├── package.json
└── tsconfig.electron.json
```

## 本地数据目录

配置、数据库、缩略图、导出缓存和日志不会写入源码目录。

macOS：

```text
~/Library/Application Support/青影智筛/
├── config.json
├── logs/
└── storage/
```

Windows：

```text
C:\Users\用户名\AppData\Roaming\青影智筛\
```

配置项包括：

- `defaultImportDir`
- `defaultExportDir`
- `blurThreshold`
- `exposureThreshold`
- `similarityThreshold`
- `enableVisionModel`
- `visionProvider`
- `visionApiBase`
- `visionApiKey`
- `backendPort`
- `recentProjects`

## 安装依赖

后端：

```bash
cd qingying-smart-screen
python3 -m venv .venv
./.venv/bin/pip install -r backend/requirements.txt
```

前端与 Electron：

```bash
cd qingying-smart-screen
npm install
npm --prefix frontend install
```

如果 Electron 下载慢，可使用镜像源：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

## 开发环境启动

完整桌面端开发：

```bash
cd qingying-smart-screen
npm run dev
```

Electron 会自动启动本地 FastAPI 后端，默认端口为 `8765`。关闭 Electron 时会关闭由 Electron 启动的后端进程。

后端单独启动：

```bash
cd qingying-smart-screen
QINGYING_BACKEND_PORT=8765 ./.venv/bin/python backend/run.py
```

前端单独启动：

```bash
cd qingying-smart-screen
npm run dev:renderer
```

浏览器调试时前端默认访问 `http://127.0.0.1:8765`。Electron 环境下前端会通过 preload 获取实际后端地址。

## 主要功能

- 首页工作台：项目概览、核心流程、后端连接状态
- 照片导入：选择本地文件夹、扫描 `jpg/jpeg/png/webp`、生成缩略图
- 智能初筛：清晰度、曝光、分辨率、构图、综合评分、问题标签
- 相似聚类：感知哈希分组、组内推荐图、批量处理相似照片
- 人工复核：已入选、备选、已淘汰、待人工复核、推荐用途、分类、备注、大图预览
- 分类导出：已入选、备选、已淘汰、推荐宣传图、全部范围复制，生成 `筛选报告.xlsx`
- 本地配置：阈值、默认目录、后端端口、大模型配置
- 大模型预留：`/api/ai/analyze-image` 支持 mock 和 Provider 扩展

## 主要 API

- `GET /health`
- `POST /api/projects/create`
- `POST /api/images/import-folder`
- `POST /api/images/analyze`
- `POST /api/images/cluster-similar`
- `POST /api/images/update-review`
- `POST /api/export/images`
- `POST /api/export/report`
- `GET /api/settings`
- `POST /api/settings`
- `POST /api/ai/analyze-image`

第二版接口仍保留，例如：

- `POST /api/projects`
- `POST /api/projects/{project_id}/scan`
- `POST /api/projects/{project_id}/analyze/local`
- `POST /api/projects/{project_id}/similar-groups/build`
- `POST /api/projects/{project_id}/export`

## macOS 打包

```bash
cd qingying-smart-screen
sh scripts/package-mac.sh
```

脚本会执行：

1. 生成 `resources/icons/icon.icns`
2. 构建 Electron 主进程和 React 前端
3. 使用 PyInstaller 生成 `resources/backend/mac/qingying-backend-runtime/`
4. 使用 electron-builder 输出 `.app`

输出路径：

```text
release/mac-arm64/青影智筛 V1.2.app
```

如需制作可拖拽安装的 DMG 镜像：

```bash
npm run dmg
```

输出路径：

```text
release/青影智筛 V1.2.dmg
```

详细说明见 [docs/macos-dmg.md](docs/macos-dmg.md)。

如需只构建后端：

```bash
sh scripts/build-backend-mac.sh
```

## Windows 打包

在 Windows 机器执行：

```bat
cd qingying-smart-screen
scripts\package-win.bat
```

注意：PyInstaller 不能在 macOS 上直接交叉生成 Windows 后端 `.exe`，Windows 发行包需要在 Windows 机器或 Windows CI 上执行上述脚本。

脚本会生成：

```text
resources\backend\win\qingying-backend-runtime\qingying-backend-runtime.exe
release\青影智筛 V1.2-win-x64.exe
```

如需只构建后端：

```bat
scripts\build-backend-win.bat
```

详细说明见 [docs/windows-package.md](docs/windows-package.md)。

## 验证打包结果

macOS：

```bash
open "release/mac-arm64/青影智筛 V1.2.app"
```

也可以检查资源是否已打入应用：

```bash
ls "release/mac-arm64/青影智筛 V1.2.app/Contents/Resources/backend"
npx asar list "release/mac-arm64/青影智筛 V1.2.app/Contents/Resources/app.asar"
```

后端可执行文件单独验证：

```bash
QINGYING_BACKEND_PORT=8766 \
QINGYING_USER_DATA_DIR=/tmp/qingying-packaged-test \
resources/backend/mac/qingying-backend-runtime/qingying-backend-runtime

curl http://127.0.0.1:8766/health
```

## 常见问题

后端启动慢：后端已改为 PyInstaller onedir 放入 `.app/.exe` 内部，避免 onefile 每次大体积解压；首次加载 OpenCV/pandas 仍可能稍慢，界面会显示启动进度。

端口被占用：修改设置页的后端端口，或关闭占用 `8765` 的进程。Electron 会尝试寻找可用端口。

打包下载 Electron 失败：使用 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。

在 macOS 上打 Windows 包后后端不可用：请不要把 macOS 生成的后端运行时直接放进 Windows 包。Windows 版本需要先在 Windows 环境生成 `resources\backend\win\qingying-backend-runtime\qingying-backend-runtime.exe`。

macOS 未签名提示：当前开发包未配置 Apple Developer ID。正式分发前需要签名和公证。

Excel 导出失败：确认 `pandas`、`openpyxl` 已安装，且导出目录可写。

图片不显示：确认原始路径仍存在。缩略图和数据库在用户数据目录，不会修改原图。

## 大模型接入说明

当前大模型能力默认关闭。`POST /api/ai/analyze-image` 在未启用时返回 mock 结果，启用后会走 Provider 抽象。

已实现 OpenAI Vision 类接口，已预留：

- OpenAI Vision
- Qwen-VL
- Gemini Vision
- DeepSeek 多模态
- 本地 CLIP/BLIP/Ollama 类模型

后续接入时优先扩展 `backend/app/services/vision_model_service.py`，不要在路由中写死供应商逻辑。
