# 星栈酒馆 (Xingzhan Tavern) - 安卓原生整合版

这个项目用于将完整的 SillyTavern 前后端系统直接嵌入 Android 原生应用进程中运行。通过系统 WebView 访问本机内嵌 Node.js HTTP 服务，无需安装 Termux、无需外部浏览器、不依赖第三方环境即可获得完整的单应用酒馆体验，并深度集成了 Android 系统原生能力与跨引擎本地离线语音合成（TTS）。

---

## 📥 最新安装包下载 (Releases)

可以在本项目的 [GitHub Releases 页面](https://github.com/FORSTNOVA/xingzhan-tavern/releases) 直接下载最新编译的 APK：

| 安装包名称 | 文件名 | 说明 |
| :--- | :--- | :--- |
| **星栈酒馆主程序** | `xingzhan-tavern-v0.1-probe.apk` | 完整酒馆安卓应用，内嵌 Node 24 运行时、后台前台服务与系统级桥接。 |
| **本地多音色 TTS 引擎** | `sherpa-onnx-tts-engine-vits-zh-aishell3-multi-voice.apk` | 配套本地离线语音合成引擎，内置 AIShell-3 174 位说话人多音色模型。 |

> [!TIP]
> 推荐同时安装上述两个 APK。酒馆安装后即可独立运行；配合安装本地 TTS 引擎后，可在无网络环境下享受超低延迟、多角色男女声自动分流的语音合成。

---

## 🎙️ 配套 TTS 引擎软件单独开源仓库

为了让本地语音引擎也能作为标准 Android 系统 TTS 服务供系统和其他应用复用，该引擎已作为独立项目单独开源维护：

- **开源仓库**：**[FORSTNOVA/xingzhan-tts-engine](https://github.com/FORSTNOVA/xingzhan-tts-engine)**
- **独立 Releases**：[Xingzhan TTS Releases](https://github.com/FORSTNOVA/xingzhan-tts-engine/releases)
- **技术基础**：基于开源 [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) 扩展与重构，实现了符合 Android 标准 `TextToSpeechService` 的多音色枚举协商机制、说话人特征映射与端侧低延迟推理。

---

## ⚙️ TTS 引擎配置与跨引擎分流协同

### 1. 启用系统 TTS 引擎
1. 在手机上安装 `sherpa-onnx-tts-engine-vits-zh-aishell3-multi-voice.apk`。
2. 打开手机系统 **「设置」** -> 搜索进入 **「文字转语音」** 或 **「文本转语音 (TTS)」**。
3. 将 **首选引擎** 切换为 **SherpaOnnx**。
4. 点击「试听」，听到中文测试语音即代表引擎已就绪。

### 2. 在星栈酒馆中进行协同分流
1. 打开星栈酒馆，点击右上角扩展中心，进入 **「星栈跨引擎语音合成 (xingzhan-synthesis)」** 插件。
2. 引擎选择：
   - **离线无网模式**：直接勾选 **「系统 / 本地 Sherpa 引擎」**，插件会自动检测并列出 174 位说话人列表（带男女声标签）。
   - **混合分流模式**：可同时勾选 **星栈中转云端 TTS**、**酒馆内置 TTS** 及 **本地 Sherpa 引擎**。
3. 分流规则：
   - 旁白、主角色、次要配角可分别绑定不同音色或引擎；
   - 支持根据角色特征自动分配男女声音色，兼顾云端极致音质与本地瞬时响应。

---

## 已实现核心功能

- Java 安卓外壳，JNI 内嵌 Node，未使用 Termux、shell 或额外安装的浏览器。
- 固定 SillyTavern 1.19.0，提交 `06bde939fb1e9c4c8d8641d810f0a916b5bce127`；后端源码保持原样。
- Node 24.21.0，由社区项目 fogtape/nodejs-mobile 提供，发布标记 `v24.21.0-0`。
- 本地服务 `127.0.0.1:8787`；验证页 `127.0.0.1:8788`。
- 用户打开应用时启动前台服务，状态通知、服务就绪检测、WebView 渲染进程恢复、基础文件选择。
- 使用原有 CSRF 校验；网络明文访问限定本地地址；无原生 JS bridge。
- 两分钟后台任务测试：独立于网页连接，每秒保存片段，重开页面可查询。
- 可关闭的流畅模式：通知中切换，每批加载 30 条历史，普通旧消息延后绘制。
- 完整跨引擎 TTS 分流与合成插件，支持安卓内置引擎、本地 Sherpa、星栈中转与官方 API 直连。
- 本地 Kokoro 交互式音色融合：可选两种音色、设置混合比例并替换现有音色槽位；融合需导出模型文件并由用户放回 Sherpa 模型目录，插件不会直接改写系统引擎数据。详见 [星栈合成插件说明](plugins/xingzhan-synthesis/README.md#kokoro-交互式音色融合)。

## 本机准备与构建

本次使用 SDK 36、NDK 27.2.12479018、CMake 3.22.1、AGP 8.11.1、Gradle 8.14.3 和本机 JBR 21。Android Studio 自带 JBR 25 不适用于这版 Gradle，导入项目时应选择 JDK 21。

```powershell
.\scripts\prepare.ps1
.\scripts\build.ps1
```

`build.ps1` 使用当前电脑的 `.jdks/jbr-21.0.11`。其他电脑需调整该路径或设置合适的 JDK。`local.properties` 使用本机 SDK 路径，不提交。APK 输出在 `app/build/outputs/apk/debug/app-debug.apk`。

两种 ABI：arm64-v8a 用于 64 位安卓真机，x86_64 用于模拟器。最小 Android 8.0；当前仅在较新的模拟器验证，不能据此宣布所有 Android 8+ 设备兼容。旧的 32 位手机暂不支持。

## 真机连接

开启开发者选项中的 USB 调试，USB 连接电脑，在手机上允许调试。多设备同时连接时，需要指定真机序列号，不能直接运行未限定设备的安装命令。

安装 APK 后，常驻通知的“管理与更新”进入管理页；其中“后台运行验证”打开两分钟模拟任务。当前请求不进行锁屏测试。文件上传使用系统选择器，导出使用系统“保存到”窗口。

## 接口验证

针对模拟器转发 `18787 -> 8787`、`18788 -> 8788` 后运行：

```powershell
node scripts/smoke.mjs
```

测试会在本机 18888 端口启动临时模型模拟接口，由模拟器通过 `10.0.2.2` 访问。不会调用收费模型或使用 API 密钥。验证 HTML、设置、角色、CSRF、普通生成、SSE 生成，以及断开客户端后上游是否被取消。结果保存在 `artifacts/smoke.json`。

## 尚未解决

完整聊天界面验证已完成：普通回复、流式、主动停止、亮屏后台 45 秒、聊天保存与重读六项通过，原连接设置已恢复。使用免费模拟上游，未调用真实模型；本轮不锁屏。详见 [CHAT-UI-VALIDATION.md](CHAT-UI-VALIDATION.md)。

最新后台状态：在一加 13T 开启系统“完全允许后台行为”后，默认无唤醒锁版两分钟后台任务与 WebView 持续流式请求均通过，原先暂停现象未再复现。详见 [BACKGROUND-ALLOWED-VALIDATION.md](BACKGROUND-ALLOWED-VALIDATION.md)。下述失败对照适用于开启该设置之前；网络断线和进程终止后的恢复仍待实现。

后台对照已恢复并完成：默认版和限时唤醒锁版都暂停；单应用电池优化豁免可让模拟上游的 90/90 流式代理完成，但交付间隔最长 13 秒、后台定时任务仍间歇停顿。尚不能宣称稳定后台生成，详见 [BACKGROUND-VALIDATION.md](BACKGROUND-VALIDATION.md)。测后恢复无唤醒锁版和原电池优化设置。

界面精简版已安装到真机。服务就绪后隐藏顶部状态行与原生按钮，保留系统栏和屏幕缺口的安全间距。启动提示仍在准备资源或失败时显示；管理和验证入口位于常驻通知的“管理与更新”，点通知正文可返回酒馆。启动器返回已有应用不会重新加载 WebView，避免中断当前流式连接。

真机 TavernMark 跑分兼容性已验证：标准模式 7/7 项有效完成，首次综合 560 分（S0 未校准），详见 [BENCHMARK-VALIDATION.md](BENCHMARK-VALIDATION.md)。首轮流畅模式对照为 507→545；主题版本对照为 505→548，并保留主题 CSS 警告。跨轮结果有波动，不能直接以首次成绩比较收益。主题优化详见 [THEME-PERFORMANCE-VALIDATION.md](THEME-PERFORMANCE-VALIDATION.md)。最新功能版为 `artifacts/tavern-probe-features.apk`，详见 [FEATURE-VALIDATION.md](FEATURE-VALIDATION.md)；本轮不重新进行跑分。

1. **真实请求断开恢复**：上游当前代码在客户端 socket 关闭时调用 AbortController。验证页的后台任务可继续，不代表酒馆实际模型请求已具备断线续传。下一阶段需要任务 ID、后端持续接收、结果保存及前端重连。
2. **厂商后台限制与 Doze**：前台服务并不保证永不被杀。本轮模拟器息屏测试不等同于深度 Doze 或厂商手机实测。原型没有使用唤醒锁。
3. **内嵌进程故障隔离**：Node 与外壳共享进程；Node 致命崩溃或 `process.exit()` 可终止整个应用。当前返回后不会在同一进程内再次启动 Node。
4. **更新**：已添加启动时检查官方 release、独立目录准备、启用前备份、健康检查及程序回滚。当前官方版本与内置版本相同，因此本次实测为官方同版本重新下载、替换和回滚；未来跨版本的数据迁移仍需实测。回滚程序不自动覆盖当前用户数据，更新前备份保留在应用私有目录。更新启动期间的异常和退出可恢复旧程序；运行稳定后的整个进程故障隔离仍待完善。
5. **扩展**：已接入 HTTP(S) 公开 Git 仓库的安装、更新、列分支及切换，使用内置 Git，不需要系统 Git。本轮通过本地 HTTP 智能 Git 仓库实测，未另做真实 HTTPS 仓库安装回归。全局扩展目录由各版本共享。外部程序、原生模块、私有仓库认证、Git LFS 及本地模型推理不在本次验证范围；APK 未包含完整 Termux 包管理环境。
6. **体积与发热**：首次版本保留全部上游资源，双 ABI APK 约 175 MiB。未进行真机温度、电量或对比浏览器测量；后续可拆 ABI、预编译前端并精简资源。
7. **发布准备**：文件单选、多选、取消，JSON/PNG 导出、剪贴板、音视频播放、视频全屏及外部链接已验证。麦克风和摄像头仅验证拒绝/取消，未启动传感器；实际采集与后台采集待用户允许后验证。系统服务恢复、全量数据备份导出及正式分发准备仍待完善。

## 来源与许可证

- SillyTavern：https://github.com/SillyTavern/SillyTavern   （AGPL-3.0，APK 内包含上游 LICENSE）。
- Node 移动构建：https://github.com/fogtape/nodejs-mobile/tree/recipe 。
- nodejs-mobile 官方：https://github.com/nodejs-mobile/nodejs-mobile 。

目前仅本地验证。对外分发时需保留各组件的许可证、声明和适用的源码提供方式，不能将这个原型直接视为已准备发布的成品。
