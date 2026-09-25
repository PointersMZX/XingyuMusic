# XingyuMusic（星雨音乐）

聚合音乐播放器，Windows 端 + Android 端分开研发、共用本仓库。

## 目录结构

| 目录 | 说明 |
| --- | --- |
| `XingyuMusic-desktop/` | Windows 端（Electron + Vue） |
| `XingyuMusic-mobile/` | Android 端（React Native） |

图标源文件在仓库外：`D:\Agent\icon\XingyuMusic-icons`（ico/png/bmp/1024 源图）。

## 开发

```bash
# Windows 端
cd XingyuMusic-desktop
npm ci
npm run dev      # 开发
npm run build    # 生产编译（不打包）

# Android 端
cd XingyuMusic-mobile
npm install
npm start        # Metro
npm run pack:android:debug   # 需本机 Android SDK + JDK17
```
