# 星栈酒馆（Xingzhan Tavern）

星栈酒馆把 SillyTavern 的前后端装入 Android 应用：应用启动本机 Node.js 服务，再用系统 WebView 打开酒馆。日常使用无需 Termux 或另装浏览器。项目还提供独立的「星栈合成」插件，用于角色配音和图片生成。

## 下载与安装

当前发布版本为 [v0.1-probe](https://github.com/FORSTNOVA/xingzhan-tavern/releases/tag/v0.1-probe)，仅提供 **arm64-v8a** APK，最低系统版本为 **Android 8.0（API 26）**。

| 文件 | 用途 |
| --- | --- |
| [xingzhan-tavern-v0.1-probe.apk](https://github.com/FORSTNOVA/xingzhan-tavern/releases/download/v0.1-probe/xingzhan-tavern-v0.1-probe.apk) | 星栈酒馆主程序，包含酒馆、合成插件及 Android 本地服务。 |
| [sherpa-onnx-tts-engine-vits-zh-aishell3-multi-voice.apk](https://github.com/FORSTNOVA/xingzhan-tavern/releases/download/v0.1-probe/sherpa-onnx-tts-engine-vits-zh-aishell3-multi-voice.apk) | 可选的独立系统 TTS 引擎；只在需要这套离线多音色语音时安装。 |

安装主程序并打开，等待本地服务就绪后即可进入酒馆。管理与更新入口在应用的常驻通知中。要使用配音或生图，在酒馆的 **扩展设置 → 星栈合成 · 语音与图片** 中打开相应功能。

独立 TTS 引擎的源码位于 [xingzhan-tts-engine](https://github.com/FORSTNOVA/xingzhan-tts-engine)。安装该引擎后，先在 Android 系统的「文字转语音」设置中选用并试听，再回到插件检测系统语音引擎。它是可选组件；云端 TTS 和其他可用的 Android 系统语音引擎有各自的配置方式。

## 主要功能

- **酒馆运行与管理**：内嵌 SillyTavern 1.19.0（上游提交 `06bde939fb1e9c4c8d8641d810f0a916b5bce127`）和 Node 24.21.0；支持本地服务状态、更新与回滚、扩展安装和更新。手机的后台限制仍会影响长时间任务。
- **角色配音**：星栈合成插件可朗读整条消息或选区，选择 Android 系统语音或配置的云端接口。API 模式可先分析旁白与角色台词，再在审核界面修正人物、情绪和音色；分析与已生成音频按角色卡保存。Kokoro 音色融合会导出替换用的模型文件，需要用户自行部署到对应语音引擎。详见[插件使用说明](plugins/xingzhan-synthesis/README.md)。
- **图片生成**：可从聊天内容构思提示词，或直接输入提示词；生成结果按角色卡保存。可选云端中转、外部 Local Dream API、本地 SD.cpp，以及实验性的托管 Local Dream QNN/NPU 路径。云端模式需要自行配置服务和令牌；本地模式需要匹配的模型与运行环境。详见[图像生成说明](IMAGE-GENERATION.md)。
- **手机交互**：使用系统文件选择器导入文件；应用处理通知、WebView 恢复和屏幕旋转。具体的真机验证范围见下方报告。

星栈合成依赖本 APK 提供的 `/api/android/media` 接口。将插件单独安装到官方 SillyTavern，无法获得这些 Android 媒体接口。

## 生图后端的验证范围

托管 NPU 路径已在 **OnePlus 13T、SM8750 / HTP V79、AnythingV5 QNN SD 1.5 模型**上验证模型导入、启动与停止、取消、模型切换，以及方形和两种非方形图片。非方形生成需要模型包内对应的 `.patch` 文件。其他手机、QNN 运行时和模型尚不能按这组结果视为已验证。模型权重不随 APK 提供，连续生成的热表现也仍需更多测试；详情见 [Local NPU 验证记录](LOCAL-NPU-BRIDGE.md)。

## 从源码构建

在 Windows 上准备 Android Studio/SDK 36、NDK 27.2.12479018、CMake 3.22.1、Node.js 和 JDK 21。仓库不跟踪 SillyTavern 上游副本、Node 移动运行时、模型权重及本机 SDK 路径；`prepare.ps1` 会取得构建所需的上游代码和 Node 运行时。首次准备需要网络。

```powershell
.\scripts\prepare.ps1
.\scripts\build.ps1
```

`build.ps1` 当前使用 `%USERPROFILE%\.jdks\jbr-21.0.11` 作为 JDK，并根据本机 Android SDK 位置生成不提交的 `local.properties`；换电脑时需先调整该脚本或准备对应路径。构建结果位于 `app/build/outputs/apk/debug/app-debug.apk`。可选 NPU helper 在构建时从本机提供的 Local Dream APK 提取；没有该文件的源码构建不会自动具备托管 NPU 推理能力。构建细节与提交范围见 [Git 工作流](GIT-WORKFLOW.md)。

## 验证与文档

- [图像生成说明](IMAGE-GENERATION.md)：后端区别、模型依赖和当前限制。
- [星栈合成插件说明](plugins/xingzhan-synthesis/README.md)：TTS、生图入口与数据保存方式。
- [Local NPU 验证记录](LOCAL-NPU-BRIDGE.md) 与 [本地 SD 脚本索引](scripts/local-sd/README.md)：设备测试及开发脚本。
- [后台行为记录](BACKGROUND-ALLOWED-VALIDATION.md)、[聊天界面验证](CHAT-UI-VALIDATION.md) 与 [TavernMark 验证](BENCHMARK-VALIDATION.md)：各自日期和配置下的测试结果。

历史测试报告只证明文档中列明的设备与场景。当前仍需继续验证不同厂商的后台限制、长时间本地生图发热、其他 NPU 设备与模型，以及跨版本更新的数据迁移。

## 上游与许可证

本项目集成的 SillyTavern 使用 AGPL-3.0；Node 移动运行时来自 [fogtape/nodejs-mobile](https://github.com/fogtape/nodejs-mobile/tree/recipe)。可选的 Local Dream 组件及其许可见 [归属说明](app/src/main/assets/LOCALDREAM-ATTRIBUTION.txt) 和 [许可证](app/src/main/assets/localdream-LICENSE.txt)。QNN 运行时和各模型另有各自许可，使用或再分发时需要分别核对。
