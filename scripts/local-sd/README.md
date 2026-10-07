# 本地 SD 开发与验收脚本

本目录集中放置手机本地 Stable Diffusion / SD.cpp 的手动开发脚本。它们保留了本轮探索过程，脚本可能操作连接的 Android 设备、启动或取消真实生图，部分脚本会改写应用源码。请先阅读目标脚本，再按下方类别单独运行；不要批量运行整个目录。

从仓库根目录运行命令，因为部分脚本使用相对仓库路径：

```powershell
node scripts/local-sd/tests/test-image-queue.mjs
```

需要访问 WebView CDP 的脚本复用 `scripts/webview-cdp.mjs`。设备序列号和 Android SDK 路径仍有一些写在脚本内；换设备或电脑前先检查脚本顶部的配置。

## 运行验证

- `tests/test-image-queue.mjs`：队列、排队、取消和结果恢复。
- `tests/test-image-queue-cancel.mjs`：不连接设备的取消隔离与“停止完成后才释放队列”单元测试。
- `tests/test-engine-and-generate.mjs`、`tests/test-generate-and-verify.mjs`、`tests/test-fixed-sd-gen.mjs`、`tests/test-single-gen.mjs`：设备端模型与生图链路；可能发出真实生图请求或启动本地推理。
- `tests/test-counterfeit-selected.mjs`、`tests/test-ghostmix-gen.mjs`、`tests/test-taesd-gen.mjs`：模型选择与本地模型推理验证。
- `tests/test-dropdown-change.mjs`、`tests/test-dropdown-cloud-local.mjs`、`tests/test-model-switch.mjs`、`tests/test-workbench-ui.mjs`：工作台交互和模型切换。
- `tests/verify-stop-and-models.mjs`、`tests/verify-vulkan-status.mjs`：停止行为、模型状态和设备状态检查。
- `diagnostics/debug-gen.mjs`、`diagnostics/do-cancel.mjs`、`diagnostics/open-workbench-screenshot.mjs`：一次性诊断和取消操作。

## 源码补丁和构建

- `patches/`：历史单次补丁脚本，可能直接修改应用/插件源码。不要在当前代码上重新运行；生成队列补丁检测到新停止实现后会直接拒绝运行。
- `build/build-vulkan.ps1`：本机 Android Vulkan 编译实验脚本，会先删除并重建 `tools/local-sd/build-vulkan`；只在确认可重建后手动运行。它依赖本机 CMake、Ninja、NDK、Visual Studio、SPIR-V 编译器及 `tools/local-sd` 下的第三方源码/头文件。

模型权重、编译目录、下载归档、可执行文件和解压的第三方依赖留在本机，不应纳入 Git。对应忽略规则位于仓库 `.gitignore`。本地手工部署与问题记录见 [LOCAL-SD-HANDOFF.md](../../LOCAL-SD-HANDOFF.md) 和 [工具说明](../../tools/local-sd/README.md)。
