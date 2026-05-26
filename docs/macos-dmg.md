# macOS DMG 打包说明

本项目使用 electron-builder 基于已生成的 `.app` 制作标准 macOS 安装镜像。

## 生成 .app

```bash
npm run package:mac
```

输出：

```text
release/mac-arm64/青影智筛 V1.2.app
```

## 基于 .app 生成 .dmg

```bash
npm run dmg
```

输出：

```text
release/青影智筛 V1.2.dmg
```

打开 `.dmg` 后，将 `青影智筛 V1.2.app` 拖入 `Applications` 文件夹即可完成安装。

## 一次性构建 .app 和 .dmg

```bash
npm run dist:mac
```

如中文文件名在特殊环境中导致打包失败，可临时将构建阶段产物改为 `Qingying.app` / `Qingying.dmg`，完成后再将最终镜像重命名为 `青影智筛 V1.2.dmg`。
