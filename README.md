# 星栈酒馆（Xingzhan Tavern）

星栈酒馆将 SillyTavern 前后端、Node 移动运行时与 Android WebView 装在同一个应用中。打开应用即可在本机运行酒馆，无需 Termux 或另装浏览器。项目还包含独立的「星栈合成」扩展，用于角色配音与图片生成。

## 下载

当前主程序：[v0.2-probe](https://github.com/FORSTNOVA/xingzhan-tavern/releases/tag/v0.2-probe) · [下载 Android APK](https://github.com/FORSTNOVA/xingzhan-tavern/releases/download/v0.2-probe/xingzhan-tavern-v0.2-probe.apk)。安装包仅支持 **arm64-v8a**，最低系统版本为 **Android 8.0（API 26）**。安装后首次启动需等待内嵌资源解压及本地服务就绪。

主 APK SHA-256：`fc989c961b7653b53b14d18f81a415fe3293759fb1c7197d636288f4bcc9a3e5`。当前仍是 probe 测试版，为支持覆盖安装，使用与 v0.1-probe 相同的 Android 调试签名。

可选的 [Sherpa 多音色系统 TTS 引擎 APK](https://github.com/FORSTNOVA/xingzhan-tavern/releases/download/v0.1-probe/sherpa-onnx-tts-engine-vits-zh-aishell3-multi-voice.apk) 是另一个应用，只在需要该离线语音引擎时安装；其源码位于 [xingzhan-tts-engine](https://github.com/FORSTNOVA/xingzhan-tts-engine)。安装后在 Android「文字转语音」设置中选用，再回酒馆检测音色。

## 本版变化

- 加入「星灯」二次元悬浮入口：可拖动、收成屏幕左/右边签，点击打开配音、插图、聊天定位和管理快捷面板。边签位置与收起状态会保存；这是酒馆内控件，不申请跨应用悬浮窗权限。
- 管理页将 **星栈主 APK** 与 **SillyTavern 官方程序**分开检查。主 APK 从本项目 GitHub Release 获取，由浏览器下载并交给 Android 确认安装；官方程序更新仍可在应用内准备、备份、启用和回滚。
- 从助手进入管理页时保留原聊天 WebView。通过系统返回键或「返回酒馆」回去，不再因普通页面跳转而重新初始化酒馆；实际切换官方程序版本仍需重启本地服务。
- 更新应用图标与说明文档。APK 的 `versionCode` 已递增，便于覆盖安装旧版。

## 使用与更新

酒馆的 **扩展设置 → 星栈合成 · 语音与图片** 提供配音、生图及星灯入口开关。星灯面板中点「管理与更新」前会保存当前聊天与设置。管理页有两条互不混用的更新渠道：

| 更新对象 | 操作方式 | 覆盖范围 |
| --- | --- | --- |
| 星栈酒馆 APK | 检查本项目 GitHub Release，下载主 APK 后由 Android 确认安装 | Android 外壳、内置 Node、原生桥接和随包扩展 |
| SillyTavern 官方程序 | 检查上游 `release` 分支，下载并准备后手动启用 | 兼容的酒馆前后端源码及纯 JavaScript 依赖 |
| 第三方 Git 扩展 | 在酒馆原有扩展面板更新 | 该扩展自身；非 Git 本地扩展会跳过 |

官方程序更新使用同一份用户数据目录；切换前会备份数据和配置，启动检查失败时回退程序版本。更新哪些组件可以不换主 APK、哪些必须换 APK，详见[更新范围说明](UPDATE-COMPONENTS.md)。星栈主 APK 不会静默下载安装；覆盖安装需要相同包名与签名。

## 主要功能

- **角色配音**：可对整条消息或选区配音，使用 Android 系统语音或自行配置的云端接口。API 模式支持文本分析、旁白与角色台词分类、人物音色记忆、审核修正、分段生成与缓存续接。后台音效类别目前仅识别标注，不生成音效。见[星栈合成说明](plugins/xingzhan-synthesis/README.md)。
- **图片生成**：可以直接写提示词，或从聊天内容构思提示词；支持云端中转、外部 Local Dream API、本地 SD.cpp 和实验性的 Local Dream QNN/NPU 路径。模型权重不随 APK 提供，云端来源需用户配置服务和令牌。见[图像生成说明](IMAGE-GENERATION.md)。
- **手机交互**：系统文件选择器、通知、屏幕旋转、WebView 内快捷入口，以及应用内本地服务管理。内置 SillyTavern 1.19.0（上游提交 `06bde939fb1e9c4c8d8641d810f0a916b5bce127`）和 Node 24.21.0。

星栈合成扩展依赖本 APK 提供的 `/api/android/media` 接口。把扩展单独安装到官方 SillyTavern，无法获得这些 Android 媒体功能。手机厂商的后台限制仍可能影响长时间任务。

## 从源码构建

在 Windows 上准备 Android Studio/SDK 36、NDK 27.2.12479018、CMake 3.22.1、Node.js 与 JDK 21。仓库不提交上游 SillyTavern 副本、Node 运行时、模型权重、签名密钥和本机 SDK 路径；首次准备需要网络。

```powershell
.\scripts\prepare.ps1
.\scripts\build.ps1
```

`scripts/build.ps1` 默认寻找 `%USERPROFILE%\.jdks\jbr-21.0.11`；若本机 JDK 位于其他目录，需先调整脚本中的 `JAVA_HOME`。构建产物为 `app/build/outputs/apk/debug/app-debug.apk`。可选的 Local Dream 原生 helper 在构建时从本机提供的 Local Dream APK 提取；没有该文件的构建不会自动具备托管 NPU 推理能力。分发 APK 时应使用与上一版一致的签名并递增 `versionCode`。参见[Git 与发布工作流](GIT-WORKFLOW.md)。

## 文档与验证范围

- [更新范围说明](UPDATE-COMPONENTS.md)：星栈 APK、官方程序、扩展、模型与系统组件的更新边界。
- [星栈合成说明](plugins/xingzhan-synthesis/README.md)、[图像生成说明](IMAGE-GENERATION.md)：入口、配置、缓存与后端限制。
- [本机 NPU 验证记录](LOCAL-NPU-BRIDGE.md)、[本地 SD 脚本索引](scripts/local-sd/README.md)：设备、模型和调试记录。
- [后台行为](BACKGROUND-ALLOWED-VALIDATION.md)、[聊天界面](CHAT-UI-VALIDATION.md)、[TavernMark](BENCHMARK-VALIDATION.md)：按文档所列日期与条件完成的验证。

托管 NPU 路径目前仅在 OnePlus 13T、SM8750 / HTP V79 与 AnythingV5 QNN SD 1.5 模型上完成导入、启动、取消、模型切换及方形/部分非方形出图验证；其他设备与模型不能据此视为已验证。长时间本地生图的热表现、不同厂商后台限制与跨版本数据迁移仍需继续测试。

## 上游与许可

集成的 SillyTavern 使用 AGPL-3.0；Node 移动运行时来自 [fogtape/nodejs-mobile](https://github.com/fogtape/nodejs-mobile/tree/recipe)。可选 Local Dream 组件及其许可见[归属说明](app/src/main/assets/LOCALDREAM-ATTRIBUTION.txt)和[许可证](app/src/main/assets/localdream-LICENSE.txt)。QNN 运行时与模型各有独立许可，分发前需分别核对。
