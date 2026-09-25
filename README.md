# XingyuMusic（星雨音乐）

聚合音乐播放器，Windows 端 + Android 端分开研发、共用本仓库。

## 目录结构

| 目录 | 说明 |
| --- | --- |
| `XingyuMusic-desktop/` | Windows 端（Electron + Vue，基于开源 lx-music-desktop v2.12.6 复刻） |
| `XingyuMusic-mobile/` | Android 端（React Native，基于开源 lx-music-mobile v1.9.1 复刻） |
| `lx-music-desktop/` | **参考基线（只读，勿改）**：lx-music-desktop 原版源码 |
| `lx-music-mobile/` | **参考基线（只读，勿改）**：lx-music-mobile 原版源码 |
| `UIexample/` | UI 参考：Metric v1.4.3 APK（液态玻璃观感来源） |

图标源文件在仓库外：`D:\Agent\icon\XingyuMusic-icons`（ico/png/bmp/1024 源图）。

## 与原版 lx-music 的差异（截至 v3 首轮）

- 品牌全部替换为 XingyuMusic（应用名、图标、窗口标题、托盘、关于页、i18n、Android label/applicationId）
- 默认主题 = 紫金黑（`xingyu`，色值取自品牌 1024 图标原色：主紫 #7C20C2 / 主金 #D4B06F / 底黑 #12031F）
- 桌面端新增液态玻璃样式（`src/renderer/assets/styles/liquid-glass.less`，作用于顶栏/底栏/侧栏）
- 移动端播放底栏、侧栏抽屉接入玻璃底色与金色边缘高光（主题键 `c-glass-tint` / `c-glass-edge`）
- 功能逻辑未改动（照抄原版）；自动更新地址仍指向原版 lx-music 版本包，后续更换

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
