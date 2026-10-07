# 图像生成

星栈酒馆的生图能力由合成插件前端和 Android 媒体服务组成。插件 UI/队列代码位于 `plugins/xingzhan-synthesis/`，Android 安装包使用的镜像资源位于 `app/src/main/assets/`；媒体路由和后端调度主要在 `app/src/main/assets/android-media.mjs`。修改插件资源时需要同步两处镜像。

## 可选后端

- **云端中转**：将请求发送到配置的兼容服务。当前默认图像模型名为 `gemini-3.1-flash-lite-image`；实际可用模型和参数取决于中转服务及其上游渠道。应用不内置密钥。
- **外部 Local Dream API**：连接单独运行的 Local Dream 服务；必须在手机上另行启动该应用并确保 Tavern 能访问其 API。
- **本地 SD.cpp**：通过 Android 本地伴侣服务运行本地 Stable Diffusion。模型文件由用户自行导入，CPU/OpenCL/Vulkan 的可用性和速度取决于设备、模型与构建配置；不代表 Android 系统 NPU 可被通用调用。
- **托管 Local Dream QNN/NPU**：在酒馆内启动独立 helper 子进程，通过 Qualcomm QNN/Hexagon 运行转换后的 SD 1.5 模型。它与 SD.cpp 是不同后端，模型与 QNN 运行时不作为普通 APK 内置资源。

## NPU 后端现状

该路径已在 OnePlus 13T（SM8750 / HTP V79）上通过酒馆正常生图流程验证，涵盖 ZIP 选择与模型导入、启动/停止、队列取消、模型切换，以及 512×512、512×768 和 768×512 输出。AnythingV5 是已做图像检查的模型；不能据此推断其他设备、QNN 版本或 SD 1.5 转换模型均兼容。

曾出现的非方形色块问题来自启动 helper 时遗漏该尺寸对应的 `.patch`；当前导入和切换逻辑会校验并传入补丁。标准 SD 1.5 参数预设为 20 步、CFG 7，正负提示词会按本地 tokenizer 计数，超过限制时会阻止提交。低步数设置仍可能造成细节偏弱。

NPU 属于实验性设备路径：需要支持的 Qualcomm 芯片、匹配的 QNN 运行时和合规的转换模型 ZIP；导入模型可能占用较大存储，推理会明显占用内存并发热。长时间连续生成的热表现尚未完整测量。默认构建不会自动加载大模型，导入模型保存在应用文件目录。Local Dream、Qualcomm 运行时及模型分别受各自许可约束；详见仓库中的归属和许可文件。

## 代码与验证记录

- NPU 实现与 OnePlus 13T 设备验收：[`LOCAL-NPU-BRIDGE.md`](LOCAL-NPU-BRIDGE.md)
- 本地 SD 历史排障记录：[`LOCAL-SD-HANDOFF.md`](LOCAL-SD-HANDOFF.md)
- 生图开发脚本说明：[`scripts/local-sd/README.md`](scripts/local-sd/README.md)
- NPU 画质与 token 问题方案/实施记录：[`LOCAL-NPU-QUALITY-PLAN.md`](LOCAL-NPU-QUALITY-PLAN.md)

仓库只保存源码、脚本及文档。模型权重、第三方下载源码、编译缓存和私有 API 密钥均不应提交；发布 APK 使用 GitHub Releases。
